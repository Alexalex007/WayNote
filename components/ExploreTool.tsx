import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trip, SavedPlace, SavedPlaceCategory, Activity } from '../types';
import { generateUniqueId } from '../shared/syncMerge';
import { detectDestinationIntel } from '../shared/destinationIntel';
import {
  formatDayBadge,
  formatDurationLabel,
  formatStopsCount,
  formatTimeDisplay,
} from '../shared/i18n';
import { useI18n } from '../hooks/useI18n';
import { getDaySpanUtc, addDaysUtc } from './DateRangeCalendar';
import { LiquidModal, ConfirmSheet, SlidingSegmentedControl } from './LiquidPrimitives';
import {
  BookmarkBurstButton,
  StampButton,
  MovingBorderBeamButton,
  NeonOutlineButton,
} from './TactileButtons';
import { AiPlannerWorkspace, ApplyAiPlanOptions } from './AiPlannerModal';
import { RouteMapModal } from './RouteMapModal';
import { tactileAudio } from '../services/tactileAudio';
import { useAiAccess } from '../hooks/useAiAccess';
import {
  CompassIcon,
  PlusIcon,
  SparklesIcon,
  CameraIcon,
  DiningIcon,
  ShoppingBagIcon,
  TagIcon,
  StarIcon,
  CheckIcon,
  CalendarIcon,
  MapIcon,
  TrashIcon,
  EditIcon,
  ArrowUpRightIcon,
  MagnifyingGlassIcon,
  ClockIcon,
  XMarkIcon,
  RefreshIcon,
} from './Icons';

export type ExploreSection = 'DISCOVER' | 'PLANNER' | 'SAVED';

interface Props {
  trip: Trip;
  onUpdateTrip: (trip: Trip) => void;
  onShowToast: (text: string, tone?: 'info' | 'success' | 'error') => void;
  onOpenItineraryDate?: (date: string) => void;
  focusSectionSignal?: { section: ExploreSection; nonce: number } | null;
}

type AiFocusCategory = 'sightseeing' | 'food' | 'shopping';
type DisplaySavedCategory = 'sightseeing' | 'food' | 'shopping' | 'other';

interface AiExploreSuggestion {
  name: string;
  category: AiFocusCategory;
  area: string;
  note: string;
  estimatedCost: number;
}

const normalizeCategory = (cat?: SavedPlaceCategory | string): DisplaySavedCategory => {
  if (cat === 'cafe' || cat === 'food') return 'food';
  if (cat === 'sightseeing') return 'sightseeing';
  if (cat === 'shopping') return 'shopping';
  return 'other';
};

const QUICK_TIMES = ['09:30', '12:00', '14:30', '17:00', '19:30'];
const QUICK_DURATIONS = ['1h', '1.5h', '2h', '3h'];

const normalizeSpotKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/[\s・·\-—–_()（）[\]【】「」『』.,/]+/g, '')
    .trim();

