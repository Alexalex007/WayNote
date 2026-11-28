import React, { useEffect, useRef, useState } from 'react';
import { geoMercator, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Feature, Geometry, MultiPolygon, Polygon, Position } from 'geojson';
import worldLand50m from 'world-atlas/land-50m.json';

interface GeoTarget {
  lng: number;
  lat: number;
  spanDeg: number;
}

const CITY_GEO_MAP: Array<[string[], GeoTarget]> = [
  // Japan
  [['東京', '东京', 'tokyo', '新宿', '澀谷', '涩谷', '淺草', '浅草', '銀座', '银座', '羽田', '成田', '箱根', '鎌倉', '镰仓', '河口湖', '富士山', '橫濱', '横滨', '日光', '輕井澤', '轻井泽'], { lng: 139.6917, lat: 35.6895, spanDeg: 11.5 }],
  [['大阪', 'osaka', '難波', '难波', '心齋橋', '心斋桥', '梅田', '關西', '关西'], { lng: 135.5023, lat: 34.6937, spanDeg: 11 }],
  [['京都', 'kyoto', '嵐山', '岚山', '宇治', '奈良'], { lng: 135.7681, lat: 35.0116, spanDeg: 11 }],
  [['札幌', '北海道', 'sapporo', 'hokkaido', '小樽', '富良野', '函館', '函馆'], { lng: 141.3545, lat: 43.0618, spanDeg: 12 }],
  [['沖繩', '冲绳', '那霸', 'okinawa', 'naha'], { lng: 127.6792, lat: 26.2124, spanDeg: 7.5 }],
  [['福岡', '福冈', 'fukuoka', '九州', '由布院', '熊本', '長崎', '长崎', '鹿兒島', '鹿儿岛'], { lng: 130.4017, lat: 33.5902, spanDeg: 10.5 }],
  [['名古屋', 'nagoya', '白川鄉', '白川乡', '金澤', '金泽', '合掌村'], { lng: 136.9066, lat: 35.1815, spanDeg: 11 }],
  [['仙台', 'sendai', '廣島', '广岛', 'hiroshima', '神戶', '神户', 'kobe', '日本', 'japan'], { lng: 138.2529, lat: 36.2048, spanDeg: 12 }],

  // Taiwan
  [['台北', '臺北', '新北', '桃園', '桃园', '基隆', '九份', '淡水', '宜蘭', '宜兰', 'taipei', 'taiwan', '台灣'], { lng: 121.5654, lat: 24.45, spanDeg: 4.2 }],
  [['台中', '臺中', 'taichung', '日月潭', '南投', '阿里山'], { lng: 120.6736, lat: 24.1477, spanDeg: 4.2 }],
  [['台南', '臺南', 'tainan', '高雄', 'kaohsiung', '墾丁', '垦丁', '花蓮', '花莲', '台東', '台东'], { lng: 120.45, lat: 23.1, spanDeg: 4.4 }],

  // Korea
  [['首爾', '首尔', 'seoul', '仁川', '弘大', '明洞', '韓國', '韩国', 'korea'], { lng: 127.3, lat: 36.8, spanDeg: 6.2 }],
  [['釜山', 'busan'], { lng: 128.6, lat: 35.4, spanDeg: 6.2 }],
  [['濟州', '济州', 'jeju'], { lng: 126.5312, lat: 33.4996, spanDeg: 5.5 }],

  // Hong Kong / Macau / Mainland China
  [['香港', 'hong kong', '澳門', '澳门', 'macau', 'macao'], { lng: 114.1694, lat: 22.3193, spanDeg: 5.2 }],
  [['上海', 'shanghai', '蘇州', '苏州', '烏鎮', '乌镇', '杭州', 'hangzhou', '南京'], { lng: 120.8, lat: 30.8, spanDeg: 14 }],
  [['北京', 'beijing', '長城', '长城', 'great wall', '哈爾濱', '哈尔滨'], { lng: 116.4074, lat: 39.9042, spanDeg: 16 }],
  [['成都', 'chengdu', '重慶', '重庆', '九寨溝', '九寨沟', '西安'], { lng: 104.0665, lat: 30.5728, spanDeg: 16 }],
  [['廣州', '广州', '深圳', '珠海', '廈門', '厦门', '桂林', '麗江', '丽江', '三亞', '三亚'], { lng: 113.2644, lat: 23.1291, spanDeg: 15 }],

  // Southeast Asia
  [['曼谷', 'bangkok', '泰國', '泰国', 'thailand'], { lng: 100.5018, lat: 13.7563, spanDeg: 11 }],
  [['清邁', '清迈', 'chiang mai', '普吉', 'phuket', '蘇美島', '苏梅岛'], { lng: 99.5, lat: 16.5, spanDeg: 11 }],
  [['新加坡', 'singapore'], { lng: 103.8198, lat: 1.3521, spanDeg: 4.5 }],
  [['吉隆坡', 'kuala lumpur', '檳城', '槟城', '沙巴', '馬來西亞', '马来西亚', 'malaysia'], { lng: 101.6869, lat: 3.139, spanDeg: 11 }],
  [['胡志明', '河內', '河内', 'hanoi', '峴港', '岘港', '越南', 'vietnam', '富國島', '富国岛'], { lng: 106.2, lat: 16.5, spanDeg: 12 }],
  [['峇里島', '巴厘岛', 'bali', '雅加達', '雅加达', '印尼', 'indonesia'], { lng: 115.1889, lat: -8.4095, spanDeg: 12 }],
  [['馬尼拉', '马尼拉', '宿霧', '宿务', '長灘島', '长滩岛', '菲律賓', '菲律宾', 'manila', 'cebu'], { lng: 121.5, lat: 13.5, spanDeg: 11 }],

  // Europe
  [['巴黎', 'paris', '尼斯', '里昂', '法國', '法国', 'france'], { lng: 2.3522, lat: 47.6, spanDeg: 11.5 }],
  [['倫敦', '伦敦', 'london', '愛丁堡', '爱丁堡', '曼徹斯特', '曼彻斯特', '英國', '英国', 'uk', 'england'], { lng: -1.5, lat: 52.8, spanDeg: 9.5 }],
  [['羅馬', '罗马', 'rome', '米蘭', '米兰', 'milan', '威尼斯', 'venice', '佛羅倫斯', '佛罗伦萨', '義大利', '意大利', 'italy'], { lng: 12.4964, lat: 42.5, spanDeg: 11 }],
  [['巴塞隆納', '巴塞罗那', 'barcelona', '馬德里', '马德里', 'madrid', '西班牙', 'spain'], { lng: -2.5, lat: 40.5, spanDeg: 11.5 }],
  [['阿姆斯特丹', 'amsterdam', '荷蘭', '荷兰', '布魯日', '布鲁日'], { lng: 4.9041, lat: 52.2, spanDeg: 6.5 }],
  [['蘇黎世', '苏黎世', 'zurich', '日內瓦', '日内瓦', '策馬特', '采尔马特', '因特拉肯', '瑞士', 'switzerland'], { lng: 8.3, lat: 46.8, spanDeg: 6.5 }],
  [['慕尼黑', 'munich', '柏林', 'berlin', '法蘭克福', '法兰克福', '德國', '德国', 'germany'], { lng: 10.5, lat: 50.5, spanDeg: 10 }],
  [['維也納', '维也纳', 'vienna', '薩爾斯堡', '萨尔茨堡', '哈修塔特', '哈尔施塔特', '奧地利', '奥地利'], { lng: 14.5, lat: 47.8, spanDeg: 7.5 }],
  [['布拉格', 'prague', '捷克', '布達佩斯', '布达佩斯'], { lng: 15.0, lat: 49.6, spanDeg: 8 }],
  [['雷克雅維克', '雷克雅未克', 'reykjavik', '冰島', '冰岛', 'iceland'], { lng: -19.0, lat: 64.9, spanDeg: 8.5 }],
  [['聖托里尼', '圣托里尼', 'santorini', '雅典', '希臘', '希腊'], { lng: 23.8, lat: 37.9, spanDeg: 8.5 }],

  // Americas / Oceania / Middle East
  [['紐約', '纽约', 'new york', '芝加哥', '美國', '美国', 'usa'], { lng: -76.5, lat: 40.7128, spanDeg: 18 }],
  [['舊金山', '旧金山', 'san francisco', '洛杉磯', '洛杉矶', 'los angeles', '西雅圖', '西雅图', '拉斯維加斯', '拉斯维加斯'], { lng: -120.5, lat: 36.8, spanDeg: 18 }],
  [['夏威夷', '檀香山', 'honolulu', 'hawaii'], { lng: -157.8583, lat: 21.3069, spanDeg: 7.5 }],
  [['溫哥華', '温哥华', 'vancouver', '班夫', '加拿大', 'canada'], { lng: -121.0, lat: 49.5, spanDeg: 18 }],
  [['多倫多', '多伦多', 'toronto'], { lng: -79.3832, lat: 43.6532, spanDeg: 16 }],
  [['雪梨', '悉尼', 'sydney', '墨爾本', '墨尔本', 'melbourne', '布里斯本', '布里斯班', '澳洲', '澳大利亚', 'australia'], { lng: 147.0, lat: -33.5, spanDeg: 18 }],
  [['奧克蘭', '奥克兰', 'auckland', '皇后鎮', '皇后镇', '紐西蘭', '新西兰', 'new zealand'], { lng: 173.0, lat: -40.5, spanDeg: 11 }],
  [['杜拜', '迪拜', 'dubai', '阿布達比', '阿布扎比', '阿聯酋', '阿联酋'], { lng: 55.2708, lat: 24.8, spanDeg: 7.5 }],
  [['伊斯坦堡', '伊斯坦布尔', 'istanbul', '卡帕多奇亞', '卡帕多奇亚', '土耳其', 'turkey'], { lng: 32.5, lat: 39.8, spanDeg: 12 }],
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

const BASE_SCALE = 512;
const BASE_MERCATOR = geoMercator().center([0, 0]).scale(BASE_SCALE).translate([0, 0]);
const WORLD_SPAN_X = 2 * Math.PI * BASE_SCALE;
const HALF_WORLD_X = WORLD_SPAN_X * 0.5;

// Habitable vertical Mercator bounds [-56°S .. +72°N] for full-bleed overview framing
const OVERVIEW_CENTER_LNG = 104;
const OVERVIEW_CENTER_LAT = 22;
const OVERVIEW_CENTER_SPAN_DEG = 105;
const HABITABLE_TOP_Y = (BASE_MERCATOR([0, 72]) || [0, -947])[1];
const HABITABLE_BOT_Y = (BASE_MERCATOR([0, -56]) || [0, 606])[1];
const HABITABLE_SPAN_Y = Math.max(1, HABITABLE_BOT_Y - HABITABLE_TOP_Y);

// Bitmap vertical envelope covers up to ~84°N (Greenland) down to -58°S cleanly
const BMP_TOP_Y = -1520;
const BMP_BOT_Y = 660;
const BMP_W = Math.ceil(WORLD_SPAN_X);
const BMP_H = Math.ceil(BMP_BOT_Y - BMP_TOP_Y);

interface CompiledLandAtlas {
  fillPath: Path2D | null;
  coastPath: Path2D | null;
}

function isNonAntarcticPolygon(rings: Position[][]): boolean {
  const outer = rings[0];
  if (!outer || outer.length === 0) return false;
  for (let i = 0; i < outer.length; i++) {
    if (outer[i][1] >= -58) return true;
  }
  return false;
}

function filterHabitableLand(geom: Geometry): Geometry {
  if (geom.type === 'MultiPolygon') {
    return {
      type: 'MultiPolygon',
      coordinates: geom.coordinates.filter(isNonAntarcticPolygon),
    } satisfies MultiPolygon;
  }
  if (geom.type === 'Polygon') {
    return isNonAntarcticPolygon(geom.coordinates)
      ? geom
      : ({ type: 'MultiPolygon', coordinates: [] } satisfies MultiPolygon);
  }
  if (geom.type === 'GeometryCollection') {
    return {
      type: 'GeometryCollection',
      geometries: geom.geometries.map(filterHabitableLand),
    };
  }
  return geom;
}

function isAntimeridianSeam(x1: number, x2: number): boolean {
  const onLeftEdge = Math.abs(Math.abs(x1) - HALF_WORLD_X) < 2.2;
  const onRightEdge = Math.abs(Math.abs(x2) - HALF_WORLD_X) < 2.2;
  return (onLeftEdge && onRightEdge) || Math.abs(x2 - x1) > HALF_WORLD_X;
}

function compileLandDataset(rawTopo: unknown): CompiledLandAtlas {
  if (typeof Path2D === 'undefined') {
    return { fillPath: null, coastPath: null };
  }

  const topo = rawTopo as Topology<{ land: GeometryCollection }>;
  const rawFeatures = feature(topo, topo.objects.land).features;
  const habitableFeatures: Feature<Geometry>[] = rawFeatures.map((f) => ({
    ...f,
    geometry: filterHabitableLand(f.geometry),
  }));

  const fillPath = new Path2D();
  const coastPath = new Path2D();

  let ringStartX = 0;
  let ringStartY = 0;
  let prevX = 0;
  let prevY = 0;
  let lastCoastX = 0;
  let lastCoastY = 0;
  let hasActive = false;

  const adapter = {
    beginPath() {},
    moveTo(x: number, y: number) {
      fillPath.moveTo(x, y);
      coastPath.moveTo(x, y);
      ringStartX = x;
      ringStartY = y;
      prevX = x;
      prevY = y;
      lastCoastX = x;
      lastCoastY = y;
      hasActive = true;
    },
    lineTo(x: number, y: number) {
      fillPath.lineTo(x, y);
      if (!hasActive || isAntimeridianSeam(prevX, x)) {
        // Break stroke across +/-180deg cut edges so no straight vertical meridian seam is ever drawn
        coastPath.moveTo(x, y);
        lastCoastX = x;
        lastCoastY = y;
      } else {
        const dx = x - lastCoastX;
        const dy = y - lastCoastY;
        if (dx * dx + dy * dy >= 0.09) {
          coastPath.lineTo(x, y);
          lastCoastX = x;
          lastCoastY = y;
        }
      }
      prevX = x;
      prevY = y;
      hasActive = true;
    },
    closePath() {
      fillPath.closePath();
      if (hasActive && !isAntimeridianSeam(prevX, ringStartX)) {
        coastPath.lineTo(ringStartX, ringStartY);
      }
      hasActive = false;
    },
    arc(x: number, y: number, r: number, a0: number, a1: number) {
      fillPath.arc(x, y, r, a0, a1);
      coastPath.arc(x, y, r, a0, a1);
    },
  };

  const pathGen = geoPath(BASE_MERCATOR, adapter as unknown as CanvasRenderingContext2D);
  for (let i = 0; i < habitableFeatures.length; i++) {
    pathGen(habitableFeatures[i]);
  }

  return { fillPath, coastPath };
}

// Single pre-compiled seam-free 50m borderless land atlas (zero 400k-vertex main-thread stalls)
const LAND_ATLAS_50M = compileLandDataset(worldLand50m);

const worldBitmapCache: { dark: HTMLCanvasElement | null; light: HTMLCanvasElement | null } = {
  dark: null,
  light: null,
};

function getWorldMotionBitmap(dark: boolean): HTMLCanvasElement | null {
  if (typeof document === 'undefined' || !LAND_ATLAS_50M.fillPath || !LAND_ATLAS_50M.coastPath) {
    return null;
  }
  const key = dark ? 'dark' : 'light';
  if (worldBitmapCache[key]) return worldBitmapCache[key];

  const bmp = document.createElement('canvas');
  bmp.width = BMP_W;
  bmp.height = BMP_H;
  const bctx = bmp.getContext('2d');
  if (!bctx) return null;

  bctx.translate(HALF_WORLD_X, -BMP_TOP_Y);
  bctx.lineJoin = 'bevel';
  bctx.lineCap = 'butt';
  bctx.fillStyle = dark ? 'rgba(148, 163, 184, 0.085)' : 'rgba(255, 255, 255, 0.44)';
  bctx.strokeStyle = dark ? 'rgba(148, 163, 184, 0.19)' : 'rgba(96, 165, 250, 0.22)';
  bctx.lineWidth = 0.75;

  bctx.fill(LAND_ATLAS_50M.fillPath);
  bctx.stroke(LAND_ATLAS_50M.coastPath);

  worldBitmapCache[key] = bmp;
  return bmp;
}

interface GlobeBackdropProps {
  focusCity?: string | null;
  isDark: boolean;
}

export const GlobeBackdrop: React.FC<GlobeBackdropProps> = React.memo(({ focusCity, isDark }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isAnimatingRef = useRef(false);
  const [viewport, setViewport] = useState<{ width: number; height: number }>(() => ({
    width: typeof window !== 'undefined' ? Math.max(320, window.innerWidth) : 390,
    height: typeof window !== 'undefined' ? Math.max(480, window.innerHeight) : 844,
  }));

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
    lng: resolvedTarget?.lng ?? OVERVIEW_CENTER_LNG,
    lat: resolvedTarget?.lat ?? OVERVIEW_CENTER_LAT,
    spanDeg: resolvedTarget?.spanDeg ?? OVERVIEW_CENTER_SPAN_DEG,
  });

  const renderParamsRef = useRef({
    viewport,
    isDark,
    hasFocusCity,
    resolvedTarget,
  });
  renderParamsRef.current = {
    viewport,
    isDark,
    hasFocusCity,
    resolvedTarget,
  };

  const drawFrameRef = useRef<() => void>(() => {});
  drawFrameRef.current = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { viewport: vp, isDark: dark, hasFocusCity: focused, resolvedTarget: target } =
      renderParamsRef.current;

    const vw = vp.width;
    const vh = vp.height;
    if (vw <= 0 || vh <= 0 || !LAND_ATLAS_50M.fillPath || !LAND_ATLAS_50M.coastPath) return;

    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 1.5) : 1;
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

    const isOverview = !focused || !target;
    let camLng = cameraRef.current.lng;
    let camLat = cameraRef.current.lat;
    let zoom = 1;
    let anchorYRatio = 0.48;

    if (isOverview) {
      camLng = OVERVIEW_CENTER_LNG;
      camLat = OVERVIEW_CENTER_LAT;
      anchorYRatio = 0.5;
      // Guarantee full-bleed edge-to-edge coverage across portrait mobile, tablets, and ultrawide desktops
      const minZoomWidth = vw / (WORLD_SPAN_X * 0.94);
      const minZoomHeight = vh / (HABITABLE_SPAN_Y * 0.94);
      zoom = Math.max(minZoomWidth, minZoomHeight);
    } else {
      const cam = cameraRef.current;
      camLng = cam.lng;
      camLat = cam.lat;
      const targetSpanPx = Math.min(Math.max(vw * 0.86, vh * 0.72), Math.hypot(vw, vh) * 0.72);
      const scale = (targetSpanPx * 360) / (2 * Math.PI * Math.max(2.5, cam.spanDeg));
      zoom = scale / BASE_SCALE;
    }

    const clampedLat = Math.max(-72, Math.min(72, camLat));
    const centerPt = BASE_MERCATOR([camLng, clampedLat]) || [0, 0];
    const cmx = centerPt[0];
    const cmy = isOverview ? (HABITABLE_TOP_Y + HABITABLE_BOT_Y) * 0.5 : centerPt[1];

    // Exact visible horizontal world tile bounds (zero offscreen wasted tile draws)
    const padWorld = 12 / Math.max(0.05, zoom);
    const leftEdgeWorldX = cmx - (vw * 0.5) / zoom - padWorld;
    const rightEdgeWorldX = cmx + (vw * 0.5) / zoom + padWorld;
    const minTile = Math.max(-3, Math.ceil(leftEdgeWorldX / WORLD_SPAN_X - 0.5));
    const maxTile = Math.min(3, Math.floor(rightEdgeWorldX / WORLD_SPAN_X + 0.5));
    const offsets: number[] = [];
    for (let k = minTile; k <= maxTile; k++) {
      offsets.push(k * WORLD_SPAN_X);
    }
    if (offsets.length === 0) offsets.push(0);

    // During animated pan/zoom, blit pre-rendered GPU offscreen bitmap (zero per-frame vector tessellation)
    const motionBmp = isAnimatingRef.current ? getWorldMotionBitmap(dark) : null;
    if (motionBmp) {
      const dw = WORLD_SPAN_X * zoom;
      const dh = BMP_H * zoom;
      const dy = vh * anchorYRatio + (BMP_TOP_Y - cmy) * zoom;
      for (let o = 0; o < offsets.length; o++) {
        const dx = vw * 0.5 + (offsets[o] - HALF_WORLD_X - cmx) * zoom;
        ctx.drawImage(motionBmp, dx, dy, dw, dh);
      }
    } else {
      ctx.lineJoin = 'bevel';
      ctx.lineCap = 'butt';
      ctx.fillStyle = dark ? 'rgba(148, 163, 184, 0.085)' : 'rgba(255, 255, 255, 0.44)';
      ctx.strokeStyle = dark ? 'rgba(148, 163, 184, 0.19)' : 'rgba(96, 165, 250, 0.22)';
      ctx.lineWidth = (isOverview ? 0.6 : 0.75) / Math.max(0.05, zoom);

      for (let o = 0; o < offsets.length; o++) {
        const worldOffset = offsets[o];
        const tx = vw * 0.5 + (worldOffset - cmx) * zoom;
        const ty = vh * anchorYRatio - cmy * zoom;

        ctx.save();
        ctx.translate(tx, ty);
        ctx.scale(zoom, zoom);
        ctx.fill(LAND_ATLAS_50M.fillPath);
        ctx.stroke(LAND_ATLAS_50M.coastPath);
        ctx.restore();
      }
    }

    // Crisp Pinpoint Marker Centered on Focused City
    if (!isOverview && target) {
      const pinMerc = BASE_MERCATOR([target.lng, Math.max(-75, Math.min(75, target.lat))]);
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
        const py = vh * anchorYRatio + (pinMerc[1] - cmy) * zoom;

        if (Number.isFinite(px) && Number.isFinite(py) && px > -60 && px < vw + 60 && py > -60 && py < vh + 60) {
          ctx.save();
          ctx.translate(px, py);

          ctx.beginPath();
          ctx.arc(0, 0, 22, 0, Math.PI * 2);
          ctx.fillStyle = dark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(37, 99, 235, 0.09)';
          ctx.fill();

          ctx.beginPath();
          ctx.arc(0, 0, 9, 0, Math.PI * 2);
          ctx.strokeStyle = dark ? 'rgba(125, 211, 252, 0.48)' : 'rgba(37, 99, 235, 0.45)';
          ctx.lineWidth = 1.25;
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
    }
  };

  // Immediate redraw on theme or viewport change
  useEffect(() => {
    drawFrameRef.current();
  }, [viewport.width, viewport.height, isDark, hasFocusCity, resolvedTarget]);

  // Hardware-accelerated GPU bitmap pan/zoom glide with crisp settled vector pass
  useEffect(() => {
    if (!resolvedTarget) {
      isAnimatingRef.current = false;
      cameraRef.current = {
        lng: OVERVIEW_CENTER_LNG,
        lat: OVERVIEW_CENTER_LAT,
        spanDeg: OVERVIEW_CENTER_SPAN_DEG,
      };
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
      isAnimatingRef.current = false;
      cameraRef.current = target;
      drawFrameRef.current();
      return;
    }

    const duration = 480;
    const startedAt = performance.now();
    let rafId = 0;
    isAnimatingRef.current = true;

    const step = (now: number) => {
      const t = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      cameraRef.current = {
        lng: start.lng + deltaLng * eased,
        lat: start.lat + deltaLat * eased,
        spanDeg: start.spanDeg + deltaSpan * eased,
      };
      if (t < 1) {
        isAnimatingRef.current = true;
        drawFrameRef.current();
        rafId = requestAnimationFrame(step);
      } else {
        isAnimatingRef.current = false;
        cameraRef.current = target;
        drawFrameRef.current();
      }
    };

    rafId = requestAnimationFrame(step);
    return () => {
      isAnimatingRef.current = false;
      cancelAnimationFrame(rafId);
    };
  }, [resolvedTarget]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="app-shell-fixed w-full pointer-events-none overflow-hidden select-none"
      style={{ contain: 'strict' }}
    >
      {/* Full-Bleed Borderless Hardware-Accelerated Canvas (seam-free 50m vector + GPU motion blit) */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block will-change-transform"
        style={{ transform: 'translateZ(0)' }}
      />
    </div>
  );
});

GlobeBackdrop.displayName = 'GlobeBackdrop';
