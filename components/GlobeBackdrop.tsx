import React, { useEffect, useRef, useState } from 'react';
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

const BASE_SCALE = 512;
const BASE_MERCATOR = geoMercator().center([0, 0]).scale(BASE_SCALE).translate([0, 0]);
const BASE_WORLD = geoNaturalEarth1().center([0, 0]).scale(BASE_SCALE).translate([0, 0]);
const WORLD_SPAN_X = 2 * Math.PI * BASE_SCALE;

interface CompiledCountryEntry {
  id: string | undefined;
  bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  mercatorPath: Path2D | null;
  worldPath: Path2D | null;
}

interface CompiledAtlas {
  countries: CompiledCountryEntry[];
  worldBounds: [[number, number], [number, number]];
}

function buildPath2DFromGeo(
  projection: ReturnType<typeof geoMercator> | ReturnType<typeof geoNaturalEarth1>,
  feat: Feature<Geometry>
): Path2D | null {
  if (typeof Path2D === 'undefined') return null;
  const p = new Path2D();
  const adapter = {
    beginPath() {},
    moveTo(x: number, y: number) {
      p.moveTo(x, y);
    },
    lineTo(x: number, y: number) {
      p.lineTo(x, y);
    },
    closePath() {
      p.closePath();
    },
    arc(x: number, y: number, r: number, a0: number, a1: number) {
      p.arc(x, y, r, a0, a1);
    },
  };
  geoPath(projection, adapter as unknown as CanvasRenderingContext2D)(feat);
  return p;
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

function compileAtlasDataset(rawTopo: unknown): CompiledAtlas {
  const topo = rawTopo as Topology<{ countries: GeometryCollection }>;
  const rawFeatures = feature(topo, topo.objects.countries).features;
  const countries: CompiledCountryEntry[] = [];
  const keptFeatures: Feature<Geometry>[] = [];

  for (const f of rawFeatures) {
    const id = f.id !== undefined ? String(f.id).padStart(3, '0') : undefined;
    if (id === '010') continue; // exclude Antarctica for crisp habitable framing
    keptFeatures.push(f);
    countries.push({
      id,
      bbox: computeGeoBBox(f.geometry),
      mercatorPath: buildPath2DFromGeo(BASE_MERCATOR, f),
      worldPath: buildPath2DFromGeo(BASE_WORLD, f),
    });
  }

  const worldBounds = geoPath(BASE_WORLD).bounds({
    type: 'FeatureCollection',
    features: keptFeatures,
  });

  return { countries, worldBounds };
}

// Instant compiled 50m atlas; dynamically upgraded to Ultra-HD 10m with pre-baked Path2D objects
const INITIAL_ATLAS_50M = compileAtlasDataset(worldAtlas50m);
let cachedHdAtlas10m: CompiledAtlas | null = null;
let pendingHdAtlas10mPromise: Promise<CompiledAtlas> | null = null;

function loadHdAtlas10m(): Promise<CompiledAtlas> {
  if (cachedHdAtlas10m) return Promise.resolve(cachedHdAtlas10m);
  if (!pendingHdAtlas10mPromise) {
    pendingHdAtlas10mPromise = import('world-atlas/countries-10m.json').then((mod) => {
      cachedHdAtlas10m = compileAtlasDataset(mod.default ?? mod);
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [atlas, setAtlas] = useState<CompiledAtlas>(() => cachedHdAtlas10m || INITIAL_ATLAS_50M);
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

  const cameraRef = useRef<{ lng: number; lat: number; spanDeg: number }>({
    lng: resolvedTarget?.lng ?? 139.6917,
    lat: resolvedTarget?.lat ?? 35.6895,
    spanDeg: resolvedTarget?.spanDeg ?? 11.5,
  });

  // Store latest render inputs in refs so rAF draws directly at 60/120fps with zero React state churn
  const renderParamsRef = useRef({
    atlas,
    viewport,
    isDark,
    hasFocusCity,
    resolvedTarget,
  });
  renderParamsRef.current = {
    atlas,
    viewport,
    isDark,
    hasFocusCity,
    resolvedTarget,
  };

  const drawFrameRef = useRef<() => void>(() => {});
  drawFrameRef.current = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { atlas: curAtlas, viewport: vp, isDark: dark, hasFocusCity: focused, resolvedTarget: target } =
      renderParamsRef.current;

    const vw = vp.width;
    const vh = vp.height;
    if (vw <= 0 || vh <= 0) return;

    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2.5) : 1;
    const targetPxW = Math.round(vw * dpr);
    const targetPxH = Math.round(vh * dpr);
    if (canvas.width !== targetPxW || canvas.height !== targetPxH) {
      canvas.width = targetPxW;
      canvas.height = targetPxH;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vw, vh);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const baseFill = dark ? 'rgba(148, 163, 184, 0.06)' : 'rgba(255, 255, 255, 0.35)';
    const focusFill = dark ? 'rgba(56, 189, 248, 0.11)' : 'rgba(255, 255, 255, 0.64)';
    const baseStroke = dark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(96, 165, 250, 0.19)';
    const focusStroke = dark ? 'rgba(125, 211, 252, 0.34)' : 'rgba(59, 130, 246, 0.30)';

    if (!focused || !target) {
      const isPortrait = vw < vh;
      let zoom = 1;
      let tx = vw * 0.5;
      let ty = vh * 0.49;

      if (isPortrait) {
        const targetScale = Math.max(vw * 0.25, vh * 0.21);
        zoom = targetScale / BASE_SCALE;
        const centerPt = BASE_WORLD([18, 16]) || [0, 0];
        tx = vw * 0.5 - centerPt[0] * zoom;
        ty = vh * 0.49 - centerPt[1] * zoom;
      } else {
        const [[x0, y0], [x1, y1]] = curAtlas.worldBounds;
        const bw = Math.max(1, x1 - x0);
        const bh = Math.max(1, y1 - y0);
        const fitW = vw * 1.06;
        const fitH = vh * 0.92;
        zoom = Math.min(fitW / bw, fitH / bh);
        tx = vw * 0.5 - ((x0 + x1) * 0.5) * zoom;
        ty = vh * 0.5 - ((y0 + y1) * 0.5) * zoom;
      }

      ctx.save();
      ctx.translate(tx, ty);
      ctx.scale(zoom, zoom);
      ctx.fillStyle = baseFill;
      ctx.strokeStyle = baseStroke;
      ctx.lineWidth = 0.7 / Math.max(0.05, zoom);

      for (let i = 0; i < curAtlas.countries.length; i++) {
        const wp = curAtlas.countries[i].worldPath;
        if (!wp) continue;
        ctx.fill(wp);
        ctx.stroke(wp);
      }
      ctx.restore();
      return;
    }

    const cam = cameraRef.current;
    const targetSpanPx = Math.min(Math.max(vw * 0.86, vh * 0.72), Math.hypot(vw, vh) * 0.72);
    const scale = (targetSpanPx * 360) / (2 * Math.PI * Math.max(2.5, cam.spanDeg));
    const zoom = scale / BASE_SCALE;

    const clampedLat = Math.max(-80, Math.min(80, cam.lat));
    const centerPt = BASE_MERCATOR([cam.lng, clampedLat]) || [0, 0];
    const cmx = centerPt[0];
    const cmy = centerPt[1];

    const degPerPx = 360 / (2 * Math.PI * scale);
    const halfSpanLng = Math.min(175, vw * degPerPx * 0.95 + 14);
    const halfSpanLat = Math.min(82, vh * degPerPx * 0.95 + 14);
    const minViewLat = cam.lat - halfSpanLat;
    const maxViewLat = cam.lat + halfSpanLat;

    // Determine visible antimeridian wrap offsets (-worldW, 0, +worldW)
    const offsets: number[] = [0];
    const leftEdgeWorldX = cmx - (vw * 0.5) / zoom;
    const rightEdgeWorldX = cmx + (vw * 0.5) / zoom;
    if (leftEdgeWorldX < -WORLD_SPAN_X * 0.5) offsets.push(-WORLD_SPAN_X);
    if (rightEdgeWorldX > WORLD_SPAN_X * 0.5) offsets.push(WORLD_SPAN_X);

    const normalLw = 0.7 / Math.max(0.05, zoom);
    const focusLw = 1.15 / Math.max(0.05, zoom);

    for (let o = 0; o < offsets.length; o++) {
      const worldOffset = offsets[o];
      const tx = vw * 0.5 + (worldOffset - cmx) * zoom;
      const ty = vh * 0.48 - cmy * zoom;
      const shiftDeg = (worldOffset / WORLD_SPAN_X) * 360;
      const camLngInCopy = cam.lng - shiftDeg;

      ctx.save();
      ctx.translate(tx, ty);
      ctx.scale(zoom, zoom);

      for (let i = 0; i < curAtlas.countries.length; i++) {
        const c = curAtlas.countries[i];
        const mp = c.mercatorPath;
        if (!mp) continue;

        const isFocused = Boolean(target.countryId && c.id === target.countryId);
        if (!isFocused) {
          const [bMinLng, bMinLat, bMaxLng, bMaxLat] = c.bbox;
          if (bMaxLat < minViewLat || bMinLat > maxViewLat) continue;
          if (bMaxLng - bMinLng < 180) {
            const coversCenter = bMinLng <= camLngInCopy && bMaxLng >= camLngInCopy;
            const d1 = Math.abs(bMinLng - camLngInCopy);
            const d2 = Math.abs(bMaxLng - camLngInCopy);
            if (!coversCenter && d1 > halfSpanLng && d2 > halfSpanLng) continue;
          }
        }

        ctx.fillStyle = isFocused ? focusFill : baseFill;
        ctx.strokeStyle = isFocused ? focusStroke : baseStroke;
        ctx.lineWidth = isFocused ? focusLw : normalLw;
        ctx.fill(mp);
        ctx.stroke(mp);
      }

      ctx.restore();
    }

    // Crisp Pinpoint Marker Centered on Focused City
    const pinMerc = BASE_MERCATOR([target.lng, Math.max(-80, Math.min(80, target.lat))]);
    if (pinMerc) {
      let pinOffsetX = 0;
      let bestDist = Infinity;
      for (const offset of offsets) {
        const d = Math.abs(pinMerc[0] + offset - cmx);
        if (d < bestDist) {
          bestDist = d;
          pinOffsetX = offset;
        }
      }
      const px = vw * 0.5 + (pinMerc[0] + pinOffsetX - cmx) * zoom;
      const py = vh * 0.48 + (pinMerc[1] - cmy) * zoom;

      if (Number.isFinite(px) && Number.isFinite(py) && px > -60 && px < vw + 60 && py > -60 && py < vh + 60) {
        ctx.save();
        ctx.translate(px, py);

        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.fillStyle = dark ? 'rgba(56, 189, 248, 0.10)' : 'rgba(37, 99, 235, 0.08)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.strokeStyle = dark ? 'rgba(125, 211, 252, 0.45)' : 'rgba(37, 99, 235, 0.45)';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fillStyle = dark ? '#38BDF8' : '#2563EB';
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.restore();
      }
    }
  };

  // Immediate redraw on theme, viewport, or atlas upgrade
  useEffect(() => {
    drawFrameRef.current();
  }, [atlas, viewport.width, viewport.height, isDark, hasFocusCity, resolvedTarget]);

  // Silky 60/120fps canvas-only pan & zoom animation (zero React re-renders per frame)
  useEffect(() => {
    if (!resolvedTarget) {
      drawFrameRef.current();
      return;
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const start = { ...cameraRef.current };
    const target = {
      lng: resolvedTarget.lng,
      lat: resolvedTarget.lat,
      spanDeg: resolvedTarget.spanDeg,
    };

    const deltaLng = (((target.lng - start.lng + 540) % 360) + 360) % 360 - 180;
    const deltaLat = target.lat - start.lat;
    const deltaSpan = target.spanDeg - start.spanDeg;

    if (
      prefersReducedMotion ||
      (Math.abs(deltaLng) < 0.05 && Math.abs(deltaLat) < 0.05 && Math.abs(deltaSpan) < 0.1)
    ) {
      cameraRef.current = target;
      drawFrameRef.current();
      return;
    }

    const duration = 640;
    const startedAt = performance.now();
    let rafId = 0;

    const step = (now: number) => {
      const t = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      cameraRef.current = {
        lng: start.lng + deltaLng * eased,
        lat: start.lat + deltaLat * eased,
        spanDeg: start.spanDeg + deltaSpan * eased,
      };
      drawFrameRef.current();
      if (t < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        cameraRef.current = target;
        drawFrameRef.current();
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [resolvedTarget]);

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

      {/* Full-Viewport Hardware-Accelerated DPR Canvas (Pre-Baked Ultra-HD 10m Path2D, 60/120fps) */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block"
      />
    </div>
  );
});

GlobeBackdrop.displayName = 'GlobeBackdrop';
