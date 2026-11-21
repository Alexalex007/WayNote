import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, Reorder } from 'motion/react';
import { Trip, Activity, FlightInfo, HotelBooking } from '../types';
import { generateUniqueId } from '../shared/syncMerge';
import { detectDestinationIntel, getDestinationLocalTime } from '../shared/destinationIntel';
import { WeatherModal, WeatherGlyph, useLiveWeather } from './WeatherModal';
import { RouteMapModal, PreviousStopOption } from './RouteMapModal';
import { AiPlannerModal, AiPlannedDay } from './AiPlannerModal';
import { DateRangeCalendar, getDaySpanUtc } from './DateRangeCalendar';
import { LiquidModal, ConfirmSheet, SlidingSegmentedControl } from './LiquidPrimitives';
import {
  PlusIcon,
  CoffeeIcon,
  CameraIcon,
  DiningIcon,
  BusIcon,
  MapIcon,
  PlaneIcon,
  ArrowLongRightIcon,
  ClockIcon,
  HourglassIcon,
  LockClosedIcon,
  LockOpenIcon,
  TrashIcon,
  NavigationArrowIcon,
  DocumentTextIcon,
  CalendarIcon,
  CheckIcon,
  SparklesIcon,
  SunIcon,
  BoltIcon,
  GripVerticalIcon,
  HomeIcon,
} from './Icons';

interface Props {
  trip: Trip;
  onUpdateTrip: (trip: Trip) => void;
  onToggleFullScreen?: (isOpen: boolean) => void;
  onShowToast: (text: string, tone?: 'info' | 'success' | 'error') => void;
  focusDateSignal?: { date: string; nonce: number } | null;
}

function formatGmtOffset(offset: number): string {
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  const h = Math.floor(abs);
  const m = Math.round((abs - h) * 60);
  return `GMT${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function parseGmtOffsetLabel(label?: string): number | null {
  if (!label) return null;
  const m = label.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/i);
  if (!m) return null;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (Number(m[2]) + Number(m[3] || 0) / 60);
}

const BASE_TIMEZONE_OFFSETS = Array.from({ length: 27 }, (_, i) => i - 12);
const EXTRA_HALF_OFFSETS = [-3.5, 3.5, 4.5, 5.5, 5.75, 6.5, 9.5, 10.5];
const timezones = Array.from(new Set([...BASE_TIMEZONE_OFFSETS, ...EXTRA_HALF_OFFSETS]))
  .sort((a, b) => a - b)
  .map((offset) => ({ value: offset, label: formatGmtOffset(offset) }));

const getTypeMeta = (type: string) => {
  switch (type) {
    case 'sightseeing':
      return {
        label: '觀光',
        accentHex: '#6366F1',
        nodeBg: 'bg-indigo-500/14 dark:bg-indigo-400/18 text-indigo-600 dark:text-indigo-300',
        icon: CameraIcon,
      };
    case 'food':
      return {
        label: '美食',
        accentHex: '#F43F5E',
        nodeBg: 'bg-rose-500/14 dark:bg-rose-400/18 text-rose-600 dark:text-rose-300',
        icon: DiningIcon,
      };
    case 'transport':
      return {
        label: '交通',
        accentHex: '#10B981',
        nodeBg: 'bg-emerald-500/14 dark:bg-emerald-400/18 text-emerald-600 dark:text-emerald-300',
        icon: BusIcon,
      };
    case 'flight':
      return {
        label: '航班',
        accentHex: '#0EA5E9',
        nodeBg: 'bg-sky-500/14 dark:bg-sky-400/18 text-sky-600 dark:text-sky-300',
        icon: PlaneIcon,
      };
    default:
      return {
        label: '行程',
        accentHex: '#F59E0B',
        nodeBg: 'bg-amber-500/14 dark:bg-amber-400/18 text-amber-600 dark:text-amber-300',
        icon: MapIcon,
      };
  }
};

function parseTimeToMinutes(timeStr?: string): number {
  const [hRaw, mRaw] = (timeStr || '09:00').split(':');
  const h = parseInt(hRaw || '9', 10);
  const m = parseInt(mRaw || '0', 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return 540;
  return ((h % 24) + 24) % 24 * 60 + Math.min(59, Math.max(0, m));
}

function formatMinutesToTime(totalMinutes: number): string {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function parseDurationToMinutes(durationStr?: string): number {
  if (!durationStr) return 60;
  const parsed = parseFloat(durationStr.replace(/[^\d.]/g, ''));
  if (Number.isNaN(parsed) || parsed <= 0) return 60;
  return Math.max(15, Math.round(parsed * 60));
}

function recalculateCascadingTimes(reordered: Activity[], previousList: Activity[], now: number): Activity[] {
  const nonFlights = previousList.filter((a) => a.type !== 'flight');
  let cursorMins =
    nonFlights.length > 0
      ? Math.min(...nonFlights.map((a) => parseTimeToMinutes(a.time)))
      : 540;

  return reordered.map((act) => {
    if (act.type === 'flight') {
      return act;
    }
    const assignedTime = formatMinutesToTime(cursorMins);
    cursorMins += parseDurationToMinutes(act.duration);
    return {
      ...act,
      time: assignedTime,
      updatedAt: now,
    };
  });
}

function getDestinationTodayAndMinutes(utcOffsetHours: number): { dateIso: string; minutes: number } {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const target = new Date(utcMs + utcOffsetHours * 3600000);
  const y = target.getFullYear();
  const m = String(target.getMonth() + 1).padStart(2, '0');
  const d = String(target.getDate()).padStart(2, '0');
  return {
    dateIso: `${y}-${m}-${d}`,
    minutes: target.getHours() * 60 + target.getMinutes(),
  };
}

function formatTime12h(timeStr: string): string {
  const [hRaw, mRaw] = (timeStr || '09:00').split(':');
  const h = parseInt(hRaw || '9', 10);
  const m = mRaw || '00';
  if (Number.isNaN(h)) return timeStr;
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')}:${m} ${suffix}`;
}

