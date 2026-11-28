import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';
import { Trip, Tab, TripType, Stop, Activity, ThemeMode, SyncDevice } from './types';
import { useTripSync, detectEditedSection, RemoteChangeNotification } from './hooks/useTripSync';
import { useCloudAccountSync } from './hooks/useCloudAccountSync';
import { fetchDestinationPhotoFast } from './hooks/useDestinationPhoto';
import { mergeTrips, generateSyncCode, normalizeSyncCode } from './shared/syncMerge';
import { detectDestinationIntel, getDestinationLocalTime } from './shared/destinationIntel';
import { useI18n } from './hooks/useI18n';
import { useTactileSound } from './hooks/useTactileSound';
import { useAiAccess } from './hooks/useAiAccess';
import { subscribeAiEnableRequest } from './services/aiGuard';
import { tactileAudio } from './services/tactileAudio';
import {
  AppLanguage,
  LANGUAGE_OPTIONS,
  formatDayProgress,
  formatHomeCardDateParts,
  getChangelogItems,
  localizeDestinationLabel,
  tr,
} from './shared/i18n';
import ItineraryTool from './components/ItineraryTool';
import ExploreTool from './components/ExploreTool';
import ExpensesTool from './components/FoodTool';
import PrepToolboxTool from './components/PrepToolboxTool';
import { GlobeBackdrop } from './components/GlobeBackdrop';
import { DateRangeCalendar, getTodayLocalIso, addDaysUtc, getDaySpanUtc } from './components/DateRangeCalendar';
import { SyncHubModal } from './components/SyncHubModal';
import { AuthModal } from './components/AuthModal';
import { WeatherModal, WeatherGlyph, useLiveWeather } from './components/WeatherModal';
import {
  LiquidModal,
  ConfirmSheet,
  ToastBanner,
  TopSyncBubble,
  SyncBubbleMessage,
  SlidingSegmentedControl,
  useAnyModalOpen,
} from './components/LiquidPrimitives';
import { DestinationCover } from './components/DestinationCover';
import {
  StretchToggle,
  CopyMorphButton,
  DownloadProgressButton,
  ShareAppButton,
  DayNightOrbButton,
  MovingBorderBeamButton,
  SwipeConfirmButton,
} from './components/TactileButtons';
import {
  buildTripIcs,
  buildDayIcs,
  buildGoogleCalendarEventUrl,
  buildGoogleCalendarDayBatchUrl,
  buildGoogleCalendarTripBatchUrl,
  downloadTripIcs,
} from './shared/calendarExport';
import {
  WaynoteLogoIcon,
  WalletIcon,
  SuitcaseIcon,
  GridIcon,
  CompassIcon,
  CogIcon,
  ChevronLeftIcon,
  MoonIcon,
  SunIcon,
  ComputerDesktopIcon,
  EditIcon,
  ShareIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  PlusIcon,
  TagIcon,
  GlobeIcon,
  ClipboardDocumentListIcon,
  ArchiveBoxArrowDownIcon,
  TrashIcon,
  ArchiveIcon,
  RefreshIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  MapIcon,
  WifiIcon,
  QrCodeIcon,
  DevicePhoneMobileIcon,
  CloudIcon,
  UserCircleIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  CalendarIcon,
  ArrowUpRightIcon,
  SparklesIcon,
  PlaneIcon,
  ArrowLongRightIcon,
  ShieldCheckIcon,
} from './components/Icons';

const APP_VERSION = 'v7.0';

const QUICK_CITIES = ['東京', '大阪', '首爾', '曼谷', '台北', '香港', '巴黎', '倫敦'];
const CROSS_COUNTRY_TEMPLATES: Array<{ id: string; cities: string[] }> = [
  { id: 'tyo-sel', cities: ['東京', '首爾'] },
  { id: 'par-lon', cities: ['巴黎', '倫敦'] },
  { id: 'bkk-sin', cities: ['曼谷', '新加坡'] },
  { id: 'tpe-oka', cities: ['台北', '沖繩'] },
];
const SHOWCASE_CITIES = [
  '東京', '大阪', '京都', '札幌', '沖繩', '福岡', '首爾', '釜山',
  '台北', '高雄', '香港', '澳門', '新加坡', '曼谷', '清邁', '峇里島',
  '吉隆坡', '河內', '杭州', '上海', '北京', '成都', '巴黎', '倫敦',
  '羅馬', '米蘭', '威尼斯', '巴塞隆納', '馬德里', '蘇黎世', '維也納', '布拉格',
  '阿姆斯特丹', '雷克雅維克', '紐約', '舊金山', '洛杉磯', '溫哥華', '雪梨', '墨爾本',
];
const QUICK_DURATIONS = [3, 4, 5, 7, 10];

type TabThemeKey = 'ITINERARY' | 'EXPLORE' | 'EXPENSES' | 'TOOLBOX' | 'SETTINGS';

const TAB_THEME_PALETTES: Record<
  TabThemeKey,
  {
    fromLight: string;
    toLight: string;
    fromDark: string;
    toDark: string;
    shadowLight: string;
    shadowDark: string;
  }
> = {
  ITINERARY: {
    fromLight: '#2563EB',
    toLight: '#0EA5E9',
    fromDark: '#3B82F6',
    toDark: '#38BDF8',
    shadowLight: '0 8px 20px -6px rgba(37, 99, 235, 0.52)',
    shadowDark: '0 8px 22px -6px rgba(56, 189, 248, 0.48)',
  },
  EXPLORE: {
    fromLight: '#E11D48',
    toLight: '#F97316',
    fromDark: '#FB7185',
    toDark: '#F59E0B',
    shadowLight: '0 8px 20px -6px rgba(225, 29, 72, 0.5)',
    shadowDark: '0 8px 22px -6px rgba(251, 113, 133, 0.45)',
  },
  EXPENSES: {
    fromLight: '#4F46E5',
    toLight: '#6366F1',
    fromDark: '#6366F1',
    toDark: '#818CF8',
    shadowLight: '0 8px 20px -6px rgba(79, 70, 229, 0.5)',
    shadowDark: '0 8px 22px -6px rgba(129, 140, 248, 0.46)',
  },
  TOOLBOX: {
    fromLight: '#059669',
    toLight: '#10B981',
    fromDark: '#10B981',
    toDark: '#34D399',
    shadowLight: '0 8px 20px -6px rgba(5, 150, 105, 0.48)',
    shadowDark: '0 8px 22px -6px rgba(52, 211, 153, 0.44)',
  },
  SETTINGS: {
    fromLight: '#7C3AED',
    toLight: '#8B5CF6',
    fromDark: '#8B5CF6',
    toDark: '#A78BFA',
    shadowLight: '0 8px 20px -6px rgba(124, 58, 237, 0.48)',
    shadowDark: '0 8px 22px -6px rgba(167, 139, 250, 0.44)',
  },
};

const STORAGE_ACTIVE_KEY = 'sky_travel_trip_data';
const STORAGE_TRIPS_LIST_KEY = 'sky_travel_trips_list';
const STORAGE_ARCHIVE_KEY = 'sky_travel_archived_trips';
const STORAGE_THEME_MODE_KEY = 'sky_travel_theme_mode';
const STORAGE_LEGACY_THEME_KEY = 'sky_travel_dark_mode';

function ensureSyncFields(trip: Trip): Trip {
  return {
    ...trip,
    syncId: trip.syncId ? normalizeSyncCode(trip.syncId) : generateSyncCode(),
    updatedAt: trip.updatedAt || Date.now(),
    hotels: trip.hotels || [],
    activities: trip.activities || {},
    savedPlaces: trip.savedPlaces || [],
    expenses: trip.expenses || [],
    packingList: trip.packingList || [],
    documents: trip.documents || [],
  };
}

function getTripStatus(trip: Trip, today: string): 'ACTIVE' | 'UPCOMING' | 'PAST' {
  if (trip.startDate > today) return 'UPCOMING';
  if (trip.endDate >= today) return 'ACTIVE';
  return 'PAST';
}

function sortTripsByNearest(list: Trip[], today: string): Trip[] {
  const rank = (status: 'ACTIVE' | 'UPCOMING' | 'PAST') =>
    status === 'ACTIVE' ? 0 : status === 'UPCOMING' ? 1 : 2;
  return [...list].sort((a, b) => {
    const sa = getTripStatus(a, today);
    const sb = getTripStatus(b, today);
    const ra = rank(sa);
    const rb = rank(sb);
    if (ra !== rb) return ra - rb;
    if (sa === 'PAST') {
      if (a.endDate !== b.endDate) return b.endDate.localeCompare(a.endDate);
      return b.startDate.localeCompare(a.startDate);
    }
    if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
    return a.endDate.localeCompare(b.endDate);
  });
}

function computeTripCountdown(trip: Trip, todayIso: string, lang: AppLanguage) {
  const intel = detectDestinationIntel(trip.destination, lang);
  const span = getDaySpanUtc(trip.startDate, trip.endDate);
  const status = getTripStatus(trip, todayIso);
  let statusText = tr(lang, '已規劃', '已规划', 'Planned');
  let dayBadge = span
    ? tr(lang, `${span.days} 天旅程`, `${span.days} 天旅程`, `${span.days}-day trip`)
    : tr(lang, '行程', '行程', 'Trip');
  let countdownValue = '0';
  let countdownUnit = tr(lang, '天', '天', 'days');
  let countdownLabel = tr(lang, '已結束', '已结束', 'Completed');
  let countdownProgress = 1;

  if (status === 'UPCOMING') {
    const diff = Math.max(
      1,
      Math.round((Date.parse(`${trip.startDate}T00:00:00Z`) - Date.parse(`${todayIso}T00:00:00Z`)) / 86400000)
    );
    statusText = tr(
      lang,
      `${diff} 天後出發`,
      `${diff} 天后出发`,
      diff === 1 ? 'Departs in 1 day' : `Departs in ${diff} days`
    );
    countdownValue = `${diff}`;
    countdownUnit = tr(lang, '天', '天', diff === 1 ? 'day' : 'days');
    countdownLabel = tr(lang, '距離出發', '距离出发', 'Countdown');
    countdownProgress = Math.max(0.1, Math.min(1, 1 - diff / Math.max(60, diff)));
  } else if (status === 'ACTIVE') {
    statusText = tr(lang, '進行中', '进行中', 'In Progress');
    const elapsed = Math.max(
      0,
      Math.round((Date.parse(`${todayIso}T00:00:00Z`) - Date.parse(`${trip.startDate}T00:00:00Z`)) / 86400000)
    );
    const totalD = span?.days || 1;
    const currentD = Math.min(elapsed + 1, totalD);
    dayBadge = formatDayProgress(currentD, totalD, lang);
    countdownValue = `D${currentD}`;
    countdownUnit = `/${totalD}`;
    countdownLabel = tr(lang, '旅程進行中', '旅程进行中', 'Active Trip');
    countdownProgress = Math.max(0.12, Math.min(1, currentD / totalD));
  } else {
    statusText = tr(lang, '已結束', '已结束', 'Completed');
    const totalD = span?.days || 1;
    countdownValue = `${totalD}`;
    countdownUnit = tr(lang, '天', '天', totalD === 1 ? 'day' : 'days');
    countdownLabel = tr(lang, '旅程完成', '旅程完成', 'Trip Completed');
    countdownProgress = 1;
  }

  return {
    intel,
    span,
    status,
    statusText,
    dayBadge,
    countdownValue,
    countdownUnit,
    countdownLabel,
    countdownProgress,
  };
}

function upsertTripIntoList(list: Trip[], trip: Trip): Trip[] {
  const idx = list.findIndex((t) => t.id === trip.id);
  if (idx === -1) return [trip, ...list];
  const next = [...list];
  next[idx] = trip;
  return next;
}

function resolveActiveTripCity(trip: Trip, dateIso?: string): string {
  if (trip.type !== 'Multi' || !trip.stops || trip.stops.length === 0) {
    return trip.destination;
  }
  const target = dateIso || trip.startDate;
  for (let i = 0; i < trip.stops.length - 1; i++) {
    const cur = trip.stops[i];
    const nxt = trip.stops[i + 1];
    if (target === cur.endDate && target === nxt.startDate && nxt.destination.trim()) {
      return nxt.destination.trim();
    }
  }
  const matching = trip.stops.find((s) => target >= s.startDate && target <= s.endDate && s.destination.trim());
  if (matching) return matching.destination.trim();
  if (target < trip.stops[0].startDate && trip.stops[0].destination.trim()) {
    return trip.stops[0].destination.trim();
  }
  const lastNonEmpty = [...trip.stops].reverse().find((s) => s.destination.trim());
  return lastNonEmpty?.destination.trim() || trip.destination;
}

const HomeTripWeatherPill: React.FC<{
  city: string;
  tripId: string;
  onOpenWeather: (tripId: string) => void;
}> = React.memo(({ city, tripId, onOpenWeather }) => {
  const { t } = useI18n();
  const weather = useLiveWeather(city || null);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpenWeather(tripId);
      }}
      className="h-7 px-2.5 rounded-full bg-black/35 border border-white/20 text-white text-[11px] font-semibold flex items-center gap-1 hover:bg-black/50 transition-colors cursor-pointer shrink-0"
    >
      {weather.data ? (
        <>
          <WeatherGlyph
            kind={weather.data.current.kind}
            isDay={weather.data.current.isDay}
            className="w-3.5 h-3.5"
          />
          <span className="font-num">{weather.data.current.temp}°</span>
        </>
      ) : (
        <>
          <CloudIcon className="w-3.5 h-3.5" />
          <span>{t('天氣', '天气', 'Weather')}</span>
        </>
      )}
    </button>
  );
});

HomeTripWeatherPill.displayName = 'HomeTripWeatherPill';

