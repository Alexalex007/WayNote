import React, { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trip, DocumentItem } from '../types';
import { generateUniqueId } from '../shared/syncMerge';
import { detectDestinationIntel, getDestinationLocalTime } from '../shared/destinationIntel';
import { WeatherModal, WeatherGlyph, useLiveWeather } from './WeatherModal';
import { LiquidModal, ConfirmSheet } from './LiquidPrimitives';
import {
  MapIcon,
  SunIcon,
  NewspaperIcon,
  DocumentTextIcon,
  PhotoIcon,
  PlusIcon,
  TrashIcon,
  PaperClipIcon,
  ArrowUpRightIcon,
  BoltIcon,
  ClockIcon,
  TranslateIcon,
  DocumentDuplicateIcon,
  CheckIcon,
  ArrowDownTrayIcon,
} from './Icons';

interface Props {
  trip: Trip;
  onUpdateTrip: (trip: Trip) => void;
  onShowToast: (text: string, tone?: 'info' | 'success' | 'error') => void;
}

interface PhraseEntry {
  zh: string;
  local: string;
  pronunciation: string;
}

function getDestinationPhrases(countryLabel: string, city: string): { lang: string; phrases: PhraseEntry[] } {
  const c = `${countryLabel} ${city}`.toLowerCase();
  if (c.includes('日本') || c.includes('tokyo') || c.includes('osaka') || c.includes('kyoto') || c.includes('japan')) {
    return {
      lang: '日語',
      phrases: [
        { zh: '你好 / 不好意思', local: 'すみません', pronunciation: 'Su-mi-ma-sen' },
        { zh: '謝謝', local: 'ありがとうございます', pronunciation: 'A-ri-ga-tō go-zai-masu' },
        { zh: '請問多少錢？', local: 'いくらですか？', pronunciation: 'I-ku-ra de-su ka' },
        { zh: '洗手間在哪裡？', local: 'トイレはどこですか？', pronunciation: 'To-i-re wa do-ko de-su ka' },
        { zh: '可以免稅嗎？', local: '免税できますか？', pronunciation: 'Men-zei de-ki-ma-su ka' },
        { zh: '請給我結帳', local: 'お会計お願いします', pronunciation: 'O-kai-kei o-ne-gai-shi-masu' },
      ],
    };
  }
  if (c.includes('韓國') || c.includes('seoul') || c.includes('busan') || c.includes('korea')) {
    return {
      lang: '韓語',
      phrases: [
        { zh: '你好', local: '안녕하세요', pronunciation: 'An-nyeong-ha-se-yo' },
        { zh: '謝謝', local: '감사합니다', pronunciation: 'Gam-sa-ham-ni-da' },
        { zh: '請問多少錢？', local: '얼마예요?', pronunciation: 'Eol-ma-ye-yo' },
        { zh: '洗手間在哪裡？', local: '화장실 어디예요?', pronunciation: 'Hwa-jang-sil eo-di-ye-yo' },
        { zh: '請不要加辣', local: '안 맵게 해주세요', pronunciation: 'An maep-ge hae-ju-se-yo' },
        { zh: '請給我這個', local: '이거 주세요', pronunciation: 'I-geo ju-se-yo' },
      ],
    };
  }
  if (c.includes('泰國') || c.includes('bangkok') || c.includes('thailand')) {
    return {
      lang: '泰語',
      phrases: [
        { zh: '你好', local: 'สวัสดีครับ / ค่ะ', pronunciation: 'Sa-wat-dee khrap / kha' },
        { zh: '謝謝', local: 'ขอบคุณครับ / ค่ะ', pronunciation: 'Khop-khun khrap / kha' },
        { zh: '多少錢？', local: 'ราคาเท่าไหร่', pronunciation: 'Ra-kha thao-rai' },
        { zh: '洗手間在哪？', local: 'ห้องน้ำอยู่ที่ไหน', pronunciation: 'Hong-nam yu thi-nai' },
        { zh: '不要太辣', local: 'ไม่เผ็ดมาก', pronunciation: 'Mai phet mak' },
      ],
    };
  }
  if (c.includes('法國') || c.includes('paris') || c.includes('france')) {
    return {
      lang: '法語',
      phrases: [
        { zh: '你好', local: 'Bonjour', pronunciation: 'Bon-zhoor' },
        { zh: '謝謝', local: 'Merci beaucoup', pronunciation: 'Mehr-see boh-koo' },
        { zh: '不好意思', local: 'Excusez-moi', pronunciation: 'Ex-kyoo-zay mwah' },
        { zh: '洗手間在哪？', local: 'Où sont les toilettes ?', pronunciation: 'Oo sohn lay twa-let' },
        { zh: '請給我帳單', local: "L'addition, s'il vous plaît", pronunciation: 'La-dee-syon seel voo pleh' },
      ],
    };
  }
  return {
    lang: '英語',
    phrases: [
      { zh: '你好 / 不好意思', local: 'Excuse me', pronunciation: '常用禮貌開場' },
      { zh: '請問多少錢？', local: 'How much is this?', pronunciation: '詢問價格' },
      { zh: '洗手間在哪裡？', local: 'Where is the restroom?', pronunciation: '詢問洗手間' },
      { zh: '可以刷卡嗎？', local: 'Do you accept credit cards?', pronunciation: '付款確認' },
      { zh: '請幫我結帳', local: 'Check, please.', pronunciation: '餐廳結帳' },
    ],
  };
}

