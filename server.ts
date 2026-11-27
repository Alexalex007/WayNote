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
import { type AppLanguage, normalizeAppLanguage, tr } from './shared/i18n.ts';

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

function mapWmoWeather(code: number, lang: AppLanguage): { label: string; kind: WeatherKind } {
  if (code === 0) return { label: tr(lang, '晴朗無雲', '晴朗无云', 'Clear Sky'), kind: 'clear' };
  if (code === 1 || code === 2) return { label: tr(lang, '晴時多雲', '晴时多云', 'Partly Cloudy'), kind: 'partly' };
  if (code === 3) return { label: tr(lang, '陰天多雲', '阴天多云', 'Overcast'), kind: 'cloudy' };
  if (code === 45 || code === 48) return { label: tr(lang, '有霧／薄霧', '有雾／薄雾', 'Fog & Mist'), kind: 'fog' };
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return { label: tr(lang, '有雨／陣雨', '有雨／阵雨', 'Rain & Showers'), kind: 'rain' };
  }
  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return { label: tr(lang, '降雪／雨夾雪', '降雪／雨夹雪', 'Snow & Sleet'), kind: 'snow' };
  }
  if ([95, 96, 99].includes(code)) return { label: tr(lang, '雷陣雨', '雷阵雨', 'Thunderstorm'), kind: 'storm' };
  return { label: tr(lang, '多雲', '多云', 'Cloudy'), kind: 'partly' };
}