interface WorkspaceNavItem {
  id: Tab;
  themeKey: TabThemeKey;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface WorkspaceNavSharedProps {
  navItems: WorkspaceNavItem[];
  activeTab: Tab;
  activeNavIndex: number;
  navCurrentFrom: string;
  navCurrentTo: string;
  navCurrentShadow: string;
  navGradCycle: {
    fromA: string;
    fromB: string;
    toA: string;
    toB: string;
    tick: number;
  };
  onSelectTab: (tab: Tab) => void;
  isHidden: boolean;
}

const WorkspaceSidebar: React.FC<
  WorkspaceNavSharedProps & {
    tripData: Trip;
    syncBadge: { dotClass: string; text: string };
    onGoHome: () => void;
    onOpenSyncHub: () => void;
  }
> = ({
  tripData,
  navItems,
  activeTab,
  activeNavIndex,
  navCurrentFrom,
  navCurrentTo,
  navCurrentShadow,
  navGradCycle,
  syncBadge,
  onGoHome,
  onSelectTab,
  onOpenSyncHub,
  isHidden,
}) => {
  const { lang, t } = useI18n();
  const navRef = useRef<HTMLElement | null>(null);
  const btnRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [thumb, setThumb] = useState<{ top: number; height: number } | null>(null);

  useLayoutEffect(() => {
    if (isHidden) return;
    const measure = () => {
      const btn = btnRefs.current[activeNavIndex];
      if (btn && navRef.current && btn.offsetHeight > 0) {
        setThumb({
          top: btn.offsetTop,
          height: btn.offsetHeight,
        });
      }
    };
    measure();
    const raf = requestAnimationFrame(measure);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro && navRef.current) ro.observe(navRef.current);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [activeNavIndex, navItems.length, isHidden]);

  return (
    <aside
      aria-hidden={isHidden}
      className={`hidden ${
        isHidden ? 'md:hidden' : 'md:flex'
      } md:w-[88px] lg:w-64 xl:w-[272px] shrink-0 flex-col justify-between pl-[max(0.75rem,env(safe-area-inset-left))] lg:pl-[max(1rem,env(safe-area-inset-left))] pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] pr-0 z-20 transition-[width] duration-200`}
    >
      <div className="surface-elevated rounded-3xl h-full flex flex-col justify-between p-2.5 lg:p-4">
        <div className="space-y-4 lg:space-y-5">
          <div className="flex items-center justify-center lg:justify-between gap-2 pb-3 border-b border-zinc-200/70 dark:border-white/[0.08]">
            <button
              type="button"
              onClick={onGoHome}
              title={`${tripData.name} · ${t('返回首頁', '返回首页', 'Back to home')}`}
              className="flex items-center justify-center lg:justify-start gap-2.5 text-left group cursor-pointer min-w-0"
            >
              <div
                className="w-10 h-10 lg:w-9 lg:h-9 rounded-xl text-white flex items-center justify-center shrink-0 shadow-sm transition-colors duration-300"
                style={{ background: `linear-gradient(135deg, ${navCurrentFrom}, ${navCurrentTo})` }}
              >
                <WaynoteLogoIcon className="w-5 h-5" />
              </div>
              <div className="hidden lg:block min-w-0">
                <div className="text-[11px] font-medium text-zinc-400">Waynote</div>
                <div className="text-sm font-bold text-zinc-900 dark:text-white truncate">
                  {tripData.name}
                </div>
              </div>
            </button>
          </div>

          <div className="hidden lg:block px-1 space-y-0.5">
            <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
              {localizeDestinationLabel(tripData.destination, lang)}
            </div>
            <div className="text-[11px] font-num text-zinc-500 dark:text-zinc-400">
              {tripData.startDate} ~ {tripData.endDate}
            </div>
          </div>

          <nav ref={navRef} className="relative space-y-1.5 lg:space-y-1">
            {thumb && (
              <motion.div
                aria-hidden="true"
                initial={false}
                animate={{
                  y: thumb.top,
                  height: thumb.height,
                  backgroundImage:
                    navGradCycle.tick > 0
                      ? [
                          `linear-gradient(135deg, ${navGradCycle.fromA}, ${navGradCycle.fromB})`,
                          `linear-gradient(135deg, ${navGradCycle.fromA}, ${navGradCycle.toA})`,
                          `linear-gradient(135deg, ${navGradCycle.toA}, ${navGradCycle.toB})`,
                        ]
                      : `linear-gradient(135deg, ${navCurrentFrom}, ${navCurrentTo})`,
                  boxShadow: navCurrentShadow,
                }}
                transition={{
                  y: { type: 'spring', stiffness: 440, damping: 33, mass: 0.82 },
                  height: { type: 'spring', stiffness: 440, damping: 33, mass: 0.82 },
                  backgroundImage: { duration: 0.45, ease: 'easeInOut' },
                }}
                className="absolute inset-x-0 top-0 rounded-2xl lg:rounded-xl pointer-events-none z-0"
              />
            )}
            {navItems.map((item, idx) => {
              const Icon = item.icon;
              const isActive =
                activeTab === item.id || (item.id === Tab.TOOLBOX && activeTab === Tab.PACKING);
              return (
                <button
                  type="button"
                  key={item.id}
                  ref={(el) => {
                    btnRefs.current[idx] = el;
                  }}
                  title={item.label}
                  onClick={() => {
                    if (!isActive) tactileAudio.playTick(0.9 + idx * 0.06);
                    onSelectTab(item.id);
                  }}
                  style={
                    !thumb && isActive
                      ? {
                          background: `linear-gradient(135deg, ${navCurrentFrom}, ${navCurrentTo})`,
                          boxShadow: navCurrentShadow,
                        }
                      : undefined
                  }
                  className={`relative z-10 w-full py-2.5 px-1 lg:py-0 lg:min-h-[42px] lg:px-3.5 rounded-2xl lg:rounded-xl flex flex-col lg:flex-row items-center justify-center lg:justify-start gap-1 lg:gap-3 font-semibold text-[10px] leading-tight lg:text-sm transition-colors duration-200 cursor-pointer ${
                    isActive
                      ? 'text-white'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-900/5 dark:hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-[18px] h-[18px] lg:w-4 lg:h-4 shrink-0" />
                  <span className="lg:hidden truncate max-w-full">{item.shortLabel}</span>
                  <span className="hidden lg:inline truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <button
          type="button"
          onClick={onOpenSyncHub}
          title={syncBadge.text}
          className="w-full p-2.5 lg:p-3.5 rounded-2xl bg-zinc-100/90 dark:bg-white/[0.04] border border-zinc-200/70 dark:border-white/[0.08] text-left hover:bg-zinc-200/60 dark:hover:bg-white/[0.08] transition-colors cursor-pointer flex flex-col items-center lg:items-stretch gap-1 lg:space-y-1.5"
        >
          <div className="flex items-center justify-center lg:justify-between w-full gap-1.5">
            <div className="flex items-center gap-1.5 lg:gap-2 text-xs font-semibold text-zinc-900 dark:text-white">
              <span className={`w-2 h-2 rounded-full ${syncBadge.dotClass} shrink-0`} />
              <span className="hidden lg:inline">{syncBadge.text}</span>
            </div>
            <QrCodeIcon className="w-4 h-4 text-[var(--tab-accent)] transition-colors shrink-0" />
          </div>
          <div className="hidden lg:flex items-center justify-between text-[11px] font-num text-zinc-500 dark:text-zinc-400">
            <span>{tripData.syncId}</span>
            <span>{t('同步設定 →', '同步设置 →', 'Sync settings →')}</span>
          </div>
        </button>
      </div>
    </aside>
  );
};

function lerpHexColor(hexA: string, hexB: string, t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const parse = (hex: string) => {
    const clean = hex.replace('#', '');
    const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
    const n = parseInt(full, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [r1, g1, b1] = parse(hexA);
  const [r2, g2, b2] = parse(hexB);
  const r = Math.round(r1 + (r2 - r1) * clamped);
  const g = Math.round(g1 + (g2 - g1) * clamped);
  const b = Math.round(b1 + (b2 - b1) * clamped);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

const WorkspaceDock: React.FC<
  WorkspaceNavSharedProps & { isDark: boolean }
> = ({
  navItems,
  activeTab,
  activeNavIndex,
  navCurrentFrom,
  navCurrentTo,
  navCurrentShadow,
  navGradCycle,
  onSelectTab,
  isHidden,
  isDark,
}) => {
  const { t } = useI18n();
  const navRef = useRef<HTMLElement | null>(null);
  const btnRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [thumb, setThumb] = useState<{ left: number; width: number; top: number; height: number } | null>(null);
  const [dragFraction, setDragFraction] = useState<number | null>(null);
  const dragMetaRef = useRef<{
    pointerId: number;
    startX: number;
    isDragging: boolean;
    suppressClickUntil: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (isHidden) return;
    const measure = () => {
      const btn = btnRefs.current[activeNavIndex];
      if (btn && navRef.current && btn.offsetWidth > 0) {
        setThumb({
          left: btn.offsetLeft,
          width: btn.offsetWidth,
          top: btn.offsetTop,
          height: btn.offsetHeight,
        });
      }
    };
    measure();
    const raf = requestAnimationFrame(measure);
    const t = window.setTimeout(measure, 160);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro && navRef.current) ro.observe(navRef.current);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [activeNavIndex, navItems.length, isHidden]);

  const computeFractionFromClientX = (clientX: number): number | null => {
    const firstBtn = btnRefs.current[0];
    const lastBtn = btnRefs.current[navItems.length - 1];
    if (!firstBtn || !lastBtn) return null;
    const r0 = firstBtn.getBoundingClientRect();
    const rLast = lastBtn.getBoundingClientRect();
    const firstCenter = r0.left + r0.width / 2;
    const lastCenter = rLast.left + rLast.width / 2;
    if (lastCenter <= firstCenter) return null;
    const raw = ((clientX - firstCenter) / (lastCenter - firstCenter)) * (navItems.length - 1);
    return Math.max(0, Math.min(navItems.length - 1, raw));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    dragMetaRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      isDragging: false,
      suppressClickUntil: dragMetaRef.current?.suppressClickUntil || 0,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const meta = dragMetaRef.current;
    if (!meta || meta.pointerId !== e.pointerId) return;
    if (!meta.isDragging) {
      if (Math.abs(e.clientX - meta.startX) < 7) return;
      meta.isDragging = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // ignore capture error
      }
    }
    const frac = computeFractionFromClientX(e.clientX);
    if (frac !== null) {
      setDragFraction(frac);
    }
  };

  const finishPointerDrag = (e: React.PointerEvent<HTMLElement>, commit: boolean) => {
    const meta = dragMetaRef.current;
    if (!meta || meta.pointerId !== e.pointerId) return;
    const wasDragging = meta.isDragging;
    dragMetaRef.current = {
      pointerId: -1,
      startX: 0,
      isDragging: false,
      suppressClickUntil: wasDragging ? Date.now() + 260 : 0,
    };
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }
    if (wasDragging && commit) {
      const frac = computeFractionFromClientX(e.clientX) ?? dragFraction;
      if (frac !== null) {
        const targetIdx = Math.max(0, Math.min(navItems.length - 1, Math.round(frac)));
        const targetItem = navItems[targetIdx];
        if (targetItem && targetItem.id !== activeTab) {
          tactileAudio.playTick(0.9 + targetIdx * 0.06);
          onSelectTab(targetItem.id);
        }
      }
    }
    setDragFraction(null);
  };

  // Compute live interpolated thumb position & color gradient while scrubbing
  const scrubThumb = useMemo(() => {
    if (dragFraction === null) return null;
    const leftIdx = Math.floor(dragFraction);
    const rightIdx = Math.min(navItems.length - 1, leftIdx + 1);
    const localT = dragFraction - leftIdx;
    const btnL = btnRefs.current[leftIdx];
    const btnR = btnRefs.current[rightIdx];
    if (!btnL || !btnR) return null;
    const palL = TAB_THEME_PALETTES[navItems[leftIdx].themeKey];
    const palR = TAB_THEME_PALETTES[navItems[rightIdx].themeKey];
    const fromL = isDark ? palL.fromDark : palL.fromLight;
    const toL = isDark ? palL.toDark : palL.toLight;
    const fromR = isDark ? palR.fromDark : palR.fromLight;
    const toR = isDark ? palR.toDark : palR.toLight;
    return {
      left: btnL.offsetLeft + (btnR.offsetLeft - btnL.offsetLeft) * localT,
      width: btnL.offsetWidth + (btnR.offsetWidth - btnL.offsetWidth) * localT,
      top: btnL.offsetTop,
      height: btnL.offsetHeight,
      gradFrom: lerpHexColor(fromL, fromR, localT),
      gradTo: lerpHexColor(toL, toR, localT),
      hoverIndex: Math.round(dragFraction),
    };
  }, [dragFraction, navItems, isDark]);

  return (
    <div
      aria-hidden={isHidden}
      className={`${
        isHidden ? 'hidden' : 'md:hidden absolute'
      } bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 right-3 z-40 pointer-events-none flex justify-center`}
    >
      <nav
        ref={navRef}
        aria-label={t('主導航列', '主导航栏', 'Main navigation')}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(e) => finishPointerDrag(e, true)}
        onPointerCancel={(e) => finishPointerDrag(e, false)}
        className="pointer-events-auto touch-none surface-dock relative w-full max-w-md h-[62px] rounded-[30px] p-1.5 grid grid-cols-5 items-center gap-0.5 select-none"
      >
        {(scrubThumb || thumb) && (
          <motion.div
            aria-hidden="true"
            initial={false}
            animate={
              scrubThumb
                ? {
                    x: scrubThumb.left,
                    width: scrubThumb.width,
                    backgroundImage: `linear-gradient(135deg, ${scrubThumb.gradFrom}, ${scrubThumb.gradTo})`,
                    boxShadow: navCurrentShadow,
                  }
                : {
                    x: thumb!.left,
                    width: thumb!.width,
                    backgroundImage:
                      navGradCycle.tick > 0
                        ? [
                            `linear-gradient(135deg, ${navGradCycle.fromA}, ${navGradCycle.fromB})`,
                            `linear-gradient(135deg, ${navGradCycle.fromA}, ${navGradCycle.toA})`,
                            `linear-gradient(135deg, ${navGradCycle.toA}, ${navGradCycle.toB})`,
                          ]
                        : `linear-gradient(135deg, ${navCurrentFrom}, ${navCurrentTo})`,
                    boxShadow: navCurrentShadow,
                  }
            }
            transition={
              scrubThumb
                ? { duration: 0 }
                : {
                    x: { type: 'spring', stiffness: 450, damping: 34, mass: 0.82 },
                    width: { type: 'spring', stiffness: 450, damping: 34, mass: 0.82 },
                    backgroundImage: { duration: 0.45, ease: 'easeInOut' },
                  }
            }
            style={{
              top: (scrubThumb || thumb)!.top,
              height: (scrubThumb || thumb)!.height,
            }}
            className="absolute left-0 rounded-[24px] pointer-events-none z-0"
          />
        )}
        {navItems.map((item, idx) => {
          const Icon = item.icon;
          const isActive = scrubThumb
            ? scrubThumb.hoverIndex === idx
            : activeTab === item.id || (item.id === Tab.TOOLBOX && activeTab === Tab.PACKING);
          return (
            <button
              type="button"
              key={item.id}
              ref={(el) => {
                btnRefs.current[idx] = el;
              }}
              onClick={() => {
                if ((dragMetaRef.current?.suppressClickUntil || 0) > Date.now()) return;
                if (!isActive) tactileAudio.playTick(0.9 + idx * 0.06);
                onSelectTab(item.id);
              }}
              aria-label={item.label}
              style={
                !thumb && !scrubThumb && isActive
                  ? {
                      background: `linear-gradient(135deg, ${navCurrentFrom}, ${navCurrentTo})`,
                      boxShadow: navCurrentShadow,
                    }
                  : undefined
              }
              className={`relative z-10 h-full min-w-0 px-1 rounded-[24px] flex flex-col items-center justify-center gap-0.5 transition-colors duration-150 cursor-pointer select-none ${
                isActive
                  ? 'text-white'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="text-[10px] font-semibold leading-none whitespace-nowrap">
                {item.shortLabel}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

function App() {
  const { lang, setLanguage, t } = useI18n();
  const { soundEnabled, setSoundEnabled } = useTactileSound();
  const { aiEnabled, setAiEnabled, requestAiEnable } = useAiAccess();
  const isAnyModalOpen = useAnyModalOpen();
  const [view, setView] = useState<'HOME' | 'CREATE' | 'TRIP'>('HOME');
  const [activeTab, setActiveTab] = useState<Tab>(Tab.ITINERARY);
  const [tripData, setTripData] = useState<Trip | null>(null);
  const [tripsList, setTripsList] = useState<Trip[]>([]);
  const [archivedTrips, setArchivedTrips] = useState<Trip[]>([]);
  const [selectedHomeTripId, setSelectedHomeTripId] = useState<string | null>(null);
  const [homeFilter, setHomeFilter] = useState<'ALL' | 'ACTIVE' | 'UPCOMING' | 'PAST'>('ALL');
  const [activeTripDate, setActiveTripDate] = useState<string>('');

  // UI Control State
  const [showHomeSettings, setShowHomeSettings] = useState(false);
  const [showArchivedList, setShowArchivedList] = useState(false);

  // Home quick sync join & weather modal
  const [homeSyncCode, setHomeSyncCode] = useState('');
  const [isHomeJoining, setIsHomeJoining] = useState(false);
  const [isHomeWeatherOpen, setIsHomeWeatherOpen] = useState(false);
  const [focusDateSignal, setFocusDateSignal] = useState<{ date: string; nonce: number } | null>(null);
  const homeCarouselRafRef = useRef<number | null>(null);

  // Modals State
  const [isSyncHubOpen, setIsSyncHubOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isChangelogOpen, setIsChangelogOpen] = useState(false);
  const [isEditTripOpen, setIsEditTripOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [isAiConfirmOpen, setIsAiConfirmOpen] = useState(false);
  const [calendarDayDate, setCalendarDayDate] = useState<string>('');

  useEffect(() => {
    return subscribeAiEnableRequest(() => {
      setIsAiConfirmOpen(true);
    });
  }, []);

  useEffect(() => {
    setActiveTripDate(tripData?.startDate || '');
  }, [tripData?.id, tripData?.startDate]);

  // Toast & Top Sync Bubble State
  const [toast, setToast] = useState<{ id: number; text: string; tone?: 'info' | 'success' | 'error' } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [syncBubble, setSyncBubble] = useState<SyncBubbleMessage | null>(null);
  const syncBubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBubbleKeyRef = useRef<{ key: string; at: number }>({ key: '', at: 0 });
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const showSyncBubble = useCallback((info: RemoteChangeNotification) => {
    const now = Date.now();
    const dedupKey = `${info.deviceName}::${info.sectionLabel}`;
    if (lastBubbleKeyRef.current.key === dedupKey && now - lastBubbleKeyRef.current.at < 2600) {
      return;
    }
    lastBubbleKeyRef.current = { key: dedupKey, at: now };
    if (syncBubbleTimerRef.current) clearTimeout(syncBubbleTimerRef.current);
    setSyncBubble({
      id: now,
      deviceName: info.deviceName,
      sectionLabel: info.sectionLabel,
      targetTab: info.targetTab,
    });
    syncBubbleTimerRef.current = setTimeout(() => {
      setSyncBubble(null);
    }, 3400);
  }, []);

  // Google Maps Platform Quota Exceeded Banner State
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState(false);

  useEffect(() => {
    const onQuotaExceeded = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  const showToast = useCallback((text: string, tone: 'info' | 'success' | 'error' = 'info') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ id: Date.now(), text, tone });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 2800);
  }, []);

  // Edit Trip Form State
  const [editTripData, setEditTripData] = useState<{
    name: string;
    destination: string;
    startDate: string;
    endDate: string;
    type: TripType;
  }>({ name: '', destination: '', startDate: '', endDate: '', type: 'Single' });
  const [editStops, setEditStops] = useState<Stop[]>([]);

  // 3-Mode Theme State ('system' | 'light' | 'dark')
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const savedMode = localStorage.getItem(STORAGE_THEME_MODE_KEY);
      if (savedMode === 'system' || savedMode === 'light' || savedMode === 'dark') {
        return savedMode;
      }
      const legacy = localStorage.getItem(STORAGE_LEGACY_THEME_KEY);
      if (legacy !== null) {
        try {
          return JSON.parse(legacy) ? 'dark' : 'light';
        } catch {
          return 'light';
        }
      }
    }
    return 'light';
  });
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    setSystemPrefersDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const isDarkResolved = themeMode === 'dark' || (themeMode === 'system' && systemPrefersDark);

  const activeThemeKey: TabThemeKey = useMemo(() => {
    if (activeTab === Tab.EXPLORE) return 'EXPLORE';
    if (activeTab === Tab.EXPENSES) return 'EXPENSES';
    if (activeTab === Tab.TOOLBOX || activeTab === Tab.PACKING) return 'TOOLBOX';
    if (activeTab === Tab.SETTINGS) return 'SETTINGS';
    return 'ITINERARY';
  }, [activeTab]);

  const isStandalone = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const nav = window.navigator as Navigator & { standalone?: boolean };
    return (
      nav.standalone === true ||
      window.matchMedia?.('(display-mode: standalone)').matches === true
    );
  }, []);

  // Unified Safe-Area top tint per appearance mode & launch surface
  const currentTopTint = isDarkResolved ? '#080D1B' : isStandalone ? '#2E7CF6' : '#CFE4FC';

  const cachedStandaloneGapRef = useRef<number>(0);

  useLayoutEffect(() => {
    const root = window.document.documentElement;
    if (isStandalone) {
      root.classList.add('is-standalone');
    } else {
      root.classList.remove('is-standalone');
    }
    if (isDarkResolved) {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
    root.removeAttribute('data-tab-theme');

    root.style.setProperty('--safe-top-tint', currentTopTint);
    root.style.backgroundColor = currentTopTint;
    if (document.body) {
      document.body.style.backgroundColor = isStandalone && !isDarkResolved ? 'transparent' : currentTopTint;
    }

    const schemeMeta =
      document.getElementById('waynote-color-scheme') ||
      document.querySelector('meta[name="color-scheme"]');
    if (schemeMeta) {
      schemeMeta.setAttribute('content', isDarkResolved ? 'dark' : 'light');
    }

    // Remove only duplicate theme-color tags while updating #waynote-theme-color in-place
    // so iOS Safari / WebKit reliably repaints the status-bar / Dynamic Island area live.
    document.querySelectorAll('meta[name="theme-color"]:not(#waynote-theme-color)').forEach((el) => el.remove());
    let themeMeta = document.getElementById('waynote-theme-color') as HTMLMetaElement | null;
    if (!themeMeta) {
      themeMeta = document.createElement('meta');
      themeMeta.id = 'waynote-theme-color';
      themeMeta.name = 'theme-color';
      document.head.appendChild(themeMeta);
    }
    themeMeta.setAttribute('content', currentTopTint);

    const rafId = window.requestAnimationFrame(() => {
      themeMeta?.setAttribute('content', currentTopTint);
    });

    localStorage.setItem(STORAGE_THEME_MODE_KEY, themeMode);
    return () => window.cancelAnimationFrame(rafId);
  }, [isDarkResolved, themeMode, currentTopTint, isStandalone]);

  useLayoutEffect(() => {
    const root = window.document.documentElement;
    const syncStandaloneGap = () => {
      if (!isStandalone) {
        cachedStandaloneGapRef.current = 0;
        root.style.setProperty('--standalone-bottom-gap', '0px');
        return;
      }

      const ua = navigator.userAgent || '';
      const isIOS =
        /iPad|iPhone|iPod/.test(ua) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      if (!isIOS || !window.screen) {
        cachedStandaloneGapRef.current = 0;
        root.style.setProperty('--standalone-bottom-gap', '0px');
        return;
      }

      const vv = window.visualViewport;
      const activeEl = document.activeElement;
      const isKeyboardLikelyOpen =
        (vv && Math.abs(vv.height - window.innerHeight) > 24) ||
        Boolean(activeEl && /^(INPUT|TEXTAREA|SELECT)$/.test(activeEl.tagName));

      if (isKeyboardLikelyOpen) {
        root.style.setProperty('--standalone-bottom-gap', `${cachedStandaloneGapRef.current}px`);
        return;
      }

      const sw = window.screen.width;
      const sh = window.screen.height;
      const iw = window.innerWidth;
      const ih = window.innerHeight;
      const isPortrait = iw <= ih;
      const expectedW = isPortrait ? Math.min(sw, sh) : Math.max(sw, sh);
      const expectedH = isPortrait ? Math.max(sw, sh) : Math.min(sw, sh);

      if (Math.abs(iw - expectedW) > 6) {
        cachedStandaloneGapRef.current = 0;
        root.style.setProperty('--standalone-bottom-gap', '0px');
        return;
      }

      const rawGap = Math.round(expectedH - ih);
      if (rawGap <= 0) {
        cachedStandaloneGapRef.current = 0;
        root.style.setProperty('--standalone-bottom-gap', '0px');
        return;
      }

      let maxExpectedShortfall = 112;
      if (document.body) {
        const probe = document.createElement('div');
        probe.style.cssText =
          'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);';
        document.body.appendChild(probe);
        const cs = window.getComputedStyle(probe);
        const safeTop = parseFloat(cs.paddingTop) || 0;
        const safeBottom = parseFloat(cs.paddingBottom) || 0;
        document.body.removeChild(probe);
        if (safeTop > 0 || safeBottom > 0) {
          maxExpectedShortfall = Math.ceil(safeTop + safeBottom + 16);
        }
      }

      const nextGap = rawGap <= maxExpectedShortfall ? rawGap : 0;
      cachedStandaloneGapRef.current = nextGap;
      root.style.setProperty('--standalone-bottom-gap', `${nextGap}px`);
    };

    syncStandaloneGap();
    window.addEventListener('resize', syncStandaloneGap);
    window.addEventListener('orientationchange', syncStandaloneGap);
    window.visualViewport?.addEventListener('resize', syncStandaloneGap);

    return () => {
      window.removeEventListener('resize', syncStandaloneGap);
      window.removeEventListener('orientationchange', syncStandaloneGap);
      window.visualViewport?.removeEventListener('resize', syncStandaloneGap);
    };
  }, [isStandalone]);

  const resetScrollDrift = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (
      window.scrollY !== 0 ||
      window.scrollX !== 0 ||
      document.documentElement.scrollTop !== 0 ||
      document.body.scrollTop !== 0
    ) {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
    document.querySelectorAll<HTMLElement>('[data-scroll-lock]').forEach((el) => {
      if (el.scrollTop !== 0) el.scrollTop = 0;
      if (el.scrollLeft !== 0) el.scrollLeft = 0;
    });
  }, []);

  useEffect(() => {
    resetScrollDrift();
  }, [view, activeTab, resetScrollDrift]);

  useEffect(() => {
    const scheduleReset = () => {
      resetScrollDrift();
      requestAnimationFrame(resetScrollDrift);
      window.setTimeout(resetScrollDrift, 80);
      window.setTimeout(resetScrollDrift, 260);
    };

    const handleFocusOut = () => scheduleReset();
    const handleWindowScroll = () => {
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        resetScrollDrift();
      }
    };
    const vv = window.visualViewport;

    window.addEventListener('focusout', handleFocusOut);
    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    vv?.addEventListener('resize', scheduleReset);

    return () => {
      window.removeEventListener('focusout', handleFocusOut);
      window.removeEventListener('scroll', handleWindowScroll);
      vv?.removeEventListener('resize', scheduleReset);
    };
  }, [resetScrollDrift]);

  const cycleThemeMode = () => {
    const order: ThemeMode[] = ['light', 'dark', 'system'];
    const next = order[(order.indexOf(themeMode) + 1) % order.length];
    setThemeMode(next);
    showToast(
      next === 'light'
        ? t('已切換：日光淺色', '已切换：日光浅色', 'Theme: Light')
        : next === 'dark'
          ? t('已切換：夜幕深色', '已切换：夜幕深色', 'Theme: Dark')
          : t('已切換：跟隨系統', '已切换：跟随系统', 'Theme: System'),
      'info'
    );
  };

  // Creation Form State
  const [tripName, setTripName] = useState('');
  const [tripType, setTripType] = useState<TripType>('Single');
  const [singleDestination, setSingleDestination] = useState('');
  const [singleStartDate, setSingleStartDate] = useState('');
  const [singleEndDate, setSingleEndDate] = useState('');
  const [stops, setStops] = useState<Stop[]>([{ id: 1, destination: '', startDate: '', endDate: '' }]);
  const [activeStopId, setActiveStopId] = useState<number>(1);

  const persistTrips = useCallback((nextList: Trip[], activeTrip?: Trip | null) => {
    setTripsList(nextList);
    localStorage.setItem(STORAGE_TRIPS_LIST_KEY, JSON.stringify(nextList));
    if (activeTrip !== undefined) {
      if (activeTrip) {
        localStorage.setItem(STORAGE_ACTIVE_KEY, JSON.stringify(activeTrip));
      } else if (nextList.length > 0) {
        localStorage.setItem(STORAGE_ACTIVE_KEY, JSON.stringify(nextList[0]));
      } else {
        localStorage.removeItem(STORAGE_ACTIVE_KEY);
      }
    }
  }, []);

  const handleRemoteTrip = useCallback(
    (merged: Trip) => {
      const normalized = ensureSyncFields(merged);
      setTripData(normalized);
      setSelectedHomeTripId(normalized.id);
      setTripsList((prev) => {
        const next = upsertTripIntoList(prev, normalized);
        localStorage.setItem(STORAGE_TRIPS_LIST_KEY, JSON.stringify(next));
        return next;
      });
      localStorage.setItem(STORAGE_ACTIVE_KEY, JSON.stringify(normalized));
    },
    []
  );

  const {
    syncStatus,
    connectedDevices,
    lastSyncedAt,
    clientId,
    deviceName,
    pushTripUpdate,
    joinSyncTripByCode,
  } = useTripSync({
    trip: tripData,
    onRemoteTrip: handleRemoteTrip,
    onRemoteChangeMeta: showSyncBubble,
  });

  const latestRemoteCloudDeviceRef = useRef<string | null>(null);

  const handleApplyCloudSnapshot = useCallback(
    (nextActiveTrips: Trip[], nextArchivedTrips: Trip[]) => {
      const normalizedActive = nextActiveTrips.map(ensureSyncFields);
      const normalizedArchived = nextArchivedTrips.map(ensureSyncFields);
      setTripsList(normalizedActive);
      localStorage.setItem(STORAGE_TRIPS_LIST_KEY, JSON.stringify(normalizedActive));
      setArchivedTrips(normalizedArchived);
      localStorage.setItem(STORAGE_ARCHIVE_KEY, JSON.stringify(normalizedArchived));

      setTripData((prev) => {
        if (!prev) return prev;
        const found = normalizedActive.find((t) => t.id === prev.id);
        if (!found) return prev;
        if ((found.updatedAt || 0) === (prev.updatedAt || 0) && (found.revision || 0) === (prev.revision || 0)) {
          return prev;
        }
        const diff = detectEditedSection(prev, found);
        if (diff && (found.updatedAt || 0) > (prev.updatedAt || 0)) {
          showSyncBubble({
            deviceName: latestRemoteCloudDeviceRef.current || t('另一台裝置', '另一台设备', 'Another device'),
            sectionLabel: diff.sectionLabel,
            targetTab: diff.targetTab,
          });
        }
        localStorage.setItem(STORAGE_ACTIVE_KEY, JSON.stringify(found));
        return found;
      });
    },
    [showSyncBubble, t]
  );

  const cloudAuth = useCloudAccountSync({
    tripsList,
    archivedTrips,
    activeTripId: view === 'TRIP' ? tripData?.id || null : 'HOME',
    clientId,
    deviceName,
    onApplyCloudSnapshot: handleApplyCloudSnapshot,
    onNotify: showToast,
  });

  useEffect(() => {
    latestRemoteCloudDeviceRef.current = cloudAuth.latestRemoteCloudDeviceName;
  }, [cloudAuth.latestRemoteCloudDeviceName]);

  const effectiveConnectedDevices = useMemo(() => {
    const map = new Map<string, SyncDevice>();
    for (const d of cloudAuth.cloudPresenceDevices) {
      map.set(d.clientId, d);
    }
    for (const d of connectedDevices) {
      map.set(d.clientId, d);
    }
    return Array.from(map.values());
  }, [cloudAuth.cloudPresenceDevices, connectedDevices]);

  const effectiveDeviceCount = effectiveConnectedDevices.length || 1;

  const handleLocalUpdateTrip = useCallback(
    (nextTrip: Trip) => {
      const stamped = ensureSyncFields({
        ...nextTrip,
        updatedAt: Date.now(),
      });
      setTripData(stamped);
      setSelectedHomeTripId(stamped.id);
      setTripsList((prev) => {
        const next = upsertTripIntoList(prev, stamped);
        localStorage.setItem(STORAGE_TRIPS_LIST_KEY, JSON.stringify(next));
        return next;
      });
      localStorage.setItem(STORAGE_ACTIVE_KEY, JSON.stringify(stamped));
      pushTripUpdate(stamped);
      if (cloudAuth.user) {
        void cloudAuth.pushTripToCloud(stamped, false).catch((err) => {
          console.error('Cloud trip update error:', err);
        });
      }
    },
    [pushTripUpdate, cloudAuth]
  );

  useEffect(() => {
    let loadedActive: Trip | null = null;
    let loadedList: Trip[] = [];

    const rawList = localStorage.getItem(STORAGE_TRIPS_LIST_KEY);
    if (rawList) {
      try {
        loadedList = (JSON.parse(rawList) as Trip[]).map(ensureSyncFields);
      } catch (e) {
        console.error('Failed to parse trips list', e);
      }
    }

    const saved = localStorage.getItem(STORAGE_ACTIVE_KEY);
    if (saved) {
      try {
        loadedActive = ensureSyncFields(JSON.parse(saved));
        if (!loadedList.some((t) => t.id === loadedActive!.id)) {
          loadedList = [loadedActive, ...loadedList];
        }
      } catch (e) {
        console.error('Failed to parse saved trip', e);
      }
    }

    const archives = localStorage.getItem(STORAGE_ARCHIVE_KEY);
    if (archives) {
      try {
        const parsedArchives = (JSON.parse(archives) as Trip[]).map(ensureSyncFields);
        setArchivedTrips(parsedArchives);
      } catch (e) {
        console.error('Failed to parse archives', e);
      }
    }

    if (loadedList.length > 0) {
      const sortedInitial = sortTripsByNearest(loadedList, getTodayLocalIso());
      setTripsList(loadedList);
      localStorage.setItem(STORAGE_TRIPS_LIST_KEY, JSON.stringify(loadedList));
      setSelectedHomeTripId(sortedInitial[0]?.id || loadedActive?.id || loadedList[0].id);
    }

    const params = new URLSearchParams(window.location.search);
    const urlSyncCode = params.get('sync');
    if (urlSyncCode) {
      const normalizedCode = normalizeSyncCode(urlSyncCode);
      joinSyncTripByCode(normalizedCode)
        .then((remote) => {
          if (!remote) return;
          const matchingLocal = loadedList.find((t) => normalizeSyncCode(t.syncId || '') === normalizedCode);
          const next = matchingLocal ? mergeTrips(matchingLocal, remote) : ensureSyncFields(remote);
          setTripData(next);
          setSelectedHomeTripId(next.id);
          setTripsList((prev) => {
            const updated = upsertTripIntoList(prev, next);
            localStorage.setItem(STORAGE_TRIPS_LIST_KEY, JSON.stringify(updated));
            return updated;
          });
          localStorage.setItem(STORAGE_ACTIVE_KEY, JSON.stringify(next));
          setView('TRIP');
          setActiveTab(Tab.ITINERARY);
          showToast(
            t(`已連線同步：${normalizedCode}`, `已连接同步：${normalizedCode}`, `Synced: ${normalizedCode}`),
            'success'
          );
          const cleanUrl = `${window.location.pathname}${window.location.hash}`;
          window.history.replaceState({}, document.title, cleanUrl);
        })
        .catch((err) => {
          const message =
            err instanceof Error
              ? err.message
              : t('無法加入同步旅程', '无法加入同步旅程', 'Unable to join synced trip');
          showToast(message, 'error');
        });
    }
  }, [joinSyncTripByCode, showToast, t]);

  const [exploreCity, setExploreCity] = useState<string | null>(null);
  const [rotatingCityIdx, setRotatingCityIdx] = useState<number>(0);

  const openCreateFlow = useCallback((prefillCity?: string) => {
    const today = getTodayLocalIso();
    setTripName('');
    setTripType('Single');
    setSingleDestination(prefillCity || '');
    setSingleStartDate(today);
    setSingleEndDate(addDaysUtc(today, 4));
    setStops([{ id: 1, destination: prefillCity || '', startDate: today, endDate: addDaysUtc(today, 3) }]);
    setActiveStopId(1);
    setView('CREATE');
  }, []);

  const todayIso = useMemo(() => getTodayLocalIso(), []);

  const sortedTripsList = useMemo(
    () => sortTripsByNearest(tripsList, todayIso),
    [tripsList, todayIso]
  );

  const filteredHomeTrips = useMemo(() => {
    if (homeFilter === 'ALL') return sortedTripsList;
    return sortedTripsList.filter((t) => getTripStatus(t, todayIso) === homeFilter);
  }, [sortedTripsList, homeFilter, todayIso]);

  const selectedHomeTrip = useMemo(() => {
    if (filteredHomeTrips.length === 0) return sortedTripsList[0] || null;
    if (selectedHomeTripId) {
      const found = filteredHomeTrips.find((t) => t.id === selectedHomeTripId);
      if (found) return found;
    }
    return filteredHomeTrips[0];
  }, [filteredHomeTrips, sortedTripsList, selectedHomeTripId]);

  const handleOpenHomeWeather = useCallback((tripId: string) => {
    setSelectedHomeTripId(tripId);
    setIsHomeWeatherOpen(true);
  }, []);

  const homeStats = useMemo(() => {
    const target = selectedHomeTrip;
    if (!target) return null;
    const actsMap = target.activities || {};
    const allActs: { date: string; act: Activity }[] = [];
    Object.keys(actsMap)
      .sort()
      .forEach((dateKey) => {
        (actsMap[dateKey] || []).forEach((act) => allActs.push({ date: dateKey, act }));
      });

    const totalActs = allActs.length;
    const completedActs = allActs.filter((x) => x.act.completed).length;
    const packingTotal = (target.packingList || []).length;
    const packingDone = (target.packingList || []).filter((p) => p.checked).length;
    const cities =
      target.type === 'Multi' && target.stops && target.stops.length > 0
        ? target.stops.map((s) => s.destination).filter(Boolean)
        : [target.destination];

    const countdown = computeTripCountdown(target, todayIso, lang);
    const totalRaw = (target.expenses || []).reduce((sum, e) => sum + e.amount, 0);
    const mainCurr = target.budget?.currency || countdown.intel.currency;

    return {
      totalActs,
      completedActs,
      upcomingActivities: allActs.slice(0, 4),
      packingTotal,
      packingDone,
      expenseCount: (target.expenses || []).length,
      totalSpendLabel: `${mainCurr} ${Math.round(totalRaw).toLocaleString()}`,
      ...countdown,
      cities,
    };
  }, [selectedHomeTrip, todayIso, lang]);

  const homeCountdownList = useMemo(() => {
    const source = filteredHomeTrips.length > 0 ? filteredHomeTrips : sortedTripsList;
    return source.map((tripItem) => ({
      trip: tripItem,
      ...computeTripCountdown(tripItem, todayIso, lang),
    }));
  }, [filteredHomeTrips, sortedTripsList, todayIso, lang]);

  const createPreviewCity = useMemo(() => {
    if (tripType === 'Single') return singleDestination.trim();
    const active = stops.find((s) => s.id === activeStopId)?.destination?.trim();
    return active || stops[0]?.destination?.trim() || '';
  }, [tripType, singleDestination, stops, activeStopId]);

  const rotatingShowcaseCity = SHOWCASE_CITIES[rotatingCityIdx % SHOWCASE_CITIES.length];
  const nextShowcaseCity = SHOWCASE_CITIES[(rotatingCityIdx + 1) % SHOWCASE_CITIES.length];
  const shouldRotateShowcase =
    (view === 'HOME' && tripsList.length === 0 && !exploreCity) ||
    (view === 'CREATE' && !createPreviewCity);

  useEffect(() => {
    if (!shouldRotateShowcase) return;
    void fetchDestinationPhotoFast(nextShowcaseCity);
    const timer = window.setInterval(() => {
      setRotatingCityIdx((prev) => (prev + 1) % SHOWCASE_CITIES.length);
    }, 4400);
    return () => window.clearInterval(timer);
  }, [shouldRotateShowcase, nextShowcaseCity]);

  const createPreviewIntel = useMemo(() => {
    if (!createPreviewCity) return null;
    return detectDestinationIntel(createPreviewCity, lang);
  }, [createPreviewCity, lang]);

  const singleSpan = useMemo(() => getDaySpanUtc(singleStartDate, singleEndDate), [singleStartDate, singleEndDate]);
  const activeStop = useMemo(() => stops.find((s) => s.id === activeStopId) || stops[0], [stops, activeStopId]);
  const activeStopSpan = useMemo(
    () => (activeStop ? getDaySpanUtc(activeStop.startDate, activeStop.endDate) : null),
    [activeStop]
  );

  // --- Sync Join & Regenerate Handlers ---
  const handleJoinByCode = useCallback(
    async (rawCode: string) => {
      const code = normalizeSyncCode(rawCode);
      const remote = await joinSyncTripByCode(code);
      if (!remote) return;

      const matching = tripsList.find((t) => normalizeSyncCode(t.syncId || '') === code) || tripData;
      const merged =
        matching && normalizeSyncCode(matching.syncId || '') === code
          ? mergeTrips(matching, remote)
          : ensureSyncFields(remote);

      setTripData(merged);
      setSelectedHomeTripId(merged.id);
      const nextList = upsertTripIntoList(tripsList, merged);
      persistTrips(nextList, merged);
      setView('TRIP');
      setActiveTab(Tab.ITINERARY);
      showToast(t(`已同步：${merged.name}`, `已同步：${merged.name}`, `Synced: ${merged.name}`), 'success');
    },
    [joinSyncTripByCode, tripData, tripsList, persistTrips, showToast, t]
  );

  const handleHomeJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!homeSyncCode.trim()) return;
    setIsHomeJoining(true);
    try {
      await handleJoinByCode(homeSyncCode);
      setHomeSyncCode('');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('加入同步失敗', '加入同步失败', 'Failed to join sync');
      showToast(message, 'error');
    } finally {
      setIsHomeJoining(false);
    }
  };

