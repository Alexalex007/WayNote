import React, { useEffect, useMemo, useRef, useState } from 'react';
import { geoMercator, geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Feature, Geometry } from 'geojson';
import worldAtlas50m from 'world-atlas/countries-50m.json';

interface GeoTarget {
  lng: number;
  lat: number;
  countryId?: string;
  spanDeg: number;
}

const CITY_GEO_MAP: Array<[string[], GeoTarget]> = [
  // Japan (ISO 392)
  [['東京', '东京', 'tokyo', '新宿', '澀谷', '涩谷', '淺草', '浅草', '銀座', '银座', '羽田', '成田', '箱根', '鎌倉', '镰仓', '河口湖', '富士山', '橫濱', '横滨', '日光', '輕井澤', '轻井泽'], { lng: 139.6917, lat: 35.6895, countryId: '392', spanDeg: 11.5 }],
  [['大阪', 'osaka', '難波', '难波', '心齋橋', '心斋桥', '梅田', '關西', '关西'], { lng: 135.5023, lat: 34.6937, countryId: '392', spanDeg: 11 }],
  [['京都', 'kyoto', '嵐山', '岚山', '宇治', '奈良'], { lng: 135.7681, lat: 35.0116, countryId: '392', spanDeg: 11 }],
  [['札幌', '北海道', 'sapporo', 'hokkaido', '小樽', '富良野', '函館', '函馆'], { lng: 141.3545, lat: 43.0618, countryId: '392', spanDeg: 12 }],
  [['沖繩', '冲绳', '那霸', 'okinawa', 'naha'], { lng: 127.6792, lat: 26.2124, countryId: '392', spanDeg: 7.5 }],
  [['福岡', '福冈', 'fukuoka', '九州', '由布院', '熊本', '長崎', '长崎', '鹿兒島', '鹿儿岛'], { lng: 130.4017, lat: 33.5902, countryId: '392', spanDeg: 10.5 }],
  [['名古屋', 'nagoya', '白川鄉', '白川乡', '金澤', '金泽', '合掌村'], { lng: 136.9066, lat: 35.1815, countryId: '392', spanDeg: 11 }],
  [['仙台', 'sendai', '廣島', '广岛', 'hiroshima', '神戶', '神户', 'kobe', '日本', 'japan'], { lng: 138.2529, lat: 36.2048, countryId: '392', spanDeg: 12 }],

  // Taiwan (ISO 158)
  [['台北', '臺北', '新北', '桃園', '桃园', '基隆', '九份', '淡水', '宜蘭', '宜兰', 'taipei', 'taiwan', '台灣'], { lng: 121.5654, lat: 24.45, countryId: '158', spanDeg: 4.2 }],
  [['台中', '臺中', 'taichung', '日月潭', '南投', '阿里山'], { lng: 120.6736, lat: 24.1477, countryId: '158', spanDeg: 4.2 }],
  [['台南', '臺南', 'tainan', '高雄', 'kaohsiung', '墾丁', '垦丁', '花蓮', '花莲', '台東', '台东'], { lng: 120.45, lat: 23.1, countryId: '158', spanDeg: 4.4 }],

  // Korea (ISO 410)
  [['首爾', '首尔', 'seoul', '仁川', '弘大', '明洞', '韓國', '韩国', 'korea'], { lng: 127.3, lat: 36.8, countryId: '410', spanDeg: 6.2 }],
  [['釜山', 'busan'], { lng: 128.6, lat: 35.4, countryId: '410', spanDeg: 6.2 }],
  [['濟州', '济州', 'jeju'], { lng: 126.5312, lat: 33.4996, countryId: '410', spanDeg: 5.5 }],

  // Hong Kong / Macau / Mainland China (ISO 156)
  [['香港', 'hong kong', '澳門', '澳门', 'macau', 'macao'], { lng: 114.1694, lat: 22.3193, countryId: '156', spanDeg: 5.2 }],
  [['上海', 'shanghai', '蘇州', '苏州', '烏鎮', '乌镇', '杭州', 'hangzhou', '南京'], { lng: 120.8, lat: 30.8, countryId: '156', spanDeg: 14 }],
  [['北京', 'beijing', '長城', '长城', 'great wall', '哈爾濱', '哈尔滨'], { lng: 116.4074, lat: 39.9042, countryId: '156', spanDeg: 16 }],
  [['成都', 'chengdu', '重慶', '重庆', '九寨溝', '九寨沟', '西安'], { lng: 104.0665, lat: 30.5728, countryId: '156', spanDeg: 16 }],
  [['廣州', '广州', '深圳', '珠海', '廈門', '厦门', '桂林', '麗江', '丽江', '三亞', '三亚'], { lng: 113.2644, lat: 23.1291, countryId: '156', spanDeg: 15 }],

  // Southeast Asia
  [['曼谷', 'bangkok', '泰國', '泰国', 'thailand'], { lng: 100.5018, lat: 13.7563, countryId: '764', spanDeg: 11 }],
  [['清邁', '清迈', 'chiang mai', '普吉', 'phuket', '蘇美島', '苏梅岛'], { lng: 99.5, lat: 16.5, countryId: '764', spanDeg: 11 }],
  [['新加坡', 'singapore'], { lng: 103.8198, lat: 1.3521, countryId: '702', spanDeg: 4.5 }],
  [['吉隆坡', 'kuala lumpur', '檳城', '槟城', '沙巴', '馬來西亞', '马来西亚', 'malaysia'], { lng: 101.6869, lat: 3.139, countryId: '458', spanDeg: 11 }],
  [['胡志明', '河內', '河内', 'hanoi', '峴港', '岘港', '越南', 'vietnam', '富國島', '富国岛'], { lng: 106.2, lat: 16.5, countryId: '704', spanDeg: 12 }],
  [['峇里島', '巴厘岛', 'bali', '雅加達', '雅加达', '印尼', 'indonesia'], { lng: 115.1889, lat: -8.4095, countryId: '360', spanDeg: 12 }],
  [['馬尼拉', '马尼拉', '宿霧', '宿务', '長灘島', '长滩岛', '菲律賓', '菲律宾', 'manila', 'cebu'], { lng: 121.5, lat: 13.5, countryId: '608', spanDeg: 11 }],

  // Europe
  [['巴黎', 'paris', '尼斯', '里昂', '法國', '法国', 'france'], { lng: 2.3522, lat: 47.6, countryId: '250', spanDeg: 11.5 }],
  [['倫敦', '伦敦', 'london', '愛丁堡', '爱丁堡', '曼徹斯特', '曼彻斯特', '英國', '英国', 'uk', 'england'], { lng: -1.5, lat: 52.8, countryId: '826', spanDeg: 9.5 }],
  [['羅馬', '罗马', 'rome', '米蘭', '米兰', 'milan', '威尼斯', 'venice', '佛羅倫斯', '佛罗伦萨', '義大利', '意大利', 'italy'], { lng: 12.4964, lat: 42.5, countryId: '380', spanDeg: 11 }],
  [['巴塞隆納', '巴塞罗那', 'barcelona', '馬德里', '马德里', 'madrid', '西班牙', 'spain'], { lng: -2.5, lat: 40.5, countryId: '724', spanDeg: 11.5 }],
  [['阿姆斯特丹', 'amsterdam', '荷蘭', '荷兰', '布魯日', '布鲁日'], { lng: 4.9041, lat: 52.2, countryId: '528', spanDeg: 6.5 }],
  [['蘇黎世', '苏黎世', 'zurich', '日內瓦', '日内瓦', '策馬特', '采尔马特', '因特拉肯', '瑞士', 'switzerland'], { lng: 8.3, lat: 46.8, countryId: '756', spanDeg: 6.5 }],
  [['慕尼黑', 'munich', '柏林', 'berlin', '法蘭克福', '法兰克福', '德國', '德国', 'germany'], { lng: 10.5, lat: 50.5, countryId: '276', spanDeg: 10 }],
  [['維也納', '维也纳', 'vienna', '薩爾斯堡', '萨尔茨堡', '哈修塔特', '哈尔施塔特', '奧地利', '奥地利'], { lng: 14.5, lat: 47.8, countryId: '040', spanDeg: 7.5 }],
  [['布拉格', 'prague', '捷克', '布達佩斯', '布达佩斯'], { lng: 15.0, lat: 49.6, countryId: '203', spanDeg: 8 }],
  [['雷克雅維克', '雷克雅未克', 'reykjavik', '冰島', '冰岛', 'iceland'], { lng: -19.0, lat: 64.9, countryId: '352', spanDeg: 8.5 }],
  [['聖托里尼', '圣托里尼', 'santorini', '雅典', '希臘', '希腊'], { lng: 23.8, lat: 37.9, countryId: '300', spanDeg: 8.5 }],

  // Americas / Oceania / Middle East
  [['紐約', '纽约', 'new york', '芝加哥', '美國', '美国', 'usa'], { lng: -76.5, lat: 40.7128, countryId: '840', spanDeg: 18 }],
  [['舊金山', '旧金山', 'san francisco', '洛杉磯', '洛杉矶', 'los angeles', '西雅圖', '西雅图', '拉斯維加斯', '拉斯维加斯'], { lng: -120.5, lat: 36.8, countryId: '840', spanDeg: 18 }],
  [['夏威夷', '檀香山', 'honolulu', 'hawaii'], { lng: -157.8583, lat: 21.3069, countryId: '840', spanDeg: 7.5 }],
  [['溫哥華', '温哥华', 'vancouver', '班夫', '加拿大', 'canada'], { lng: -121.0, lat: 49.5, countryId: '124', spanDeg: 18 }],
  [['多倫多', '多伦多', 'toronto'], { lng: -79.3832, lat: 43.6532, countryId: '124', spanDeg: 16 }],
  [['雪梨', '悉尼', 'sydney', '墨爾本', '墨尔本', 'melbourne', '布里斯本', '布里斯班', '澳洲', '澳大利亚', 'australia'], { lng: 147.0, lat: -33.5, countryId: '036', spanDeg: 18 }],
  [['奧克蘭', '奥克兰', 'auckland', '皇后鎮', '皇后镇', '紐西蘭', '新西兰', 'new zealand'], { lng: 173.0, lat: -40.5, countryId: '554', spanDeg: 11 }],
  [['杜拜', '迪拜', 'dubai', '阿布達比', '阿布扎比', '阿聯酋', '阿联酋'], { lng: 55.2708, lat: 24.8, countryId: '784', spanDeg: 7.5 }],
  [['伊斯坦堡', '伊斯坦布尔', 'istanbul', '卡帕多奇亞', '卡帕多奇亚', '土耳其', 'turkey'], { lng: 32.5, lat: 39.8, countryId: '792', spanDeg: 12 }],
];

