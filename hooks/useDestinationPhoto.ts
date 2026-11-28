import { useEffect, useState } from 'react';

export interface DestinationPhotoData {
  city: string;
  resolvedName: string;
  country: string;
  imageUrl: string | null;
  title: string | null;
}

const CLIENT_PHOTO_CACHE = new Map<string, DestinationPhotoData>();
const IN_FLIGHT_LOOKUPS = new Map<string, Promise<DestinationPhotoData>>();
const STORAGE_PHOTO_CACHE_KEY = 'waynote_photo_cache_v5';
const PHOTO_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface StoredPhotoEntry {
  expiresAt: number;
  data: DestinationPhotoData;
}

let hydrated = false;
function ensureHydrated() {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  try {
    localStorage.removeItem('waynote_photo_cache_v1');
    localStorage.removeItem('waynote_photo_cache_v2');
    localStorage.removeItem('waynote_photo_cache_v3');
    localStorage.removeItem('waynote_photo_cache_v4');
    const raw = localStorage.getItem(STORAGE_PHOTO_CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, StoredPhotoEntry>;
    const now = Date.now();
    for (const [k, entry] of Object.entries(parsed)) {
      if (entry && entry.expiresAt > now && entry.data?.imageUrl) {
        CLIENT_PHOTO_CACHE.set(k, entry.data);
      }
    }
  } catch {
    // ignore corrupt cache
  }
}

function persistClientPhoto(cacheKey: string, data: DestinationPhotoData) {
  if (typeof window === 'undefined' || !data.imageUrl) return;
  try {
    const raw = localStorage.getItem(STORAGE_PHOTO_CACHE_KEY);
    const parsed: Record<string, StoredPhotoEntry> = raw ? JSON.parse(raw) : {};
    const now = Date.now();
    const cleaned: Record<string, StoredPhotoEntry> = {};
    let count = 0;
    for (const [k, v] of Object.entries(parsed)) {
      if (v && v.expiresAt > now && v.data?.imageUrl && count < 60) {
        cleaned[k] = v;
        count += 1;
      }
    }
    cleaned[cacheKey] = {
      expiresAt: now + PHOTO_TTL_MS,
      data,
    };
    localStorage.setItem(STORAGE_PHOTO_CACHE_KEY, JSON.stringify(cleaned));
  } catch {
    // ignore storage quota errors
  }
}

const LOADED_IMAGE_URLS = new Set<string>();

export function isImageUrlLoaded(url?: string | null): boolean {
  return Boolean(url && LOADED_IMAGE_URLS.has(url));
}

export function markImageUrlLoaded(url?: string | null) {
  if (url) LOADED_IMAGE_URLS.add(url);
}

function preloadImageUrl(url?: string | null) {
  if (!url || typeof Image === 'undefined' || LOADED_IMAGE_URLS.has(url)) return;
  const img = new Image();
  img.referrerPolicy = 'no-referrer';
  img.decoding = 'async';
  img.onload = () => {
    LOADED_IMAGE_URLS.add(url);
  };
  img.src = url;
}

const SCENIC_GRADIENTS = [
  'linear-gradient(135deg, #3B4CCA 0%, #6B7BFF 48%, #F4A28C 100%)',
  'linear-gradient(135deg, #1E3A5F 0%, #3B7A9E 52%, #E8B89A 100%)',
  'linear-gradient(135deg, #4338CA 0%, #6366F1 50%, #38BDF8 100%)',
  'linear-gradient(135deg, #0F766E 0%, #2563EB 58%, #A5B4FC 100%)',
  'linear-gradient(135deg, #7C3AED 0%, #4F46E5 50%, #FB7185 100%)',
  'linear-gradient(135deg, #1D4ED8 0%, #0EA5E9 55%, #FDE68A 100%)',
];

export function getCityAccentGradient(city?: string | null): string {
  const key = (city || 'waynote').trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return SCENIC_GRADIENTS[hash % SCENIC_GRADIENTS.length];
}

export async function fetchDestinationPhotoFast(cleaned: string): Promise<DestinationPhotoData> {
  ensureHydrated();
  const cacheKey = cleaned.toLowerCase();
  const cached = CLIENT_PHOTO_CACHE.get(cacheKey);
  if (cached?.imageUrl) {
    preloadImageUrl(cached.imageUrl);
    return cached;
  }

  const existingPromise = IN_FLIGHT_LOOKUPS.get(cacheKey);
  if (existingPromise) return existingPromise;

  const promise = (async () => {
    try {
      const res = await fetch(`/api/destination-photo?city=${encodeURIComponent(cleaned)}`);
      if (!res.ok) throw new Error('Photo lookup failed');
      const json = (await res.json()) as DestinationPhotoData;
      if (json.imageUrl) {
        CLIENT_PHOTO_CACHE.set(cacheKey, json);
        persistClientPhoto(cacheKey, json);
        preloadImageUrl(json.imageUrl);
      }
      return json;
    } catch {
      return {
        city: cleaned,
        resolvedName: cleaned,
        country: '',
        imageUrl: null,
        title: null,
      };
    } finally {
      IN_FLIGHT_LOOKUPS.delete(cacheKey);
    }
  })();

  IN_FLIGHT_LOOKUPS.set(cacheKey, promise);
  return promise;
}

export function useDestinationPhoto(city?: string | null, debounceMs = 150) {
  ensureHydrated();
  const cleaned = (city || '').split(/\s*[-→>/,]\s*/)[0]?.trim() || '';
  const cacheKey = cleaned.toLowerCase();
  const syncCached = cacheKey ? CLIENT_PHOTO_CACHE.get(cacheKey) || null : null;

  const [asyncResult, setAsyncResult] = useState<{ key: string; data: DestinationPhotoData } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!cleaned) {
      setLoading(false);
      return;
    }
    const existing = CLIENT_PHOTO_CACHE.get(cacheKey);
    if (existing?.imageUrl) {
      preloadImageUrl(existing.imageUrl);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      const result = await fetchDestinationPhotoFast(cleaned);
      if (!cancelled) {
        setAsyncResult({ key: cacheKey, data: result });
        setLoading(false);
      }
    }, debounceMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [cleaned, cacheKey, debounceMs]);

  const data = syncCached || (asyncResult?.key === cacheKey ? asyncResult.data : null);

  return { data, loading };
}
