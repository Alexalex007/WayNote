import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trip, SavedPlace, SavedPlaceCategory, Activity } from '../types';
import { generateUniqueId } from '../shared/syncMerge';
import { detectDestinationIntel } from '../shared/destinationIntel';
import { getDaySpanUtc, addDaysUtc } from './DateRangeCalendar';
import { LiquidModal, ConfirmSheet, SlidingSegmentedControl } from './LiquidPrimitives';
import {
  CompassIcon,
  PlusIcon,
  SparklesIcon,
  CameraIcon,
  DiningIcon,
  CoffeeIcon,
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
} from './Icons';

interface Props {
  trip: Trip;
  onUpdateTrip: (trip: Trip) => void;
  onShowToast: (text: string, tone?: 'info' | 'success' | 'error') => void;
  onOpenItineraryDate?: (date: string) => void;
}

interface AiExploreSuggestion {
  name: string;
  category: 'sightseeing' | 'food' | 'cafe' | 'shopping';
  area: string;
  note: string;
  estimatedCost: number;
}

const CATEGORY_META: Record<
  SavedPlaceCategory,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    tintBg: string;
    textClass: string;
    activityType: Activity['type'];
  }
> = {
  sightseeing: {
    label: '景點',
    icon: CameraIcon,
    tintBg: 'bg-sky-500/12 dark:bg-sky-400/16',
    textClass: 'text-sky-600 dark:text-sky-300',
    activityType: 'sightseeing',
  },
  food: {
    label: '美食',
    icon: DiningIcon,
    tintBg: 'bg-rose-500/12 dark:bg-rose-400/16',
    textClass: 'text-rose-600 dark:text-rose-300',
    activityType: 'food',
  },
  cafe: {
    label: '咖啡甜點',
    icon: CoffeeIcon,
    tintBg: 'bg-amber-500/12 dark:bg-amber-400/16',
    textClass: 'text-amber-600 dark:text-amber-300',
    activityType: 'food',
  },
  shopping: {
    label: '逛街伴手',
    icon: ShoppingBagIcon,
    tintBg: 'bg-emerald-500/12 dark:bg-emerald-400/16',
    textClass: 'text-emerald-600 dark:text-emerald-300',
    activityType: 'sightseeing',
  },
  other: {
    label: '其他',
    icon: TagIcon,
    tintBg: 'bg-indigo-500/12 dark:bg-indigo-400/16',
    textClass: 'text-indigo-600 dark:text-indigo-300',
    activityType: 'sightseeing',
  },
};

const QUICK_TIMES = ['09:30', '12:00', '14:30', '17:00', '19:30'];
const QUICK_DURATIONS = ['1h', '1.5h', '2h', '3h'];

