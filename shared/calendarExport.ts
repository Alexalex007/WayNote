import type { Activity, Trip } from '../types';
import { detectDestinationIntel } from './destinationIntel';
import { type AppLanguage, localizeDestinationLabel, tr } from './i18n';

function parseDurationMinutes(duration?: string): number {
  if (!duration) return 90;
  const raw = duration.trim().toLowerCase();
  const hoursMatch = raw.match(/(\d+(?:\.\d+)?)\s*h/);
  const minsMatch = raw.match(/(\d+)\s*m/);

  if (hoursMatch || minsMatch) {
    const h = hoursMatch ? parseFloat(hoursMatch[1]) : 0;
    const m = minsMatch ? parseInt(minsMatch[1], 10) : 0;
    const total = Math.round(h * 60 + m);
    return total > 0 ? total : 90;
  }

  const numeric = parseFloat(raw.replace(/[^\d.]/g, ''));
  if (!Number.isNaN(numeric) && numeric > 0) {
    return numeric <= 12 ? Math.round(numeric * 60) : Math.round(numeric);
  }
  return 90;
}

function parseGmtOffsetLabel(label?: string): number | null {
  if (!label) return null;
  const m = label.match(/(?:GMT|UTC)\s*([+-])\s*(\d{1,2})(?::(\d{2}))?/i);
  if (!m) return null;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (Number(m[2]) + Number(m[3] || 0) / 60);
}

function resolveDestinationForDate(trip: Trip, dateIso: string): string {
  if (trip.type === 'Multi' && trip.stops && trip.stops.length > 0) {
    const activeStop = trip.stops.find((s) => dateIso >= s.startDate && dateIso <= s.endDate);
    if (activeStop?.destination) return activeStop.destination;
  }
  return trip.destination;
}

function toUtcMs(dateIso: string, timeHm: string, utcOffsetHours: number): number | null {
  const dm = dateIso.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dm) return null;
  const tm = (timeHm || '09:00').trim().match(/^(\d{1,2}):(\d{2})$/);
  const hh = tm ? Math.min(23, Math.max(0, Number(tm[1]))) : 9;
  const mm = tm ? Math.min(59, Math.max(0, Number(tm[2]))) : 0;
  const utcLocalBase = Date.UTC(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), hh, mm, 0);
  return utcLocalBase - Math.round(utcOffsetHours * 3600000);
}