const MarqueeText: React.FC<{ text: string; className?: string }> = ({ text, className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [isOverflow, setIsOverflow] = useState(false);

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && measureRef.current) {
        setIsOverflow(measureRef.current.offsetWidth > containerRef.current.clientWidth);
      }
    };
    checkOverflow();
  }, [text]);

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className}`}>
      <span ref={measureRef} className="absolute opacity-0 pointer-events-none whitespace-nowrap">
        {text}
      </span>
      {isOverflow ? (
        <div className="flex whitespace-nowrap animate-marquee-scroll" style={{ width: 'max-content' }}>
          <span className="mr-8">{text}</span>
          <span className="mr-8">{text}</span>
        </div>
      ) : (
        <div className="truncate">{text}</div>
      )}
    </div>
  );
};

/* Connected Icon-to-Icon Flush Gradient Timeline Row with Live Progress */
const TimelineRow: React.FC<{
  activity: Activity;
  nextActivity?: Activity;
  legProgress: number;
  isLast: boolean;
  onClick: () => void;
  onToggleComplete: (e: React.MouseEvent) => void;
  isLocked: boolean;
}> = ({ activity, nextActivity, legProgress, isLast, onClick, onToggleComplete, isLocked }) => {
  const meta = getTypeMeta(activity.type);
  const nextMeta = nextActivity ? getTypeMeta(nextActivity.type) : meta;
  const NodeIcon = meta.icon;
  const isFlight = activity.type === 'flight' && Boolean(activity.flightInfo);
  const flightInfo = activity.flightInfo;
  const displayTime = isFlight && flightInfo ? flightInfo.departureTime : activity.time;
  const isNextDayArrival = Boolean(
    isFlight &&
      flightInfo?.arrivalDate &&
      flightInfo?.departureDate &&
      flightInfo.arrivalDate > flightInfo.departureDate
  );
  const flightTimeRange =
    isFlight && flightInfo
      ? `${flightInfo.departureTime} → ${flightInfo.arrivalTime}${isNextDayArrival ? ' (+1)' : ''}`
      : '';
  const mapQuery = encodeURIComponent(activity.location || activity.title);

  const subtitle = isFlight && flightInfo
    ? `${flightInfo.departureCode} → ${flightInfo.arrivalCode}${flightInfo.duration ? ` · ${flightInfo.duration}` : ''}`
    : activity.location || activity.description || meta.label;

  const startColor = activity.completed ? '#10B981' : meta.accentHex;
  const endColor = nextActivity?.completed ? '#10B981' : nextMeta.accentHex;
  const clampedProgress = Math.max(0, Math.min(1, legProgress));

  return (
    <div
      onClick={() => {
        if (isLocked) onClick();
      }}
      className={`group relative flex items-stretch gap-3.5 sm:gap-4 transition-colors ${
        isLocked
          ? 'cursor-pointer px-2 -mx-2 rounded-2xl hover:bg-zinc-900/[0.025] dark:hover:bg-white/[0.03]'
          : 'cursor-grab active:cursor-grabbing bg-zinc-900/[0.025] dark:bg-white/[0.03] border border-dashed border-[#F26B3A]/35 px-3 py-2.5 rounded-2xl mb-2 select-none touch-none'
      } ${activity.completed ? 'opacity-65' : ''}`}
    >
      {/* Left Vertical Rail: Flush Top-to-Bottom Connector Touching Adjacent Circular Icons */}
      <div className="flex flex-col items-center shrink-0">
        <button
          type="button"
          onClick={(e) => {
            if (!isLocked) {
              e.stopPropagation();
              return;
            }
            onToggleComplete(e);
          }}
          aria-label={activity.completed ? '標記為未完成' : '標記為已完成'}
          title={activity.completed ? '標記未完成' : '點擊標記完成'}
          className={`relative z-10 w-11 h-11 rounded-full flex items-center justify-center transition-transform active:scale-90 cursor-pointer shrink-0 ${
            activity.completed
              ? 'bg-emerald-500 text-white shadow-sm'
              : meta.nodeBg
          }`}
        >
          {activity.completed ? (
            <CheckIcon className="w-5 h-5" />
          ) : (
            <NodeIcon className={`w-5 h-5 ${isFlight ? '-rotate-45' : ''}`} />
          )}
        </button>

        {!isLast && isLocked && (
          <div
            className="w-[3px] flex-1 min-h-[30px] relative overflow-hidden"
            style={{
              background: `linear-gradient(to bottom, ${startColor}35, ${endColor}35)`,
            }}
          >
            <div
              className="absolute inset-x-0 top-0 transition-all duration-700 ease-out"
              style={{
                height: `${Math.round(clampedProgress * 100)}%`,
                background: `linear-gradient(to bottom, ${startColor}, ${endColor})`,
              }}
            />
          </div>
        )}
      </div>

      {/* Content Row matching clean 2-column split */}
      <div className={`flex-1 min-w-0 flex items-start justify-between gap-3 ${!isLocked ? 'py-0.5' : isLast ? 'pt-0.5 pb-1' : 'pt-0.5 pb-5'}`}>
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-2 min-w-0">
            <MarqueeText
              text={isFlight && flightInfo ? `${flightInfo.flightNumber} 航班` : activity.title}
              className={`font-display font-bold text-[15px] text-zinc-900 dark:text-zinc-50 leading-snug ${
                activity.completed ? 'line-through decoration-zinc-400' : ''
              }`}
            />
            {isFlight && flightInfo && (
              <span className="px-2 py-0.5 rounded-full bg-sky-500/12 text-sky-700 dark:text-sky-300 font-num text-[10px] font-bold shrink-0">
                {flightInfo.departureCode}–{flightInfo.arrivalCode}
              </span>
            )}
          </div>

          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate leading-relaxed">{subtitle}</p>

          <div className="flex items-center gap-2.5 pt-1">
            {activity.duration && !isFlight && (
              <span className="text-[11px] font-num font-medium text-zinc-400 dark:text-zinc-500">
                約 {activity.duration}
              </span>
            )}
            {!isFlight && isLocked && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
              >
                <MapIcon className="w-3 h-3" />
                <span>地圖</span>
              </a>
            )}
          </div>
        </div>

        {/* Right Side: Drag Grip when unlocked, or Time + Coral Action Cue when locked */}
        <div className="shrink-0 text-right pt-0.5 flex flex-col items-end gap-1">
          {!isLocked ? (
            <div className="flex items-center gap-1.5 text-[#F26B3A] py-1">
              <span className="text-[11px] font-num font-semibold text-zinc-400 whitespace-nowrap">
                {isFlight ? flightTimeRange : formatTime12h(displayTime)}
              </span>
              <span className="w-8 h-8 rounded-xl bg-[#F26B3A]/12 text-[#F26B3A] flex items-center justify-center">
                <GripVerticalIcon className="w-4 h-4" />
              </span>
            </div>
          ) : (
            <>
              <span className="text-xs font-num font-semibold text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                {isFlight ? flightTimeRange : `(${formatTime12h(displayTime)})`}
              </span>
              <span className="text-[11px] font-bold tracking-wide text-[#F26B3A] group-hover:underline">
                查看詳情
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const ItineraryTool: React.FC<Props> = ({ trip, onUpdateTrip, onShowToast, focusDateSignal }) => {
  const [selectedDate, setSelectedDate] = useState<string>(trip.startDate);
  const [dates, setDates] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [showWeatherModal, setShowWeatherModal] = useState(false);
  const [showHotelModal, setShowHotelModal] = useState(false);
  const [modalMode, setModalMode] = useState<'PLAN' | 'FLIGHT' | 'THEME'>('PLAN');
  const [isLocked, setIsLocked] = useState(true);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [routeLocations, setRouteLocations] = useState<Activity[]>([]);
  const [routeIsPreview, setRouteIsPreview] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [editingHotelId, setEditingHotelId] = useState<string | null>(null);
  const [hotelDraft, setHotelDraft] = useState<{
    name: string;
    checkIn: string;
    checkOut: string;
  }>({
    name: '',
    checkIn: trip.startDate,
    checkOut: trip.endDate,
  });

  const [depTz, setDepTz] = useState(8);
  const [arrTz, setArrTz] = useState(9);

  const [sightseeingList, setSightseeingList] = useState<{ title: string; location: string; duration: string }[]>([
    { title: '', location: '', duration: '2h' },
  ]);
  const [dailyTheme, setDailyTheme] = useState('');

  const [newActivity, setNewActivity] = useState<{
    time: string;
    title: string;
    location: string;
    duration: string;
    description: string;
    type: 'sightseeing' | 'food' | 'transport' | 'flight';
  }>({
    time: '11:35',
    title: '',
    location: '',
    duration: '2h',
    description: '',
    type: 'sightseeing',
  });

  const [newFlight, setNewFlight] = useState<FlightInfo>({
    flightNumber: '',
    departureCode: '',
    arrivalCode: '',
    departureDate: trip.startDate || new Date().toISOString().slice(0, 10),
    departureTime: '09:00',
    departureTimezone: 'GMT+08:00',
    arrivalDate: trip.startDate || new Date().toISOString().slice(0, 10),
    arrivalTime: '10:35',
    arrivalTimezone: 'GMT+09:00',
    duration: '',
  });
  const [flightLookupLoading, setFlightLookupLoading] = useState(false);
  const [flightLookupNote, setFlightLookupNote] = useState<string | null>(null);
  const flightLookupSeedRef = useRef<string | null>(null);
  const flightLookupAbortRef = useRef<AbortController | null>(null);

  const isFormValid =
    modalMode === 'PLAN'
      ? newActivity.type === 'sightseeing' && !editingActivityId
        ? sightseeingList.every((i) => i.title.trim() !== '')
        : !!newActivity.title.trim()
      : modalMode === 'THEME'
        ? true
        : !!(newFlight.flightNumber.trim() && newFlight.departureCode.trim() && newFlight.arrivalCode.trim());

  const getActivityConfig = (type: string) => {
    switch (type) {
      case 'food':
        return { label: '餐廳名稱', placeholder: '一蘭拉麵、築地市場', icon: DiningIcon };
      case 'transport':
        return { label: '交通方式', placeholder: 'JR 山手線、新幹線', icon: BusIcon };
      case 'flight':
        return { label: '項目名稱', placeholder: '航班或移動', icon: PlaneIcon };
      default:
        return { label: '景點名稱', placeholder: '淺草寺、明治神宮', icon: CameraIcon };
    }
  };
  const activityConfig = getActivityConfig(newActivity.type);
  const ActivityTitleIcon = activityConfig.icon;

  useEffect(() => {
    const getUTC = (dateStr: string, timeStr: string, offset: number) => {
      const baseMs = Date.parse(`${dateStr}T${timeStr}:00Z`);
      if (Number.isNaN(baseMs)) return NaN;
      return baseMs - offset * 3600000;
    };
    const startUTC = getUTC(newFlight.departureDate, newFlight.departureTime, depTz);
    const endUTC = getUTC(newFlight.arrivalDate, newFlight.arrivalTime, arrTz);
    const diffMs = endUTC - startUTC;
    if (diffMs >= 0 && !Number.isNaN(diffMs)) {
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      setNewFlight((prev) => ({
        ...prev,
        departureTimezone: formatGmtOffset(depTz),
        arrivalTimezone: formatGmtOffset(arrTz),
        duration: `${hours}h ${minutes}m`,
      }));
    }
  }, [newFlight.departureDate, newFlight.departureTime, depTz, newFlight.arrivalDate, newFlight.arrivalTime, arrTz]);

  // Pure UTC date sequence generation (zero timezone -1 day shift)
  useEffect(() => {
    const startMs = Date.parse(`${trip.startDate}T00:00:00Z`);
    const endMs = Date.parse(`${trip.endDate}T00:00:00Z`);
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) return;

    const dateArray: string[] = [];
    const cur = new Date(startMs);
    let guard = 0;
    while (cur.getTime() <= endMs && guard < 90) {
      dateArray.push(cur.toISOString().slice(0, 10));
      cur.setUTCDate(cur.getUTCDate() + 1);
      guard += 1;
    }
    setDates(dateArray);
    if (dateArray.length > 0 && !dateArray.includes(selectedDate)) {
      setSelectedDate(dateArray[0]);
    }
  }, [trip.startDate, trip.endDate]);

  useEffect(() => {
    if (!focusDateSignal?.date) return;
    if (dates.includes(focusDateSignal.date)) {
      setSelectedDate(focusDateSignal.date);
    }
  }, [focusDateSignal, dates]);

  const currentActivities = trip.activities[selectedDate] || [];
  const canSort = currentActivities.length > 1;

  useEffect(() => {
    if (!canSort) setIsLocked(true);
  }, [canSort]);

  const completedCount = useMemo(
    () => currentActivities.filter((a) => a.completed).length,
    [currentActivities]
  );

  const getDayName = (dateStr: string) => {
    const d = new Date(`${dateStr}T00:00:00Z`);
    const days = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
    return days[d.getUTCDay()] || '';
  };

  const getDayOfMonth = (dateStr: string) => new Date(`${dateStr}T00:00:00Z`).getUTCDate();

  const getDayNumber = (dateStr: string) => {
    const start = Date.parse(`${trip.startDate}T00:00:00Z`);
    const current = Date.parse(`${dateStr}T00:00:00Z`);
    if (Number.isNaN(start) || Number.isNaN(current)) return 'Day 1';
    const diffDays = Math.max(0, Math.round((current - start) / 86400000));
    return `Day ${diffDays + 1}`;
  };

  const getHeaderLocation = () => {
    if (trip.type === 'Single' || !trip.stops || trip.stops.length === 0) {
      return <span className="truncate">{trip.destination.split(',')[0]}</span>;
    }
    for (let i = 0; i < trip.stops.length - 1; i++) {
      const currentStop = trip.stops[i];
      const nextStop = trip.stops[i + 1];
      if (selectedDate === currentStop.endDate && selectedDate === nextStop.startDate) {
        return (
          <div className="flex items-center gap-2 overflow-hidden min-w-0">
            <span className="truncate">{currentStop.destination}</span>
            <ArrowLongRightIcon className="w-5 h-5 shrink-0 text-[#F26B3A]" />
            <span className="truncate">{nextStop.destination}</span>
          </div>
        );
      }
    }
    const activeStop = trip.stops.find((s) => selectedDate >= s.startDate && selectedDate <= s.endDate);
    return <span className="truncate">{activeStop ? activeStop.destination : trip.destination.split(',')[0]}</span>;
  };

  const activeWeatherCity = useMemo(() => {
    if (trip.type === 'Single' || !trip.stops || trip.stops.length === 0) {
      return trip.destination;
    }
    for (let i = 0; i < trip.stops.length - 1; i++) {
      const currentStop = trip.stops[i];
      const nextStop = trip.stops[i + 1];
      if (selectedDate === currentStop.endDate && selectedDate === nextStop.startDate) {
        return nextStop.destination;
      }
    }
    const activeStop = trip.stops.find((s) => selectedDate >= s.startDate && selectedDate <= s.endDate);
    return activeStop ? activeStop.destination : trip.destination;
  }, [trip.type, trip.stops, trip.destination, selectedDate]);

  const weatherCities = useMemo(() => {
    if (trip.type === 'Multi' && trip.stops && trip.stops.length > 0) {
      return trip.stops.map((s) => s.destination).filter(Boolean);
    }
    return [trip.destination];
  }, [trip.type, trip.stops, trip.destination]);

  const activeIntel = useMemo(() => detectDestinationIntel(activeWeatherCity), [activeWeatherCity]);
  const liveWeather = useLiveWeather(activeWeatherCity);
  const effectiveUtcOffset = liveWeather.data?.utcOffsetHours ?? activeIntel.utcOffsetHours;
  const localClock = getDestinationLocalTime(effectiveUtcOffset);
  const destNowClock = getDestinationTodayAndMinutes(effectiveUtcOffset);

  const hotels = trip.hotels || [];
  const activeHotelForDay = useMemo(() => {
    if (hotels.length === 0) return null;
    return (
      hotels.find((h) => selectedDate >= h.checkIn && selectedDate <= h.checkOut) ||
      hotels[0]
    );
  }, [hotels, selectedDate]);

  const previousStops = useMemo<PreviousStopOption[]>(() => {
    const priorDates = Object.keys(trip.activities || {})
      .filter((d) => d < selectedDate)
      .sort()
      .reverse();
    const list: PreviousStopOption[] = [];
    for (const date of priorDates) {
      const dayActs = (trip.activities[date] || []).filter(
        (a) => (a.location || a.title) && a.type !== 'flight'
      );
      for (let i = dayActs.length - 1; i >= 0; i--) {
        list.push({ date, activity: dayActs[i] });
      }
    }
    return list;
  }, [trip.activities, selectedDate]);

  const closeModal = () => {
    if (flightLookupAbortRef.current) {
      flightLookupAbortRef.current.abort();
      flightLookupAbortRef.current = null;
    }
    flightLookupSeedRef.current = null;
    setShowAddModal(false);
    setEditingActivityId(null);
    setModalMode('PLAN');
    setSightseeingList([{ title: '', location: '', duration: '2h' }]);
    setDailyTheme('');
    setNewActivity({
      time: '11:35',
      title: '',
      location: '',
      duration: '2h',
      description: '',
      type: 'sightseeing',
    });
    setNewFlight({
      flightNumber: '',
      departureCode: '',
      arrivalCode: '',
      departureDate: selectedDate || new Date().toISOString().slice(0, 10),
      departureTime: '09:00',
      departureTimezone: 'GMT+08:00',
      arrivalDate: selectedDate || new Date().toISOString().slice(0, 10),
      arrivalTime: '10:35',
      arrivalTimezone: 'GMT+09:00',
      duration: '',
    });
    setFlightLookupNote(null);
    setFlightLookupLoading(false);
  };

  const handleLookupFlight = async (overrideCode?: string, overrideDate?: string, silent = false) => {
    const code = (overrideCode ?? newFlight.flightNumber).trim().toUpperCase().replace(/\s+/g, '');
    const depDate = (overrideDate ?? newFlight.departureDate).trim();
    if (code.length < 3) {
      if (!silent) onShowToast('請先輸入航班編號（例如 BR198、CX504）', 'error');
      return;
    }

    if (flightLookupAbortRef.current) {
      flightLookupAbortRef.current.abort();
    }
    const controller = new AbortController();
    flightLookupAbortRef.current = controller;

    flightLookupSeedRef.current = `${code}::${depDate}`;
    setFlightLookupLoading(true);
    if (!silent) setFlightLookupNote(null);

    try {
      const res = await fetch('/api/flights/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          flightNumber: code,
          date: depDate,
        }),
      });
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (ct.includes('text/html')) {
        throw new Error('純靜態託管環境無法使用自動航班查詢，請手動填寫下方機場與時間。');
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string })?.error || '查無此航班資訊，請手動輸入。');
      }

      const depOffset =
        typeof data.departureOffsetHours === 'number' ? data.departureOffsetHours : depTz;
      const arrOffset =
        typeof data.arrivalOffsetHours === 'number' ? data.arrivalOffsetHours : arrTz;

      const dayDelta =
        typeof data.arrivalDayDelta === 'number'
          ? data.arrivalDayDelta
          : data.nextDay
            ? 1
            : 0;
      let computedArrivalDate = depDate;
      if (dayDelta !== 0 && depDate) {
        const ms = Date.parse(`${depDate}T00:00:00Z`);
        if (!Number.isNaN(ms)) {
          const d = new Date(ms);
          d.setUTCDate(d.getUTCDate() + dayDelta);
          computedArrivalDate = d.toISOString().slice(0, 10);
        }
      }

      setDepTz(depOffset);
      setArrTz(arrOffset);
      setNewFlight((prev) => ({
        ...prev,
        flightNumber: data.flightNumber || code,
        departureCode: data.departureCode || prev.departureCode,
        arrivalCode: data.arrivalCode || prev.arrivalCode,
        departureTime: data.departureTime || prev.departureTime,
        arrivalTime: data.arrivalTime || prev.arrivalTime,
        arrivalDate: computedArrivalDate,
        departureTimezone: formatGmtOffset(depOffset),
        arrivalTimezone: formatGmtOffset(arrOffset),
      }));
      const airlineLabel = data.airline ? `${data.airline} ` : '';
      const note = `已自動帶入 ${airlineLabel}${data.flightNumber || code} (${data.departureCode} → ${data.arrivalCode} · ${formatGmtOffset(depOffset)} → ${formatGmtOffset(arrOffset)})`;
      setFlightLookupNote(note);
      if (!silent) onShowToast(note, 'success');
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : '航班查詢失敗';
      setFlightLookupNote(msg);
      if (!silent) onShowToast(msg, 'error');
    } finally {
      if (flightLookupAbortRef.current === controller) {
        flightLookupAbortRef.current = null;
        setFlightLookupLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!showAddModal || modalMode !== 'FLIGHT') return;
    const cleanCode = newFlight.flightNumber.trim().toUpperCase().replace(/\s+/g, '');
    const depDate = newFlight.departureDate.trim();
    const isLikelyFlightCode = /^[A-Z0-9]{2,3}\d{1,4}[A-Z]?$/.test(cleanCode) && /[A-Z]/.test(cleanCode) && /\d/.test(cleanCode);
    if (!isLikelyFlightCode || !depDate) return;
    const seedKey = `${cleanCode}::${depDate}`;
    if (flightLookupSeedRef.current === seedKey) return;

    const timer = window.setTimeout(() => {
      void handleLookupFlight(cleanCode, depDate, true);
    }, 550);
    return () => window.clearTimeout(timer);
  }, [showAddModal, modalMode, newFlight.flightNumber, newFlight.departureDate]);

  const getNextStartTime = () => {
    if (!currentActivities || currentActivities.length === 0) return '09:00';
    const last = currentActivities[currentActivities.length - 1];
    let h = 0;
    let m = 0;
    if (last.type === 'flight' && last.flightInfo) {
      const parts = last.flightInfo.arrivalTime.split(':');
      h = parseInt(parts[0], 10) || 0;
      m = parseInt(parts[1], 10) || 0;
    } else {
      const parts = last.time.split(':');
      h = parseInt(parts[0], 10) || 0;
      m = parseInt(parts[1], 10) || 0;
      const durationMins = last.duration ? Math.round(parseFloat(last.duration.replace('h', '')) * 60) : 60;
      m += durationMins;
    }
    h = (h + Math.floor(m / 60)) % 24;
    m = m % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const handleSaveActivity = () => {
    const now = Date.now();
    const updatedActivities = { ...trip.activities };
    const dayList = [...(updatedActivities[selectedDate] || [])];

    if (modalMode === 'THEME') {
      const updatedThemes = { ...trip.themes, [selectedDate]: dailyTheme.trim() };
      const updatedThemesTs = { ...trip.themesUpdatedAt, [selectedDate]: now };
      onUpdateTrip({
        ...trip,
        themes: updatedThemes,
        themesUpdatedAt: updatedThemesTs,
        updatedAt: now,
      });
      onShowToast('已更新當日主題', 'success');
      closeModal();
      return;
    }

    if (modalMode === 'PLAN') {
      if (newActivity.type === 'sightseeing' && !editingActivityId) {
        if (sightseeingList.some((i) => !i.title.trim())) return;
        let currentTimeStr = newActivity.time;
        const newItems: Activity[] = sightseeingList.map((item) => {
          const [h, m] = currentTimeStr.split(':').map(Number);
          const currentItemTime = currentTimeStr;
          const itemDuration = item.duration || '2h';
          const durationMins = Math.round(parseFloat(itemDuration.replace('h', '')) * 60);
          const date = new Date();
          date.setHours(h);
          date.setMinutes(m + durationMins);
          currentTimeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
          return {
            id: generateUniqueId('act'),
            time: currentItemTime,
            title: item.title.trim(),
            location: item.location.trim(),
            completed: false,
            type: 'sightseeing',
            duration: itemDuration,
            description: newActivity.description.trim(),
            updatedAt: now,
          };
        });
        dayList.push(...newItems);
      } else {
        if (!newActivity.title.trim()) return;
        const activityData: Activity = {
          id: editingActivityId || generateUniqueId('act'),
          time: newActivity.time,
          title: newActivity.title.trim(),
          location: newActivity.location.trim(),
          completed: editingActivityId
            ? dayList.find((a) => a.id === editingActivityId)?.completed ?? false
            : false,
          type: newActivity.type,
          duration: newActivity.duration,
          description: newActivity.description.trim(),
          updatedAt: now,
        };
        if (editingActivityId) {
          const idx = dayList.findIndex((a) => a.id === editingActivityId);
          if (idx !== -1) dayList[idx] = activityData;
        } else {
          dayList.push(activityData);
        }
      }
    } else {
      if (!newFlight.flightNumber.trim() || !newFlight.departureCode.trim() || !newFlight.arrivalCode.trim()) return;
      const flightData: Activity = {
        id: editingActivityId || generateUniqueId('flt'),
        time: newFlight.departureTime,
        title: `Flight ${newFlight.flightNumber.trim()}`,
        location: `${newFlight.departureCode.trim()} → ${newFlight.arrivalCode.trim()}`,
        completed: false,
        type: 'flight',
        flightInfo: {
          ...newFlight,
          flightNumber: newFlight.flightNumber.trim().toUpperCase(),
          departureCode: newFlight.departureCode.trim().toUpperCase(),
          arrivalCode: newFlight.arrivalCode.trim().toUpperCase(),
        },
        updatedAt: now,
      };
      if (editingActivityId) {
        const idx = dayList.findIndex((a) => a.id === editingActivityId);
        if (idx !== -1) dayList[idx] = flightData;
      } else {
        dayList.push(flightData);
      }
    }

    if (!editingActivityId) {
      dayList.sort((a, b) => a.time.localeCompare(b.time));
    }

    updatedActivities[selectedDate] = dayList;
    onUpdateTrip({
      ...trip,
      activities: updatedActivities,
      activitiesOrderUpdatedAt: { ...trip.activitiesOrderUpdatedAt, [selectedDate]: now },
      updatedAt: now,
    });
    onShowToast(editingActivityId ? '已更新行程' : '已新增行程', 'success');
    closeModal();
  };

  const handleToggleActivityComplete = (e: React.MouseEvent, activityId: string) => {
    e.stopPropagation();
    const now = Date.now();
    const updatedDay = currentActivities.map((a) =>
      a.id === activityId ? { ...a, completed: !a.completed, updatedAt: now } : a
    );
    onUpdateTrip({
      ...trip,
      activities: { ...trip.activities, [selectedDate]: updatedDay },
      updatedAt: now,
    });
  };

  const handleDeleteActivity = () => {
    if (!editingActivityId) return;
    const now = Date.now();
    const updatedDay = currentActivities.filter((a) => a.id !== editingActivityId);
    onUpdateTrip({
      ...trip,
      activities: { ...trip.activities, [selectedDate]: updatedDay },
      activitiesOrderUpdatedAt: { ...trip.activitiesOrderUpdatedAt, [selectedDate]: now },
      tombstones: { ...(trip.tombstones || {}), [editingActivityId]: now },
      updatedAt: now,
    });
    onShowToast('已刪除行程項目');
    closeModal();
  };

  const handleReorderActivities = (reordered: Activity[]) => {
    const now = Date.now();
    const updatedTimes = recalculateCascadingTimes(reordered, currentActivities, now);
    onUpdateTrip({
      ...trip,
      activities: { ...trip.activities, [selectedDate]: updatedTimes },
      activitiesOrderUpdatedAt: { ...trip.activitiesOrderUpdatedAt, [selectedDate]: now },
      updatedAt: now,
    });
  };

  const handleApplyRouteOrderToDay = (orderedStops: Activity[]) => {
    const now = Date.now();
    const stopQueue = [...orderedStops];
    const reorderedDay = currentActivities.map((act) => {
      const isRouteCandidate = (act.location || act.title) && act.type !== 'flight';
      if (!isRouteCandidate) return act;
      return stopQueue.shift() || act;
    });
    const updatedTimes = recalculateCascadingTimes(reorderedDay, currentActivities, now);
    onUpdateTrip({
      ...trip,
      activities: { ...trip.activities, [selectedDate]: updatedTimes },
      activitiesOrderUpdatedAt: { ...trip.activitiesOrderUpdatedAt, [selectedDate]: now },
      updatedAt: now,
    });
    onShowToast('已更新路線順序與對應時間', 'success');
  };

  const openHotelManager = () => {
    setEditingHotelId(null);
    setHotelDraft({
      name: '',
      checkIn: selectedDate || trip.startDate,
      checkOut: trip.endDate,
    });
    setShowHotelModal(true);
  };

  const handleSaveHotel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hotelDraft.name.trim()) return;
    const now = Date.now();
    const record: HotelBooking = {
      id: editingHotelId || generateUniqueId('htl'),
      name: hotelDraft.name.trim(),
      checkIn: hotelDraft.checkIn || trip.startDate,
      checkOut: hotelDraft.checkOut || trip.endDate,
      updatedAt: now,
    };
    const nextHotels = editingHotelId
      ? hotels.map((h) => (h.id === editingHotelId ? record : h))
      : [...hotels, record];
    onUpdateTrip({
      ...trip,
      hotels: nextHotels,
      updatedAt: now,
    });
    setEditingHotelId(null);
    setHotelDraft({
      name: '',
      checkIn: selectedDate || trip.startDate,
      checkOut: trip.endDate,
    });
    onShowToast(editingHotelId ? '已更新住宿酒店' : '已新增住宿酒店', 'success');
  };

  const handleDeleteHotel = (hotelId: string) => {
    const now = Date.now();
    onUpdateTrip({
      ...trip,
      hotels: hotels.filter((h) => h.id !== hotelId),
      tombstones: { ...(trip.tombstones || {}), [hotelId]: now },
      updatedAt: now,
    });
    if (editingHotelId === hotelId) setEditingHotelId(null);
    onShowToast('已移除酒店');
  };

  const googleCalendarUrl = useMemo(() => {
    const formatDateForGCal = (dateStr: string, timeStr: string) => {
      const d = new Date(`${dateStr}T${timeStr}`);
      return Number.isNaN(d.getTime()) ? '' : d.toISOString().replace(/-|:|\.\d+/g, '');
    };
    const addHours = (dateStr: string, timeStr: string, hours: number) => {
      const d = new Date(`${dateStr}T${timeStr}`);
      if (Number.isNaN(d.getTime())) return '';
      d.setTime(d.getTime() + hours * 60 * 60 * 1000);
      return d.toISOString().replace(/-|:|\.\d+/g, '');
    };

    if (modalMode === 'PLAN') {
      if (!newActivity.title.trim()) return '';
      const duration = parseFloat((newActivity.duration || '1').replace('h', '')) || 1;
      const start = formatDateForGCal(selectedDate, newActivity.time);
      const end = addHours(selectedDate, newActivity.time, duration);
      return `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
        newActivity.title
      )}&dates=${start}/${end}&details=${encodeURIComponent(newActivity.description || '')}&location=${encodeURIComponent(
        newActivity.location || ''
      )}`;
    }
    if (modalMode === 'FLIGHT') {
      if (!newFlight.flightNumber || !newFlight.departureCode) return '';
      const title = `${newFlight.departureCode} → ${newFlight.arrivalCode} (${newFlight.flightNumber})`;
      const start = formatDateForGCal(newFlight.departureDate, newFlight.departureTime);
      const end = formatDateForGCal(newFlight.arrivalDate, newFlight.arrivalTime);
      return `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
        title
      )}&dates=${start}/${end}&location=${encodeURIComponent(`${newFlight.departureCode} Airport`)}`;
    }
    return '';
  }, [modalMode, newActivity, newFlight, selectedDate]);

  const handleOpenRouteNav = () => {
    const locations = currentActivities.filter((a) => (a.location || a.title) && a.type !== 'flight');
    if (locations.length === 0) {
      onShowToast('當日尚無可導航地點', 'info');
      return;
    }
    setRouteIsPreview(false);
    setRouteLocations(locations);
    setShowRouteModal(true);
  };

  const handleOpenAiRoutePreview = (aiStops: Activity[]) => {
    if (aiStops.length === 0) {
      onShowToast('此日 AI 規劃尚無可用地點', 'info');
      return;
    }
    setRouteIsPreview(true);
    setRouteLocations(aiStops);
    setShowRouteModal(true);
  };

  const handleApplyAiPlan = ({
    startDate,
    applyStrategy,
    days,
  }: {
    startDate: string;
    mode: 'single_day' | 'multi_day';
    applyStrategy: 'append' | 'replace';
    days: AiPlannedDay[];
  }) => {
    const now = Date.now();
    const nextActivities = { ...trip.activities };
    const nextThemes = { ...(trip.themes || {}) };
    const nextThemesTs = { ...(trip.themesUpdatedAt || {}) };
    const nextOrderTs = { ...(trip.activitiesOrderUpdatedAt || {}) };
    const nextTombstones = { ...(trip.tombstones || {}) };

    let latestDate = trip.endDate;
    days.forEach((dayPlan, offsetIdx) => {
      const startMs = Date.parse(`${startDate}T00:00:00Z`);
      if (Number.isNaN(startMs)) return;
      const d = new Date(startMs);
      d.setUTCDate(d.getUTCDate() + offsetIdx);
      const targetIso = d.toISOString().slice(0, 10);
      if (targetIso > latestDate) latestDate = targetIso;

      const generated: Activity[] = dayPlan.stops.map((s) => ({
        id: generateUniqueId('act'),
        time: s.time,
        title: s.title,
        location: s.location,
        completed: false,
        type: s.type,
        duration: s.duration,
        description: s.description,
        updatedAt: now,
      }));

      const existing = nextActivities[targetIso] || [];
      if (applyStrategy === 'replace') {
        existing.forEach((old) => {
          nextTombstones[old.id] = now;
        });
        nextActivities[targetIso] = generated.sort((a, b) => a.time.localeCompare(b.time));
      } else {
        nextActivities[targetIso] = [...existing, ...generated].sort((a, b) => a.time.localeCompare(b.time));
      }

      if (dayPlan.theme) {
        nextThemes[targetIso] = dayPlan.theme;
        nextThemesTs[targetIso] = now;
      }
      nextOrderTs[targetIso] = now;
    });

    onUpdateTrip({
      ...trip,
      endDate: latestDate > trip.endDate ? latestDate : trip.endDate,
      activities: nextActivities,
      themes: nextThemes,
      themesUpdatedAt: nextThemesTs,
      activitiesOrderUpdatedAt: nextOrderTs,
      tombstones: nextTombstones,
      updatedAt: now,
    });

    setSelectedDate(startDate);
    onShowToast(
      days.length > 1
        ? `已套用 ${days.length} 天 AI 行程至旅程`
        : `已套用 AI 行程至 ${startDate.slice(5)}`,
      'success'
    );
  };

  const openEditModal = (activity: Activity) => {
    setEditingActivityId(activity.id);
    if (activity.type === 'flight' && activity.flightInfo) {
      flightLookupSeedRef.current = `${activity.flightInfo.flightNumber.trim().toUpperCase()}::${activity.flightInfo.departureDate}`;
      setModalMode('FLIGHT');
      setNewFlight(activity.flightInfo);
      const parsedDep = parseGmtOffsetLabel(activity.flightInfo.departureTimezone);
      const parsedArr = parseGmtOffsetLabel(activity.flightInfo.arrivalTimezone);
      if (parsedDep !== null) setDepTz(parsedDep);
      if (parsedArr !== null) setArrTz(parsedArr);
    } else {
      flightLookupSeedRef.current = null;
      setModalMode('PLAN');
      setNewActivity({
        time: activity.time,
        title: activity.title,
        location: activity.location || '',
        duration: activity.duration || '2h',
        description: activity.description || '',
        type: activity.type,
      });
    }
    setShowAddModal(true);
  };

  const openAddModal = () => {
    flightLookupSeedRef.current = null;
    setEditingActivityId(null);
    setModalMode('PLAN');
    setSightseeingList([{ title: '', location: '', duration: '2h' }]);
    setDailyTheme(trip.themes?.[selectedDate] || '');
    const nextTime = getNextStartTime();
    setNewActivity({
      time: nextTime,
      title: '',
      location: '',
      duration: '2h',
      description: '',
      type: 'sightseeing',
    });
    setNewFlight((prev) => ({
      ...prev,
      flightNumber: '',
      departureCode: '',
      arrivalCode: '',
      departureDate: selectedDate || prev.departureDate,
      arrivalDate: selectedDate || prev.arrivalDate,
      departureTime: nextTime,
    }));
    setFlightLookupNote(null);
    setShowAddModal(true);
  };

  const handleAddSightseeingItem = () => {
    setSightseeingList([...sightseeingList, { title: '', location: '', duration: '2h' }]);
  };

  const handleRemoveSightseeingItem = (idx: number) => {
    if (sightseeingList.length > 1) {
      setSightseeingList(sightseeingList.filter((_, i) => i !== idx));
    }
  };

  const handleSightseeingChange = (idx: number, field: 'title' | 'location' | 'duration', value: string) => {
    const newList = [...sightseeingList];
    newList[idx][field] = value;
    setSightseeingList(newList);
  };

  return (
    <div data-scroll-lock className="h-full min-h-0 flex flex-col relative bg-transparent overflow-clip">
      {/* Header (IMG_7245 clean editorial header) */}
      <div className="px-5 sm:px-8 pt-3 sm:pt-5 pb-2 flex items-center justify-between gap-3 shrink-0 relative z-20">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-0.5 font-num">
            <span className="font-bold text-[#F26B3A]">{getDayNumber(selectedDate)}</span>
            <span aria-hidden="true">·</span>
            <span>{selectedDate}</span>
            <span aria-hidden="true">·</span>
            <span>{activeIntel.currency}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-zinc-900 dark:text-zinc-50 tracking-tight flex items-center gap-2 truncate">
            {getHeaderLocation()}
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowWeatherModal(true)}
            title="即時天氣與預報"
            className="surface-elevated h-10 px-3.5 rounded-full flex items-center gap-2 hover:bg-white dark:hover:bg-zinc-800/70 active:scale-95 transition-all cursor-pointer"
          >
            {liveWeather.data ? (
              <>
                <WeatherGlyph
                  kind={liveWeather.data.current.kind}
                  isDay={liveWeather.data.current.isDay}
                  className="w-4 h-4"
                />
                <span className="text-xs font-num font-bold text-zinc-900 dark:text-white">
                  {liveWeather.data.current.temp}°
                </span>
                <span className="hidden sm:inline text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  {liveWeather.data.current.label}
                </span>
              </>
            ) : (
              <>
                <SunIcon className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-semibold text-zinc-900 dark:text-white">天氣</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={openAddModal}
            aria-label="新增行程"
            className="w-10 h-10 rounded-full bg-[#F26B3A] hover:bg-[#E15A2A] text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-[0_8px_18px_-6px_rgba(242,107,58,0.6)]"
          >
            <PlusIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Centered Horizontal Day Pill Strip (No activity dots) */}
      <div className="px-5 sm:px-8 pb-3 shrink-0 relative z-20">
        <div className="overflow-x-auto no-scrollbar py-1">
          <div className="w-max min-w-full flex items-center justify-center gap-2">
            {dates.map((date) => {
              const isSelected = selectedDate === date;
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => setSelectedDate(date)}
                  className={`shrink-0 min-w-[60px] h-[60px] px-3 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all duration-150 cursor-pointer ${
                    isSelected
                      ? 'bg-[#F26B3A] text-white shadow-[0_10px_22px_-8px_rgba(242,107,58,0.65)]'
                      : 'surface-elevated text-zinc-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800/70'
                  }`}
                >
                  <span className={`text-[10px] font-medium leading-none ${isSelected ? 'text-white/85' : 'text-zinc-400'}`}>
                    {getDayName(date)}
                  </span>
                  <span className="text-base font-display font-bold font-num leading-none mt-1">
                    {getDayOfMonth(date)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Workspace Grid */}
      <div
        data-scroll-lock
        className="flex-1 min-h-0 px-5 sm:px-8 max-w-7xl w-full mx-auto grid grid-cols-1 grid-rows-[minmax(0,1fr)] lg:grid-cols-12 gap-6 overflow-clip"
      >
        <div data-scroll-lock className="lg:col-span-8 flex flex-col min-h-0 h-full overflow-clip">
          {/* Action Row: Route, Hotel & AI Planner (left) + Compact Icon Lock Toggle (right) */}
          <div className="flex items-center justify-between gap-2 pb-3 shrink-0">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={handleOpenRouteNav}
                className="min-h-[36px] px-3 sm:px-4 rounded-full surface-elevated flex items-center gap-1.5 text-zinc-800 dark:text-zinc-200 font-semibold text-xs hover:bg-white dark:hover:bg-zinc-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <NavigationArrowIcon className="w-3.5 h-3.5 text-[#F26B3A]" />
                <span>路線</span>
              </button>

              <button
                type="button"
                onClick={openHotelManager}
                className="min-h-[36px] px-3 rounded-full surface-elevated flex items-center gap-1.5 text-zinc-800 dark:text-zinc-200 font-semibold text-xs hover:bg-white dark:hover:bg-zinc-800 transition-colors cursor-pointer max-w-[138px] sm:max-w-[155px] shrink-0"
                title="管理入住酒店（可供路線出發地選用）"
              >
                <HomeIcon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="truncate">
                  {activeHotelForDay ? activeHotelForDay.name : '新增酒店'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowAiModal(true)}
                className="min-h-[36px] px-3 sm:px-3.5 rounded-full bg-[var(--tab-accent-soft)] hover:brightness-95 text-[var(--tab-accent)] border border-[var(--tab-accent)]/25 flex items-center gap-1.5 font-semibold text-xs transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                <SparklesIcon className="w-3.5 h-3.5" />
                <span>AI 規劃</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => canSort && setIsLocked(!isLocked)}
              disabled={!canSort}
              aria-label={isLocked ? '解鎖自由拖曳排序' : '鎖定排序'}
              title={isLocked ? '解鎖自由拖曳排序' : '鎖定排序'}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                !canSort
                  ? 'opacity-40 cursor-not-allowed surface-elevated text-zinc-400'
                  : isLocked
                    ? 'surface-elevated text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-800'
                    : 'bg-[#F26B3A] text-white shadow-[0_8px_18px_-6px_rgba(242,107,58,0.55)]'
              }`}
            >
              {isLocked ? <LockClosedIcon className="w-4 h-4" /> : <LockOpenIcon className="w-4 h-4" />}
            </button>
          </div>

          {/* Scrollable Connected Vertical Timeline with Free Drag-and-Drop Reorder */}
          <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar pb-6 lg:pb-10 pr-0.5">
            {!isLocked && canSort && (
              <div className="mb-3 px-4 py-2 rounded-2xl bg-[#F26B3A]/10 text-[#F26B3A] text-xs font-semibold flex items-center justify-between">
                <span>長按或拖曳行程卡片即可自由調整順序</span>
                <button
                  type="button"
                  onClick={() => setIsLocked(true)}
                  className="underline font-bold cursor-pointer"
                >
                  完成
                </button>
              </div>
            )}

            {trip.themes?.[selectedDate] && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-3.5 p-4 rounded-2xl surface-pastel-peach flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-full bg-[#F26B3A]/15 text-[#F26B3A] flex items-center justify-center shrink-0">
                  <SparklesIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">本日主題</p>
                  <h3 className="text-zinc-900 dark:text-white font-semibold text-sm truncate">
                    {trip.themes[selectedDate]}
                  </h3>
                </div>
              </motion.div>
            )}

            {currentActivities.length === 0 ? (
              <div className="surface-elevated rounded-3xl py-14 px-6 flex flex-col items-center justify-center text-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[#F26B3A]/10 text-[#F26B3A] flex items-center justify-center">
                  <CoffeeIcon className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  尚無行程安排
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={openAddModal}
                    className="min-h-[42px] px-5 rounded-full bg-[#F26B3A] hover:bg-[#E15A2A] text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <PlusIcon className="w-4 h-4" />
                    <span>手動新增</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAiModal(true)}
                    className="min-h-[42px] px-5 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <SparklesIcon className="w-4 h-4" />
                    <span>AI 規劃行程</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="surface-elevated rounded-3xl p-4 sm:p-6">
                <Reorder.Group
                  as="div"
                  axis="y"
                  values={currentActivities}
                  onReorder={handleReorderActivities}
                  className="space-y-0"
                >
                  {currentActivities.map((activity, idx) => {
                    const nextAct = currentActivities[idx + 1];
                    let legProgress = 0;
                    if (activity.completed) {
                      legProgress = 1;
                    } else if (selectedDate < destNowClock.dateIso) {
                      legProgress = 1;
                    } else if (selectedDate === destNowClock.dateIso) {
                      const startMins = parseTimeToMinutes(
                        activity.type === 'flight' && activity.flightInfo
                          ? activity.flightInfo.departureTime
                          : activity.time
                      );
                      const endMins = nextAct
                        ? parseTimeToMinutes(
                            nextAct.type === 'flight' && nextAct.flightInfo
                              ? nextAct.flightInfo.departureTime
                              : nextAct.time
                          )
                        : startMins + parseDurationToMinutes(activity.duration);
                      if (destNowClock.minutes >= endMins) {
                        legProgress = 1;
                      } else if (destNowClock.minutes > startMins) {
                        legProgress =
                          (destNowClock.minutes - startMins) / Math.max(1, endMins - startMins);
                      }
                    }

                    return (
                      <Reorder.Item
                        as="div"
                        key={activity.id}
                        value={activity}
                        dragListener={!isLocked}
                        whileDrag={{
                          scale: 1.02,
                          zIndex: 30,
                          boxShadow: '0 18px 36px -12px rgba(15, 23, 42, 0.25)',
                        }}
                      >
                        <TimelineRow
                          activity={activity}
                          nextActivity={nextAct}
                          legProgress={legProgress}
                          isLast={idx === currentActivities.length - 1}
                          onClick={() => openEditModal(activity)}
                          onToggleComplete={(e) => handleToggleActivityComplete(e, activity.id)}
                          isLocked={isLocked}
                        />
                      </Reorder.Item>
                    );
                  })}
                </Reorder.Group>
              </div>
            )}
          </div>
        </div>

        {/* Desktop Side Panel */}
        <div className="hidden lg:flex lg:col-span-4 flex-col min-h-0 h-full gap-4 overflow-y-auto no-scrollbar pb-10">
          <div className="ink-card rounded-3xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-white">當日概覽</h3>
              <span className="text-xs font-num text-zinc-400">共 {dates.length} 天</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-[11px] text-zinc-400 mb-1">行程</p>
                <p className="text-2xl font-display font-bold font-num text-white">{currentActivities.length}</p>
              </div>
              <div>
                <p className="text-[11px] text-zinc-400 mb-1">已完成</p>
                <p className="text-2xl font-display font-bold font-num text-[#FF9E7B]">{completedCount}</p>
              </div>
              <div>
                <p className="text-[11px] text-zinc-400 mb-1">當地時間</p>
                <p className="text-xl font-num font-bold text-white">{localClock.timeStr}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs text-zinc-300">
              <div className="flex items-center gap-1.5 truncate">
                <BoltIcon className="w-4 h-4 text-[#FF9E7B] shrink-0" />
                <span className="truncate">{activeIntel.voltagePlug}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowWeatherModal(true)}
                className="text-[#FF9E7B] font-semibold hover:underline shrink-0 cursor-pointer ml-2"
              >
                7 日預報 →
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={openAddModal}
                className="min-h-[44px] rounded-full bg-[#F26B3A] hover:bg-[#E15A2A] text-white font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer"
              >
                <PlusIcon className="w-4 h-4" />
                <span>新增行程 / 航班</span>
              </button>
              <button
                type="button"
                onClick={() => setShowAiModal(true)}
                className="min-h-[44px] rounded-full bg-white/12 hover:bg-white/20 text-white font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer"
              >
                <SparklesIcon className="w-4 h-4 text-[#FF9E7B]" />
                <span>AI 智慧規劃</span>
              </button>
            </div>
          </div>

          {trip.type === 'Multi' && trip.stops && trip.stops.length > 0 && (
            <div className="surface-elevated rounded-3xl p-5 space-y-3">
              <h3 className="font-display font-bold text-sm text-zinc-900 dark:text-white">行程站點</h3>
              <div className="space-y-2">
                {trip.stops.map((stop, i) => {
                  const isCurrent = selectedDate >= stop.startDate && selectedDate <= stop.endDate;
                  return (
                    <button
                      key={stop.id}
                      type="button"
                      onClick={() => stop.startDate && setSelectedDate(stop.startDate)}
                      className={`w-full p-3 rounded-2xl flex items-center justify-between text-left transition-colors cursor-pointer ${
                        isCurrent
                          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                          : 'bg-zinc-100/70 dark:bg-white/[0.04] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-white/[0.08]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-6 h-6 rounded-full text-xs font-num font-bold flex items-center justify-center shrink-0 ${
                            isCurrent
                              ? 'bg-[#F26B3A] text-white'
                              : 'bg-zinc-900/10 dark:bg-white/10 text-zinc-700 dark:text-zinc-200'
                          }`}
                        >
                          {i + 1}
                        </span>
                        <span className="font-semibold text-sm truncate">{stop.destination}</span>
                      </div>
                      <span
                        className={`text-[11px] font-num shrink-0 ml-2 ${
                          isCurrent ? 'opacity-75' : 'text-zinc-500 dark:text-zinc-400'
                        }`}
                      >
                        {stop.startDate.slice(5)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* In-App Live Weather Modal */}
      <WeatherModal
        open={showWeatherModal}
        onClose={() => setShowWeatherModal(false)}
        cities={weatherCities}
        initialCity={activeWeatherCity}
      />

      {/* Add / Edit Activity Modal */}
      <LiquidModal
        open={showAddModal}
        onClose={closeModal}
        bottomSheetOnMobile
        maxWidthClass="max-w-md"
        title={<span>{modalMode === 'THEME' ? '當日主題' : editingActivityId ? '編輯行程' : '新增行程'}</span>}
      >
        <SlidingSegmentedControl
          fullWidth
          size="md"
          value={modalMode}
          onChange={(mode) => setModalMode(mode)}
          className="mb-5 shrink-0"
          options={[
            { id: 'PLAN', label: '行程', icon: <MapIcon className="w-3.5 h-3.5" />, accentFrom: '#F26B3A', accentTo: '#FB923C' },
            { id: 'FLIGHT', label: '航班', icon: <PlaneIcon className="w-3.5 h-3.5" />, accentFrom: '#0EA5E9', accentTo: '#38BDF8' },
            { id: 'THEME', label: '主題', icon: <SparklesIcon className="w-3.5 h-3.5" />, accentFrom: '#8B5CF6', accentTo: '#A78BFA' },
          ]}
        />

        <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 pb-4">
          {modalMode === 'THEME' ? (
            <div className="space-y-2.5">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 block">
                本日主題（留空可清除）
              </label>
              <div className="bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200/70 dark:border-white/10 rounded-2xl p-3.5 flex items-center gap-3">
                <SparklesIcon className="w-5 h-5 text-[#F26B3A] shrink-0" />
                <input
                  type="text"
                  placeholder="老城散步、美食探索"
                  className="bg-transparent w-full text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none font-medium text-sm"
                  value={dailyTheme}
                  onChange={(e) => setDailyTheme(e.target.value)}
                />
              </div>
            </div>
          ) : modalMode === 'PLAN' ? (
            <div className="space-y-4">
              <SlidingSegmentedControl
                fullWidth
                size="sm"
                value={newActivity.type === 'flight' ? 'sightseeing' : newActivity.type}
                onChange={(t) => setNewActivity({ ...newActivity, type: t })}
                options={[
                  { id: 'sightseeing', label: '觀光', icon: <CameraIcon className="w-3.5 h-3.5" />, accentFrom: '#4F5DF5', accentTo: '#6366F1' },
                  { id: 'food', label: '美食', icon: <DiningIcon className="w-3.5 h-3.5" />, accentFrom: '#F43F5E', accentTo: '#FB7185' },
                  { id: 'transport', label: '交通', icon: <BusIcon className="w-3.5 h-3.5" />, accentFrom: '#0E9F76', accentTo: '#10B981' },
                ]}
              />

              {newActivity.type === 'sightseeing' && !editingActivityId ? (
                <div className="space-y-3">
                  {sightseeingList.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-zinc-100/80 dark:bg-white/[0.04] border border-zinc-200/70 dark:border-white/10 rounded-2xl p-3.5 space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="w-5 h-5 rounded-full bg-[#F26B3A] text-white text-[11px] font-num font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <input
                            type="text"
                            placeholder="景點名稱"
                            className="bg-transparent w-full text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none font-semibold text-sm"
                            value={item.title}
                            onChange={(e) => handleSightseeingChange(idx, 'title', e.target.value)}
                          />
                        </div>
                        {sightseeingList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSightseeingItem(idx)}
                            className="text-zinc-400 hover:text-red-500 p-1 cursor-pointer"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="flex gap-2 pt-2 border-t border-zinc-200/60 dark:border-white/10">
                        <input
                          type="text"
                          placeholder="地點（選填）"
                          className="flex-1 bg-transparent text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none text-xs"
                          value={item.location}
                          onChange={(e) => handleSightseeingChange(idx, 'location', e.target.value)}
                        />
                        <select
                          className="bg-transparent text-zinc-900 dark:text-white font-num font-semibold text-xs focus:outline-none"
                          value={item.duration}
                          onChange={(e) => handleSightseeingChange(idx, 'duration', e.target.value)}
                        >
                          {Array.from({ length: 24 }, (_, i) => (i + 1) * 0.5).map((val) => (
                            <option key={val} value={`${val}h`} className="bg-white dark:bg-zinc-900">
                              {val}h
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={handleAddSightseeingItem}
                    className="w-full min-h-[42px] border border-dashed border-zinc-300 dark:border-white/20 rounded-full text-zinc-600 dark:text-zinc-300 font-semibold text-xs flex items-center justify-center gap-1.5 hover:border-[#F26B3A] cursor-pointer"
                  >
                    <PlusIcon className="w-4 h-4" />
                    <span>多加一站</span>
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1.5 block">
                      {activityConfig.label}
                    </label>
                    <div className="bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200/70 dark:border-white/10 rounded-2xl p-3.5 flex items-center gap-3">
                      <ActivityTitleIcon className="w-4 h-4 text-zinc-400 shrink-0" />
                      <input
                        type="text"
                        placeholder={activityConfig.placeholder}
                        className="bg-transparent w-full text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none font-medium text-sm"
                        value={newActivity.title}
                        onChange={(e) => setNewActivity({ ...newActivity, title: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1.5 block">
                      地點
                    </label>
                    <div className="bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200/70 dark:border-white/10 rounded-2xl p-3.5 flex items-center gap-3">
                      <MapIcon className="w-4 h-4 text-zinc-400 shrink-0" />
                      <input
                        type="text"
                        placeholder="輸入地標或地址"
                        className="bg-transparent w-full text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none font-medium text-sm"
                        value={newActivity.location}
                        onChange={(e) => setNewActivity({ ...newActivity, location: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1.5 block">
                    開始時間
                  </label>
                  <div className="bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200/70 dark:border-white/10 rounded-2xl px-3.5 h-11 flex items-center gap-2">
                    <ClockIcon className="w-4 h-4 text-zinc-400 shrink-0" />
                    <input
                      type="time"
                      className="bg-transparent w-full text-zinc-900 dark:text-white font-num font-semibold text-sm focus:outline-none"
                      value={newActivity.time}
                      onChange={(e) => setNewActivity({ ...newActivity, time: e.target.value })}
                    />
                  </div>
                </div>
                {!(newActivity.type === 'sightseeing' && !editingActivityId) && (
                  <div>
                    <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1.5 block">
                      停留時間
                    </label>
                    <div className="bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200/70 dark:border-white/10 rounded-2xl px-3.5 h-11 flex items-center gap-2">
                      <HourglassIcon className="w-4 h-4 text-zinc-400 shrink-0" />
                      <select
                        className="bg-transparent w-full text-zinc-900 dark:text-white font-num font-semibold text-sm focus:outline-none"
                        value={newActivity.duration}
                        onChange={(e) => setNewActivity({ ...newActivity, duration: e.target.value })}
                      >
                        {Array.from({ length: 24 }, (_, i) => (i + 1) * 0.5).map((val) => (
                          <option key={val} value={`${val}h`} className="bg-white dark:bg-zinc-900">
                            {val}h
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1.5 block">
                  備註（選填）
                </label>
                <div className="bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200/70 dark:border-white/10 rounded-2xl p-3.5 flex items-start gap-3">
                  <DocumentTextIcon className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                  <textarea
                    placeholder="訂位代號、注意事項..."
                    className="bg-transparent w-full text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none text-sm resize-none h-16"
                    value={newActivity.description}
                    onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Primary User Input: Flight Number + Departure Date (Auto-fetches airports, times & DST timezones) */}
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                  <div className="sm:col-span-6">
                    <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1 block">
                      航班編號
                    </label>
                    <input
                      type="text"
                      placeholder="例如：BR198、CX504"
                      className="w-full h-11 rounded-2xl bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200/70 dark:border-white/10 text-zinc-900 dark:text-white font-num font-bold text-center uppercase focus:outline-none px-3"
                      value={newFlight.flightNumber}
                      onChange={(e) => setNewFlight({ ...newFlight, flightNumber: e.target.value.toUpperCase() })}
                    />
                  </div>
                  <div className="sm:col-span-6">
                    <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1 block">
                      出發日期
                    </label>
                    <input
                      type="date"
                      value={newFlight.departureDate}
                      onChange={(e) => setNewFlight({ ...newFlight, departureDate: e.target.value })}
                      className="w-full h-11 rounded-2xl bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200/70 dark:border-white/10 px-3 text-zinc-900 dark:text-white text-xs sm:text-sm font-num font-semibold focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 px-1">
                  <p className="text-[11px] font-medium text-sky-600 dark:text-sky-400 truncate">
                    {flightLookupLoading
                      ? '正在依航班號與日期自動抓取起降機場與時區...'
                      : flightLookupNote || '輸入航班號與日期後將自動配對航線、時間與時區'}
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleLookupFlight()}
                    disabled={flightLookupLoading || newFlight.flightNumber.trim().length < 3}
                    className="h-7 px-2.5 rounded-full bg-sky-500/12 hover:bg-sky-500/20 disabled:opacity-45 text-sky-600 dark:text-sky-300 text-[11px] font-semibold flex items-center gap-1 shrink-0 cursor-pointer transition-colors whitespace-nowrap"
                  >
                    <SparklesIcon className={`w-3 h-3 ${flightLookupLoading ? 'animate-spin' : ''}`} />
                    <span>{flightLookupLoading ? '抓取中' : '重新抓取'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1 block">
                    出發機場
                  </label>
                  <input
                    type="text"
                    placeholder="TPE"
                    className="w-full h-13 rounded-2xl bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200/70 dark:border-white/10 text-zinc-900 dark:text-white font-display font-bold font-num text-2xl text-center uppercase focus:outline-none"
                    value={newFlight.departureCode}
                    onChange={(e) => setNewFlight({ ...newFlight, departureCode: e.target.value.toUpperCase() })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1 block">
                    抵達機場
                  </label>
                  <input
                    type="text"
                    placeholder="NRT"
                    className="w-full h-13 rounded-2xl bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200/70 dark:border-white/10 text-zinc-900 dark:text-white font-display font-bold font-num text-2xl text-center uppercase focus:outline-none"
                    value={newFlight.arrivalCode}
                    onChange={(e) => setNewFlight({ ...newFlight, arrivalCode: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>

              <div className="rounded-2xl p-4 bg-zinc-100/80 dark:bg-white/[0.04] border border-zinc-200/70 dark:border-white/10 space-y-2.5">
                <div className="flex items-center justify-between text-zinc-900 dark:text-white text-xs font-semibold">
                  <div className="flex items-center gap-2">
                    <PlaneIcon className="w-4 h-4 -rotate-45 text-sky-600" />
                    <span>出發時間與時區</span>
                  </div>
                  <span className="text-[11px] font-num text-zinc-400">{newFlight.departureDate}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="time"
                    value={newFlight.departureTime}
                    onChange={(e) => setNewFlight({ ...newFlight, departureTime: e.target.value })}
                    className="bg-white dark:bg-zinc-900/70 rounded-xl p-2.5 text-zinc-900 dark:text-white text-xs font-num font-semibold focus:outline-none"
                  />
                  <select
                    className="w-full bg-white dark:bg-zinc-900/70 rounded-xl p-2.5 text-zinc-900 dark:text-white text-xs font-num font-semibold focus:outline-none"
                    value={depTz}
                    onChange={(e) => setDepTz(Number(e.target.value))}
                  >
                    {timezones.map((tz) => (
                      <option key={tz.value} value={tz.value} className="bg-white dark:bg-zinc-900">
                        {tz.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rounded-2xl p-4 bg-zinc-100/80 dark:bg-white/[0.04] border border-zinc-200/70 dark:border-white/10 space-y-2.5">
                <div className="flex items-center justify-between text-zinc-900 dark:text-white text-xs font-semibold">
                  <div className="flex items-center gap-2">
                    <MapIcon className="w-4 h-4 text-emerald-600" />
                    <span>抵達時間與時區</span>
                  </div>
                  {newFlight.duration && (
                    <span className="font-num text-[#F26B3A]">{newFlight.duration}</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={newFlight.arrivalDate}
                    onChange={(e) => setNewFlight({ ...newFlight, arrivalDate: e.target.value })}
                    className="bg-white dark:bg-zinc-900/70 rounded-xl p-2.5 text-zinc-900 dark:text-white text-xs font-num font-semibold focus:outline-none"
                  />
                  <input
                    type="time"
                    value={newFlight.arrivalTime}
                    onChange={(e) => setNewFlight({ ...newFlight, arrivalTime: e.target.value })}
                    className="bg-white dark:bg-zinc-900/70 rounded-xl p-2.5 text-zinc-900 dark:text-white text-xs font-num font-semibold focus:outline-none"
                  />
                </div>
                <select
                  className="w-full bg-white dark:bg-zinc-900/70 rounded-xl p-2.5 text-zinc-900 dark:text-white text-xs font-num font-semibold focus:outline-none"
                  value={arrTz}
                  onChange={(e) => setArrTz(Number(e.target.value))}
                >
                  {timezones.map((tz) => (
                    <option key={tz.value} value={tz.value} className="bg-white dark:bg-zinc-900">
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="pt-3 flex gap-2.5 shrink-0 border-t border-zinc-200/60 dark:border-white/10">
          {editingActivityId && (
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              aria-label="刪除行程"
              className="w-11 h-11 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center cursor-pointer shrink-0"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          )}
          {modalMode !== 'THEME' && googleCalendarUrl && (
            <a
              href={googleCalendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="加入 Google 日曆"
              className="w-11 h-11 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 flex items-center justify-center shrink-0 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              <CalendarIcon className="w-4 h-4" />
            </a>
          )}
          <button
            type="button"
            onClick={handleSaveActivity}
            disabled={!isFormValid}
            className={`flex-1 min-h-[46px] rounded-full font-semibold text-sm transition-all cursor-pointer ${
              isFormValid
                ? 'bg-[#F26B3A] hover:bg-[#E15A2A] text-white'
                : 'bg-zinc-100 dark:bg-white/5 text-zinc-400 cursor-not-allowed'
            }`}
          >
            {editingActivityId || modalMode === 'THEME' ? '儲存' : '確認新增'}
          </button>
        </div>
      </LiquidModal>

      {/* Interactive Google Maps Route Modal */}
      <RouteMapModal
        open={showRouteModal}
        onClose={() => {
          setShowRouteModal(false);
          setRouteIsPreview(false);
        }}
        stops={routeLocations}
        destinationCity={activeWeatherCity}
        hotels={hotels}
        activeHotel={activeHotelForDay}
        airports={activeIntel.airports}
        previousStops={previousStops}
        onReorderStops={setRouteLocations}
        onApplyToDay={routeIsPreview ? undefined : handleApplyRouteOrderToDay}
        onOpenHotelsManager={openHotelManager}
      />

      {/* Built-In Gemini AI Itinerary & Route Planner */}
      <AiPlannerModal
        open={showAiModal}
        onClose={() => setShowAiModal(false)}
        trip={trip}
        dates={dates}
        selectedDate={selectedDate}
        onApplyPlan={handleApplyAiPlan}
        onOpenRouteForStops={handleOpenAiRoutePreview}
      />

      {/* Hotel Booking Manager Modal (Keyboard-aware + Auto-location + Swipe Calendar) */}
      <LiquidModal
        open={showHotelModal}
        onClose={() => setShowHotelModal(false)}
        bottomSheetOnMobile
        maxWidthClass="max-w-md"
        title={
          <div className="flex items-center gap-2">
            <HomeIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>住宿酒店設定</span>
          </div>
        }
      >
        <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto no-scrollbar pr-0.5 pb-2">
          <form onSubmit={handleSaveHotel} className="space-y-3.5 bg-zinc-100/80 dark:bg-white/[0.04] border border-zinc-200/70 dark:border-white/10 rounded-2xl p-3.5">
            <div>
              <label className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 block mb-1">
                酒店名稱（系統將自動配對地圖位置）
              </label>
              <input
                required
                type="text"
                placeholder="例如：新宿格拉斯麗酒店"
                value={hotelDraft.name}
                onChange={(e) => setHotelDraft({ ...hotelDraft, name: e.target.value })}
                className="w-full h-11 px-3.5 rounded-xl bg-white dark:bg-zinc-900/70 text-sm font-semibold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/35"
              />
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                  點選或滑動選擇入住與退房日期
                </span>
                {getDaySpanUtc(hotelDraft.checkIn, hotelDraft.checkOut) && (
                  <span className="text-[11px] font-num font-bold text-indigo-600 dark:text-indigo-400">
                    共 {getDaySpanUtc(hotelDraft.checkIn, hotelDraft.checkOut)!.nights} 晚
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-num">
                <div className="bg-white dark:bg-zinc-900/70 px-3 py-2 rounded-xl border border-zinc-200/70 dark:border-white/10">
                  <span className="text-[10px] text-zinc-400 block">入住日期</span>
                  <span className="font-bold text-zinc-900 dark:text-white">{hotelDraft.checkIn}</span>
                </div>
                <div className="bg-white dark:bg-zinc-900/70 px-3 py-2 rounded-xl border border-zinc-200/70 dark:border-white/10">
                  <span className="text-[10px] text-zinc-400 block">退房日期</span>
                  <span className="font-bold text-zinc-900 dark:text-white">{hotelDraft.checkOut}</span>
                </div>
              </div>

              <DateRangeCalendar
                startDate={hotelDraft.checkIn}
                endDate={hotelDraft.checkOut}
                onChangeRange={(s, e) => setHotelDraft((prev) => ({ ...prev, checkIn: s, checkOut: e }))}
              />
            </div>

            <div className="flex gap-2 pt-1">
              {editingHotelId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingHotelId(null);
                    setHotelDraft({ name: '', checkIn: selectedDate || trip.startDate, checkOut: trip.endDate });
                  }}
                  className="h-10 px-4 rounded-full bg-zinc-200 dark:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-200 cursor-pointer"
                >
                  取消編輯
                </button>
              )}
              <button
                type="submit"
                disabled={!hotelDraft.name.trim()}
                className="flex-1 h-10 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs disabled:opacity-40 cursor-pointer"
              >
                {editingHotelId ? '更新酒店資料' : '+ 新增住宿酒店'}
              </button>
            </div>
          </form>

          {hotels.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 px-1">
                已設定住宿 ({hotels.length})
              </div>
              {hotels.map((h) => {
                const isToday = selectedDate >= h.checkIn && selectedDate <= h.checkOut;
                return (
                  <div
                    key={h.id}
                    onClick={() => {
                      setEditingHotelId(h.id);
                      setHotelDraft({
                        name: h.name,
                        checkIn: h.checkIn,
                        checkOut: h.checkOut,
                      });
                    }}
                    className={`p-3 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                      isToday
                        ? 'bg-indigo-600/10 border-indigo-500/40'
                        : 'bg-zinc-100/70 dark:bg-white/[0.04] border-zinc-200/70 dark:border-white/10'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-zinc-900 dark:text-white truncate">
                          {h.name}
                        </span>
                        {isToday && (
                          <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold shrink-0">
                            當日入住
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-num text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                        {h.checkIn} ~ {h.checkOut}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteHotel(h.id);
                      }}
                      aria-label="刪除酒店"
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-red-500 hover:bg-red-500/10 shrink-0 cursor-pointer"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </LiquidModal>

      <ConfirmSheet
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleDeleteActivity}
        title="刪除此行程？"
        description="刪除後會同步從其他已連線裝置移除。"
        confirmLabel="確認刪除"
        icon={<TrashIcon className="w-6 h-6" />}
      />
    </div>
  );
};

export default ItineraryTool;
