import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trip, PackingItem, DocumentItem, DocumentCategory } from '../types';
import { generateUniqueId } from '../shared/syncMerge';
import { detectDestinationIntel, getDestinationLocalTime } from '../shared/destinationIntel';
import { WeatherModal, WeatherGlyph, useLiveWeather } from './WeatherModal';
import { LiquidModal, ConfirmSheet, SlidingSegmentedControl } from './LiquidPrimitives';
import { uploadCloudFile, downloadCloudFileUrl, deleteCloudFile } from '../services/firebaseClient';
import {
  PlusIcon,
  TrashIcon,
  SuitcaseIcon,
  ShoppingBagIcon,
  CheckIcon,
  BoltIcon,
  MapIcon,
  SunIcon,
  NewspaperIcon,
  DocumentTextIcon,
  PhotoIcon,
  PaperClipIcon,
  ArrowUpRightIcon,
  ClockIcon,
  ArrowDownTrayIcon,
  PlaneIcon,
  HomeIcon,
  TicketIcon,
  ShieldCheckIcon,
} from './Icons';

interface Props {
  trip: Trip;
  cloudUserId?: string | null;
  onUpdateTrip: (trip: Trip) => void;
  onShowToast: (text: string, tone?: 'info' | 'success' | 'error') => void;
}

const MAX_DOC_BYTES = 20 * 1024 * 1024;

const DOC_CATEGORY_META: Record<
  DocumentCategory,
  { label: string; badgeClass: string; icon: React.ComponentType<{ className?: string }> }
> = {
  flight: {
    label: '航班資訊',
    badgeClass: 'bg-sky-500/12 text-sky-700 dark:text-sky-300',
    icon: PlaneIcon,
  },
  hotel: {
    label: '酒店住宿',
    badgeClass: 'bg-indigo-500/12 text-indigo-700 dark:text-indigo-300',
    icon: HomeIcon,
  },
  ticket: {
    label: '訂購門票',
    badgeClass: 'bg-amber-500/14 text-amber-700 dark:text-amber-300',
    icon: TicketIcon,
  },
  insurance: {
    label: '保險簽證',
    badgeClass: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
    icon: ShieldCheckIcon,
  },
  other: {
    label: '其他文件',
    badgeClass: 'bg-zinc-500/12 text-zinc-700 dark:text-zinc-300',
    icon: DocumentTextIcon,
  },
};

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isDocImage(doc: DocumentItem): boolean {
  if (doc.mimeType?.startsWith('image/')) return true;
  if (doc.content.startsWith('data:image/')) return true;
  const name = doc.fileName || doc.title || '';
  return /\.(png|jpe?g|webp|gif|bmp|heic|heif|avif)$/i.test(name);
}

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
      className={`surface-elevated rounded-2xl px-4 py-3 flex items-center gap-3 transition-opacity ${
        item.checked ? 'opacity-55' : ''
      }`}
    >
      <button
        type="button"
        onClick={() => onToggle(item.id)}
        aria-label={item.checked ? '標記為未完成' : '標記為已完成'}
        className={`w-6 h-6 rounded-full border-[1.75px] flex items-center justify-center shrink-0 transition-all cursor-pointer ${
          item.checked
            ? 'bg-[var(--tab-accent)] border-[var(--tab-accent)] text-white'
            : 'border-zinc-300 dark:border-zinc-600 hover:border-[var(--tab-accent)]'
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
          item.checked ? 'line-through text-zinc-400 dark:text-zinc-500' : 'text-zinc-900 dark:text-zinc-100'
        }`}
      />

      <button
        type="button"
        onClick={() => onDelete(item.id)}
        aria-label="刪除項目"
        className="min-w-[34px] min-h-[34px] rounded-xl flex items-center justify-center text-zinc-400 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer shrink-0"
      >
        <TrashIcon className="w-4 h-4" />
      </button>
    </motion.div>
  );
};