const RUNTIME_GEO_CACHE = new Map<string, GeoTarget>();

function lookupStaticGeo(rawCity?: string | null): GeoTarget | null {
  const primary = (rawCity || '').split(/\s*[-→>/,]\s*/)[0]?.trim().toLowerCase();
  if (!primary) return null;
  const cached = RUNTIME_GEO_CACHE.get(primary);
  if (cached) return cached;
  for (const [keywords, target] of CITY_GEO_MAP) {
    if (keywords.some((kw) => primary.includes(kw.toLowerCase()))) {
      return target;
    }
  }
  return null;
}

const STAR_COORDS = Array.from({ length: 64 }, (_, i) => {
  const x = ((i * 197 + 31) % 98) + 1;
  const y = ((i * 313 + 17) % 92) + 2;
  const r = i % 7 === 0 ? 1.5 : i % 3 === 0 ? 1.05 : 0.7;
  const delay = (i % 8) * 0.55;
  const hero = i % 13 === 0;
  return { x, y, r, delay, hero };
});

interface CountryEntry {
  feature: Feature<Geometry>;
  id: string | undefined;
  bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
}

interface AtlasDataset {
  countries: CountryEntry[];
  collection: { type: 'FeatureCollection'; features: Feature<Geometry>[] };
}

function computeGeoBBox(geom: Geometry | null): [number, number, number, number] {
  let minLng = 180;
  let minLat = 90;
  let maxLng = -180;
  let maxLat = -90;

  const visit = (coords: unknown) => {
    if (!Array.isArray(coords) || coords.length === 0) return;
    if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      const lng = coords[0];
      const lat = coords[1];
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      return;
    }
    for (let i = 0; i < coords.length; i++) {
      visit(coords[i]);
    }
  };

  if (geom) {
    if (geom.type === 'GeometryCollection') {
      geom.geometries.forEach((g) => {
        const b = computeGeoBBox(g);
        if (b[0] < minLng) minLng = b[0];
        if (b[1] < minLat) minLat = b[1];
        if (b[2] > maxLng) maxLng = b[2];
        if (b[3] > maxLat) maxLat = b[3];
      });
    } else if ('coordinates' in geom) {
      visit(geom.coordinates);
    }
  }

  return [minLng, minLat, maxLng, maxLat];
}