  const handleRegenerateSyncCode = () => {
    if (!tripData) return;
    const newCode = generateSyncCode();
    const updated: Trip = {
      ...tripData,
      syncId: newCode,
      revision: 0,
      updatedAt: Date.now(),
    };
    handleLocalUpdateTrip(updated);
    showToast(
      t(`已更新同步碼：${newCode}`, `已更新同步码：${newCode}`, `Sync code updated: ${newCode}`),
      'success'
    );
  };

  // --- Calendar & Export ---
  const calendarBundle = useMemo(
    () => (tripData ? buildTripIcs(tripData, lang) : { icsContent: '', filename: 'waynote.ics', eventCount: 0 }),
    [tripData, lang]
  );
  const tripBatchGoogleUrl = useMemo(
    () => (tripData ? buildGoogleCalendarTripBatchUrl(tripData, lang) : null),
    [tripData, lang]
  );
  const dayIcsBundle = useMemo(
    () =>
      tripData && calendarDayDate
        ? buildDayIcs(tripData, calendarDayDate, lang)
        : { icsContent: '', filename: 'day.ics', eventCount: 0 },
    [tripData, calendarDayDate, lang]
  );
  const dayBatchGoogleUrl = useMemo(
    () => (tripData && calendarDayDate ? buildGoogleCalendarDayBatchUrl(tripData, calendarDayDate, lang) : null),
    [tripData, calendarDayDate, lang]
  );