function mapMetNoSymbol(symbolCode: string, lang: AppLanguage): { label: string; kind: WeatherKind; isDay: boolean } {
  const s = (symbolCode || 'partlycloudy_day').toLowerCase();
  const isDay = !s.includes('night');
  if (s.includes('thunder')) return { label: tr(lang, '雷陣雨', '雷阵雨', 'Thunderstorm'), kind: 'storm', isDay };
  if (s.includes('snow') || s.includes('sleet')) return { label: tr(lang, '降雪／雨夾雪', '降雪／雨夹雪', 'Snow & Sleet'), kind: 'snow', isDay };
  if (s.includes('rain')) return { label: tr(lang, '有雨／陣雨', '有雨／阵雨', 'Rain & Showers'), kind: 'rain', isDay };
  if (s.includes('fog')) return { label: tr(lang, '有霧／薄霧', '有雾／薄雾', 'Fog & Mist'), kind: 'fog', isDay };
  if (s.startsWith('cloudy')) return { label: tr(lang, '陰天多雲', '阴天多云', 'Overcast'), kind: 'cloudy', isDay };
  if (s.startsWith('partlycloudy') || s.startsWith('fair')) {
    return { label: tr(lang, '晴時多雲', '晴时多云', 'Partly Cloudy'), kind: 'partly', isDay };
  }
  if (s.startsWith('clearsky')) return { label: tr(lang, '晴朗無雲', '晴朗无云', 'Clear Sky'), kind: 'clear', isDay };
  return { label: tr(lang, '晴時多雲', '晴时多云', 'Partly Cloudy'), kind: 'partly', isDay };
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
    const lang = normalizeAppLanguage(String(req.query.lang || 'zh-TW'));
    if (!rawCity) {
      res.status(400).json({ error: tr(lang, '缺少城市名稱', '缺少城市名称', 'Missing city name') });
      return;
    }

    const intel = detectDestinationIntel(rawCity, lang);
    const cacheKey = `${lang}::${rawCity.toLowerCase()}::${intel.cityQuery.toLowerCase()}`;
    const cached = weatherCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      res.json(cached.data);
      return;
    }

    try {
      const tryQueries = Array.from(new Set([rawCity.split(/\s*[-→>/,]\s*/)[0]?.trim() || rawCity, intel.cityQuery]));
      let location: { name: string; country?: string; latitude: number; longitude: number; timezone?: string } | null = null;

      for (const q of tryQueries) {
        const geoLang = lang === 'en' ? 'en' : 'zh';
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=${geoLang}&format=json`;
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
        res.status(404).json({
          error: tr(
            lang,
            `找不到「${rawCity}」的天氣座標`,
            `找不到「${rawCity}」的天气坐标`,
            `Could not find weather coordinates for "${rawCity}"`
          ),
        });
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

            const currentMeta = mapWmoWeather(w.current.weather_code, lang);
            const currentTimePrefix = w.current.time.slice(0, 13);
            let startHourIdx = w.hourly.time.findIndex((t) => t.startsWith(currentTimePrefix));
            if (startHourIdx < 0) startHourIdx = 0;

            const hourly = w.hourly.time.slice(startHourIdx, startHourIdx + 12).map((time, offset) => {
              const idx = startHourIdx + offset;
              const meta = mapWmoWeather(w.hourly.weather_code[idx] ?? 0, lang);
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
              const meta = mapWmoWeather(w.daily.weather_code[idx] ?? 0, lang);
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
              city: intel.displayCity || location.name,
              resolvedName: location.name,
              country: lang === 'en' ? (location.country || intel.countryLabel) : intel.countryLabel,
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
          res.status(502).json({ error: tr(lang, '無法取得即時氣象資料', '无法获取实时气象数据', 'Unable to fetch live weather data') });
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
          res.status(502).json({ error: tr(lang, '無法取得即時氣象資料', '无法获取实时气象数据', 'Unable to fetch live weather data') });
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
        const nowMeta = mapMetNoSymbol(nowSymbol, lang);
        const tempC = Math.round(nowDetails.air_temperature ?? 20);
        const windKmh = Math.round((nowDetails.wind_speed ?? 2) * 3.6);
        const humidity = Math.round(nowDetails.relative_humidity ?? 60);
        const precipMm = nowEntry.data.next_1_hours?.details?.precipitation_amount ?? 0;

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
          const meta = mapMetNoSymbol(sym, lang);
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
          const meta = mapMetNoSymbol(sym, lang);
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
              label: bucket.labels[pickIdx] || tr(lang, '晴時多雲', '晴时多云', 'Partly Cloudy'),
            };
          });

        payload = {
          city: intel.displayCity || location.name,
          resolvedName: location.name,
          country: lang === 'en' ? (location.country || intel.countryLabel) : intel.countryLabel,
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
      res.status(502).json({ error: tr(lang, '天氣服務暫時無法連線', '天气服务暂时无法连接', 'Weather service temporarily unavailable') });
    }
  });

  app.get('/api/destination-photo', async (req, res) => {
    const rawCity = String(req.query.city || '').trim();
    const lang = normalizeAppLanguage(String(req.query.lang || ''));
    if (!rawCity) {
      res.status(400).json({ error: tr(lang, '缺少城市名稱', '缺少城市名称', 'Missing city name') });
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
    const senderDeviceName = (req.body?.deviceName as string | undefined) || 'Partner Device';
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
      const lang = normalizeAppLanguage(
        String(req.headers['x-app-lang'] || req.query.lang || '')
      );
      try {
        ensureDataDir();
        const buf = req.body;
        if (!Buffer.isBuffer(buf) || buf.length === 0) {
          res.status(400).json({ error: tr(lang, '未收到有效檔案內容', '未收到有效文件内容', 'No valid file content received') });
          return;
        }
        if (buf.length > 22 * 1024 * 1024) {
          res.status(413).json({ error: tr(lang, '檔案大小超過 20MB 上限', '文件大小超过 20MB 上限', 'File exceeds the 20MB limit') });
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
        res.status(500).json({ error: tr(lang, '檔案儲存失敗，請稍後再試', '文件保存失败，请稍后重试', 'Failed to store file. Please try again shortly.') });
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
    const lang = normalizeAppLanguage(String(req.body?.lang || 'zh-TW'));
    const flightNumber = String(req.body?.flightNumber || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '');
    const date = String(req.body?.date || '').trim() || new Date().toISOString().slice(0, 10);
    if (!flightNumber || flightNumber.length < 3) {
      res.status(400).json({
        error: tr(
          lang,
          '請輸入正確的航班編號（例如 BR198、CX504）',
          '请输入正确的航班号（例如 BR198、CX504）',
          'Please enter a valid flight number (e.g. BR198, CX504)'
        ),
      });
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

      res.status(404).json({
        error: tr(
          lang,
          `找不到航班「${flightNumber}」的公開班表資訊，請確認航班編號或手動填寫。`,
          `找不到航班「${flightNumber}」的公开班表信息，请确认航班号或手动填写。`,
          `No public schedule found for flight ${flightNumber}. Verify the code or enter manually.`
        ),
      });
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || String(err);
      console.error('[Waynote Flight Lookup] Error:', msg);
      res.status(404).json({
        error: tr(
          lang,
          `目前無法查詢「${flightNumber}」班表資訊，請確認航班編號或手動填寫。`,
          `目前无法查询「${flightNumber}」班表信息，请确认航班号或手动填写。`,
          `Unable to look up schedule for ${flightNumber} right now. Please enter details manually.`
        ),
      });
    }
  });

  app.post('/api/ai/plan-itinerary', async (req, res) => {
    const wantsNdjson = String(req.headers.accept || '').includes('application/x-ndjson');
    const body = (req.body || {}) as {
      destination?: string;
      userPrompt?: string;
      mode?: 'single_day' | 'multi_day';
      daysCount?: number;
      startDate?: string;
      pace?: 'relaxed' | 'balanced' | 'packed';
      hotels?: string[];
      existingSummary?: string;
      lang?: string;
    };
    const lang = normalizeAppLanguage(body.lang);

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
      sendError(
        503,
        tr(
          lang,
          '伺服器尚未設定 GEMINI_API_KEY，無法使用 AI 行程規劃功能。',
          '服务器尚未配置 GEMINI_API_KEY，无法使用 AI 行程规划功能。',
          'AI itinerary planning is unavailable because GEMINI_API_KEY is not configured.'
        )
      );
      return;
    }

    const destination = String(body.destination || '').trim().slice(0, 300);
    const userPrompt = String(body.userPrompt || '').trim().slice(0, 1500);
    if (!destination && !userPrompt) {
      sendError(
        400,
        tr(
          lang,
          '請至少輸入想前往的目的地或景點需求。',
          '请至少输入想前往的目的地或景点需求。',
          'Please enter a destination or what you would like to visit.'
        )
      );
      return;
    }

    const mode = body.mode === 'multi_day' ? 'multi_day' : 'single_day';
    const rawDays = Number(body.daysCount || (mode === 'multi_day' ? 3 : 1));
    const daysCount = mode === 'single_day' ? 1 : Math.min(10, Math.max(1, Math.round(rawDays)));
    const paceLabel =
      body.pace === 'relaxed'
        ? tr(lang, '悠閒慢活（每日約 3-4 站）', '悠闲慢游（每日约 3-4 站）', 'Relaxed pace (3-4 stops/day)')
        : body.pace === 'packed'
          ? tr(lang, '充實深度（每日約 5-6 站）', '充实深度（每日约 5-6 站）', 'Packed pace (5-6 stops/day)')
          : tr(lang, '適中順暢（每日約 4-5 站）', '适中顺畅（每日约 4-5 站）', 'Balanced pace (4-5 stops/day)');
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

    const langRule = tr(
      lang,
      '台灣繁體中文（嚴禁出現簡體中文或多餘英文句子）',
      '中国大陆简体中文（严禁出现繁体中文或多余英文句子）',
      'crisp natural English ONLY (strictly zero Chinese characters anywhere)'
    );

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING, description: `Concise trip summary (1-2 sentences) strictly in ${langRule}` },
        routeTip: { type: Type.STRING, description: `Practical transit & route pacing tip strictly in ${langRule}` },
        days: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              dayNumber: { type: Type.INTEGER },
              theme: { type: Type.STRING, description: `Day theme title strictly in ${langRule}` },
              stops: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    time: { type: Type.STRING, description: 'HH:MM' },
                    title: { type: Type.STRING, description: `Attraction or restaurant name strictly in ${langRule}` },
                    location: { type: Type.STRING, description: `Landmark and city for Google Maps in ${langRule}` },
                    duration: { type: Type.STRING, description: 'e.g. 1h, 1.5h, 2h' },
                    type: { type: Type.STRING, enum: ['sightseeing', 'food', 'transport'] },
                    description: { type: Type.STRING, description: `Concise highlight tip strictly in ${langRule}` },
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
      `Destination: ${destination || 'Flexible'}`,
      `Duration: ${daysCount} day(s) (${mode === 'single_day' ? 'Single Day' : 'Multi-Day'})`,
      body.startDate ? `Start Date: ${body.startDate}` : '',
      `Pace: ${paceLabel}`,
      hotelList.length > 0 ? `Booked Hotels: ${hotelList.join(', ')}` : '',
      existingSummary ? `Existing Plans: ${existingSummary}` : '',
      `User Request: ${userPrompt || `Design a smooth classic route and local food stops for ${destination}`}`,
    ]
      .filter(Boolean)
      .join('\n');

    const systemInstruction =
      `You are an expert travel route planner. Output ALL text fields strictly in ${langRule}.\n` +
      'Rules:\n' +
      '1. Order stops geographically from near to far without backtracking across neighborhoods.\n' +
      '2. Format location as "Landmark, City" for accurate Google Maps pins.\n' +
      '3. Return exactly the requested number of days with realistic HH:MM times and durations (1h, 1.5h, 2h), including meals and sights.';

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

    const parseGeminiUpstreamError = (err: unknown, fallbackMsg: string): { status: number; message: string } => {
      const e = err as { status?: number; message?: string };
      let status = typeof e?.status === 'number' && e.status >= 400 && e.status < 600 ? e.status : 500;
      let cleanMsg = e?.message || fallbackMsg;
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
      if (status === 402 || /prepayment credits|credits are depleted|billing/i.test(cleanMsg)) {
        status = 402;
        cleanMsg = tr(
          lang,
          'AI 額度目前不足（預付點數已用完），請前往 Google AI Studio 專案設定補充額度或切換帳單金鑰。',
          'AI 额度当前不足（预付点数已用完），请前往 Google AI Studio 项目设置补充额度或切换账单密钥。',
          'Gemini API prepayment credits are depleted. Please check your project billing in Google AI Studio.'
        );
      } else if (status === 403 || /PERMISSION_DENIED|API_KEY_INVALID|API key not valid/i.test(cleanMsg)) {
        status = status === 400 ? 400 : 403;
        cleanMsg = tr(
          lang,
          'GEMINI_API_KEY 無效或沒有權限，請在「Settings > Secrets」檢查金鑰設定。',
          'GEMINI_API_KEY 无效或没有权限，请在「Settings > Secrets」检查密钥设置。',
          'Invalid or unauthorized GEMINI_API_KEY. Please check Settings > Secrets.'
        );
      } else if (status === 503 || /high demand|UNAVAILABLE/i.test(cleanMsg)) {
        status = 503;
        cleanMsg = tr(
          lang,
          'AI 服務目前連線人數較多，請稍等數秒後再試一次。',
          'AI 服务当前请求较多，请稍等几秒后重试。',
          'AI service is busy right now. Please wait a few seconds and try again.'
        );
      } else if (status === 429 || /quota|rate|RESOURCE_EXHAUSTED/i.test(cleanMsg)) {
        status = 429;
        cleanMsg = tr(
          lang,
          'AI 請求頻率過高或已達配額上限，請稍候片刻再試。',
          'AI 请求频率过高或已达配额上限，请稍候片刻再试。',
          'AI rate limit or quota reached. Please wait a moment and try again.'
        );
      } else if (/abort|timeout/i.test(cleanMsg)) {
        status = 504;
        cleanMsg = tr(
          lang,
          'AI 回應逾時，請稍後再試一次。',
          'AI 响应超时，请稍后再试一次。',
          'AI request timed out. Please try again.'
        );
      }
      return { status, message: cleanMsg };
    };

    try {
      let response;
      try {
        response = await callModel('gemini-3.1-flash-lite', ThinkingLevel.MINIMAL, 28000);
      } catch (primaryErr: unknown) {
        const pStatus = (primaryErr as { status?: number })?.status;
        if (pStatus === 400 || pStatus === 401 || pStatus === 402 || pStatus === 403) {
          throw primaryErr;
        }
        response = await callModel('gemini-4-hydrogen', ThinkingLevel.LOW, 28000);
      }

      const rawText = (response.text || '')
        .trim()
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      if (!rawText) {
        sendError(502, tr(lang, 'AI 未回傳有效行程內容，請重試。', 'AI 未返回有效行程内容，请重试。', 'AI did not return a valid itinerary. Please try again.'));
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
        theme: String(
          d.theme ||
            tr(
              lang,
              `${destination || '精選'} 第 ${idx + 1} 天`,
              `${destination || '精选'} 第 ${idx + 1} 天`,
              `${destination || 'Curated'} Day ${idx + 1}`
            )
        ).trim(),
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
            title: String(s.title || tr(lang, `第 ${sIdx + 1} 站`, `第 ${sIdx + 1} 站`, `Stop ${sIdx + 1}`)).trim(),
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
      const parsedErr = parseGeminiUpstreamError(
        err,
        tr(lang, 'AI 行程規劃請求失敗，請稍後再試。', 'AI 行程规划请求失败，请稍后再试。', 'AI planning request failed. Please try again shortly.')
      );
      sendError(parsedErr.status, parsedErr.message);
    } finally {
      if (keepaliveTimer) {
        clearInterval(keepaliveTimer);
        keepaliveTimer = null;
      }
    }
  });

  app.post('/api/ai/explore-spots', async (req, res) => {
    const body = (req.body || {}) as {
      destination?: string;
      focusCategory?: string;
      excludeNames?: string[];
      batchSeed?: number;
      lang?: string;
    };
    const lang = normalizeAppLanguage(body.lang);

    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
    if (!apiKey) {
      res.status(503).json({
        error: tr(
          lang,
          '伺服器尚未設定 GEMINI_API_KEY，無法使用 AI 探索推薦功能。',
          '服务器尚未配置 GEMINI_API_KEY，无法使用 AI 探索推荐功能。',
          'AI Explore is unavailable because GEMINI_API_KEY is not configured.'
        ),
      });
      return;
    }

    const destination = String(body.destination || '').trim().slice(0, 200);
    if (!destination) {
      res.status(400).json({ error: tr(lang, '缺少目的地城市資訊。', '缺少目的地城市信息。', 'Missing destination city.') });
      return;
    }

    const rawFocus = String(body.focusCategory || 'sightseeing').trim().toLowerCase();
    const focusCategory: 'sightseeing' | 'food' | 'shopping' =
      rawFocus === 'food' || rawFocus === 'cafe'
        ? 'food'
        : rawFocus === 'shopping'
          ? 'shopping'
          : 'sightseeing';

    const excludeNames = Array.isArray(body.excludeNames)
      ? body.excludeNames.map((n) => String(n).trim()).filter(Boolean).slice(-140)
      : [];
    const batchSeed = Math.max(1, Number(body.batchSeed) || 1);

    const normalizeSpotKey = (name: string) =>
      name
        .toLowerCase()
        .replace(/[\s・·\-—–_()（）[\]【】「」『』.,/]+/g, '')
        .trim();

    const excludedKeys = new Set(excludeNames.map(normalizeSpotKey).filter(Boolean));

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const langRule = tr(
      lang,
      '台灣繁體中文（嚴禁簡體中文）',
      '中国大陆简体中文（严禁繁体中文）',
      'English ONLY (strictly zero Chinese characters)'
    );

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        spots: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: `Real, specific place name strictly in ${langRule}` },
              category: { type: Type.STRING, enum: [focusCategory] },
              area: { type: Type.STRING, description: `Neighborhood or transit station area strictly in ${langRule}` },
              note: { type: Type.STRING, description: `Highlights and tips (under 35 words/chars) strictly in ${langRule}` },
              estimatedCost: { type: Type.NUMBER, description: 'Rough per-person spend in local currency (0 if free)' },
            },
            required: ['name', 'category', 'area', 'note', 'estimatedCost'],
          },
        },
      },
      required: ['spots'],
    };

    const categoryHint =
      focusCategory === 'food'
        ? 'ONLY restaurants, local specialties, street food, cafes, coffee roasters, bakeries, and dessert shops. STRICTLY EXCLUDE museums, temples, parks, scenic viewpoints, clothing/shopping malls.'
        : focusCategory === 'shopping'
          ? 'ONLY shopping streets, department stores, boutiques, select shops, markets, vintage/craft stores, and souvenir shops. STRICTLY EXCLUDE scenic parks, temples, viewpoints, or standalone restaurants/cafes.'
          : 'ONLY scenic spots, natural landscapes, viewpoints, observation decks, parks, gardens, shrines, temples, castles, historic landmarks, waterfronts, and museums. STRICTLY EXCLUDE cafes, coffee shops, bakeries, dessert shops, restaurants, bars, izakayas, ramen shops, or shopping malls.';

    const explorationAngles = [
      'Prioritize iconic sights and well-loved neighborhoods across distinct transit lines',
      'Focus on less-touristy hidden gems, artisan alleys, waterfront promenades, and architectural highlights',
      'Explore sunset viewpoints, traditional historic districts, and lesser-known cultural sanctuaries',
      'Discover distinct neighborhoods outside the main central station hub with high traveler ratings',
    ];
    const angleHint = explorationAngles[(batchSeed - 1) % explorationAngles.length];

    const prompt = [
      `Destination: ${destination}`,
      `Strict Category Requirement (${focusCategory}): ${categoryHint}`,
      `Exploration Angle (Batch #${batchSeed}): ${angleHint}.`,
      `Curate 16 real, existing, highly rated places strictly matching "${focusCategory}" across diverse neighborhoods, with zero duplicates.`,
      excludeNames.length > 0
        ? `FORBIDDEN LIST (never repeat these or slight name variants/abbreviations):\n${excludeNames.join(' | ')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    const callExploreModel = (model: string, thinkingLevel: ThinkingLevel, timeoutMs: number) =>
      ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction:
            `You are a hyper-accurate travel curator. Output ALL text strictly in ${langRule}. ` +
            `Every single spot MUST strictly belong to category "${focusCategory}" — never mix cafes or restaurants into sightseeing, and never mix landmarks into food or shopping. Never invent fake places and never repeat any item in the forbidden list.`,
          responseMimeType: 'application/json',
          responseSchema,
          thinkingConfig: { thinkingLevel },
          abortSignal: AbortSignal.timeout(timeoutMs),
        },
      });

    // Strict server-side contamination guards per category
    const matchesStrictCategory = (spot: { name: string; note: string }): boolean => {
      const text = `${spot.name} ${spot.note}`.toLowerCase();
      if (focusCategory === 'sightseeing') {
        const cafeFoodRe =
          /(咖啡廳|咖啡厅|咖啡店|咖啡館|咖啡馆|手沖咖啡|手冲咖啡|精品咖啡|甜點|甜品|蛋糕店|烘焙|麵包店|面包店|下午茶|早午餐|拉麵|拉面|燒肉|烧肉|居酒屋|壽司店|寿司店|餐廳|餐厅|食堂|火鍋|火锅|bistro|izakaya|patisserie|bakery|roastery|brunch|espresso|latte|\bcafe\b|\bcoffee\b|\brestaurant\b)/i;
        const scenicAnchorRe =
          /(公園|公园|神社|寺|神宮|神宫|城|展望|塔|觀景|观景|海岸|海濱|海滨|湖|山|峽谷|峡谷|橋|桥|美術館|美术馆|博物館|博物馆|庭園|庭园|老街|竹林|遺跡|遗址|park|shrine|temple|castle|observatory|tower|museum|garden|beach|lake|mountain|bridge|palace|cathedral)/i;
        if (cafeFoodRe.test(text) && !scenicAnchorRe.test(spot.name.toLowerCase())) {
          return false;
        }
      } else if (focusCategory === 'shopping') {
        const diningOnlyRe = /(居酒屋|拉麵|拉面|火鍋|火锅|燒肉|烧肉|早午餐|izakaya|\bramen\b)/i;
        const shopAnchorRe = /(百貨|百货|商場|商场|選物|选物|商店街|市場|市场|伴手禮|伴手礼|免稅|免税|藥妝|药妆|mall|market|outlet|store|shop|boutique|department|street)/i;
        if (diningOnlyRe.test(text) && !shopAnchorRe.test(spot.name.toLowerCase())) {
          return false;
        }
      }
      return true;
    };

    try {
      let response;
      try {
        response = await callExploreModel('gemini-4-hydrogen', ThinkingLevel.LOW, 24000);
      } catch (primaryErr: unknown) {
        const pStatus = (primaryErr as { status?: number })?.status;
        if (pStatus === 400 || pStatus === 401 || pStatus === 402 || pStatus === 403) {
          throw primaryErr;
        }
        response = await callExploreModel('gemini-3.1-flash-lite', ThinkingLevel.MINIMAL, 22000);
      }

      const rawText = (response.text || '')
        .trim()
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      if (!rawText) {
        res.status(502).json({
          error: tr(lang, 'AI 未回傳推薦地點，請重試。', 'AI 未返回推荐地点，请重试。', 'AI returned no recommendations. Please try again.'),
        });
        return;
      }

      const jsonObjMatch = rawText.match(/\{[\s\S]*\}/);
      const jsonArrMatch = rawText.match(/\[[\s\S]*\]/);
      const rawParsed = JSON.parse(jsonObjMatch ? jsonObjMatch[0] : jsonArrMatch ? jsonArrMatch[0] : rawText) as
        | { spots?: Array<{ name?: string; category?: string; area?: string; note?: string; estimatedCost?: number }> }
        | Array<{ name?: string; category?: string; area?: string; note?: string; estimatedCost?: number }>;

      const rawSpotsList = Array.isArray(rawParsed) ? rawParsed : Array.isArray(rawParsed?.spots) ? rawParsed.spots : [];

      const seenBatchKeys = new Set<string>();
      const dedupedCandidates = rawSpotsList
        .map((s) => ({
          name: String(s.name || '').trim(),
          category: focusCategory,
          area: String(s.area || destination).trim(),
          note: String(s.note || '').trim(),
          estimatedCost: Math.max(0, Number(s.estimatedCost) || 0),
        }))
        .filter((s) => {
          if (!s.name) return false;
          const key = normalizeSpotKey(s.name);
          if (!key) return false;
          if (seenBatchKeys.has(key)) return false;
          if (excludedKeys.has(key)) return false;
          for (const exKey of excludedKeys) {
            if (exKey.length >= 3 && key.length >= 3 && (exKey.includes(key) || key.includes(exKey))) {
              return false;
            }
          }
          seenBatchKeys.add(key);
          return true;
        });

      const strictFiltered = dedupedCandidates.filter(matchesStrictCategory);
      const spots = (strictFiltered.length >= 6 ? strictFiltered : dedupedCandidates).slice(0, 10);

      res.json({ spots });
    } catch (err: unknown) {
      console.error('[Waynote AI Explore] Error:', err);
      const e = err as { status?: number; message?: string };
      let status = typeof e?.status === 'number' && e.status >= 400 && e.status < 600 ? e.status : 502;
      let cleanMsg = e?.message || '';
      if (cleanMsg.startsWith('{')) {
        try {
          const nested = JSON.parse(cleanMsg) as { error?: { code?: number; message?: string } };
          if (typeof nested?.error?.code === 'number' && nested.error.code >= 400 && nested.error.code < 600) {
            status = nested.error.code;
          }
          if (nested?.error?.message) {
            cleanMsg = nested.error.message;
          }
        } catch {
          // keep original
        }
      }
      if (status === 402 || /prepayment credits|credits are depleted|billing/i.test(cleanMsg)) {
        status = 402;
        cleanMsg = tr(
          lang,
          'AI 額度目前不足（預付點數已用完），請前往 Google AI Studio 專案設定補充額度或切換帳單金鑰。',
          'AI 额度当前不足（预付点数已用完），请前往 Google AI Studio 项目设置补充额度或切换账单密钥。',
          'Gemini API prepayment credits are depleted. Please check your project billing in Google AI Studio.'
        );
      } else if (status === 403 || /PERMISSION_DENIED|API_KEY_INVALID|API key not valid/i.test(cleanMsg)) {
        status = status === 400 ? 400 : 403;
        cleanMsg = tr(
          lang,
          'GEMINI_API_KEY 無效或沒有權限，請在「Settings > Secrets」檢查金鑰設定。',
          'GEMINI_API_KEY 无效或没有权限，请在「Settings > Secrets」检查密钥设置。',
          'Invalid or unauthorized GEMINI_API_KEY. Please check Settings > Secrets.'
        );
      } else if (status === 429 || /quota|rate|RESOURCE_EXHAUSTED/i.test(cleanMsg)) {
        status = 429;
        cleanMsg = tr(
          lang,
          'AI 請求頻率過高或已達配額上限，請稍候片刻再試。',
          'AI 请求频率过高或已达配额上限，请稍候片刻再试。',
          'AI rate limit or quota reached. Please wait a moment and try again.'
        );
      } else if (status === 503 || /high demand|UNAVAILABLE/i.test(cleanMsg)) {
        status = 503;
        cleanMsg = tr(
          lang,
          'AI 服務目前連線人數較多，請稍等數秒後再試一次。',
          'AI 服务当前请求较多，请稍等几秒后重试。',
          'AI service is busy right now. Please wait a few seconds and try again.'
        );
      } else if (/abort|timeout/i.test(cleanMsg)) {
        status = 504;
        cleanMsg = tr(
          lang,
          'AI 探索回應逾時，請稍後再試一次。',
          'AI 探索响应超时，请稍后再试一次。',
          'AI Explore timed out. Please try again.'
        );
      } else if (!cleanMsg) {
        cleanMsg = tr(
          lang,
          '目前無法取得 AI 探索推薦，請稍後再試。',
          '目前无法获取 AI 探索推荐，请稍后再试。',
          'Unable to load AI Explore recommendations right now. Please try again.'
        );
      }
      res.status(status).json({ error: cleanMsg });
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
              sourceDeviceName: clientEntry?.deviceName || 'Partner Device',
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