function buildAtlasDataset(rawTopo: unknown): AtlasDataset {
  const topo = rawTopo as Topology<{ countries: GeometryCollection }>;
  const countries = feature(topo, topo.objects.countries).features
    .map((f) => ({
      feature: f,
      id: f.id !== undefined ? String(f.id).padStart(3, '0') : undefined,
      bbox: computeGeoBBox(f.geometry),
    }))
    .filter((c) => c.id !== '010'); // exclude Antarctica for crisp habitable framing

  return {
    countries,
    collection: {
      type: 'FeatureCollection',
      features: countries.map((c) => c.feature),
    },
  };
}

// Instant initial render dataset (50m); dynamically upgraded to Ultra-HD 10m on mount
const INITIAL_ATLAS_50M = buildAtlasDataset(worldAtlas50m);
let cachedHdAtlas10m: AtlasDataset | null = null;
let pendingHdAtlas10mPromise: Promise<AtlasDataset> | null = null;

function loadHdAtlas10m(): Promise<AtlasDataset> {
  if (cachedHdAtlas10m) return Promise.resolve(cachedHdAtlas10m);
  if (!pendingHdAtlas10mPromise) {
    pendingHdAtlas10mPromise = import('world-atlas/countries-10m.json').then((mod) => {
      cachedHdAtlas10m = buildAtlasDataset(mod.default ?? mod);
      return cachedHdAtlas10m;
    });
  }
  return pendingHdAtlas10mPromise;
}