function formatUtcMsToIcs(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return `${y}${m}${day}T${hh}${mm}${ss}Z`;
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function foldIcsLine(line: string): string {
  const encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
  if (!encoder) return line;
  if (encoder.encode(line).length <= 74) return line;

  const chunks: string[] = [];
  let current = '';
  let currentBytes = 0;

  for (const ch of Array.from(line)) {
    const chBytes = encoder.encode(ch).length;
    const limit = chunks.length === 0 ? 74 : 73;
    if (currentBytes + chBytes > limit && current.length > 0) {
      chunks.push(current);
      current = ch;
      currentBytes = chBytes;
    } else {
      current += ch;
      currentBytes += chBytes;
    }
  }
  if (current) chunks.push(current);
  return chunks.join('\r\n ');
}

function resolveActivityWindow(
  trip: Trip,
  dateIso: string,
  activity: Activity,
  lang: AppLanguage
): {
  startMs: number;
  endMs: number;
  summary: string;
  location: string;
  description: string;
} | null {
  const dest = resolveDestinationForDate(trip, dateIso);
  const intel = detectDestinationIntel(dest, lang);
  const dayTheme = trip.themes?.[dateIso]?.trim();

  if (activity.type === 'flight' && activity.flightInfo) {
    const fi = activity.flightInfo;
    const depOffset = parseGmtOffsetLabel(fi.departureTimezone) ?? intel.utcOffsetHours;
    const arrOffset = parseGmtOffsetLabel(fi.arrivalTimezone) ?? depOffset;
    const depDate = fi.departureDate || dateIso;
    const arrDate = fi.arrivalDate || depDate;
    const startMs = toUtcMs(depDate, fi.departureTime || activity.time, depOffset);
    if (startMs === null) return null;

    let endMs = toUtcMs(arrDate, fi.arrivalTime || activity.time, arrOffset);
    if (endMs === null || endMs <= startMs) {
      endMs = startMs + parseDurationMinutes(fi.duration) * 60000;
    }

    const summary = fi.flightNumber
      ? `${fi.flightNumber} (${fi.departureCode} → ${fi.arrivalCode})`
      : activity.title;
    const location = `${fi.departureCode} → ${fi.arrivalCode}`;
    const descParts = [
      fi.planeType ? `${tr(lang, '機型', '机型', 'Aircraft')}: ${fi.planeType}` : '',
      fi.duration ? `${tr(lang, '飛行時間', '飞行时间', 'Duration')}: ${fi.duration}` : '',
      activity.description?.trim() || '',
      `Waynote · ${trip.name}`,
    ].filter(Boolean);

    return {
      startMs,
      endMs,
      summary,
      location,
      description: descParts.join('\n'),
    };
  }

  const startMs = toUtcMs(dateIso, activity.time || '09:00', intel.utcOffsetHours);
  if (startMs === null) return null;
  const endMs = startMs + parseDurationMinutes(activity.duration) * 60000;

  const descParts = [
    dayTheme ? `${tr(lang, '當日主題', '当日主题', 'Day Theme')}: ${dayTheme}` : '',
    activity.description?.trim() || '',
    `Waynote · ${trip.name}`,
  ].filter(Boolean);

  return {
    startMs,
    endMs,
    summary: activity.title,
    location: activity.location?.trim() || localizeDestinationLabel(dest, lang),
    description: descParts.join('\n'),
  };
}

function sanitizeFilename(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_');
  return cleaned || 'Waynote_Trip';
}

export function buildTripIcs(
  trip: Trip,
  lang: AppLanguage
): { icsContent: string; eventCount: number; filename: string } {
  const dtStamp = formatUtcMsToIcs(Date.now());
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Waynote//Travel Itinerary//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(trip.name)}`,
  ];

  let eventCount = 0;
  const sortedDates = Object.keys(trip.activities || {}).sort();

  for (const dateIso of sortedDates) {
    const dayList = trip.activities?.[dateIso] || [];
    for (const act of dayList) {
      const win = resolveActivityWindow(trip, dateIso, act, lang);
      if (!win) continue;

      const safeUid = `${act.id.replace(/[^a-zA-Z0-9_-]/g, '')}-${dateIso.replace(/-/g, '')}@waynote.app`;
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${safeUid}`);
      lines.push(`DTSTAMP:${dtStamp}`);
      lines.push(`DTSTART:${formatUtcMsToIcs(win.startMs)}`);
      lines.push(`DTEND:${formatUtcMsToIcs(win.endMs)}`);
      lines.push(`SUMMARY:${escapeIcsText(win.summary)}`);
      if (win.location) {
        lines.push(`LOCATION:${escapeIcsText(win.location)}`);
      }
      if (win.description) {
        lines.push(`DESCRIPTION:${escapeIcsText(win.description)}`);
      }
      lines.push('END:VEVENT');
      eventCount += 1;
    }
  }

  lines.push('END:VCALENDAR');
  const folded = lines.map(foldIcsLine).join('\r\n') + '\r\n';
  return {
    icsContent: folded,
    eventCount,
    filename: `${sanitizeFilename(trip.name)}.ics`,
  };
}

export function buildGoogleCalendarEventUrl(
  trip: Trip,
  dateIso: string,
  activity: Activity,
  lang: AppLanguage
): string {
  const win = resolveActivityWindow(trip, dateIso, activity, lang);
  if (!win) return 'https://calendar.google.com/calendar/render?action=TEMPLATE';

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: win.summary,
    dates: `${formatUtcMsToIcs(win.startMs)}/${formatUtcMsToIcs(win.endMs)}`,
  });
  if (win.location) params.set('location', win.location);
  if (win.description) params.set('details', win.description);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function downloadTripIcs(icsContent: string, filename: string): void {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function canShareIcsFile(filename: string): boolean {
  if (typeof navigator === 'undefined' || typeof File === 'undefined') return false;
  if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false;
  try {
    const probe = new File(['BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n'], filename, {
      type: 'text/calendar',
    });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

export async function shareTripIcsFile(
  icsContent: string,
  filename: string,
  title: string
): Promise<'shared' | 'cancelled' | 'unsupported'> {
  if (!canShareIcsFile(filename)) return 'unsupported';
  try {
    const file = new File([icsContent], filename, { type: 'text/calendar' });
    await navigator.share({
      title,
      files: [file],
    });
    return 'shared';
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      return 'cancelled';
    }
    return 'unsupported';
  }
}
