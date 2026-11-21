import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import type { Trip, SyncDevice } from './types.ts';
import { mergeTrips, normalizeSyncCode } from './shared/syncMerge.ts';
import { detectDestinationIntel } from './shared/destinationIntel.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.join(__dirname, '.data');
const TRIPS_FILE = path.join(DATA_DIR, 'trips.json');
const PHOTO_CACHE_FILE = path.join(DATA_DIR, 'photo-cache.json');
const DOCS_DIR = path.join(DATA_DIR, 'documents');

// Weather cache (10 minutes TTL) & Open-Meteo circuit breaker
interface CachedWeather {
  expiresAt: number;
  data: unknown;
}
const weatherCache = new Map<string, CachedWeather>();
let openMeteoBlockedUntil = 0;

// Global destination photo cache (7 days TTL, persisted to disk)
interface CachedPhotoMeta {
  expiresAt: number;
  data: {
    city: string;
    resolvedName: string;
    country: string;
    imageUrl: string | null;
    title: string | null;
  };
}
const photoMetaCache = new Map<string, CachedPhotoMeta>();
const photoBinaryCache = new Map<string, { expiresAt: number; contentType: string; buffer: Buffer }>();

const NON_SCENIC_IMAGE_RE =
  /(\.svg$|montage|collage|photomontage|composite|views_of|split_image|multiview|collection|mosaic|grid|flag_of|coat_of_arms|emblem|seal_of|crest|locator|map|district|blank|logo|icon|symbol|diagram|chart|signature|wordmark|banner_of|stamp|coin|timeline|poster|commons-logo|wikipedia-logo|wiktionary|wikibooks|wikisource|silhouette|地圖|位置圖|行政區|路線圖|國旗|徽章|標誌|拼圖|合集|總覽圖|%E5%9C%B0%E5%9C%96|%E4%BD%8D%E7%BD%AE%E5%9C%96|%E8%A1%8C%E6%94%BF%E5%8D%80|%E5%9C%8B%E6%97%97)/i;

function isScenicPhotoUrl(url?: string | null): url is string {
  if (!url || typeof url !== 'string') return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  const pathname = parsed.pathname;
  let decodedPath = pathname;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    // ignore malformed encoding
  }
  return !NON_SCENIC_IMAGE_RE.test(pathname) && !NON_SCENIC_IMAGE_RE.test(decodedPath);
}

function scoreScenicImage(url: string, width: number, height: number, mime?: string): number {
  if (!isScenicPhotoUrl(url)) return -1;
  if (mime && mime.includes('svg')) return -1;
  if (width < 460 || height < 280) return -1;
  const aspect = width / Math.max(1, height);
  if (aspect < 0.72 || aspect > 2.8) return -1;

  let score = 0;
  if (aspect >= 1.15 && aspect <= 2.2) score += 45;
  else if (aspect >= 1.0) score += 20;
  if (width >= 1000) score += 20;
  else if (width >= 750) score += 12;
  if (!mime || mime === 'image/jpeg' || url.toLowerCase().endsWith('.jpg') || url.toLowerCase().endsWith('.jpeg')) {
    score += 20;
  }

  const lower = decodeURIComponent(url).toLowerCase();
  if (/(skyline|panorama|cityscape|view|night|sunset|harbor|harbour|waterfront|tower|bridge|temple|shrine|palace|castle|lake|river|mountain|square|downtown|station|scenery)/.test(lower)) {
    score += 30;
  }
  if (/(portrait|headshot|statue|plaque|museum_interior|coin|grave|signpost|ticket|diagram|plan)/.test(lower)) {
    score -= 35;
  }
  return score;
}

async function fetchWikiLeadImage(
  lang: 'en' | 'zh',
  titleQuery: string,
  requireLandscape = true
): Promise<{ imageUrl: string; title: string; hasCoords: boolean } | null> {
  try {
    const url =
      `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*` +
      `&prop=pageimages|coordinates&piprop=thumbnail&pithumbsize=1200&redirects=1&titles=${encodeURIComponent(titleQuery)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'WaynoteTravelApp/1.0 (https://waynote.app)' },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      query?: {
        pages?: Record<
          string,
          {
            title?: string;
            coordinates?: Array<{ lat: number; lon: number }>;
            thumbnail?: { source?: string; width?: number; height?: number };
          }
        >;
      };
    };
    const pages = Object.values(json.query?.pages || {});
    for (const p of pages) {
      const src = p.thumbnail?.source;
      const w = p.thumbnail?.width || 0;
      const h = p.thumbnail?.height || 0;
      const minAspect = requireLandscape ? 0.92 : 0.72;
      if (isScenicPhotoUrl(src) && w >= 420 && w >= h * minAspect) {
        return {
          imageUrl: src,
          title: p.title || titleQuery,
          hasCoords: Boolean(p.coordinates && p.coordinates.length > 0),
        };
      }
    }
  } catch {
    // Ignore transient wiki errors
  }
  return null;
}

async function fetchWikiArticleScenicImage(
  lang: 'en' | 'zh',
  titleQuery: string
): Promise<{ imageUrl: string; title: string } | null> {
  try {
    const url =
      `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*` +
      `&generator=images&gimlimit=24&redirects=1&titles=${encodeURIComponent(titleQuery)}` +
      `&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=1200`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'WaynoteTravelApp/1.0 (https://waynote.app)' },
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      query?: {
        pages?: Record<
          string,
          {
            title?: string;
            imageinfo?: Array<{
              url?: string;
              thumburl?: string;
              width?: number;
              height?: number;
              mime?: string;
            }>;
          }
        >;
      };
    };
    const candidates: Array<{ score: number; imageUrl: string; title: string }> = [];
    for (const page of Object.values(json.query?.pages || {})) {
      const info = page.imageinfo?.[0];
      if (!info) continue;
      const imgUrl = info.thumburl || info.url;
      if (!imgUrl) continue;
      const s = scoreScenicImage(imgUrl, info.width || 0, info.height || 0, info.mime);
      if (s > 0) {
        candidates.push({ score: s, imageUrl: imgUrl, title: titleQuery });
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    if (candidates.length > 0) {
      return { imageUrl: candidates[0].imageUrl, title: candidates[0].title };
    }
  } catch {
    // Ignore
  }
  return null;
}

async function fetchCommonsScenicPhoto(searchQuery: string): Promise<{ imageUrl: string; title: string } | null> {
  try {
    const url =
      `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*` +
      `&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(searchQuery)}&gsrlimit=12` +
      `&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=1200`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'WaynoteTravelApp/1.0 (https://waynote.app)' },
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      query?: {
        pages?: Record<
          string,
          {
            index?: number;
            title?: string;
            imageinfo?: Array<{
              url?: string;
              thumburl?: string;
              width?: number;
              height?: number;
              mime?: string;
            }>;
          }
        >;
      };
    };
    const candidates: Array<{ score: number; imageUrl: string; title: string }> = [];
    for (const page of Object.values(json.query?.pages || {})) {
      const info = page.imageinfo?.[0];
      if (!info) continue;
      const imgUrl = info.thumburl || info.url;
      if (!imgUrl) continue;
      const s = scoreScenicImage(imgUrl, info.width || 0, info.height || 0, info.mime);
      if (s > 0) {
        candidates.push({ score: s, imageUrl: imgUrl, title: searchQuery });
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    if (candidates.length > 0) {
      return { imageUrl: candidates[0].imageUrl, title: candidates[0].title };
    }
  } catch {
    // Ignore
  }
  return null;
}

async function fetchWikiSearchImage(
  lang: 'en' | 'zh',
  searchQuery: string
): Promise<{ imageUrl: string; title: string } | null> {
  try {
    const url =
      `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*` +
      `&generator=search&gsrsearch=${encodeURIComponent(searchQuery)}&gsrlimit=6` +
      `&prop=pageimages|coordinates&piprop=thumbnail&pithumbsize=1200`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'WaynoteTravelApp/1.0 (https://waynote.app)' },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      query?: {
        pages?: Record<
          string,
          {
            index?: number;
            title?: string;
            coordinates?: Array<{ lat: number; lon: number }>;
            thumbnail?: { source?: string; width?: number; height?: number };
          }
        >;
      };
    };
    const pages = Object.values(json.query?.pages || {}).sort((a, b) => {
      const aGeo = a.coordinates?.length ? 0 : 1;
      const bGeo = b.coordinates?.length ? 0 : 1;
      if (aGeo !== bGeo) return aGeo - bGeo;
      return (a.index || 99) - (b.index || 99);
    });
    for (const p of pages) {
      const src = p.thumbnail?.source;
      const w = p.thumbnail?.width || 0;
      const h = p.thumbnail?.height || 0;
      if (isScenicPhotoUrl(src) && w >= 420 && w >= h * 0.78) {
        return { imageUrl: src, title: p.title || searchQuery };
      }
    }
  } catch {
    // Ignore
  }
  return null;
}

async function fetchWikiGeoImage(lat: number, lon: number): Promise<{ imageUrl: string; title: string } | null> {
  try {
    const url =
      `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*` +
      `&generator=geosearch&gscoord=${lat.toFixed(4)}|${lon.toFixed(4)}&gsradius=10000&gslimit=8` +
      `&prop=pageimages&piprop=thumbnail&pithumbsize=1200`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'WaynoteTravelApp/1.0 (https://waynote.app)' },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      query?: { pages?: Record<string, { index?: number; title?: string; thumbnail?: { source?: string; width?: number; height?: number } }> };
    };
    const pages = Object.values(json.query?.pages || {});
    for (const p of pages) {
      const src = p.thumbnail?.source;
      const w = p.thumbnail?.width || 0;
      const h = p.thumbnail?.height || 0;
      if (isScenicPhotoUrl(src) && w >= 420 && w >= h * 0.78) {
        return { imageUrl: src, title: p.title || '' };
      }
    }
  } catch {
    // Ignore
  }
  return null;
}

async function prewarmPhotoBinary(rawUrl: string) {
  try {
    const existing = photoBinaryCache.get(rawUrl);
    if (existing && existing.expiresAt > Date.now()) return;
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return;
    const upstream = await fetch(rawUrl, {
      headers: { 'User-Agent': 'WaynoteTravelApp/1.0 (https://waynote.app)' },
      signal: AbortSignal.timeout(5000),
    });
    if (!upstream.ok) return;
    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (photoBinaryCache.size >= 80) {
      const oldestKey = photoBinaryCache.keys().next().value;
      if (oldestKey) photoBinaryCache.delete(oldestKey);
    }
    photoBinaryCache.set(rawUrl, {
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      contentType,
      buffer,
    });
  } catch {
    // Non-blocking background prewarm
  }
}

type WeatherKind = 'clear' | 'partly' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm';

function mapWmoWeather(code: number): { label: string; kind: WeatherKind } {
  if (code === 0) return { label: '晴朗無雲', kind: 'clear' };
  if (code === 1 || code === 2) return { label: '晴時多雲', kind: 'partly' };
  if (code === 3) return { label: '陰天多雲', kind: 'cloudy' };
  if (code === 45 || code === 48) return { label: '有霧／薄霧', kind: 'fog' };
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { label: '有雨／陣雨', kind: 'rain' };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: '降雪／雨夾雪', kind: 'snow' };
  if ([95, 96, 99].includes(code)) return { label: '雷陣雨', kind: 'storm' };
  return { label: '多雲', kind: 'partly' };
}

function mapMetNoSymbol(symbolCode: string): { label: string; kind: WeatherKind; isDay: boolean } {
  const s = (symbolCode || 'partlycloudy_day').toLowerCase();
  const isDay = !s.includes('night');
  if (s.includes('thunder')) return { label: '雷陣雨', kind: 'storm', isDay };
  if (s.includes('snow') || s.includes('sleet')) return { label: '降雪／雨夾雪', kind: 'snow', isDay };
  if (s.includes('rain')) return { label: '有雨／陣雨', kind: 'rain', isDay };
  if (s.includes('fog')) return { label: '有霧／薄霧', kind: 'fog', isDay };
  if (s.startsWith('cloudy')) return { label: '陰天多雲', kind: 'cloudy', isDay };
  if (s.startsWith('partlycloudy') || s.startsWith('fair')) return { label: '晴時多雲', kind: 'partly', isDay };
  if (s.startsWith('clearsky')) return { label: '晴朗無雲', kind: 'clear', isDay };
  return { label: '晴時多雲', kind: 'partly', isDay };
}

function getLocalPartsInTz(isoUtc: string, timeZone: string, fallbackOffsetHours: number): {
  dateStr: string;
  hourStr: string;
  hourNum: number;
} {
  const d = new Date(isoUtc);
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = fmt.formatToParts(d);
    const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';
    const hh = get('hour') === '24' ? '00' : get('hour');
    return {
      dateStr: `${get('year')}-${get('month')}-${get('day')}`,
      hourStr: `${get('year')}-${get('month')}-${get('day')}T${hh}:00`,
      hourNum: Number(hh),
    };
  } catch {
    const shifted = new Date(d.getTime() + fallbackOffsetHours * 3600000);
    const iso = shifted.toISOString();
    return {
      dateStr: iso.slice(0, 10),
      hourStr: iso.slice(0, 13) + ':00',
      hourNum: Number(iso.slice(11, 13)),
    };
  }
}

function getTzOffsetHours(timeZone: string, fallbackOffsetHours: number): number {
  try {
    const now = new Date();
    const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(now.toLocaleString('en-US', { timeZone }));
    return Math.round((tzDate.getTime() - utcDate.getTime()) / 3600000);
  } catch {
    return fallbackOffsetHours;
  }
}

// Authoritative in-memory store backed by disk
const tripsStore = new Map<string, Trip>();

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
  }
}

function loadTripsFromDisk() {
  try {
    ensureDataDir();
    if (fs.existsSync(TRIPS_FILE)) {
      const raw = fs.readFileSync(TRIPS_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, Trip>;
      for (const [syncId, trip] of Object.entries(parsed)) {
        tripsStore.set(syncId, trip);
      }
    }
  } catch (err) {
    console.error('[SkyTravel Sync] Failed to load persisted trips:', err);
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSaveToDisk() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      ensureDataDir();
      const obj: Record<string, Trip> = {};
      for (const [k, v] of tripsStore.entries()) {
        obj[k] = v;
      }
      const tempFile = `${TRIPS_FILE}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(obj), 'utf-8');
      fs.renameSync(tempFile, TRIPS_FILE);
    } catch (err) {
      console.error('[SkyTravel Sync] Failed to persist trips:', err);
    }
  }, 180);
}