interface GlobeBackdropProps {
  focusCity?: string | null;
  isDark: boolean;
}

export const GlobeBackdrop: React.FC<GlobeBackdropProps> = React.memo(({ focusCity, isDark }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [atlas, setAtlas] = useState<AtlasDataset>(() => cachedHdAtlas10m || INITIAL_ATLAS_50M);
  const [viewport, setViewport] = useState<{ width: number; height: number }>(() => ({
    width: typeof window !== 'undefined' ? Math.max(320, window.innerWidth) : 390,
    height: typeof window !== 'undefined' ? Math.max(480, window.innerHeight) : 844,
  }));

  useEffect(() => {
    let active = true;
    if (!cachedHdAtlas10m) {
      loadHdAtlas10m()
        .then((hd) => {
          if (active) setAtlas(hd);
        })
        .catch(() => {
          // Keep 50m gracefully if dynamic chunk fails
        });
    }
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const updateSize = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      const w = Math.round(rect?.width || window.innerWidth || 390);
      const h = Math.round(rect?.height || window.innerHeight || 844);
      if (w > 0 && h > 0) {
        setViewport((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
      }
    };
    updateSize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateSize) : null;
    if (ro && containerRef.current) ro.observe(containerRef.current);
    window.addEventListener('resize', updateSize);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  const hasFocusCity = Boolean(focusCity && focusCity.trim().length > 0);

  const [resolvedTarget, setResolvedTarget] = useState<GeoTarget | null>(() => {
    return hasFocusCity ? lookupStaticGeo(focusCity) : null;
  });

  useEffect(() => {
    const primary = (focusCity || '').split(/\s*[-→>/,]\s*/)[0]?.trim();
    if (!primary) {
      setResolvedTarget(null);
      return;
    }

    const matched = lookupStaticGeo(primary);
    if (matched) {
      setResolvedTarget(matched);
      return;
    }

    let cancelled = false;
    fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(primary)}&count=1&format=json`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { results?: Array<{ longitude?: number; latitude?: number }> } | null) => {
        if (cancelled) return;
        const first = json?.results?.[0];
        if (typeof first?.longitude === 'number' && typeof first?.latitude === 'number') {
          const target: GeoTarget = { lng: first.longitude, lat: first.latitude, spanDeg: 11 };
          RUNTIME_GEO_CACHE.set(primary.toLowerCase(), target);
          setResolvedTarget(target);
        }
      })
      .catch(() => {
        // Ignore fallback lookup errors
      });

    return () => {
      cancelled = true;
    };
  }, [focusCity]);

  const [viewCamera, setViewCamera] = useState<{ lng: number; lat: number; spanDeg: number }>(() => ({
    lng: resolvedTarget?.lng ?? 139.6917,
    lat: resolvedTarget?.lat ?? 35.6895,
    spanDeg: resolvedTarget?.spanDeg ?? 11.5,
  }));
  const cameraRef = useRef(viewCamera);

  useEffect(() => {
    if (!resolvedTarget) return;
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const start = cameraRef.current;
    const target = {
      lng: resolvedTarget.lng,
      lat: resolvedTarget.lat,
      spanDeg: resolvedTarget.spanDeg,
    };

    if (
      prefersReducedMotion ||
      (Math.abs(target.lng - start.lng) < 0.05 &&
        Math.abs(target.lat - start.lat) < 0.05 &&
        Math.abs(target.spanDeg - start.spanDeg) < 0.1)
    ) {
      cameraRef.current = target;
      setViewCamera(target);
      return;
    }

    const deltaLng = (((target.lng - start.lng + 540) % 360) + 360) % 360 - 180;
    const deltaLat = target.lat - start.lat;
    const deltaSpan = target.spanDeg - start.spanDeg;
    const duration = 720;
    const startedAt = performance.now();
    let rafId = 0;

    const step = (now: number) => {
      const t = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = {
        lng: start.lng + deltaLng * eased,
        lat: start.lat + deltaLat * eased,
        spanDeg: start.spanDeg + deltaSpan * eased,
      };
      cameraRef.current = next;
      setViewCamera(next);
      if (t < 1) {
        rafId = requestAnimationFrame(step);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [resolvedTarget]);

  const { countryPaths, markerPoint } = useMemo(() => {
    const vw = viewport.width;
    const vh = viewport.height;

    if (!hasFocusCity || !resolvedTarget) {
      const isPortrait = vw < vh;
      const projection = isPortrait
        ? geoNaturalEarth1()
            .center([18, 16])
            .scale(Math.max(vw * 0.25, vh * 0.21))
            .translate([vw * 0.5, vh * 0.49])
        : geoNaturalEarth1().fitExtent(
            [
              [-vw * 0.03, vh * 0.04],
              [vw * 1.03, vh * 0.96],
            ],
            atlas.collection
          );

      const pathGen = geoPath(projection);
      return {
        countryPaths: atlas.countries.map((c) => ({
          id: c.id,
          d: pathGen(c.feature) || '',
          isFocused: false,
        })),
        markerPoint: null,
      };
    }

    // Crisp Country/City-Centered Flat Mercator Map filling 100% of Viewport
    const targetSpanPx = Math.min(Math.max(vw * 0.86, vh * 0.72), Math.hypot(vw, vh) * 0.72);
    const scale = (targetSpanPx * 360) / (2 * Math.PI * Math.max(2.5, viewCamera.spanDeg));

    const projection = geoMercator()
      .center([viewCamera.lng, viewCamera.lat])
      .scale(scale)
      .translate([vw * 0.5, vh * 0.48]);

    const pathGen = geoPath(projection);

    // Geographic O(1) bounding-box cull for smooth 60fps 10m coastlines during zoom/pan
    const degPerPx = 360 / (2 * Math.PI * scale);
    const halfSpanLng = Math.min(170, (vw * degPerPx) * 0.95 + 14);
    const halfSpanLat = Math.min(82, (vh * degPerPx) * 0.95 + 14);
    const minViewLat = viewCamera.lat - halfSpanLat;
    const maxViewLat = viewCamera.lat + halfSpanLat;

    const cPaths = atlas.countries.map((c) => {
      const isFocused = Boolean(resolvedTarget.countryId && c.id === resolvedTarget.countryId);
      if (!isFocused) {
        const [bMinLng, bMinLat, bMaxLng, bMaxLat] = c.bbox;
        if (bMaxLat < minViewLat || bMinLat > maxViewLat) {
          return { id: c.id, d: '', isFocused: false };
        }
        // Only cull non-antimeridian spans
        if (bMaxLng - bMinLng < 180) {
          const distLng1 = Math.abs((((bMinLng - viewCamera.lng + 540) % 360) - 180));
          const distLng2 = Math.abs((((bMaxLng - viewCamera.lng + 540) % 360) - 180));
          const coversCenter = bMinLng <= viewCamera.lng && bMaxLng >= viewCamera.lng;
          if (!coversCenter && distLng1 > halfSpanLng && distLng2 > halfSpanLng) {
            return { id: c.id, d: '', isFocused: false };
          }
        }
      }
      return {
        id: c.id,
        d: pathGen(c.feature) || '',
        isFocused,
      };
    });

    const projectedPin = projection([resolvedTarget.lng, resolvedTarget.lat]);
    return {
      countryPaths: cPaths,
      markerPoint: projectedPin ? { x: projectedPin[0], y: projectedPin[1] } : null,
    };
  }, [atlas, viewport.width, viewport.height, hasFocusCity, resolvedTarget, viewCamera]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="app-shell-fixed w-full pointer-events-none overflow-hidden select-none"
    >
      {/* Night Cosmos Twinkling Stars (Dark Mode Only) */}
      {isDark && (
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full opacity-85"
        >
          {STAR_COORDS.map((star, idx) => (
            <g key={idx}>
              <circle
                cx={star.x}
                cy={star.y}
                r={star.r * 0.13}
                fill="#FFFFFF"
                className={star.hero ? 'animate-star-twinkle' : undefined}
                style={
                  star.hero
                    ? { animationDelay: `${star.delay}s` }
                    : { opacity: 0.22 + (idx % 5) * 0.10 }
                }
              />
              {star.hero && (
                <path
                  d={`M${star.x - 0.45} ${star.y} L${star.x + 0.45} ${star.y} M${star.x} ${star.y - 0.45} L${star.x} ${star.y + 0.45}`}
                  stroke="#BAE6FD"
                  strokeWidth="0.07"
                  strokeLinecap="round"
                  className="animate-star-twinkle"
                  style={{ animationDelay: `${star.delay}s` }}
                />
              )}
            </g>
          ))}
        </svg>
      )}

      {/* Full-Viewport Crisp Ultra-HD 10m Flat Vector Map (Zero Graticule Lines, Zero Blur) */}
      <svg
        viewBox={`0 0 ${viewport.width} ${viewport.height}`}
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full"
      >
        <g shapeRendering="geometricPrecision">
          {countryPaths.map((c, idx) =>
            c.d ? (
              <path
                key={`${c.id || 'r'}-${idx}`}
                d={c.d}
                fill={
                  c.isFocused
                    ? isDark
                      ? 'rgba(56, 189, 248, 0.11)'
                      : 'rgba(255, 255, 255, 0.64)'
                    : isDark
                      ? 'rgba(148, 163, 184, 0.06)'
                      : 'rgba(255, 255, 255, 0.35)'
                }
                stroke={
                  c.isFocused
                    ? isDark
                      ? 'rgba(125, 211, 252, 0.34)'
                      : 'rgba(59, 130, 246, 0.30)'
                    : isDark
                      ? 'rgba(148, 163, 184, 0.15)'
                      : 'rgba(96, 165, 250, 0.19)'
                }
                strokeWidth={c.isFocused ? 1.15 : 0.7}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ) : null
          )}
        </g>

        {/* Subtle Pinpoint Centered on Focused City */}
        {markerPoint && Number.isFinite(markerPoint.x) && Number.isFinite(markerPoint.y) && (
          <g transform={`translate(${markerPoint.x}, ${markerPoint.y})`}>
            <circle
              r="22"
              fill={isDark ? 'rgba(56, 189, 248, 0.10)' : 'rgba(37, 99, 235, 0.08)'}
            />
            <circle
              r="9"
              fill="none"
              stroke={isDark ? '#7DD3FC' : '#2563EB'}
              strokeWidth="1.2"
              strokeOpacity="0.45"
            />
            <circle
              r="4"
              fill={isDark ? '#38BDF8' : '#2563EB'}
              stroke="#FFFFFF"
              strokeWidth="1.5"
            />
          </g>
        )}
      </svg>
    </div>
  );
});

GlobeBackdrop.displayName = 'GlobeBackdrop';