  const calendarDates = useMemo(() => {
    if (!tripData) return [] as string[];
    const startMs = Date.parse(`${tripData.startDate}T00:00:00Z`);
    const endMs = Date.parse(`${tripData.endDate}T00:00:00Z`);
    const list: string[] = [];
    if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs >= startMs) {
      const cur = new Date(startMs);
      let guard = 0;
      while (cur.getTime() <= endMs && guard < 90) {
        list.push(cur.toISOString().slice(0, 10));
        cur.setUTCDate(cur.getUTCDate() + 1);
        guard += 1;
      }
    }
    return list;
  }, [tripData?.startDate, tripData?.endDate]);

  useEffect(() => {
    if (calendarDates.length > 0 && !calendarDates.includes(calendarDayDate)) {
      setCalendarDayDate(calendarDates[0]);
    }
  }, [calendarDates, calendarDayDate]);

  const exportContent = useMemo(() => {
    if (!tripData) return '';

    const toSymbol = lang === 'en' ? 'to' : '至';
    let content = `${tripData.name}\n`;
    content += `${t('目的地', '目的地', 'Destination')}: ${localizeDestinationLabel(tripData.destination, lang)}\n`;
    content += `${t('日期', '日期', 'Dates')}: ${tripData.startDate} ${toSymbol} ${tripData.endDate}\n`;
    if (tripData.syncId) {
      content += `${t('同步碼', '同步码', 'Sync Code')}: ${tripData.syncId}\n`;
    }
    content += `\n`;

    if (tripData.type === 'Multi' && tripData.stops) {
      content += `${t('路線站點', '路线站点', 'Route Stops')}:\n`;
      tripData.stops.forEach((stop, idx) => {
        content += `${idx + 1}. ${localizeDestinationLabel(stop.destination, lang)} (${stop.startDate} - ${stop.endDate})\n`;
      });
      content += `\n`;
    }

    content += `${t('行程安排', '行程安排', 'Itinerary')}:\n`;
    const dates = Object.keys(tripData.activities || {}).sort();
    dates.forEach((date) => {
      const dayActivities = tripData.activities[date];
      if (dayActivities && dayActivities.length > 0) {
        const theme = tripData.themes?.[date];
        content += `\n[${date}]${theme ? ` ${theme}` : ''}\n`;
        dayActivities.forEach((act) => {
          const time = act.type === 'flight' && act.flightInfo ? act.flightInfo.departureTime : act.time;
          content += `${act.completed ? '☑' : '☐'} ${time} - ${act.title}${act.location ? ` (@${act.location})` : ''}\n`;
        });
      }
    });

    content += `\n\n${t('消費紀錄', '消费记录', 'Expenses')}:\n`;
    (tripData.expenses || []).forEach((exp) => {
      const datePrefix = exp.date ? `${exp.date} | ` : '';
      const splitNote =
        exp.splitCount && exp.splitCount > 1
          ? t(` / ${exp.splitCount}人攤分`, ` / ${exp.splitCount}人平摊`, ` / split ${exp.splitCount} ways`)
          : '';
      const phaseLabel = exp.isPreTrip ? t('行前', '行前', 'Pre-trip') : t('旅途', '旅途', 'On-trip');
      content += `${datePrefix}[${phaseLabel}] ${exp.title}: ${exp.currency} ${exp.amount}${splitNote} (${exp.category})\n`;
    });

    content += `\n\n${t('清單', '清单', 'Packing List')}:\n`;
    const unchecked = (tripData.packingList || []).filter((i) => !i.checked);
    const checked = (tripData.packingList || []).filter((i) => i.checked);

    if (unchecked.length > 0) {
      content += `\n[${t('待準備', '待准备', 'To Pack')}]\n`;
      unchecked.forEach((item) => {
        content += `☐ ${item.name}\n`;
      });
    }
    if (checked.length > 0) {
      content += `\n[${t('已完成', '已完成', 'Packed')}]\n`;
      checked.forEach((item) => {
        content += `☑ ${item.name}\n`;
      });
    }

    return content;
  }, [tripData, lang, t]);

  const handleDownloadTxt = () => {
    if (!tripData) return;
    const blob = new Blob([exportContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${tripData.name}_export.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(t('已下載文字檔', '已下载文本文件', 'Downloaded TXT file'), 'success');
  };

  const handleDownloadJsonBackup = () => {
    if (!tripData) return;
    const blob = new Blob([JSON.stringify(tripData, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${tripData.name}_backup.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(t('已下載備份檔', '已下载备份文件', 'Downloaded JSON backup'), 'success');
  };

  const handleImportJsonBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Trip;
        if (!parsed || !parsed.name || !parsed.startDate || !parsed.endDate) {
          showToast(t('無效的備份檔案', '无效的备份文件', 'Invalid backup file'), 'error');
          return;
        }
        const restored = ensureSyncFields({
          ...parsed,
          updatedAt: Date.now(),
        });
        handleLocalUpdateTrip(restored);
        setView('TRIP');
        setActiveTab(Tab.ITINERARY);
        setShowHomeSettings(false);
        showToast(t(`已匯入：${restored.name}`, `已导入：${restored.name}`, `Imported: ${restored.name}`), 'success');
      } catch {
        showToast(t('讀取檔案失敗', '读取文件失败', 'Failed to read file'), 'error');
      } finally {
        if (importInputRef.current) importInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  // --- Edit Trip ---
  const openEditModal = () => {
    if (!tripData) return;
    setEditTripData({
      name: tripData.name,
      destination: tripData.destination,
      startDate: tripData.startDate,
      endDate: tripData.endDate,
      type: tripData.type,
    });
    if (tripData.type === 'Multi' && tripData.stops) {
      setEditStops(JSON.parse(JSON.stringify(tripData.stops)));
    } else {
      setEditStops([]);
    }
    setIsEditTripOpen(true);
  };

  const handleEditStopChange = (id: number, field: keyof Stop, value: string) => {
    setEditStops((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, [field]: value } : s));
      if (field === 'endDate') {
        const idx = next.findIndex((s) => s.id === id);
        if (idx !== -1 && idx < next.length - 1) {
          next[idx + 1] = { ...next[idx + 1], startDate: value };
        }
      }
      return next;
    });
  };

  const handleAddEditStop = () => {
    if (editStops.length >= 6) return;
    const lastStop = editStops[editStops.length - 1];
    const nextStart = lastStop ? lastStop.endDate : getTodayLocalIso();
    setEditStops([
      ...editStops,
      {
        id: editStops.length + 1,
        destination: '',
        startDate: nextStart,
        endDate: addDaysUtc(nextStart, 2),
      },
    ]);
  };

  const handleRemoveEditStop = (id: number) => {
    if (editStops.length <= 1) return;
    setEditStops(editStops.filter((s) => s.id !== id).map((s, idx) => ({ ...s, id: idx + 1 })));
  };

  const handleConfirmEdit = () => {
    if (!tripData) return;
    const now = Date.now();
    let updatedTrip: Trip = {
      ...tripData,
      name: editTripData.name.trim() || tripData.name,
      metaUpdatedAt: now,
      updatedAt: now,
    };

    if (tripData.type === 'Multi' && editStops.length > 0) {
      const validStops = editStops.filter((s) => s.destination.trim());
      if (validStops.length === 0 || !validStops[0].startDate || !validStops[validStops.length - 1].endDate) {
        showToast(t('請完整填寫站點與日期', '请完整填写站点与日期', 'Please complete all stops and dates'), 'error');
        return;
      }
      updatedTrip = {
        ...updatedTrip,
        destination: validStops.map((s) => s.destination.trim()).join(' - '),
        startDate: validStops[0].startDate,
        endDate: validStops[validStops.length - 1].endDate,
        stops: validStops,
      };
    } else {
      if (!editTripData.destination.trim() || !editTripData.startDate || !editTripData.endDate) {
        showToast(t('請完整填寫目的地與日期', '请完整填写目的地与日期', 'Please complete destination and dates'), 'error');
        return;
      }
      updatedTrip = {
        ...updatedTrip,
        destination: editTripData.destination.trim(),
        startDate: editTripData.startDate,
        endDate: editTripData.endDate,
      };
    }

    handleLocalUpdateTrip(updatedTrip);
    setIsEditTripOpen(false);
    showToast(t('已儲存旅程變更', '已保存旅程变更', 'Trip changes saved'), 'success');
  };

  // --- Delete / Archive / Restore ---
  const handleDeleteTrip = () => {
    if (!tripData) return;
    const removedId = tripData.id;
    const remaining = tripsList.filter((t) => t.id !== removedId);
    setTripData(null);
    setSelectedHomeTripId(remaining[0]?.id || null);
    persistTrips(remaining, null);
    if (cloudAuth.user) {
      void cloudAuth.removeTripFromCloud(removedId).catch((err) => {
        console.error('Cloud trip delete error:', err);
      });
    }
    setIsDeleteConfirmOpen(false);
    setView('HOME');
    showToast(
      cloudAuth.user
        ? t('已從本機與雲端移除旅程', '已从本地与云端移除旅程', 'Removed trip from device & cloud')
        : t('已從本機移除旅程', '已从本地移除旅程', 'Removed trip from device'),
      'info'
    );
  };

  const handleArchiveTrip = () => {
    if (!tripData) return;
    const target = tripData;
    const newArchives = [target, ...archivedTrips.filter((t) => t.id !== target.id)];
    setArchivedTrips(newArchives);
    localStorage.setItem(STORAGE_ARCHIVE_KEY, JSON.stringify(newArchives));

    const remaining = tripsList.filter((t) => t.id !== target.id);
    setTripData(null);
    setSelectedHomeTripId(remaining[0]?.id || null);
    persistTrips(remaining, null);
    if (cloudAuth.user) {
      void cloudAuth.syncArchiveStateToCloud(target, true).catch((err) => {
        console.error('Cloud archive error:', err);
      });
    }
    setIsArchiveConfirmOpen(false);
    setView('HOME');
    showToast(t('已封存旅程', '已归档旅程', 'Trip archived'), 'success');
  };

  const handleRestoreTrip = (trip: Trip) => {
    const normalized = ensureSyncFields(trip);
    const nextList = upsertTripIntoList(tripsList, normalized);
    persistTrips(nextList, normalized);
    setTripData(normalized);
    setSelectedHomeTripId(normalized.id);

    const newArchives = archivedTrips.filter((t) => t.id !== trip.id);
    setArchivedTrips(newArchives);
    localStorage.setItem(STORAGE_ARCHIVE_KEY, JSON.stringify(newArchives));

    if (cloudAuth.user) {
      void cloudAuth.syncArchiveStateToCloud(normalized, false).catch((err) => {
        console.error('Cloud restore error:', err);
      });
    }

    setShowArchivedList(false);
    setShowHomeSettings(false);
    setView('TRIP');
    setActiveTab(Tab.ITINERARY);
    showToast(t(`已載入：${normalized.name}`, `已载入：${normalized.name}`, `Loaded: ${normalized.name}`), 'success');
  };

  // --- Create Trip Logic (Fixed UTC Dates + Works for Single & Multi-City Active Stop) ---
  const handleQuickCitySelect = (city: string) => {
    if (tripType === 'Single') {
      setSingleDestination(city);
    } else {
      setStops((prev) => prev.map((s) => (s.id === activeStopId ? { ...s, destination: city } : s)));
    }
  };

  const handleQuickDuration = (daysCount: number) => {
    const fallbackStart = getTodayLocalIso();
    if (tripType === 'Single') {
      const baseStart = singleStartDate || fallbackStart;
      setSingleStartDate(baseStart);
      setSingleEndDate(addDaysUtc(baseStart, daysCount - 1));
    } else {
      setStops((prev) => {
        const idx = prev.findIndex((s) => s.id === activeStopId);
        if (idx === -1) return prev;
        const next = [...prev];
        const baseStart = next[idx].startDate || fallbackStart;
        const computedEnd = addDaysUtc(baseStart, daysCount - 1);
        next[idx] = { ...next[idx], startDate: baseStart, endDate: computedEnd };
        if (idx < next.length - 1) {
          const prevNextEnd = next[idx + 1].endDate;
          next[idx + 1] = {
            ...next[idx + 1],
            startDate: computedEnd,
            endDate: prevNextEnd && prevNextEnd >= computedEnd ? prevNextEnd : addDaysUtc(computedEnd, 2),
          };
        }
        return next;
      });
    }
  };

  const handleStopRangeChange = (stopId: number, start: string, end: string) => {
    setStops((prev) => {
      const idx = prev.findIndex((s) => s.id === stopId);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], startDate: start, endDate: end };
      if (idx < next.length - 1) {
        const prevNextEnd = next[idx + 1].endDate;
        next[idx + 1] = {
          ...next[idx + 1],
          startDate: end,
          endDate: prevNextEnd && prevNextEnd >= end ? prevNextEnd : addDaysUtc(end, 2),
        };
      }
      return next;
    });
  };

  const handleStopChange = (id: number, field: keyof Stop, value: string) => {
    setStops((prevStops) => {
      const next = prevStops.map((stop) => (stop.id === id ? { ...stop, [field]: value } : stop));
      if (field === 'endDate') {
        const idx = next.findIndex((s) => s.id === id);
        if (idx !== -1 && idx < next.length - 1) {
          const nextStart = value;
          const prevNextEnd = next[idx + 1].endDate;
          next[idx + 1] = {
            ...next[idx + 1],
            startDate: nextStart,
            endDate: prevNextEnd && prevNextEnd >= nextStart ? prevNextEnd : addDaysUtc(nextStart, 2),
          };
        }
      }
      return next;
    });
  };

  const handleAddStop = () => {
    if (stops.length >= 6) return;
    const lastStop = stops[stops.length - 1];
    const start = lastStop?.endDate || getTodayLocalIso();
    const nextId = (stops[stops.length - 1]?.id || 0) + 1;
    setStops([
      ...stops,
      {
        id: nextId,
        destination: '',
        startDate: start,
        endDate: addDaysUtc(start, 2),
      },
    ]);
    setActiveStopId(nextId);
  };

  const handleRemoveStop = (id: number) => {
    if (stops.length <= 1) return;
    const filtered = stops.filter((s) => s.id !== id).map((s, idx) => ({ ...s, id: idx + 1 }));
    setStops(filtered);
    setActiveStopId(filtered[filtered.length - 1]?.id || 1);
  };

  const handleMoveStop = (id: number, direction: -1 | 1) => {
    const idx = stops.findIndex((s) => s.id === id);
    const targetIdx = idx + direction;
    if (idx === -1 || targetIdx < 0 || targetIdx >= stops.length) return;

    const anchorStart = stops[0]?.startDate || getTodayLocalIso();
    const reordered = [...stops];
    const [moved] = reordered.splice(idx, 1);
    reordered.splice(targetIdx, 0, moved);

    let cursorDate = anchorStart;
    const reindexed = reordered.map((stop, i) => {
      const spanDays = Math.max(2, getDaySpanUtc(stop.startDate, stop.endDate)?.days || 3);
      const start = cursorDate;
      const end = addDaysUtc(start, spanDays - 1);
      cursorDate = end;
      return {
        ...stop,
        id: i + 1,
        startDate: start,
        endDate: end,
      };
    });

    setStops(reindexed);
    setActiveStopId(targetIdx + 1);
  };

  const handleApplyMultiPreset = (cities: string[]) => {
    const baseStart = stops[0]?.startDate || getTodayLocalIso();
    let cursor = baseStart;
    const presetStops: Stop[] = cities.map((city, idx) => {
      const days = idx === 0 ? 4 : 4;
      const start = cursor;
      const end = addDaysUtc(start, days - 1);
      cursor = end;
      return {
        id: idx + 1,
        destination: lang === 'en' ? localizeDestinationLabel(city, lang) : city,
        startDate: start,
        endDate: end,
      };
    });
    setStops(presetStops);
    setActiveStopId(1);
  };

  const handleCreateTrip = (e: React.FormEvent) => {
    e.preventDefault();

    let finalDestination = '';
    let finalStart = '';
    let finalEnd = '';

    if (tripType === 'Single') {
      if (!singleDestination.trim() || !singleStartDate || !singleEndDate) {
        showToast(t('請填寫目的地與日期', '请填写目的地与日期', 'Please fill in destination and dates'), 'error');
        return;
      }
      if (singleEndDate < singleStartDate) {
        showToast(t('結束日期不可早於出發日期', '结束日期不可早于出发日期', 'End date cannot be earlier than start date'), 'error');
        return;
      }
      finalDestination = singleDestination.trim();
      finalStart = singleStartDate;
      finalEnd = singleEndDate;
    } else {
      const validStops = stops.filter((s) => s.destination.trim());
      if (validStops.length === 0 || !validStops[0].startDate || !validStops[validStops.length - 1].endDate) {
        showToast(t('請完整填寫各站城市與日期', '请完整填写各站城市与日期', 'Please fill in all stop cities and dates'), 'error');
        return;
      }
      finalDestination = validStops.map((s) => s.destination.trim()).join(' - ');
      finalStart = validStops[0].startDate;
      finalEnd = validStops[validStops.length - 1].endDate;
    }

    const now = Date.now();
    const firstCity = finalDestination.split(' - ')[0];
    const intel = detectDestinationIntel(firstCity, lang);

    const localizedCity = localizeDestinationLabel(firstCity, lang);
    const newTrip: Trip = {
      id: now.toString(),
      syncId: generateSyncCode(),
      revision: 0,
      updatedAt: now,
      metaUpdatedAt: now,
      budgetUpdatedAt: now,
      name: tripName.trim() || t(`${localizedCity} 旅程`, `${localizedCity} 旅程`, `${localizedCity} Trip`),
      destination: finalDestination,
      startDate: finalStart,
      endDate: finalEnd,
      type: tripType,
      stops: tripType === 'Multi' ? stops.filter((s) => s.destination.trim()) : undefined,
      hotels: [],
      activities: {},
      savedPlaces: [],
      themes: {},
      expenses: [],
      packingList: [],
      documents: [],
      budget: {
        amount: 0,
        currency: intel.currency,
        type: 'total',
        updatedAt: now,
      },
    };

    const nextList = upsertTripIntoList(tripsList, newTrip);
    persistTrips(nextList, newTrip);
    setTripData(newTrip);
    setSelectedHomeTripId(newTrip.id);
    if (cloudAuth.user) {
      void cloudAuth.pushTripToCloud(newTrip, false).catch((err) => {
        console.error('Cloud create trip sync error:', err);
      });
    }
    setView('TRIP');
    setActiveTab(Tab.ITINERARY);
    showToast(
      t(
        `已建立旅程（${intel.currency}）`,
        `已创建旅程（${intel.currency}）`,
        `Trip created (${intel.currency})`
      ),
      'success'
    );
  };

  const handleOpenTrip = (trip: Trip, initialTab: Tab = Tab.ITINERARY) => {
    const normalized = ensureSyncFields(trip);
    setTripData(normalized);
    setSelectedHomeTripId(normalized.id);
    localStorage.setItem(STORAGE_ACTIVE_KEY, JSON.stringify(normalized));
    setView('TRIP');
    setActiveTab(initialTab);
  };

  const syncBadge = useMemo(() => {
    if (syncStatus === 'connected') {
      return {
        dotClass: 'bg-emerald-500',
        text:
          effectiveDeviceCount > 1
            ? t(
                `${effectiveDeviceCount} 裝置同步中`,
                `${effectiveDeviceCount} 台设备同步中`,
                `${effectiveDeviceCount} devices synced`
              )
            : t('即時同步', '实时同步', 'Live Sync'),
      };
    }
    if (cloudAuth.user && cloudAuth.cloudStatus === 'synced') {
      return {
        dotClass: 'bg-emerald-500',
        text:
          effectiveDeviceCount > 1
            ? t(
                `${effectiveDeviceCount} 裝置雲端同步中`,
                `${effectiveDeviceCount} 台设备云端同步中`,
                `${effectiveDeviceCount} devices on Cloud`
              )
            : t('雲端即時同步', '云端实时同步', 'Cloud Synced'),
      };
    }
    if (syncStatus === 'offline') {
      return { dotClass: 'bg-amber-500', text: t('離線模式', '离线模式', 'Offline') };
    }
    if (syncStatus === 'connecting' || syncStatus === 'reconnecting' || cloudAuth.cloudStatus === 'connecting') {
      return { dotClass: 'bg-blue-500', text: t('連線中', '连接中', 'Connecting') };
    }
    return { dotClass: 'bg-zinc-400', text: t('同步待命', '同步待命', 'Standby') };
  }, [syncStatus, effectiveDeviceCount, cloudAuth.user, cloudAuth.cloudStatus, t]);

  // Unified 5-Tab Navigation
  const navItems: WorkspaceNavItem[] = useMemo(
    () => [
      {
        id: Tab.ITINERARY,
        themeKey: 'ITINERARY',
        label: t('行程規劃', '行程规划', 'Itinerary'),
        shortLabel: t('行程', '行程', 'Plan'),
        icon: GridIcon,
      },
      {
        id: Tab.EXPLORE,
        themeKey: 'EXPLORE',
        label: t('探索口袋名單', '探索口袋名单', 'Explore Spots'),
        shortLabel: t('探索', '探索', 'Explore'),
        icon: CompassIcon,
      },
      {
        id: Tab.EXPENSES,
        themeKey: 'EXPENSES',
        label: t('開支預算', '开支预算', 'Expenses'),
        shortLabel: t('開支', '开支', 'Spend'),
        icon: WalletIcon,
      },
      {
        id: Tab.TOOLBOX,
        themeKey: 'TOOLBOX',
        label: t('百寶箱', '百宝箱', 'Toolbox'),
        shortLabel: t('百寶箱', '百宝箱', 'Tools'),
        icon: SuitcaseIcon,
      },
      {
        id: Tab.SETTINGS,
        themeKey: 'SETTINGS',
        label: t('設定', '设置', 'Settings'),
        shortLabel: t('設定', '设置', 'Settings'),
        icon: CogIcon,
      },
    ],
    [t]
  );

  const activeNavIndex = useMemo(() => {
    const idx = navItems.findIndex((item) => item.themeKey === activeThemeKey);
    return idx >= 0 ? idx : 0;
  }, [navItems, activeThemeKey]);

  const activeNavPalette = TAB_THEME_PALETTES[activeThemeKey];
  const navCurrentFrom = isDarkResolved ? activeNavPalette.fromDark : activeNavPalette.fromLight;
  const navCurrentTo = isDarkResolved ? activeNavPalette.toDark : activeNavPalette.toLight;
  const navCurrentShadow = isDarkResolved ? activeNavPalette.shadowDark : activeNavPalette.shadowLight;

  const prevNavColorsRef = useRef<{ from: string; to: string }>({
    from: navCurrentFrom,
    to: navCurrentTo,
  });
  const [navGradCycle, setNavGradCycle] = useState<{
    fromA: string;
    fromB: string;
    toA: string;
    toB: string;
    tick: number;
  }>({
    fromA: navCurrentFrom,
    fromB: navCurrentTo,
    toA: navCurrentFrom,
    toB: navCurrentTo,
    tick: 0,
  });

  useEffect(() => {
    const prev = prevNavColorsRef.current;
    if (prev.from !== navCurrentFrom || prev.to !== navCurrentTo) {
      setNavGradCycle((c) => ({
        fromA: prev.from,
        fromB: prev.to,
        toA: navCurrentFrom,
        toB: navCurrentTo,
        tick: c.tick + 1,
      }));
      prevNavColorsRef.current = { from: navCurrentFrom, to: navCurrentTo };
    }
  }, [navCurrentFrom, navCurrentTo]);

  const handleOpenItineraryDate = useCallback((date: string) => {
    setFocusDateSignal((prev) => ({ date, nonce: (prev?.nonce || 0) + 1 }));
    setActiveTab(Tab.ITINERARY);
  }, []);

  const handleHomeCarouselScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const container = e.currentTarget;
      if (container.scrollWidth <= container.clientWidth + 4) return;
      if (homeCarouselRafRef.current !== null) return;
      homeCarouselRafRef.current = requestAnimationFrame(() => {
        homeCarouselRafRef.current = null;
        const containerCenter = container.scrollLeft + container.clientWidth * 0.5;
        let closestId: string | null = null;
        let minDist = Infinity;
        const children = container.children;
        for (let i = 0; i < children.length; i++) {
          const el = children[i] as HTMLElement;
          const tripId = el.dataset.tripId;
          if (!tripId) continue;
          const cardCenter = el.offsetLeft + el.offsetWidth * 0.5;
          const dist = Math.abs(cardCenter - containerCenter);
          if (dist < minDist) {
            minDist = dist;
            closestId = tripId;
          }
        }
        if (closestId) {
          setSelectedHomeTripId((prev) => (prev === closestId ? prev : closestId));
        }
      });
    },
    []
  );

  const globeFocusCity = useMemo(() => {
    if (view === 'TRIP') {
      if (tripData) return resolveActiveTripCity(tripData, activeTripDate || todayIso);
      return selectedHomeTrip?.destination || null;
    }
    if (view === 'CREATE') {
      return createPreviewCity || null;
    }
    // On HOME, follow active stop city for ongoing multi-city trips, or first stop / explore city
    if (selectedHomeTrip) {
      if (getTripStatus(selectedHomeTrip, todayIso) === 'ACTIVE') {
        return resolveActiveTripCity(selectedHomeTrip, todayIso);
      }
      return selectedHomeTrip.stops?.[0]?.destination?.trim() || selectedHomeTrip.destination;
    }
    return exploreCity || null;
  }, [view, tripData, activeTripDate, todayIso, selectedHomeTrip, createPreviewCity, exploreCity]);

  const multiRouteIntel = useMemo(() => {
    const filled = stops
      .map((stop) => {
        const clean = stop.destination.trim();
        return {
          stop,
          city: clean,
          intel: clean ? detectDestinationIntel(clean, lang) : null,
        };
      });
    const activeFilled = filled.filter((x) => x.intel !== null);
    const countries = Array.from(new Set(activeFilled.map((x) => x.intel!.countryLabel)));
    const currencies = Array.from(new Set(activeFilled.map((x) => x.intel!.currency)));
    let crossBorders = 0;
    for (let i = 0; i < filled.length - 1; i++) {
      const a = filled[i].intel;
      const b = filled[i + 1].intel;
      if (a && b && a.countryLabel !== b.countryLabel) {
        crossBorders += 1;
      }
    }
    const totalSpan =
      stops.length > 0 && stops[0].startDate && stops[stops.length - 1].endDate
        ? getDaySpanUtc(stops[0].startDate, stops[stops.length - 1].endDate)
        : null;
    return {
      filled,
      countries,
      currencies,
      crossBorders,
      isCrossCountry: countries.length > 1 || crossBorders > 0,
      totalSpan,
    };
  }, [stops, lang]);

  const activePageTitle = useMemo(() => {
    switch (activeTab) {
      case Tab.EXPLORE:
        return t('探索', '探索', 'Explore');
      case Tab.EXPENSES:
        return t('開支', '开支', 'Expenses');
      case Tab.TOOLBOX:
      case Tab.PACKING:
        return t('百寶箱', '百宝箱', 'Toolbox');
      case Tab.SETTINGS:
        return t('設定', '设置', 'Settings');
      default:
        return t('行程', '行程', 'Itinerary');
    }
  }, [activeTab, t]);

  const activeDurationDays = tripType === 'Single' ? singleSpan?.days : activeStopSpan?.days;

  return (
    <MotionConfig reducedMotion="user">
      <div
        data-scroll-lock
        style={
          {
            '--tab-accent': navCurrentFrom,
            '--tab-accent-hover': navCurrentTo,
            '--tab-accent-soft': `${navCurrentFrom}20`,
          } as React.CSSProperties
        }
        className="app-shell-fixed w-full overflow-clip app-canvas text-zinc-900 dark:text-zinc-100 select-none sm:select-auto"
      >
        <div
          aria-hidden="true"
          className="app-backdrop pointer-events-none z-0"
          style={{ backgroundColor: isStandalone && !isDarkResolved ? '#F7FAFF' : currentTopTint }}
        >
          <GlobeBackdrop focusCity={globeFocusCity} isDark={isDarkResolved} />
        </div>
        <input
          ref={importInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleImportJsonBackup}
          className="hidden"
        />

        <ToastBanner toast={toast} />

        <TopSyncBubble
          bubble={syncBubble}
          onDismiss={() => setSyncBubble(null)}
          onPress={(b) => {
            setSyncBubble(null);
            if (!b.targetTab) return;
            const tabMap: Record<string, Tab> = {
              ITINERARY: Tab.ITINERARY,
              EXPLORE: Tab.EXPLORE,
              EXPENSES: Tab.EXPENSES,
              TOOLBOX: Tab.TOOLBOX,
              SETTINGS: Tab.SETTINGS,
            };
            const target = tabMap[b.targetTab];
            if (target) {
              if (view !== 'TRIP' && tripData) {
                setView('TRIP');
              }
              setActiveTab(target);
            }
          }}
        />

        {gmpQuotaExceeded && (
          <div className="sticky top-0 z-50 bg-amber-50/95 border-b border-amber-200 px-4 py-2 text-xs text-amber-900 flex items-center justify-between gap-3">
            <p className="min-w-0 leading-snug">
              {t(
                'Google 地圖服務額度已達上限。請參考 ',
                'Google 地图服务额度已达上限。请参考 ',
                'Google Maps quota reached. See '
              )}
              <a
                href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold"
              >
                {t('配額設定說明', '配额设置说明', 'quota settings')}
              </a>
              {t(
                '，路線列表與外部 Google Maps 跳轉仍可正常使用。',
                '，路线列表与外部 Google 地图跳转仍可正常使用。',
                ' — route lists and external Google Maps links still work normally.'
              )}
            </p>
            <button
              type="button"
              onClick={() => setGmpQuotaExceeded(false)}
              className="px-2.5 py-1 rounded-full bg-amber-200/70 hover:bg-amber-200 text-amber-950 font-semibold shrink-0 cursor-pointer"
            >
              {t('關閉', '关闭', 'Close')}
            </button>
          </div>
        )}

        <div data-scroll-lock className="relative z-10 h-full w-full overflow-clip">
          <AnimatePresence mode="wait">
            {/* ==================== 1. HOME VIEW (IMG_7244 Multi-Trip Carousel + Countdown Ring + Plan Preview) ==================== */}
            {view === 'HOME' && (
              <motion.div
                key="HOME"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="h-full w-full overflow-y-auto no-scrollbar relative flex flex-col"
              >
                <div className="relative z-10 w-full max-w-xl md:max-w-none lg:max-w-7xl xl:max-w-[1400px] mx-auto pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 md:px-8 lg:px-10 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] flex-1 flex flex-col justify-between gap-6">
                  {/* Top Bar */}
                  <header className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#0EA5E9] text-white flex items-center justify-center shadow-[0_8px_18px_-6px_rgba(37,99,235,0.58)]">
                        <WaynoteLogoIcon className="w-5 h-5" />
                      </div>
                      <span className="text-lg font-display font-bold tracking-tight text-zinc-900 dark:text-white">
                        Waynote
                      </span>
                    </div>

                    <div className="flex items-center gap-2 relative z-50">
                      <button
                        type="button"
                        onClick={() => setIsAuthModalOpen(true)}
                        aria-label={t('帳號登入與雲端同步', '账号登录与云端同步', 'Account sign-in & cloud sync')}
                        className="surface-elevated h-10 px-3 rounded-full text-zinc-800 dark:text-zinc-100 flex items-center gap-2 hover:bg-white dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                      >
                        {cloudAuth.user ? (
                          <>
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                cloudAuth.cloudStatus === 'error'
                                  ? 'bg-red-500'
                                  : cloudAuth.cloudStatus === 'syncing'
                                    ? 'bg-blue-500 animate-pulse'
                                    : 'bg-emerald-500'
                              }`}
                            />
                            {cloudAuth.user.photoURL ? (
                              <img
                                src={cloudAuth.user.photoURL}
                                alt=""
                                className="w-5 h-5 rounded-full object-cover shrink-0"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <UserCircleIcon className="w-4 h-4 shrink-0" />
                            )}
                            <span className="text-xs font-semibold max-w-[84px] truncate hidden sm:inline">
                              {cloudAuth.user.displayName || t('已登入', '已登录', 'Signed in')}
                            </span>
                          </>
                        ) : (
                          <>
                            <UserCircleIcon className="w-4 h-4 text-[#2563EB] dark:text-sky-400 shrink-0" />
                            <span className="text-xs font-semibold">{t('登入', '登录', 'Sign in')}</span>
                          </>
                        )}
                      </button>

                      <DayNightOrbButton
                        size="sm"
                        mode={themeMode}
                        isDark={isDarkResolved}
                        onClick={cycleThemeMode}
                        ariaLabel={t('切換外觀主題', '切换外观主题', 'Switch theme')}
                        title={
                          themeMode === 'system'
                            ? t('跟隨系統', '跟随系统', 'System')
                            : themeMode === 'dark'
                              ? t('夜間模式', '夜间模式', 'Dark mode')
                              : t('日光模式', '日光模式', 'Light mode')
                        }
                      />

                      <button
                        type="button"
                        onClick={() => {
                          setShowArchivedList(false);
                          setShowHomeSettings(true);
                        }}
                        aria-label={t('全域設定', '全局设置', 'Settings')}
                        className="surface-elevated h-10 px-3 sm:px-3.5 rounded-full text-zinc-700 dark:text-zinc-200 flex items-center gap-1.5 hover:bg-white dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
                      >
                        <CogIcon className="w-4 h-4" />
                        <span className="hidden sm:inline text-xs font-semibold">{t('設定', '设置', 'Settings')}</span>
                      </button>
                    </div>
                  </header>

                  {/* Center Focal Content */}
                  <div className="my-auto space-y-5">
                    {tripsList.length > 0 && selectedHomeTrip && homeStats ? (
                      <>
                        {/* Mobile Sequential Header (< md) */}
                        <div className="flex flex-col gap-3 md:hidden">
                          <div className="flex items-baseline justify-between gap-3">
                            <h1 className="text-2xl sm:text-3xl font-display font-bold text-zinc-900 dark:text-white tracking-tight">
                              {t('我的旅程', '我的旅程', 'Planned Journeys')}
                            </h1>
                            <span className="text-xs font-num font-semibold text-zinc-500 dark:text-zinc-400">
                              {t(
                                `共 ${tripsList.length} 趟`,
                                `共 ${tripsList.length} 趟`,
                                tripsList.length === 1 ? '1 trip' : `${tripsList.length} trips`
                              )}
                            </span>
                          </div>

                          <SlidingSegmentedControl
                            variant="underline"
                            size="sm"
                            value={homeFilter}
                            onChange={setHomeFilter}
                            options={[
                              { id: 'ALL', label: t('全部', '全部', 'All'), accentFrom: '#2563EB', accentTo: '#0EA5E9' },
                              { id: 'ACTIVE', label: t('進行中', '进行中', 'Active'), accentFrom: '#059669', accentTo: '#10B981' },
                              { id: 'UPCOMING', label: t('即將出發', '即将出发', 'Upcoming'), accentFrom: '#0D9488', accentTo: '#06B6D4' },
                              { id: 'PAST', label: t('已結束', '已结束', 'Past'), accentFrom: '#4F46E5', accentTo: '#818CF8' },
                            ]}
                          />
                        </div>

                        {/* Mobile Sequential Stack (< md) | Tablet & Desktop 12-Col Bento Hub (md+) */}
                        <div className="space-y-5 md:space-y-0 md:grid md:grid-cols-12 md:gap-6 lg:gap-7 md:items-start">
                          {/* Primary Zone: Header + Filter + Scenic Trip Cards */}
                          <div className="md:col-span-7 lg:col-span-8 space-y-4 min-w-0">
                            {/* Desktop/Tablet Left Column Aligned Header + Filter */}
                            <div className="hidden md:flex items-end justify-between gap-4 min-h-[40px]">
                              <div className="flex items-baseline gap-3 min-w-0">
                                <h1 className="text-2xl lg:text-3xl font-display font-bold text-zinc-900 dark:text-white tracking-tight truncate">
                                  {t('我的旅程', '我的旅程', 'Planned Journeys')}
                                </h1>
                                <span className="text-xs font-num font-semibold text-zinc-500 dark:text-zinc-400 shrink-0">
                                  {t(
                                    `共 ${tripsList.length} 趟`,
                                    `共 ${tripsList.length} 趟`,
                                    tripsList.length === 1 ? '1 trip' : `${tripsList.length} trips`
                                  )}
                                </span>
                              </div>

                              <SlidingSegmentedControl
                                variant="underline"
                                size="sm"
                                value={homeFilter}
                                onChange={setHomeFilter}
                                options={[
                                  { id: 'ALL', label: t('全部', '全部', 'All'), accentFrom: '#2563EB', accentTo: '#0EA5E9' },
                                  { id: 'ACTIVE', label: t('進行中', '进行中', 'Active'), accentFrom: '#059669', accentTo: '#10B981' },
                                  { id: 'UPCOMING', label: t('即將出發', '即将出发', 'Upcoming'), accentFrom: '#0D9488', accentTo: '#06B6D4' },
                                  { id: 'PAST', label: t('已結束', '已结束', 'Past'), accentFrom: '#4F46E5', accentTo: '#818CF8' },
                                ]}
                              />
                            </div>

                            {filteredHomeTrips.length === 0 ? (
                              <div className="surface-elevated rounded-3xl p-8 md:py-14 text-center space-y-3">
                                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                                  {t('此分類尚無旅程', '此分类暂无旅程', 'No trips in this category')}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => setHomeFilter('ALL')}
                                  className="text-xs font-semibold text-[#2563EB] dark:text-sky-400 cursor-pointer"
                                >
                                  {t('顯示全部旅程', '显示全部旅程', 'Show all trips')}
                                </button>
                              </div>
                            ) : (
                              <>
                                <div
                                  onScroll={handleHomeCarouselScroll}
                                  className={
                                    filteredHomeTrips.length > 1
                                      ? 'flex gap-3.5 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-1 px-1 py-1 md:mx-0 md:px-0 md:py-0 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible'
                                      : 'grid grid-cols-1 gap-4'
                                  }
                                >
                                  {filteredHomeTrips.map((item) => {
                                    const span = getDaySpanUtc(item.startDate, item.endDate);
                                    const dateParts = formatHomeCardDateParts(item.startDate, lang);
                                    const isSingleDesktop = filteredHomeTrips.length === 1;
                                    const cardWidthClass =
                                      filteredHomeTrips.length > 1
                                        ? 'w-[86%] sm:w-[340px] md:w-full shrink-0 min-w-0'
                                        : 'w-full min-w-0';
                                    return (
                                      <div
                                        key={item.id}
                                        data-trip-id={item.id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => handleOpenTrip(item)}
                                        onMouseEnter={() => setSelectedHomeTripId(item.id)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            handleOpenTrip(item);
                                          }
                                        }}
                                        className={`${cardWidthClass} snap-start rounded-[28px] overflow-hidden cursor-pointer transition-transform duration-150 active:scale-[0.99] surface-elevated shadow-[0_18px_36px_-16px_rgba(15,34,74,0.28)] focus:outline-none focus:ring-2 focus:ring-[#2563EB]`}
                                      >
                                        <DestinationCover
                                          city={item.destination}
                                          debounceMs={0}
                                          className={isSingleDesktop ? 'h-52 sm:h-56 md:h-64 lg:h-[290px] w-full' : 'h-52 sm:h-56 md:h-52 lg:h-56 w-full'}
                                          scrimClassName="bg-gradient-to-b from-black/58 via-black/14 to-black/18"
                                        >
                                          <div className="h-full p-5 sm:p-6 md:p-4 lg:p-5 flex items-start justify-between gap-2.5 text-white overflow-hidden">
                                            <div className="min-w-0 flex-1 space-y-2.5">
                                              <h2 className="text-[22px] sm:text-[25px] md:text-[21px] lg:text-[24px] font-display font-bold text-white leading-tight truncate tracking-tight drop-shadow-sm">
                                                {localizeDestinationLabel(item.destination, lang)}
                                              </h2>
                                              <div className="inline-flex">
                                                <HomeTripWeatherPill
                                                  city={item.destination}
                                                  tripId={item.id}
                                                  onOpenWeather={handleOpenHomeWeather}
                                                />
                                              </div>
                                            </div>

                                            <div className="text-right shrink-0 flex flex-col items-end pl-1">
                                              <span className="text-[36px] sm:text-[42px] md:text-[32px] lg:text-[40px] font-display font-light leading-none tracking-tight text-white font-num drop-shadow-sm">
                                                {dateParts.day}
                                              </span>
                                              <span className="text-xs sm:text-[13px] font-display font-medium text-white/95 mt-0.5 drop-shadow-sm">
                                                {dateParts.monthLabel}
                                              </span>
                                              <span className="text-[11px] font-num font-medium text-white/80 mt-1.5 drop-shadow-sm whitespace-nowrap">
                                                {item.startDate.slice(5)} ~ {item.endDate.slice(5)}
                                                {span ? ` · ${span.days}${t('天', '天', 'd')}` : ''}
                                              </span>
                                            </div>
                                          </div>
                                        </DestinationCover>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Tablet & Desktop Quick Glance Strip when focusing a single active/selected trip */}
                                {filteredHomeTrips.length === 1 && (() => {
                                  const heroTrip = filteredHomeTrips[0];
                                  const actTotal = Object.values(heroTrip.activities || {}).reduce<number>(
                                    (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
                                    0
                                  );
                                  const packList = heroTrip.packingList || [];
                                  const packDone = packList.filter((p) => p.checked).length;
                                  const savedSpots = (heroTrip.savedPlaces || []).length;
                                  const heroIntel = detectDestinationIntel(heroTrip.destination, lang);
                                  return (
                                    <div className="hidden md:grid grid-cols-3 gap-3.5">
                                      <button
                                        type="button"
                                        onClick={() => handleOpenTrip(heroTrip, Tab.ITINERARY)}
                                        className="surface-elevated rounded-3xl p-4 text-left hover:bg-white dark:hover:bg-zinc-800/80 transition-colors cursor-pointer group"
                                      >
                                        <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                                          <span>{t('行程節點', '行程节点', 'Itinerary Stops')}</span>
                                          <ChevronRightIcon className="w-3.5 h-3.5 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                                        </div>
                                        <div className="mt-1.5 font-display font-bold font-num text-xl text-zinc-900 dark:text-white">
                                          {actTotal}
                                          <span className="text-xs font-normal text-zinc-400 ml-1">
                                            {t('個安排', '个安排', 'stops')}
                                          </span>
                                        </div>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleOpenTrip(heroTrip, Tab.EXPLORE)}
                                        className="surface-elevated rounded-3xl p-4 text-left hover:bg-white dark:hover:bg-zinc-800/80 transition-colors cursor-pointer group"
                                      >
                                        <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                                          <span>{t('口袋景點', '收藏景点', 'Saved Spots')}</span>
                                          <ChevronRightIcon className="w-3.5 h-3.5 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                                        </div>
                                        <div className="mt-1.5 font-display font-bold font-num text-xl text-zinc-900 dark:text-white">
                                          {savedSpots}
                                          <span className="text-xs font-normal text-zinc-400 ml-1">
                                            {t('處收藏', '处收藏', 'saved')}
                                          </span>
                                        </div>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleOpenTrip(heroTrip, Tab.TOOLBOX)}
                                        className="surface-elevated rounded-3xl p-4 text-left hover:bg-white dark:hover:bg-zinc-800/80 transition-colors cursor-pointer group"
                                      >
                                        <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                                          <span>{t('裝備清單 · 幣別', '装备清单 · 币别', 'Packing · FX')}</span>
                                          <ChevronRightIcon className="w-3.5 h-3.5 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                                        </div>
                                        <div className="mt-1.5 font-display font-bold font-num text-xl text-zinc-900 dark:text-white">
                                          {packList.length > 0 ? `${packDone}/${packList.length}` : heroIntel.currency}
                                          <span className="text-xs font-normal text-zinc-400 ml-1.5">
                                            {packList.length > 0 ? heroIntel.currency : heroIntel.timezoneLabel}
                                          </span>
                                        </div>
                                      </button>
                                    </div>
                                  );
                                })()}
                              </>
                            )}
                          </div>

                          {/* Command & Countdown Column (Below Cards on Mobile, Aligned Right Rail on Tablet/Desktop) */}
                          <div className="md:col-span-5 lg:col-span-4 space-y-4 min-w-0">
                            <div className="hidden md:flex items-end justify-between px-1 min-h-[40px]">
                              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                {t('快速建立與加入', '快速创建与加入', 'Quick Actions & Sync')}
                              </span>
                            </div>

                            <div className="flex flex-col gap-3 md:surface-elevated md:rounded-3xl md:p-4">
                              <form
                                onSubmit={handleHomeJoinSubmit}
                                className="order-1 md:order-2 surface-elevated md:bg-zinc-100/85 md:dark:bg-white/[0.05] md:shadow-none md:border md:border-zinc-200/70 md:dark:border-white/[0.08] rounded-2xl p-2 flex items-center gap-2"
                              >
                                <div className="pl-2.5 flex items-center gap-2 text-zinc-400 shrink-0">
                                  <WifiIcon className="w-4 h-4" />
                                </div>
                                <input
                                  type="text"
                                  value={homeSyncCode}
                                  onChange={(e) => setHomeSyncCode(e.target.value.toUpperCase())}
                                  placeholder={t(
                                    '輸入同步碼加入行程 (SKY-XXXX-XXXX)',
                                    '输入同步码加入行程 (SKY-XXXX-XXXX)',
                                    'Enter sync code (SKY-XXXX-XXXX)'
                                  )}
                                  className="flex-1 min-w-0 h-10 bg-transparent font-num text-xs sm:text-sm font-medium text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none"
                                />
                                <button
                                  type="submit"
                                  disabled={!homeSyncCode.trim() || isHomeJoining}
                                  className="h-10 px-4 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold text-xs disabled:opacity-35 cursor-pointer whitespace-nowrap shrink-0"
                                >
                                  {isHomeJoining ? t('連線中', '连接中', 'Joining') : t('加入', '加入', 'Join')}
                                </button>
                              </form>

                              <div className="order-2 md:order-1 flex justify-center">
                                <MovingBorderBeamButton
                                  onClick={() => openCreateFlow()}
                                  beamFrom="#2563EB"
                                  beamTo="#0EA5E9"
                                  className="min-h-[48px] md:w-full"
                                  innerClassName="px-7"
                                >
                                  <PlusIcon className="w-4 h-4 text-[#2563EB] dark:text-sky-400" />
                                  <span>{t('新旅程', '新旅程', 'New Trip')}</span>
                                </MovingBorderBeamButton>
                              </div>
                            </div>

                            {/* Trip Countdown List */}
                            <div className="space-y-2.5 pt-0.5">
                              <div className="flex items-center justify-between px-1">
                                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                                  {t('行程倒數', '行程倒数', 'Trip Countdown')}
                                </span>
                                <span className="text-[11px] font-num font-semibold text-zinc-400 dark:text-zinc-500">
                                  {t(
                                    `共 ${homeCountdownList.length} 趟旅程`,
                                    `共 ${homeCountdownList.length} 趟旅程`,
                                    homeCountdownList.length === 1 ? '1 trip' : `${homeCountdownList.length} trips`
                                  )}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-3">
                                {homeCountdownList.map((entry) => {
                                  const radius = 25;
                                  const circumference = 2 * Math.PI * radius;
                                  const strokeDashoffset = circumference * (1 - entry.countdownProgress);
                                  const isHighlighted = selectedHomeTrip?.id === entry.trip.id;

                                  return (
                                    <div
                                      key={entry.trip.id}
                                      onClick={() => handleOpenTrip(entry.trip)}
                                      onMouseEnter={() => setSelectedHomeTripId(entry.trip.id)}
                                      className={`surface-elevated rounded-3xl p-4 sm:p-5 flex items-center justify-between gap-3.5 cursor-pointer hover:bg-white dark:hover:bg-zinc-800/80 transition-colors ${
                                        isHighlighted && homeCountdownList.length > 1
                                          ? 'ring-1 ring-[#2563EB]/45 dark:ring-sky-400/45'
                                          : ''
                                      }`}
                                    >
                                      <div className="flex items-center gap-3.5 min-w-0">
                                        <div className="relative w-15 h-15 shrink-0 flex items-center justify-center">
                                          <svg className="w-15 h-15 -rotate-90" viewBox="0 0 60 60">
                                            <circle
                                              cx="30"
                                              cy="30"
                                              r={radius}
                                              fill="none"
                                              strokeWidth="4.5"
                                              className="stroke-zinc-200/80 dark:stroke-white/10"
                                            />
                                            <circle
                                              cx="30"
                                              cy="30"
                                              r={radius}
                                              fill="none"
                                              strokeWidth="4.5"
                                              strokeLinecap="round"
                                              stroke={
                                                entry.status === 'PAST'
                                                  ? '#10b981'
                                                  : isDarkResolved
                                                    ? '#38BDF8'
                                                    : '#2563EB'
                                              }
                                              strokeDasharray={circumference}
                                              strokeDashoffset={strokeDashoffset}
                                              className="transition-all duration-500"
                                            />
                                          </svg>
                                          <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                                            <span className="font-display font-bold font-num text-sm text-zinc-900 dark:text-white">
                                              {entry.countdownValue}
                                            </span>
                                            <span className="text-[9px] font-num font-semibold text-zinc-500 dark:text-zinc-400">
                                              {entry.countdownUnit}
                                            </span>
                                          </div>
                                        </div>

                                        <div className="min-w-0">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-xs font-semibold text-[#2563EB] dark:text-sky-400">
                                              {entry.countdownLabel}
                                            </span>
                                            <span className="text-[11px] font-num text-zinc-400 dark:text-zinc-500">
                                              · {entry.dayBadge}
                                            </span>
                                          </div>
                                          <div className="font-display font-bold text-base text-zinc-900 dark:text-white truncate mt-0.5">
                                            {entry.trip.name}
                                          </div>
                                          <div className="text-[11px] font-num text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                                            {entry.statusText} · {entry.trip.startDate.slice(5)} ~{' '}
                                            {entry.trip.endDate.slice(5)} · {t('當地', '当地', 'Local')}{' '}
                                            {getDestinationLocalTime(entry.intel.utcOffsetHours, lang).timeStr}
                                          </div>
                                        </div>
                                      </div>

                                      <ChevronRightIcon className="w-5 h-5 text-zinc-400 shrink-0" />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      /* Scenic Welcome Card when no trips yet (Horizontal Split on Tablet & Desktop) */
                      <div className="surface-elevated rounded-3xl overflow-hidden grid grid-cols-1 md:grid-cols-12 items-stretch">
                        <DestinationCover
                          city={exploreCity || rotatingShowcaseCity}
                          debounceMs={80}
                          crossfade
                          className="h-52 sm:h-60 md:h-full md:min-h-[420px] lg:min-h-[460px] w-full md:col-span-6 lg:col-span-7"
                        >
                          <div className="h-full p-6 md:p-8 flex flex-col justify-end text-white">
                            <span className="text-xs font-medium text-white/85 flex items-center gap-1.5">
                              <span>
                                {exploreCity
                                  ? localizeDestinationLabel(exploreCity, lang)
                                  : t(
                                      `探索靈感 · ${localizeDestinationLabel(rotatingShowcaseCity, lang)}`,
                                      `探索灵感 · ${localizeDestinationLabel(rotatingShowcaseCity, lang)}`,
                                      `Inspiration · ${localizeDestinationLabel(rotatingShowcaseCity, lang)}`
                                    )}
                              </span>
                            </span>
                            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold tracking-tight text-white mt-1">
                              {t('開始下一趟旅程', '开启下一趟旅程', 'Plan Your Next Journey')}
                            </h1>
                          </div>
                        </DestinationCover>

                        <div className="p-6 md:p-7 lg:p-8 space-y-5 md:col-span-6 lg:col-span-5 flex flex-col justify-between">
                          <div className="space-y-4">
                            <div className="hidden md:block space-y-1">
                              <div className="text-xs font-semibold text-[#2563EB] dark:text-sky-400">
                                {t('精選 40 座旅遊城市', '精选 40 座旅游城市', '40 Featured Cities')}
                              </div>
                              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                                {t(
                                  '選擇城市預覽實景，或建立專屬行程。',
                                  '选择城市预览实景，或创建专属行程。',
                                  'Pick a city to preview or start a new trip.'
                                )}
                              </p>
                            </div>

                              <div className="flex md:flex-wrap gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                              {QUICK_CITIES.map((city) => {
                                const active = exploreCity === city;
                                return (
                                  <button
                                    key={city}
                                    type="button"
                                    onClick={() => setExploreCity((prev) => (prev === city ? null : city))}
                                    className={`h-8 px-3.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                                      active
                                        ? 'bg-gradient-to-r from-[#2563EB] to-[#0EA5E9] text-white shadow-sm'
                                        : 'bg-zinc-100 dark:bg-white/[0.06] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-white/10'
                                    }`}
                                  >
                                    {localizeDestinationLabel(city, lang)}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Tablet & Desktop Live Destination Spotlight & Highlights (Fills Wide Empty Gap Cleanly) */}
                            {(() => {
                              const spotlightCity = exploreCity || rotatingShowcaseCity;
                              const spotlightIntel = detectDestinationIntel(spotlightCity, lang);
                              const spotlightTime = getDestinationLocalTime(spotlightIntel.utcOffsetHours, lang).timeStr;
                              return (
                                <div className="hidden md:block space-y-2.5 pt-1">
                                  <div className="rounded-2xl bg-zinc-50/90 dark:bg-white/[0.04] border border-zinc-200/70 dark:border-white/[0.08] p-3.5 space-y-2.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="min-w-0">
                                        <span className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500">
                                          {spotlightIntel.countryLabel}
                                        </span>
                                        <div className="text-base font-display font-bold text-zinc-900 dark:text-white truncate">
                                          {localizeDestinationLabel(spotlightCity, lang)}
                                        </div>
                                      </div>
                                      <span className="text-xs font-num font-bold px-2.5 py-1 rounded-full bg-white dark:bg-zinc-900/70 border border-zinc-200/70 dark:border-white/10 text-[#2563EB] dark:text-sky-400 shrink-0">
                                        {t('當地', '当地', 'Local')} {spotlightTime}
                                      </span>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2">
                                      <div className="rounded-xl bg-white/85 dark:bg-white/[0.04] px-2.5 py-2 border border-zinc-200/50 dark:border-white/[0.06]">
                                        <div className="text-[10px] text-zinc-400">{t('貨幣', '货币', 'Currency')}</div>
                                        <div className="text-xs font-num font-bold text-zinc-900 dark:text-white mt-0.5 truncate">
                                          {spotlightIntel.currency} {spotlightIntel.currencySymbol}
                                        </div>
                                      </div>
                                      <div className="rounded-xl bg-white/85 dark:bg-white/[0.04] px-2.5 py-2 border border-zinc-200/50 dark:border-white/[0.06]">
                                        <div className="text-[10px] text-zinc-400">{t('電壓插座', '电压插座', 'Power')}</div>
                                        <div className="text-xs font-num font-bold text-zinc-900 dark:text-white mt-0.5 truncate">
                                          {spotlightIntel.voltagePlug}
                                        </div>
                                      </div>
                                      <div className="rounded-xl bg-white/85 dark:bg-white/[0.04] px-2.5 py-2 border border-zinc-200/50 dark:border-white/[0.06]">
                                        <div className="text-[10px] text-zinc-400">{t('退稅門檻', '退税门槛', 'Tax-Free')}</div>
                                        <div className="text-xs font-num font-bold text-zinc-900 dark:text-white mt-0.5 truncate">
                                          {spotlightIntel.taxFreeThreshold != null
                                            ? `${spotlightIntel.currencySymbol}${spotlightIntel.taxFreeThreshold.toLocaleString()}`
                                            : '—'}
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="rounded-xl bg-zinc-50/80 dark:bg-white/[0.03] border border-zinc-200/60 dark:border-white/[0.06] px-3 py-2 flex items-center gap-2">
                                      <WifiIcon className="w-3.5 h-3.5 text-[#2563EB] dark:text-sky-400 shrink-0" />
                                      <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300 truncate">
                                        {t('跨裝置即時同步', '跨设备实时同步', 'Live Multi-Device Sync')}
                                      </span>
                                    </div>
                                    <div className="rounded-xl bg-zinc-50/80 dark:bg-white/[0.03] border border-zinc-200/60 dark:border-white/[0.06] px-3 py-2 flex items-center gap-2">
                                      <GlobeIcon className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                      <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300 truncate">
                                        {t('跨國多城市路線', '跨国多城市路线', 'Cross-Country Routes')}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>

                          <div className="space-y-4">
                            <MovingBorderBeamButton
                              onClick={() => openCreateFlow(exploreCity ? localizeDestinationLabel(exploreCity, lang) : undefined)}
                              beamFrom="#2563EB"
                              beamTo="#0EA5E9"
                              className="w-full min-h-[50px]"
                            >
                              <PlusIcon className="w-4 h-4 text-[#2563EB] dark:text-sky-400" />
                              <span>
                                {exploreCity
                                  ? t(
                                      `規劃「${localizeDestinationLabel(exploreCity, lang)}」旅程`,
                                      `规划「${localizeDestinationLabel(exploreCity, lang)}」旅程`,
                                      `Plan ${localizeDestinationLabel(exploreCity, lang)} Trip`
                                    )
                                  : t('開始規劃旅程', '开始规划旅程', 'Start Planning')}
                              </span>
                            </MovingBorderBeamButton>

                            {archivedTrips.length > 0 && (
                              <div className="pt-4 border-t border-zinc-200/70 dark:border-white/[0.08] space-y-2">
                                <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                                  {t('最近封存', '最近归档', 'Recently Archived')}
                                </div>
                                {archivedTrips.slice(0, 2).map((arch) => (
                                  <button
                                    key={arch.id}
                                    type="button"
                                    onClick={() => handleRestoreTrip(arch)}
                                    className="w-full p-2.5 rounded-2xl bg-zinc-100/80 dark:bg-white/[0.04] hover:bg-zinc-200/70 dark:hover:bg-white/[0.08] flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      <DestinationCover
                                        city={arch.destination}
                                        debounceMs={200}
                                        className="w-10 h-10 rounded-xl shrink-0"
                                        scrimClassName="bg-black/15"
                                      />
                                      <div className="min-w-0">
                                        <div className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                                          {arch.name}
                                        </div>
                                        <div className="text-xs font-num text-zinc-500 dark:text-zinc-400 truncate">
                                          {localizeDestinationLabel(arch.destination, lang)} · {arch.startDate}
                                        </div>
                                      </div>
                                    </div>
                                    <ChevronRightIcon className="w-4 h-4 text-zinc-400 shrink-0" />
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {tripsList.length === 0 && (
                      <form
                        onSubmit={handleHomeJoinSubmit}
                        className="surface-elevated rounded-2xl p-2 flex items-center gap-2"
                      >
                        <div className="pl-3 flex items-center gap-2 text-zinc-400 shrink-0">
                          <WifiIcon className="w-4 h-4" />
                        </div>
                        <input
                          type="text"
                          value={homeSyncCode}
                          onChange={(e) => setHomeSyncCode(e.target.value.toUpperCase())}
                          placeholder={t(
                            '輸入同步碼加入行程 (SKY-XXXX-XXXX)',
                            '输入同步码加入行程 (SKY-XXXX-XXXX)',
                            'Enter sync code to join trip (SKY-XXXX-XXXX)'
                          )}
                          className="flex-1 min-w-0 h-10 bg-transparent font-num text-xs sm:text-sm font-medium text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none"
                        />
                        <button
                          type="submit"
                          disabled={!homeSyncCode.trim() || isHomeJoining}
                          className="h-10 px-4 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold text-xs disabled:opacity-35 cursor-pointer whitespace-nowrap shrink-0"
                        >
                          {isHomeJoining ? t('連線中', '连接中', 'Joining') : t('加入', '加入', 'Join')}
                        </button>
                      </form>
                    )}
                  </div>

                  <footer className="text-center text-xs font-num text-zinc-400 dark:text-zinc-500">
                    Waynote {APP_VERSION}
                  </footer>
                </div>

                {selectedHomeTrip && homeStats && (
                  <WeatherModal
                    open={isHomeWeatherOpen}
                    onClose={() => setIsHomeWeatherOpen(false)}
                    cities={homeStats.cities}
                    initialCity={homeStats.cities[0]}
                  />
                )}
              </motion.div>
            )}

            {/* ==================== 2. CREATE TRIP VIEW ==================== */}
            {view === 'CREATE' && (
              <motion.div
                key="CREATE"
                data-scroll-lock
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -18 }}
                transition={{ duration: 0.22 }}
                className="h-full min-h-0 w-full flex flex-col max-w-2xl md:max-w-none lg:max-w-7xl xl:max-w-[1340px] mx-auto pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-8 md:px-8 lg:px-10 overflow-clip md:overflow-y-auto md:no-scrollbar"
              >
                <div className="flex-1 min-h-0 flex flex-col md:flex-none md:my-auto md:py-4">
                  <div className="mb-4 shrink-0 flex items-center justify-between gap-3 relative z-20">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setView('HOME')}
                        aria-label={t('返回首頁', '返回首页', 'Back to home')}
                        className="surface-elevated w-10 h-10 rounded-full flex items-center justify-center text-zinc-800 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
                      >
                        <ChevronLeftIcon className="w-5 h-5" />
                      </button>
                      <h2 className="text-2xl font-display font-bold text-zinc-900 dark:text-white">
                        {t('建立新旅程', '创建新旅程', 'Create New Trip')}
                      </h2>
                    </div>

                    {((tripType === 'Single' && singleSpan) || (tripType === 'Multi' && activeStopSpan)) && (
                      <span className="text-xs font-num font-bold text-[#2563EB] dark:text-sky-400">
                        {tripType === 'Single'
                          ? t(
                              `共 ${singleSpan!.days} 天 ${singleSpan!.nights} 夜`,
                              `共 ${singleSpan!.days} 天 ${singleSpan!.nights} 晚`,
                              `${singleSpan!.days}D / ${singleSpan!.nights}N`
                            )
                          : t(
                              `第 ${activeStop?.id || 1} 站 · ${activeStopSpan!.days} 天 ${activeStopSpan!.nights} 夜`,
                              `第 ${activeStop?.id || 1} 站 · ${activeStopSpan!.days} 天 ${activeStopSpan!.nights} 晚`,
                              `Stop ${activeStop?.id || 1} · ${activeStopSpan!.days}D / ${activeStopSpan!.nights}N`
                            )}
                      </span>
                    )}
                  </div>

                  <form
                    onSubmit={handleCreateTrip}
                    className="flex-1 min-h-0 overflow-y-auto no-scrollbar pb-8 md:flex-none md:overflow-visible md:pb-0"
                  >
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-5 lg:gap-6 items-start">
                    {/* Left Column on Tablet/Desktop: Photo Preview, Type Switch, Cities & Name */}
                    <div className="md:col-span-5 space-y-4">
                      {/* Live Auto-Matched Global Destination Banner */}
                      <DestinationCover
                        city={createPreviewCity || rotatingShowcaseCity}
                        debounceMs={createPreviewCity ? 360 : 80}
                        crossfade={!createPreviewCity}
                        className="h-36 sm:h-44 md:h-48 lg:h-52 rounded-3xl shadow-sm"
                      >
                        <div className="h-full p-5 flex flex-col justify-end text-white">
                          <div className="text-xs text-white/85 font-num flex items-center gap-1.5">
                            <span>
                              {createPreviewIntel
                                ? `${createPreviewIntel.countryLabel} · ${createPreviewIntel.currency} · ${createPreviewIntel.timezoneLabel}`
                                : t(
                                    `精選靈感 · ${localizeDestinationLabel(rotatingShowcaseCity, lang)}`,
                                    `精选灵感 · ${localizeDestinationLabel(rotatingShowcaseCity, lang)}`,
                                    `Featured · ${localizeDestinationLabel(rotatingShowcaseCity, lang)}`
                                  )}
                            </span>
                          </div>
                          <div className="text-xl sm:text-2xl font-display font-bold truncate mt-0.5">
                            {createPreviewCity
                              ? localizeDestinationLabel(createPreviewCity, lang)
                              : t('下一站目的地', '下一站目的地', 'Next Destination')}
                          </div>
                        </div>
                      </DestinationCover>

                      {/* Single / Multi Sliding Toggle */}
                      <SlidingSegmentedControl
                        fullWidth
                        size="lg"
                        value={tripType}
                        onChange={setTripType}
                        options={[
                          {
                            id: 'Single',
                            label: t('單一城市', '单一城市', 'Single City'),
                            icon: <MapIcon className="w-4 h-4" />,
                            accentFrom: '#2563EB',
                            accentTo: '#0EA5E9',
                          },
                          {
                            id: 'Multi',
                            label: t('多城市行程', '多城市行程', 'Multi-City'),
                            icon: <GlobeIcon className="w-4 h-4" />,
                            accentFrom: '#4F46E5',
                            accentTo: '#6366F1',
                          },
                        ]}
                      />

                      {/* Quick City Suggestions / Cross-Country Combos */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                            {tripType === 'Multi'
                              ? t(
                                  `填入第 ${activeStop?.id || 1} 站城市`,
                                  `填入第 ${activeStop?.id || 1} 站城市`,
                                  `Pick City for Stop ${activeStop?.id || 1}`
                                )
                              : t('快速選擇城市', '快速选择城市', 'Popular Cities')}
                          </span>
                        </div>
                        <div className="flex md:flex-wrap gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                          {QUICK_CITIES.map((city) => {
                            const localized = localizeDestinationLabel(city, lang);
                            const currentVal =
                              tripType === 'Single'
                                ? singleDestination
                                : stops.find((s) => s.id === activeStopId)?.destination || '';
                            const isPicked = currentVal === city || currentVal === localized;
                            return (
                              <button
                                key={city}
                                type="button"
                                onClick={() => handleQuickCitySelect(lang === 'en' ? localized : city)}
                                className={`h-8 px-3.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                  isPicked
                                    ? 'bg-gradient-to-r from-[#2563EB] to-[#0EA5E9] text-white shadow-sm'
                                    : 'surface-elevated text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800'
                                }`}
                              >
                                {localized}
                              </button>
                            );
                          })}
                        </div>

                        {tripType === 'Multi' && (
                          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
                            <span className="text-[11px] text-indigo-500 dark:text-indigo-400 font-semibold shrink-0 px-1">
                              {t('跨國組合：', '跨国组合：', 'Combos:')}
                            </span>
                            {CROSS_COUNTRY_TEMPLATES.map((tpl) => (
                              <button
                                key={tpl.id}
                                type="button"
                                onClick={() => handleApplyMultiPreset(tpl.cities)}
                                className="h-7 px-2.5 rounded-full bg-indigo-500/10 hover:bg-indigo-500/18 text-indigo-700 dark:text-indigo-300 text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1"
                              >
                                <span>{tpl.cities.map((c) => localizeDestinationLabel(c, lang)).join(' → ')}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {tripType === 'Single' ? (
                        <div>
                          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 ml-1 mb-1.5 block">
                            {t('目的地', '目的地', 'Destination')}
                          </label>
                          <div className="surface-elevated px-4 h-12 rounded-2xl flex items-center gap-3">
                            <MapIcon className="w-4 h-4 text-[#2563EB] dark:text-sky-400 shrink-0" />
                            <input
                              required
                              type="text"
                              placeholder={t('東京、首爾、巴黎...', '东京、首尔、巴黎...', 'Tokyo, Seoul, Paris...')}
                              value={singleDestination}
                              onChange={(e) => setSingleDestination(e.target.value)}
                              className="bg-transparent w-full font-semibold text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {/* Cross-Country Route Summary Banner */}
                          {multiRouteIntel.filled.some((x) => x.city) && (
                            <div className="rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/14 border border-indigo-500/20 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs">
                              <div className="flex items-center gap-2 min-w-0">
                                <GlobeIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                <span className="font-semibold text-zinc-800 dark:text-zinc-100 truncate">
                                  {multiRouteIntel.isCrossCountry
                                    ? t(
                                        `跨國路線 · ${multiRouteIntel.countries.join(' → ')}`,
                                        `跨国路线 · ${multiRouteIntel.countries.join(' → ')}`,
                                        `Cross-Country · ${multiRouteIntel.countries.join(' → ')}`
                                      )
                                    : t(
                                        `多城市路線 · ${multiRouteIntel.countries[0] || ''}`,
                                        `多城市路线 · ${multiRouteIntel.countries[0] || ''}`,
                                        `Multi-Stop · ${multiRouteIntel.countries[0] || ''}`
                                      )}
                                </span>
                              </div>
                              <span className="font-num font-bold text-indigo-600 dark:text-indigo-300 shrink-0 whitespace-nowrap">
                                {multiRouteIntel.currencies.join(' → ')}
                              </span>
                            </div>
                          )}

                          {stops.map((stop, index) => {
                            const span = getDaySpanUtc(stop.startDate, stop.endDate);
                            const isActiveStop = activeStopId === stop.id;
                            const stopIntel = stop.destination.trim()
                              ? detectDestinationIntel(stop.destination.trim(), lang)
                              : null;
                            const nextStop = stops[index + 1];
                            const nextIntel =
                              nextStop && nextStop.destination.trim()
                                ? detectDestinationIntel(nextStop.destination.trim(), lang)
                                : null;
                            const isCrossBorderNext =
                              stopIntel && nextIntel && stopIntel.countryLabel !== nextIntel.countryLabel;
                            const tzDelta =
                              stopIntel && nextIntel
                                ? nextIntel.utcOffsetHours - stopIntel.utcOffsetHours
                                : 0;

                            return (
                              <React.Fragment key={stop.id}>
                                <motion.div
                                  layout
                                  initial={{ opacity: 0, y: 8 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  onClick={() => setActiveStopId(stop.id)}
                                  className={`surface-elevated p-3.5 sm:p-4 rounded-3xl transition-all cursor-pointer ${
                                    isActiveStop
                                      ? 'ring-2 ring-[#4F5DF5] shadow-[0_10px_24px_-12px_rgba(79,93,245,0.4)]'
                                      : 'hover:bg-white/95 dark:hover:bg-white/[0.06]'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 mb-2">
                                    <div
                                      className={`w-7 h-7 rounded-full flex items-center justify-center font-num font-bold text-xs shrink-0 ${
                                        isActiveStop
                                          ? 'bg-[#4F5DF5] text-white'
                                          : 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                                      }`}
                                    >
                                      {index + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <input
                                        required
                                        type="text"
                                        placeholder={t(
                                          `第 ${index + 1} 站城市（例：首爾、倫敦）`,
                                          `第 ${index + 1} 站城市（例：首尔、伦敦）`,
                                          `Stop ${index + 1} city (e.g. Seoul, London)`
                                        )}
                                        value={stop.destination}
                                        onFocus={() => setActiveStopId(stop.id)}
                                        onChange={(e) => handleStopChange(stop.id, 'destination', e.target.value)}
                                        className="w-full bg-transparent font-semibold text-base text-zinc-900 dark:text-white focus:outline-none placeholder-zinc-400"
                                      />
                                      {stopIntel && (
                                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-num truncate">
                                          {stopIntel.countryLabel} · {stopIntel.currency} · {stopIntel.timezoneLabel} · {stopIntel.voltagePlug}
                                        </div>
                                      )}
                                    </div>

                                    {span && (
                                      <span className="text-xs font-num font-semibold text-[#4F5DF5] dark:text-indigo-400 shrink-0 whitespace-nowrap">
                                        {t(
                                          `${span.days}天 / ${span.nights}晚`,
                                          `${span.days}天 / ${span.nights}晚`,
                                          `${span.days}D / ${span.nights}N`
                                        )}
                                      </span>
                                    )}

                                    {stops.length > 1 && (
                                      <div className="flex items-center gap-0.5 shrink-0">
                                        <button
                                          type="button"
                                          disabled={index === 0}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleMoveStop(stop.id, -1);
                                          }}
                                          aria-label={t('上移站點', '上移站点', 'Move stop up')}
                                          className="w-7 h-7 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-25 cursor-pointer disabled:cursor-default"
                                        >
                                          <ChevronUpIcon className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          disabled={index === stops.length - 1}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleMoveStop(stop.id, 1);
                                          }}
                                          aria-label={t('下移站點', '下移站点', 'Move stop down')}
                                          className="w-7 h-7 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-25 cursor-pointer disabled:cursor-default"
                                        >
                                          <ChevronDownIcon className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveStop(stop.id);
                                          }}
                                          aria-label={t('移除站點', '移除站点', 'Remove stop')}
                                          className="w-7 h-7 flex items-center justify-center rounded-full text-zinc-400 hover:text-red-500 transition-colors cursor-pointer"
                                        >
                                          <TrashIcon className="w-4 h-4" />
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  <div className="grid grid-cols-2 gap-2 text-xs font-num">
                                    <div className="bg-zinc-100/80 dark:bg-white/[0.04] px-3 py-2 rounded-xl">
                                      <span className="text-[10px] text-zinc-400 block">
                                        {t('抵達', '抵达', 'Arrive')}
                                      </span>
                                      <span className="font-semibold text-zinc-900 dark:text-white">
                                        {stop.startDate || t('選擇日期', '选择日期', 'Select date')}
                                      </span>
                                    </div>
                                    <div className="bg-zinc-100/80 dark:bg-white/[0.04] px-3 py-2 rounded-xl">
                                      <span className="text-[10px] text-zinc-400 block">
                                        {t('離開', '离开', 'Depart')}
                                      </span>
                                      <span className="font-semibold text-zinc-900 dark:text-white">
                                        {stop.endDate || t('選擇日期', '选择日期', 'Select date')}
                                      </span>
                                    </div>
                                  </div>
                                </motion.div>

                                {nextStop && (
                                  <div className="flex items-center justify-center py-0.5">
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/75 dark:bg-white/[0.06] border border-zinc-200/70 dark:border-white/[0.08] text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
                                      {isCrossBorderNext ? (
                                        <>
                                          <PlaneIcon className="w-3 h-3 text-indigo-500 shrink-0" />
                                          <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                                            {t('跨國移動', '跨国移动', 'International Leg')}
                                          </span>
                                          {stopIntel && nextIntel && (
                                            <span className="font-num text-zinc-500 dark:text-zinc-400">
                                              {stopIntel.currency !== nextIntel.currency
                                                ? `· ${stopIntel.currency}→${nextIntel.currency}`
                                                : ''}
                                              {tzDelta !== 0 ? ` · ${tzDelta > 0 ? `+${tzDelta}h` : `${tzDelta}h`}` : ''}
                                            </span>
                                          )}
                                        </>
                                      ) : (
                                        <>
                                          <ArrowLongRightIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                          <span>{t('移動至下一站', '移动至下一站', 'Transfer to next stop')}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </React.Fragment>
                            );
                          })}

                          {stops.length < 6 && (
                            <button
                              type="button"
                              onClick={handleAddStop}
                              className="w-full min-h-[44px] border border-dashed border-zinc-300 dark:border-white/15 rounded-full text-zinc-600 dark:text-zinc-300 font-semibold text-xs hover:border-[#4F5DF5] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <PlusIcon className="w-4 h-4" />
                              <span>{t('新增下一站', '添加下一站', 'Add Next Stop')}</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Optional Trip Name */}
                      <div>
                        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 ml-1 mb-1.5 block">
                          {t('旅程名稱（選填）', '旅程名称（选填）', 'Trip Name (Optional)')}
                        </label>
                        <div className="surface-elevated px-4 h-12 rounded-2xl flex items-center gap-3">
                          <TagIcon className="w-4 h-4 text-zinc-400 shrink-0" />
                          <input
                            type="text"
                            placeholder={
                              tripType === 'Multi'
                                ? stops.some((s) => s.destination.trim())
                                  ? t(
                                      `預設：${localizeDestinationLabel(stops.find((s) => s.destination.trim())!.destination.trim(), lang)} 跨城之旅`,
                                      `默认：${localizeDestinationLabel(stops.find((s) => s.destination.trim())!.destination.trim(), lang)} 跨城之旅`,
                                      `Default: ${localizeDestinationLabel(stops.find((s) => s.destination.trim())!.destination.trim(), lang)} Multi-City`
                                    )
                                  : t('例：日韓雙國自由行...', '例：日韩双国自由行...', 'e.g. Tokyo & Seoul Escape...')
                                : singleDestination.trim()
                                  ? t(
                                      `預設：${localizeDestinationLabel(singleDestination.trim(), lang)} 旅程`,
                                      `默认：${localizeDestinationLabel(singleDestination.trim(), lang)} 旅程`,
                                      `Default: ${localizeDestinationLabel(singleDestination.trim(), lang)} Trip`
                                    )
                                  : t('自訂名稱...', '自定义名称...', 'Custom trip name...')
                            }
                            value={tripName}
                            onChange={(e) => setTripName(e.target.value)}
                            className="bg-transparent w-full font-semibold text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Quiet Destination Intel Line (Single City) */}
                      <AnimatePresence>
                        {tripType === 'Single' && createPreviewIntel && (
                          <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 4 }}
                            className="surface-pastel-sky rounded-2xl px-4 py-3 flex items-center justify-between gap-3 text-xs"
                          >
                            <span className="text-zinc-700 dark:text-zinc-200 truncate">
                              {createPreviewIntel.countryLabel} · {createPreviewIntel.currencyName} (
                              {createPreviewIntel.currency}) · {createPreviewIntel.timezoneLabel} ·{' '}
                              {createPreviewIntel.voltagePlug}
                            </span>
                            <span className="font-num font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                              {createPreviewIntel.currency}
                            </span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Right Column on Tablet/Desktop: Dates, Quick Durations, Calendar & Submit */}
                    <div className="md:col-span-7 space-y-4">
                      {tripType === 'Single' ? (
                        <>
                          {/* Selected Dates Display Summary Pills */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="surface-pastel-sky px-4 py-2.5 rounded-2xl">
                              <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                                {t('出發日期', '出发日期', 'Departure')}
                              </div>
                              <div className="font-num font-bold text-sm text-zinc-900 dark:text-white mt-0.5">
                                {singleStartDate || t('未選擇', '未选择', 'Not selected')}
                              </div>
                            </div>
                            <div className="surface-pastel-sky px-4 py-2.5 rounded-2xl">
                              <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                                {t('回程日期', '返程日期', 'Return')}
                              </div>
                              <div className="font-num font-bold text-sm text-zinc-900 dark:text-white mt-0.5">
                                {singleEndDate || t('未選擇', '未选择', 'Not selected')}
                              </div>
                            </div>
                          </div>

                          {/* Quick Day-Count Selector */}
                          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                            <span className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">
                              {t('天數：', '天数：', 'Days:')}
                            </span>
                            {QUICK_DURATIONS.map((d) => {
                              const active = activeDurationDays === d;
                              return (
                                <button
                                  key={d}
                                  type="button"
                                  onClick={() => handleQuickDuration(d)}
                                  className={`h-8 px-3.5 rounded-full text-xs font-num font-semibold transition-all shrink-0 cursor-pointer ${
                                    active
                                      ? 'bg-gradient-to-r from-[#2563EB] to-[#0EA5E9] text-white shadow-sm'
                                      : 'surface-elevated text-zinc-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800'
                                  }`}
                                >
                                  {t(`${d}天`, `${d}天`, `${d}D`)}
                                </button>
                              );
                            })}
                          </div>

                          <DateRangeCalendar
                            startDate={singleStartDate}
                            endDate={singleEndDate}
                            onChangeRange={(s, e) => {
                              setSingleStartDate(s);
                              setSingleEndDate(e);
                            }}
                          />
                        </>
                      ) : (
                        <>
                          {/* Interactive Multi-Stop Timeline Strip (Tap to jump calendar & globe to stop) */}
                          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
                            {stops.map((s, idx) => {
                              const active = s.id === activeStopId;
                              const sSpan = getDaySpanUtc(s.startDate, s.endDate);
                              const cityLabel = s.destination.trim()
                                ? localizeDestinationLabel(s.destination.trim(), lang)
                                : t(`第${idx + 1}站`, `第${idx + 1}站`, `Stop ${idx + 1}`);
                              return (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => setActiveStopId(s.id)}
                                  className={`h-9 px-3.5 rounded-full text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-all ${
                                    active
                                      ? 'bg-gradient-to-r from-[#4F46E5] to-[#6366F1] text-white shadow-sm'
                                      : 'surface-elevated text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800'
                                  }`}
                                >
                                  <span className="font-num opacity-80">0{idx + 1}</span>
                                  <span>{cityLabel}</span>
                                  {sSpan && <span className="font-num opacity-85">· {sSpan.days}{t('天', '天', 'd')}</span>}
                                </button>
                              );
                            })}
                          </div>

                          {/* Quick Day-Count Selector for Active Stop */}
                          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                            <span className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">
                              {t(
                                `第 ${activeStop?.id || 1} 站天數：`,
                                `第 ${activeStop?.id || 1} 站天数：`,
                                `Stop ${activeStop?.id || 1} days:`
                              )}
                            </span>
                            {QUICK_DURATIONS.map((d) => {
                              const active = activeDurationDays === d;
                              return (
                                <button
                                  key={d}
                                  type="button"
                                  onClick={() => handleQuickDuration(d)}
                                  className={`h-8 px-3 rounded-full text-xs font-num font-semibold transition-all shrink-0 cursor-pointer ${
                                    active
                                      ? 'bg-gradient-to-r from-[#4F46E5] to-[#6366F1] text-white shadow-sm'
                                      : 'surface-elevated text-zinc-600 dark:text-zinc-300'
                                  }`}
                                >
                                  {t(`${d}天`, `${d}天`, `${d}D`)}
                                </button>
                              );
                            })}
                          </div>

                          {activeStop && (
                            <DateRangeCalendar
                              startDate={activeStop.startDate}
                              endDate={activeStop.endDate}
                              onChangeRange={(s, e) => handleStopRangeChange(activeStop.id, s, e)}
                            />
                          )}

                          {/* Full Multi-City Schedule Strip */}
                          {multiRouteIntel.totalSpan && (
                            <div className="surface-pastel-sky rounded-2xl px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
                              <span className="font-medium text-zinc-600 dark:text-zinc-300 truncate">
                                {t('全程日期：', '全程日期：', 'Total Schedule: ')}
                                <span className="font-num font-bold text-zinc-900 dark:text-white">
                                  {stops[0].startDate} ~ {stops[stops.length - 1].endDate}
                                </span>
                              </span>
                              <span className="font-num font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                                {t(
                                  `${multiRouteIntel.totalSpan.days} 天 ${multiRouteIntel.totalSpan.nights} 夜`,
                                  `${multiRouteIntel.totalSpan.days} 天 ${multiRouteIntel.totalSpan.nights} 晚`,
                                  `${multiRouteIntel.totalSpan.days}D / ${multiRouteIntel.totalSpan.nights}N`
                                )}
                              </span>
                            </div>
                          )}
                        </>
                      )}

                      <div className="pt-1">
                        <button
                          type="submit"
                          className="w-full min-h-[50px] bg-gradient-to-r from-[#2563EB] to-[#0EA5E9] text-white rounded-full font-semibold text-sm active:scale-[0.985] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_10px_24px_-8px_rgba(37,99,235,0.54)]"
                        >
                          <span>{t('開始規劃', '开始规划', 'Start Planning')}</span>
                          <ChevronRightIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
                </div>
              </motion.div>
            )}

            {/* ==================== 3. TRIP WORKSPACE VIEW ==================== */}
            {view === 'TRIP' && tripData && (
              <motion.div
                key="TRIP"
                data-scroll-lock
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full min-h-0 w-full flex flex-col md:flex-row overflow-clip relative"
              >
                {/* DESKTOP / TABLET LEFT SIDEBAR (Temporarily hidden while editing / modals open) */}
                <WorkspaceSidebar
                  tripData={tripData}
                  navItems={navItems}
                  activeTab={activeTab}
                  activeNavIndex={activeNavIndex}
                  navCurrentFrom={navCurrentFrom}
                  navCurrentTo={navCurrentTo}
                  navCurrentShadow={navCurrentShadow}
                  navGradCycle={navGradCycle}
                  syncBadge={syncBadge}
                  onGoHome={() => setView('HOME')}
                  onSelectTab={setActiveTab}
                  onOpenSyncHub={() => setIsSyncHubOpen(true)}
                  isHidden={isAnyModalOpen}
                />

                {/* MAIN WORKSPACE CONTENT */}
                <main
                  data-scroll-lock
                  className="flex-1 min-w-0 min-h-0 h-full overflow-clip relative z-10 flex flex-col"
                >
                  {/* UNIVERSAL TOP HEADER BAR (Back | Truly Centered Page Title aligned at h-10 | Connected Devices) */}
                  <header className="sticky top-0 shrink-0 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 lg:px-8 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 z-30">
                    <div className="relative h-10 w-full flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setView('HOME')}
                        aria-label={t('返回首頁', '返回首页', 'Back to home')}
                        className="relative z-10 surface-elevated h-10 px-3 sm:px-3.5 rounded-full flex items-center gap-1 text-zinc-800 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
                      >
                        <ChevronLeftIcon className="w-4 h-4" />
                        <span className="hidden sm:inline text-xs font-semibold">{t('返回', '返回', 'Back')}</span>
                      </button>

                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-24 sm:px-32">
                        <h1 className="h-10 inline-flex items-center justify-center text-sm sm:text-base font-display font-bold text-zinc-900 dark:text-white tracking-tight leading-none truncate">
                          {activePageTitle}
                        </h1>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsSyncHubOpen(true)}
                        aria-label={t('跨裝置同步與線上裝置數量', '跨设备同步与在线设备数量', 'Cross-device sync & online devices')}
                        title={syncBadge.text}
                        className="relative z-10 surface-elevated h-10 px-3 sm:px-3.5 rounded-full flex items-center gap-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-100 hover:bg-white dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
                      >
                        <span className={`w-2 h-2 rounded-full ${syncBadge.dotClass}`} />
                        <DevicePhoneMobileIcon className="w-4 h-4" />
                        <span className="font-num font-bold">{effectiveDeviceCount}</span>
                        <span className="hidden sm:inline text-[11px] text-zinc-500 dark:text-zinc-400">
                          {t('裝置', '设备', effectiveDeviceCount === 1 ? 'device' : 'devices')}
                        </span>
                      </button>
                    </div>
                  </header>

                  <div data-scroll-lock className="flex-1 min-h-0 h-full overflow-clip pb-[calc(88px+env(safe-area-inset-bottom))] md:pb-0">
                    {activeTab === Tab.ITINERARY && (
                      <ItineraryTool
                        trip={tripData}
                        onUpdateTrip={handleLocalUpdateTrip}
                        onShowToast={showToast}
                        focusDateSignal={focusDateSignal}
                        onSelectedDateChange={setActiveTripDate}
                      />
                    )}
                    {activeTab === Tab.EXPLORE && (
                      <ExploreTool
                        trip={tripData}
                        onUpdateTrip={handleLocalUpdateTrip}
                        onShowToast={showToast}
                        onOpenItineraryDate={handleOpenItineraryDate}
                      />
                    )}
                    {activeTab === Tab.EXPENSES && (
                      <ExpensesTool
                        trip={tripData}
                        onUpdateTrip={handleLocalUpdateTrip}
                        onShowToast={showToast}
                      />
                    )}
                    {(activeTab === Tab.TOOLBOX || activeTab === Tab.PACKING) && (
                      <PrepToolboxTool
                        trip={tripData}
                        cloudUserId={cloudAuth.user?.emailVerified ? cloudAuth.user.uid : null}
                        onUpdateTrip={handleLocalUpdateTrip}
                        onShowToast={showToast}
                      />
                    )}
                    {activeTab === Tab.SETTINGS && (
                      <div className="h-full overflow-y-auto no-scrollbar px-4 sm:px-6 md:px-8 pt-2 pb-8 md:pb-10">
                        <div className="max-w-2xl md:max-w-none lg:max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-5 lg:gap-6 items-start">
                          {/* Left Column on Wide Screens: Cloud Account + Live Sync + Appearance & Language */}
                          <div className="md:col-span-6 space-y-5">
                            {/* Top Hero Pair: Cloud Account & Live Collaboration Pass */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                              <button
                                type="button"
                                onClick={() => setIsAuthModalOpen(true)}
                                className="surface-elevated p-5 rounded-[24px] flex flex-col justify-between min-h-[140px] text-left hover:bg-white dark:hover:bg-zinc-800/75 active:scale-[0.99] transition-all cursor-pointer group"
                              >
                                <div className="flex items-center justify-between gap-3 w-full">
                                  {cloudAuth.user?.photoURL ? (
                                    <img
                                      src={cloudAuth.user.photoURL}
                                      alt=""
                                      className="w-11 h-11 rounded-full object-cover shrink-0 border border-zinc-200/70 dark:border-white/10"
                                      referrerPolicy="no-referrer"
                                    />
                                  ) : (
                                    <div className="w-11 h-11 rounded-full bg-[var(--tab-accent-soft)] text-[var(--tab-accent)] flex items-center justify-center shrink-0">
                                      <UserCircleIcon className="w-5 h-5" />
                                    </div>
                                  )}
                                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                                    <span
                                      className={`w-2 h-2 rounded-full ${
                                        cloudAuth.user
                                          ? cloudAuth.cloudStatus === 'error'
                                            ? 'bg-red-500'
                                            : 'bg-emerald-500'
                                          : 'bg-zinc-400'
                                      }`}
                                    />
                                    {cloudAuth.user
                                      ? t('雲端私人同步', '云端私人同步', 'Cloud Sync Active')
                                      : t('未登入', '未登录', 'Signed Out')}
                                  </span>
                                </div>

                                <div className="pt-4 flex items-end justify-between gap-2 w-full">
                                  <div className="min-w-0">
                                    <div className="font-display font-bold text-base text-zinc-900 dark:text-white truncate">
                                      {cloudAuth.user
                                        ? cloudAuth.user.displayName || t('雲端帳號', '云端账号', 'Cloud Account')
                                        : t('登入雲端帳號', '登录云端账号', 'Sign In to Cloud')}
                                    </div>
                                    <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                                      {cloudAuth.user
                                        ? cloudAuth.user.email ||
                                          t('Google · Apple 個人空間', 'Google · Apple 个人空间', 'Personal Google · Apple Space')
                                        : t('支援 Apple 與 Google 登入', '支持 Apple 与 Google 登录', 'Supports Apple & Google Sign-In')}
                                    </div>
                                  </div>
                                  <ChevronRightIcon className="w-4 h-4 text-zinc-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                                </div>
                              </button>

                              <button
                                type="button"
                                onClick={() => setIsSyncHubOpen(true)}
                                className="ink-card p-5 rounded-[24px] flex flex-col justify-between min-h-[140px] text-left hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer group"
                              >
                                <div className="flex items-center justify-between gap-3 w-full">
                                  <div className="w-11 h-11 rounded-2xl bg-white/10 text-violet-300 flex items-center justify-center shrink-0">
                                    <QrCodeIcon className="w-5 h-5" />
                                  </div>
                                  <span className="inline-flex items-center gap-1.5 text-xs font-num font-semibold text-white/90">
                                    <span className={`w-2 h-2 rounded-full ${syncBadge.dotClass}`} />
                                    {t(
                                      `${effectiveDeviceCount} 台裝置在線`,
                                      `${effectiveDeviceCount} 台设备在线`,
                                      `${effectiveDeviceCount} ${effectiveDeviceCount === 1 ? 'device' : 'devices'} online`
                                    )}
                                  </span>
                                </div>

                                <div className="pt-4 flex items-end justify-between gap-2 w-full">
                                  <div className="min-w-0">
                                    <div className="font-display font-bold text-base text-white">
                                      {t('跨裝置即時同步', '跨设备实时同步', 'Real-Time Device Sync')}
                                    </div>
                                    <div className="text-xs font-num text-violet-300 font-semibold tracking-wide mt-0.5">
                                      {tripData.syncId}
                                    </div>
                                  </div>
                                  <ChevronRightIcon className="w-4 h-4 text-zinc-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                                </div>
                              </button>
                            </div>

                            {/* Section 1: 外觀與顯示 */}
                            <section className="space-y-2">
                              <h2 className="px-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                                {t('外觀與顯示', '外观与显示', 'Appearance & Language')}
                              </h2>
                              <div className="surface-elevated rounded-[24px] p-4 sm:p-5 space-y-4">
                                <div className="space-y-3.5">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                      <DayNightOrbButton
                                        size="sm"
                                        mode={themeMode}
                                        isDark={isDarkResolved}
                                        onClick={cycleThemeMode}
                                        ariaLabel={t('切換外觀主題', '切换外观主题', 'Switch theme')}
                                      />
                                      <div className="min-w-0">
                                        <div className="font-display font-bold text-sm text-zinc-900 dark:text-white">
                                          {t('外觀主題', '外观主题', 'Appearance')}
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  <SlidingSegmentedControl
                                    variant="rounded"
                                    fullWidth
                                    value={themeMode}
                                    onChange={setThemeMode}
                                    options={[
                                      {
                                        id: 'system',
                                        label: t('跟隨系統', '跟随系统', 'System'),
                                        icon: <ComputerDesktopIcon className="w-3.5 h-3.5" />,
                                        accentFrom: '#4F46E5',
                                        accentTo: '#6366F1',
                                      },
                                      {
                                        id: 'light',
                                        label: t('日光模式', '日光模式', 'Light'),
                                        icon: <SunIcon className="w-3.5 h-3.5" />,
                                        accentFrom: '#2563EB',
                                        accentTo: '#0EA5E9',
                                      },
                                      {
                                        id: 'dark',
                                        label: t('夜間模式', '夜间模式', 'Dark'),
                                        icon: <MoonIcon className="w-3.5 h-3.5" />,
                                        accentFrom: '#7C3AED',
                                        accentTo: '#8B5CF6',
                                      },
                                    ]}
                                  />
                                </div>

                                <div className="pt-4 border-t border-zinc-200/70 dark:border-white/[0.08] space-y-3.5">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div className="w-9 h-9 rounded-xl bg-[var(--tab-accent-soft)] text-[var(--tab-accent)] flex items-center justify-center shrink-0">
                                        <GlobeIcon className="w-4 h-4" />
                                      </div>
                                      <div className="min-w-0">
                                        <div className="font-display font-bold text-sm text-zinc-900 dark:text-white">
                                          {t('介面語言', '界面语言', 'Language')}
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  <SlidingSegmentedControl
                                    variant="rounded"
                                    fullWidth
                                    value={lang}
                                    onChange={(nextLang: AppLanguage) => {
                                      setLanguage(nextLang);
                                      showToast(
                                        tr(
                                          nextLang,
                                          '已切換語言：繁體中文',
                                          '已切换语言：简体中文',
                                          'Language switched to English'
                                        ),
                                        'info'
                                      );
                                    }}
                                    options={LANGUAGE_OPTIONS.map((opt) => ({
                                      id: opt.id,
                                      label: opt.label,
                                      accentFrom: '#7C3AED',
                                      accentTo: '#8B5CF6',
                                    }))}
                                  />
                                </div>

                                <div className="pt-4 border-t border-zinc-200/70 dark:border-white/[0.08] flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-9 h-9 rounded-xl bg-[var(--tab-accent-soft)] text-[var(--tab-accent)] flex items-center justify-center shrink-0">
                                      {soundEnabled ? (
                                        <SpeakerWaveIcon className="w-4 h-4" />
                                      ) : (
                                        <SpeakerXMarkIcon className="w-4 h-4" />
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="font-display font-bold text-sm text-zinc-900 dark:text-white">
                                        {t('觸感互動音效', '触感互动音效', 'Tactile Sound FX')}
                                      </div>
                                      <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                                        {t('按鍵與開關回饋音效', '按键与开关反馈音效', 'Audio feedback for taps')}
                                      </div>
                                    </div>
                                  </div>
                                  <StretchToggle
                                    checked={soundEnabled}
                                    onChange={setSoundEnabled}
                                    ariaLabel={t('觸感互動音效', '触感互动音效', 'Tactile Sound FX')}
                                    className="shrink-0"
                                  />
                                </div>

                                <div className="pt-4 border-t border-zinc-200/70 dark:border-white/[0.08] flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-9 h-9 rounded-xl bg-[var(--tab-accent-soft)] text-[var(--tab-accent)] flex items-center justify-center shrink-0">
                                      <SparklesIcon className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="font-display font-bold text-sm text-zinc-900 dark:text-white">
                                        {t('Gemini AI 功能授權', 'Gemini AI 功能授权', 'Gemini AI Access')}
                                      </div>
                                      <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                                        {aiEnabled
                                          ? t('僅於手動點擊 AI 按鈕時才呼叫', '仅在手动点击 AI 按钮时才调用', 'Only called on manual click')
                                          : t('已全面鎖定，不會耗用 API 額度', '已全面锁定，不会消耗 API 额度', 'Locked — zero API spend')}
                                      </div>
                                    </div>
                                  </div>
                                  <StretchToggle
                                    checked={aiEnabled}
                                    onChange={(next) => {
                                      if (next) {
                                        requestAiEnable();
                                      } else {
                                        setAiEnabled(false);
                                        showToast(
                                          t('已鎖定所有 Gemini AI 呼叫', '已锁定所有 Gemini AI 调用', 'All Gemini AI calls locked'),
                                          'info'
                                        );
                                      }
                                    }}
                                    ariaLabel={t('Gemini AI 功能授權', 'Gemini AI 功能授权', 'Gemini AI Access')}
                                    className="shrink-0"
                                  />
                                </div>

                                <div className="pt-4 border-t border-zinc-200/70 dark:border-white/[0.08] flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div className="w-9 h-9 rounded-xl bg-[var(--tab-accent-soft)] text-[var(--tab-accent)] flex items-center justify-center shrink-0">
                                      <ShareIcon className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="font-display font-bold text-sm text-zinc-900 dark:text-white truncate">
                                        {t('分享本 App', '分享本 App', 'Share App')}
                                      </div>
                                      <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                                        {t('推薦給朋友', '推荐给朋友', 'Invite friends to Waynote')}
                                      </div>
                                    </div>
                                  </div>
                                  <ShareAppButton
                                    shareUrl={
                                      typeof window !== 'undefined'
                                        ? `${window.location.origin}${window.location.pathname}`
                                        : 'https://waynote.app'
                                    }
                                    shareTitle="Waynote"
                                    shareText={t(
                                      '推薦你用 Waynote 規劃旅行：即時跨裝置同步、智慧行程時間軸與旅遊開支分帳！',
                                      '推荐你用 Waynote 规划旅行：实时跨设备同步、智能行程时间轴与旅行开支分账！',
                                      'Plan trips together with Waynote — live sync, timeline itinerary, and smart travel splitting!'
                                    )}
                                    label={t('分享', '分享', 'Share')}
                                    sharedLabel={t('已分享', '已分享', 'Shared')}
                                    copiedLabel={t('已複製', '已复制', 'Copied')}
                                    className="!min-h-[38px] !px-3.5 text-xs shrink-0"
                                    onResult={(outcome) => {
                                      if (outcome === 'copied') {
                                        showToast(t('已複製 Waynote App 連結', '已复制 Waynote App 链接', 'Waynote app link copied'), 'success');
                                      } else if (outcome === 'shared') {
                                        showToast(t('感謝推薦 Waynote！', '感谢推荐 Waynote！', 'Thanks for sharing Waynote!'), 'success');
                                      }
                                    }}
                                  />
                                </div>
                              </div>
                            </section>
                          </div>

                          {/* Right Column on Wide Screens: Trip & Data + Danger Zone */}
                          <div className="md:col-span-6 space-y-5">
                            {/* Section 2: 旅程與資料管理 (Clean Grouped Hairline List) */}
                            <section className="space-y-2">
                              <h2 className="px-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                                {t('旅程與資料管理', '旅程与数据管理', 'Trip & Data Management')}
                              </h2>
                              <div className="surface-elevated rounded-[24px] overflow-hidden divide-y divide-zinc-200/70 dark:divide-white/[0.07]">
                                <button
                                  type="button"
                                  onClick={openEditModal}
                                  className="w-full px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-zinc-50/80 dark:hover:bg-white/[0.04] transition-colors cursor-pointer group"
                                >
                                  <div className="flex items-center gap-3.5 min-w-0">
                                    <div className="w-9 h-9 rounded-xl bg-[var(--tab-accent-soft)] text-[var(--tab-accent)] flex items-center justify-center shrink-0">
                                      <EditIcon className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="font-semibold text-sm text-zinc-900 dark:text-white">
                                        {t('修改旅程資訊', '修改旅程信息', 'Edit Trip Details')}
                                      </div>
                                      <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                                        {t('名稱、目的地與日期', '名称、目的地与日期', 'Name, destination & dates')}
                                      </div>
                                    </div>
                                  </div>
                                  <ChevronRightIcon className="w-4 h-4 text-zinc-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setCalendarDayDate(calendarDates[0] || tripData.startDate);
                                    setIsCalendarModalOpen(true);
                                  }}
                                  className="w-full px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-zinc-50/80 dark:hover:bg-white/[0.04] transition-colors cursor-pointer group"
                                >
                                  <div className="flex items-center gap-3.5 min-w-0">
                                    <div className="w-9 h-9 rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                      <CalendarIcon className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="font-semibold text-sm text-zinc-900 dark:text-white">
                                        {t('加入系統／Google 日曆', '加入系统／Google 日历', 'Add to Calendar')}
                                      </div>
                                      <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                                        {t('.ics 行事曆檔與 Google 批量加入', '.ics 日历文件与 Google 批量加入', '.ics export & Google batch add')}
                                      </div>
                                    </div>
                                  </div>
                                  <ChevronRightIcon className="w-4 h-4 text-zinc-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsExportModalOpen(true);
                                  }}
                                  className="w-full px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-zinc-50/80 dark:hover:bg-white/[0.04] transition-colors cursor-pointer group"
                                >
                                  <div className="flex items-center gap-3.5 min-w-0">
                                    <div className="w-9 h-9 rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                      <ArrowDownTrayIcon className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="font-semibold text-sm text-zinc-900 dark:text-white">
                                        {t('匯出與備份', '导出与备份', 'Export & Backup')}
                                      </div>
                                      <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                                        {t('.TXT 摘要或 .JSON 備份', '.TXT 摘要或 .JSON 备份', '.TXT summary or .JSON backup')}
                                      </div>
                                    </div>
                                  </div>
                                  <ChevronRightIcon className="w-4 h-4 text-zinc-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setIsChangelogOpen(true)}
                                  className="w-full px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-zinc-50/80 dark:hover:bg-white/[0.04] transition-colors cursor-pointer group"
                                >
                                  <div className="flex items-center gap-3.5 min-w-0">
                                    <div className="w-9 h-9 rounded-xl bg-zinc-900/6 dark:bg-white/10 text-zinc-700 dark:text-zinc-200 flex items-center justify-center shrink-0">
                                      <ClipboardDocumentListIcon className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="font-semibold text-sm text-zinc-900 dark:text-white">
                                        {t('版本紀錄', '版本记录', 'Release Notes')}
                                      </div>
                                      <div className="text-xs font-num text-[var(--tab-accent)] font-semibold truncate">
                                        {APP_VERSION}
                                      </div>
                                    </div>
                                  </div>
                                  <ChevronRightIcon className="w-4 h-4 text-zinc-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                                </button>
                              </div>
                            </section>

                            {/* Section 3: 封存與移除 */}
                            <section className="space-y-2">
                              <h2 className="px-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                                {t('進階操作', '高级操作', 'Advanced Actions')}
                              </h2>
                              <div className="surface-elevated rounded-[24px] overflow-hidden divide-y divide-zinc-200/70 dark:divide-white/[0.07]">
                                <button
                                  type="button"
                                  onClick={() => setIsArchiveConfirmOpen(true)}
                                  className="w-full px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-zinc-50/80 dark:hover:bg-white/[0.04] transition-colors cursor-pointer group"
                                >
                                  <div className="flex items-center gap-3.5 min-w-0">
                                    <div className="w-9 h-9 rounded-xl bg-amber-500/12 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                                      <ArchiveBoxArrowDownIcon className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="font-semibold text-sm text-zinc-900 dark:text-white">
                                        {t('封存旅程', '归档旅程', 'Archive Trip')}
                                      </div>
                                      <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                                        {t('移至歷史封存，可隨時還原', '移至历史归档，可随时恢复', 'Move to archive; restore anytime')}
                                      </div>
                                    </div>
                                  </div>
                                  <ChevronRightIcon className="w-4 h-4 text-zinc-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setIsDeleteConfirmOpen(true)}
                                  className="w-full px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-red-500/[0.06] transition-colors cursor-pointer group"
                                >
                                  <div className="flex items-center gap-3.5 min-w-0">
                                    <div className="w-9 h-9 rounded-xl bg-red-500/12 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                                      <TrashIcon className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="font-semibold text-sm text-red-600 dark:text-red-400">
                                        {t('移除本機旅程', '移除本地旅程', 'Remove Local Trip')}
                                      </div>
                                      <div className="text-xs text-red-500/75 truncate">
                                        {t('清除本機紀錄', '清除本地记录', 'Clear from this device')}
                                      </div>
                                    </div>
                                  </div>
                                  <ChevronRightIcon className="w-4 h-4 text-red-400/70 group-hover:translate-x-0.5 transition-transform shrink-0" />
                                </button>
                              </div>
                            </section>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* MOBILE & PORTRAIT TABLET FLOATING BOTTOM DOCK (5-Tab Self-Measured Sliding Gradient Pill) */}
                  <WorkspaceDock
                    navItems={navItems}
                    activeTab={activeTab}
                    activeNavIndex={activeNavIndex}
                    navCurrentFrom={navCurrentFrom}
                    navCurrentTo={navCurrentTo}
                    navCurrentShadow={navCurrentShadow}
                    navGradCycle={navGradCycle}
                    onSelectTab={setActiveTab}
                    isHidden={isAnyModalOpen}
                    isDark={isDarkResolved}
                  />
                </main>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ==================== GLOBAL MODALS ==================== */}
        <AuthModal
          open={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          user={cloudAuth.user}
          cloudStatus={cloudAuth.cloudStatus}
          lastCloudSyncAt={cloudAuth.lastCloudSyncAt}
          cloudError={cloudAuth.cloudError}
          quotaUpgradeUrl={cloudAuth.quotaUpgradeUrl}
          tripCount={tripsList.length}
          onSignInGoogle={cloudAuth.signInWithGoogle}
          onSignInApple={cloudAuth.signInWithApple}
          onSignOut={cloudAuth.signOut}
          onForceSync={cloudAuth.forceSyncAllLocalToCloud}
          onShowToast={showToast}
        />

        {tripData && (
          <SyncHubModal
            open={isSyncHubOpen}
            onClose={() => setIsSyncHubOpen(false)}
            syncId={tripData.syncId || ''}
            syncStatus={
              syncStatus === 'connected'
                ? 'connected'
                : cloudAuth.user && cloudAuth.cloudStatus === 'synced'
                  ? 'connected'
                  : syncStatus
            }
            connectedDevices={effectiveConnectedDevices}
            lastSyncedAt={lastSyncedAt || cloudAuth.lastCloudSyncAt}
            onJoinByCode={handleJoinByCode}
            onRegenerateCode={handleRegenerateSyncCode}
            onShowToast={showToast}
            cloudUser={cloudAuth.user}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
            currentClientId={clientId}
          />
        )}

        <ConfirmSheet
          open={isDeleteConfirmOpen}
          onClose={() => setIsDeleteConfirmOpen(false)}
          onConfirm={handleDeleteTrip}
          title={
            cloudAuth.user
              ? t('移除此旅程？', '移除此旅程？', 'Remove This Trip?')
              : t('移除此本機旅程？', '移除此本地旅程？', 'Remove Local Trip?')
          }
          description={
            cloudAuth.user
              ? t(
                  '將從本機與私人雲端帳號移除此旅程。',
                  '将从本地与私人云端账号移除此旅程。',
                  'Removes this trip from your device and cloud account.'
                )
              : t(
                  '將從本機列表移除此旅程。',
                  '将从本地列表移除此旅程。',
                  'Removes this trip from this device.'
                )
          }
          confirmLabel={t('確認移除', '确认移除', 'Remove')}
          cancelLabel={t('取消', '取消', 'Cancel')}
          tone="danger"
          icon={<TrashIcon className="w-6 h-6" />}
          requireHold
        />

        <ConfirmSheet
          open={isArchiveConfirmOpen}
          onClose={() => setIsArchiveConfirmOpen(false)}
          onConfirm={handleArchiveTrip}
          title={t('封存目前旅程？', '归档当前旅程？', 'Archive This Trip?')}
          description={t(
            '將移至封存清單，可隨時還原。',
            '将移至归档列表，可随时恢复。',
            'Moves trip to archive; restore anytime.'
          )}
          confirmLabel={t('確認封存', '确认归档', 'Archive')}
          cancelLabel={t('取消', '取消', 'Cancel')}
          tone="primary"
          icon={<ArchiveBoxArrowDownIcon className="w-6 h-6" />}
        />

        {/* Edit Trip Modal */}
        <LiquidModal
          open={isEditTripOpen}
          onClose={() => setIsEditTripOpen(false)}
          title={t('修改旅程', '修改旅程', 'Edit Trip')}
          maxWidthClass="max-w-md"
        >
          <div className="overflow-y-auto no-scrollbar space-y-4 pr-0.5 max-h-[70vh]">
            <div>
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1.5 block">
                {t('旅程名稱', '旅程名称', 'Trip Name')}
              </label>
              <input
                type="text"
                value={editTripData.name}
                onChange={(e) => setEditTripData({ ...editTripData, name: e.target.value })}
                className="w-full min-h-[44px] px-4 rounded-2xl bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200/70 dark:border-white/10 font-semibold text-sm text-zinc-900 dark:text-white focus:outline-none"
              />
            </div>

            {tripData?.type === 'Single' ? (
              <>
                <div>
                  <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1.5 block">
                    {t('目的地', '目的地', 'Destination')}
                  </label>
                  <input
                    type="text"
                    value={editTripData.destination}
                    onChange={(e) => setEditTripData({ ...editTripData, destination: e.target.value })}
                    className="w-full min-h-[44px] px-4 rounded-2xl bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200/70 dark:border-white/10 font-semibold text-sm text-zinc-900 dark:text-white focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs font-num">
                  <div className="bg-zinc-100 dark:bg-white/[0.05] px-3.5 py-2.5 rounded-2xl">
                    <span className="text-[10px] text-zinc-500 block">
                      {t('出發日期', '出发日期', 'Start Date')}
                    </span>
                    <span className="font-bold text-zinc-900 dark:text-white">{editTripData.startDate}</span>
                  </div>
                  <div className="bg-zinc-100 dark:bg-white/[0.05] px-3.5 py-2.5 rounded-2xl">
                    <span className="text-[10px] text-zinc-500 block">
                      {t('結束日期', '结束日期', 'End Date')}
                    </span>
                    <span className="font-bold text-zinc-900 dark:text-white">{editTripData.endDate}</span>
                  </div>
                </div>
                <DateRangeCalendar
                  startDate={editTripData.startDate}
                  endDate={editTripData.endDate}
                  onChangeRange={(s, e) => setEditTripData({ ...editTripData, startDate: s, endDate: e })}
                />
              </>
            ) : (
              <div className="space-y-3">
                {editStops.map((stop, idx) => (
                  <div
                    key={stop.id}
                    className="p-3.5 rounded-2xl border border-zinc-200/70 dark:border-white/10 bg-zinc-100/70 dark:bg-white/[0.04] space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-[#2563EB] dark:text-sky-400 font-num">
                        {t(`第 ${idx + 1} 站`, `第 ${idx + 1} 站`, `Stop ${idx + 1}`)}
                      </span>
                      {editStops.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveEditStop(stop.id)}
                          className="text-xs text-zinc-400 hover:text-red-500 cursor-pointer"
                        >
                          {t('移除', '移除', 'Remove')}
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={stop.destination}
                      onChange={(e) => handleEditStopChange(stop.id, 'destination', e.target.value)}
                      placeholder={t('城市名稱', '城市名称', 'City name')}
                      className="w-full min-h-[40px] px-3 rounded-xl bg-white dark:bg-zinc-900/70 font-semibold text-sm text-zinc-900 dark:text-white focus:outline-none"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={stop.startDate}
                        onChange={(e) => handleEditStopChange(stop.id, 'startDate', e.target.value)}
                        className="w-full min-h-[38px] px-2.5 rounded-xl bg-white dark:bg-zinc-900/70 font-num text-xs text-zinc-900 dark:text-white focus:outline-none"
                      />
                      <input
                        type="date"
                        value={stop.endDate}
                        onChange={(e) => handleEditStopChange(stop.id, 'endDate', e.target.value)}
                        className="w-full min-h-[38px] px-2.5 rounded-xl bg-white dark:bg-zinc-900/70 font-num text-xs text-zinc-900 dark:text-white focus:outline-none"
                      />
                    </div>
                  </div>
                ))}
                {editStops.length < 6 && (
                  <button
                    type="button"
                    onClick={handleAddEditStop}
                    className="w-full min-h-[42px] border border-dashed border-zinc-300 dark:border-white/15 rounded-full text-zinc-500 dark:text-zinc-400 font-semibold text-xs hover:border-[#2563EB] transition-colors cursor-pointer"
                  >
                    {t('+ 增加站點', '+ 添加站点', '+ Add Stop')}
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={handleConfirmEdit}
              className="w-full min-h-[46px] bg-[var(--tab-accent)] hover:bg-[var(--tab-accent-hover)] text-white rounded-full font-semibold text-sm cursor-pointer mt-2 transition-colors"
            >
              {t('儲存變更', '保存变更', 'Save Changes')}
            </button>
          </div>
        </LiquidModal>

        {/* Changelog Modal */}
        <LiquidModal
          open={isChangelogOpen}
          onClose={() => setIsChangelogOpen(false)}
          title={t('版本紀錄', '版本记录', 'Release Notes')}
          maxWidthClass="max-w-md"
        >
          <div className="overflow-y-auto no-scrollbar space-y-5 pr-1 max-h-[68vh]">
            {getChangelogItems(lang).map((log, i) => (
              <div key={log.version} className="relative pl-4 border-l-2 border-zinc-200 dark:border-white/10">
                <div
                  className={`absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full ${
                    i === 0 ? 'bg-[var(--tab-accent)]' : 'bg-zinc-300 dark:bg-zinc-600'
                  }`}
                />
                <h4 className="font-bold text-zinc-900 dark:text-white text-sm flex items-center gap-2">
                  <span>{log.version}</span>
                  <span className="text-zinc-400 text-xs font-num font-normal">{log.date}</span>
                </h4>
                <ul className="space-y-1 mt-1.5">
                  {log.notes.map((item, j) => (
                    <li key={j} className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                      • {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </LiquidModal>

        {/* Export Modal */}
        <LiquidModal
          open={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          title={t('匯出與備份', '导出与备份', 'Export & Backup')}
          maxWidthClass="max-w-lg"
        >
          <div className="flex flex-col gap-4 overflow-hidden">
            <div className="bg-zinc-100 dark:bg-zinc-950/60 p-4 rounded-2xl max-h-[46vh] overflow-y-auto no-scrollbar border border-zinc-200/70 dark:border-white/10">
              <pre className="text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed">
                {exportContent}
              </pre>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 shrink-0">
              <CopyMorphButton
                variant="subtle"
                textToCopy={exportContent}
                label={t('複製文字', '复制文本', 'Copy Text')}
                copiedLabel={t('已複製', '已复制', 'Copied')}
                onCopy={() => showToast(t('已複製文字', '已复制文字', 'Copied text'), 'success')}
                className="rounded-full"
              />
              <DownloadProgressButton
                variant="subtle"
                onDownload={handleDownloadTxt}
                label={t('下載 .TXT', '下载 .TXT', 'Download .TXT')}
                doneLabel={t('已下載', '已下载', 'Saved')}
                className="rounded-full"
              />
              <DownloadProgressButton
                variant="accent"
                onDownload={handleDownloadJsonBackup}
                label={t('備份 .JSON', '备份 .JSON', 'Backup .JSON')}
                doneLabel={t('已備份', '已备份', 'Backed Up')}
                className="rounded-full"
              />
            </div>
          </div>
        </LiquidModal>

        {/* Calendar Export Modal (in Settings) */}
        {tripData && (
          <LiquidModal
            open={isCalendarModalOpen}
            onClose={() => setIsCalendarModalOpen(false)}
            bottomSheetOnMobile
            maxWidthClass="max-w-lg"
            title={
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <CalendarIcon className="w-4 h-4" />
                </div>
                <span>{t('加入系統／Google 日曆', '加入系统／Google 日历', 'Add to System / Google Calendar')}</span>
              </div>
            }
          >
            <div className="overflow-y-auto no-scrollbar space-y-4 pr-0.5">
              {calendarBundle.eventCount === 0 ? (
                <div className="p-6 rounded-2xl bg-zinc-50 dark:bg-white/[0.04] border border-zinc-200/70 dark:border-white/10 text-center space-y-1.5">
                  <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    {t('目前尚無行程項目', '当前暂无行程项目', 'No scheduled activities yet')}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {t('新增行程或航班後即可匯出', '添加行程或航班后即可导出', 'Add activities or flights to export')}
                  </p>
                </div>
              ) : (
                <>
                  {/* Whole-Trip Batch Export (.ics Ring + Whole-Trip Google Calendar) */}
                  <div className="p-4 rounded-2xl bg-zinc-50/90 dark:bg-white/[0.04] border border-zinc-200/70 dark:border-white/10 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-display font-bold text-zinc-900 dark:text-white">
                        {t('整趟旅程', '整趟旅程', 'Full Trip')}
                      </span>
                      <span className="text-xs font-num font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                        {t(`共 ${calendarBundle.eventCount} 筆`, `共 ${calendarBundle.eventCount} 条`, `${calendarBundle.eventCount} events`)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <DownloadProgressButton
                        variant="accent"
                        label={t('下載 .ics 檔', '下载 .ics 文件', 'Download .ics')}
                        doneLabel={t('已下載', '已下载', 'Downloaded')}
                        icon={<ArrowDownTrayIcon className="w-4 h-4" />}
                        onDownload={() => {
                          downloadTripIcs(calendarBundle.icsContent, calendarBundle.filename);
                          showToast(
                            t('已下載整趟旅程 .ics', '已下载整趟旅程 .ics', 'Downloaded full trip .ics'),
                            'success'
                          );
                        }}
                        className="w-full"
                      />

                      {tripBatchGoogleUrl && (
                        <a
                          href={tripBatchGoogleUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => tactileAudio.playClick(520, 0.04)}
                          className="min-h-[44px] px-4 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all whitespace-nowrap"
                        >
                          <CalendarIcon className="w-4 h-4 shrink-0" />
                          <span>{t('整趟加至 Google', '整趟加至 Google', 'Add Trip to Google')}</span>
                          <ArrowUpRightIcon className="w-3.5 h-3.5 shrink-0" />
                        </a>
                      )}
                    </div>

                    <div className="flex justify-end">
                      <a
                        href="https://calendar.google.com/calendar/r/settings/export"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-medium text-blue-600 dark:text-sky-400 hover:underline inline-flex items-center gap-1"
                      >
                        <span>{t('前往 Google 匯入 .ics', '前往 Google 导入 .ics', 'Import .ics in Google Calendar')}</span>
                        <ArrowUpRightIcon className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  {/* Google Calendar Day Batch + Per-Item Quick Add */}
                  <div className="p-4 rounded-2xl bg-zinc-50/90 dark:bg-white/[0.04] border border-zinc-200/70 dark:border-white/10 space-y-3">
                    <div className="text-sm font-display font-bold text-zinc-900 dark:text-white">
                      {t('加入 Google 日曆', '加入 Google 日历', 'Add to Google Calendar')}
                    </div>

                    {calendarDates.length > 0 && (
                      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                        {calendarDates.map((d, idx) => {
                          const active = d === calendarDayDate;
                          return (
                            <button
                              key={d}
                              type="button"
                              onClick={() => setCalendarDayDate(d)}
                              className={`h-8 px-3 rounded-full text-xs font-num font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                active
                                  ? 'bg-[var(--tab-accent)] text-white shadow-sm'
                                  : 'bg-white dark:bg-zinc-900/70 border border-zinc-200/70 dark:border-white/10 text-zinc-600 dark:text-zinc-300'
                              }`}
                            >
                              D{idx + 1} · {d.slice(5)}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {dayBatchGoogleUrl && (
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <a
                          href={dayBatchGoogleUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => tactileAudio.playClick(520, 0.04)}
                          className="sm:col-span-8 min-h-[40px] px-4 rounded-xl bg-blue-600/12 hover:bg-blue-600/18 text-blue-700 dark:text-sky-300 border border-blue-500/25 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                        >
                          <CalendarIcon className="w-3.5 h-3.5 shrink-0" />
                          <span>{t('當日整天加至 Google', '当日整天加至 Google', 'Add Whole Day to Google')}</span>
                          <ArrowUpRightIcon className="w-3 h-3 shrink-0" />
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            tactileAudio.playClick(500, 0.035);
                            downloadTripIcs(dayIcsBundle.icsContent, dayIcsBundle.filename);
                            showToast(
                              t('已下載本日 .ics', '已下载本日 .ics', 'Downloaded day .ics'),
                              'success'
                            );
                          }}
                          className="sm:col-span-4 min-h-[40px] px-3 rounded-xl bg-white dark:bg-zinc-900/70 border border-zinc-200/70 dark:border-white/10 hover:border-[var(--tab-accent)]/40 text-xs font-semibold text-zinc-700 dark:text-zinc-200 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          <ArrowDownTrayIcon className="w-3.5 h-3.5 shrink-0" />
                          <span>{t('本日 .ics', '本日 .ics', 'Day .ics')}</span>
                        </button>
                      </div>
                    )}

                    {(tripData.activities[calendarDayDate] || []).length === 0 ? (
                      <p className="text-xs text-zinc-400 py-2">
                        {t('此日暫無行程項目', '此日暂无行程项目', 'No activities on this day')}
                      </p>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto no-scrollbar pt-0.5">
                        {(tripData.activities[calendarDayDate] || []).map((act) => {
                          const timeText =
                            act.type === 'flight' && act.flightInfo
                              ? act.flightInfo.departureTime
                              : act.time;
                          return (
                            <a
                              key={act.id}
                              href={buildGoogleCalendarEventUrl(tripData, calendarDayDate, act, lang)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-white dark:bg-zinc-900/70 border border-zinc-200/70 dark:border-white/10 hover:border-[var(--tab-accent)]/40 transition-colors"
                            >
                              <div className="min-w-0 flex items-center gap-2.5">
                                <span className="text-xs font-num font-bold text-[#F26B3A] shrink-0">
                                  {timeText}
                                </span>
                                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-100 truncate">
                                  {act.title}
                                </span>
                              </div>
                              <span className="text-[11px] font-semibold text-blue-600 dark:text-sky-400 inline-flex items-center gap-1 shrink-0 whitespace-nowrap">
                                <span>Google +</span>
                                <ArrowUpRightIcon className="w-3 h-3" />
                              </span>
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </LiquidModal>
        )}

        {/* Home Global Settings Modal */}
        <LiquidModal
          open={showHomeSettings}
          onClose={() => setShowHomeSettings(false)}
          bottomSheetOnMobile
          maxWidthClass="max-w-lg"
          title={
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/12 text-[#2563EB] dark:text-sky-400 flex items-center justify-center shrink-0">
                <CogIcon className="w-4 h-4" />
              </div>
              <span>{t('全域設定', '全局设置', 'Settings')}</span>
            </div>
          }
        >
          <div className="overflow-y-auto no-scrollbar space-y-4 pr-0.5 max-h-[75vh]">
            {/* Cloud Account Status Card */}
            <button
              type="button"
              onClick={() => {
                setShowHomeSettings(false);
                setIsAuthModalOpen(true);
              }}
              className="w-full p-4 rounded-2xl bg-zinc-50/90 dark:bg-white/[0.04] border border-zinc-200/70 dark:border-white/10 flex items-center justify-between gap-3 text-left hover:bg-white dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                {cloudAuth.user?.photoURL ? (
                  <img
                    src={cloudAuth.user.photoURL}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover shrink-0 border border-zinc-200/70 dark:border-white/10"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-blue-500/12 text-[#2563EB] dark:text-sky-400 flex items-center justify-center shrink-0">
                    <UserCircleIcon className="w-5 h-5" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-display font-bold text-sm text-zinc-900 dark:text-white truncate">
                    {cloudAuth.user
                      ? cloudAuth.user.displayName || t('雲端帳號', '云端账号', 'Cloud Account')
                      : t('登入雲端帳號', '登录云端账号', 'Sign In to Cloud')}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                    {cloudAuth.user
                      ? cloudAuth.user.email || t('雲端同步已連線', '云端同步已连接', 'Cloud Sync Active')
                      : t('支援 Google 與 Apple 跨裝置備份', '支持 Google 与 Apple 跨设备备份', 'Backup with Google & Apple')}
                  </div>
                </div>
              </div>
              <ChevronRightIcon className="w-4 h-4 text-zinc-400 shrink-0" />
            </button>

            {/* Appearance & Language */}
            <div className="p-4 rounded-2xl bg-zinc-50/90 dark:bg-white/[0.04] border border-zinc-200/70 dark:border-white/10 space-y-4">
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                  <SunIcon className="w-4 h-4 text-[#2563EB] dark:text-sky-400" />
                  <span>{t('外觀主題', '外观主题', 'Appearance')}</span>
                </div>
                <SlidingSegmentedControl
                  variant="rounded"
                  fullWidth
                  value={themeMode}
                  onChange={setThemeMode}
                  options={[
                    { id: 'system', label: t('跟隨系統', '跟随系统', 'System'), icon: <ComputerDesktopIcon className="w-3.5 h-3.5" />, accentFrom: '#4F46E5', accentTo: '#6366F1' },
                    { id: 'light', label: t('日光模式', '日光模式', 'Light'), icon: <SunIcon className="w-3.5 h-3.5" />, accentFrom: '#2563EB', accentTo: '#0EA5E9' },
                    { id: 'dark', label: t('夜間模式', '夜间模式', 'Dark'), icon: <MoonIcon className="w-3.5 h-3.5" />, accentFrom: '#7C3AED', accentTo: '#8B5CF6' },
                  ]}
                />
              </div>

              <div className="pt-3 border-t border-zinc-200/70 dark:border-white/[0.08] space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                  <GlobeIcon className="w-4 h-4 text-violet-500" />
                  <span>{t('介面語言', '界面语言', 'Language')}</span>
                </div>
                <SlidingSegmentedControl
                  variant="rounded"
                  fullWidth
                  value={lang}
                  onChange={(nextLang: AppLanguage) => {
                    setLanguage(nextLang);
                    showToast(
                      tr(
                        nextLang,
                        '已切換語言：繁體中文',
                        '已切换语言：简体中文',
                        'Language switched to English'
                      ),
                      'info'
                    );
                  }}
                  options={LANGUAGE_OPTIONS.map((opt) => ({
                    id: opt.id,
                    label: opt.label,
                    accentFrom: '#7C3AED',
                    accentTo: '#8B5CF6',
                  }))}
                />
              </div>
            </div>

            {/* Toggles: Tactile Sound + Gemini AI Safeguard */}
            <div className="rounded-2xl bg-zinc-50/90 dark:bg-white/[0.04] border border-zinc-200/70 dark:border-white/10 divide-y divide-zinc-200/70 dark:divide-white/[0.07]">
              <div className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/12 text-[#2563EB] dark:text-sky-400 flex items-center justify-center shrink-0">
                    {soundEnabled ? <SpeakerWaveIcon className="w-4 h-4" /> : <SpeakerXMarkIcon className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-zinc-900 dark:text-white">
                      {t('觸感互動音效', '触感互动音效', 'Tactile Sound FX')}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                      {t('按鍵與開關回饋音效', '按键与开关反馈音效', 'Audio feedback for taps')}
                    </div>
                  </div>
                </div>
                <StretchToggle
                  checked={soundEnabled}
                  onChange={setSoundEnabled}
                  ariaLabel={t('觸感互動音效', '触感互动音效', 'Tactile Sound FX')}
                  className="shrink-0"
                />
              </div>

              <div className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/12 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <SparklesIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-zinc-900 dark:text-white">
                      {t('Gemini AI 功能授權', 'Gemini AI 功能授权', 'Gemini AI Access')}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                      {aiEnabled
                        ? t('僅於手動點擊時呼叫', '仅在手动点击时调用', 'Only called on manual tap')
                        : t('已鎖定，防止誤觸耗用額度', '已锁定，防止误触消耗额度', 'Locked — prevents accidental usage')}
                    </div>
                  </div>
                </div>
                <StretchToggle
                  checked={aiEnabled}
                  onChange={(next) => {
                    if (next) {
                      requestAiEnable();
                    } else {
                      setAiEnabled(false);
                      showToast(
                        t('已鎖定所有 Gemini AI 呼叫', '已锁定所有 Gemini AI 调用', 'All Gemini AI calls locked'),
                        'info'
                      );
                    }
                  }}
                  ariaLabel={t('Gemini AI 功能授權', 'Gemini AI 功能授权', 'Gemini AI Access')}
                  className="shrink-0"
                />
              </div>

              <div className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <ShareIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm text-zinc-900 dark:text-white truncate">
                      {t('分享本 App', '分享本 App', 'Share App')}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                      {t('推薦給旅伴好友', '推荐给旅伴好友', 'Invite travel companions')}
                    </div>
                  </div>
                </div>
                <ShareAppButton
                  shareUrl={
                    typeof window !== 'undefined'
                      ? `${window.location.origin}${window.location.pathname}`
                      : 'https://waynote.app'
                  }
                  shareTitle="Waynote"
                  shareText={t(
                    '推薦你用 Waynote 規劃旅行：即時跨裝置同步、智慧行程時間軸與旅遊開支分帳！',
                    '推荐你用 Waynote 规划旅行：实时跨设备同步、智能行程时间轴与旅行开支分账！',
                    'Plan trips together with Waynote — live sync, timeline itinerary, and smart travel splitting!'
                  )}
                  label={t('分享', '分享', 'Share')}
                  sharedLabel={t('已分享', '已分享', 'Shared')}
                  copiedLabel={t('已複製', '已复制', 'Copied')}
                  className="!min-h-[38px] !px-3.5 text-xs shrink-0"
                  onResult={(outcome) => {
                    if (outcome === 'copied') {
                      showToast(t('已複製 Waynote App 連結', '已复制 Waynote App 链接', 'Waynote app link copied'), 'success');
                    } else if (outcome === 'shared') {
                      showToast(t('感謝推薦 Waynote！', '感谢推荐 Waynote！', 'Thanks for sharing Waynote!'), 'success');
                    }
                  }}
                />
              </div>
            </div>

            {/* Data & Version */}
            <div className="rounded-2xl bg-zinc-50/90 dark:bg-white/[0.04] border border-zinc-200/70 dark:border-white/10 divide-y divide-zinc-200/70 dark:divide-white/[0.07]">
              <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-white/80 dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <ArrowUpTrayIcon className="w-4 h-4 text-zinc-600 dark:text-zinc-300 shrink-0" />
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {t('匯入 JSON 備份', '导入 JSON 备份', 'Import JSON Backup')}
                  </span>
                </div>
                <ChevronRightIcon className="w-4 h-4 text-zinc-400 shrink-0" />
              </button>

              <div>
                <button
                  type="button"
                  onClick={() => setShowArchivedList(!showArchivedList)}
                  className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-white/80 dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ArchiveIcon className="w-4 h-4 text-zinc-600 dark:text-zinc-300 shrink-0" />
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {t(
                        `已封存旅程 (${archivedTrips.length})`,
                        `已归档旅程 (${archivedTrips.length})`,
                        `Archived Trips (${archivedTrips.length})`
                      )}
                    </span>
                  </div>
                  <ChevronRightIcon
                    className={`w-4 h-4 text-zinc-400 transition-transform shrink-0 ${
                      showArchivedList ? 'rotate-90' : ''
                    }`}
                  />
                </button>
                {showArchivedList && (
                  <div className="px-3 pb-3 space-y-1.5 max-h-44 overflow-y-auto no-scrollbar border-t border-zinc-200/70 dark:border-white/10 pt-2">
                    {archivedTrips.length === 0 ? (
                      <p className="text-xs text-zinc-400 text-center py-2">
                        {t('暫無封存紀錄', '暂无归档记录', 'No archived trips')}
                      </p>
                    ) : (
                      archivedTrips.map((arch) => (
                        <button
                          type="button"
                          key={arch.id}
                          onClick={() => handleRestoreTrip(arch)}
                          className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors text-left group cursor-pointer"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                              {arch.name}
                            </p>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate font-num">
                              {localizeDestinationLabel(arch.destination, lang)} · {arch.startDate}
                            </p>
                          </div>
                          <RefreshIcon className="w-4 h-4 text-zinc-400 group-hover:text-[#2563EB] dark:group-hover:text-sky-400 shrink-0" />
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowHomeSettings(false);
                  setIsChangelogOpen(true);
                }}
                className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-white/80 dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <ClipboardDocumentListIcon className="w-4 h-4 text-zinc-600 dark:text-zinc-300 shrink-0" />
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {t('版本紀錄', '版本记录', 'Release Notes')}
                  </span>
                </div>
                <span className="text-xs font-num font-bold text-[#2563EB] dark:text-sky-400">
                  {APP_VERSION}
                </span>
              </button>
            </div>
          </div>
        </LiquidModal>

        {/* Gemini AI Enable Safeguard Confirmation Modal */}
        <LiquidModal
          open={isAiConfirmOpen}
          onClose={() => setIsAiConfirmOpen(false)}
          maxWidthClass="max-w-sm"
          zIndexClass="z-[115]"
          title={t('是否確認開啟 Gemini AI？', '是否确认开启 Gemini AI？', 'Enable Gemini AI?')}
        >
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/15 border border-indigo-500/20 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shrink-0">
                <ShieldCheckIcon className="w-5 h-5" />
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                {t(
                  '開啟後僅在您手動點擊探索或規劃按鈕時才會呼叫 Gemini API。滑動下方確認按鈕即可解除鎖定。',
                  '开启后仅在您手动点击探索或规划按钮时才会调用 Gemini API。滑动下方确认按钮即可解除锁定。',
                  'Gemini API is only called when you manually tap AI features. Swipe below to confirm unlocking.'
                )}
              </p>
            </div>

            <SwipeConfirmButton
              label={t('向右滑動確認開啟 Gemini AI', '向右滑动确认开启 Gemini AI', 'Swipe right to enable AI')}
              confirmedLabel={t('已開啟 Gemini AI', '已开启 Gemini AI', 'Gemini AI Enabled')}
              onConfirm={() => {
                setAiEnabled(true);
                setIsAiConfirmOpen(false);
                showToast(
                  t('已允許手動觸發 Gemini AI 功能', '已允许手动触发 Gemini AI 功能', 'Gemini AI access enabled'),
                  'success'
                );
              }}
            />

            <button
              type="button"
              onClick={() => setIsAiConfirmOpen(false)}
              className="w-full min-h-[42px] rounded-full bg-zinc-100 dark:bg-white/[0.08] text-zinc-700 dark:text-zinc-200 text-xs font-semibold cursor-pointer hover:bg-zinc-200/80 dark:hover:bg-white/[0.14] transition-colors"
            >
              {t('取消，保持鎖定', '取消，保持锁定', 'Cancel & Keep Locked')}
            </button>
          </div>
        </LiquidModal>
      </div>
    </MotionConfig>
  );
}

export default App;