const PrepToolboxTool: React.FC<Props> = ({ trip, cloudUserId, onUpdateTrip, onShowToast }) => {
  const [section, setSection] = useState<'LISTS' | 'TOOLS' | 'DOCS'>('LISTS');
  const [listMode, setListMode] = useState<'PACKING' | 'SHOPPING'>('PACKING');
  const [newItemText, setNewItemText] = useState('');
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  // Toolbox & Document Metadata states
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [resolvedPreviewUrl, setResolvedPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [deleteDocTarget, setDeleteDocTarget] = useState<DocumentItem | null>(null);
  const [showWeatherModal, setShowWeatherModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [docTitleDraft, setDocTitleDraft] = useState('');
  const [docCategoryDraft, setDocCategoryDraft] = useState<DocumentCategory>('flight');
  const [docNoteDraft, setDocNoteDraft] = useState('');
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  // Editing metadata inside preview modal
  const [editTitleDraft, setEditTitleDraft] = useState('');
  const [editCategoryDraft, setEditCategoryDraft] = useState<DocumentCategory>('other');
  const [editNoteDraft, setEditNoteDraft] = useState('');

  useEffect(() => {
    if (!previewDoc) {
      setResolvedPreviewUrl(null);
      setPreviewLoading(false);
      setPreviewError(null);
      return;
    }

    setEditTitleDraft(previewDoc.title);
    setEditCategoryDraft(previewDoc.docCategory || 'other');
    setEditNoteDraft(previewDoc.note || '');
    setPreviewError(null);

    let cancelled = false;

    const resolveContent = async () => {
      const cloudId =
        previewDoc.cloudFileId ||
        (previewDoc.content.startsWith('cloud://file/')
          ? previewDoc.content.slice('cloud://file/'.length)
          : undefined);

      // Prefer cloud file resolution when signed in and cloudFileId exists (works across any device/origin)
      if (cloudId && cloudUserId) {
        setPreviewLoading(true);
        try {
          const url = await downloadCloudFileUrl(cloudUserId, cloudId);
          if (!cancelled) {
            setResolvedPreviewUrl(url);
            setPreviewLoading(false);
          }
          return;
        } catch (err) {
          if (previewDoc.content.startsWith('cloud://')) {
            if (!cancelled) {
              setPreviewLoading(false);
              setPreviewError(err instanceof Error ? err.message : '無法讀取雲端檔案');
            }
            return;
          }
        }
      }

      if (previewDoc.content.startsWith('cloud://')) {
        if (!cancelled) {
          setResolvedPreviewUrl(null);
          setPreviewLoading(false);
          setPreviewError('請先登入與原裝置相同的雲端帳號以檢視此檔案');
        }
        return;
      }

      if (!cancelled) {
        setResolvedPreviewUrl(previewDoc.content);
        setPreviewLoading(false);
      }
    };

    void resolveContent();
    return () => {
      cancelled = true;
    };
  }, [previewDoc, cloudUserId]);

  useEffect(() => {
    if (!pendingFile) {
      setPendingPreviewUrl(null);
      return;
    }
    if (pendingFile.type.startsWith('image/')) {
      const objUrl = URL.createObjectURL(pendingFile);
      setPendingPreviewUrl(objUrl);
      return () => URL.revokeObjectURL(objUrl);
    }
    setPendingPreviewUrl(null);
  }, [pendingFile]);

  const items = trip.packingList || [];
  const documents = trip.documents || [];

  const primaryCity = useMemo(() => {
    if (trip.type === 'Multi' && trip.stops && trip.stops.length > 0) {
      return trip.stops[0].destination || trip.destination;
    }
    return trip.destination;
  }, [trip.type, trip.stops, trip.destination]);

  const weatherCities = useMemo(() => {
    if (trip.type === 'Multi' && trip.stops && trip.stops.length > 0) {
      return trip.stops.map((s) => s.destination).filter(Boolean);
    }
    return [trip.destination];
  }, [trip.type, trip.stops, trip.destination]);

  const intel = useMemo(() => detectDestinationIntel(primaryCity), [primaryCity]);
  const liveWeather = useLiveWeather(primaryCity);
  const localClock = getDestinationLocalTime(liveWeather.data?.utcOffsetHours ?? intel.utcOffsetHours);

  const searchCity = encodeURIComponent(primaryCity);
  const encodedDest = encodeURIComponent(trip.destination);
  const primaryPhone = intel.emergency.match(/\d{3,4}/)?.[0] || '112';

  const currentTabItems = useMemo(() => {
    const filtered = items.filter((item) =>
      listMode === 'PACKING' ? !item.category || item.category === 'packing' : item.category === 'shopping'
    );
    return [...filtered].sort((a, b) => Number(a.checked) - Number(b.checked));
  }, [items, listMode]);

  const completedCount = useMemo(() => currentTabItems.filter((i) => i.checked).length, [currentTabItems]);
  const totalCount = currentTabItems.length;
  const progressPercent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  const packingTabCount = items.filter((i) => !i.category || i.category === 'packing').length;
  const shoppingTabCount = items.filter((i) => i.category === 'shopping').length;

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
      category: listMode === 'PACKING' ? 'packing' : 'shopping',
      updatedAt: Date.now(),
    };
    commitList([newItem, ...items]);
    setNewItemText('');
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
    const targetCat = listMode === 'PACKING' ? 'packing' : 'shopping';
    const removedIds: string[] = [];
    const remaining = items.filter((item) => {
      const isCurrentTab =
        listMode === 'PACKING' ? !item.category || item.category === 'packing' : item.category === targetCat;
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

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_DOC_BYTES) {
      onShowToast('單一檔案上限為 20MB', 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const baseName = file.name.replace(/\.[^.]+$/, '') || file.name;
    const lower = file.name.toLowerCase();
    let guessCategory: DocumentCategory = 'other';
    if (/(flight|ticket|boarding|機票|登機|航班)/i.test(lower)) guessCategory = 'flight';
    else if (/(hotel|booking|agoda|airbnb|飯店|酒店|住宿)/i.test(lower)) guessCategory = 'hotel';
    else if (/(pass|jr|metro|museum|disney|usj|門票|票券|預約)/i.test(lower)) guessCategory = 'ticket';
    else if (/(insur|visa|passport|護照|簽證|保險)/i.test(lower)) guessCategory = 'insurance';

    setPendingFile(file);
    setDocTitleDraft(baseName);
    setDocCategoryDraft(guessCategory);
    setDocNoteDraft('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConfirmUploadDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingFile) return;
    const cleanTitle = docTitleDraft.trim() || pendingFile.name;
    setIsUploadingDoc(true);

    try {
      let serverUrl: string | null = null;
      let serverMime: string | undefined;
      let cloudFileId: string | undefined;

      // 1. Always upload to private Firestore chunked storage when signed in so all devices/domains can view & download
      if (cloudUserId) {
        const uploadedCloud = await uploadCloudFile({
          userId: cloudUserId,
          tripId: trip.id,
          file: pendingFile,
        });
        cloudFileId = uploadedCloud.fileId;
        serverMime = uploadedCloud.mimeType;
      }

      // 2. Also upload to same-origin server endpoint when available (supports companion room sync without login)
      try {
        const res = await fetch('/api/documents/upload', {
          method: 'POST',
          headers: {
            'Content-Type': pendingFile.type || 'application/octet-stream',
            'X-File-Name': encodeURIComponent(pendingFile.name),
          },
          body: pendingFile,
        });
        const uploaded = await res.json().catch(() => ({}));
        if (res.ok && uploaded?.url) {
          serverUrl = uploaded.url;
          serverMime = uploaded.mimeType || serverMime;
        }
      } catch {
        // Static deploy without Express API: ignore if Firestore cloud upload succeeded
      }

      // 3. Fallback Data URL for small files when offline / static deploy without login
      if (!cloudFileId && !serverUrl) {
        if (pendingFile.size <= 1.2 * 1024 * 1024) {
          serverUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('讀取檔案失敗'));
            reader.readAsDataURL(pendingFile);
          });
        } else {
          throw new Error('請先登入雲端帳號，即可跨裝置同步 20MB 大型文件');
        }
      }

      const now = Date.now();
      const newDoc: DocumentItem = {
        id: generateUniqueId('doc'),
        title: cleanTitle,
        type: 'file',
        docCategory: docCategoryDraft,
        note: docNoteDraft.trim() || undefined,
        fileName: pendingFile.name,
        fileSize: pendingFile.size,
        mimeType: pendingFile.type || serverMime,
        content: serverUrl || `cloud://file/${cloudFileId}`,
        cloudFileId,
        createdAt: new Date().toLocaleDateString('zh-TW'),
        updatedAt: now,
      };

      onUpdateTrip({
        ...trip,
        documents: [newDoc, ...documents],
        updatedAt: now,
      });

      setPendingFile(null);
      setDocTitleDraft('');
      setDocNoteDraft('');
      onShowToast(cloudFileId ? '已儲存並同步文件至所有裝置' : '已儲存文件', 'success');
    } catch (err) {
      onShowToast(err instanceof Error ? err.message : '檔案上傳失敗', 'error');
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const handleSaveDocMetadata = () => {
    if (!previewDoc) return;
    const cleanTitle = editTitleDraft.trim() || previewDoc.title;
    const now = Date.now();
    const updatedDoc: DocumentItem = {
      ...previewDoc,
      title: cleanTitle,
      docCategory: editCategoryDraft,
      note: editNoteDraft.trim() || undefined,
      updatedAt: now,
    };
    onUpdateTrip({
      ...trip,
      documents: documents.map((d) => (d.id === previewDoc.id ? updatedDoc : d)),
      updatedAt: now,
    });
    setPreviewDoc(updatedDoc);
    onShowToast('已更新文件資訊', 'success');
  };

  const handleConfirmDeleteDoc = () => {
    if (!deleteDocTarget) return;
    const now = Date.now();
    const updated = documents.filter((d) => d.id !== deleteDocTarget.id);
    onUpdateTrip({
      ...trip,
      documents: updated,
      tombstones: { ...(trip.tombstones || {}), [deleteDocTarget.id]: now },
      updatedAt: now,
    });
    if (deleteDocTarget.content.startsWith('/api/documents/')) {
      void fetch(deleteDocTarget.content, { method: 'DELETE' }).catch(() => undefined);
    }
    const cloudId =
      deleteDocTarget.cloudFileId ||
      (deleteDocTarget.content.startsWith('cloud://file/')
        ? deleteDocTarget.content.slice('cloud://file/'.length)
        : undefined);
    if (cloudId && cloudUserId) {
      void deleteCloudFile(cloudUserId, cloudId).catch(() => undefined);
    }
    if (previewDoc?.id === deleteDocTarget.id) setPreviewDoc(null);
    onShowToast('已移除文件');
    setDeleteDocTarget(null);
  };

  const renderDestinationCard = () => (
    <div className="ink-card rounded-3xl p-5 sm:p-6 flex flex-col justify-between gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-zinc-400">
            {intel.countryLabel} · {intel.timezoneLabel}
          </div>
          <h2 className="text-2xl font-display font-bold text-white mt-0.5">{intel.displayCity}</h2>
        </div>

        <button
          type="button"
          onClick={() => setShowWeatherModal(true)}
          className="min-h-[40px] px-4 rounded-full bg-white/10 hover:bg-white/18 text-white text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shrink-0"
        >
          {liveWeather.data ? (
            <>
              <WeatherGlyph
                kind={liveWeather.data.current.kind}
                isDay={liveWeather.data.current.isDay}
                className="w-4 h-4"
              />
              <span className="font-num font-bold">{liveWeather.data.current.temp}°</span>
              <span className="text-zinc-300 hidden sm:inline">{liveWeather.data.current.label}</span>
            </>
          ) : (
            <>
              <SunIcon className="w-4 h-4 text-amber-300" />
              <span>即時天氣</span>
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/10 text-xs">
        <div>
          <div className="text-zinc-400 flex items-center gap-1 mb-0.5">
            <ClockIcon className="w-3.5 h-3.5" />
            <span>當地時間</span>
          </div>
          <div className="font-num font-semibold text-base text-white">{localClock.timeStr}</div>
        </div>
        <div>
          <div className="text-zinc-400 flex items-center gap-1 mb-0.5">
            <BoltIcon className="w-3.5 h-3.5 text-emerald-400" />
            <span>插座電壓</span>
          </div>
          <div className="font-semibold text-xs sm:text-sm text-white truncate">{intel.voltagePlug}</div>
        </div>
        <div>
          <div className="text-zinc-400 mb-0.5">緊急聯絡</div>
          <a
            href={`tel:${primaryPhone}`}
            className="font-num font-semibold text-xs sm:text-sm text-emerald-300 hover:underline block truncate"
          >
            {intel.emergency}
          </a>
        </div>
      </div>
    </div>
  );

  return (
    <div data-scroll-lock className="h-full min-h-0 flex flex-col relative bg-transparent overflow-clip">
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-5 sm:px-8 pt-3 pb-6 lg:pb-10">
        <div className="max-w-5xl lg:max-w-6xl mx-auto space-y-5">
          {/* Header Sub-row */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {intel.displayCity} · {intel.countryLabel} · {intel.currency}
            </div>

            <SlidingSegmentedControl
              size="sm"
              value={section}
              onChange={(val) => setSection(val)}
              options={[
                { id: 'LISTS', label: '旅行清單', badge: items.length, accentFrom: '#0E9F76', accentTo: '#14B8A6' },
                { id: 'TOOLS', label: '工具', accentFrom: '#0284C7', accentTo: '#0E9F76' },
                { id: 'DOCS', label: '文件', badge: documents.length, accentFrom: '#059669', accentTo: '#2DD4BF' },
              ]}
            />
          </div>

          {/* SECTION 1: TRAVEL ITEM CHECKLIST */}
          {section === 'LISTS' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              <div className="lg:col-span-7 space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <SlidingSegmentedControl
                    value={listMode}
                    onChange={(val) => setListMode(val)}
                    className="w-56"
                    fullWidth
                    options={[
                      {
                        id: 'PACKING',
                        label: '行李',
                        icon: <SuitcaseIcon className="w-3.5 h-3.5" />,
                        badge: packingTabCount,
                        accentFrom: '#0E9F76',
                        accentTo: '#10B981',
                      },
                      {
                        id: 'SHOPPING',
                        label: '購物',
                        icon: <ShoppingBagIcon className="w-3.5 h-3.5" />,
                        badge: shoppingTabCount,
                        accentFrom: '#0891B2',
                        accentTo: '#2DD4BF',
                      },
                    ]}
                  />

                  {completedCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setConfirmClearOpen(true)}
                      className="min-h-[38px] px-3.5 rounded-full surface-elevated text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-red-500 transition-colors cursor-pointer"
                    >
                      清除已完成 ({completedCount})
                    </button>
                  )}
                </div>

                {totalCount > 0 && (
                  <div className="flex items-center gap-3 px-1">
                    <div className="flex-1 h-2 rounded-full bg-zinc-200/80 dark:bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--tab-accent)] transition-all duration-500"
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
                    placeholder={listMode === 'PACKING' ? '新增行李物品...' : '新增購物項目...'}
                    className="flex-1 min-h-[46px] px-4 rounded-2xl surface-elevated text-sm font-medium text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[var(--tab-accent)]/30"
                  />
                  <button
                    type="submit"
                    disabled={!newItemText.trim()}
                    aria-label="新增項目"
                    className="min-w-[46px] min-h-[46px] px-4 rounded-2xl bg-[var(--tab-accent)] hover:bg-[var(--tab-accent-hover)] text-white font-semibold text-sm flex items-center justify-center gap-1.5 disabled:opacity-35 active:scale-95 transition-all cursor-pointer shrink-0 shadow-sm"
                  >
                    <PlusIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">新增</span>
                  </button>
                </form>

                {currentTabItems.length === 0 ? (
                  <div className="surface-elevated rounded-3xl py-12 px-6 flex flex-col items-center justify-center text-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-[var(--tab-accent-soft)] text-[var(--tab-accent)] flex items-center justify-center">
                      {listMode === 'PACKING' ? (
                        <SuitcaseIcon className="w-6 h-6" />
                      ) : (
                        <ShoppingBagIcon className="w-6 h-6" />
                      )}
                    </div>
                    <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                      {listMode === 'PACKING' ? '尚未新增項目' : '尚未建立購物項目'}
                    </p>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500">
                      請於上方輸入框自由新增清單項目
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
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
                  </div>
                )}
              </div>

              {/* Wide-screen Tablet/Desktop Right Column */}
              <div className="hidden lg:flex lg:col-span-5 flex-col gap-4">
                {renderDestinationCard()}

                <div className="surface-elevated rounded-3xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">清單完成概覽</span>
                    <span className="text-xs font-num font-bold text-[var(--tab-accent)]">
                      {progressPercent}%
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() => setListMode('PACKING')}
                      className={`p-3.5 rounded-2xl text-left border transition-colors cursor-pointer ${
                        listMode === 'PACKING'
                          ? 'bg-[var(--tab-accent-soft)] border-[var(--tab-accent)]/35'
                          : 'bg-zinc-100/70 dark:bg-white/[0.04] border-transparent'
                      }`}
                    >
                      <div className="text-zinc-500 dark:text-zinc-400">行李準備</div>
                      <div className="font-num font-bold text-lg text-zinc-900 dark:text-white mt-0.5">
                        {items.filter((i) => (!i.category || i.category === 'packing') && i.checked).length} / {packingTabCount}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setListMode('SHOPPING')}
                      className={`p-3.5 rounded-2xl text-left border transition-colors cursor-pointer ${
                        listMode === 'SHOPPING'
                          ? 'bg-[var(--tab-accent-soft)] border-[var(--tab-accent)]/35'
                          : 'bg-zinc-100/70 dark:bg-white/[0.04] border-transparent'
                      }`}
                    >
                      <div className="text-zinc-500 dark:text-zinc-400">購物願望</div>
                      <div className="font-num font-bold text-lg text-zinc-900 dark:text-white mt-0.5">
                        {items.filter((i) => i.category === 'shopping' && i.checked).length} / {shoppingTabCount}
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 2: TOOLS FOLDER */}
          {section === 'TOOLS' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              <div className="lg:col-span-5">
                {renderDestinationCard()}
              </div>

              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodedDest}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="surface-pastel-sky rounded-3xl p-4 sm:p-5 flex sm:flex-col items-center sm:items-stretch justify-between gap-3 hover:brightness-[0.98] transition-all"
                >
                  <div className="flex items-center justify-between w-auto sm:w-full">
                    <div className="w-10 h-10 rounded-2xl bg-sky-500/15 flex items-center justify-center">
                      <MapIcon className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                    </div>
                    <ArrowUpRightIcon className="w-4 h-4 text-zinc-400 hidden sm:block" />
                  </div>
                  <div className="flex-1 sm:flex-none">
                    <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Google 地圖</div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">探索 {intel.displayCity} 周邊</div>
                  </div>
                  <ArrowUpRightIcon className="w-4 h-4 text-zinc-400 sm:hidden shrink-0" />
                </a>

                <a
                  href={`https://news.google.com/search?q=${searchCity}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="surface-pastel-rose rounded-3xl p-4 sm:p-5 flex sm:flex-col items-center sm:items-stretch justify-between gap-3 hover:brightness-[0.98] transition-all"
                >
                  <div className="flex items-center justify-between w-auto sm:w-full">
                    <div className="w-10 h-10 rounded-2xl bg-rose-500/15 flex items-center justify-center">
                      <NewspaperIcon className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                    </div>
                    <ArrowUpRightIcon className="w-4 h-4 text-zinc-400 hidden sm:block" />
                  </div>
                  <div className="flex-1 sm:flex-none">
                    <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">當地資訊</div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">即時新聞與交通動態</div>
                  </div>
                  <ArrowUpRightIcon className="w-4 h-4 text-zinc-400 sm:hidden shrink-0" />
                </a>

                <button
                  type="button"
                  onClick={() => setShowWeatherModal(true)}
                  className="surface-pastel-mint rounded-3xl p-4 sm:p-5 flex sm:flex-col items-center sm:items-stretch justify-between gap-3 text-left hover:brightness-[0.98] transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between w-auto sm:w-full">
                    <div className="w-10 h-10 rounded-2xl bg-[var(--tab-accent-soft)] flex items-center justify-center">
                      <SunIcon className="w-5 h-5 text-[var(--tab-accent)]" />
                    </div>
                    <ArrowUpRightIcon className="w-4 h-4 text-zinc-400 hidden sm:block" />
                  </div>
                  <div className="flex-1 sm:flex-none">
                    <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">7 日天氣預報</div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">檢視逐日氣溫與降雨</div>
                  </div>
                  <ArrowUpRightIcon className="w-4 h-4 text-zinc-400 sm:hidden shrink-0" />
                </button>
              </div>
            </div>
          )}

          {/* SECTION 3: DOCUMENTS VAULT */}
          {section === 'DOCS' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              <div className="lg:col-span-8 surface-elevated rounded-3xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PaperClipIcon className="w-4 h-4 text-[var(--tab-accent)]" />
                    <h3 className="font-display font-bold text-base text-zinc-900 dark:text-zinc-100">
                      行程文件 ({documents.length})
                    </h3>
                  </div>
                  <div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelected}
                      accept="image/*,.pdf"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="min-h-[38px] px-3.5 rounded-full bg-[var(--tab-accent)] hover:bg-[var(--tab-accent-hover)] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <PlusIcon className="w-3.5 h-3.5" />
                      <span>上傳</span>
                    </button>
                  </div>
                </div>

                {documents.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-12 px-4 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl flex flex-col items-center justify-center text-center gap-2 hover:border-[var(--tab-accent)] transition-colors cursor-pointer"
                  >
                    <DocumentTextIcon className="w-7 h-7 text-zinc-400" />
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      上傳航班、酒店、門票或保險文件（單檔上限 20MB）
                    </span>
                  </button>
                ) : (
                  <div className="space-y-2">
                    <AnimatePresence initial={false}>
                      {documents.map((doc) => {
                        const isImg = isDocImage(doc);
                        const cat = DOC_CATEGORY_META[doc.docCategory || 'other'];
                        const CatIcon = cat.icon;
                        const sizeLabel = formatFileSize(doc.fileSize);
                        return (
                          <motion.div
                            layout
                            key={doc.id}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96 }}
                            onClick={() => setPreviewDoc(doc)}
                            className="rounded-2xl p-3 bg-zinc-100/75 dark:bg-white/[0.04] border border-zinc-200/60 dark:border-white/[0.06] flex items-center justify-between gap-3 cursor-pointer hover:bg-zinc-200/50 dark:hover:bg-white/[0.08] transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200/70 dark:border-white/10 flex items-center justify-center shrink-0 text-zinc-700 dark:text-zinc-200 overflow-hidden">
                                {isImg ? <PhotoIcon className="w-5 h-5 text-[var(--tab-accent)]" /> : <CatIcon className="w-5 h-5" />}
                              </div>
                              <div className="min-w-0 space-y-0.5">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                                    {doc.title}
                                  </p>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${cat.badgeClass}`}>
                                    {cat.label}
                                  </span>
                                </div>
                                <p className="text-[11px] font-num text-zinc-500 dark:text-zinc-400 truncate">
                                  {doc.createdAt}
                                  {sizeLabel ? ` · ${sizeLabel}` : ''}
                                  {doc.note ? ` · ${doc.note}` : ''}
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteDocTarget(doc);
                              }}
                              aria-label="刪除文件"
                              className="min-w-[36px] min-h-[36px] rounded-xl flex items-center justify-center text-zinc-400 hover:text-red-500 cursor-pointer shrink-0"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              <div className="hidden lg:block lg:col-span-4">
                {renderDestinationCard()}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Document Upload Metadata Modal */}
      <LiquidModal
        open={!!pendingFile}
        onClose={() => !isUploadingDoc && setPendingFile(null)}
        bottomSheetOnMobile
        maxWidthClass="max-w-md"
        title="填寫文件資訊"
      >
        {pendingFile && (
          <form onSubmit={handleConfirmUploadDoc} className="space-y-4">
            {pendingPreviewUrl ? (
              <div className="rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-950/60 border border-zinc-200/70 dark:border-white/10 max-h-44 flex items-center justify-center p-2">
                <img
                  src={pendingPreviewUrl}
                  alt={pendingFile.name}
                  className="max-h-40 w-auto object-contain rounded-xl"
                />
              </div>
            ) : (
              <div className="rounded-2xl bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200/70 dark:border-white/10 p-3.5 flex items-center gap-3">
                <DocumentTextIcon className="w-6 h-6 text-[var(--tab-accent)] shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">{pendingFile.name}</p>
                  <p className="text-[11px] font-num text-zinc-500 dark:text-zinc-400">
                    {formatFileSize(pendingFile.size)}
                  </p>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1.5 block">
                文件名稱
              </label>
              <input
                type="text"
                required
                value={docTitleDraft}
                onChange={(e) => setDocTitleDraft(e.target.value)}
                placeholder="例如：去程電子機票、環球影城門票"
                className="w-full h-11 px-3.5 rounded-2xl bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200/70 dark:border-white/10 text-sm font-semibold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--tab-accent)]/35"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1.5 block">
                文件類型
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(Object.keys(DOC_CATEGORY_META) as DocumentCategory[]).map((catKey) => {
                  const meta = DOC_CATEGORY_META[catKey];
                  const Icon = meta.icon;
                  const active = docCategoryDraft === catKey;
                  return (
                    <button
                      key={catKey}
                      type="button"
                      onClick={() => setDocCategoryDraft(catKey)}
                      className={`h-10 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                        active
                          ? 'bg-[var(--tab-accent)] text-white border-transparent shadow-sm'
                          : 'bg-zinc-100/80 dark:bg-white/[0.04] text-zinc-700 dark:text-zinc-200 border-zinc-200/70 dark:border-white/10'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{meta.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1.5 block">
                備註資訊（選填）
              </label>
              <input
                type="text"
                value={docNoteDraft}
                onChange={(e) => setDocNoteDraft(e.target.value)}
                placeholder="訂位代號、確認碼或備忘說明..."
                className="w-full h-11 px-3.5 rounded-2xl bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200/70 dark:border-white/10 text-sm text-zinc-900 dark:text-white focus:outline-none"
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                disabled={isUploadingDoc}
                onClick={() => setPendingFile(null)}
                className="h-11 px-4 rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-200 cursor-pointer"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={isUploadingDoc || !docTitleDraft.trim()}
                className="flex-1 h-11 rounded-full bg-[var(--tab-accent)] hover:bg-[var(--tab-accent-hover)] text-white text-xs sm:text-sm font-semibold disabled:opacity-50 cursor-pointer"
              >
                {isUploadingDoc ? '上傳保存中...' : '確認上傳並儲存'}
              </button>
            </div>
          </form>
        )}
      </LiquidModal>

      {/* Document Preview & Edit Metadata Modal */}
      <LiquidModal
        open={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        title={previewDoc?.title}
        maxWidthClass="max-w-2xl"
      >
        {previewDoc && (
          <div className="space-y-4 overflow-y-auto no-scrollbar max-h-[75vh] pr-0.5">
            <div className="max-h-[48vh] overflow-auto rounded-2xl bg-zinc-100 dark:bg-zinc-950/60 flex items-center justify-center p-3">
              {previewLoading ? (
                <div className="py-12 px-6 text-center space-y-2">
                  <div className="w-6 h-6 border-2 border-[var(--tab-accent)] border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">正在從雲端載入文件...</p>
                </div>
              ) : previewError || !resolvedPreviewUrl ? (
                <div className="py-10 px-6 text-center space-y-2">
                  <DocumentTextIcon className="w-10 h-10 text-zinc-400 mx-auto" />
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {previewError || '無法載入預覽內容'}
                  </p>
                </div>
              ) : isDocImage(previewDoc) ? (
                <img
                  src={resolvedPreviewUrl}
                  alt={previewDoc.title}
                  className="max-w-full max-h-[44vh] object-contain rounded-xl"
                />
              ) : previewDoc.mimeType === 'application/pdf' || /\.pdf$/i.test(previewDoc.fileName || previewDoc.title) ? (
                <iframe
                  src={resolvedPreviewUrl}
                  title={previewDoc.title}
                  className="w-full h-[42vh] rounded-xl bg-white"
                />
              ) : (
                <div className="py-10 px-6 text-center space-y-2">
                  <DocumentTextIcon className="w-12 h-12 text-zinc-400 mx-auto" />
                  <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{previewDoc.title}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    文件已安全保存，可點擊下方下載檢視
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-zinc-100/75 dark:bg-white/[0.04] border border-zinc-200/70 dark:border-white/10 p-3.5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1 block">
                    文件名稱
                  </label>
                  <input
                    type="text"
                    value={editTitleDraft}
                    onChange={(e) => setEditTitleDraft(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl bg-white dark:bg-zinc-900/70 text-xs font-semibold text-zinc-900 dark:text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1 block">
                    文件類型
                  </label>
                  <select
                    value={editCategoryDraft}
                    onChange={(e) => setEditCategoryDraft(e.target.value as DocumentCategory)}
                    className="w-full h-9 px-3 rounded-xl bg-white dark:bg-zinc-900/70 text-xs font-semibold text-zinc-900 dark:text-white focus:outline-none"
                  >
                    {(Object.keys(DOC_CATEGORY_META) as DocumentCategory[]).map((catKey) => (
                      <option key={catKey} value={catKey}>
                        {DOC_CATEGORY_META[catKey].label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1 block">
                  備註資訊
                </label>
                <input
                  type="text"
                  value={editNoteDraft}
                  onChange={(e) => setEditNoteDraft(e.target.value)}
                  placeholder="補充訂位代號或說明..."
                  className="w-full h-9 px-3 rounded-xl bg-white dark:bg-zinc-900/70 text-xs text-zinc-900 dark:text-white focus:outline-none"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveDocMetadata}
                  className="h-8 px-4 rounded-full bg-[var(--tab-accent)] text-white text-xs font-semibold cursor-pointer"
                >
                  更新文件資訊
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-num text-zinc-500 dark:text-zinc-400">
                {previewDoc.fileName || previewDoc.title}
                {previewDoc.fileSize ? ` · ${formatFileSize(previewDoc.fileSize)}` : ''}
              </span>
              <a
                href={resolvedPreviewUrl || '#'}
                download={previewDoc.fileName || previewDoc.title}
                onClick={(e) => {
                  if (!resolvedPreviewUrl) e.preventDefault();
                }}
                className={`min-h-[42px] px-5 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold inline-flex items-center gap-2 shrink-0 ${
                  !resolvedPreviewUrl ? 'opacity-40 pointer-events-none' : ''
                }`}
              >
                <ArrowDownTrayIcon className="w-4 h-4" />
                <span>下載檔案</span>
              </a>
            </div>
          </div>
        )}
      </LiquidModal>

      <WeatherModal
        open={showWeatherModal}
        onClose={() => setShowWeatherModal(false)}
        cities={weatherCities}
        initialCity={primaryCity}
      />

      <ConfirmSheet
        open={confirmClearOpen}
        onClose={() => setConfirmClearOpen(false)}
        onConfirm={handleClearCompleted}
        title="清除已完成項目？"
        description={`將移除目前分頁中 ${completedCount} 個已勾選的項目。`}
        confirmLabel="確認清除"
        icon={<TrashIcon className="w-6 h-6" />}
      />

      <ConfirmSheet
        open={!!deleteDocTarget}
        onClose={() => setDeleteDocTarget(null)}
        onConfirm={handleConfirmDeleteDoc}
        title="刪除此文件？"
        description={`「${deleteDocTarget?.title || ''}」將永久移除並同步至其他裝置。`}
        confirmLabel="確認刪除"
        icon={<TrashIcon className="w-6 h-6" />}
      />
    </div>
  );
};

export default PrepToolboxTool;