const ExploreTool: React.FC<Props> = ({ trip, onUpdateTrip, onShowToast, onOpenItineraryDate }) => {
  const intel = useMemo(() => detectDestinationIntel(trip.destination), [trip.destination]);
  const savedPlaces = trip.savedPlaces || [];

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

  // Verify live scheduled link against actual trip.activities so stale badges never appear
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
      // Also match by exact title in case user added/edited directly on timeline
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

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNSCHEDULED' | 'SCHEDULED' | 'VISITED'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | SavedPlaceCategory>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Add / Edit Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPlace, setEditingPlace] = useState<SavedPlace | null>(null);
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<SavedPlaceCategory>('sightseeing');
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

  // AI Spot Discovery Modal State
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiFocusCategory, setAiFocusCategory] = useState<'all' | 'sightseeing' | 'food' | 'cafe' | 'shopping'>('all');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<AiExploreSuggestion[]>([]);

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
        if (categoryFilter !== 'ALL' && p.category !== categoryFilter) return false;
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
    setFormCategory(place.category);
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
      onShowToast('請輸入地點或餐廳名稱', 'error');
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
      onShowToast('已更新口袋地點', 'success');
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
      onShowToast(`已收錄「${cleanName}」`, 'success');
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
    onShowToast(place.visited ? '已取消造訪標記' : `已打卡「${place.name}」`, 'info');
  };

  const confirmDeletePlace = () => {
    if (!deletingPlace) return;
    const now = Date.now();
    const next = savedPlaces.filter((p) => p.id !== deletingPlace.id);
    const nextTombstones = { ...(trip.tombstones || {}), [deletingPlace.id]: now };
    onUpdateTrip({ ...trip, savedPlaces: next, tombstones: nextTombstones, updatedAt: now });
    onShowToast(`已移除「${deletingPlace.name}」`, 'info');
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
    const meta = CATEGORY_META[schedulingPlace.category] || CATEGORY_META.other;
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

    const nextSavedPlaces = savedPlaces.map((p) =>
      p.id === schedulingPlace.id
        ? {
            ...p,
            scheduledDate: scheduleDate,
            scheduledActivityId: newActId,
            updatedAt: now,
          }
        : p
    );

    const dayIndex = tripDays.findIndex((d) => d.iso === scheduleDate);
    const dayLabel = dayIndex >= 0 ? `Day ${dayIndex + 1}` : scheduleDate.slice(5);

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
    onShowToast(`已排入 ${dayLabel} (${cleanTime}) 行程時間軸`, 'success');
  };

  const handleFetchAiSpots = async (overrideCategory = aiFocusCategory) => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch('/api/ai/explore-spots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination: trip.destination,
          focusCategory: overrideCategory,
          excludeNames: savedPlaces.map((p) => p.name),
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('目前為純靜態託管環境，AI 探索推薦需透過完整後端伺服器執行。');
      }
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '無法取得推薦地點');
      }
      setAiSuggestions(Array.isArray(data.spots) ? data.spots : []);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : '探索請求失敗，請稍後再試。');
    } finally {
      setAiLoading(false);
    }
  };

  const handleOpenAiModal = () => {
    setIsAiModalOpen(true);
    if (aiSuggestions.length === 0 && !aiLoading) {
      void handleFetchAiSpots(aiFocusCategory);
    }
  };

  const handleCollectAiSpot = (spot: AiExploreSuggestion) => {
    const exists = savedPlaces.some(
      (p) => p.name.trim().toLowerCase() === spot.name.trim().toLowerCase()
    );
    if (exists) {
      onShowToast(`「${spot.name}」已在口袋名單中`, 'info');
      return;
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
    onShowToast(`已收錄「${spot.name}」`, 'success');
  };

  const getGoogleMapsUrl = (place: SavedPlace) => {
    if (place.mapUrl && /^https?:\/\//i.test(place.mapUrl)) return place.mapUrl;
    const query = [place.name, place.area, intel.displayCity].filter(Boolean).join(' ');
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  };

  return (
    <div className="h-full overflow-y-auto no-scrollbar px-4 sm:px-6 lg:px-8 pt-2 pb-10">
      <div className="max-w-2xl lg:max-w-5xl mx-auto space-y-4">
        {/* Top Summary & Actions Card */}
        <div className="surface-elevated rounded-3xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <CompassIcon className="w-4 h-4 text-[var(--tab-accent)] shrink-0" />
                <span className="text-xs font-semibold text-[var(--tab-accent)]">
                  {intel.displayCity} 口袋景點庫
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-num">
                <span>共 {stats.total} 處</span>
                <span aria-hidden="true">·</span>
                <span>必去 {stats.mustGo}</span>
                <span aria-hidden="true">·</span>
                <span>已排入 {stats.scheduled}</span>
                <span aria-hidden="true">·</span>
                <span>已造訪 {stats.visited}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleOpenAiModal}
                className="h-10 px-4 rounded-full bg-zinc-900 dark:bg-white/10 text-white text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                <SparklesIcon className="w-3.5 h-3.5 text-sky-300" />
                <span>AI 探索推薦</span>
              </button>
              <button
                type="button"
                onClick={openAddModal}
                className="h-10 px-4 rounded-full bg-gradient-to-r from-[#0EA5E9] to-[#2563EB] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                <PlusIcon className="w-4 h-4" />
                <span>新增地點</span>
              </button>
            </div>
          </div>

          {/* Search & Status Filter */}
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="relative flex-1 min-w-0">
              <MagnifyingGlassIcon className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜尋收藏景點、餐廳或區域..."
                className="w-full h-10 pl-9 pr-8 rounded-2xl bg-zinc-100/80 dark:bg-white/[0.06] text-xs sm:text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="清除搜尋"
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
                { id: 'ALL', label: '全部', accentFrom: '#0EA5E9', accentTo: '#2563EB' },
                { id: 'UNSCHEDULED', label: '待排入', accentFrom: '#F59E0B', accentTo: '#F97316' },
                { id: 'SCHEDULED', label: '已排入', accentFrom: '#10B981', accentTo: '#059669' },
                { id: 'VISITED', label: '已打卡', accentFrom: '#6366F1', accentTo: '#8B5CF6' },
              ]}
            />
          </div>

          {/* Category Strip */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
            {(['ALL', 'sightseeing', 'food', 'cafe', 'shopping', 'other'] as const).map((cat) => {
              const active = categoryFilter === cat;
              const label = cat === 'ALL' ? '全部分類' : CATEGORY_META[cat].label;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`h-8 px-3.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-[var(--tab-accent)] text-white shadow-sm'
                      : 'bg-zinc-100/80 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-white/10'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Saved Places Grid */}
        {filteredPlaces.length === 0 ? (
          <div className="surface-elevated rounded-3xl p-8 sm:p-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/12 text-sky-600 dark:text-sky-300 flex items-center justify-center mx-auto">
              <CompassIcon className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-display font-bold text-zinc-900 dark:text-white">
                {savedPlaces.length === 0 ? '建立你的口袋景點名單' : '沒有符合條件的收藏地點'}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
                把看到想去的餐廳、咖啡廳或伴手禮先收進來，決定好那天要去時，一鍵直接排進每日行程時間軸。
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleOpenAiModal}
                className="h-10 px-5 rounded-full bg-zinc-900 dark:bg-white/10 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <SparklesIcon className="w-3.5 h-3.5 text-sky-300" />
                <span>讓 AI 推薦 {intel.displayCity} 好去處</span>
              </button>
              <button
                type="button"
                onClick={openAddModal}
                className="h-10 px-5 rounded-full bg-gradient-to-r from-[#0EA5E9] to-[#2563EB] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <PlusIcon className="w-4 h-4" />
                <span>手動新增地點</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <AnimatePresence initial={false}>
              {filteredPlaces.map((place) => {
                const meta = CATEGORY_META[place.category] || CATEGORY_META.other;
                const Icon = meta.icon;
                const scheduled = resolvedScheduleMap.get(place.id);

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
                                    約 {intel.currencySymbol}
                                    {place.estimatedCost.toLocaleString()}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => toggleMustGo(place)}
                            aria-label={place.mustGo ? '取消必去星標' : '標記為必去'}
                            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                              place.mustGo
                                ? 'bg-amber-500/15 text-amber-500'
                                : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/[0.06]'
                            }`}
                          >
                            <StarIcon className="w-4 h-4" filled={Boolean(place.mustGo)} />
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleVisited(place)}
                            aria-label={place.visited ? '取消已造訪' : '標記已造訪'}
                            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                              place.visited
                                ? 'bg-emerald-500 text-white'
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
                          <span>地圖</span>
                          <ArrowUpRightIcon className="w-3 h-3 opacity-70" />
                        </a>

                        <button
                          type="button"
                          onClick={() => openEditModal(place)}
                          aria-label="編輯"
                          className="w-8 h-8 rounded-full text-zinc-400 hover:text-zinc-800 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06] flex items-center justify-center cursor-pointer transition-colors"
                        >
                          <EditIcon className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeletingPlace(place)}
                          aria-label="刪除"
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
                              <span>Day {scheduled.dayNum} · {scheduled.time}</span>
                            </button>
                          ) : (
                            <span className="text-xs font-num font-semibold text-emerald-600 dark:text-emerald-300">
                              已排入 Day {scheduled.dayNum}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => openScheduleModal(place)}
                            className="h-8 px-2.5 rounded-full text-[11px] font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white cursor-pointer"
                          >
                            改期
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openScheduleModal(place)}
                          className="h-8 px-3.5 rounded-full bg-gradient-to-r from-[#0EA5E9] to-[#2563EB] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
                        >
                          <CalendarIcon className="w-3.5 h-3.5" />
                          <span>排入行程</span>
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Add / Edit Place Modal */}
      <LiquidModal
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingPlace ? '編輯口袋地點' : '新增口袋地點'}
        maxWidthClass="max-w-md"
        bottomSheetOnMobile
      >
        <form onSubmit={handleSavePlace} className="space-y-4 overflow-y-auto no-scrollbar max-h-[70dvh] pr-0.5">
          <div>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1.5 block">
              地點 / 餐廳名稱 *
            </label>
            <input
              type="text"
              required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder={`例如：澀谷 SKY、今半壽喜燒...`}
              className="w-full min-h-[44px] px-4 rounded-2xl bg-zinc-100 dark:bg-white/[0.06] border border-zinc-200/70 dark:border-white/10 text-sm font-semibold text-zinc-900 dark:text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1.5 block">
              分類
            </label>
            <div className="flex flex-wrap gap-1.5">
              {(['sightseeing', 'food', 'cafe', 'shopping', 'other'] as SavedPlaceCategory[]).map((cat) => {
                const active = formCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFormCategory(cat)}
                    className={`h-9 px-3.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                      active
                        ? 'bg-[var(--tab-accent)] text-white'
                        : 'bg-zinc-100 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-300'
                    }`}
                  >
                    {CATEGORY_META[cat].label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1.5 block">
                所在區域（選填）
              </label>
              <input
                type="text"
                value={formArea}
                onChange={(e) => setFormArea(e.target.value)}
                placeholder="例如：表參道、銀座"
                className="w-full min-h-[42px] px-3.5 rounded-2xl bg-zinc-100 dark:bg-white/[0.06] border border-zinc-200/70 dark:border-white/10 text-xs sm:text-sm text-zinc-900 dark:text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1.5 block">
                預估花費 ({intel.currency})
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
              亮點筆記 / 營業時間 / 必買必點
            </label>
            <textarea
              rows={2}
              value={formNote}
              onChange={(e) => setFormNote(e.target.value)}
              placeholder="例如：預約日落時段、週二公休、推薦黑毛和牛套餐"
              className="w-full p-3.5 rounded-2xl bg-zinc-100 dark:bg-white/[0.06] border border-zinc-200/70 dark:border-white/10 text-xs sm:text-sm text-zinc-900 dark:text-white focus:outline-none resize-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1.5 block">
              地圖 / 參考連結（選填）
            </label>
            <input
              type="url"
              value={formMapUrl}
              onChange={(e) => setFormMapUrl(e.target.value)}
              placeholder="留空則自動以名稱搜尋 Google Maps"
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
              <span>標記為本次「必去清單」優先置頂</span>
            </span>
            <span className={`text-xs font-bold ${formMustGo ? 'text-amber-500' : 'text-zinc-400'}`}>
              {formMustGo ? '已開啟' : '關閉'}
            </span>
          </button>

          <button
            type="submit"
            className="w-full min-h-[48px] rounded-full bg-gradient-to-r from-[#0EA5E9] to-[#2563EB] text-white font-semibold text-sm cursor-pointer active:scale-[0.985] transition-all"
          >
            {editingPlace ? '儲存變更' : '收錄至口袋名單'}
          </button>
        </form>
      </LiquidModal>

      {/* One-Tap Schedule to Itinerary Modal */}
      <LiquidModal
        open={Boolean(schedulingPlace)}
        onClose={() => setSchedulingPlace(null)}
        title="排入行程時間軸"
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
                {CATEGORY_META[schedulingPlace.category].label}
                {schedulingPlace.area ? ` · ${schedulingPlace.area}` : ''}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-2 block">
                選擇排入哪一天
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
                          ? 'bg-[var(--tab-accent)] text-white border-transparent shadow-sm'
                          : 'bg-zinc-100/80 dark:bg-white/[0.05] text-zinc-800 dark:text-zinc-200 border-transparent hover:border-zinc-300 dark:hover:border-white/15'
                      }`}
                    >
                      <div className="font-num font-bold text-xs">Day {d.dayNum}</div>
                      <div className={`text-[11px] font-num ${active ? 'text-white/85' : 'text-zinc-500 dark:text-zinc-400'}`}>
                        {d.shortDate} · {d.count} 站
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
                  <span>出發時間</span>
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
                  停留時間
                </label>
                <div className="flex items-center gap-1.5 h-[42px]">
                  {QUICK_DURATIONS.map((dur) => (
                    <button
                      key={dur}
                      type="button"
                      onClick={() => setScheduleDuration(dur)}
                      className={`flex-1 h-10 rounded-xl text-xs font-num font-semibold cursor-pointer transition-colors ${
                        scheduleDuration === dur
                          ? 'bg-[var(--tab-accent)] text-white'
                          : 'bg-zinc-100 dark:bg-white/[0.06] text-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      {dur}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {QUICK_TIMES.map((qt) => (
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
                  {qt}
                </button>
              ))}
            </div>

            <button
              type="submit"
              className="w-full min-h-[48px] rounded-full bg-gradient-to-r from-[#0EA5E9] to-[#2563EB] text-white font-semibold text-sm cursor-pointer active:scale-[0.985] transition-all"
            >
              確認加入行程時間軸
            </button>
          </form>
        )}
      </LiquidModal>

      {/* AI Spot Discovery Modal */}
      <LiquidModal
        open={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        title={`AI 探索 · ${intel.displayCity}`}
        maxWidthClass="max-w-lg"
        bottomSheetOnMobile
      >
        <div className="space-y-4 overflow-y-auto no-scrollbar max-h-[72dvh] pr-0.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {(
                [
                  { id: 'all', label: '綜合精選' },
                  { id: 'sightseeing', label: '經典景點' },
                  { id: 'food', label: '在地美食' },
                  { id: 'cafe', label: '咖啡甜點' },
                  { id: 'shopping', label: '逛街伴手' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setAiFocusCategory(tab.id);
                    void handleFetchAiSpots(tab.id);
                  }}
                  className={`h-8 px-3 rounded-full text-xs font-semibold shrink-0 cursor-pointer transition-colors ${
                    aiFocusCategory === tab.id
                      ? 'bg-[var(--tab-accent)] text-white'
                      : 'bg-zinc-100 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={aiLoading}
              onClick={() => void handleFetchAiSpots(aiFocusCategory)}
              className="h-8 px-3 rounded-full bg-zinc-900 dark:bg-white/10 text-white text-xs font-semibold disabled:opacity-50 cursor-pointer shrink-0"
            >
              {aiLoading ? '搜尋中...' : '換一批'}
            </button>
          </div>

          {aiLoading && (
            <div className="py-10 text-center space-y-2">
              <div className="w-8 h-8 rounded-full border-2 border-sky-500 border-t-transparent animate-spin mx-auto" />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                正在精選 {intel.displayCity} 最值得收進口袋的好去處...
              </p>
            </div>
          )}

          {!aiLoading && aiError && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-300 space-y-2">
              <p>{aiError}</p>
              <button
                type="button"
                onClick={() => void handleFetchAiSpots(aiFocusCategory)}
                className="font-semibold underline cursor-pointer"
              >
                重新嘗試
              </button>
            </div>
          )}

          {!aiLoading && !aiError && aiSuggestions.length > 0 && (
            <div className="space-y-2.5">
              {aiSuggestions.map((spot) => {
                const alreadySaved = savedPlaces.some(
                  (p) => p.name.trim().toLowerCase() === spot.name.trim().toLowerCase()
                );
                const meta = CATEGORY_META[spot.category] || CATEGORY_META.sightseeing;
                return (
                  <div
                    key={spot.name}
                    className="p-3.5 rounded-2xl bg-zinc-100/80 dark:bg-white/[0.05] flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-display font-bold text-sm text-zinc-900 dark:text-white">
                          {spot.name}
                        </span>
                        <span className={`text-[11px] font-semibold ${meta.textClass}`}>
                          {meta.label}
                        </span>
                        {spot.area && (
                          <span className="text-[11px] text-zinc-400">· {spot.area}</span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                        {spot.note}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={alreadySaved}
                      onClick={() => handleCollectAiSpot(spot)}
                      className={`h-8 px-3.5 rounded-full text-xs font-semibold shrink-0 transition-colors cursor-pointer whitespace-nowrap ${
                        alreadySaved
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 cursor-default'
                          : 'bg-[var(--tab-accent)] text-white hover:bg-[var(--tab-accent-hover)]'
                      }`}
                    >
                      {alreadySaved ? '已收錄' : '+ 收錄'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </LiquidModal>

      <ConfirmSheet
        open={Boolean(deletingPlace)}
        onClose={() => setDeletingPlace(null)}
        onConfirm={confirmDeletePlace}
        title="移除此口袋地點？"
        description={`確定要從口袋名單移除「${deletingPlace?.name || ''}」嗎？（若已排入時間軸，行程內的項目仍會保留）`}
        confirmLabel="確認移除"
        tone="danger"
        icon={<TrashIcon className="w-6 h-6" />}
      />
    </div>
  );
};

export default ExploreTool;