const ToolboxTool: React.FC<Props> = ({ trip, onUpdateTrip, onShowToast }) => {
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentItem | null>(null);
  const [showWeatherModal, setShowWeatherModal] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const phrasePack = useMemo(() => getDestinationPhrases(intel.countryLabel, primaryCity), [intel.countryLabel, primaryCity]);

  const searchCity = encodeURIComponent(primaryCity);
  const encodedDest = encodeURIComponent(trip.destination);

  const handleCopyPhrase = async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
      onShowToast('已複製短語', 'success');
    } catch {
      onShowToast('無法自動複製', 'error');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      onShowToast('檔案大小請勿超過 3MB', 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const newDoc: DocumentItem = {
        id: generateUniqueId('doc'),
        title: file.name,
        type: 'file',
        content: base64,
        createdAt: new Date().toLocaleDateString('zh-TW'),
        updatedAt: Date.now(),
      };

      const now = Date.now();
      onUpdateTrip({
        ...trip,
        documents: [newDoc, ...documents],
        updatedAt: now,
      });
      onShowToast('已上傳並同步文件', 'success');
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    const now = Date.now();
    const updated = documents.filter((d) => d.id !== deleteTarget.id);
    onUpdateTrip({
      ...trip,
      documents: updated,
      tombstones: { ...(trip.tombstones || {}), [deleteTarget.id]: now },
      updatedAt: now,
    });
    if (previewDoc?.id === deleteTarget.id) setPreviewDoc(null);
    onShowToast('已移除文件');
    setDeleteTarget(null);
  };

  const primaryPhone = intel.emergency.match(/\d{3,4}/)?.[0] || '112';

  return (
    <div className="h-full flex flex-col relative bg-transparent overflow-hidden">
      <div className="flex-1 overflow-y-auto no-scrollbar px-5 sm:px-8 pt-5 pb-28 lg:pb-10">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-display font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
              百寶箱
            </h1>
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {intel.displayCity} · {intel.countryLabel}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Column: Destination Essentials + Weather + Phrases */}
            <div className="lg:col-span-7 space-y-5">
              {/* Destination Snapshot Card */}
              <div className="ink-card rounded-3xl p-5 sm:p-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-zinc-400">
                      {intel.countryLabel} · {intel.timezoneLabel}
                    </div>
                    <h2 className="text-xl font-display font-bold text-white mt-0.5">
                      {intel.displayCity}
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowWeatherModal(true)}
                    className="min-h-[40px] px-3.5 rounded-full bg-white/10 hover:bg-white/18 text-white text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shrink-0"
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

                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-white/10 text-xs">
                  <div>
                    <div className="text-zinc-400 flex items-center gap-1 mb-0.5">
                      <ClockIcon className="w-3.5 h-3.5" />
                      <span>當地時間</span>
                    </div>
                    <div className="font-num font-semibold text-sm text-white">{localClock.timeStr}</div>
                  </div>
                  <div>
                    <div className="text-zinc-400 flex items-center gap-1 mb-0.5">
                      <BoltIcon className="w-3.5 h-3.5 text-blue-400" />
                      <span>插座電壓</span>
                    </div>
                    <div className="font-semibold text-xs text-white truncate">{intel.voltagePlug}</div>
                  </div>
                  <div>
                    <div className="text-zinc-400 mb-0.5">緊急聯絡</div>
                    <a href={`tel:${primaryPhone}`} className="font-num font-semibold text-xs text-blue-400 hover:underline block truncate">
                      {intel.emergency}
                    </a>
                  </div>
                </div>
              </div>

              {/* Practical External Tools (Real <a> links, zero window.open) */}
              <div className="grid grid-cols-3 gap-2.5">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodedDest}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="surface-card rounded-2xl p-4 flex flex-col gap-2 hover:bg-white dark:hover:bg-zinc-800/70 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <MapIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <ArrowUpRightIcon className="w-3.5 h-3.5 text-zinc-400" />
                  </div>
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Google 地圖</span>
                </a>

                <a
                  href={`https://news.google.com/search?q=${searchCity}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="surface-card rounded-2xl p-4 flex flex-col gap-2 hover:bg-white dark:hover:bg-zinc-800/70 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <NewspaperIcon className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
                    <ArrowUpRightIcon className="w-3.5 h-3.5 text-zinc-400" />
                  </div>
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">當地資訊</span>
                </a>

                <button
                  type="button"
                  onClick={() => setShowWeatherModal(true)}
                  className="surface-card rounded-2xl p-4 flex flex-col gap-2 text-left hover:bg-white dark:hover:bg-zinc-800/70 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between w-full">
                    <SunIcon className="w-5 h-5 text-amber-500" />
                    <ArrowUpRightIcon className="w-3.5 h-3.5 text-zinc-400" />
                  </div>
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">7 日天氣</span>
                </button>
              </div>

              {/* Survival Phrases Card */}
              <div className="surface-card rounded-3xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
                    <TranslateIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <h3 className="font-display font-bold text-sm">常用短語</h3>
                  </div>
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{phrasePack.lang}</span>
                </div>

                <div className="divide-y divide-zinc-200/70 dark:divide-white/[0.06]">
                  {phrasePack.phrases.map((p, idx) => (
                    <div key={p.zh} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">{p.zh}</div>
                        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{p.local}</div>
                        <div className="text-[11px] text-zinc-400 dark:text-zinc-500">{p.pronunciation}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyPhrase(p.local, idx)}
                        aria-label={`複製 ${p.local}`}
                        className="min-w-[36px] min-h-[36px] rounded-xl bg-zinc-100 dark:bg-white/[0.06] flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:text-blue-600 transition-colors cursor-pointer shrink-0"
                      >
                        {copiedIdx === idx ? (
                          <CheckIcon className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <DocumentDuplicateIcon className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: File Vault */}
            <div className="lg:col-span-5 surface-card rounded-3xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PaperClipIcon className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
                  <h3 className="font-display font-bold text-sm text-zinc-900 dark:text-zinc-100">
                    行程文件 ({documents.length})
                  </h3>
                </div>
                <div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*,.pdf"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="min-h-[38px] px-3.5 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
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
                  className="w-full py-10 px-4 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl flex flex-col items-center justify-center text-center gap-2 hover:border-zinc-500 transition-colors cursor-pointer"
                >
                  <DocumentTextIcon className="w-7 h-7 text-zinc-400" />
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    上傳機票、訂房或門票憑證（上限 3MB）
                  </span>
                </button>
              ) : (
                <div className="space-y-2">
                  <AnimatePresence initial={false}>
                    {documents.map((doc) => {
                      const isImage = doc.content.startsWith('data:image/');
                      return (
                        <motion.div
                          layout
                          key={doc.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          onClick={() => setPreviewDoc(doc)}
                          className="rounded-2xl p-3 bg-zinc-100/70 dark:bg-white/[0.04] border border-zinc-200/60 dark:border-white/[0.06] flex items-center justify-between gap-3 cursor-pointer hover:bg-zinc-200/50 dark:hover:bg-white/[0.08] transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200/70 dark:border-white/10 flex items-center justify-center shrink-0 text-zinc-700 dark:text-zinc-200">
                              {isImage ? <PhotoIcon className="w-5 h-5" /> : <DocumentTextIcon className="w-5 h-5" />}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                                {doc.title}
                              </p>
                              <p className="text-[11px] font-num text-zinc-500 dark:text-zinc-400">{doc.createdAt}</p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(doc);
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
          </div>
        </div>
      </div>

      {/* Document Preview Modal (Safe for both Images and PDFs) */}
      <LiquidModal
        open={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        title={previewDoc?.title}
        maxWidthClass="max-w-2xl"
      >
        {previewDoc && (
          <div className="space-y-4">
            <div className="flex-1 max-h-[65vh] overflow-auto rounded-2xl bg-zinc-100 dark:bg-zinc-950/60 flex items-center justify-center p-3">
              {previewDoc.content.startsWith('data:image/') ? (
                <img src={previewDoc.content} alt={previewDoc.title} className="max-w-full max-h-[60vh] object-contain rounded-xl" />
              ) : (
                <div className="py-12 px-6 text-center space-y-3">
                  <DocumentTextIcon className="w-12 h-12 text-zinc-400 mx-auto" />
                  <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{previewDoc.title}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">PDF / 文件檔案已安全保存，可點擊下方下載檢視</p>
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <a
                href={previewDoc.content}
                download={previewDoc.title}
                className="min-h-[42px] px-5 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold inline-flex items-center gap-2"
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
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="刪除此文件？"
        description={`「${deleteTarget?.title || ''}」將永久移除並同步至其他裝置。`}
        confirmLabel="確認刪除"
        icon={<TrashIcon className="w-6 h-6" />}
      />
    </div>
  );
};

export default ToolboxTool;
