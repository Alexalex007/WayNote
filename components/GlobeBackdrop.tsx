import React, { useEffect, useMemo, useRef, useState } from 'react';
import { geoOrthographic, geoPath, geoGraticule10 } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import worldAtlas from 'world-atlas/countries-110m.json';

interface GeoTarget {
  lng: number;
  lat: number;
  countryId?: string;
}

const CITY_GEO_MAP: Array<[string[], GeoTarget]> = [
  // Japan (ISO 392)
  [['東京', 'tokyo', '新宿', '澀谷', '淺草', '銀座', '羽田', '成田', '箱根', '鎌倉', '河口湖', '富士山', '橫濱', '日光', '輕井澤'], { lng: 139.6917, lat: 35.6895, countryId: '392' }],
  [['大阪', 'osaka', '難波', '心齋橋', '梅田', '關西'], { lng: 135.5023, lat: 34.6937, countryId: '392' }],
  [['京都', 'kyoto', '嵐山', '宇治', '奈良'], { lng: 135.7681, lat: 35.0116, countryId: '392' }],
  [['札幌', '北海道', 'sapporo', 'hokkaido', '小樽', '富良野', '函館'], { lng: 141.3545, lat: 43.0618, countryId: '392' }],
  [['沖繩', '那霸', 'okinawa', 'naha'], { lng: 127.6792, lat: 26.2124, countryId: '392' }],
  [['福岡', 'fukuoka', '九州', '由布院', '熊本', '長崎', '鹿兒島'], { lng: 130.4017, lat: 33.5902, countryId: '392' }],
  [['名古屋', 'nagoya', '白川鄉', '金澤', '合掌村'], { lng: 136.9066, lat: 35.1815, countryId: '392' }],
  [['仙台', 'sendai', '廣島', 'hiroshima', '神戶', 'kobe', '日本', 'japan'], { lng: 138.2529, lat: 36.2048, countryId: '392' }],

  // Taiwan (ISO 158)
  [['台北', '新北', '桃園', '基隆', '九份', '淡水', '宜蘭', 'taipei', 'taiwan', '台灣'], { lng: 121.5654, lat: 25.033, countryId: '158' }],
  [['台中', 'taichung', '日月潭', '南投', '阿里山'], { lng: 120.6736, lat: 24.1477, countryId: '158' }],
  [['台南', 'tainan', '高雄', 'kaohsiung', '墾丁', '花蓮', '台東'], { lng: 120.3014, lat: 22.6273, countryId: '158' }],

  // Korea (ISO 410)
  [['首爾', 'seoul', '仁川', '弘大', '明洞', '韓國', 'korea'], { lng: 126.978, lat: 37.5665, countryId: '410' }],
  [['釜山', 'busan'], { lng: 129.0756, lat: 35.1796, countryId: '410' }],
  [['濟州', 'jeju'], { lng: 126.5312, lat: 33.4996, countryId: '410' }],

  // Hong Kong / Macau / Mainland China (ISO 156)
  [['香港', 'hong kong', '澳門', 'macau', 'macao'], { lng: 114.1694, lat: 22.3193, countryId: '156' }],
  [['上海', 'shanghai', '蘇州', '烏鎮', '杭州', 'hangzhou', '南京'], { lng: 121.4737, lat: 31.2304, countryId: '156' }],
  [['北京', 'beijing', '長城', 'great wall', '哈爾濱'], { lng: 116.4074, lat: 39.9042, countryId: '156' }],
  [['成都', 'chengdu', '重慶', '九寨溝', '西安'], { lng: 104.0665, lat: 30.5728, countryId: '156' }],
  [['廣州', '深圳', '珠海', '廈門', '桂林', '麗江', '三亞'], { lng: 113.2644, lat: 23.1291, countryId: '156' }],

  // Southeast Asia
  [['曼谷', 'bangkok', '泰國', 'thailand'], { lng: 100.5018, lat: 13.7563, countryId: '764' }],
  [['清邁', 'chiang mai', '普吉', 'phuket', '蘇美島'], { lng: 98.9853, lat: 18.7883, countryId: '764' }],
  [['新加坡', 'singapore'], { lng: 103.8198, lat: 1.3521, countryId: '702' }],
  [['吉隆坡', 'kuala lumpur', '檳城', '沙巴', '馬來西亞', 'malaysia'], { lng: 101.6869, lat: 3.139, countryId: '458' }],
  [['胡志明', '河內', 'hanoi', '峴港', '越南', 'vietnam', '富國島'], { lng: 105.8342, lat: 21.0278, countryId: '704' }],
  [['峇里島', 'bali', '雅加達', '印尼', 'indonesia'], { lng: 115.1889, lat: -8.4095, countryId: '360' }],
  [['馬尼拉', '宿霧', '長灘島', '菲律賓', 'manila', 'cebu'], { lng: 120.9842, lat: 14.5995, countryId: '608' }],

  // Europe
  [['巴黎', 'paris', '尼斯', '里昂', '法國', 'france'], { lng: 2.3522, lat: 48.8566, countryId: '250' }],
  [['倫敦', 'london', '愛丁堡', '曼徹斯特', '英國', 'uk', 'england'], { lng: -0.1276, lat: 51.5072, countryId: '826' }],
  [['羅馬', 'rome', '米蘭', 'milan', '威尼斯', 'venice', '佛羅倫斯', '義大利', 'italy'], { lng: 12.4964, lat: 41.9028, countryId: '380' }],
  [['巴塞隆納', 'barcelona', '馬德里', 'madrid', '西班牙', 'spain'], { lng: 2.1734, lat: 41.3851, countryId: '724' }],
  [['阿姆斯特丹', 'amsterdam', '荷蘭', '布魯日'], { lng: 4.9041, lat: 52.3676, countryId: '528' }],
  [['蘇黎世', 'zurich', '日內瓦', '策馬特', '因特拉肯', '瑞士', 'switzerland'], { lng: 8.5417, lat: 47.3769, countryId: '756' }],
  [['慕尼黑', 'munich', '柏林', 'berlin', '法蘭克福', '德國', 'germany'], { lng: 11.582, lat: 48.1351, countryId: '276' }],
  [['維也納', 'vienna', '薩爾斯堡', '哈修塔特', '奧地利'], { lng: 16.3738, lat: 48.2082, countryId: '040' }],
  [['布拉格', 'prague', '捷克', '布達佩斯'], { lng: 14.4378, lat: 50.0755, countryId: '203' }],
  [['雷克雅維克', 'reykjavik', '冰島', 'iceland'], { lng: -21.9426, lat: 64.1466, countryId: '352' }],
  [['聖托里尼', 'santorini', '雅典', '希臘'], { lng: 25.4615, lat: 36.3932, countryId: '300' }],

  // Americas / Oceania / Middle East
  [['紐約', 'new york', '芝加哥', '美國', 'usa'], { lng: -74.006, lat: 40.7128, countryId: '840' }],
  [['舊金山', 'san francisco', '洛杉磯', 'los angeles', '西雅圖', '拉斯維加斯'], { lng: -122.4194, lat: 37.7749, countryId: '840' }],
  [['夏威夷', '檀香山', 'honolulu', 'hawaii'], { lng: -157.8583, lat: 21.3069, countryId: '840' }],
  [['溫哥華', 'vancouver', '班夫', '加拿大', 'canada'], { lng: -123.1207, lat: 49.2827, countryId: '124' }],
  [['多倫多', 'toronto'], { lng: -79.3832, lat: 43.6532, countryId: '124' }],
  [['雪梨', 'sydney', '墨爾本', 'melbourne', '布里斯本', '澳洲', 'australia'], { lng: 151.2093, lat: -33.8688, countryId: '036' }],
  [['奧克蘭', 'auckland', '皇后鎮', '紐西蘭', 'new zealand'], { lng: 174.7633, lat: -36.8485, countryId: '554' }],
  [['杜拜', 'dubai', '阿布達比', '阿聯酋'], { lng: 55.2708, lat: 25.2048, countryId: '784' }],
  [['伊斯坦堡', 'istanbul', '卡帕多奇亞', '土耳其', 'turkey'], { lng: 28.9784, lat: 41.0082, countryId: '792' }],
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

interface GlobeBackdropProps {
  focusCity?: string | null;
  isDark: boolean;
}

export const GlobeBackdrop: React.FC<GlobeBackdropProps> = React.memo(({ focusCity, isDark }) => {
  const topology = worldAtlas as unknown as Topology<{
    countries: GeometryCollection;
  }>;

  const countries = useMemo(() => {
    return feature(topology, topology.objects.countries).features;
  }, [topology]);

  const graticuleData = useMemo(() => geoGraticule10(), []);

  const [resolvedTarget, setResolvedTarget] = useState<GeoTarget>(() => {
    return lookupStaticGeo(focusCity) || { lng: 139.6917, lat: 35.6895, countryId: '392' };
  });

  useEffect(() => {
    const primary = (focusCity || '').split(/\s*[-→>/,]\s*/)[0]?.trim();
    if (!primary) return;

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
          const target: GeoTarget = { lng: first.longitude, lat: first.latitude };
          RUNTIME_GEO_CACHE.set(primary.toLowerCase(), target);
          setResolvedTarget(target);
        }
      })
      .catch(() => {
        // Ignore geocoding network fallback errors
      });

    return () => {
      cancelled = true;
    };
  }, [focusCity]);

  const [viewCoords, setViewCoords] = useState<{ lng: number; lat: number }>({
    lng: resolvedTarget.lng,
    lat: resolvedTarget.lat,
  });
  const currentCoordsRef = useRef<{ lng: number; lat: number }>({
    lng: resolvedTarget.lng,
    lat: resolvedTarget.lat,
  });

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const startLng = currentCoordsRef.current.lng;
    const startLat = currentCoordsRef.current.lat;
    const targetLng = resolvedTarget.lng;
    const targetLat = resolvedTarget.lat;

    if (
      prefersReducedMotion ||
      (Math.abs(targetLng - startLng) < 0.05 && Math.abs(targetLat - startLat) < 0.05)
    ) {
      currentCoordsRef.current = { lng: targetLng, lat: targetLat };
      setViewCoords({ lng: targetLng, lat: targetLat });
      return;
    }

    const deltaLng = (((targetLng - startLng + 540) % 360) + 360) % 360 - 180;
    const deltaLat = targetLat - startLat;
    const duration = 880;
    const startedAt = performance.now();
    let rafId = 0;

    const step = (now: number) => {
      const t = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const nextLng = startLng + deltaLng * eased;
      const nextLat = startLat + deltaLat * eased;
      currentCoordsRef.current = { lng: nextLng, lat: nextLat };
      setViewCoords({ lng: nextLng, lat: nextLat });
      if (t < 1) {
        rafId = requestAnimationFrame(step);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [resolvedTarget.lng, resolvedTarget.lat]);

  const { spherePath, graticulePath, countryPaths, markerPoint } = useMemo(() => {
    const projection = geoOrthographic()
      .scale(258)
      .translate([300, 300])
      .clipAngle(90)
      .rotate([-viewCoords.lng, -viewCoords.lat, 0]);

    const pathGen = geoPath(projection);
    const sPath = pathGen({ type: 'Sphere' }) || '';
    const gPath = pathGen(graticuleData) || '';

    const cPaths = countries.map((c) => {
      const id = c.id !== undefined ? String(c.id).padStart(3, '0') : undefined;
      return {
        id,
        d: pathGen(c) || '',
        isFocusedCountry: Boolean(resolvedTarget.countryId && id === resolvedTarget.countryId),
      };
    });

    const projected = projection([resolvedTarget.lng, resolvedTarget.lat]);
    return {
      spherePath: sPath,
      graticulePath: gPath,
      countryPaths: cPaths,
      markerPoint: projected ? { x: projected[0], y: projected[1] } : null,
    };
  }, [viewCoords.lng, viewCoords.lat, countries, graticuleData, resolvedTarget]);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none overflow-hidden select-none"
    >
      {/* Daylight Sunlit Clouds OR Night Cosmos Starfield */}
      {!isDark ? (
        <div className="absolute inset-0">
          <div
            className="absolute -top-10 left-[-14%] w-[64vw] max-w-[520px] h-52 rounded-full blur-3xl opacity-75"
            style={{ background: 'radial-gradient(closest-side, rgba(255,255,255,0.92), transparent)' }}
          />
          <div
            className="absolute top-[14%] right-[-10%] w-[58vw] max-w-[460px] h-48 rounded-full blur-3xl opacity-70"
            style={{ background: 'radial-gradient(closest-side, rgba(255,255,255,0.88), transparent)' }}
          />
          <div
            className="absolute bottom-[8%] left-[12%] w-[76vw] max-w-[660px] h-56 rounded-full blur-3xl opacity-80"
            style={{ background: 'radial-gradient(closest-side, rgba(255,255,255,0.95), transparent)' }}
          />
        </div>
      ) : (
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full opacity-90"
        >
          {STAR_COORDS.map((star, idx) => (
            <g key={idx}>
              <circle
                cx={star.x}
                cy={star.y}
                r={star.r * 0.14}
                fill="#FFFFFF"
                className={star.hero ? 'animate-star-twinkle' : undefined}
                style={
                  star.hero
                    ? { animationDelay: `${star.delay}s` }
                    : { opacity: 0.25 + (idx % 5) * 0.11 }
                }
              />
              {star.hero && (
                <path
                  d={`M${star.x - 0.5} ${star.y} L${star.x + 0.5} ${star.y} M${star.x} ${star.y - 0.5} L${star.x} ${star.y + 0.5}`}
                  stroke="#BAE6FD"
                  strokeWidth="0.08"
                  strokeLinecap="round"
                  className="animate-star-twinkle"
                  style={{ animationDelay: `${star.delay}s` }}
                />
              )}
            </g>
          ))}
        </svg>
      )}

      {/* Faint Orthographic Earth Globe Focused on Destination City */}
      <div className="absolute inset-0 flex items-center justify-center translate-y-[4%] sm:translate-x-[6%] sm:translate-y-[2%]">
        <svg
          viewBox="0 0 600 600"
          className={`w-[min(115vw,600px)] h-[min(115vw,600px)] sm:w-[640px] sm:h-[640px] lg:w-[700px] lg:h-[700px] transition-opacity duration-500 ${
            isDark ? 'opacity-[0.42]' : 'opacity-[0.52]'
          }`}
        >
          <defs>
            <radialGradient id="waynote-globe-sphere-light" cx="38%" cy="32%" r="68%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.62" />
              <stop offset="65%" stopColor="#93C5FD" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.22" />
            </radialGradient>
            <radialGradient id="waynote-globe-sphere-dark" cx="38%" cy="32%" r="68%">
              <stop offset="0%" stopColor="#1E3A8A" stopOpacity="0.34" />
              <stop offset="68%" stopColor="#0F172A" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#020617" stopOpacity="0.65" />
            </radialGradient>
          </defs>

          {/* Globe Ocean Sphere */}
          <path
            d={spherePath}
            fill={isDark ? 'url(#waynote-globe-sphere-dark)' : 'url(#waynote-globe-sphere-light)'}
            stroke={isDark ? 'rgba(125, 211, 252, 0.24)' : 'rgba(255, 255, 255, 0.85)'}
            strokeWidth={1.25}
          />

          {/* Latitude / Longitude Graticule */}
          <path
            d={graticulePath}
            fill="none"
            stroke={isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(59, 130, 246, 0.14)'}
            strokeWidth={0.65}
          />

          {/* Country / Region Polygons */}
          <g>
            {countryPaths.map((c, idx) =>
              c.d ? (
                <path
                  key={`${c.id || 'r'}-${idx}`}
                  d={c.d}
                  fill={
                    c.isFocusedCountry
                      ? isDark
                        ? 'rgba(56, 189, 248, 0.32)'
                        : 'rgba(37, 99, 235, 0.24)'
                      : isDark
                        ? 'rgba(148, 163, 184, 0.16)'
                        : 'rgba(255, 255, 255, 0.68)'
                  }
                  stroke={
                    c.isFocusedCountry
                      ? isDark
                        ? 'rgba(125, 211, 252, 0.72)'
                        : 'rgba(37, 99, 235, 0.5)'
                      : isDark
                        ? 'rgba(148, 163, 184, 0.22)'
                        : 'rgba(96, 165, 250, 0.34)'
                  }
                  strokeWidth={c.isFocusedCountry ? 1.1 : 0.6}
                  strokeLinejoin="round"
                />
              ) : null
            )}
          </g>

          {/* Destination Center Marker */}
          {markerPoint && (
            <g transform={`translate(${markerPoint.x}, ${markerPoint.y})`}>
              <circle
                r="14"
                fill={isDark ? 'rgba(56, 189, 248, 0.22)' : 'rgba(37, 99, 235, 0.18)'}
              />
              <circle
                r="6.5"
                fill="none"
                stroke={isDark ? '#7DD3FC' : '#2563EB'}
                strokeWidth="1.2"
                strokeOpacity="0.65"
              />
              <circle
                r="3.2"
                fill={isDark ? '#38BDF8' : '#2563EB'}
                stroke="#FFFFFF"
                strokeWidth="1.2"
              />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
});

GlobeBackdrop.displayName = 'GlobeBackdrop';
