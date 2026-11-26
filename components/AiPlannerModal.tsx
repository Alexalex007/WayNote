import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trip, Activity } from '../types';
import { generateUniqueId } from '../shared/syncMerge';
import { useI18n } from '../hooks/useI18n';
import {
  formatDayBadge,
  formatDurationLabel,
  formatTimeDisplay,
  localizeDestinationLabel,
} from '../shared/i18n';
import { LiquidModal, SlidingSegmentedControl } from './LiquidPrimitives';
import { StepperPill, SendPlaneButton, StampButton } from './TactileButtons';
import { tactileAudio } from '../services/tactileAudio';
import {
  SparklesIcon,
  MapIcon,
  CameraIcon,
  DiningIcon,
  BusIcon,
  NavigationArrowIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  RefreshIcon,
} from './Icons';

export interface AiPlannedStop {
  time: string;
  title: string;
  location: string;
  duration: string;
  type: 'sightseeing' | 'food' | 'transport';
  description: string;
}

export interface AiPlannedDay {
  dayNumber: number;
  theme: string;
  stops: AiPlannedStop[];
}

export interface AiPlanResult {
  summary: string;
  routeTip: string;
  days: AiPlannedDay[];
}

interface AiPlannerModalProps {
  open: boolean;
  onClose: () => void;
  trip: Trip;
  dates: string[];
  selectedDate: string;
  onApplyPlan: (options: {
    startDate: string;
    mode: 'single_day' | 'multi_day';
    applyStrategy: 'append' | 'replace';
    days: AiPlannedDay[];
  }) => void;
  onOpenRouteForStops: (stops: Activity[]) => void;
}

