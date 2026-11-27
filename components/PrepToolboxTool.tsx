import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trip, PackingItem, DocumentItem, DocumentCategory } from '../types';
import { generateUniqueId } from '../shared/syncMerge';
import { detectDestinationIntel, getDestinationLocalTime } from '../shared/destinationIntel';
import { WeatherModal, WeatherGlyph, useLiveWeather } from './WeatherModal';
import { LiquidModal, ConfirmSheet, SlidingSegmentedControl } from './LiquidPrimitives';
import { DownloadProgressButton } from './TactileButtons';
import { tactileAudio } from '../services/tactileAudio';
import { uploadCloudFile, downloadCloudFileUrl, deleteCloudFile } from '../services/firebaseClient';
import { useI18n } from '../hooks/useI18n';
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
  ChevronRightIcon,
  ClockIcon,
  GlobeIcon,
  ArrowDownTrayIcon,
  PlaneIcon,
  HomeIcon,
  TicketIcon,
  ShieldCheckIcon,
  TagIcon,
  TranslateIcon,
} from './Icons';

function resolveTranslateTarget(
  cityQuery: string,
  currency: string,
  t: (tw: string, cn: string, en: string) => string
): { tl: string; label: string } {
  const q = cityQuery.toLowerCase();
  if (currency === 'JPY') return { tl: 'ja', label: t('日文翻譯', '日文翻译', 'Japanese') };
  if (currency === 'KRW') return { tl: 'ko', label: t('韓文翻譯', '韩文翻译', 'Korean') };
  if (currency === 'THB') return { tl: 'th', label: t('泰文翻譯', '泰文翻译', 'Thai') };
  if (currency === 'VND') return { tl: 'vi', label: t('越文翻譯', '越文翻译', 'Vietnamese') };
  if (currency === 'IDR') return { tl: 'id', label: t('印尼文翻譯', '印尼文翻译', 'Indonesian') };
  if (currency === 'MYR') return { tl: 'ms', label: t('馬來文翻譯', '马来文翻译', 'Malay') };
  if (currency === 'CHF' || /(berlin|munich|frankfurt|vienna|zurich)/.test(q)) {
    return { tl: 'de', label: t('德文翻譯', '德文翻译', 'German') };
  }
  if (/(paris|nice|lyon|marseille|brussels)/.test(q)) {
    return { tl: 'fr', label: t('法文翻譯', '法文翻译', 'French') };
  }
  if (/(rome|milan|venice|florence|naples)/.test(q)) {
    return { tl: 'it', label: t('義大利文翻譯', '意大利文翻译', 'Italian') };
  }
  if (/(madrid|barcelona|seville)/.test(q)) {
    return { tl: 'es', label: t('西班牙文翻譯', '西班牙文翻译', 'Spanish') };
  }
  if (/(lisbon|porto)/.test(q)) return { tl: 'pt', label: t('葡文翻譯', '葡文翻译', 'Portuguese') };
  if (/(amsterdam|rotterdam)/.test(q)) return { tl: 'nl', label: t('荷文翻譯', '荷文翻译', 'Dutch') };
  if (currency === 'CZK') return { tl: 'cs', label: t('捷克文翻譯', '捷克文翻译', 'Czech') };
  if (currency === 'HUF') return { tl: 'hu', label: t('匈牙利文翻譯', '匈牙利文翻译', 'Hungarian') };
  if (currency === 'ISK') return { tl: 'is', label: t('冰島文翻譯', '冰岛文翻译', 'Icelandic') };
  if (currency === 'TRY') return { tl: 'tr', label: t('土耳其文翻譯', '土耳其文翻译', 'Turkish') };
  if (currency === 'AED') return { tl: 'ar', label: t('阿拉伯文翻譯', '阿拉伯文翻译', 'Arabic') };
  if (['TWD', 'HKD', 'MOP', 'CNY'].includes(currency)) {
    return { tl: 'en', label: t('英文翻譯', '英文翻译', 'English') };
  }
  return { tl: 'en', label: t('英文翻譯', '英文翻译', 'English') };
}

interface Props {
  trip: Trip;
  cloudUserId?: string | null;
  onUpdateTrip: (trip: Trip) => void;
  onShowToast: (text: string, tone?: 'info' | 'success' | 'error') => void;
}

const MAX_DOC_BYTES = 20 * 1024 * 1024;

const DOC_CATEGORY_STYLES: Record<
  DocumentCategory,
  { badgeClass: string; icon: React.ComponentType<{ className?: string }> }
