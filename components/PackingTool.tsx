import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trip, PackingItem } from '../types';
import { generateUniqueId } from '../shared/syncMerge';
import { useLiveWeather } from './WeatherModal';
import { ConfirmSheet } from './LiquidPrimitives';
import {
  PlusIcon,
  TrashIcon,
  SuitcaseIcon,
  ShoppingBagIcon,
  CheckIcon,
  BoltIcon,
} from './Icons';

interface Props {
  trip: Trip;
  onUpdateTrip: (trip: Trip) => void;
  onShowToast: (text: string, tone?: 'info' | 'success' | 'error') => void;
}

const STARTER_PACKS: { id: string; label: string; items: string[] }[] = [
  { id: 'docs', label: '證件金融', items: ['護照', '身份證', '信用卡', '當地現金', '網卡 / eSIM', '登機證與憑證'] },
  { id: 'tech', label: '電子充電', items: ['手機充電線', '行動電源', '萬用轉接頭', '耳機'] },
  { id: 'care', label: '盥洗藥品', items: ['個人常備藥', '牙刷牙膏', '防曬乳', '護唇膏', '隨身面紙'] },
  { id: 'wear', label: '隨身衣物', items: ['換洗衣物', '輕便外套', '好走的鞋', '換洗貼身衣物', '睡衣'] },
];

interface PackingRowProps {
  item: PackingItem;
  onToggle: (id: string) => void;
  onCommitName: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

const PackingRow: React.FC<PackingRowProps> = ({ item, onToggle, onCommitName, onDelete }) => {
  const [draft, setDraft] = useState(item.name);

  useEffect(() => {
    setDraft(item.name);
  }, [item.name]);

  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setDraft(item.name);
      return;
    }
    if (trimmed !== item.name) {
      onCommitName(item.id, trimmed);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      className={`surface-card rounded-2xl px-4 py-3 flex items-center gap-3 transition-opacity ${
        item.checked ? 'opacity-55' : ''
      }`}
    >
      <button
        type="button"
        onClick={() => onToggle(item.id)}
        aria-label={item.checked ? '標記為未完成' : '標記為已完成'}
        className={`w-6 h-6 rounded-full border-[1.75px] flex items-center justify-center shrink-0 transition-all cursor-pointer ${
          item.checked
            ? 'bg-zinc-900 border-zinc-900 text-white dark:bg-zinc-100 dark:border-zinc-100 dark:text-zinc-900'
            : 'border-zinc-300 dark:border-zinc-600 hover:border-zinc-900 dark:hover:border-zinc-300'
        }`}
      >
        {item.checked && <CheckIcon className="w-3.5 h-3.5" />}
      </button>

      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur();
          }
        }}
        className={`flex-1 min-w-0 bg-transparent text-sm font-medium focus:outline-none ${
          item.checked
            ? 'line-through text-zinc-400 dark:text-zinc-500'
            : 'text-zinc-900 dark:text-zinc-100'
        }`}
      />

      <button
        type="button"
        onClick={() => onDelete(item.id)}
        aria-label="刪除項目"
        className="min-w-[36px] min-h-[36px] rounded-xl flex items-center justify-center text-zinc-400 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer shrink-0"
      >
        <TrashIcon className="w-4 h-4" />
      </button>
    </motion.div>
  );
};

