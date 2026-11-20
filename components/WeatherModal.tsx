import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { LiquidModal } from './LiquidPrimitives';
import { SunIcon, MoonIcon, CloudIcon, RefreshIcon, SparklesIcon } from './Icons';
import { getDestinationLocalTime } from '../shared/destinationIntel';

export type WeatherKind = 'clear' | 'partly' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm';

export interface WeatherForecastData {
  city: string;
  resolvedName: string;
  country: string;
  timezone: string;
  utcOffsetHours: number;
  fetchedAt: number;
  current: {
    temp: number;
    feelsLike: number;
    humidity: number;
    windSpeed: number;
    precipitation: number;
    isDay: boolean;
    label: string;
    kind: WeatherKind;
  };
  hourly: Array<{
    time: string;
    temp: number;
    precipProb: number;
    kind: WeatherKind;
    label: string;
    isDay: boolean;
  }>;
  daily: Array<{
    date: string;
    tempMax: number;
    tempMin: number;
    precipProb: number;
    uvMax: number;
    sunrise: string;
    sunset: string;
    kind: WeatherKind;
    label: string;
  }>;
}

export const WeatherGlyph: React.FC<{ kind: WeatherKind; isDay?: boolean; className?: string }> = ({
  kind,
  isDay = true,
  className = 'w-6 h-6',
}) => {
  if (kind === 'clear') {
    return isDay ? (
      <SunIcon className={`${className} text-amber-400`} />
    ) : (
      <MoonIcon className={`${className} text-indigo-300`} />
    );
  }
  if (kind === 'partly') {
    return <SunIcon className={`${className} text-amber-300`} />;
  }
  if (kind === 'rain' || kind === 'storm') {
    return <CloudIcon className={`${className} text-blue-400`} />;
  }
  if (kind === 'snow') {
    return <SparklesIcon className={`${className} text-sky-300`} />;
  }
  return <CloudIcon className={`${className} text-zinc-400`} />;
};

const clientWeatherMemoryCache = new Map<string, { expiresAt: number; data: WeatherForecastData }>();

export function useLiveWeather(city: string | null) {
  const [data, setData] = useState<WeatherForecastData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!city) return;
    const key = city.trim().toLowerCase();
    const cached = clientWeatherMemoryCache.get(key);
    if (cached && cached.expiresAt > Date.now() && tick === 0) {
      setData(cached.data);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/weather?city=${encodeURIComponent(city.trim())}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || '無法取得即時天氣');
        return json as WeatherForecastData;
      })
      .then((payload) => {
        if (cancelled) return;
        clientWeatherMemoryCache.set(key, {
          expiresAt: Date.now() + 8 * 60 * 1000,
          data: payload,
        });
        setData(payload);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : '天氣載入失敗');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [city, tick]);

  const refresh = () => setTick((t) => t + 1);
  return { data, loading, error, refresh };
}

interface WeatherModalProps {
  open: boolean;
  onClose: () => void;
  cities: string[];
  initialCity?: string;
}