loadTripsFromDisk();

function loadPhotoCacheFromDisk() {
  try {
    ensureDataDir();
    if (fs.existsSync(PHOTO_CACHE_FILE)) {
      const raw = fs.readFileSync(PHOTO_CACHE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, CachedPhotoMeta>;
      const now = Date.now();
      for (const [k, entry] of Object.entries(parsed)) {
        if (entry && entry.expiresAt > now) {
          photoMetaCache.set(k, entry);
        }
      }
    }
  } catch {
    // ignore corrupt photo cache
  }
}

let savePhotoTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSavePhotoCache() {
  if (savePhotoTimer) clearTimeout(savePhotoTimer);
  savePhotoTimer = setTimeout(() => {
    try {
      ensureDataDir();
      const obj: Record<string, CachedPhotoMeta> = {};
      const now = Date.now();
      for (const [k, v] of photoMetaCache.entries()) {
        if (v.expiresAt > now) obj[k] = v;
      }
      const tempFile = `${PHOTO_CACHE_FILE}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(obj), 'utf-8');
      fs.renameSync(tempFile, PHOTO_CACHE_FILE);
    } catch {
      // ignore write errors
    }
  }, 300);
}

loadPhotoCacheFromDisk();

// Room Presence Management
interface RoomClient {
  ws: WebSocket;
  clientId: string;
  deviceName: string;
  connectedAt: number;
  lastSeenAt: number;
}

const rooms = new Map<string, Map<string, RoomClient>>();

const PRESENCE_STALE_MS = 1800;

function pruneRoom(syncId: string) {
  const room = rooms.get(syncId);
  if (!room) return null;
  const now = Date.now();
  for (const [cid, client] of room.entries()) {
    const isClosed = client.ws.readyState !== WebSocket.OPEN;
    const isStale = now - client.lastSeenAt > PRESENCE_STALE_MS;
    if (isClosed || isStale) {
      room.delete(cid);
      if (isStale && client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.terminate();
        } catch {
          // ignore
        }
      }
    }
  }
  if (room.size === 0) {
    rooms.delete(syncId);
    return null;
  }
  return room;
}

function getRoomDevices(syncId: string): SyncDevice[] {
  const room = pruneRoom(syncId);
  if (!room) return [];
  return Array.from(room.values()).map((c) => ({
    clientId: c.clientId,
    deviceName: c.deviceName,
    connectedAt: c.connectedAt,
  }));
}

function broadcastRoom(syncId: string, payload: unknown, excludeClientId?: string) {
  const room = rooms.get(syncId);
  if (!room) return;
  const serialized = JSON.stringify(payload);
  for (const client of room.values()) {
    if (excludeClientId && client.clientId === excludeClientId) continue;
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(serialized);
    }
  }
}

function upsertAndMergeTrip(syncId: string, incomingTrip: Trip): Trip {
  const normalized = normalizeSyncCode(syncId);
  const existing = tripsStore.get(normalized);
  const merged = existing
    ? mergeTrips(existing, { ...incomingTrip, syncId: normalized })
    : { ...incomingTrip, syncId: normalized, revision: incomingTrip.revision || 1, updatedAt: incomingTrip.updatedAt || Date.now() };

  merged.revision = (existing?.revision || 0) + 1;
  tripsStore.set(normalized, merged);
  scheduleSaveToDisk();
  return merged;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, rooms: rooms.size, trips: tripsStore.size });
  });

  app.get('/api/maps/config', (_req, res) => {
    res.json({ apiKey: process.env.VITE_GOOGLE_MAPS_API_KEY || '' });
  });

  app.get('/api/weather', async (req, res) => {
    const rawCity = String(req.query.city || '').trim();
    if (!rawCity) {
      res.status(400).json({ error: '缺少城市名稱' });
      return;
    }

    const intel = detectDestinationIntel(rawCity);
    const cacheKey = `${rawCity.toLowerCase()}::${intel.cityQuery.toLowerCase()}`;
    const cached = weatherCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      res.json(cached.data);
      return;
    }

    try {
      const tryQueries = Array.from(new Set([rawCity.split(/\s*[-→>/,]\s*/)[0]?.trim() || rawCity, intel.cityQuery]));
      let location: { name: string; country?: string; latitude: number; longitude: number; timezone?: string } | null = null;

      for (const q of tryQueries) {
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=zh&format=json`;
        const geoRes = await fetch(geoUrl, { signal: AbortSignal.timeout(4000) });
        if (geoRes.ok) {
          const geoJson = (await geoRes.json()) as {
            results?: Array<{ name: string; country?: string; latitude: number; longitude: number; timezone?: string }>;
          };
          if (geoJson.results && geoJson.results.length > 0) {
            location = geoJson.results[0];
            break;
          }
        }
      }

      if (!location) {
        res.status(404).json({ error: `找不到「${rawCity}」的天氣座標` });
        return;
      }

      let payload: unknown = null;

      // 1. Try Open-Meteo Forecast (short 1.8s timeout, bypassed briefly if unreachable)
      if (Date.now() > openMeteoBlockedUntil) {
        try {
          const forecastUrl =
            `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}` +
            `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m` +
            `&hourly=temperature_2m,precipitation_probability,weather_code,is_day` +
            `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max` +
            `&timezone=auto&forecast_days=7`;

          const weatherRes = await fetch(forecastUrl, { signal: AbortSignal.timeout(1800) });
          if (weatherRes.ok) {
            const w = (await weatherRes.json()) as {
              timezone: string;
              utc_offset_seconds: number;
              current: {
                time: string;
                temperature_2m: number;
                relative_humidity_2m: number;
                apparent_temperature: number;
                is_day: number;
                precipitation: number;
                weather_code: number;
                wind_speed_10m: number;
              };
              hourly: {
                time: string[];
                temperature_2m: number[];
                precipitation_probability: number[];
                weather_code: number[];
                is_day: number[];
              };
              daily: {
                time: string[];
                weather_code: number[];
                temperature_2m_max: number[];
                temperature_2m_min: number[];
                precipitation_probability_max: number[];
                sunrise: string[];
                sunset: string[];
                uv_index_max: number[];
              };
            };

            const currentMeta = mapWmoWeather(w.current.weather_code);
            const currentTimePrefix = w.current.time.slice(0, 13);
            let startHourIdx = w.hourly.time.findIndex((t) => t.startsWith(currentTimePrefix));
            if (startHourIdx < 0) startHourIdx = 0;

            const hourly = w.hourly.time.slice(startHourIdx, startHourIdx + 12).map((time, offset) => {
              const idx = startHourIdx + offset;
              const meta = mapWmoWeather(w.hourly.weather_code[idx] ?? 0);
              return {
                time,
                temp: Math.round(w.hourly.temperature_2m[idx] ?? 0),
                precipProb: w.hourly.precipitation_probability[idx] ?? 0,
                kind: meta.kind,
                label: meta.label,
                isDay: (w.hourly.is_day[idx] ?? 1) === 1,
              };
            });

            const daily = w.daily.time.map((date, idx) => {
              const meta = mapWmoWeather(w.daily.weather_code[idx] ?? 0);
              return {
                date,
                tempMax: Math.round(w.daily.temperature_2m_max[idx] ?? 0),
                tempMin: Math.round(w.daily.temperature_2m_min[idx] ?? 0),
                precipProb: w.daily.precipitation_probability_max[idx] ?? 0,
                uvMax: Math.round(w.daily.uv_index_max[idx] ?? 0),
                sunrise: w.daily.sunrise[idx]?.slice(11, 16) || '',
                sunset: w.daily.sunset[idx]?.slice(11, 16) || '',
                kind: meta.kind,
                label: meta.label,
              };
            });

            payload = {
              city: rawCity.split(/\s*[-→>/,]\s*/)[0]?.trim() || location.name,
              resolvedName: location.name,
              country: location.country || intel.countryLabel,
              timezone: w.timezone,
              utcOffsetHours: Math.round((w.utc_offset_seconds || 0) / 3600),
              fetchedAt: Date.now(),
              current: {
                temp: Math.round(w.current.temperature_2m),
                feelsLike: Math.round(w.current.apparent_temperature),
                humidity: Math.round(w.current.relative_humidity_2m),
                windSpeed: Math.round(w.current.wind_speed_10m),
                precipitation: w.current.precipitation,
                isDay: w.current.is_day === 1,
                label: currentMeta.label,
                kind: currentMeta.kind,
              },
              hourly,
              daily,
            };
          }
        } catch {
          openMeteoBlockedUntil = Date.now() + 5 * 60 * 1000;
        }
      }

      // 2. Fallback to Norwegian Meteorological Institute (api.met.no) — fast global 9-day forecast
      if (!payload) {
        const metUrl = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${location.latitude.toFixed(4)}&lon=${location.longitude.toFixed(4)}`;
        const metRes = await fetch(metUrl, {
          headers: { 'User-Agent': 'SkyTravelApp/2.0 (travel-planner)' },
          signal: AbortSignal.timeout(5000),
        });
        if (!metRes.ok) {
          res.status(502).json({ error: '無法取得即時氣象資料' });
          return;
        }

        const metJson = (await metRes.json()) as {
          properties?: {
            timeseries?: Array<{
              time: string;
              data: {
                instant?: {
                  details?: {
                    air_temperature?: number;
                    relative_humidity?: number;
                    wind_speed?: number;
                  };
                };
                next_1_hours?: {
                  summary?: { symbol_code?: string };
                  details?: { precipitation_amount?: number };
                };
                next_6_hours?: {
                  summary?: { symbol_code?: string };
                  details?: { precipitation_amount?: number };
                };
                next_12_hours?: {
                  summary?: { symbol_code?: string };
                };
              };
            }>;
          };
        };

        const series = metJson.properties?.timeseries || [];
        if (series.length === 0) {
          res.status(502).json({ error: '無法取得即時氣象資料' });
          return;
        }

        const tz = location.timezone || 'UTC';
        const utcOffsetHours = getTzOffsetHours(tz, intel.utcOffsetHours);
        const nowEntry = series[0];
        const nowDetails = nowEntry.data.instant?.details || {};
        const nowSymbol =
          nowEntry.data.next_1_hours?.summary?.symbol_code ||
          nowEntry.data.next_6_hours?.summary?.symbol_code ||
          'partlycloudy_day';
        const nowMeta = mapMetNoSymbol(nowSymbol);
        const tempC = Math.round(nowDetails.air_temperature ?? 20);
        const windKmh = Math.round((nowDetails.wind_speed ?? 2) * 3.6);
        const humidity = Math.round(nowDetails.relative_humidity ?? 60);
        const precipMm = nowEntry.data.next_1_hours?.details?.precipitation_amount ?? 0;

        // Steadman-inspired simple apparent temp approximation
        const feelsLike = Math.round(
          tempC <= 10 && windKmh > 5
            ? tempC - windKmh * 0.14
            : tempC >= 26 && humidity >= 65
              ? tempC + (humidity - 60) * 0.08
              : tempC
        );

        const estimatePrecipProb = (mm: number, kind: WeatherKind): number => {
          if (mm >= 2) return 85;
          if (mm >= 0.4) return 65;
          if (mm > 0) return 45;
          if (kind === 'rain' || kind === 'storm') return 55;
          if (kind === 'snow') return 50;
          if (kind === 'cloudy') return 15;
          return 5;
        };

        const hourly = series.slice(0, 12).map((entry) => {
          const local = getLocalPartsInTz(entry.time, tz, utcOffsetHours);
          const sym =
            entry.data.next_1_hours?.summary?.symbol_code ||
            entry.data.next_6_hours?.summary?.symbol_code ||
            'partlycloudy_day';
          const meta = mapMetNoSymbol(sym);
          const mm =
            entry.data.next_1_hours?.details?.precipitation_amount ??
            entry.data.next_6_hours?.details?.precipitation_amount ??
            0;
          return {
            time: local.hourStr,
            temp: Math.round(entry.data.instant?.details?.air_temperature ?? tempC),
            precipProb: estimatePrecipProb(mm, meta.kind),
            kind: meta.kind,
            label: meta.label,
            isDay: local.hourNum >= 6 && local.hourNum < 18,
          };
        });

        const dayMap = new Map<
          string,
          { temps: number[]; precipProbs: number[]; kinds: WeatherKind[]; labels: string[] }
        >();

        for (const entry of series) {
          const local = getLocalPartsInTz(entry.time, tz, utcOffsetHours);
          const t = entry.data.instant?.details?.air_temperature;
          if (typeof t !== 'number') continue;
          const sym =
            entry.data.next_6_hours?.summary?.symbol_code ||
            entry.data.next_1_hours?.summary?.symbol_code ||
            entry.data.next_12_hours?.summary?.symbol_code ||
            'partlycloudy_day';
          const meta = mapMetNoSymbol(sym);
          const mm =
            entry.data.next_6_hours?.details?.precipitation_amount ??
            entry.data.next_1_hours?.details?.precipitation_amount ??
            0;

          if (!dayMap.has(local.dateStr)) {
            dayMap.set(local.dateStr, { temps: [], precipProbs: [], kinds: [], labels: [] });
          }
          const bucket = dayMap.get(local.dateStr)!;
          bucket.temps.push(t);
          bucket.precipProbs.push(estimatePrecipProb(mm, meta.kind));
          bucket.kinds.push(meta.kind);
          bucket.labels.push(meta.label);
        }

        const daily = Array.from(dayMap.entries())
          .slice(0, 7)
          .map(([date, bucket]) => {
            const middayIdx = Math.floor(bucket.kinds.length / 2);
            const worstRainIdx = bucket.kinds.findIndex((k) => k === 'storm' || k === 'rain' || k === 'snow');
            const pickIdx = worstRainIdx !== -1 ? worstRainIdx : middayIdx;
            return {
              date,
              tempMax: Math.round(Math.max(...bucket.temps)),
              tempMin: Math.round(Math.min(...bucket.temps)),
              precipProb: Math.max(...bucket.precipProbs),
              uvMax: 4,
              sunrise: '06:15',
              sunset: '17:45',
              kind: bucket.kinds[pickIdx] || 'partly',
              label: bucket.labels[pickIdx] || '晴時多雲',
            };
          });

        payload = {
          city: rawCity.split(/\s*[-→>/,]\s*/)[0]?.trim() || location.name,
          resolvedName: location.name,
          country: location.country || intel.countryLabel,
          timezone: tz,
          utcOffsetHours,
          fetchedAt: Date.now(),
          current: {
            temp: tempC,
            feelsLike,
            humidity,
            windSpeed: windKmh,
            precipitation: precipMm,
            isDay: nowMeta.isDay,
            label: nowMeta.label,
            kind: nowMeta.kind,
          },
          hourly,
          daily,
        };
      }

      weatherCache.set(cacheKey, {
        expiresAt: Date.now() + 10 * 60 * 1000,
        data: payload,
      });

      res.json(payload);
    } catch (err) {
      console.error('[SkyTravel Weather] Error:', err);
      res.status(502).json({ error: '天氣服務暫時無法連線' });
    }
  });

  app.get('/api/destination-photo', async (req, res) => {
    const rawCity = String(req.query.city || '').trim();
    if (!rawCity) {
      res.status(400).json({ error: '缺少城市名稱' });
      return;
    }

    const primaryCity = rawCity.split(/\s*[-→>/,]\s*/)[0]?.trim() || rawCity;
    const intel = detectDestinationIntel(primaryCity);
    const cacheKey = `v5:${primaryCity.toLowerCase()}`;
    const cached = photoMetaCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      res.json(cached.data);
      return;
    }

    const hasCjk = /[\u4e00-\u9fff]/.test(primaryCity);
    const hasIntelMapping = intel.cityQuery && intel.cityQuery !== primaryCity;
    const geoQueries = Array.from(
      new Set((hasIntelMapping ? [intel.cityQuery, primaryCity] : [primaryCity, intel.cityQuery]).filter(Boolean))
    );

    // Run Open-Meteo geocoding (top-population pick) + Wikipedia lead images in parallel
    const [geoOutcome, zhLeadDirect, enIntelDirect] = await Promise.allSettled([
      (async () => {
        for (const q of geoQueries) {
          try {
            const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`;
            const geoRes = await fetch(geoUrl, { signal: AbortSignal.timeout(2500) });
            if (geoRes.ok) {
              const geoJson = (await geoRes.json()) as {
                results?: Array<{
                  name: string;
                  country?: string;
                  latitude: number;
                  longitude: number;
                  population?: number;
                }>;
              };
              const results = geoJson.results || [];
              if (results.length > 0) {
                const sorted = [...results].sort((a, b) => (b.population || 0) - (a.population || 0));
                return sorted[0];
              }
            }
          } catch {
            // continue
          }
        }
        return null;
      })(),
      hasCjk ? fetchWikiLeadImage('zh', primaryCity) : Promise.resolve(null),
      fetchWikiLeadImage('en', intel.cityQuery || primaryCity),
    ]);

    const topGeo = geoOutcome.status === 'fulfilled' ? geoOutcome.value : null;
    const resolvedName = topGeo?.name || (hasIntelMapping ? intel.cityQuery : primaryCity);
    const country = topGeo?.country || (intel.countryLabel !== '旅遊目的地' ? intel.countryLabel : '');
    const lat = topGeo?.latitude ?? null;
    const lon = topGeo?.longitude ?? null;

    let enGeoLead: { imageUrl: string; title: string; hasCoords: boolean } | null = null;
    if (topGeo?.name && topGeo.name.toLowerCase() !== (intel.cityQuery || '').toLowerCase()) {
      enGeoLead = await fetchWikiLeadImage('en', topGeo.name);
    }

    const zhVal = zhLeadDirect.status === 'fulfilled' ? zhLeadDirect.value : null;
    const enVal = enIntelDirect.status === 'fulfilled' ? enIntelDirect.value : null;

    let found: { imageUrl: string; title: string } | null =
      (hasIntelMapping ? enVal || enGeoLead || zhVal : null) ||
      (hasCjk && zhVal?.hasCoords ? zhVal : null) ||
      (enGeoLead?.hasCoords ? enGeoLead : null) ||
      (enVal?.hasCoords ? enVal : null) ||
      enGeoLead ||
      zhVal ||
      enVal ||
      null;

    // If lead image was skipped (e.g. collage/montage like Tokyo) or missing, inspect embedded article scenic photos
    if (!found) {
      const articleCandidates = await Promise.allSettled([
        fetchWikiArticleScenicImage('en', resolvedName),
        hasCjk ? fetchWikiArticleScenicImage('zh', primaryCity) : Promise.resolve(null),
      ]);
      for (const r of articleCandidates) {
        if (r.status === 'fulfilled' && r.value) {
          found = r.value;
          break;
        }
      }
    }

    // Wikimedia Commons pure scenic photography fallback
    if (!found) {
      found =
        (await fetchCommonsScenicPhoto(`${resolvedName} skyline`)) ||
        (await fetchCommonsScenicPhoto(`${resolvedName} cityscape`));
    }

    // Parallel Wikipedia search fallback (preferring geo-located pages)
    if (!found) {
      const searchPromises: Promise<{ imageUrl: string; title: string } | null>[] = [
        fetchWikiSearchImage('en', country ? `${resolvedName} ${country}` : resolvedName),
      ];
      if (hasCjk) {
        searchPromises.push(fetchWikiSearchImage('zh', primaryCity));
      }
      const searchResults = await Promise.allSettled(searchPromises);
      for (const r of searchResults) {
        if (r.status === 'fulfilled' && r.value) {
          found = r.value;
          break;
        }
      }
    }

    if (!found && lat !== null && lon !== null) {
      found = await fetchWikiGeoImage(lat, lon);
    }

    if (found?.imageUrl) {
      void prewarmPhotoBinary(found.imageUrl);
    }

    const payload = {
      city: primaryCity,
      resolvedName,
      country,
      imageUrl: found ? `/api/destination-photo/image?url=${encodeURIComponent(found.imageUrl)}` : null,
      title: found ? found.title : null,
    };

    photoMetaCache.set(cacheKey, {
      expiresAt: Date.now() + (found ? 7 * 24 * 60 * 60 * 1000 : 30 * 1000),
      data: payload,
    });
    if (found) {
      scheduleSavePhotoCache();
    }

    res.json(payload);
  });

  app.get('/api/destination-photo/image', async (req, res) => {
    const rawUrl = String(req.query.url || '').trim();
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      res.status(400).send('Invalid url');
      return;
    }

    if (
      parsed.protocol !== 'https:' ||
      !(parsed.hostname === 'upload.wikimedia.org' || parsed.hostname.endsWith('.wikimedia.org'))
    ) {
      res.status(403).send('Disallowed image host');
      return;
    }

    const cached = photoBinaryCache.get(rawUrl);
    if (cached && cached.expiresAt > Date.now()) {
      res.setHeader('Content-Type', cached.contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(cached.buffer);
      return;
    }

    try {
      const upstream = await fetch(rawUrl, {
        headers: { 'User-Agent': 'WaynoteTravelApp/1.0 (https://waynote.app)' },
        signal: AbortSignal.timeout(6000),
      });
      if (!upstream.ok) {
        res.status(502).send('Image fetch failed');
        return;
      }
      const contentType = upstream.headers.get('content-type') || 'image/jpeg';
      const arrayBuf = await upstream.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);

      if (photoBinaryCache.size >= 60) {
        const oldestKey = photoBinaryCache.keys().next().value;
        if (oldestKey) photoBinaryCache.delete(oldestKey);
      }
      photoBinaryCache.set(rawUrl, {
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        contentType,
        buffer,
      });

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(buffer);
    } catch {
      res.status(502).send('Image proxy error');
    }
  });

  app.get('/api/trips/:syncId', (req, res) => {
    const syncId = normalizeSyncCode(req.params.syncId);
    if (!syncId) {
      res.status(400).json({ error: 'Invalid sync code' });
      return;
    }
    const trip = tripsStore.get(syncId);
    if (!trip) {
      res.status(404).json({ error: 'Sync trip not found' });
      return;
    }
    res.json({ trip, devices: getRoomDevices(syncId) });
  });

  app.put('/api/trips/:syncId', (req, res) => {
    const syncId = normalizeSyncCode(req.params.syncId);
    const incomingTrip = req.body?.trip as Trip | undefined;
    const senderClientId = req.body?.clientId as string | undefined;
    const senderDeviceName = (req.body?.deviceName as string | undefined) || '另一台裝置';
    const editedSection = req.body?.editedSection as string | undefined;

    if (!syncId || !incomingTrip) {
      res.status(400).json({ error: 'Missing syncId or trip payload' });
      return;
    }

    const merged = upsertAndMergeTrip(syncId, incomingTrip);
    broadcastRoom(
      syncId,
      {
        type: 'trip:remote_update',
        trip: merged,
        sourceClientId: senderClientId,
        sourceDeviceName: senderDeviceName,
        editedSection,
      },
      senderClientId
    );
    res.json({ trip: merged, devices: getRoomDevices(syncId) });
  });

  app.post('/api/trips/:syncId/leave', (req, res) => {
    const syncId = normalizeSyncCode(req.params.syncId);
    const clientId = String(req.body?.clientId || '').trim();
    if (syncId && clientId) {
      const r = rooms.get(syncId);
      if (r && r.has(clientId)) {
        const entry = r.get(clientId);
        r.delete(clientId);
        if (entry && entry.ws.readyState === WebSocket.OPEN) {
          try {
            entry.ws.terminate();
          } catch {
            // ignore
          }
        }
        if (r.size === 0) {
          rooms.delete(syncId);
        } else {
          broadcastRoom(syncId, {
            type: 'presence:update',
            devices: getRoomDevices(syncId),
          });
        }
      }
    }
    res.status(204).end();
  });

  app.post(
    '/api/documents/upload',
    express.raw({ type: '*/*', limit: '25mb' }),
    (req, res) => {
      try {
        ensureDataDir();
        const buf = req.body;
        if (!Buffer.isBuffer(buf) || buf.length === 0) {
          res.status(400).json({ error: '未收到有效檔案內容' });
          return;
        }
        if (buf.length > 22 * 1024 * 1024) {
          res.status(413).json({ error: '檔案大小超過 20MB 上限' });
          return;
        }
        const rawNameHeader = String(req.headers['x-file-name'] || 'document').trim();
        let fileName = 'document';
        try {
          fileName = decodeURIComponent(rawNameHeader) || 'document';
        } catch {
          fileName = rawNameHeader || 'document';
        }
        const mimeType = String(req.headers['content-type'] || 'application/octet-stream')
          .split(';')[0]
          .trim() || 'application/octet-stream';
        const docId = `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        const binPath = path.join(DOCS_DIR, `${docId}.bin`);
        const metaPath = path.join(DOCS_DIR, `${docId}.meta.json`);
        fs.writeFileSync(binPath, buf);
        fs.writeFileSync(
          metaPath,
          JSON.stringify({ id: docId, fileName, mimeType, fileSize: buf.length, createdAt: Date.now() }),
          'utf-8'
        );
        res.json({
          id: docId,
          url: `/api/documents/${docId}`,
          fileName,
          mimeType,
          fileSize: buf.length,
        });
      } catch (err) {
        console.error('[Waynote Docs] Upload error:', err);
        res.status(500).json({ error: '檔案儲存失敗，請稍後再試' });
      }
    }
  );

  app.get('/api/documents/:docId', (req, res) => {
    const safeId = String(req.params.docId || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!safeId) {
      res.status(400).send('Invalid document ID');
      return;
    }
    const binPath = path.join(DOCS_DIR, `${safeId}.bin`);
    const metaPath = path.join(DOCS_DIR, `${safeId}.meta.json`);
    if (!fs.existsSync(binPath)) {
      res.status(404).send('Document not found');
      return;
    }
    let meta: { fileName?: string; mimeType?: string } = {};
    try {
      if (fs.existsSync(metaPath)) {
        meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      }
    } catch {
      // ignore corrupt meta
    }
    const mime = meta.mimeType || 'application/octet-stream';
    const fileName = meta.fileName || safeId;
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.sendFile(binPath, { dotfiles: 'allow' });
  });

  app.delete('/api/documents/:docId', (req, res) => {
    const safeId = String(req.params.docId || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!safeId) {
      res.status(400).json({ error: 'Invalid ID' });
      return;
    }
    try {
      const binPath = path.join(DOCS_DIR, `${safeId}.bin`);
      const metaPath = path.join(DOCS_DIR, `${safeId}.meta.json`);
      if (fs.existsSync(binPath)) fs.unlinkSync(binPath);
      if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
    } catch {
      // ignore
    }
    res.status(204).end();
  });

  const AIRPORT_IANA_MAP: Record<string, string> = {
    TPE: 'Asia/Taipei', TSA: 'Asia/Taipei', KHH: 'Asia/Taipei', RMQ: 'Asia/Taipei',
    HKG: 'Asia/Hong_Kong', MFM: 'Asia/Macau',
    NRT: 'Asia/Tokyo', HND: 'Asia/Tokyo', KIX: 'Asia/Tokyo', ITM: 'Asia/Tokyo',
    NGO: 'Asia/Tokyo', CTS: 'Asia/Tokyo', FUK: 'Asia/Tokyo', OKA: 'Asia/Tokyo',
    SDJ: 'Asia/Tokyo', KOJ: 'Asia/Tokyo', KMJ: 'Asia/Tokyo', HIJ: 'Asia/Tokyo',
    ICN: 'Asia/Seoul', GMP: 'Asia/Seoul', PUS: 'Asia/Seoul', CJU: 'Asia/Seoul',
    BKK: 'Asia/Bangkok', DMK: 'Asia/Bangkok', CNX: 'Asia/Bangkok', HKT: 'Asia/Bangkok',
    SIN: 'Asia/Singapore', KUL: 'Asia/Kuala_Lumpur', PEN: 'Asia/Kuala_Lumpur', BKI: 'Asia/Kuching',
    SGN: 'Asia/Ho_Chi_Minh', HAN: 'Asia/Ho_Chi_Minh', DAD: 'Asia/Ho_Chi_Minh',
    MNL: 'Asia/Manila', CEB: 'Asia/Manila', CGK: 'Asia/Jakarta', DPS: 'Asia/Makassar',
    RGN: 'Asia/Yangon', PNH: 'Asia/Phnom_Penh',
    PVG: 'Asia/Shanghai', SHA: 'Asia/Shanghai', PEK: 'Asia/Shanghai', PKX: 'Asia/Shanghai',
    CAN: 'Asia/Shanghai', SZX: 'Asia/Shanghai', HGH: 'Asia/Shanghai', CTU: 'Asia/Shanghai',
    TFU: 'Asia/Shanghai', CKG: 'Asia/Shanghai', XIY: 'Asia/Shanghai', KMG: 'Asia/Shanghai',
    NKG: 'Asia/Shanghai', TAO: 'Asia/Shanghai', DLC: 'Asia/Shanghai', WUH: 'Asia/Shanghai', XMN: 'Asia/Shanghai',
    DEL: 'Asia/Kolkata', BOM: 'Asia/Kolkata', BLR: 'Asia/Kolkata', MAA: 'Asia/Kolkata',
    DXB: 'Asia/Dubai', AUH: 'Asia/Dubai', DOH: 'Asia/Qatar', RUH: 'Asia/Riyadh', JED: 'Asia/Riyadh',
    IST: 'Europe/Istanbul', SAW: 'Europe/Istanbul', CAI: 'Africa/Cairo', JNB: 'Africa/Johannesburg',
    LHR: 'Europe/London', LGW: 'Europe/London', STN: 'Europe/London', MAN: 'Europe/London', EDI: 'Europe/London',
    DUB: 'Europe/Dublin',
    CDG: 'Europe/Paris', ORY: 'Europe/Paris', NCE: 'Europe/Paris', LYS: 'Europe/Paris',
    FRA: 'Europe/Berlin', MUC: 'Europe/Berlin', BER: 'Europe/Berlin', HAM: 'Europe/Berlin',
    AMS: 'Europe/Amsterdam', BRU: 'Europe/Brussels',
    ZRH: 'Europe/Zurich', GVA: 'Europe/Zurich', VIE: 'Europe/Vienna', PRG: 'Europe/Prague',
    MXP: 'Europe/Rome', FCO: 'Europe/Rome', VCE: 'Europe/Rome',
    MAD: 'Europe/Madrid', BCN: 'Europe/Madrid', LIS: 'Europe/Lisbon', OPO: 'Europe/Lisbon',
    ATH: 'Europe/Athens', CPH: 'Europe/Copenhagen', OSL: 'Europe/Oslo', ARN: 'Europe/Stockholm',
    HEL: 'Europe/Helsinki', KEF: 'Atlantic/Reykjavik', WAW: 'Europe/Warsaw', BUD: 'Europe/Budapest',
    JFK: 'America/New_York', EWR: 'America/New_York', LGA: 'America/New_York',
    BOS: 'America/New_York', IAD: 'America/New_York', ATL: 'America/New_York', MIA: 'America/New_York',
    ORD: 'America/Chicago', DFW: 'America/Chicago', IAH: 'America/Chicago',
    DEN: 'America/Denver',
    LAX: 'America/Los_Angeles', SFO: 'America/Los_Angeles', SEA: 'America/Los_Angeles',
    LAS: 'America/Los_Angeles', SAN: 'America/Los_Angeles',
    HNL: 'Pacific/Honolulu',
    YVR: 'America/Vancouver', YYZ: 'America/Toronto', YUL: 'America/Toronto',
    MEX: 'America/Mexico_City', GRU: 'America/Sao_Paulo', EZE: 'America/Argentina/Buenos_Aires', SCL: 'America/Santiago',
    SYD: 'Australia/Sydney', MEL: 'Australia/Melbourne', BNE: 'Australia/Brisbane',
    ADL: 'Australia/Adelaide', PER: 'Australia/Perth',
    AKL: 'Pacific/Auckland', CHC: 'Pacific/Auckland',
  };
  const airportTzCache = new Map<string, string>();

  const getOffsetHoursForDate = (ianaTimeZone: string, dateIso?: string): number | null => {
    try {
      const probe = dateIso && /^\d{4}-\d{2}-\d{2}$/.test(dateIso)
        ? new Date(`${dateIso}T12:00:00Z`)
        : new Date();
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: ianaTimeZone,
        timeZoneName: 'shortOffset',
      }).formatToParts(probe);
      const tzVal = parts.find((p) => p.type === 'timeZoneName')?.value || '';
      if (tzVal === 'GMT' || tzVal === 'UTC') return 0;
      const m = tzVal.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/i);
      if (!m) return null;
      const sign = m[1] === '-' ? -1 : 1;
      return sign * (Number(m[2]) + Number(m[3] || 0) / 60);
    } catch {
      return null;
    }
  };

  const inferOffsetByCountryOrLon = (countryIso?: string, lon?: number): number => {
    const iso = (countryIso || '').toUpperCase();
    const map: Record<string, number> = {
      TW: 8, HK: 8, MO: 8, CN: 8, SG: 8, MY: 8, PH: 8,
      JP: 9, KR: 9,
      TH: 7, VN: 7, KH: 7, LA: 7,
      IN: 5.5, AE: 4, QA: 3, TR: 3,
      GB: 0, IE: 0, PT: 0, IS: 0,
      FR: 1, DE: 1, IT: 1, ES: 1, NL: 1, CH: 1, AT: 1, CZ: 1, BE: 1, SE: 1, NO: 1, DK: 1, PL: 1, HU: 1,
      GR: 2, FI: 2, EG: 2, ZA: 2,
      AU: 10, NZ: 12,
    };
    if (iso && iso in map) return map[iso];
    if (typeof lon === 'number' && !Number.isNaN(lon)) {
      return Math.max(-12, Math.min(14, Math.round(lon / 15)));
    }
    return 8;
  };

  const resolveAirportOffsetHours = async (
    iataCode: string,
    dateIso: string,
    countryIso?: string,
    lat?: number,
    lon?: number
  ): Promise<number> => {
    const cleanIata = iataCode.trim().toUpperCase();
    let ianaTz = AIRPORT_IANA_MAP[cleanIata] || airportTzCache.get(cleanIata);

    if (!ianaTz && typeof lat === 'number' && typeof lon === 'number' && Date.now() > openMeteoBlockedUntil) {
      try {
        const tzUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&timezone=auto&forecast_days=1`;
        const tzRes = await fetch(tzUrl, { signal: AbortSignal.timeout(1800) });
        if (tzRes.ok) {
          const tzJson = (await tzRes.json()) as { timezone?: string };
          if (tzJson.timezone && tzJson.timezone !== 'UTC') {
            ianaTz = tzJson.timezone;
            airportTzCache.set(cleanIata, ianaTz);
          }
        }
      } catch {
        // fallback cleanly below
      }
    }

    if (ianaTz) {
      const exact = getOffsetHoursForDate(ianaTz, dateIso);
      if (exact !== null) return exact;
    }
    return inferOffsetByCountryOrLon(countryIso, lon);
  };

  app.post('/api/flights/lookup', async (req, res) => {
    const flightNumber = String(req.body?.flightNumber || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '');
    const date = String(req.body?.date || '').trim() || new Date().toISOString().slice(0, 10);
    if (!flightNumber || flightNumber.length < 3) {
      res.status(400).json({ error: '請輸入正確的航班編號（例如 BR198、CX504）' });
      return;
    }

    try {
      // Query real public flight schedule sources in parallel
      const [airportInfoRes, adsbRes] = await Promise.allSettled([
        (async () => {
          const r = await fetch(`https://airportinfo.live/flight/${encodeURIComponent(flightNumber)}`, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; WaynoteTravel/1.0)',
              Accept: 'text/html',
            },
            signal: AbortSignal.timeout(6000),
          });
          if (!r.ok) return null;
          const html = await r.text();
          const blocks = Array.from(
            html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
          );
          let flightObj: Record<string, unknown> | null = null;
          let airlineObj: Record<string, unknown> | null = null;
          const airports: Record<string, { iataCode?: string; name?: string; address?: string; lat?: number; lon?: number }> = {};

          for (const b of blocks) {
            try {
              const parsed = JSON.parse(b[1]);
              const graph = Array.isArray(parsed?.['@graph']) ? parsed['@graph'] : [];
              for (const node of graph) {
                if (!node || typeof node !== 'object') continue;
                const t = node['@type'];
                if (t === 'Flight') flightObj = node;
                else if (t === 'Airline') airlineObj = node;
                else if (t === 'Airport') {
                  const key = String(node['@id'] || '');
                  airports[key] = {
                    iataCode: node.iataCode ? String(node.iataCode).toUpperCase() : undefined,
                    name: node.name ? String(node.name) : undefined,
                    address: node.address ? String(node.address) : undefined,
                    lat: typeof node.geo?.latitude === 'number' ? node.geo.latitude : undefined,
                    lon: typeof node.geo?.longitude === 'number' ? node.geo.longitude : undefined,
                  };
                }
              }
            } catch {
              // ignore malformed JSON-LD block
            }
          }

          if (!flightObj) return null;
          const depRef = String((flightObj.departureAirport as { '@id'?: string })?.['@id'] || '');
          const arrRef = String((flightObj.arrivalAirport as { '@id'?: string })?.['@id'] || '');
          const depAirport = airports[depRef] || Object.values(airports)[0];
          const arrAirport = airports[arrRef] || Object.values(airports)[1];

          const depIso = String(flightObj.departureTime || '');
          const arrIso = String(flightObj.arrivalTime || '');
          const durIso = String(flightObj.estimatedFlightDuration || '');

          return {
            airline: String(airlineObj?.name || '').trim(),
            flightNumber: String(flightObj.flightNumber || flightNumber).trim().toUpperCase(),
            departureCode: depAirport?.iataCode || '',
            arrivalCode: arrAirport?.iataCode || '',
            depLat: depAirport?.lat,
            depLon: depAirport?.lon,
            arrLat: arrAirport?.lat,
            arrLon: arrAirport?.lon,
            depIso,
            arrIso,
            durIso,
          };
        })(),
        (async () => {
          const r = await fetch(`https://api.adsbdb.com/v0/callsign/${encodeURIComponent(flightNumber)}`, {
            headers: { 'User-Agent': 'WaynoteTravel/1.0' },
            signal: AbortSignal.timeout(5000),
          });
          if (!r.ok) return null;
          const json = (await r.json()) as {
            response?: {
              flightroute?: {
                callsign_iata?: string;
                airline?: { name?: string };
                origin?: { iata_code?: string; country_iso_name?: string; latitude?: number; longitude?: number };
                destination?: { iata_code?: string; country_iso_name?: string; latitude?: number; longitude?: number };
              };
            };
          };
          return json.response?.flightroute || null;
        })(),
      ]);

      const info = airportInfoRes.status === 'fulfilled' ? airportInfoRes.value : null;
      const adsb = adsbRes.status === 'fulfilled' ? adsbRes.value : null;

      const departureCode = (info?.departureCode || adsb?.origin?.iata_code || '').trim().toUpperCase();
      const arrivalCode = (info?.arrivalCode || adsb?.destination?.iata_code || '').trim().toUpperCase();

      if (departureCode && arrivalCode) {
        const depTime = info?.depIso?.match(/T(\d{2}:\d{2})/)?.[1] || '09:00';
        const arrTime = info?.arrIso?.match(/T(\d{2}:\d{2})/)?.[1] || '12:00';
        const depDatePart = info?.depIso?.slice(0, 10) || '';
        const arrDatePart = info?.arrIso?.slice(0, 10) || '';
        let arrivalDayDelta =
          depDatePart && arrDatePart
            ? Math.round((Date.parse(`${arrDatePart}T00:00:00Z`) - Date.parse(`${depDatePart}T00:00:00Z`)) / 86400000)
            : 0;

        const [resolvedDepOffset, resolvedArrOffset] = await Promise.all([
          resolveAirportOffsetHours(
            departureCode,
            date,
            adsb?.origin?.country_iso_name,
            info?.depLat ?? adsb?.origin?.latitude,
            info?.depLon ?? adsb?.origin?.longitude
          ),
          resolveAirportOffsetHours(
            arrivalCode,
            date,
            adsb?.destination?.country_iso_name,
            info?.arrLat ?? adsb?.destination?.latitude,
            info?.arrLon ?? adsb?.destination?.longitude
          ),
        ]);

        const departureOffsetHours = resolvedDepOffset;
        let arrivalOffsetHours = resolvedArrOffset;

        // Cross-check with exact scheduled local timestamps + flight duration when airportinfo provides both
        if (info?.depIso && info?.arrIso && info?.durIso && !AIRPORT_IANA_MAP[arrivalCode] && !airportTzCache.has(arrivalCode)) {
          const durMatch = info.durIso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
          if (durMatch) {
            const durMins = Number(durMatch[1] || 0) * 60 + Number(durMatch[2] || 0);
            const depFakeUtc = Date.parse(`${info.depIso}Z`);
            const arrFakeUtc = Date.parse(`${info.arrIso}Z`);
            if (!Number.isNaN(depFakeUtc) && !Number.isNaN(arrFakeUtc) && durMins > 0) {
              const localDiffMins = Math.round((arrFakeUtc - depFakeUtc) / 60000);
              const tzDiffHours = Math.round(((localDiffMins - durMins) / 60) * 2) / 2;
              const candidate = departureOffsetHours + tzDiffHours;
              if (candidate >= -12 && candidate <= 14) {
                arrivalOffsetHours = candidate;
              }
            }
          }
        }

        // Recompute nextDay accurately when only times (no full ISO dates) were present
        if (!depDatePart || !arrDatePart) {
          const [dh, dm] = depTime.split(':').map(Number);
          const [ah, am] = arrTime.split(':').map(Number);
          const depTotalUtc = dh * 60 + dm - departureOffsetHours * 60;
          const arrSameDayUtc = ah * 60 + am - arrivalOffsetHours * 60;
          if (arrSameDayUtc <= depTotalUtc) {
            arrivalDayDelta = 1;
          }
        }

        res.json({
          found: true,
          airline: info?.airline || adsb?.airline?.name || '',
          flightNumber: info?.flightNumber || adsb?.callsign_iata || flightNumber,
          departureCode,
          arrivalCode,
          departureTime: depTime,
          arrivalTime: arrTime,
          departureOffsetHours,
          arrivalOffsetHours,
          nextDay: arrivalDayDelta > 0,
          arrivalDayDelta,
        });
        return;
      }

      // Secondary fallback: Gemini Google Search grounding (if API key & search quota available)
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
      if (apiKey) {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
        });
        const gRes = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents:
            `查詢航班「${flightNumber}」（${date}）起降機場與時間，僅回傳純JSON：` +
            `{"found":true,"airline":"","flightNumber":"${flightNumber}","departureCode":"TPE","arrivalCode":"NRT","departureTime":"09:00","arrivalTime":"13:00","departureOffsetHours":8,"arrivalOffsetHours":9,"nextDay":false}，找不到回傳{"found":false}`,
          config: {
            tools: [{ googleSearch: {} }],
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            abortSignal: AbortSignal.timeout(15000),
          },
        });
        const match = (gRes.text || '').match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]) as {
            found?: boolean;
            airline?: string;
            flightNumber?: string;
            departureCode?: string;
            arrivalCode?: string;
            departureTime?: string;
            arrivalTime?: string;
            departureOffsetHours?: number;
            arrivalOffsetHours?: number;
            nextDay?: boolean;
          };
          if (parsed?.found && parsed.departureCode && parsed.arrivalCode) {
            const dCode = parsed.departureCode.trim().toUpperCase();
            const aCode = parsed.arrivalCode.trim().toUpperCase();
            const dTz = AIRPORT_IANA_MAP[dCode] ? getOffsetHoursForDate(AIRPORT_IANA_MAP[dCode], date) : null;
            const aTz = AIRPORT_IANA_MAP[aCode] ? getOffsetHoursForDate(AIRPORT_IANA_MAP[aCode], date) : null;
            res.json({
              ...parsed,
              departureCode: dCode,
              arrivalCode: aCode,
              departureOffsetHours: dTz ?? parsed.departureOffsetHours ?? 8,
              arrivalOffsetHours: aTz ?? parsed.arrivalOffsetHours ?? 8,
            });
            return;
          }
        }
      }

      res.status(404).json({ error: `找不到航班「${flightNumber}」的公開班表資訊，請確認航班編號或手動填寫。` });
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || String(err);
      console.error('[Waynote Flight Lookup] Error:', msg);
      res.status(404).json({ error: `目前無法查詢「${flightNumber}」班表資訊，請確認航班編號或手動填寫。` });
    }
  });

  app.post('/api/ai/plan-itinerary', async (req, res) => {
    const wantsNdjson = String(req.headers.accept || '').includes('application/x-ndjson');
    const sendError = (status: number, errorMsg: string) => {
      if (wantsNdjson) {
        if (!res.headersSent) {
          res.status(status).setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
        }
        res.write(JSON.stringify({ type: 'error', error: errorMsg }) + '\n');
        res.end();
      } else {
        res.status(status).json({ error: errorMsg });
      }
    };

    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
    if (!apiKey) {
      sendError(503, '伺服器尚未設定 GEMINI_API_KEY，無法使用 AI 行程規劃功能。');
      return;
    }

    const body = (req.body || {}) as {
      destination?: string;
      userPrompt?: string;
      mode?: 'single_day' | 'multi_day';
      daysCount?: number;
      startDate?: string;
      pace?: 'relaxed' | 'balanced' | 'packed';
      hotels?: string[];
      existingSummary?: string;
    };

    const destination = String(body.destination || '').trim().slice(0, 300);
    const userPrompt = String(body.userPrompt || '').trim().slice(0, 1500);
    if (!destination && !userPrompt) {
      sendError(400, '請至少輸入想前往的目的地或景點需求。');
      return;
    }

    const mode = body.mode === 'multi_day' ? 'multi_day' : 'single_day';
    const rawDays = Number(body.daysCount || (mode === 'multi_day' ? 3 : 1));
    const daysCount = mode === 'single_day' ? 1 : Math.min(10, Math.max(1, Math.round(rawDays)));
    const paceLabel =
      body.pace === 'relaxed'
        ? '悠閒慢活（每日約 3-4 站）'
        : body.pace === 'packed'
          ? '充實深度（每日約 5-6 站）'
          : '適中順暢（每日約 4-5 站）';
    const hotelList = Array.isArray(body.hotels)
      ? body.hotels.map((h) => String(h).trim()).filter(Boolean).slice(0, 5)
      : [];
    const existingSummary = String(body.existingSummary || '').trim().slice(0, 320);

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING, description: '簡潔行程摘要（1-2句，繁體中文）' },
        routeTip: { type: Type.STRING, description: '順路動線與大眾運輸建議（繁體中文）' },
        days: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              dayNumber: { type: Type.INTEGER },
              theme: { type: Type.STRING, description: '當日主題' },
              stops: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    time: { type: Type.STRING, description: 'HH:MM' },
                    title: { type: Type.STRING, description: '景點或餐廳名稱' },
                    location: { type: Type.STRING, description: 'Google Maps 地標與城市名' },
                    duration: { type: Type.STRING, description: '如 1h, 1.5h, 2h' },
                    type: { type: Type.STRING, enum: ['sightseeing', 'food', 'transport'] },
                    description: { type: Type.STRING, description: '精簡重點提示' },
                  },
                  required: ['time', 'title', 'location', 'duration', 'type', 'description'],
                },
              },
            },
            required: ['dayNumber', 'theme', 'stops'],
          },
        },
      },
      required: ['summary', 'routeTip', 'days'],
    };

    const userMessage = [
      `目的地（可為單一城市或多地串聯）：${destination || '依需求安排'}`,
      `規劃天數：${daysCount} 天（${mode === 'single_day' ? '單日行程' : '多日行程'}）`,
      body.startDate ? `起始日期：${body.startDate}` : '',
      `行程節奏：${paceLabel}`,
      hotelList.length > 0 ? `已訂住宿：${hotelList.join('、')}` : '',
      existingSummary ? `現有行程參考：${existingSummary}` : '',
      `用戶想去的地點與需求：${userPrompt || `規劃 ${destination} 最順路經典行程與在地美食`}`,
    ]
      .filter(Boolean)
      .join('\n');

    const systemInstruction =
      '你是精通各國動線規劃的台灣旅遊專家，請一律以台灣繁體中文簡潔精準作答。\n' +
      '原則：\n' +
      '1. 若用戶填寫多個目的地或景點，請依地理位置由近而遠串成順路不折返的動線（多日行程請合理分配至各天）。\n' +
      '2. location 請填「地標名, 城市名」以利 Google Maps 精準定位。\n' +
      '3. 回傳剛好指定天數的 days 陣列，每站時間 HH:MM 與時長（1h, 1.5h, 2h）須合理銜接，並包含早午餐、景點與晚餐。';

    const callModel = (model: string, thinkingLevel: ThinkingLevel, timeoutMs: number) =>
      ai.models.generateContent({
        model,
        contents: userMessage,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema,
          thinkingConfig: { thinkingLevel },
          abortSignal: AbortSignal.timeout(timeoutMs),
        },
      });

    let keepaliveTimer: ReturnType<typeof setInterval> | null = null;
    if (wantsNdjson) {
      res.status(200);
      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();
      res.write('{"type":"keepalive"}\n');
      keepaliveTimer = setInterval(() => {
        if (!res.writableEnded) {
          try {
            res.write('{"type":"keepalive"}\n');
          } catch {
            // ignore closed socket
          }
        }
      }, 1500);
    }

    try {
      let response;
      try {
        response = await callModel('gemini-3.1-flash-lite', ThinkingLevel.MINIMAL, 28000);
      } catch {
        response = await callModel('gemini-4-hydrogen', ThinkingLevel.LOW, 28000);
      }

      const rawText = (response.text || '')
        .trim()
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      if (!rawText) {
        sendError(502, 'AI 未回傳有效行程內容，請重試。');
        return;
      }

      const jsonBodyMatch = rawText.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonBodyMatch ? jsonBodyMatch[0] : rawText) as {
        summary?: string;
        routeTip?: string;
        days?: Array<{
          dayNumber?: number;
          theme?: string;
          stops?: Array<{
            time?: string;
            title?: string;
            location?: string;
            duration?: string;
            type?: string;
            description?: string;
          }>;
        }>;
      };

      const normalizedDays = (parsed.days || []).slice(0, daysCount).map((d, idx) => ({
        dayNumber: Number(d.dayNumber) || idx + 1,
        theme: String(d.theme || `${destination || '精選'} 第 ${idx + 1} 天`).trim(),
        stops: (d.stops || []).map((s, sIdx) => {
          const cleanTime = /^\d{1,2}:\d{2}$/.test(String(s.time || '').trim())
            ? String(s.time).trim().padStart(5, '0')
            : `${String(Math.min(21, 9 + sIdx * 2)).padStart(2, '0')}:00`;
          const rawType = String(s.type || '').toLowerCase();
          const cleanType: 'sightseeing' | 'food' | 'transport' =
            rawType === 'food' ? 'food' : rawType === 'transport' ? 'transport' : 'sightseeing';
          const rawDur = String(s.duration || '1.5h').trim();
          const cleanDur = /^\d+(\.\d+)?h$/i.test(rawDur) ? rawDur.toLowerCase() : '1.5h';

          return {
            time: cleanTime,
            title: String(s.title || `第 ${sIdx + 1} 站`).trim(),
            location: String(s.location || s.title || destination).trim(),
            duration: cleanDur,
            type: cleanType,
            description: String(s.description || '').trim(),
          };
        }),
      }));

      const resultPayload = {
        summary: String(parsed.summary || '').trim(),
        routeTip: String(parsed.routeTip || '').trim(),
        days: normalizedDays,
      };

      if (wantsNdjson) {
        res.write(JSON.stringify({ type: 'result', data: resultPayload }) + '\n');
        res.end();
      } else {
        res.json(resultPayload);
      }
    } catch (err: unknown) {
      console.error('[Waynote AI Planner] Error:', err);
      const e = err as { status?: number; message?: string };
      let status = typeof e?.status === 'number' && e.status >= 400 && e.status < 600 ? e.status : 500;
      let cleanMsg = e?.message || 'AI 行程規劃請求失敗，請稍後再試。';
      if (cleanMsg.startsWith('{')) {
        try {
          const nested = JSON.parse(cleanMsg) as { error?: { code?: number; message?: string; status?: string } };
          if (typeof nested?.error?.code === 'number' && nested.error.code >= 400 && nested.error.code < 600) {
            status = nested.error.code;
          }
          if (nested?.error?.message) {
            cleanMsg = nested.error.message;
          }
        } catch {
          // keep original message
        }
      }
      if (status === 503 || /high demand|UNAVAILABLE/i.test(cleanMsg)) {
        cleanMsg = 'AI 服務目前連線人數較多，請稍等數秒後再按一次規劃。';
      } else if (status === 429 || /quota|rate/i.test(cleanMsg)) {
        cleanMsg = 'AI 請求頻率過高，請稍候片刻再試。';
      } else if (/abort|timeout/i.test(cleanMsg)) {
        status = 504;
        cleanMsg = 'AI 規劃回應逾時，請稍後再按一次規劃。';
      }
      sendError(status, cleanMsg);
    } finally {
      if (keepaliveTimer) {
        clearInterval(keepaliveTimer);
        keepaliveTimer = null;
      }
    }
  });

  app.post('/api/ai/explore-spots', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
    if (!apiKey) {
      res.status(503).json({ error: '伺服器尚未設定 GEMINI_API_KEY，無法使用 AI 探索推薦功能。' });
      return;
    }

    const body = (req.body || {}) as {
      destination?: string;
      focusCategory?: string;
      excludeNames?: string[];
    };

    const destination = String(body.destination || '').trim().slice(0, 200);
    if (!destination) {
      res.status(400).json({ error: '缺少目的地城市資訊。' });
      return;
    }

    const focusCategory = String(body.focusCategory || 'all').trim();
    const excludeNames = Array.isArray(body.excludeNames)
      ? body.excludeNames.map((n) => String(n).trim()).filter(Boolean).slice(0, 25)
      : [];

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        spots: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: '實際存在且具體的景點、餐廳、咖啡廳或商店名稱（繁體中文）' },
              category: { type: Type.STRING, enum: ['sightseeing', 'food', 'cafe', 'shopping'] },
              area: { type: Type.STRING, description: '所在區域或地鐵站周邊（如 新宿、淺草、聖日耳曼）' },
              note: { type: Type.STRING, description: '特色亮點、推薦品項或避開人潮小提示（35字以內）' },
              estimatedCost: { type: Type.NUMBER, description: '當地幣別大致一人預估花費（免費填 0）' },
            },
            required: ['name', 'category', 'area', 'note', 'estimatedCost'],
          },
        },
      },
      required: ['spots'],
    };

    const categoryHint =
      focusCategory === 'food'
        ? '只推薦在地人氣美食與必吃名店'
        : focusCategory === 'cafe'
          ? '只推薦特色咖啡廳、甜點與下午茶'
          : focusCategory === 'shopping'
            ? '只推薦質感選物店、商場與伴手禮名產'
            : focusCategory === 'sightseeing'
              ? '只推薦經典必訪地標與深度風景秘境'
              : '均衡包含經典景點、在地美食、特色咖啡與逛街好去處';

    const prompt = [
      `目的地：${destination}`,
      `推薦類型：${categoryHint}`,
      `請精選 6 個真實存在且評價極高的具體地點。`,
      excludeNames.length > 0 ? `請避開以下已收錄地點：${excludeNames.join('、')}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const callExploreModel = (model: string, thinkingLevel: ThinkingLevel, timeoutMs: number) =>
      ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction:
            '你是熟門熟路的台灣旅遊顧問，一律以台灣繁體中文簡潔精準推薦真實存在的地點，絕不編造不存在的店名。',
          responseMimeType: 'application/json',
          responseSchema,
          thinkingConfig: { thinkingLevel },
          abortSignal: AbortSignal.timeout(timeoutMs),
        },
      });

    try {
      let response;
      try {
        response = await callExploreModel('gemini-3.1-flash-lite', ThinkingLevel.MINIMAL, 20000);
      } catch {
        response = await callExploreModel('gemini-4-hydrogen', ThinkingLevel.LOW, 22000);
      }

      const rawText = (response.text || '')
        .trim()
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      const jsonBodyMatch = rawText.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonBodyMatch ? jsonBodyMatch[0] : rawText) as {
        spots?: Array<{
          name?: string;
          category?: string;
          area?: string;
          note?: string;
          estimatedCost?: number;
        }>;
      };

      const spots = (parsed.spots || []).slice(0, 8).map((s) => {
        const rawCat = String(s.category || '').toLowerCase();
        const cat =
          rawCat === 'food' || rawCat === 'cafe' || rawCat === 'shopping' ? rawCat : 'sightseeing';
        return {
          name: String(s.name || '').trim(),
          category: cat as 'sightseeing' | 'food' | 'cafe' | 'shopping',
          area: String(s.area || destination).trim(),
          note: String(s.note || '').trim(),
          estimatedCost: Math.max(0, Number(s.estimatedCost) || 0),
        };
      }).filter((s) => s.name.length > 0);

      res.json({ spots });
    } catch (err: unknown) {
      console.error('[Waynote AI Explore] Error:', err);
      res.status(502).json({ error: '目前無法取得 AI 探索推薦，請稍後再試。' });
    }
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const syncId = normalizeSyncCode(url.searchParams.get('syncId') || '');
    const clientId = url.searchParams.get('clientId') || `client_${Date.now()}`;
    const deviceName = url.searchParams.get('deviceName') || 'Travel Device';

    if (!syncId) {
      ws.close(1008, 'Missing syncId');
      return;
    }

    if (!rooms.has(syncId)) {
      rooms.set(syncId, new Map());
    }
    const room = rooms.get(syncId)!;
    const now = Date.now();
    room.set(clientId, {
      ws,
      clientId,
      deviceName,
      connectedAt: now,
      lastSeenAt: now,
    });

    // Send initial authoritative state if available
    const currentTrip = tripsStore.get(syncId) || null;
    ws.send(
      JSON.stringify({
        type: 'sync:init',
        trip: currentTrip,
        devices: getRoomDevices(syncId),
      })
    );

    // Notify everyone in room of updated device list
    broadcastRoom(syncId, {
      type: 'presence:update',
      devices: getRoomDevices(syncId),
    });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        const r = rooms.get(syncId);
        const clientEntry = r?.get(clientId);
        if (clientEntry) clientEntry.lastSeenAt = Date.now();

        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
          return;
        }

        if (msg.type === 'presence:leave') {
          removeClient();
          try {
            ws.close(1000, 'leave');
          } catch {
            // ignore
          }
          return;
        }

        if (msg.type === 'trip:push' && msg.trip) {
          const merged = upsertAndMergeTrip(syncId, msg.trip as Trip);

          // Confirm to sender with canonical revision
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: 'sync:ack',
                revision: merged.revision,
                trip: merged,
              })
            );
          }

          // Broadcast merged state to all other connected devices in room
          broadcastRoom(
            syncId,
            {
              type: 'trip:remote_update',
              trip: merged,
              sourceClientId: clientId,
              sourceDeviceName: clientEntry?.deviceName || '另一台裝置',
              editedSection: typeof msg.editedSection === 'string' ? msg.editedSection : undefined,
            },
            clientId
          );
        }
      } catch (err) {
        console.error('[SkyTravel Sync] WS message error:', err);
      }
    });

    const removeClient = () => {
      const r = rooms.get(syncId);
      if (r) {
        const existing = r.get(clientId);
        if (existing && existing.ws === ws) {
          r.delete(clientId);
        }
        if (r.size === 0) {
          rooms.delete(syncId);
        } else {
          broadcastRoom(syncId, {
            type: 'presence:update',
            devices: getRoomDevices(syncId),
          });
        }
      }
    };

    ws.on('close', removeClient);
    ws.on('error', removeClient);
  });

  // Fast 500ms stale socket sweep for near-instant online device updates
  setInterval(() => {
    for (const syncId of Array.from(rooms.keys())) {
      const prevSize = rooms.get(syncId)?.size || 0;
      const room = pruneRoom(syncId);
      const nextSize = room?.size || 0;
      if (nextSize > 0 && nextSize !== prevSize) {
        broadcastRoom(syncId, {
          type: 'presence:update',
          devices: getRoomDevices(syncId),
        });
      }
    }
  }, 500);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Sky Travel server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