> = {
  flight: {
    badgeClass: 'bg-sky-500/12 text-sky-700 dark:text-sky-300',
    icon: PlaneIcon,
  },
  hotel: {
    badgeClass: 'bg-indigo-500/12 text-indigo-700 dark:text-indigo-300',
    icon: HomeIcon,
  },
  ticket: {
    badgeClass: 'bg-amber-500/14 text-amber-700 dark:text-amber-300',
    icon: TicketIcon,
  },
  insurance: {
    badgeClass: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
    icon: ShieldCheckIcon,
  },
  other: {
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
  const { t } = useI18n();
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
        onClick={() => {
          tactileAudio.playPop(item.checked ? 0.85 : 1.18);
          onToggle(item.id);
        }}
        aria-label={
          item.checked
            ? t('標記為未完成', '标记为未完成', 'Mark as incomplete')
            : t('標記為已完成', '标记为已完成', 'Mark as complete')
        }
        className={`w-6 h-6 rounded-full border-[1.75px] flex items-center justify-center shrink-0 transition-all active:scale-90 cursor-pointer ${
          item.checked
            ? 'bg-[var(--tab-accent)] border-[var(--tab-accent)] text-white shadow-xs'
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
        aria-label={t('刪除項目', '删除项目', 'Delete item')}
        className="min-w-[34px] min-h-[34px] rounded-xl flex items-center justify-center text-zinc-400 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer shrink-0"
      >
        <TrashIcon className="w-4 h-4" />
      </button>
    </motion.div>
  );
};

const PrepToolboxTool: React.FC<Props> = ({ trip, cloudUserId, onUpdateTrip, onShowToast }) => {
  const { lang, localeTag, t } = useI18n();
  const [section, setSection] = useState<'LISTS' | 'TOOLS' | 'DOCS'>('LISTS');
  const [listMode, setListMode] = useState<'PACKING' | 'SHOPPING'>('PACKING');
  const [newItemText, setNewItemText] = useState('');
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const docCategoryMeta = useMemo<
    Record<
      DocumentCategory,
      { label: string; badgeClass: string; icon: React.ComponentType<{ className?: string }> }
    >
  >(
    () => ({
      flight: { ...DOC_CATEGORY_STYLES.flight, label: t('航班資訊', '航班信息', 'Flight') },
      hotel: { ...DOC_CATEGORY_STYLES.hotel, label: t('酒店住宿', '酒店住宿', 'Hotel') },
      ticket: { ...DOC_CATEGORY_STYLES.ticket, label: t('訂購門票', '预订门票', 'Tickets') },
      insurance: { ...DOC_CATEGORY_STYLES.insurance, label: t('保險簽證', '保险签证', 'Visa / Ins.') },
      other: { ...DOC_CATEGORY_STYLES.other, label: t('其他文件', '其他文件', 'Other') },
    }),
    [t]
  );

  // Toolbox & Document Metadata states
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [resolvedPreviewUrl, setResolvedPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [deleteDocTarget, setDeleteDocTarget] = useState<DocumentItem | null>(null);
  const [showWeatherModal, setShowWeatherModal] = useState(false);
  const [showDestDetailModal, setShowDestDetailModal] = useState(false);
  const [detailCityIndex, setDetailCityIndex] = useState(0);
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
              setPreviewError(
                err instanceof Error ? err.message : t('無法讀取雲端檔案', '无法读取云端文件', 'Unable to load cloud file')
              );
            }
            return;
          }
        }
      }

      if (previewDoc.content.startsWith('cloud://')) {
        if (!cancelled) {
          setResolvedPreviewUrl(null);
          setPreviewLoading(false);
          setPreviewError(
            t(
              '請先登入與原裝置相同的雲端帳號以檢視此檔案',
              '请先登录与原设备相同的云端账号以查看此文件',
              'Please sign in with the same cloud account to view this file'
            )
          );
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

  const intel = useMemo(() => detectDestinationIntel(primaryCity, lang), [primaryCity, lang]);
  const liveWeather = useLiveWeather(primaryCity);
  const localClock = getDestinationLocalTime(
    liveWeather.data?.utcOffsetHours ?? intel.utcOffsetHours,
    lang
  );

  const searchCity = encodeURIComponent(primaryCity);
  const encodedDest = encodeURIComponent(trip.destination);
  const primaryPhone = intel.emergency.match(/\d{3,4}/)?.[0] || '112';
  const translateSpec = useMemo(
    () => resolveTranslateTarget(intel.cityQuery, intel.currency, t),
    [intel.cityQuery, intel.currency, t]
  );

  const detailCities = useMemo(() => {
    const raw =
      trip.type === 'Multi' && trip.stops && trip.stops.length > 0
        ? trip.stops.map((s) => s.destination.trim()).filter(Boolean)
        : [primaryCity];
    return Array.from(new Set(raw));
  }, [trip.type, trip.stops, primaryCity]);

  const activeDetailCity = detailCities[detailCityIndex] || primaryCity;
  const activeDetailIntel = useMemo(
    () => detectDestinationIntel(activeDetailCity, lang),
    [activeDetailCity, lang]
  );
  const activeDetailClock = getDestinationLocalTime(
    detailCityIndex === 0 && liveWeather.data?.utcOffsetHours !== undefined
      ? liveWeather.data.utcOffsetHours
      : activeDetailIntel.utcOffsetHours,
    lang
  );

  const formatTimeDiffLabel = (offsetHours: number) => {
    const localDeviceOffset = -new Date().getTimezoneOffset() / 60;
    const diff = Math.round((offsetHours - localDeviceOffset) * 10) / 10;
    if (Math.abs(diff) < 0.05) return t('與本機同時區', '与本机同时区', 'Same as device');
    const absStr = Number.isInteger(diff) ? String(Math.abs(diff)) : Math.abs(diff).toFixed(1);
    return diff > 0
      ? t(`比本機快 ${absStr} 小時`, `比本机快 ${absStr} 小时`, `+${absStr}h ahead`)
      : t(`比本機慢 ${absStr} 小時`, `比本机慢 ${absStr} 小时`, `${absStr}h behind`);
  };

  const openDestDetail = () => {
    tactileAudio.playClick(520, 0.035);
    setDetailCityIndex(0);
    setShowDestDetailModal(true);
  };

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
    onShowToast(
      t(
        `已清除 ${removedIds.length} 個已完成項目`,
        `已清除 ${removedIds.length} 个已完成项目`,
        `Cleared ${removedIds.length} completed item(s)`
      )
    );
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_DOC_BYTES) {
      onShowToast(
        t('單一檔案上限為 20MB', '单个文件上限为 20MB', 'Max file size is 20MB'),
        'error'
      );
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
            'X-App-Lang': lang,
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
            reader.onerror = () => reject(new Error(t('讀取檔案失敗', '读取文件失败', 'Failed to read file')));
            reader.readAsDataURL(pendingFile);
          });
        } else {
          throw new Error(
            t(
              '請先登入雲端帳號，即可跨裝置同步 20MB 大型文件',
              '请先登录云端账号，即可跨设备同步 20MB 大型文件',
              'Sign in to sync large files up to 20MB across devices'
            )
          );
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
        createdAt: new Date().toLocaleDateString(localeTag),
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
      onShowToast(
        cloudFileId
          ? t('已儲存並同步文件至所有裝置', '已保存并同步文件至所有设备', 'File saved & synced across devices')
          : t('已儲存文件', '已保存文件', 'File saved'),
        'success'
      );
    } catch (err) {
      onShowToast(
        err instanceof Error ? err.message : t('檔案上傳失敗', '文件上传失败', 'File upload failed'),
        'error'
      );
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
    onShowToast(t('已更新文件資訊', '已更新文件信息', 'Document details updated'), 'success');
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
    onShowToast(t('已移除文件', '已移除文件', 'Document removed'));
    setDeleteDocTarget(null);
  };

  const renderDestinationCard = (compact = false) => (
    <div
      role="button"
      tabIndex={0}
      onClick={openDestDetail}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openDestDetail();
        }
      }}
      className={`ink-card rounded-3xl flex flex-col justify-between text-left cursor-pointer hover:brightness-[1.03] active:scale-[0.99] transition-all focus:outline-none focus:ring-2 focus:ring-sky-400/60 ${
        compact ? 'p-3.5 sm:p-5 gap-2.5 sm:gap-4 h-full' : 'p-5 sm:p-6 gap-5'
      }`}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <div className="text-[11px] sm:text-xs text-zinc-400 truncate">
            {intel.countryLabel} · {intel.timezoneLabel}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <h2 className={`${compact ? 'text-lg sm:text-2xl' : 'text-2xl'} font-display font-bold text-white truncate`}>
              {intel.displayCity}
            </h2>
            <ChevronRightIcon className="w-4 h-4 text-zinc-400 shrink-0" />
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowWeatherModal(true);
          }}
          className={`${compact ? 'min-h-[34px] px-3' : 'min-h-[40px] px-4'} rounded-full bg-white/10 hover:bg-white/18 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0`}
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
              <span>{t('即時天氣', '实时天气', 'Weather')}</span>
            </>
          )}
        </button>
      </div>

      <div className={`grid grid-cols-3 gap-2 sm:gap-3 ${compact ? 'pt-2.5 sm:pt-3.5' : 'pt-4'} border-t border-white/10 text-xs`}>
        <div>
          <div className="text-zinc-400 flex items-center gap-1 mb-0.5 text-[11px]">
            <ClockIcon className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{t('當地時間', '当地时间', 'Time')}</span>
          </div>
          <div className={`font-num font-semibold ${compact ? 'text-sm sm:text-base' : 'text-base'} text-white`}>
            {localClock.timeStr}
          </div>
        </div>
        <div>
          <div className="text-zinc-400 flex items-center gap-1 mb-0.5 text-[11px]">
            <BoltIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">{t('插座電壓', '插座电压', 'Plug')}</span>
          </div>
          <div className="font-semibold text-[11px] sm:text-sm text-white truncate">{intel.voltagePlug}</div>
        </div>
        <div>
          <div className="text-zinc-400 mb-0.5 text-[11px] flex items-center justify-between gap-1">
            <span className="truncate">{t('完整資訊', '完整信息', 'Details')}</span>
          </div>
          <div className="font-num font-semibold text-[11px] sm:text-sm text-emerald-300 truncate">
            {t('查看詳情 ›', '查看详情 ›', 'Inspect ›')}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div data-scroll-lock className="h-full min-h-0 flex flex-col relative bg-transparent overflow-clip">
      <div
        className={
          section === 'TOOLS'
            ? 'flex-1 min-h-0 overflow-hidden px-4 sm:px-8 pt-2 pb-4 lg:pb-8 flex flex-col'
            : 'flex-1 min-h-0 overflow-y-auto no-scrollbar px-5 sm:px-8 pt-3 pb-6 lg:pb-10'
        }
      >
        <div
          className={
            section === 'TOOLS'
              ? 'max-w-5xl lg:max-w-6xl mx-auto w-full flex-1 min-h-0 flex flex-col gap-2.5 sm:gap-4'
              : 'max-w-5xl lg:max-w-6xl mx-auto space-y-5'
          }
        >
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
                { id: 'LISTS', label: t('旅行清單', '旅行清单', 'Checklists'), badge: items.length, accentFrom: '#0E9F76', accentTo: '#14B8A6' },
                { id: 'TOOLS', label: t('工具', '工具', 'Tools'), accentFrom: '#0284C7', accentTo: '#0E9F76' },
                { id: 'DOCS', label: t('文件', '文件', 'Docs'), badge: documents.length, accentFrom: '#059669', accentTo: '#2DD4BF' },
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
                        label: t('行李', '行李', 'Packing'),
                        icon: <SuitcaseIcon className="w-3.5 h-3.5" />,
                        badge: packingTabCount,
                        accentFrom: '#0E9F76',
                        accentTo: '#10B981',
                      },
                      {
                        id: 'SHOPPING',
                        label: t('購物', '购物', 'Shopping'),
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
                      {t('清除已完成', '清除已完成', 'Clear Done')} ({completedCount})
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
                    placeholder={
                      listMode === 'PACKING'
                        ? t('新增行李物品...', '添加行李物品...', 'Add packing item...')
                        : t('新增購物項目...', '添加购物项目...', 'Add shopping item...')
                    }
                    className="flex-1 min-h-[46px] px-4 rounded-2xl surface-elevated text-sm font-medium text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[var(--tab-accent)]/30"
                  />
                  <button
                    type="submit"
                    disabled={!newItemText.trim()}
                    aria-label={t('新增項目', '添加项目', 'Add item')}
                    className="min-w-[46px] min-h-[46px] px-4 rounded-2xl bg-[var(--tab-accent)] hover:bg-[var(--tab-accent-hover)] text-white font-semibold text-sm flex items-center justify-center gap-1.5 disabled:opacity-35 active:scale-95 transition-all cursor-pointer shrink-0 shadow-sm"
                  >
                    <PlusIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">{t('新增', '添加', 'Add')}</span>
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
                      {listMode === 'PACKING'
                        ? t('尚未新增項目', '尚未添加项目', 'No packing items yet')
                        : t('尚未建立購物項目', '尚未创建购物项目', 'No shopping items yet')}
                    </p>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500">
                      {t('上方輸入框可自由新增', '上方输入框可自由添加', 'Add items above anytime')}
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
                    <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                      {t('清單完成概覽', '清单完成概览', 'Checklist Progress')}
                    </span>
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
                      <div className="text-zinc-500 dark:text-zinc-400">
                        {t('行李準備', '行李准备', 'Packing')}
                      </div>
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
                      <div className="text-zinc-500 dark:text-zinc-400">
                        {t('購物願望', '购物清单', 'Shopping')}
                      </div>
                      <div className="font-num font-bold text-lg text-zinc-900 dark:text-white mt-0.5">
                        {items.filter((i) => i.category === 'shopping' && i.checked).length} / {shoppingTabCount}
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 2: TOOLS BENTO WIDGETS (Zero-scroll full-viewport layout) */}
          {section === 'TOOLS' && (
            <div className="flex-1 min-h-0 grid grid-cols-4 lg:grid-cols-12 lg:grid-rows-3 gap-2.5 sm:gap-3.5 content-start lg:content-stretch">
              {/* 1. Large Hero Bento (4 cols mobile / 6x2 desktop): Destination Time, Weather & Plug */}
              <div className="col-span-4 lg:col-span-6 lg:row-span-2 min-h-0">
                {renderDestinationCard(true)}
              </div>

              {/* 2. Medium Bento: 7-Day Weather */}
              <button
                type="button"
                onClick={() => setShowWeatherModal(true)}
                className="col-span-2 lg:col-span-3 surface-pastel-mint rounded-[22px] sm:rounded-3xl p-3 sm:p-4 flex flex-col justify-between text-left hover:brightness-[0.98] active:scale-[0.98] transition-all cursor-pointer min-h-[76px] sm:min-h-[96px]"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="w-8 h-8 rounded-xl bg-[var(--tab-accent-soft)] flex items-center justify-center shrink-0">
                    {liveWeather.data ? (
                      <WeatherGlyph
                        kind={liveWeather.data.current.kind}
                        isDay={liveWeather.data.current.isDay}
                        className="w-4 h-4"
                      />
                    ) : (
                      <SunIcon className="w-4 h-4 text-[var(--tab-accent)]" />
                    )}
                  </div>
                  <ArrowUpRightIcon className="w-3.5 h-3.5 text-zinc-400" />
                </div>
                <div className="mt-1.5">
                  <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                    {t('7 日天氣', '7 日天气', '7-Day Weather')}
                  </div>
                  <div className="text-[11px] font-num text-zinc-500 dark:text-zinc-400 truncate">
                    {liveWeather.data?.daily?.[0]
                      ? `${liveWeather.data.daily[0].tempMax}° / ${liveWeather.data.daily[0].tempMin}°`
                      : t('即時預報', '实时预报', 'Forecast')}
                  </div>
                </div>
              </button>

              {/* 3. Medium Bento: Google Maps */}
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodedDest}`}
                target="_blank"
                rel="noopener noreferrer"
                className="col-span-2 lg:col-span-3 surface-pastel-sky rounded-[22px] sm:rounded-3xl p-3 sm:p-4 flex flex-col justify-between hover:brightness-[0.98] active:scale-[0.98] transition-all min-h-[76px] sm:min-h-[96px]"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="w-8 h-8 rounded-xl bg-sky-500/15 flex items-center justify-center shrink-0">
                    <MapIcon className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  </div>
                  <ArrowUpRightIcon className="w-3.5 h-3.5 text-zinc-400" />
                </div>
                <div className="mt-1.5">
                  <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                    {t('Google 地圖', 'Google 地图', 'Google Maps')}
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                    {intel.displayCity}
                  </div>
                </div>
              </a>

              {/* 4. Medium Bento: Local Translate */}
              <a
                href={`https://translate.google.com/?sl=auto&tl=${encodeURIComponent(translateSpec.tl)}&op=translate`}
                target="_blank"
                rel="noopener noreferrer"
                className="col-span-2 lg:col-span-3 surface-elevated rounded-[22px] sm:rounded-3xl p-3 sm:p-4 flex flex-col justify-between hover:brightness-[0.98] active:scale-[0.98] transition-all min-h-[76px] sm:min-h-[96px]"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="w-8 h-8 rounded-xl bg-violet-500/12 flex items-center justify-center shrink-0">
                    <TranslateIcon className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  <ArrowUpRightIcon className="w-3.5 h-3.5 text-zinc-400" />
                </div>
                <div className="mt-1.5">
                  <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                    {t('即時翻譯', '实时翻译', 'Translate')}
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                    {translateSpec.label}
                  </div>
                </div>
              </a>

              {/* 5. Medium Bento: Tax-Free & Currency */}
              <button
                type="button"
                onClick={openDestDetail}
                className="col-span-2 lg:col-span-3 surface-pastel-peach rounded-[22px] sm:rounded-3xl p-3 sm:p-4 flex flex-col justify-between text-left hover:brightness-[0.98] active:scale-[0.98] transition-all cursor-pointer min-h-[76px] sm:min-h-[96px]"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                    <TagIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <span className="text-[11px] font-num font-bold text-amber-700 dark:text-amber-300">
                    {intel.currency}
                  </span>
                </div>
                <div className="mt-1.5">
                  <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                    {t('退稅・幣別', '退税・币别', 'Tax-Free')}
                  </div>
                  <div className="text-[11px] font-num text-zinc-500 dark:text-zinc-400 truncate">
                    {intel.taxFreeThreshold === null
                      ? t('無退稅制度', '无退税制度', 'No tax refund')
                      : intel.taxFreeThreshold === 0
                        ? t('不限金額可退稅', '不限金额可退税', 'No min spend')
                        : t(
                            `滿 ${intel.currencySymbol}${intel.taxFreeThreshold.toLocaleString()}`,
                            `满 ${intel.currencySymbol}${intel.taxFreeThreshold.toLocaleString()}`,
                            `Min ${intel.currencySymbol}${intel.taxFreeThreshold.toLocaleString()}`
                          )}
                  </div>
                </div>
              </button>

              {/* 6. Medium-Wide Bottom Bento: Airport Hub */}
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  intel.airports[0]?.query || `${intel.cityQuery} airport`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="col-span-2 lg:col-span-5 surface-elevated rounded-[22px] sm:rounded-3xl p-3 sm:p-4 flex items-center justify-between gap-2 hover:brightness-[0.98] active:scale-[0.98] transition-all min-h-[68px]"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/12 flex items-center justify-center shrink-0">
                    <PlaneIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate font-num">
                      {intel.airports.length > 0
                        ? intel.airports.map((a) => a.code).slice(0, 2).join(' · ')
                        : t('機場交通', '机场交通', 'Airport')}
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                      {intel.airports[0]?.name || intel.displayCity}
                    </div>
                  </div>
                </div>
                <ArrowUpRightIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              </a>

              {/* 7. Compact Bottom Bento: Direct Emergency SOS Dial */}
              <a
                href={`tel:${primaryPhone}`}
                className="col-span-1 lg:col-span-4 surface-pastel-rose rounded-[22px] sm:rounded-3xl p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-1 hover:brightness-[0.98] active:scale-[0.98] transition-all min-h-[68px]"
              >
                <div className="flex items-center justify-between lg:justify-start lg:gap-2.5">
                  <span className="text-[10px] sm:text-xs font-extrabold tracking-wide text-rose-600 dark:text-rose-400">
                    SOS
                  </span>
                  <ArrowUpRightIcon className="w-3 h-3 text-rose-400 lg:hidden" />
                </div>
                <div className="lg:flex-1 lg:min-w-0">
                  <div className="font-num font-bold text-sm sm:text-base text-rose-700 dark:text-rose-300 leading-tight truncate">
                    {primaryPhone}
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                    {t('緊急撥號', '紧急拨号', 'Emergency')}
                  </div>
                </div>
                <ArrowUpRightIcon className="w-3.5 h-3.5 text-zinc-400 hidden lg:block shrink-0" />
              </a>

              {/* 8. Compact Bottom Bento: Local News */}
              <a
                href={`https://news.google.com/search?q=${searchCity}&${
                  lang === 'en'
                    ? 'hl=en-US&gl=US&ceid=US:en'
                    : lang === 'zh-CN'
                      ? 'hl=zh-CN&gl=CN&ceid=CN:zh-Hans'
                      : 'hl=zh-TW&gl=TW&ceid=TW:zh-Hant'
                }`}
                target="_blank"
                rel="noopener noreferrer"
                className="col-span-1 lg:col-span-3 surface-pastel-sky rounded-[22px] sm:rounded-3xl p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-1 hover:brightness-[0.98] active:scale-[0.98] transition-all min-h-[68px]"
              >
                <div className="flex items-center justify-between lg:justify-start">
                  <NewspaperIcon className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <ArrowUpRightIcon className="w-3 h-3 text-zinc-400 lg:hidden" />
                </div>
                <div className="lg:flex-1 lg:min-w-0 lg:px-2">
                  <div className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-tight truncate">
                    {t('資訊', '资讯', 'News')}
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                    {t('當地快訊', '当地快讯', 'Local')}
                  </div>
                </div>
                <ArrowUpRightIcon className="w-3.5 h-3.5 text-zinc-400 hidden lg:block shrink-0" />
              </a>
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
                      {t('行程文件', '行程文件', 'Documents')} ({documents.length})
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
                      <span>{t('上傳', '上传', 'Upload')}</span>
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
                      {t('上傳圖片或 PDF（上限 20MB）', '上传图片或 PDF（上限 20MB）', 'Upload image or PDF (max 20MB)')}
                    </span>
                  </button>
                ) : (
                  <div className="space-y-2">
                    <AnimatePresence initial={false}>
                      {documents.map((doc) => {
                        const isImg = isDocImage(doc);
                        const cat = docCategoryMeta[doc.docCategory || 'other'];
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
                              aria-label={t('刪除文件', '删除文件', 'Delete document')}
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
        title={t('填寫文件資訊', '填写文件信息', 'Document Details')}
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
                {t('文件名稱', '文件名称', 'Document Name')}
              </label>
              <input
                type="text"
                required
                value={docTitleDraft}
                onChange={(e) => setDocTitleDraft(e.target.value)}
                placeholder={t('例如：去程電子機票、環球影城門票', '例如：去程电子机票、环球影城门票', 'e.g., E-ticket, Park Pass')}
                className="w-full h-11 px-3.5 rounded-2xl bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200/70 dark:border-white/10 text-sm font-semibold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--tab-accent)]/35"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1.5 block">
                {t('文件類型', '文件类型', 'Category')}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(Object.keys(docCategoryMeta) as DocumentCategory[]).map((catKey) => {
                  const meta = docCategoryMeta[catKey];
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
                {t('備註資訊（選填）', '备注信息（选填）', 'Notes (Optional)')}
              </label>
              <input
                type="text"
                value={docNoteDraft}
                onChange={(e) => setDocNoteDraft(e.target.value)}
                placeholder={t('訂位代號、確認碼或備忘說明...', '预订编号、确认码或备忘说明...', 'Booking reference, confirmation code...')}
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
                {t('取消', '取消', 'Cancel')}
              </button>
              <button
                type="submit"
                disabled={isUploadingDoc || !docTitleDraft.trim()}
                className="flex-1 h-11 rounded-full bg-[var(--tab-accent)] hover:bg-[var(--tab-accent-hover)] text-white text-xs sm:text-sm font-semibold disabled:opacity-50 cursor-pointer"
              >
                {isUploadingDoc
                  ? t('上傳保存中...', '上传保存中...', 'Uploading...')
                  : t('確認上傳並儲存', '确认上传并保存', 'Upload & Save')}
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
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {t('正在從雲端載入文件...', '正在从云端加载文件...', 'Loading document from cloud...')}
                  </p>
                </div>
              ) : previewError || !resolvedPreviewUrl ? (
                <div className="py-10 px-6 text-center space-y-2">
                  <DocumentTextIcon className="w-10 h-10 text-zinc-400 mx-auto" />
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {previewError || t('無法載入預覽內容', '无法加载预览内容', 'Preview unavailable')}
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
                    {t('可點擊下方下載檢視', '可点击下方下载查看', 'Download below to view.')}
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-zinc-100/75 dark:bg-white/[0.04] border border-zinc-200/70 dark:border-white/10 p-3.5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1 block">
                    {t('文件名稱', '文件名称', 'Document Name')}
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
                    {t('文件類型', '文件类型', 'Category')}
                  </label>
                  <select
                    value={editCategoryDraft}
                    onChange={(e) => setEditCategoryDraft(e.target.value as DocumentCategory)}
                    className="w-full h-9 px-3 rounded-xl bg-white dark:bg-zinc-900/70 text-xs font-semibold text-zinc-900 dark:text-white focus:outline-none"
                  >
                    {(Object.keys(docCategoryMeta) as DocumentCategory[]).map((catKey) => (
                      <option key={catKey} value={catKey}>
                        {docCategoryMeta[catKey].label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1 block">
                  {t('備註資訊', '备注信息', 'Notes')}
                </label>
                <input
                  type="text"
                  value={editNoteDraft}
                  onChange={(e) => setEditNoteDraft(e.target.value)}
                  placeholder={t('補充訂位代號或說明...', '补充预订编号或说明...', 'Add reference or notes...')}
                  className="w-full h-9 px-3 rounded-xl bg-white dark:bg-zinc-900/70 text-xs text-zinc-900 dark:text-white focus:outline-none"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveDocMetadata}
                  className="h-8 px-4 rounded-full bg-[var(--tab-accent)] text-white text-xs font-semibold cursor-pointer"
                >
                  {t('更新文件資訊', '更新文件信息', 'Save Details')}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-num text-zinc-500 dark:text-zinc-400 truncate">
                {previewDoc.fileName || previewDoc.title}
                {previewDoc.fileSize ? ` · ${formatFileSize(previewDoc.fileSize)}` : ''}
              </span>
              <DownloadProgressButton
                variant="accent"
                disabled={!resolvedPreviewUrl}
                label={t('下載檔案', '下载文件', 'Download')}
                doneLabel={t('已下載', '已下载', 'Saved')}
                icon={<ArrowDownTrayIcon className="w-4 h-4" />}
                onDownload={() => {
                  if (!resolvedPreviewUrl) return;
                  const link = document.createElement('a');
                  link.href = resolvedPreviewUrl;
                  link.download = previewDoc.fileName || previewDoc.title;
                  link.target = '_blank';
                  link.rel = 'noopener noreferrer';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="rounded-full shrink-0"
              />
            </div>
          </div>
        )}
      </LiquidModal>

      {/* Complete Destination Intel Modal (Opened from Tools Hero Widget) */}
      <LiquidModal
        open={showDestDetailModal}
        onClose={() => setShowDestDetailModal(false)}
        bottomSheetOnMobile
        maxWidthClass="max-w-lg"
        title={
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[var(--tab-accent-soft)] text-[var(--tab-accent)] flex items-center justify-center shrink-0">
              <GlobeIcon className="w-4 h-4" />
            </div>
            <span>
              {activeDetailIntel.displayCity} · {activeDetailIntel.countryLabel}
            </span>
          </div>
        }
      >
        <div className="overflow-y-auto no-scrollbar space-y-3.5 pr-0.5 max-h-[75vh]">
          {detailCities.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {detailCities.map((c, idx) => {
                const subIntel = detectDestinationIntel(c, lang);
                const active = idx === detailCityIndex;
                return (
                  <button
                    key={`${c}-${idx}`}
                    type="button"
                    onClick={() => setDetailCityIndex(idx)}
                    className={`h-8 px-3 rounded-full text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-[var(--tab-accent)] text-white'
                        : 'bg-zinc-100 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-300'
                    }`}
                  >
                    {subIntel.displayCity}
                  </button>
                );
              })}
            </div>
          )}

          {/* Local Clock & Weather */}
          <div className="ink-card rounded-2xl p-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] text-zinc-400">
                {activeDetailIntel.timezoneLabel} ·{' '}
                {formatTimeDiffLabel(
                  detailCityIndex === 0 && liveWeather.data?.utcOffsetHours !== undefined
                    ? liveWeather.data.utcOffsetHours
                    : activeDetailIntel.utcOffsetHours
                )}
              </div>
              <div className="font-num font-bold text-2xl text-white mt-0.5">
                {activeDetailClock.timeStr}
              </div>
              <div className="text-[11px] text-zinc-400 font-num">{activeDetailClock.dateStr}</div>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowDestDetailModal(false);
                setShowWeatherModal(true);
              }}
              className="px-3.5 py-2 rounded-2xl bg-white/12 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shrink-0"
            >
              {detailCityIndex === 0 && liveWeather.data ? (
                <>
                  <WeatherGlyph
                    kind={liveWeather.data.current.kind}
                    isDay={liveWeather.data.current.isDay}
                    className="w-4 h-4"
                  />
                  <span className="font-num font-bold">{liveWeather.data.current.temp}°</span>
                  <span className="text-zinc-300">{liveWeather.data.current.label}</span>
                </>
              ) : (
                <>
                  <SunIcon className="w-4 h-4 text-amber-300" />
                  <span>{t('7 日天氣', '7 日天气', '7-Day Weather')}</span>
                </>
              )}
            </button>
          </div>

          {/* Power & Voltage */}
          <div className="rounded-2xl bg-zinc-100/80 dark:bg-white/[0.04] border border-zinc-200/70 dark:border-white/10 p-3.5 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              <BoltIcon className="w-4 h-4 text-emerald-500" />
              <span>{t('插座與電壓規格', '插座与电压规格', 'Power & Plug')}</span>
            </div>
            <div className="font-semibold text-sm text-zinc-900 dark:text-white">
              {activeDetailIntel.voltagePlug}
            </div>
          </div>

          {/* Currency & Tax-Free Policy */}
          <div className="rounded-2xl bg-zinc-100/80 dark:bg-white/[0.04] border border-zinc-200/70 dark:border-white/10 p-3.5 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                <TagIcon className="w-4 h-4 text-amber-500" />
                <span>{t('當地貨幣與退稅', '当地货币与退税', 'Currency & Tax-Free')}</span>
              </div>
              <span className="text-xs font-num font-bold text-zinc-900 dark:text-white">
                {activeDetailIntel.currency} · {activeDetailIntel.currencyName}
              </span>
            </div>
            <p className="text-xs text-zinc-700 dark:text-zinc-200 leading-relaxed">
              {activeDetailIntel.taxFreeNote ||
                t('此地區無常設旅客退稅門檻', '此地区无常设旅客退税门槛', 'No standard visitor tax-refund threshold')}
            </p>
          </div>

          {/* Emergency Contacts */}
          <div className="rounded-2xl bg-rose-500/8 dark:bg-rose-500/12 border border-rose-500/20 p-3.5 space-y-2">
            <div className="text-xs font-semibold text-rose-700 dark:text-rose-300">
              {t('緊急聯絡電話（點擊撥號）', '紧急联系电话（点击拨号）', 'Emergency Contacts (Tap to Dial)')}
            </div>
            <div className="flex flex-wrap gap-2">
              {activeDetailIntel.emergency.split('·').map((chunk, i) => {
                const phoneNum = chunk.match(/\d{3,4}/)?.[0] || primaryPhone;
                return (
                  <a
                    key={i}
                    href={`tel:${phoneNum}`}
                    className="px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900/80 border border-rose-500/25 text-xs font-num font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-500/10 transition-colors"
                  >
                    {chunk.trim()}
                  </a>
                );
              })}
            </div>
          </div>

          {/* Airports */}
          {activeDetailIntel.airports.length > 0 && (
            <div className="rounded-2xl bg-zinc-100/80 dark:bg-white/[0.04] border border-zinc-200/70 dark:border-white/10 p-3.5 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                <PlaneIcon className="w-4 h-4 text-indigo-500" />
                <span>{t('主要機場', '主要机场', 'Major Airports')}</span>
              </div>
              <div className="space-y-1.5">
                {activeDetailIntel.airports.map((ap) => (
                  <a
                    key={ap.code}
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ap.query)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white dark:bg-zinc-900/70 border border-zinc-200/70 dark:border-white/10 hover:border-indigo-400/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-num font-bold text-xs text-indigo-600 dark:text-indigo-400 shrink-0">
                        {ap.code}
                      </span>
                      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-100 truncate">
                        {ap.name}
                      </span>
                    </div>
                    <ArrowUpRightIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
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
        title={t('清除已完成項目？', '清除已完成项目？', 'Clear Completed Items?')}
        description={t(
          `將移除目前分頁中 ${completedCount} 個已勾選的項目。`,
          `将移除当前分页中 ${completedCount} 个已勾选的项目。`,
          `This will remove ${completedCount} checked item(s) from this tab.`
        )}
        confirmLabel={t('確認清除', '确认清除', 'Clear')}
        cancelLabel={t('取消', '取消', 'Cancel')}
        icon={<TrashIcon className="w-6 h-6" />}
        requireHold
      />

      <ConfirmSheet
        open={!!deleteDocTarget}
        onClose={() => setDeleteDocTarget(null)}
        onConfirm={handleConfirmDeleteDoc}
        title={t('刪除此文件？', '删除此文件？', 'Delete Document?')}
        description={t(
          `「${deleteDocTarget?.title || ''}」將永久移除並同步至其他裝置。`,
          `「${deleteDocTarget?.title || ''}」将永久移除并同步至其他设备。`,
          `"${deleteDocTarget?.title || ''}" will be permanently removed across all devices.`
        )}
        confirmLabel={t('確認刪除', '确认删除', 'Delete')}
        cancelLabel={t('取消', '取消', 'Cancel')}
        icon={<TrashIcon className="w-6 h-6" />}
        requireHold
      />
    </div>
  );
};

export default PrepToolboxTool;