const ExploreTool: React.FC<Props> = ({
  trip,
  onUpdateTrip,
  onShowToast,
  onOpenItineraryDate,
  focusSectionSignal,
}) => {
  const { lang, t } = useI18n();
  const { aiEnabled, setAiEnabled } = useAiAccess();
  const intel = useMemo(() => detectDestinationIntel(trip.destination, lang), [trip.destination, lang]);
  const savedPlaces = trip.savedPlaces || [];

  const [activeSection, setActiveSection] = useState<ExploreSection>(() =>
    focusSectionSignal?.section || 'DISCOVER'
  );

  useEffect(() => {
    if (focusSectionSignal?.section) {
      setActiveSection(focusSectionSignal.section);
    }
  }, [focusSectionSignal]);

  const categoryMeta = useMemo<
    Record<
      DisplaySavedCategory,
      {
        label: string;
        icon: React.ComponentType<{ className?: string }>;
        tintBg: string;
        textClass: string;
        activityType: Activity['type'];
      }
    >
  >(
    () => ({
      sightseeing: {
        label: t('風景景點', '风景景点', 'Scenic & Sights'),
        icon: CameraIcon,
        tintBg: 'bg-orange-500/12 dark:bg-orange-400/16',
        textClass: 'text-orange-600 dark:text-orange-300',
        activityType: 'sightseeing',
      },
      food: {
        label: t('美食甜點', '美食甜品', 'Food & Cafes'),
        icon: DiningIcon,
        tintBg: 'bg-rose-500/12 dark:bg-rose-400/16',
        textClass: 'text-rose-600 dark:text-rose-300',
        activityType: 'food',
      },
      shopping: {
        label: t('逛街購物', '逛街购物', 'Shopping'),
        icon: ShoppingBagIcon,
        tintBg: 'bg-fuchsia-500/12 dark:bg-fuchsia-400/16',
        textClass: 'text-fuchsia-600 dark:text-fuchsia-300',
        activityType: 'sightseeing',
      },
      other: {
        label: t('其他', '其他', 'Other'),
        icon: TagIcon,
        tintBg: 'bg-zinc-500/12 dark:bg-zinc-400/16',
        textClass: 'text-zinc-600 dark:text-zinc-300',
        activityType: 'sightseeing',
      },
    }),
    [t]
  );

  const tripDays = useMemo(() => {
    const span = getDaySpanUtc(trip.startDate, trip.endDate);
    const total = Math.max(1, Math.min(30, span?.days || 1));
    return Array.from({ length: total }, (_, idx) => {
      const iso = addDaysUtc(trip.startDate, idx);
      return {
        dayNum: idx + 1,
        iso,
        shortDate: iso.slice(5),
        count: (trip.activities?.[iso] || []).length,
      };
    });
  }, [trip.startDate, trip.endDate, trip.activities]);

  const tripDateList = useMemo(() => tripDays.map((d) => d.iso), [tripDays]);

  const resolvedScheduleMap = useMemo(() => {
    const map = new Map<string, { date: string; dayNum: number; time: string }>();
    const dayIndexLookup = new Map<string, number>(tripDays.map((d) => [d.iso, d.dayNum]));

    for (const place of savedPlaces) {
      if (place.scheduledDate && place.scheduledActivityId) {
        const list = trip.activities?.[place.scheduledDate] || [];
        const match = list.find((a) => a.id === place.scheduledActivityId);
        if (match) {
          map.set(place.id, {
            date: place.scheduledDate,
            dayNum: dayIndexLookup.get(place.scheduledDate) || 1,
            time: match.time || '09:00',
          });
          continue;
        }
      }
      const lowerName = place.name.trim().toLowerCase();
      for (const d of tripDays) {
        const list = trip.activities?.[d.iso] || [];
        const match = list.find((a) => a.title.trim().toLowerCase() === lowerName);
        if (match) {
          map.set(place.id, { date: d.iso, dayNum: d.dayNum, time: match.time || '09:00' });
          break;
        }
      }
    }
    return map;
  }, [savedPlaces, trip.activities, tripDays]);

  // Filters & Search (Saved Wishlist)
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNSCHEDULED' | 'SCHEDULED' | 'VISITED'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | DisplaySavedCategory>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Add / Edit Place Modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPlace, setEditingPlace] = useState<SavedPlace | null>(null);
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<DisplaySavedCategory>('sightseeing');
  const [formArea, setFormArea] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formMapUrl, setFormMapUrl] = useState('');
  const [formCost, setFormCost] = useState('');
  const [formMustGo, setFormMustGo] = useState(false);

  // Schedule Modal State
  const [schedulingPlace, setSchedulingPlace] = useState<SavedPlace | null>(null);
  const [scheduleDate, setScheduleDate] = useState(trip.startDate);
  const [scheduleTime, setScheduleTime] = useState('14:00');
  const [scheduleDuration, setScheduleDuration] = useState('1.5h');

  // Delete Confirm State
  const [deletingPlace, setDeletingPlace] = useState<SavedPlace | null>(null);

  // Route Preview Modal for Inline AI Planner
  const [plannerRouteStops, setPlannerRouteStops] = useState<Activity[]>([]);
  const [showPlannerRouteModal, setShowPlannerRouteModal] = useState(false);

  // Inline AI Spot Discovery State (strictly manual trigger + per-category cache + anti-duplicate history)
  const [aiFocusCategory, setAiFocusCategory] = useState<AiFocusCategory>('sightseeing');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuggestionsByCategory, setAiSuggestionsByCategory] = useState<
    Partial<Record<AiFocusCategory, { spots: AiExploreSuggestion[]; batchNum: number }>>
  >({});
  const seenAiNamesRef = useRef<Set<string>>(new Set());
  const seenAiKeysRef = useRef<Set<string>>(new Set());
  const aiBatchSeedRef = useRef<number>(0);

  const currentDiscovery = aiSuggestionsByCategory[aiFocusCategory];
  const aiSuggestions = currentDiscovery?.spots || [];
  const aiBatchNum = currentDiscovery?.batchNum || 0;

  useEffect(() => {
    seenAiNamesRef.current.clear();
    seenAiKeysRef.current.clear();
    aiBatchSeedRef.current = 0;
    setAiSuggestionsByCategory({});
    setAiError(null);
  }, [trip.id, trip.destination, lang]);

  const stats = useMemo(() => {
    let mustGo = 0;
    let scheduled = 0;
    let visited = 0;
    for (const p of savedPlaces) {
      if (p.mustGo) mustGo += 1;
      if (resolvedScheduleMap.has(p.id)) scheduled += 1;
      if (p.visited) visited += 1;
    }
    return { total: savedPlaces.length, mustGo, scheduled, visited };
  }, [savedPlaces, resolvedScheduleMap]);

  const filteredPlaces = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...savedPlaces]
      .filter((p) => {
        if (categoryFilter !== 'ALL' && normalizeCategory(p.category) !== categoryFilter) return false;
        const isScheduled = resolvedScheduleMap.has(p.id);
        if (statusFilter === 'UNSCHEDULED' && isScheduled) return false;
        if (statusFilter === 'SCHEDULED' && !isScheduled) return false;
        if (statusFilter === 'VISITED' && !p.visited) return false;
        if (q) {
          const hay = `${p.name} ${p.area || ''} ${p.note || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (Boolean(a.mustGo) !== Boolean(b.mustGo)) return a.mustGo ? -1 : 1;
        if (Boolean(a.visited) !== Boolean(b.visited)) return a.visited ? 1 : -1;
        return (b.updatedAt || 0) - (a.updatedAt || 0);
      });
  }, [savedPlaces, categoryFilter, statusFilter, searchQuery, resolvedScheduleMap]);

  const openAddModal = () => {
    setEditingPlace(null);
    setFormName('');
    setFormCategory('sightseeing');
    setFormArea('');
    setFormNote('');
    setFormMapUrl('');
    setFormCost('');
    setFormMustGo(false);
    setIsFormOpen(true);
  };

  const openEditModal = (place: SavedPlace) => {
    setEditingPlace(place);
    setFormName(place.name);
    setFormCategory(normalizeCategory(place.category));
    setFormArea(place.area || '');
    setFormNote(place.note || '');
    setFormMapUrl(place.mapUrl || '');
    setFormCost(place.estimatedCost ? String(place.estimatedCost) : '');
    setFormMustGo(Boolean(place.mustGo));
    setIsFormOpen(true);
  };

  const handleSavePlace = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formName.trim();
    if (!cleanName) {
      onShowToast(t('請輸入地點或餐廳名稱', '请输入地点或餐厅名称', 'Please enter a place or restaurant name'), 'error');
      return;
    }

    const now = Date.now();
    const parsedCost = Number(formCost);
    const cleanCost = !Number.isNaN(parsedCost) && parsedCost > 0 ? Math.round(parsedCost) : undefined;
    const cleanMapUrl = formMapUrl.trim() || undefined;

    if (editingPlace) {
      const updatedList = savedPlaces.map((item) =>
        item.id === editingPlace.id
          ? {
              ...item,
              name: cleanName,
              category: formCategory,
              area: formArea.trim() || undefined,
              note: formNote.trim() || undefined,
              mapUrl: cleanMapUrl,
              estimatedCost: cleanCost,
              mustGo: formMustGo,
              updatedAt: now,
            }
          : item
      );
      onUpdateTrip({ ...trip, savedPlaces: updatedList, updatedAt: now });
      onShowToast(t('已更新口袋地點', '已更新收藏地点', 'Saved place updated'), 'success');
    } else {
      const newPlace: SavedPlace = {
        id: generateUniqueId('place'),
        name: cleanName,
        category: formCategory,
        area: formArea.trim() || undefined,
        note: formNote.trim() || undefined,
        mapUrl: cleanMapUrl,
        estimatedCost: cleanCost,
        mustGo: formMustGo,
        visited: false,
        createdAt: new Date().toISOString(),
        updatedAt: now,
      };
      onUpdateTrip({ ...trip, savedPlaces: [newPlace, ...savedPlaces], updatedAt: now });
      onShowToast(t(`已收錄「${cleanName}」`, `已收藏“${cleanName}”`, `Saved "${cleanName}"`), 'success');
    }

    setIsFormOpen(false);
  };

  const toggleMustGo = (place: SavedPlace) => {
    const now = Date.now();
    const next = savedPlaces.map((p) =>
      p.id === place.id ? { ...p, mustGo: !p.mustGo, updatedAt: now } : p
    );
    onUpdateTrip({ ...trip, savedPlaces: next, updatedAt: now });
  };

  const toggleVisited = (place: SavedPlace) => {
    const now = Date.now();
    const next = savedPlaces.map((p) =>
      p.id === place.id ? { ...p, visited: !p.visited, updatedAt: now } : p
    );
    onUpdateTrip({ ...trip, savedPlaces: next, updatedAt: now });
    onShowToast(
      place.visited
        ? t('已取消造訪標記', '已取消打卡标记', 'Unmarked as visited')
        : t(`已打卡「${place.name}」`, `已打卡“${place.name}”`, `Checked in at "${place.name}"`),
      'info'
    );
  };

  const confirmDeletePlace = () => {
    if (!deletingPlace) return;
    const now = Date.now();
    const next = savedPlaces.filter((p) => p.id !== deletingPlace.id);
    const nextTombstones = { ...(trip.tombstones || {}), [deletingPlace.id]: now };
    onUpdateTrip({ ...trip, savedPlaces: next, tombstones: nextTombstones, updatedAt: now });
    onShowToast(
      t(`已移除「${deletingPlace.name}」`, `已移除“${deletingPlace.name}”`, `Removed "${deletingPlace.name}"`),
      'info'
    );
    setDeletingPlace(null);
  };

  const openScheduleModal = (place: SavedPlace) => {
    const existing = resolvedScheduleMap.get(place.id);
    setSchedulingPlace(place);
    setScheduleDate(existing?.date || tripDays[0]?.iso || trip.startDate);
    setScheduleTime(existing?.time || '14:00');
    setScheduleDuration('1.5h');
  };

  const handleConfirmSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedulingPlace || !scheduleDate) return;

    const now = Date.now();
    const normCat = normalizeCategory(schedulingPlace.category);
    const meta = categoryMeta[normCat] || categoryMeta.other;
    const newActId = generateUniqueId('act');
    const cleanTime = /^\d{1,2}:\d{2}$/.test(scheduleTime.trim())
      ? scheduleTime.trim().padStart(5, '0')
      : '14:00';

    const locationText = schedulingPlace.area
      ? `${schedulingPlace.name}, ${schedulingPlace.area} ${intel.displayCity}`
      : `${schedulingPlace.name}, ${intel.displayCity}`;

    const newActivity: Activity = {
      id: newActId,
      time: cleanTime,
      title: schedulingPlace.name,
      location: locationText,
      completed: Boolean(schedulingPlace.visited),
      type: meta.activityType,
      duration: scheduleDuration,
      description: schedulingPlace.note,
      updatedAt: now,
    };

    const prevDayList = trip.activities?.[scheduleDate] || [];
    const nextDayList = [...prevDayList, newActivity].sort((a, b) => a.time.localeCompare(b.time));

    const alreadyExistsInSaved = savedPlaces.some((p) => p.id === schedulingPlace.id);
    const updatedSchedulingPlace: SavedPlace = {
      ...schedulingPlace,
      scheduledDate: scheduleDate,
      scheduledActivityId: newActId,
      updatedAt: now,
    };

    const nextSavedPlaces = alreadyExistsInSaved
      ? savedPlaces.map((p) => (p.id === schedulingPlace.id ? updatedSchedulingPlace : p))
      : [updatedSchedulingPlace, ...savedPlaces];

    const dayIndex = tripDays.findIndex((d) => d.iso === scheduleDate);
    const dayLabel = dayIndex >= 0 ? formatDayBadge(dayIndex + 1, lang) : scheduleDate.slice(5);
    const formattedTime = formatTimeDisplay(cleanTime, lang);
    const timeLabel = formattedTime.suffix ? `${formattedTime.main} ${formattedTime.suffix}` : formattedTime.main;

    onUpdateTrip({
      ...trip,
      activities: {
        ...(trip.activities || {}),
        [scheduleDate]: nextDayList,
      },
      activitiesOrderUpdatedAt: {
        ...(trip.activitiesOrderUpdatedAt || {}),
        [scheduleDate]: now,
      },
      savedPlaces: nextSavedPlaces,
      updatedAt: now,
    });

    setSchedulingPlace(null);
    onShowToast(
      t(
        `已排入 ${dayLabel} (${timeLabel}) 行程時間軸`,
        `已排入 ${dayLabel} (${timeLabel}) 行程时间轴`,
        `Added to ${dayLabel} (${timeLabel}) timeline`
      ),
      'success'
    );
  };

  const handleResetAiHistory = () => {
    seenAiNamesRef.current.clear();
    seenAiKeysRef.current.clear();
    aiBatchSeedRef.current = 0;
    setAiSuggestionsByCategory({});
    setAiError(null);
    onShowToast(
      t('已清除已看過紀錄，需要時再點按開始探索', '已清除已看过记录，需要时再点击开始探索', 'Cleared discovery history'),
      'info'
    );
  };

  const handleFetchAiSpots = async (overrideCategory: AiFocusCategory = aiFocusCategory) => {
    if (!aiEnabled) {
      onShowToast(
        t('目前已在設定中停用 Gemini AI 功能', '目前已在设置中停用 Gemini AI 功能', 'Gemini AI is currently disabled in Settings'),
        'info'
      );
      return;
    }

    setAiLoading(true);
    setAiError(null);
    const nextBatch = aiBatchSeedRef.current + 1;
    aiBatchSeedRef.current = nextBatch;

    const excludeSet = new Set<string>([
      ...savedPlaces.map((p) => p.name.trim()),
      ...Array.from(seenAiNamesRef.current),
    ]);
    const excludeNames = Array.from(excludeSet).filter(Boolean).slice(-140);

    try {
      const res = await fetch('/api/ai/explore-spots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Waynote-Ai-Consent': '1',
        },
        body: JSON.stringify({
          destination: intel.displayCity || trip.destination,
          focusCategory: overrideCategory,
          excludeNames,
          batchSeed: nextBatch,
          lang,
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(
          t(
            '目前為純靜態託管環境，AI 探索推薦需透過完整後端伺服器執行。',
            '当前为纯静态托管环境，AI 探索推荐需通过完整后端服务器执行。',
            'Static hosting detected. AI Spot Discovery requires the full backend server.'
          )
        );
      }
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || t('無法取得推薦地點', '无法获取推荐地点', 'Unable to fetch spot recommendations'));
      }

      const rawSpots: AiExploreSuggestion[] = (Array.isArray(data.spots) ? data.spots : []).map(
        (s: { name: string; category?: string; area?: string; note?: string; estimatedCost?: number }) => {
          const cat: AiFocusCategory =
            s.category === 'food' || s.category === 'cafe'
              ? 'food'
              : s.category === 'shopping'
                ? 'shopping'
                : 'sightseeing';
          return {
            name: String(s.name || '').trim(),
            category: cat,
            area: String(s.area || '').trim(),
            note: String(s.note || '').trim(),
            estimatedCost: Number(s.estimatedCost) || 0,
          };
        }
      );

      const savedKeys = new Set(savedPlaces.map((p) => normalizeSpotKey(p.name)));
      const freshSpots = rawSpots.filter((s) => {
        const key = normalizeSpotKey(s.name);
        if (!key) return false;
        if (savedKeys.has(key) || seenAiKeysRef.current.has(key)) return false;
        return true;
      });

      const finalSpots = (freshSpots.length > 0 ? freshSpots : rawSpots).filter((s) => Boolean(s.name));
      finalSpots.forEach((s) => {
        seenAiNamesRef.current.add(s.name.trim());
        const key = normalizeSpotKey(s.name);
        if (key) seenAiKeysRef.current.add(key);
      });

      setAiSuggestionsByCategory((prev) => ({
        ...prev,
        [overrideCategory]: { spots: finalSpots, batchNum: nextBatch },
      }));
    } catch (err) {
      setAiError(
        err instanceof Error
          ? err.message
          : t('探索請求失敗，請稍後再試。', '探索请求失败，请稍后再试。', 'Discovery request failed. Please try again.')
      );
    } finally {
      setAiLoading(false);
    }
  };

  const handleCollectAiSpot = (spot: AiExploreSuggestion): SavedPlace | null => {
    const existing = savedPlaces.find(
      (p) => p.name.trim().toLowerCase() === spot.name.trim().toLowerCase()
    );
    if (existing) {
      return existing;
    }
    const now = Date.now();
    const newPlace: SavedPlace = {
      id: generateUniqueId('place'),
      name: spot.name,
      category: spot.category,
      area: spot.area,
      note: spot.note,
      estimatedCost: spot.estimatedCost > 0 ? spot.estimatedCost : undefined,
      mustGo: false,
      visited: false,
      createdAt: new Date().toISOString(),
      updatedAt: now,
    };
    onUpdateTrip({
      ...trip,
      savedPlaces: [newPlace, ...savedPlaces],
      updatedAt: now,
    });
    onShowToast(t(`已收錄「${spot.name}」`, `已收藏“${spot.name}”`, `Saved "${spot.name}"`), 'success');
    return newPlace;
  };

  const handleScheduleAiSpot = (spot: AiExploreSuggestion) => {
    const existing = savedPlaces.find(
      (p) => p.name.trim().toLowerCase() === spot.name.trim().toLowerCase()
    );
    if (existing) {
      openScheduleModal(existing);
      return;
    }
    const draftPlace: SavedPlace = {
      id: generateUniqueId('place'),
      name: spot.name,
      category: spot.category,
      area: spot.area,
      note: spot.note,
      estimatedCost: spot.estimatedCost > 0 ? spot.estimatedCost : undefined,
      mustGo: false,
      visited: false,
      createdAt: new Date().toISOString(),
      updatedAt: Date.now(),
    };
    openScheduleModal(draftPlace);
  };

  const handleApplyAiPlanFromExplore = ({
    startDate,
    applyStrategy,
    days,
  }: ApplyAiPlanOptions) => {
    const now = Date.now();
    const nextActivities = { ...trip.activities };
    const nextThemes = { ...(trip.themes || {}) };
    const nextThemesTs = { ...(trip.themesUpdatedAt || {}) };
    const nextOrderTs = { ...(trip.activitiesOrderUpdatedAt || {}) };
    const nextTombstones = { ...(trip.tombstones || {}) };

    let latestDate = trip.endDate;
    days.forEach((dayPlan, offsetIdx) => {
      const startMs = Date.parse(`${startDate}T00:00:00Z`);
      if (Number.isNaN(startMs)) return;
      const d = new Date(startMs);
      d.setUTCDate(d.getUTCDate() + offsetIdx);
      const targetIso = d.toISOString().slice(0, 10);
      if (targetIso > latestDate) latestDate = targetIso;

      const generated: Activity[] = dayPlan.stops.map((s) => ({
        id: generateUniqueId('act'),
        time: s.time,
        title: s.title,
        location: s.location,
        completed: false,
        type: s.type,
        duration: s.duration,
        description: s.description,
        updatedAt: now,
      }));

      const existing = nextActivities[targetIso] || [];
      if (applyStrategy === 'replace') {
        existing.forEach((old) => {
          nextTombstones[old.id] = now;
        });
        nextActivities[targetIso] = generated.sort((a, b) => a.time.localeCompare(b.time));
      } else {
        nextActivities[targetIso] = [...existing, ...generated].sort((a, b) => a.time.localeCompare(b.time));
      }

      if (dayPlan.theme) {
        nextThemes[targetIso] = dayPlan.theme;
        nextThemesTs[targetIso] = now;
      }
      nextOrderTs[targetIso] = now;
    });

    onUpdateTrip({
      ...trip,
      endDate: latestDate > trip.endDate ? latestDate : trip.endDate,
      activities: nextActivities,
      themes: nextThemes,
      themesUpdatedAt: nextThemesTs,
      activitiesOrderUpdatedAt: nextOrderTs,
      tombstones: nextTombstones,
      updatedAt: now,
    });

    onShowToast(
      days.length > 1
        ? t(`已套用 ${days.length} 天 AI 行程至旅程`, `已应用 ${days.length} 天 AI 行程至旅程`, `Applied ${days.length}-day AI itinerary`)
        : t(`已套用 AI 行程至 ${startDate.slice(5)}`, `已应用 AI 行程至 ${startDate.slice(5)}`, `Applied AI plan to ${startDate.slice(5)}`),
      'success'
    );
    onOpenItineraryDate?.(startDate);
  };

  const handleOpenPlannerRoutePreview = (stops: Activity[]) => {
    if (stops.length === 0) {
      onShowToast(t('此日 AI 規劃尚無可用地點', '此日 AI 规划暂无可用地点', 'No stops available in this AI day plan'), 'info');
      return;
    }
    setPlannerRouteStops(stops);
    setShowPlannerRouteModal(true);
  };

  const getGoogleMapsUrl = (place: { name: string; area?: string; mapUrl?: string }) => {
    if (place.mapUrl && /^https?:\/\//i.test(place.mapUrl)) return place.mapUrl;
    const query = [place.name, place.area, intel.displayCity].filter(Boolean).join(' ');
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  };

  return (
    <div className="h-full overflow-y-auto no-scrollbar px-4 sm:px-6 lg:px-8 pt-2 pb-10">
      <div className="max-w-2xl lg:max-w-5xl mx-auto space-y-4">
        {/* Unified Coral-Amber Explore & AI Planning Studio Header */}
        <div className="surface-elevated rounded-3xl p-4 sm:p-5 space-y-4 relative overflow-hidden">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#E11D48] via-[#F97316] to-[#F59E0B] opacity-85"
          />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 pt-0.5">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#E11D48] to-[#F97316] text-white flex items-center justify-center shrink-0 shadow-[0_8px_20px_-6px_rgba(225,29,72,0.45)]">
                <CompassIcon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-display font-bold text-zinc-900 dark:text-white truncate">
                  {t(`${intel.displayCity} 探索與 AI 規劃`, `${intel.displayCity} 探索与 AI 规划`, `${intel.displayCity} Explore & AI Studio`)}
                </h2>
                <div className="flex items-center flex-wrap gap-x-2.5 gap-y-0.5 text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 font-num">
                  <span>{t(`口袋 ${stats.total} 處`, `收藏 ${stats.total} 处`, `${stats.total} saved`)}</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">
                    {t(`必去 ${stats.mustGo}`, `必去 ${stats.mustGo}`, `${stats.mustGo} must-go`)}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    {t(`已排 ${stats.scheduled}`, `已排 ${stats.scheduled}`, `${stats.scheduled} planned`)}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{t(`已訪 ${stats.visited}`, `已访 ${stats.visited}`, `${stats.visited} visited`)}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={openAddModal}
              className="h-10 px-4 rounded-full bg-gradient-to-r from-[#E11D48] to-[#F97316] text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-[0_8px_18px_-6px_rgba(225,29,72,0.5)] active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <PlusIcon className="w-4 h-4" />
              <span>{t('新增地點', '添加地点', 'Add Spot')}</span>
            </button>
          </div>

          {/* Unified 3-Mode Studio Switcher */}
          <SlidingSegmentedControl
            fullWidth
            value={activeSection}
            onChange={(next) => setActiveSection(next)}
            options={[
              {
                id: 'DISCOVER',
                label: t('AI 探索推薦', 'AI 探索推荐', 'AI Discovery'),
                accentFrom: '#E11D48',
                accentTo: '#F97316',
              },
              {
                id: 'PLANNER',
                label: t('AI 行程規劃', 'AI 行程规划', 'AI Planner'),
                accentFrom: '#E11D48',
                accentTo: '#F97316',
              },
              {
                id: 'SAVED',
                label:
                  stats.total > 0
                    ? t(`口袋名單 (${stats.total})`, `收藏清单 (${stats.total})`, `Saved (${stats.total})`)
                    : t('口袋名單', '收藏清单', 'Saved Spots'),
                accentFrom: '#E11D48',
                accentTo: '#F97316',
              },
            ]}
          />

          {/* Section-Specific Filter Bar */}
          {activeSection === 'DISCOVER' && (
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-0.5">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {(
                  [
                    { id: 'sightseeing', label: categoryMeta.sightseeing.label },
                    { id: 'food', label: categoryMeta.food.label },
                    { id: 'shopping', label: categoryMeta.shopping.label },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setAiFocusCategory(tab.id);
                      setAiError(null);
                    }}
                    className={`h-9 px-3.5 rounded-full text-xs font-semibold shrink-0 cursor-pointer transition-all ${
                      aiFocusCategory === tab.id
                        ? 'bg-gradient-to-r from-[#E11D48] to-[#F97316] text-white shadow-sm'
                        : 'bg-zinc-100/90 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-white/10'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {(Object.keys(aiSuggestionsByCategory).length > 0 || seenAiNamesRef.current.size > 0) && (
                  <button
                    type="button"
                    onClick={handleResetAiHistory}
                    className="h-9 px-3 rounded-full bg-zinc-100/90 dark:bg-white/[0.08] text-zinc-600 dark:text-zinc-300 text-xs font-medium hover:text-zinc-900 dark:hover:text-white cursor-pointer whitespace-nowrap"
                  >
                    {t('重置紀錄', '重置记录', 'Reset')}
                  </button>
                )}
                <NeonOutlineButton
                  tone="rose"
                  size="sm"
                  disabled={aiLoading || !aiEnabled}
                  onClick={() => void handleFetchAiSpots(aiFocusCategory)}
                >
                  {aiSuggestions.length > 0 ? (
                    <RefreshIcon className={`w-3.5 h-3.5 ${aiLoading ? 'animate-spin' : ''}`} />
                  ) : (
                    <SparklesIcon className={`w-3.5 h-3.5 ${aiLoading ? 'animate-pulse' : ''}`} />
                  )}
                  <span>
                    {aiLoading
                      ? t('搜尋中...', '搜索中...', 'Searching...')
                      : aiSuggestions.length > 0
                        ? t('換一批', '换一批', 'Refresh')
                        : t('開始探索', '开始探索', 'Discover')}
                  </span>
                </NeonOutlineButton>
              </div>
            </div>
          )}

          {activeSection === 'SAVED' && (
            <div className="space-y-3 pt-0.5">
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <div className="relative flex-1 min-w-0">
                  <MagnifyingGlassIcon className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('搜尋收藏景點、餐廳、街區或筆記...', '搜索收藏景点、餐厅、街区或笔记...', 'Search spots, cafes, districts, or notes...')}
                    className="w-full h-10 pl-9 pr-8 rounded-2xl bg-zinc-100/80 dark:bg-white/[0.06] text-xs sm:text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-rose-500/25"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label={t('清除搜尋', '清除搜索', 'Clear search')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                    >
                      <XMarkIcon className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <SlidingSegmentedControl
                  size="sm"
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={[
                    { id: 'ALL', label: t('全部', '全部', 'All'), accentFrom: '#E11D48', accentTo: '#F97316' },
                    { id: 'UNSCHEDULED', label: t('待排入', '待排入', 'To Plan'), accentFrom: '#F59E0B', accentTo: '#FB923C' },
                    { id: 'SCHEDULED', label: t('已排入', '已排入', 'Planned'), accentFrom: '#10B981', accentTo: '#059669' },
                    { id: 'VISITED', label: t('已打卡', '已打卡', 'Visited'), accentFrom: '#7C3AED', accentTo: '#A855F7' },
                  ]}
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {(['ALL', 'sightseeing', 'food', 'shopping', 'other'] as const).map((cat) => {
                  const active = categoryFilter === cat;
                  const label = cat === 'ALL' ? t('全部分類', '全部分类', 'All Categories') : categoryMeta[cat].label;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      className={`h-8 px-3.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                        active
                          ? 'bg-gradient-to-r from-[#E11D48] to-[#F97316] text-white shadow-sm'
                          : 'bg-zinc-100/80 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-white/10'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ==================== VIEW 1: AI EXPLORE DISCOVERY (INLINE) ==================== */}
        <AnimatePresence mode="wait">
          {activeSection === 'DISCOVER' && (
            <motion.div
              key="DISCOVER"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
              className="space-y-3"
            >
              {aiBatchNum > 0 && !aiLoading && !aiError && (
                <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 px-1.5 font-num">
                  <span>{t(`第 ${aiBatchNum} 批推薦`, `第 ${aiBatchNum} 批推荐`, `Batch #${aiBatchNum}`)}</span>
                  <span>
                    {t(
                      `已排除 ${seenAiNamesRef.current.size} 處`,
                      `已排除 ${seenAiNamesRef.current.size} 处`,
                      `${seenAiNamesRef.current.size} excluded`
                    )}
                  </span>
                </div>
              )}

              {aiLoading && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="surface-elevated rounded-3xl p-5 space-y-3 animate-pulse">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-zinc-200/80 dark:bg-white/10" />
                        <div className="space-y-1.5 flex-1">
                          <div className="h-4 w-2/3 rounded-lg bg-zinc-200/80 dark:bg-white/10" />
                          <div className="h-3 w-1/3 rounded-lg bg-zinc-200/60 dark:bg-white/[0.06]" />
                        </div>
                      </div>
                      <div className="h-3 w-full rounded-lg bg-zinc-200/60 dark:bg-white/[0.06]" />
                      <div className="h-3 w-4/5 rounded-lg bg-zinc-200/60 dark:bg-white/[0.06]" />
                    </div>
                  ))}
                </div>
              )}

              {!aiLoading && aiError && (
                <div className="surface-elevated rounded-3xl p-6 sm:p-8 text-center space-y-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-red-500/12 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
                    <SparklesIcon className="w-6 h-6" />
                  </div>
                  <div className="space-y-1 max-w-md mx-auto">
                    <h3 className="text-sm sm:text-base font-display font-bold text-zinc-900 dark:text-white">
                      {t('無法載入 AI 探索推薦', '无法加载 AI 探索推荐', 'Unable to Load AI Discovery')}
                    </h3>
                    <p className="text-xs text-red-600 dark:text-red-300 leading-relaxed">
                      {aiError}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => void handleFetchAiSpots(aiFocusCategory)}
                      className="h-10 px-5 rounded-full bg-gradient-to-r from-[#E11D48] to-[#F97316] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <RefreshIcon className="w-3.5 h-3.5" />
                      <span>{t('重新嘗試', '重试', 'Try Again')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={openAddModal}
                      className="h-10 px-4 rounded-full bg-zinc-100 dark:bg-white/[0.08] text-zinc-800 dark:text-zinc-200 text-xs font-semibold cursor-pointer"
                    >
                      {t('手動新增口袋地點', '手动添加收藏地点', 'Add Spot Manually')}
                    </button>
                  </div>
                </div>
              )}

              {!aiLoading && !aiError && aiSuggestions.length === 0 && (
                <div className="surface-elevated rounded-3xl p-7 sm:p-9 text-center space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#E11D48]/15 to-[#F97316]/15 text-[#E11D48] dark:text-amber-300 flex items-center justify-center mx-auto">
                    <SparklesIcon className="w-6 h-6" />
                  </div>
                  <div className="space-y-1.5 max-w-md mx-auto">
                    <h3 className="text-base font-display font-bold text-zinc-900 dark:text-white">
                      {t(
                        `按需探索 ${intel.displayCity} 的${categoryMeta[aiFocusCategory].label}`,
                        `按需探索 ${intel.displayCity} 的${categoryMeta[aiFocusCategory].label}`,
                        `Discover ${categoryMeta[aiFocusCategory].label} in ${intel.displayCity}`
                      )}
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      {t(
                        '點擊下方按鈕即時探索約 10 個推薦地點',
                        '点击下方按钮实时探索约 10 个推荐地点',
                        'Tap below to discover ~10 curated spots on demand.'
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                    {aiEnabled ? (
                      <MovingBorderBeamButton
                        beamFrom="#E11D48"
                        beamTo="#F97316"
                        onClick={() => void handleFetchAiSpots(aiFocusCategory)}
                      >
                        <SparklesIcon className="w-4 h-4 text-[#E11D48] dark:text-orange-400" />
                        <span>
                          {t(
                            `開始 AI 探索「${categoryMeta[aiFocusCategory].label}」`,
                            `开始 AI 探索「${categoryMeta[aiFocusCategory].label}」`,
                            `Explore ${categoryMeta[aiFocusCategory].label} with AI`
                          )}
                        </span>
                      </MovingBorderBeamButton>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAiEnabled(true)}
                        className="min-h-[44px] px-5 rounded-full bg-zinc-900 dark:bg-white/15 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer hover:opacity-90 transition-opacity"
                      >
                        <SparklesIcon className="w-4 h-4" />
                        <span>{t('AI 已鎖定 — 點此暫時啟用', 'AI 已锁定 — 点此暂时启用', 'AI Locked — Tap to Enable')}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {!aiLoading && !aiError && aiSuggestions.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {aiSuggestions.map((spot) => {
                    const alreadySaved = savedPlaces.some(
                      (p) => p.name.trim().toLowerCase() === spot.name.trim().toLowerCase()
                    );
                    const meta = categoryMeta[spot.category] || categoryMeta.sightseeing;
                    const Icon = meta.icon;
                    return (
                      <div
                        key={spot.name}
                        className="surface-elevated rounded-3xl p-4 sm:p-5 flex flex-col justify-between gap-3.5"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-start gap-3">
                            <div
                              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${meta.tintBg} ${meta.textClass}`}
                            >
                              <Icon className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="font-display font-bold text-base text-zinc-900 dark:text-white leading-snug">
                                {spot.name}
                              </h3>
                              <div className="flex items-center flex-wrap gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                <span className={`font-semibold ${meta.textClass}`}>{meta.label}</span>
                                {spot.area && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span>{spot.area}</span>
                                  </>
                                )}
                                {spot.estimatedCost > 0 && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="font-num">
                                      {t('約 ', '约 ', '~')}
                                      {intel.currencySymbol}
                                      {spot.estimatedCost.toLocaleString()}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {spot.note && (
                            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed pl-[52px]">
                              {spot.note}
                            </p>
                          )}
                        </div>

                        <div className="pt-2.5 border-t border-zinc-200/70 dark:border-white/[0.08] flex items-center justify-between gap-2">
                          <a
                            href={getGoogleMapsUrl({ name: spot.name, area: spot.area })}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-8 px-3 rounded-full bg-zinc-100/90 dark:bg-white/[0.06] text-zinc-700 dark:text-zinc-200 text-xs font-medium inline-flex items-center gap-1 hover:bg-zinc-200/80 dark:hover:bg-white/10 transition-colors"
                          >
                            <MapIcon className="w-3.5 h-3.5" />
                            <span>{t('地圖', '地图', 'Map')}</span>
                            <ArrowUpRightIcon className="w-3 h-3 opacity-70" />
                          </a>

                          <div className="flex items-center gap-1.5">
                            <StampButton
                              size="sm"
                              stamped={alreadySaved}
                              disabled={alreadySaved}
                              onClick={() => handleCollectAiSpot(spot)}
                              idleLabel={t('+ 收錄', '+ 收藏', '+ Save')}
                              stampedLabel={t('已收錄', '已收藏', 'Saved')}
                              className="rounded-full shrink-0"
                            />
                            <button
                              type="button"
                              onClick={() => handleScheduleAiSpot(spot)}
                              className="h-8 px-3 rounded-full bg-zinc-900 dark:bg-white/14 text-white text-xs font-semibold inline-flex items-center gap-1 hover:opacity-90 active:scale-95 transition-all cursor-pointer shrink-0"
                            >
                              <CalendarIcon className="w-3.5 h-3.5" />
                              <span>{t('排入行程', '排入行程', 'Plan')}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* ==================== VIEW 2: AI ITINERARY & ROUTE PLANNER (MOVED INTO EXPLORE) ==================== */}
          {activeSection === 'PLANNER' && (
            <motion.div
              key="PLANNER"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
            >
              <AiPlannerWorkspace
                inline
                trip={trip}
                dates={tripDateList}
                selectedDate={tripDateList[0] || trip.startDate}
                onApplyPlan={handleApplyAiPlanFromExplore}
                onOpenRouteForStops={handleOpenPlannerRoutePreview}
              />
            </motion.div>
          )}

          {/* ==================== VIEW 3: SAVED SPOTS WISHLIST ==================== */}
          {activeSection === 'SAVED' && (
            <motion.div
              key="SAVED"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
            >
              {filteredPlaces.length === 0 ? (
                <div className="surface-elevated rounded-3xl p-8 sm:p-10 text-center space-y-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500/15 to-amber-500/15 text-rose-600 dark:text-rose-300 flex items-center justify-center mx-auto">
                    <CompassIcon className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-display font-bold text-zinc-900 dark:text-white">
                      {savedPlaces.length === 0
                        ? t('建立你的口袋景點名單', '创建你的心愿景点清单', 'Build Your Spot Wishlist')
                        : t('沒有符合條件的收藏地點', '没有符合条件的收藏地点', 'No matching saved spots')}
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
                      {t(
                        '把看到想去的餐廳、咖啡廳或伴手禮先收進來，決定好哪天要去時，一鍵直接排進每日行程時間軸。',
                        '把想去的餐厅、咖啡馆或手信好店先收藏起来，决定好日期后即可一键排入每日时间轴。',
                        'Save must-visit sights, cafes, and shops here, then drop them onto any itinerary day with a single tap.'
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveSection('DISCOVER')}
                      className="h-10 px-5 rounded-full bg-zinc-900 dark:bg-white/12 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <SparklesIcon className="w-3.5 h-3.5 text-amber-300" />
                      <span>{t(`讓 AI 推薦 ${intel.displayCity} 好去處`, `让 AI 推荐 ${intel.displayCity} 好去处`, `Explore ${intel.displayCity} with AI`)}</span>
                    </button>
                    <button
                      type="button"
                      onClick={openAddModal}
                      className="h-10 px-5 rounded-full bg-gradient-to-r from-[#E11D48] to-[#F97316] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <PlusIcon className="w-4 h-4" />
                      <span>{t('手動新增地點', '手动添加地点', 'Add Manually')}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <AnimatePresence initial={false}>
                    {filteredPlaces.map((place) => {
                      const meta = categoryMeta[normalizeCategory(place.category)] || categoryMeta.other;
                      const Icon = meta.icon;
                      const scheduled = resolvedScheduleMap.get(place.id);
                      const schedTimeObj = scheduled ? formatTimeDisplay(scheduled.time, lang) : null;
                      const schedTimeLabel = schedTimeObj
                        ? schedTimeObj.suffix
                          ? `${schedTimeObj.main} ${schedTimeObj.suffix}`
                          : schedTimeObj.main
                        : '';

                      return (
                        <motion.div
                          layout
                          key={place.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          className={`surface-elevated rounded-3xl p-4 sm:p-5 flex flex-col justify-between gap-3.5 transition-opacity ${
                            place.visited ? 'opacity-75' : ''
                          }`}
                        >
                          <div className="space-y-2.5">
                            <div className="flex items-start justify-between gap-2.5">
                              <div className="flex items-start gap-3 min-w-0">
                                <div
                                  className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${meta.tintBg} ${meta.textClass}`}
                                >
                                  <Icon className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                  <h3
                                    className={`font-display font-bold text-base text-zinc-900 dark:text-white leading-snug ${
                                      place.visited ? 'line-through' : ''
                                    }`}
                                  >
                                    {place.name}
                                  </h3>
                                  <div className="flex items-center flex-wrap gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                    <span className={`font-semibold ${meta.textClass}`}>{meta.label}</span>
                                    {place.area && (
                                      <>
                                        <span aria-hidden="true">·</span>
                                        <span>{place.area}</span>
                                      </>
                                    )}
                                    {place.estimatedCost !== undefined && place.estimatedCost > 0 && (
                                      <>
                                        <span aria-hidden="true">·</span>
                                        <span className="font-num">
                                          {t('約 ', '约 ', '~')}
                                          {intel.currencySymbol}
                                          {place.estimatedCost.toLocaleString()}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <BookmarkBurstButton
                                  size="sm"
                                  mode="bookmark"
                                  active={Boolean(place.mustGo)}
                                  onToggle={() => toggleMustGo(place)}
                                  ariaLabel={
                                    place.mustGo
                                      ? t('取消必去收藏', '取消必去收藏', 'Remove Must-Go')
                                      : t('收藏為必去', '收藏为必去', 'Save as Must-Go')
                                  }
                                />

                                <button
                                  type="button"
                                  onClick={() => {
                                    tactileAudio.playPop(place.visited ? 0.85 : 1.15);
                                    toggleVisited(place);
                                  }}
                                  aria-label={place.visited ? t('取消已造訪', '取消已访问', 'Unmark Visited') : t('標記已造訪', '标记已访问', 'Mark Visited')}
                                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90 cursor-pointer ${
                                    place.visited
                                      ? 'bg-emerald-500 text-white shadow-xs'
                                      : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/[0.06]'
                                  }`}
                                >
                                  <CheckIcon className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {place.note && (
                              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed pl-[52px]">
                                {place.note}
                              </p>
                            )}
                          </div>

                          <div className="pt-2.5 border-t border-zinc-200/70 dark:border-white/[0.08] flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <a
                                href={getGoogleMapsUrl(place)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="h-8 px-3 rounded-full bg-zinc-100/90 dark:bg-white/[0.06] text-zinc-700 dark:text-zinc-200 text-xs font-medium inline-flex items-center gap-1 hover:bg-zinc-200/80 dark:hover:bg-white/10 transition-colors"
                              >
                                <MapIcon className="w-3.5 h-3.5" />
                                <span>{t('地圖', '地图', 'Map')}</span>
                                <ArrowUpRightIcon className="w-3 h-3 opacity-70" />
                              </a>

                              <button
                                type="button"
                                onClick={() => openEditModal(place)}
                                aria-label={t('編輯', '编辑', 'Edit')}
                                className="w-8 h-8 rounded-full text-zinc-400 hover:text-zinc-800 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06] flex items-center justify-center cursor-pointer transition-colors"
                              >
                                <EditIcon className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => setDeletingPlace(place)}
                                aria-label={t('刪除', '删除', 'Delete')}
                                className="w-8 h-8 rounded-full text-zinc-400 hover:text-red-500 hover:bg-red-500/10 flex items-center justify-center cursor-pointer transition-colors"
                              >
                                <TrashIcon className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {scheduled ? (
                              <div className="flex items-center gap-1.5">
                                {onOpenItineraryDate ? (
                                  <button
                                    type="button"
                                    onClick={() => onOpenItineraryDate(scheduled.date)}
                                    className="h-8 px-3 rounded-full bg-emerald-500/14 text-emerald-700 dark:text-emerald-300 text-xs font-num font-semibold flex items-center gap-1 cursor-pointer hover:bg-emerald-500/22 transition-colors whitespace-nowrap"
                                  >
                                    <CalendarIcon className="w-3.5 h-3.5" />
                                    <span>{formatDayBadge(scheduled.dayNum, lang)} · {schedTimeLabel}</span>
                                  </button>
                                ) : (
                                  <span className="text-xs font-num font-semibold text-emerald-600 dark:text-emerald-300">
                                    {t(`已排入 ${formatDayBadge(scheduled.dayNum, lang)}`, `已排入 ${formatDayBadge(scheduled.dayNum, lang)}`, `Planned · ${formatDayBadge(scheduled.dayNum, lang)}`)}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => openScheduleModal(place)}
                                  className="h-8 px-2.5 rounded-full text-[11px] font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white cursor-pointer"
                                >
                                  {t('改期', '改期', 'Reschedule')}
                                </button>
                              </div>
                            ) : (
                              <StampButton
                                size="sm"
                                onClick={() => openScheduleModal(place)}
                                idleLabel={t('排入行程', '排入行程', 'Schedule')}
                                stampedLabel={t('排入行程', '排入行程', 'Schedule')}
                                idleIcon={<CalendarIcon className="w-3.5 h-3.5" />}
                                className="rounded-full"
                              />
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Add / Edit Place Modal */}
      <LiquidModal
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={
          editingPlace
            ? t('編輯口袋地點', '编辑收藏地点', 'Edit Saved Spot')
            : t('新增口袋地點', '添加收藏地点', 'Add Saved Spot')
        }
        maxWidthClass="max-w-md"
        bottomSheetOnMobile
      >
        <form onSubmit={handleSavePlace} className="space-y-4 overflow-y-auto no-scrollbar max-h-[70dvh] pr-0.5">
          <div>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1.5 block">
              {t('地點 / 餐廳名稱 *', '地点 / 餐厅名称 *', 'Place or Restaurant Name *')}
            </label>
            <input
              type="text"
              required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder={t('例如：澀谷 SKY、今半壽喜燒...', '例如：涩谷 SKY、今半寿喜烧...', 'e.g. Shibuya SKY, Blue Bottle...')}
              className="w-full min-h-[44px] px-4 rounded-2xl bg-zinc-100 dark:bg-white/[0.06] border border-zinc-200/70 dark:border-white/10 text-sm font-semibold text-zinc-900 dark:text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1.5 block">
              {t('分類', '分类', 'Category')}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {(['sightseeing', 'food', 'shopping', 'other'] as DisplaySavedCategory[]).map((cat) => {
                const active = formCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFormCategory(cat)}
                    className={`h-9 px-3.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                      active
                        ? 'bg-gradient-to-r from-[#E11D48] to-[#F97316] text-white'
                        : 'bg-zinc-100 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-300'
                    }`}
                  >
                    {categoryMeta[cat].label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1.5 block">
                {t('所在區域（選填）', '所在区域（选填）', 'Neighborhood (optional)')}
              </label>
              <input
                type="text"
                value={formArea}
                onChange={(e) => setFormArea(e.target.value)}
                placeholder={t('例如：表參道、銀座', '例如：表参道、银座', 'e.g. Omotesando, Ginza')}
                className="w-full min-h-[42px] px-3.5 rounded-2xl bg-zinc-100 dark:bg-white/[0.06] border border-zinc-200/70 dark:border-white/10 text-xs sm:text-sm text-zinc-900 dark:text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1.5 block">
                {t(`預估花費 (${intel.currency})`, `预估花费 (${intel.currency})`, `Est. Cost (${intel.currency})`)}
              </label>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={formCost}
                onChange={(e) => setFormCost(e.target.value)}
                placeholder="0"
                className="w-full min-h-[42px] px-3.5 rounded-2xl bg-zinc-100 dark:bg-white/[0.06] border border-zinc-200/70 dark:border-white/10 text-xs sm:text-sm font-num text-zinc-900 dark:text-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1.5 block">
              {t('亮點筆記 / 營業時間 / 必買必點', '亮点笔记 / 营业时间 / 必买必点', 'Highlights / Hours / Notes')}
            </label>
            <textarea
              rows={2}
              value={formNote}
              onChange={(e) => setFormNote(e.target.value)}
              placeholder={t('例如：預約日落時段、週二公休、推薦招牌套餐', '例如：预约日落时段、周二休息、推荐招牌套餐', 'e.g. Book sunset slot, closed Tuesdays, signature dish')}
              className="w-full p-3.5 rounded-2xl bg-zinc-100 dark:bg-white/[0.06] border border-zinc-200/70 dark:border-white/10 text-xs sm:text-sm text-zinc-900 dark:text-white focus:outline-none resize-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1.5 block">
              {t('地圖 / 參考連結（選填）', '地图 / 参考链接（选填）', 'Map / Reference URL (optional)')}
            </label>
            <input
              type="url"
              value={formMapUrl}
              onChange={(e) => setFormMapUrl(e.target.value)}
              placeholder={t('留空則自動以名稱搜尋 Google Maps', '留空则自动以名称搜索 Google Maps', 'Leave blank to auto-search Google Maps')}
              className="w-full min-h-[42px] px-3.5 rounded-2xl bg-zinc-100 dark:bg-white/[0.06] border border-zinc-200/70 dark:border-white/10 text-xs text-zinc-900 dark:text-white focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => setFormMustGo(!formMustGo)}
            className="w-full min-h-[44px] px-4 rounded-2xl bg-zinc-100/80 dark:bg-white/[0.05] flex items-center justify-between cursor-pointer"
          >
            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
              <StarIcon className="w-4 h-4 text-amber-500" filled={formMustGo} />
              <span>{t('標記為本次「必去清單」優先置頂', '标记为本次“必去清单”优先置顶', 'Pin as "Must-Go" Priority')}</span>
            </span>
            <span className={`text-xs font-bold ${formMustGo ? 'text-amber-500' : 'text-zinc-400'}`}>
              {formMustGo ? t('已開啟', '已开启', 'On') : t('關閉', '关闭', 'Off')}
            </span>
          </button>

          <button
            type="submit"
            className="w-full min-h-[48px] rounded-full bg-gradient-to-r from-[#E11D48] to-[#F97316] text-white font-semibold text-sm cursor-pointer active:scale-[0.985] transition-all shadow-sm"
          >
            {editingPlace ? t('儲存變更', '保存更改', 'Save Changes') : t('收錄至口袋名單', '添加到收藏清单', 'Save Spot')}
          </button>
        </form>
      </LiquidModal>

      {/* One-Tap Schedule to Itinerary Modal */}
      <LiquidModal
        open={Boolean(schedulingPlace)}
        onClose={() => setSchedulingPlace(null)}
        title={t('排入行程時間軸', '排入行程时间轴', 'Add to Itinerary')}
        maxWidthClass="max-w-md"
        bottomSheetOnMobile
      >
        {schedulingPlace && (
          <form onSubmit={handleConfirmSchedule} className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-zinc-100/80 dark:bg-white/[0.05] space-y-1">
              <div className="text-sm font-display font-bold text-zinc-900 dark:text-white">
                {schedulingPlace.name}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                {categoryMeta[normalizeCategory(schedulingPlace.category)].label}
                {schedulingPlace.area ? ` · ${schedulingPlace.area}` : ''}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-2 block">
                {t('選擇排入哪一天', '选择排入哪一天', 'Select Day')}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto no-scrollbar pr-0.5">
                {tripDays.map((d) => {
                  const active = scheduleDate === d.iso;
                  return (
                    <button
                      key={d.iso}
                      type="button"
                      onClick={() => setScheduleDate(d.iso)}
                      className={`p-2.5 rounded-2xl text-left border transition-all cursor-pointer ${
                        active
                          ? 'bg-gradient-to-r from-[#E11D48] to-[#F97316] text-white border-transparent shadow-sm'
                          : 'bg-zinc-100/80 dark:bg-white/[0.05] text-zinc-800 dark:text-zinc-200 border-transparent hover:border-zinc-300 dark:hover:border-white/15'
                      }`}
                    >
                      <div className="font-num font-bold text-xs">{formatDayBadge(d.dayNum, lang)}</div>
                      <div className={`text-[11px] font-num ${active ? 'text-white/85' : 'text-zinc-500 dark:text-zinc-400'}`}>
                        {d.shortDate} · {formatStopsCount(d.count, lang)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1.5 flex items-center gap-1">
                  <ClockIcon className="w-3.5 h-3.5" />
                  <span>{t('出發時間', '出发时间', 'Start Time')}</span>
                </label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-2xl bg-zinc-100 dark:bg-white/[0.06] font-num font-semibold text-sm text-zinc-900 dark:text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1.5 block">
                  {t('停留時間', '停留时间', 'Duration')}
                </label>
                <div className="flex items-center gap-1.5 h-[42px]">
                  {QUICK_DURATIONS.map((dur) => (
                    <button
                      key={dur}
                      type="button"
                      onClick={() => setScheduleDuration(dur)}
                      className={`flex-1 h-10 rounded-xl text-xs font-num font-semibold cursor-pointer transition-colors ${
                        scheduleDuration === dur
                          ? 'bg-gradient-to-r from-[#E11D48] to-[#F97316] text-white'
                          : 'bg-zinc-100 dark:bg-white/[0.06] text-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      {formatDurationLabel(dur, lang)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {QUICK_TIMES.map((qt) => {
                const qtDisp = formatTimeDisplay(qt, lang);
                return (
                  <button
                    key={qt}
                    type="button"
                    onClick={() => setScheduleTime(qt)}
                    className={`h-8 px-3 rounded-full text-xs font-num font-semibold shrink-0 cursor-pointer transition-colors ${
                      scheduleTime === qt
                        ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                        : 'bg-zinc-100 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-300'
                    }`}
                  >
                    {qtDisp.suffix ? `${qtDisp.main} ${qtDisp.suffix}` : qtDisp.main}
                  </button>
                );
              })}
            </div>

            <button
              type="submit"
              className="w-full min-h-[48px] rounded-full bg-gradient-to-r from-[#E11D48] to-[#F97316] text-white font-semibold text-sm cursor-pointer active:scale-[0.985] transition-all"
            >
              {t('確認加入行程時間軸', '确认加入行程时间轴', 'Add to Timeline')}
            </button>
          </form>
        )}
      </LiquidModal>

      {/* Interactive Route Preview Modal for AI Planner */}
      <RouteMapModal
        open={showPlannerRouteModal}
        onClose={() => setShowPlannerRouteModal(false)}
        stops={plannerRouteStops}
        destinationCity={intel.displayCity}
        hotels={trip.hotels || []}
        airports={intel.airports}
        onReorderStops={setPlannerRouteStops}
      />

      <ConfirmSheet
        open={Boolean(deletingPlace)}
        onClose={() => setDeletingPlace(null)}
        onConfirm={confirmDeletePlace}
        title={t('移除此口袋地點？', '移除此收藏地点？', 'Remove Saved Spot?')}
        description={t(
          `確定要從口袋名單移除「${deletingPlace?.name || ''}」嗎？（若已排入時間軸，行程內的項目仍會保留）`,
          `确定要从收藏清单移除“${deletingPlace?.name || ''}”吗？（若已排入时间轴，行程内的项目仍会保留）`,
          `Remove "${deletingPlace?.name || ''}" from saved spots? Any items already added to your timeline will remain.`
        )}
        confirmLabel={t('確認移除', '确认移除', 'Remove')}
        cancelLabel={t('取消', '取消', 'Cancel')}
        tone="danger"
        icon={<TrashIcon className="w-6 h-6" />}
        requireHold
      />
    </div>
  );
};

export default ExploreTool;