function addDaysUtcIso(dateStr: string, offset: number): string {
  const ms = Date.parse(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(ms)) return dateStr;
  const d = new Date(ms);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

export const AiPlannerModal: React.FC<AiPlannerModalProps> = ({
  open,
  onClose,
  trip,
  dates,
  selectedDate,
  onApplyPlan,
  onOpenRouteForStops,
}) => {
  const { lang, t } = useI18n();
  const [mode, setMode] = useState<'single_day' | 'multi_day'>('single_day');
  const [pace, setPace] = useState<'relaxed' | 'balanced' | 'packed'>('balanced');
  const [targetStartDate, setTargetStartDate] = useState<string>(selectedDate || trip.startDate);
  const [daysCount, setDaysCount] = useState<number>(Math.min(Math.max(dates.length || 3, 2), 5));
  const [destinationInput, setDestinationInput] = useState<string>(() =>
    localizeDestinationLabel(trip.destination, lang)
  );
  const [userPrompt, setUserPrompt] = useState<string>('');
  const [applyStrategy, setApplyStrategy] = useState<'append' | 'replace'>('replace');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<AiPlanResult | null>(null);
  const [previewDayIdx, setPreviewDayIdx] = useState(0);

  const quickInterestChips = useMemo(
    () => [
      t('經典必去地標', '经典必去地标', 'Must-see Landmarks'),
      t('在地人美食', '地道美食', 'Local Food'),
      t('高質感咖啡廳', '高质感咖啡馆', 'Artisan Cafes'),
      t('文青逛街散策', '文青逛街漫步', 'Shopping & Strolls'),
      t('夜景與攝影', '夜景与摄影', 'Night Views & Photo Spots'),
      t('親子輕鬆漫遊', '亲子轻松漫游', 'Family-Friendly'),
    ],
    [t]
  );

  useEffect(() => {
    if (open) {
      setTargetStartDate(selectedDate || trip.startDate);
      setDestinationInput((prev) => prev || localizeDestinationLabel(trip.destination, lang));
      setErrorMsg(null);
    }
  }, [open, selectedDate, trip.startDate, trip.destination, lang]);

  const effectiveEndDate = useMemo(() => {
    const count = mode === 'single_day' ? 1 : daysCount;
    return addDaysUtcIso(targetStartDate, count - 1);
  }, [mode, daysCount, targetStartDate]);

  const willExtendTripEnd = useMemo(() => {
    return Boolean(effectiveEndDate && trip.endDate && effectiveEndDate > trip.endDate);
  }, [effectiveEndDate, trip.endDate]);

  const toggleQuickInterest = (chip: string) => {
    const sep = lang === 'en' ? ', ' : '、';
    setUserPrompt((prev) => {
      const trimmed = prev.trim();
      if (trimmed.includes(chip)) return prev;
      return trimmed ? `${trimmed}${sep}${chip}` : chip;
    });
  };

  const handleGenerate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 58000);

    try {
      const hotelsList = (trip.hotels || []).slice(0, 4).map((h) => `${h.name} (${h.checkIn}~${h.checkOut})`);
      const existingActivities = trip.activities?.[targetStartDate] || [];
      const existingSummary =
        existingActivities.length > 0
          ? `${t('該日目前已有：', '该日目前已有：', 'Already planned for this day: ')}${existingActivities
              .slice(0, 6)
              .map((a) => `${a.time} ${a.title}`)
              .join(lang === 'en' ? ', ' : '、')}`.slice(0, 260)
          : '';

      const res = await fetch('/api/ai/plan-itinerary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/x-ndjson, application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          destination: destinationInput.trim() || localizeDestinationLabel(trip.destination, lang),
          userPrompt: userPrompt.trim(),
          mode,
          daysCount: mode === 'single_day' ? 1 : daysCount,
          startDate: targetStartDate,
          pace,
          hotels: hotelsList,
          existingSummary,
          lang,
        }),
      });

      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      let payload: unknown = null;

      if (contentType.includes('application/x-ndjson') && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let streamError: string | null = null;

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) continue;
            try {
              const event = JSON.parse(line) as { type?: string; data?: unknown; error?: string };
              if (event.type === 'result' && event.data) {
                payload = event.data;
              } else if (event.type === 'error') {
                streamError = event.error || t('AI 行程規劃失敗，請稍後再試。', 'AI 行程规划失败，请稍后再试。', 'AI itinerary planning failed. Please try again.');
              }
            } catch {
              // ignore malformed keepalive fragment
            }
          }
        }
        if (buffer.trim()) {
          try {
            const event = JSON.parse(buffer.trim()) as { type?: string; data?: unknown; error?: string };
            if (event.type === 'result' && event.data) {
              payload = event.data;
            } else if (event.type === 'error') {
              streamError = event.error || t('AI 行程規劃失敗，請稍後再試。', 'AI 行程规划失败，请稍后再试。', 'AI itinerary planning failed. Please try again.');
            }
          } catch {
            // ignore trailing fragment
          }
        }
        if (streamError) {
          throw new Error(streamError);
        }
        if (!res.ok && !payload) {
          throw new Error(t('AI 行程規劃失敗，請稍後再試。', 'AI 行程规划失败，请稍后再试。', 'AI itinerary planning failed. Please try again.'));
        }
      } else if (contentType.includes('text/html')) {
        throw new Error(
          t(
            '目前網站為純靜態託管環境，AI 規劃需透過整合伺服器的網址執行。',
            '目前网站为纯静态托管环境，AI 规划需通过整合服务器的网址执行。',
            'Static hosting detected. AI planning requires the integrated server endpoint.'
          )
        );
      } else {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            (data as { error?: string })?.error ||
              t('AI 行程規劃失敗，請稍後再試。', 'AI 行程规划失败，请稍后再试。', 'AI itinerary planning failed. Please try again.')
          );
        }
        payload = data;
      }

      const parsed = payload as AiPlanResult | null;
      if (!parsed || !Array.isArray(parsed.days) || parsed.days.length === 0) {
        throw new Error(
          t(
            'AI 未能產生有效的每日行程，請補充目的地或景點描述再試一次。',
            'AI 未能生成有效的每日行程，请补充目的地或景点描述再试一次。',
            'AI could not generate valid daily stops. Please add more destination details and retry.'
          )
        );
      }

      setResult(parsed);
      setPreviewDayIdx(0);
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') {
        setErrorMsg(
          t(
            'AI 規劃回應逾時，請稍後再按一次規劃。',
            'AI 规划响应超时，请稍后再按一次规划。',
            'AI planning timed out. Please try again.'
          )
        );
      } else {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : t('AI 行程規劃請求發生錯誤。', 'AI 行程规划请求发生错误。', 'An error occurred during AI planning.')
        );
      }
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const activePreviewDay = result?.days?.[previewDayIdx] || result?.days?.[0] || null;

  const previewActivities = useMemo<Activity[]>(() => {
    if (!activePreviewDay) return [];
    return activePreviewDay.stops.map((s) => ({
      id: generateUniqueId('ai_preview'),
      time: s.time,
      title: s.title,
      location: s.location || s.title,
      completed: false,
      type: s.type,
      duration: s.duration,
      description: s.description,
    }));
  }, [activePreviewDay]);

  const googleMapsDayRouteUrl = useMemo(() => {
    if (!activePreviewDay || activePreviewDay.stops.length === 0) return '#';
    const stops = activePreviewDay.stops;
    const getQ = (s: AiPlannedStop) => encodeURIComponent(s.location || s.title);
    const origin = getQ(stops[0]);
    const dest = getQ(stops[stops.length - 1]);
    const mid = stops.slice(1, -1).map(getQ);
    const waypoints = mid.length > 0 ? `&waypoints=${mid.join('|')}` : '';
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}${waypoints}&travelmode=transit`;
  }, [activePreviewDay]);

  const handleApply = () => {
    if (!result || result.days.length === 0) return;
    onApplyPlan({
      startDate: targetStartDate,
      mode,
      applyStrategy,
      days: result.days,
    });
    onClose();
  };

  return (
    <LiquidModal
      open={open}
      onClose={onClose}
      bottomSheetOnMobile
      maxWidthClass="max-w-3xl"
      title={
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[var(--tab-accent-soft)] text-[var(--tab-accent)] flex items-center justify-center shrink-0">
            <SparklesIcon className="w-4 h-4" />
          </div>
          <span>{t('AI 智慧行程與路線規劃', 'AI 智能行程与路线规划', 'AI Smart Itinerary & Route Planner')}</span>
        </div>
      }
    >
      <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar pr-0.5 space-y-4">
          {!result ? (
            <form onSubmit={handleGenerate} className="space-y-4">
              {/* Top Configuration Row: Mode + Pace */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 block px-0.5">
                    {t('規劃天數模式', '规划天数模式', 'Planning Mode')}
                  </label>
                  <SlidingSegmentedControl
                    fullWidth
                    value={mode}
                    onChange={(val) => setMode(val)}
                    options={[
                      { id: 'single_day', label: t('單日行程', '单日行程', 'Single Day') },
                      { id: 'multi_day', label: t('多日行程', '多日行程', 'Multi-Day') },
                    ]}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 block px-0.5">
                    {t('每日節奏步調', '每日节奏步调', 'Daily Pace')}
                  </label>
                  <SlidingSegmentedControl
                    fullWidth
                    value={pace}
                    onChange={(val) => setPace(val)}
                    options={[
                      { id: 'relaxed', label: t('悠閒', '悠闲', 'Relaxed') },
                      { id: 'balanced', label: t('適中', '适中', 'Balanced') },
                      { id: 'packed', label: t('充實', '充实', 'Packed') },
                    ]}
                  />
                </div>
              </div>

              {/* Destination & Target Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-6 space-y-1.5">
                  <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 block px-0.5">
                    {t('主要城市或區域', '主要城市或区域', 'City or Area')}
                  </label>
                  <div className="bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200/70 dark:border-white/10 rounded-2xl px-3.5 h-11 flex items-center gap-2">
                    <MapIcon className="w-4 h-4 text-[var(--tab-accent)] shrink-0" />
                    <input
                      type="text"
                      value={destinationInput}
                      onChange={(e) => setDestinationInput(e.target.value)}
                      placeholder={t('例如：京都、嵐山與宇治', '例如：京都、岚山与宇治', 'e.g. Kyoto, Arashiyama & Uji')}
                      className="bg-transparent w-full text-sm font-semibold text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div className={`${mode === 'multi_day' ? 'sm:col-span-3' : 'sm:col-span-6'} space-y-1.5`}>
                  <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 block px-0.5">
                    {mode === 'single_day'
                      ? t('套用日期', '应用日期', 'Target Date')
                      : t('起始日期', '起始日期', 'Start Date')}
                  </label>
                  <div className="bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200/70 dark:border-white/10 rounded-2xl px-3 h-11 flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-zinc-400 shrink-0" />
                    <select
                      value={targetStartDate}
                      onChange={(e) => setTargetStartDate(e.target.value)}
                      className="bg-transparent w-full text-xs sm:text-sm font-num font-semibold text-zinc-900 dark:text-white focus:outline-none"
                    >
                      {dates.map((d, i) => (
                        <option key={d} value={d} className="bg-white dark:bg-zinc-900">
                          {formatDayBadge(i + 1, lang)} · {d.slice(5)}
                        </option>
                      ))}
                      {!dates.includes(targetStartDate) && targetStartDate && (
                        <option value={targetStartDate} className="bg-white dark:bg-zinc-900">
                          {targetStartDate}
                        </option>
                      )}
                    </select>
                  </div>
                </div>

                {mode === 'multi_day' && (
                  <div className="sm:col-span-3 space-y-1.5">
                    <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 block px-0.5">
                      {t('規劃天數', '规划天数', 'Duration')}
                    </label>
                    <StepperPill
                      size="sm"
                      min={1}
                      max={10}
                      value={daysCount}
                      onChange={setDaysCount}
                      formatValue={(d) => t(`${d} 天`, `${d} 天`, `${d} ${d === 1 ? 'Day' : 'Days'}`)}
                      ariaLabel={t('規劃天數', '规划天数', 'Duration')}
                      className="w-full"
                    />
                  </div>
                )}
              </div>

              {willExtendTripEnd && (
                <div className="px-3.5 py-2 rounded-2xl bg-[var(--tab-accent-soft)] text-[var(--tab-accent)] text-xs font-medium">
                  {t(
                    `套用此多日規劃時，將自動把旅程結束日延展至 ${effectiveEndDate} 以容納全部天數。`,
                    `应用此多日规划时，将自动把旅程结束日延展至 ${effectiveEndDate} 以容纳全部天数。`,
                    `Applying this plan will automatically extend your trip end date to ${effectiveEndDate}.`
                  )}
                </div>
              )}

              {/* Free Prompt + Quick Interest Tags */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 block px-0.5">
                  {t('想去的地點、餐廳或主題想法（自由填寫）', '想去的地点、餐厅或主题想法（自由填写）', 'Must-visit spots, restaurants, or themes (optional)')}
                </label>
                <textarea
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  placeholder={t(
                    '例如：想去清水寺、花見小路、錦市場吃午餐，傍晚去鴨川散步，想找安靜有特色的抹茶咖啡廳...',
                    '例如：想去清水寺、花见小路、锦市场吃午餐，傍晚去鸭川散步，想找安静有特色的抹茶咖啡馆...',
                    'e.g. Kiyomizu-dera, Nishiki Market for lunch, evening walk by Kamogawa River, and a cozy matcha cafe...'
                  )}
                  rows={3}
                  className="w-full rounded-2xl bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200/70 dark:border-white/10 p-3.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[var(--tab-accent)]/35 resize-none"
                />
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {quickInterestChips.map((chip) => {
                    const selected = userPrompt.includes(chip);
                    return (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => toggleQuickInterest(chip)}
                        className={`h-7 px-3 rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
                          selected
                            ? 'bg-[var(--tab-accent)] text-white'
                            : 'bg-zinc-100 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-white/10'
                        }`}
                      >
                        + {chip}
                      </button>
                    );
                  })}
                </div>
              </div>

              {errorMsg && (
                <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/25 text-xs font-medium text-red-600 dark:text-red-400">
                  {errorMsg}
                </div>
              )}

              <SendPlaneButton
                type="submit"
                sending={loading}
                disabled={loading || (!destinationInput.trim() && !userPrompt.trim())}
                idleLabel={t('開始 AI 規劃行程與路線', '开始 AI 规划行程与路线', 'Generate AI Itinerary & Route')}
                sendingLabel={t('正在為您規劃最佳順路行程...', '正在为您规划最佳顺路行程...', 'Crafting optimal itinerary & route...')}
                icon={<SparklesIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}
                className="w-full min-h-[48px]"
              />
            </form>
          ) : (
            <div className="space-y-4">
              {/* Summary & Route Tip Card */}
              <div className="ink-card rounded-2xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-semibold text-white/65">
                      {t(
                        `AI 動線推薦 · 共 ${result.days.length} 天行程`,
                        `AI 动线推荐 · 共 ${result.days.length} 天行程`,
                        `AI Route Plan · ${result.days.length} ${result.days.length === 1 ? 'Day' : 'Days'}`
                      )}
                    </span>
                    <p className="text-sm font-semibold text-white mt-0.5 leading-relaxed">
                      {result.summary}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setResult(null)}
                    className="h-8 px-3 rounded-full bg-white/12 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <RefreshIcon className="w-3.5 h-3.5" />
                    <span>{t('重新調整', '重新调整', 'Adjust')}</span>
                  </button>
                </div>
                {result.routeTip && (
                  <div className="pt-2 border-t border-white/10 text-xs text-white/80 flex items-start gap-2">
                    <NavigationArrowIcon className="w-3.5 h-3.5 text-[#FF9E7B] shrink-0 mt-0.5" />
                    <span>{result.routeTip}</span>
                  </div>
                )}
              </div>

              {/* Multi-day Preview Tab Strip */}
              {result.days.length > 1 && (
                <div className="overflow-x-auto no-scrollbar">
                  <SlidingSegmentedControl
                    value={String(previewDayIdx)}
                    onChange={(v) => setPreviewDayIdx(Number(v))}
                    options={result.days.map((d, idx) => ({
                      id: String(idx),
                      label: `${formatDayBadge(d.dayNumber, lang)} (${addDaysUtcIso(targetStartDate, idx).slice(5)})`,
                    }))}
                  />
                </div>
              )}

              {/* Day Preview Stops */}
              <AnimatePresence mode="wait">
                {activePreviewDay && (
                  <motion.div
                    key={previewDayIdx}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                    className="space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2 px-1">
                      <div>
                        <span className="text-[11px] font-num text-zinc-400">
                          {addDaysUtcIso(targetStartDate, previewDayIdx)}
                        </span>
                        <h4 className="font-display font-bold text-sm sm:text-base text-zinc-900 dark:text-white">
                          {activePreviewDay.theme}
                        </h4>
                      </div>
                      <a
                        href={googleMapsDayRouteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-[var(--tab-accent)] hover:underline inline-flex items-center gap-1 shrink-0"
                      >
                        <MapIcon className="w-3.5 h-3.5" />
                        <span>{t('Google Maps 路線', 'Google 地图路线', 'Google Maps Route')}</span>
                      </a>
                    </div>

                    <div className="space-y-2">
                      {activePreviewDay.stops.map((stop, idx) => {
                        const TypeIcon =
                          stop.type === 'food'
                            ? DiningIcon
                            : stop.type === 'transport'
                              ? BusIcon
                              : CameraIcon;
                        const timeObj = formatTimeDisplay(stop.time, lang);
                        const timeLabel = timeObj.suffix ? `${timeObj.main} ${timeObj.suffix}` : timeObj.main;
                        return (
                          <div
                            key={`${idx}_${stop.title}`}
                            className="rounded-2xl p-3.5 bg-zinc-100/80 dark:bg-white/[0.045] border border-zinc-200/70 dark:border-white/[0.08] flex items-start gap-3"
                          >
                            <div className="w-8 h-8 rounded-full bg-[var(--tab-accent-soft)] text-[var(--tab-accent)] flex items-center justify-center shrink-0 mt-0.5">
                              <TypeIcon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-display font-bold text-sm text-zinc-900 dark:text-white truncate">
                                  {idx + 1}. {stop.title}
                                </span>
                                <span className="text-xs font-num font-semibold text-[var(--tab-accent)] shrink-0 flex items-center gap-1">
                                  <ClockIcon className="w-3 h-3" />
                                  {timeLabel} · {formatDurationLabel(stop.duration, lang)}
                                </span>
                              </div>
                              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                                {stop.location}
                              </p>
                              {stop.description && (
                                <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1 leading-relaxed">
                                  {stop.description}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Apply Strategy Toggle */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-200/70 dark:border-white/10">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {t(
                    `套用方式（從 ${targetStartDate} 開始）：`,
                    `应用方式（从 ${targetStartDate} 开始）：`,
                    `Apply starting ${targetStartDate}:`
                  )}
                </span>
                <SlidingSegmentedControl
                  size="sm"
                  value={applyStrategy}
                  onChange={(v) => setApplyStrategy(v)}
                  options={[
                    { id: 'replace', label: t('覆蓋所選日期', '覆盖所选日期', 'Replace Selected') },
                    { id: 'append', label: t('加入現有行程', '加入现有行程', 'Append to Day') },
                  ]}
                />
              </div>
            </div>
          )}
        </div>

        {/* Result Footer Actions */}
        {result && (
          <div className="pt-3 border-t border-zinc-200/70 dark:border-white/10 flex flex-col sm:flex-row gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                tactileAudio.playClick(520);
                onOpenRouteForStops(previewActivities);
              }}
              className="sm:flex-1 min-h-[46px] px-4 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200/80 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.97]"
            >
              <NavigationArrowIcon className="w-4 h-4 text-[var(--tab-accent)]" />
              <span>{t('預覽互動路線圖', '预览交互路线图', 'Interactive Route Map')}</span>
            </button>
            <StampButton
              stamped
              onClick={handleApply}
              idleLabel={
                result.days.length > 1
                  ? t(
                      `滿意，套用這 ${result.days.length} 天完整行程`,
                      `满意，应用这 ${result.days.length} 天完整行程`,
                      `Apply ${result.days.length}-Day Itinerary`
                    )
                  : t(
                      `滿意，套用到 ${targetStartDate.slice(5)}`,
                      `满意，应用到 ${targetStartDate.slice(5)}`,
                      `Apply to ${targetStartDate.slice(5)}`
                    )
              }
              stampedLabel={
                result.days.length > 1
                  ? t(
                      `滿意，套用這 ${result.days.length} 天完整行程`,
                      `满意，应用这 ${result.days.length} 天完整行程`,
                      `Apply ${result.days.length}-Day Itinerary`
                    )
                  : t(
                      `滿意，套用到 ${targetStartDate.slice(5)}`,
                      `满意，应用到 ${targetStartDate.slice(5)}`,
                      `Apply to ${targetStartDate.slice(5)}`
                    )
              }
              stampedIcon={<CheckIcon className="w-4 h-4" />}
              className="sm:flex-1 min-h-[46px] rounded-full"
            />
          </div>
        )}
      </div>
    </LiquidModal>
  );
};