export const WeatherModal: React.FC<WeatherModalProps> = ({ open, onClose, cities, initialCity }) => {
  const uniqueCities = useMemo(() => {
    const cleaned = cities.map((c) => c.trim()).filter(Boolean);
    return Array.from(new Set(cleaned));
  }, [cities]);

  const [selectedCity, setSelectedCity] = useState<string>(initialCity || uniqueCities[0] || '東京');

  useEffect(() => {
    if (open) {
      setSelectedCity(initialCity || uniqueCities[0] || '東京');
    }
  }, [open, initialCity, uniqueCities]);

  const { data, loading, error, refresh } = useLiveWeather(open ? selectedCity : null);

  const tempBounds = useMemo(() => {
    if (!data?.daily || data.daily.length === 0) return { min: 0, max: 30 };
    const min = Math.min(...data.daily.map((d) => d.tempMin));
    const max = Math.max(...data.daily.map((d) => d.tempMax));
    return { min, max: Math.max(max, min + 1) };
  }, [data]);

  const outfitAdvice = useMemo(() => {
    if (!data) return '';
    const t = data.current.temp;
    const rain = data.daily[0]?.precipProb ?? 0;
    const parts: string[] = [];
    if (t <= 8) parts.push('氣溫偏低，建議備好保暖外套');
    else if (t <= 16) parts.push('早晚微涼，適合薄外套疊穿');
    else if (t <= 24) parts.push('體感舒適，長袖或薄針織即可');
    else parts.push('天氣溫暖，建議透氣衣物並多補水');

    if (rain >= 45) parts.push('降雨機率較高，建議隨身帶傘');
    return parts.join('；');
  }, [data]);

  const formatWeekday = (dateStr: string, idx: number) => {
    if (idx === 0) return '今天';
    const d = new Date(dateStr + 'T00:00:00');
    const days = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
    return days[d.getDay()] || dateStr.slice(5);
  };

  return (
    <LiquidModal
      open={open}
      onClose={onClose}
      maxWidthClass="max-w-lg"
      bottomSheetOnMobile
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center">
            <CloudIcon className="w-4 h-4" />
          </div>
          <span>即時天氣</span>
        </div>
      }
    >
      <div className="overflow-y-auto no-scrollbar space-y-4 pr-0.5">
        {uniqueCities.length > 1 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {uniqueCities.map((c) => {
              const active = c === selectedCity;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelectedCity(c)}
                  className={`min-h-[38px] px-4 rounded-full text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                      : 'surface-card text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        )}

        {loading && !data ? (
          <div className="ink-card rounded-3xl p-8 flex flex-col items-center justify-center gap-3 text-center">
            <div className="w-7 h-7 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
            <p className="text-xs font-medium text-zinc-300">正在取得「{selectedCity}」氣象</p>
          </div>
        ) : error ? (
          <div className="surface-card rounded-3xl p-6 text-center space-y-3">
            <p className="text-sm font-semibold text-red-500">{error}</p>
            <button
              type="button"
              onClick={refresh}
              className="min-h-[40px] px-5 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold cursor-pointer"
            >
              重新載入
            </button>
          </div>
        ) : data ? (
          <>
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="ink-card rounded-3xl p-6 relative overflow-hidden"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-medium text-zinc-400 font-num">
                    {data.resolvedName} · {data.country} · {getDestinationLocalTime(data.utcOffsetHours).timeStr}
                  </div>
                  <div className="mt-2 flex items-baseline gap-3">
                    <span className="text-5xl font-display font-bold tracking-tight font-num text-white">
                      {data.current.temp}°
                    </span>
                    <span className="text-sm font-semibold text-blue-400">{data.current.label}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center">
                    <WeatherGlyph kind={data.current.kind} isDay={data.current.isDay} className="w-6 h-6" />
                  </div>
                  <button
                    type="button"
                    onClick={refresh}
                    aria-label="重新整理天氣"
                    className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/18 text-zinc-200 flex items-center justify-center cursor-pointer transition-colors"
                  >
                    <RefreshIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-white/10 text-xs">
                <div>
                  <div className="text-zinc-400">體感</div>
                  <div className="font-num font-semibold text-sm text-white mt-0.5">{data.current.feelsLike}°C</div>
                </div>
                <div>
                  <div className="text-zinc-400">濕度</div>
                  <div className="font-num font-semibold text-sm text-white mt-0.5">{data.current.humidity}%</div>
                </div>
                <div>
                  <div className="text-zinc-400">風速</div>
                  <div className="font-num font-semibold text-sm text-white mt-0.5">{data.current.windSpeed} km/h</div>
                </div>
              </div>

              {outfitAdvice && (
                <p className="mt-4 text-xs text-zinc-300 leading-relaxed bg-white/[0.06] rounded-2xl px-3.5 py-2.5">
                  {outfitAdvice}
                </p>
              )}
            </motion.div>

            {/* Hourly Strip */}
            <div className="surface-card rounded-3xl p-4">
              <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-3 px-1">未來 12 小時</div>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {data.hourly.map((h, i) => (
                  <div
                    key={h.time}
                    className={`min-w-[64px] py-2.5 px-2 rounded-2xl flex flex-col items-center gap-1.5 ${
                      i === 0
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                        : 'bg-zinc-100/70 dark:bg-white/[0.04] text-zinc-800 dark:text-zinc-200'
                    }`}
                  >
                    <span className="text-[11px] font-num font-medium opacity-75">
                      {i === 0 ? '現在' : h.time.slice(11, 16)}
                    </span>
                    <WeatherGlyph kind={h.kind} isDay={h.isDay} className="w-5 h-5" />
                    <span className="text-xs font-num font-bold">{h.temp}°</span>
                    {h.precipProb > 0 && (
                      <span className="text-[10px] font-num text-blue-500 font-semibold">{h.precipProb}%</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 7-Day Daily Forecast */}
            <div className="surface-card rounded-3xl p-4 space-y-2">
              <div className="flex items-center justify-between px-1 mb-1">
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">未來 7 日</span>
                {data.daily[0]?.sunrise && (
                  <span className="text-[11px] font-num text-zinc-500 dark:text-zinc-400">
                    日出 {data.daily[0].sunrise} · 日落 {data.daily[0].sunset}
                  </span>
                )}
              </div>

              {data.daily.map((d, idx) => {
                const rangeSpan = tempBounds.max - tempBounds.min;
                const leftPct = ((d.tempMin - tempBounds.min) / rangeSpan) * 100;
                const widthPct = Math.max(8, ((d.tempMax - d.tempMin) / rangeSpan) * 100);
                return (
                  <div
                    key={d.date}
                    className="flex items-center gap-3 py-1.5 px-2 rounded-xl hover:bg-zinc-900/[0.03] dark:hover:bg-white/[0.04] transition-colors"
                  >
                    <div className="w-12 text-xs font-semibold text-zinc-800 dark:text-zinc-200 shrink-0">
                      {formatWeekday(d.date, idx)}
                    </div>
                    <div className="w-7 flex justify-center shrink-0">
                      <WeatherGlyph kind={d.kind} isDay className="w-5 h-5" />
                    </div>
                    <div className="w-10 text-[11px] font-num text-blue-600 dark:text-blue-400 font-semibold shrink-0 text-right">
                      {d.precipProb > 10 ? `${d.precipProb}%` : ''}
                    </div>
                    <div className="w-8 text-xs font-num text-zinc-500 dark:text-zinc-400 text-right shrink-0">
                      {d.tempMin}°
                    </div>
                    <div className="flex-1 h-1.5 rounded-full bg-zinc-900/10 dark:bg-white/10 relative overflow-hidden">
                      <div
                        className="absolute top-0 bottom-0 rounded-full bg-gradient-to-r from-blue-500 via-sky-400 to-amber-400"
                        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                      />
                    </div>
                    <div className="w-8 text-xs font-num font-bold text-zinc-900 dark:text-white shrink-0">
                      {d.tempMax}°
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : null}
      </div>
    </LiquidModal>
  );
};