const PackingTool: React.FC<Props> = ({ trip, onUpdateTrip, onShowToast }) => {
  const [activeTab, setActiveTab] = useState<'PACKING' | 'SHOPPING'>('PACKING');
  const [newItemText, setNewItemText] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const items = trip.packingList || [];
  const liveWeather = useLiveWeather(trip.destination);

  const weatherSuggestions = useMemo(() => {
    if (!liveWeather.data) return [];
    const list: string[] = [];
    const temp = liveWeather.data.current.temp;
    const rainProb = liveWeather.data.daily[0]?.precipProb ?? 0;
    if (rainProb >= 40) list.push('摺疊雨傘', '防水鞋套');
    if (temp <= 12) list.push('保暖外套', '圍巾 / 發熱衣');
    if (temp >= 26) list.push('太陽眼鏡', '防曬噴霧');
    return list;
  }, [liveWeather.data]);

  const currentTabItems = useMemo(() => {
    const filtered = items.filter((item) =>
      activeTab === 'PACKING' ? !item.category || item.category === 'packing' : item.category === 'shopping'
    );
    return [...filtered].sort((a, b) => Number(a.checked) - Number(b.checked));
  }, [items, activeTab]);

  const completedCount = useMemo(() => currentTabItems.filter((i) => i.checked).length, [currentTabItems]);
  const totalCount = currentTabItems.length;
  const progressPercent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  const commitList = (nextList: PackingItem[], deletedIds?: string[]) => {
    const now = Date.now();
    const tombstones = { ...(trip.tombstones || {}) };
    if (deletedIds) {
      deletedIds.forEach((id) => {
        tombstones[id] = now;
      });
    }
    onUpdateTrip({
      ...trip,
      packingList: nextList,
      tombstones,
      updatedAt: now,
    });
  };

  const handleAddItem = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = newItemText.trim();
    if (!trimmed) return;
    const newItem: PackingItem = {
      id: generateUniqueId('pack'),
      name: trimmed,
      checked: false,
      category: activeTab === 'PACKING' ? 'packing' : 'shopping',
      updatedAt: Date.now(),
    };
    commitList([newItem, ...items]);
    setNewItemText('');
  };

  const handleAddBatch = (names: string[], label: string) => {
    const now = Date.now();
    const existingNames = new Set(
      items
        .filter((i) => !i.category || i.category === 'packing')
        .map((i) => i.name.trim().toLowerCase())
    );
    const toAdd: PackingItem[] = names
      .filter((name) => !existingNames.has(name.toLowerCase()))
      .map((name, idx) => ({
        id: generateUniqueId(`pack${idx}`),
        name,
        checked: false,
        category: 'packing',
        updatedAt: now,
      }));

    if (toAdd.length === 0) {
      onShowToast(`「${label}」項目皆已在清單中`, 'info');
      return;
    }

    commitList([...toAdd, ...items]);
    onShowToast(`已加入 ${toAdd.length} 項（${label}）`, 'success');
    setShowTemplates(false);
  };

  const handleToggleItem = (id: string) => {
    const now = Date.now();
    commitList(items.map((item) => (item.id === id ? { ...item, checked: !item.checked, updatedAt: now } : item)));
  };

  const handleCommitItemName = (id: string, name: string) => {
    const now = Date.now();
    commitList(items.map((item) => (item.id === id ? { ...item, name, updatedAt: now } : item)));
  };

  const handleDeleteItem = (id: string) => {
    commitList(
      items.filter((item) => item.id !== id),
      [id]
    );
  };

  const handleClearCompleted = () => {
    const targetCat = activeTab === 'PACKING' ? 'packing' : 'shopping';
    const removedIds: string[] = [];
    const remaining = items.filter((item) => {
      const isCurrentTab = activeTab === 'PACKING' ? !item.category || item.category === 'packing' : item.category === targetCat;
      if (isCurrentTab && item.checked) {
        removedIds.push(item.id);
        return false;
      }
      return true;
    });
    if (removedIds.length === 0) return;
    commitList(remaining, removedIds);
    onShowToast(`已清除 ${removedIds.length} 個已完成項目`);
  };

  const packingTabCount = items.filter((i) => !i.category || i.category === 'packing').length;
  const shoppingTabCount = items.filter((i) => i.category === 'shopping').length;

  return (
    <div className="h-full flex flex-col relative bg-transparent overflow-hidden">
      <div className="flex-1 min-h-0 flex flex-col max-w-4xl w-full mx-auto px-5 sm:px-8 pt-5">
        {/* Top Row: Title & Segmented Switch */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 pb-4 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-display font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
              旅行清單
            </h1>
            {completedCount > 0 && (
              <button
                type="button"
                onClick={() => setConfirmClearOpen(true)}
                className="sm:hidden text-xs font-medium text-zinc-500 hover:text-red-500 transition-colors cursor-pointer"
              >
                清除已完成 ({completedCount})
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <div className="bg-zinc-200/70 dark:bg-white/[0.06] p-1 rounded-full flex relative h-10 w-full sm:w-64 border border-zinc-200/60 dark:border-white/10">
              {(['PACKING', 'SHOPPING'] as const).map((tab) => {
                const active = activeTab === tab;
                const count = tab === 'PACKING' ? packingTabCount : shoppingTabCount;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 relative z-10 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      active ? 'text-white dark:text-zinc-900' : 'text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    {active && (
                      <motion.div
                        layoutId="packing-tab-pill"
                        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                        className="absolute inset-0 rounded-full bg-zinc-900 dark:bg-zinc-100 shadow-sm -z-10"
                      />
                    )}
                    {tab === 'PACKING' ? <SuitcaseIcon className="w-3.5 h-3.5" /> : <ShoppingBagIcon className="w-3.5 h-3.5" />}
                    <span>{tab === 'PACKING' ? '行李' : '購物'}</span>
                    <span className="font-num opacity-70">{count}</span>
                  </button>
                );
              })}
            </div>

            {completedCount > 0 && (
              <button
                type="button"
                onClick={() => setConfirmClearOpen(true)}
                className="hidden sm:inline-flex min-h-[40px] px-3.5 rounded-full surface-card text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-red-500 transition-colors cursor-pointer whitespace-nowrap"
              >
                清除已完成
              </button>
            )}
          </div>
        </div>

        {/* Inline Progress & Quick-Add Composer (always clean inside layout, zero overlap) */}
        <div className="space-y-3 pb-4 shrink-0">
          {totalCount > 0 && (
            <div className="flex items-center gap-3 px-1">
              <div className="flex-1 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-600 dark:bg-blue-500 transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-xs font-num font-semibold text-zinc-600 dark:text-zinc-400 shrink-0">
                {completedCount}/{totalCount}
              </span>
            </div>
          )}

          <form onSubmit={handleAddItem} className="flex gap-2">
            <input
              type="text"
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              placeholder={activeTab === 'PACKING' ? '新增行李物品...' : '新增購物項目...'}
              className="flex-1 min-h-[46px] px-4 rounded-2xl surface-elevated text-sm font-medium text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-600/25"
            />
            <button
              type="submit"
              disabled={!newItemText.trim()}
              aria-label="新增項目"
              className="min-w-[46px] min-h-[46px] px-4 rounded-2xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold text-sm flex items-center justify-center gap-1.5 disabled:opacity-35 active:scale-95 transition-all cursor-pointer shrink-0"
            >
              <PlusIcon className="w-4 h-4" />
              <span className="hidden sm:inline">新增</span>
            </button>
            {activeTab === 'PACKING' && (
              <button
                type="button"
                onClick={() => setShowTemplates((v) => !v)}
                className={`min-h-[46px] px-3.5 rounded-2xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
                  showTemplates
                    ? 'bg-blue-600 text-white'
                    : 'surface-card text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-white/10'
                }`}
              >
                <BoltIcon className="w-3.5 h-3.5" />
                <span>常用範本</span>
              </button>
            )}
          </form>

          {/* Optional Starter Templates & Weather Suggestions */}
          <AnimatePresence>
            {activeTab === 'PACKING' && showTemplates && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="surface-card rounded-2xl p-3.5 space-y-2.5">
                  <div className="flex flex-wrap gap-2">
                    {STARTER_PACKS.map((pack) => (
                      <button
                        key={pack.id}
                        type="button"
                        onClick={() => handleAddBatch(pack.items, pack.label)}
                        className="min-h-[36px] px-3 rounded-xl bg-zinc-100 dark:bg-white/[0.06] hover:bg-blue-600 hover:text-white text-zinc-800 dark:text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
                      >
                        + {pack.label} ({pack.items.length})
                      </button>
                    ))}
                    {weatherSuggestions.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleAddBatch(weatherSuggestions, '當地天氣建議')}
                        className="min-h-[36px] px-3 rounded-xl bg-blue-600/10 text-blue-700 dark:text-blue-400 hover:bg-blue-600 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                      >
                        + 當地天氣建議 ({weatherSuggestions.join('、')})
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Scrollable Items */}
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar pb-28 lg:pb-10 space-y-2">
          {currentTabItems.length === 0 ? (
            <div className="surface-card rounded-3xl py-12 px-6 flex flex-col items-center justify-center text-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900/5 dark:bg-white/[0.06] text-zinc-500 flex items-center justify-center">
                {activeTab === 'PACKING' ? <SuitcaseIcon className="w-6 h-6" /> : <ShoppingBagIcon className="w-6 h-6" />}
              </div>
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                {activeTab === 'PACKING' ? '尚未加入行李項目' : '尚未建立購物清單'}
              </p>
              {activeTab === 'PACKING' && (
                <button
                  type="button"
                  onClick={() => handleAddBatch([...STARTER_PACKS[0].items, ...STARTER_PACKS[1].items], '出發必備')}
                  className="min-h-[40px] px-4 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold cursor-pointer"
                >
                  一鍵加入證件與充電基本清單
                </button>
              )}
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {currentTabItems.map((item) => (
                <PackingRow
                  key={item.id}
                  item={item}
                  onToggle={handleToggleItem}
                  onCommitName={handleCommitItemName}
                  onDelete={handleDeleteItem}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>

      <ConfirmSheet
        open={confirmClearOpen}
        onClose={() => setConfirmClearOpen(false)}
        onConfirm={handleClearCompleted}
        title="清除已完成項目？"
        description={`將移除目前分頁中 ${completedCount} 個已勾選的項目。`}
        confirmLabel="確認清除"
        icon={<TrashIcon className="w-6 h-6" />}
      />
    </div>
  );
};

export default PackingTool;
