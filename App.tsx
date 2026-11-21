import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';
import { Trip, Tab, TripType, Stop, Activity, ThemeMode, SyncDevice } from './types';
import { useTripSync, detectEditedSection, RemoteChangeNotification } from './hooks/useTripSync';
import { useCloudAccountSync } from './hooks/useCloudAccountSync';
import { fetchDestinationPhotoFast } from './hooks/useDestinationPhoto';
import { mergeTrips, generateSyncCode, normalizeSyncCode } from './shared/syncMerge';
import { detectDestinationIntel, getDestinationLocalTime } from './shared/destinationIntel';
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
} from './components/Icons';

const APP_VERSION = 'v6.0.0';

const CHANGELOG_DATA = [
  {
    version: 'v6.0.0',
    date: '2026-11-21',
    items: [
      '全新統一「晴空雲霧（日光）／宇宙星光（夜間）」全域雙背景架構與統一頂部狀態列色系，徹底解決 iPhone 動態島與電腦頂部橫向斷層',
      '背景內建低調 3D 向量地球儀：依目前檢視或編輯的城市自動旋轉聚焦國家與城市位置（例如東京即居中鎖定日本與東京座標）',
      '新增第 5 大核心分頁「探索口袋名單」：收藏必去景點、餐廳、咖啡館與購物清單，支援 AI 智慧推薦靈感及一鍵排入每日行程時間軸',
      '徹底修復進入行程頁面時底部 Dock「行程」按鈕偶發消失的顯示異常',
      '全新設計首頁旅程卡片視覺：大字距英文月份與日期排版搭配清晰目的地與天氣資訊，全站英數字升級乾淨幾何無襯線字體',
    ],
  },
  {
    version: 'v5.8.0',
    date: '2026-11-20',
    items: [
      '內建 AI 智能行程與路線規劃：自由輸入想去的地點、天數與步調，一鍵自動生成每日主題與完整時間軸並支援互動地圖預覽與套用',
      '全新 4 大分頁柔和主題色（行程珊瑚杏橘／開支霧藍靛／百寶箱尤加利薄荷／設定柔和紫丁香），全面適配日光與夜間模式',
      '底部 Dock、桌面側邊欄及全站所有切換按鈕升級滑動漸層動畫，切換分頁時指示膠囊於移動過程中呈現 A→B 漸變過渡',
      '平板橫向與桌機大螢幕優化：主頁、建立旅程、行程、開支、百寶箱與設定皆於寬螢幕啟用雙欄／多欄橫置排版，手機直式維持原樣',
      '主頁與建立旅程「探索靈感」擴充至 40 個全球熱門城市實景輪播，並加入預先載入與柔和淡入淡出（Crossfade）轉場動畫',
      '徹底修正 iPhone 頂部安全區域／動態島在日光與夜間模式下的白邊與色塊斷層，背景漸層與頂部狀態列無縫貼合',
    ],
  },
  {
    version: 'v5.7.1',
    date: '2026-11-20',
    items: [
      '消除首頁與行程卡在 iOS Safari / 滑動容器下的閃爍現象，同時完整保留高畫質城市攝影封面',
      '首頁有多趟旅程時自動將距離今天最近（進行中或最近出發）的旅程優先排在第一張與倒數首項',
      '修正「行程路線地圖」在新增多間酒店時無法向下滑動查看地圖與站點的問題，改為順暢整頁捲動並固定底部按鈕列',
      '升級跨裝置在線偵測與心跳機制（每 0.5 秒更新並支援離開頁面即時通知），另一台裝置退出時可於半秒內即時消失',
      '修正 iPhone 頂部安全區域／動態島周圍偶發顯示白底斷層的問題，確保頂部柔和漸層一路延展至螢幕最頂端',
      '平板橫向／直向檢視下，開啟編輯行程、開支或設定等任何彈窗時自動暫時收合側邊與底部 Dock 欄，關閉後自動恢復',
      '開支明細表針對設定「多人攤分」的項目於金額旁簡潔標註「人均」二字，一眼辨識分帳消費',
    ],
  },
  {
    version: 'v5.7.0',
    date: '2026-11-20',
    items: [
      '新增全域頂部「同步位置小泡泡」：雙裝置共同編輯時，於任一畫面頂端彈出與 Dock 同弧度設計的小氣泡，即時提示哪台裝置剛剛更新了哪個區域（不含敏感完整內容）',
      '修復主畫面目的地圖片快取判定邏輯，清除舊版無效快取並全面恢復清晰單張實景城市攝影展示',
      '精簡「百寶箱」為「旅行清單、工具、文件」三大資料夾：移除翻譯功能，並將當地資訊、即時時間、插座／緊急聯絡與天氣小工具集中移至「工具」分頁',
      '開支頁面將「總開支」與「預算追蹤」合併為同一張頂部財務總覽卡片，移除底部重複卡片，視覺焦點更集中俐落',
      '升級「住宿酒店設定」彈窗：支援鍵盤頂起與輸入框自動對焦捲動，移除多餘地址欄位（改以酒店名稱自動定位），並改為滑動／點選式日曆區間選擇入住與退房日期',
    ],
  },
  {
    version: 'v5.6.0',
    date: '2026-11-19',
    items: [
      '全面適配 iPhone 動態島／瀏海與平板、桌機等各螢幕比例：統一根層全滿版漸層畫布與 Safe Area 間距，消除頂部橫向色塊斷層（不加入任何模糊遮罩）',
      '升級目的地相片精準配對引擎 v3：過濾拼貼組合圖（如東京四格圖）並加強高畫質單張實景篩選，同時加入圖片載入記憶機制，徹底消除旅程卡片切頁閃爍',
      '精簡首頁旅程卡片視覺：移除旅程名稱與獨立「開啟」按鈕，只顯示日期、地點與即時天氣，並開放點擊整張卡片直接進入旅程',
      '行前開支不再需要填寫日期，並為每筆開支新增「多人攤分」人數設定，自動換算每人平均金額',
      '開支主頁「行前開支表」與「旅途消費表」精簡為最多顯示 4 筆項目與金額，點擊項目即可開啟完整明細視窗檢視詳情、編輯或刪除',
      '重新設計現代化分組式設定頁面，保留完整雲端登入、跨裝置同步、外觀主題與備份管理功能並提升可讀性',
    ],
  },
  {
    version: 'v5.5.2',
    date: '2026-11-19',
    items: [
      '首頁尚未點選城市或規劃旅程時預設不亮起任何城市標籤，並持續平滑輪播全球熱門城市攝影照片；點選或手動輸入目的地後即切換為該地實景',
      '修正各功能頁面（行程、開支、百寶箱、設定）頂部頁面標題定位邏輯，確保於所有螢幕比例下皆與左右按鈕等高且嚴格水平置中',
    ],
  },
  {
    version: 'v5.5.1',
    date: '2026-11-19',
    items: [
      '鎖定所有外層框架與分頁容器並加入焦點偏移自動復位機制，修正填寫行程後頂部功能鍵與整個頁面向上跑掉的問題',
      '修正全球城市相片與機場精準配對（例如「杭州」等中國及全球二線城市皆獨立抓取當地實景照片與機場代碼，不再誤配鄰近城市）',
      '首頁最底部倒數區塊改為顯示所有已建立旅程的獨立倒數進度卡片，第 2 趟及後續新增旅程皆可同步檢視倒數天數與當地時間',
    ],
  },
  {
    version: 'v5.5.0',
    date: '2026-11-19',
    items: [
      '建置支援 Google 與 Apple 登入的私人雲端帳號同步框架，登入後跨裝置即時同步且完全隔離個人資料',
      '還原純淨高畫質排版，移除主畫面與所有頁面全螢幕模糊背景照片，保留清晰封面卡片',
      '首頁移除多餘行程預覽卡片，改為底部正中「新旅程」按鈕與最底部倒數日數卡片',
      '全面統一頂部導航列（返回／頁面標題／連線裝置數量），小標題高度與左右按鈕完全對齊，並防止內容被底部 Dock 列遮擋',
      '「清單百寶箱」正式更名為「百寶箱」，移除預設行李項目與範本提示，讓用戶自由新增',
      '開支頁移除分帳人數設定，並於總花費下方無省略並排顯示「行前開支」與「旅途消費」',
      '新增住宿酒店管理，路線圖預設大眾運輸（鐵路優先）並把駕車移至最後，支援由酒店、所在城市機場（含多機場選擇）或上一站出發',
      '行程時間軸實時計算兩站間進度漸層連線，拖曳排序或套用路線後自動順延更新所有時間',
    ],
  },
  {
    version: 'v5.4.0',
    date: '2026-11-19',
    items: [
      '路線導航全面升級為內嵌互動式 Google 地圖，支援標記編號、路線繪製與即時拖曳改序',
      '行程主頁日期膠囊置中並移除小圓點，工具列簡化為「路線」與「解鎖拖拽」自由拖曳排序',
      '修復並全尺寸還原所有分頁頂部導航列（返回 / 行程名稱 / 即時連線裝置數量），並優化多裝置連線偵測',
      '移除頁面頂部多餘虛化遮罩，並於行程工作區保留柔和目的地攝影背景與加快相片快取載入',
      '首頁加入圓環狀行程倒數進度條，設定頁面全面重構為雙欄 / 四欄 Widget 小工具介面',
      '底部導航列改為貼合 iPhone 螢幕弧度的同心圓角比例，開支頁將行前與旅途明細表置於總額下方並於記一筆內自由切換類型',
    ],
  },
  {
    version: 'v5.3.0',
    date: '2026-11-19',
    items: [
      '新增內建雙向互動日曆，支援點選與按住拖曳出發至回程日期',
      '修復新增旅程天數快捷按鈕與日期計算時區偏移問題',
      '全新重構行程時間軸（連接節點視覺），並修復「+」按鈕切換跳動',
      '首頁支援多旅程卡片輪播與下方「Plan」行程預覽（進行中 / 即將出發 / 已結束）',
      '合併「旅行清單」與「百寶箱」為單一功能區，並重製 Waynote 品牌圖示',
      '開支頁面明確拆分為「行前開支表」與「旅途消費表」，底部新增統一總花費彙總',
      '升級柔粉多色系日光質感與深色主題邏輯（跟隨系統 / 日光 / 夜間）',
    ],
  },
  {
    version: 'v5.2.0',
    date: '2026-11-18',
    items: [
      '全域目的地自動配對真實城市攝影封面背景',
      '開支總覽整合每日花費直方圖與人均分攤計算',
      '百寶箱新增目的地常用短語一鍵複製與行程文件安全預覽',
    ],
  },
  {
    version: 'v5.1.0',
    date: '2026-11-17',
    items: [
      '自動識別目的地幣別、免稅門檻、時區與插座規格',
      '整合即時氣象與 7 日預報、跨裝置 WebSocket 即時雙向同步',
    ],
  },
];

const QUICK_CITIES = ['東京', '大阪', '首爾', '曼谷', '台北', '香港', '巴黎', '倫敦'];
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
    fromLight: '#0D9488',
    toLight: '#06B6D4',
    fromDark: '#14B8A6',
    toDark: '#22D3EE',
    shadowLight: '0 8px 20px -6px rgba(13, 148, 136, 0.5)',
    shadowDark: '0 8px 22px -6px rgba(34, 211, 238, 0.45)',
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

function computeTripCountdown(trip: Trip, todayIso: string) {
  const intel = detectDestinationIntel(trip.destination);
  const span = getDaySpanUtc(trip.startDate, trip.endDate);
  const status = getTripStatus(trip, todayIso);
  let statusText = '已規劃';
  let dayBadge = span ? `${span.days} 天旅程` : '行程';
  let countdownValue = '0';
  let countdownUnit = '天';
  let countdownLabel = '已結束';
  let countdownProgress = 1;

  if (status === 'UPCOMING') {
    const diff = Math.max(
      1,
      Math.round((Date.parse(`${trip.startDate}T00:00:00Z`) - Date.parse(`${todayIso}T00:00:00Z`)) / 86400000)
    );
    statusText = `${diff} 天後出發`;
    countdownValue = `${diff}`;
    countdownUnit = '天';
    countdownLabel = '距離出發';
    countdownProgress = Math.max(0.1, Math.min(1, 1 - diff / Math.max(60, diff)));
  } else if (status === 'ACTIVE') {
    statusText = '進行中';
    const elapsed = Math.max(
      0,
      Math.round((Date.parse(`${todayIso}T00:00:00Z`) - Date.parse(`${trip.startDate}T00:00:00Z`)) / 86400000)
    );
    const totalD = span?.days || 1;
    const currentD = Math.min(elapsed + 1, totalD);
    dayBadge = `Day ${currentD} of ${totalD}`;
    countdownValue = `D${currentD}`;
    countdownUnit = `/${totalD}`;
    countdownLabel = '旅程進行中';
    countdownProgress = Math.max(0.12, Math.min(1, currentD / totalD));
  } else {
    statusText = '已結束';
    countdownValue = `${span?.days || 1}`;
    countdownUnit = '天';
    countdownLabel = '旅程完成';
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

const HomeTripWeatherPill: React.FC<{
  city: string;
  tripId: string;
  onOpenWeather: (tripId: string) => void;
}> = React.memo(({ city, tripId, onOpenWeather }) => {
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
          <span>天氣</span>
        </>
      )}
    </button>
  );
});

HomeTripWeatherPill.displayName = 'HomeTripWeatherPill';

const MONTH_NAMES_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function formatHomeCardDateParts(isoDate: string): { day: string; month: string } {
  const parts = (isoDate || '').split('-');
  const monthIdx = Math.max(0, Math.min(11, parseInt(parts[1] || '1', 10) - 1));
  const dayNum = parseInt(parts[2] || '1', 10) || 1;
  return {
    day: String(dayNum),
    month: MONTH_NAMES_EN[monthIdx] || 'January',
  };
}

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
        isHidden ? 'lg:hidden' : 'lg:flex'
      } w-64 shrink-0 flex-col justify-between pl-[max(1rem,env(safe-area-inset-left))] pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] pr-0 z-20`}
    >
      <div className="surface-elevated rounded-3xl h-full flex flex-col justify-between p-4">
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-zinc-200/70 dark:border-white/[0.08]">
            <button
              type="button"
              onClick={onGoHome}
              className="flex items-center gap-2.5 text-left group cursor-pointer min-w-0"
            >
              <div
                className="w-9 h-9 rounded-xl text-white flex items-center justify-center shrink-0 shadow-sm transition-colors duration-300"
                style={{ background: `linear-gradient(135deg, ${navCurrentFrom}, ${navCurrentTo})` }}
              >
                <WaynoteLogoIcon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-zinc-400">Waynote</div>
                <div className="text-sm font-bold text-zinc-900 dark:text-white truncate">
                  {tripData.name}
                </div>
              </div>
            </button>
          </div>

          <div className="px-1 space-y-0.5">
            <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
              {tripData.destination}
            </div>
            <div className="text-[11px] font-num text-zinc-500 dark:text-zinc-400">
              {tripData.startDate} ~ {tripData.endDate}
            </div>
          </div>

          <nav ref={navRef} className="relative space-y-1">
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
                className="absolute inset-x-0 top-0 rounded-xl pointer-events-none z-0"
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
                  onClick={() => onSelectTab(item.id)}
                  style={
                    !thumb && isActive
                      ? {
                          background: `linear-gradient(135deg, ${navCurrentFrom}, ${navCurrentTo})`,
                          boxShadow: navCurrentShadow,
                        }
                      : undefined
                  }
                  className={`relative z-10 w-full min-h-[42px] px-3.5 rounded-xl flex items-center gap-3 font-semibold text-sm transition-colors duration-200 cursor-pointer ${
                    isActive
                      ? 'text-white'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-900/5 dark:hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <button
          type="button"
          onClick={onOpenSyncHub}
          className="w-full p-3.5 rounded-2xl bg-zinc-100/90 dark:bg-white/[0.04] border border-zinc-200/70 dark:border-white/[0.08] text-left hover:bg-zinc-200/60 dark:hover:bg-white/[0.08] transition-colors cursor-pointer space-y-1.5"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900 dark:text-white">
              <span className={`w-2 h-2 rounded-full ${syncBadge.dotClass}`} />
              <span>{syncBadge.text}</span>
            </div>
            <QrCodeIcon className="w-4 h-4 text-[var(--tab-accent)] transition-colors" />
          </div>
          <div className="flex items-center justify-between text-[11px] font-num text-zinc-500 dark:text-zinc-400">
            <span>{tripData.syncId}</span>
            <span>同步設定 →</span>
          </div>
        </button>
      </div>
    </aside>
  );
};

const WorkspaceDock: React.FC<WorkspaceNavSharedProps> = ({
  navItems,
  activeTab,
  activeNavIndex,
  navCurrentFrom,
  navCurrentTo,
  navCurrentShadow,
  navGradCycle,
  onSelectTab,
  isHidden,
}) => {
  const navRef = useRef<HTMLElement | null>(null);
  const btnRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [thumb, setThumb] = useState<{ left: number; width: number; top: number; height: number } | null>(null);

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

  return (
    <div
      aria-hidden={isHidden}
      className={`${
        isHidden ? 'hidden' : 'lg:hidden fixed'
      } bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 right-3 z-40 pointer-events-none flex justify-center`}
    >
      <nav
        ref={navRef}
        aria-label="主導航列"
        className="pointer-events-auto surface-dock relative w-full max-w-md h-[62px] rounded-[30px] p-1.5 grid grid-cols-5 items-center gap-0.5"
      >
        {thumb && (
          <motion.div
            aria-hidden="true"
            initial={false}
            animate={{
              x: thumb.left,
              width: thumb.width,
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
              x: { type: 'spring', stiffness: 450, damping: 34, mass: 0.82 },
              width: { type: 'spring', stiffness: 450, damping: 34, mass: 0.82 },
              backgroundImage: { duration: 0.45, ease: 'easeInOut' },
            }}
            style={{
              top: thumb.top,
              height: thumb.height,
            }}
            className="absolute left-0 rounded-[24px] pointer-events-none z-0"
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
              onClick={() => onSelectTab(item.id)}
              aria-label={item.label}
              style={
                !thumb && isActive
                  ? {
                      background: `linear-gradient(135deg, ${navCurrentFrom}, ${navCurrentTo})`,
                      boxShadow: navCurrentShadow,
                    }
                  : undefined
              }
              className={`relative z-10 h-full min-w-0 px-1 rounded-[24px] flex flex-col items-center justify-center gap-0.5 transition-colors duration-200 cursor-pointer select-none ${
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
  const isAnyModalOpen = useAnyModalOpen();
  const [view, setView] = useState<'HOME' | 'CREATE' | 'TRIP'>('HOME');
  const [activeTab, setActiveTab] = useState<Tab>(Tab.ITINERARY);
  const [tripData, setTripData] = useState<Trip | null>(null);
  const [tripsList, setTripsList] = useState<Trip[]>([]);
  const [archivedTrips, setArchivedTrips] = useState<Trip[]>([]);
  const [selectedHomeTripId, setSelectedHomeTripId] = useState<string | null>(null);
  const [homeFilter, setHomeFilter] = useState<'ALL' | 'ACTIVE' | 'UPCOMING' | 'PAST'>('ALL');

  // UI Control State
  const [showHomeSettings, setShowHomeSettings] = useState(false);
  const [showArchivedList, setShowArchivedList] = useState(false);

  // Home quick sync join & weather modal
  const [homeSyncCode, setHomeSyncCode] = useState('');
  const [isHomeJoining, setIsHomeJoining] = useState(false);
  const [isHomeWeatherOpen, setIsHomeWeatherOpen] = useState(false);
  const [focusDateSignal, setFocusDateSignal] = useState<{ date: string; nonce: number } | null>(null);

  // Modals State
  const [isSyncHubOpen, setIsSyncHubOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isChangelogOpen, setIsChangelogOpen] = useState(false);
  const [isEditTripOpen, setIsEditTripOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

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

  // Unified static Safe-Area top tint per appearance mode (Sky-Blue #CFE4FC for Light / Cosmos #080D1B for Dark)
  const currentTopTint = isDarkResolved ? '#080D1B' : '#CFE4FC';

  useLayoutEffect(() => {
    const root = window.document.documentElement;
    if (isDarkResolved) {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
    root.removeAttribute('data-tab-theme');

    root.style.backgroundColor = currentTopTint;
    if (document.body) {
      document.body.style.backgroundColor = currentTopTint;
    }

    const schemeMeta =
      document.getElementById('waynote-color-scheme') ||
      document.querySelector('meta[name="color-scheme"]');
    if (schemeMeta) {
      schemeMeta.setAttribute('content', isDarkResolved ? 'dark' : 'light');
    }

    const appleBarMeta =
      document.getElementById('waynote-apple-bar') ||
      document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (appleBarMeta) {
      appleBarMeta.setAttribute('content', isDarkResolved ? 'black-translucent' : 'default');
    }

    const existingThemeMeta =
      document.getElementById('waynote-theme-color') ||
      document.querySelector('meta[name="theme-color"]');
    if (existingThemeMeta) {
      if (existingThemeMeta.getAttribute('content') !== currentTopTint) {
        const replacement = existingThemeMeta.cloneNode() as HTMLMetaElement;
        replacement.id = 'waynote-theme-color';
        replacement.name = 'theme-color';
        replacement.content = currentTopTint;
        existingThemeMeta.replaceWith(replacement);
      }
    } else {
      const created = document.createElement('meta');
      created.id = 'waynote-theme-color';
      created.name = 'theme-color';
      created.content = currentTopTint;
      document.head.appendChild(created);
    }

    localStorage.setItem(STORAGE_THEME_MODE_KEY, themeMode);
  }, [isDarkResolved, themeMode, currentTopTint]);

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
    showToast(next === 'light' ? '已切換：日光淺色' : next === 'dark' ? '已切換：夜幕深色' : '已切換：跟隨系統', 'info');
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
            deviceName: latestRemoteCloudDeviceRef.current || '另一台裝置',
            sectionLabel: diff.sectionLabel,
            targetTab: diff.targetTab,
          });
        }
        localStorage.setItem(STORAGE_ACTIVE_KEY, JSON.stringify(found));
        return found;
      });
    },
    [showSyncBubble]
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
          showToast(`已連線同步：${normalizedCode}`, 'success');
          const cleanUrl = `${window.location.pathname}${window.location.hash}`;
          window.history.replaceState({}, document.title, cleanUrl);
        })
        .catch((err) => {
          const message = err instanceof Error ? err.message : '無法加入同步旅程';
          showToast(message, 'error');
        });
    }
  }, [joinSyncTripByCode, showToast]);

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

    const countdown = computeTripCountdown(target, todayIso);
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
  }, [selectedHomeTrip, todayIso]);

  const homeCountdownList = useMemo(() => {
    const source = filteredHomeTrips.length > 0 ? filteredHomeTrips : sortedTripsList;
    return source.map((t) => ({
      trip: t,
      ...computeTripCountdown(t, todayIso),
    }));
  }, [filteredHomeTrips, sortedTripsList, todayIso]);

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
    return detectDestinationIntel(createPreviewCity);
  }, [createPreviewCity]);

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
      showToast(`已同步：${merged.name}`, 'success');
    },
    [joinSyncTripByCode, tripData, tripsList, persistTrips, showToast]
  );

  const handleHomeJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!homeSyncCode.trim()) return;
    setIsHomeJoining(true);
    try {
      await handleJoinByCode(homeSyncCode);
      setHomeSyncCode('');
    } catch (err) {
      const message = err instanceof Error ? err.message : '加入同步失敗';
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
    showToast(`已更新同步碼：${newCode}`, 'success');
  };

  // --- Share & Export ---
  const handleShare = async () => {
    const shareUrl = tripData?.syncId
      ? `${window.location.origin}${window.location.pathname}?sync=${encodeURIComponent(tripData.syncId)}`
      : window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: tripData ? `${tripData.name} · Waynote` : 'Waynote',
          text: tripData?.syncId
            ? `加入我的旅程「${tripData.name}」（同步碼：${tripData.syncId}）`
            : 'Waynote 旅程規劃',
          url: shareUrl,
        });
        return;
      } catch {
        // User cancelled
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast('已複製同步連結', 'success');
    } catch {
      showToast('請至同步中心複製代碼', 'info');
    }
  };

  const exportContent = useMemo(() => {
    if (!tripData) return '';

    let content = `${tripData.name}\n`;
    content += `目的地: ${tripData.destination}\n`;
    content += `日期: ${tripData.startDate} 至 ${tripData.endDate}\n`;
    if (tripData.syncId) {
      content += `同步碼: ${tripData.syncId}\n`;
    }
    content += `\n`;

    if (tripData.type === 'Multi' && tripData.stops) {
      content += `路線站點:\n`;
      tripData.stops.forEach((stop, idx) => {
        content += `${idx + 1}. ${stop.destination} (${stop.startDate} - ${stop.endDate})\n`;
      });
      content += `\n`;
    }

    content += `行程安排:\n`;
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

    content += `\n\n消費紀錄:\n`;
    (tripData.expenses || []).forEach((exp) => {
      const datePrefix = exp.date ? `${exp.date} | ` : '';
      const splitNote = exp.splitCount && exp.splitCount > 1 ? ` / ${exp.splitCount}人攤分` : '';
      content += `${datePrefix}[${exp.isPreTrip ? '行前' : '旅途'}] ${exp.title}: ${exp.currency} ${exp.amount}${splitNote} (${exp.category})\n`;
    });

    content += `\n\n清單:\n`;
    const unchecked = (tripData.packingList || []).filter((i) => !i.checked);
    const checked = (tripData.packingList || []).filter((i) => i.checked);

    if (unchecked.length > 0) {
      content += `\n[待準備]\n`;
      unchecked.forEach((item) => {
        content += `☐ ${item.name}\n`;
      });
    }
    if (checked.length > 0) {
      content += `\n[已完成]\n`;
      checked.forEach((item) => {
        content += `☑ ${item.name}\n`;
      });
    }

    return content;
  }, [tripData]);

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(exportContent);
      setCopySuccess(true);
      showToast('已複製文字', 'success');
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      showToast('複製失敗，請手動選取', 'error');
    }
  };

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
    showToast('已下載文字檔', 'success');
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
    showToast('已下載備份檔', 'success');
  };

  const handleImportJsonBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Trip;
        if (!parsed || !parsed.name || !parsed.startDate || !parsed.endDate) {
          showToast('無效的備份檔案', 'error');
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
        showToast(`已匯入：${restored.name}`, 'success');
      } catch {
        showToast('讀取檔案失敗', 'error');
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
        showToast('請完整填寫站點與日期', 'error');
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
        showToast('請完整填寫目的地與日期', 'error');
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
    showToast('已儲存旅程變更', 'success');
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
    showToast(cloudAuth.user ? '已從本機與雲端移除旅程' : '已從本機移除旅程', 'info');
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
    showToast('已封存旅程', 'success');
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
    showToast(`已載入：${normalized.name}`, 'success');
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

  const handleCreateTrip = (e: React.FormEvent) => {
    e.preventDefault();

    let finalDestination = '';
    let finalStart = '';
    let finalEnd = '';

    if (tripType === 'Single') {
      if (!singleDestination.trim() || !singleStartDate || !singleEndDate) {
        showToast('請填寫目的地與日期', 'error');
        return;
      }
      if (singleEndDate < singleStartDate) {
        showToast('結束日期不可早於出發日期', 'error');
        return;
      }
      finalDestination = singleDestination.trim();
      finalStart = singleStartDate;
      finalEnd = singleEndDate;
    } else {
      const validStops = stops.filter((s) => s.destination.trim());
      if (validStops.length === 0 || !validStops[0].startDate || !validStops[validStops.length - 1].endDate) {
        showToast('請完整填寫各站城市與日期', 'error');
        return;
      }
      finalDestination = validStops.map((s) => s.destination.trim()).join(' - ');
      finalStart = validStops[0].startDate;
      finalEnd = validStops[validStops.length - 1].endDate;
    }

    const now = Date.now();
    const firstCity = finalDestination.split(' - ')[0];
    const intel = detectDestinationIntel(firstCity);

    const newTrip: Trip = {
      id: now.toString(),
      syncId: generateSyncCode(),
      revision: 0,
      updatedAt: now,
      metaUpdatedAt: now,
      budgetUpdatedAt: now,
      name: tripName.trim() || `${firstCity} 旅程`,
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
    showToast(`已建立旅程（${intel.currency}）`, 'success');
  };

  const handleOpenTrip = (trip: Trip) => {
    const normalized = ensureSyncFields(trip);
    setTripData(normalized);
    setSelectedHomeTripId(normalized.id);
    localStorage.setItem(STORAGE_ACTIVE_KEY, JSON.stringify(normalized));
    setView('TRIP');
    setActiveTab(Tab.ITINERARY);
  };

  const syncBadge = useMemo(() => {
    if (syncStatus === 'connected') {
      return {
        dotClass: 'bg-emerald-500',
        text: effectiveDeviceCount > 1 ? `${effectiveDeviceCount} 裝置同步中` : '即時同步',
      };
    }
    if (cloudAuth.user && cloudAuth.cloudStatus === 'synced') {
      return {
        dotClass: 'bg-emerald-500',
        text: effectiveDeviceCount > 1 ? `${effectiveDeviceCount} 裝置雲端同步中` : '雲端即時同步',
      };
    }
    if (syncStatus === 'offline') {
      return { dotClass: 'bg-amber-500', text: '離線模式' };
    }
    if (syncStatus === 'connecting' || syncStatus === 'reconnecting' || cloudAuth.cloudStatus === 'connecting') {
      return { dotClass: 'bg-blue-500', text: '連線中' };
    }
    return { dotClass: 'bg-zinc-400', text: '同步待命' };
  }, [syncStatus, effectiveDeviceCount, cloudAuth.user, cloudAuth.cloudStatus]);

  // Unified 5-Tab Navigation
  const navItems: WorkspaceNavItem[] = useMemo(
    () => [
      { id: Tab.ITINERARY, themeKey: 'ITINERARY', label: '行程規劃', shortLabel: '行程', icon: GridIcon },
      { id: Tab.EXPLORE, themeKey: 'EXPLORE', label: '探索口袋名單', shortLabel: '探索', icon: CompassIcon },
      { id: Tab.EXPENSES, themeKey: 'EXPENSES', label: '開支預算', shortLabel: '開支', icon: WalletIcon },
      { id: Tab.TOOLBOX, themeKey: 'TOOLBOX', label: '百寶箱', shortLabel: '百寶箱', icon: SuitcaseIcon },
      { id: Tab.SETTINGS, themeKey: 'SETTINGS', label: '設定', shortLabel: '設定', icon: CogIcon },
    ],
    []
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

  const globeFocusCity = useMemo(() => {
    if (view === 'TRIP') {
      return tripData?.destination || selectedHomeTrip?.destination || '東京';
    }
    if (view === 'CREATE') {
      return createPreviewCity || rotatingShowcaseCity;
    }
    return selectedHomeTrip?.destination || exploreCity || rotatingShowcaseCity;
  }, [view, tripData?.destination, selectedHomeTrip?.destination, createPreviewCity, exploreCity, rotatingShowcaseCity]);

  const activePageTitle = useMemo(() => {
    switch (activeTab) {
      case Tab.EXPLORE:
        return '探索';
      case Tab.EXPENSES:
        return '開支';
      case Tab.TOOLBOX:
      case Tab.PACKING:
        return '百寶箱';
      case Tab.SETTINGS:
        return '設定';
      default:
        return '行程';
    }
  }, [activeTab]);

  const renderThemeIcon = () => {
    if (themeMode === 'system') return <ComputerDesktopIcon className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />;
    if (themeMode === 'dark') return <MoonIcon className="w-4 h-4 text-sky-300" />;
    return <SunIcon className="w-4 h-4 text-[#2563EB]" />;
  };

  const activeDurationDays = tripType === 'Single' ? singleSpan?.days : activeStopSpan?.days;

  return (
    <MotionConfig reducedMotion="user">
      <div
        data-scroll-lock
        className="fixed inset-0 w-full h-full overflow-clip app-canvas text-zinc-900 dark:text-zinc-100 select-none sm:select-auto"
      >
        <div
          aria-hidden="true"
          className="app-backdrop pointer-events-none z-0"
          style={{ backgroundColor: currentTopTint }}
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
              Google 地圖服務額度已達上限。請參考{' '}
              <a
                href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold"
              >
                配額設定說明
              </a>
              ，路線列表與外部 Google Maps 跳轉仍可正常使用。
            </p>
            <button
              type="button"
              onClick={() => setGmpQuotaExceeded(false)}
              className="px-2.5 py-1 rounded-full bg-amber-200/70 hover:bg-amber-200 text-amber-950 font-semibold shrink-0 cursor-pointer"
            >
              關閉
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
                {showHomeSettings && (
                  <div className="fixed inset-0 z-40" onClick={() => setShowHomeSettings(false)} />
                )}

                <div className="relative z-10 w-full max-w-xl md:max-w-2xl lg:max-w-5xl mx-auto pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 lg:px-8 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] flex-1 flex flex-col justify-between gap-6">
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
                        aria-label="帳號登入與雲端同步"
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
                              {cloudAuth.user.displayName || '已登入'}
                            </span>
                          </>
                        ) : (
                          <>
                            <UserCircleIcon className="w-4 h-4 text-[#2563EB] dark:text-sky-400 shrink-0" />
                            <span className="text-xs font-semibold">登入</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={cycleThemeMode}
                        aria-label="切換外觀主題"
                        title={themeMode === 'system' ? '跟隨系統' : themeMode === 'dark' ? '夜間模式' : '日光模式'}
                        className="surface-elevated w-10 h-10 rounded-full text-zinc-700 dark:text-zinc-200 flex items-center justify-center hover:bg-white dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                      >
                        {renderThemeIcon()}
                      </button>

                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => {
                            setShowHomeSettings(!showHomeSettings);
                            setShowArchivedList(false);
                          }}
                          aria-label="更多選項"
                          className="surface-elevated w-10 h-10 rounded-full text-zinc-700 dark:text-zinc-200 flex items-center justify-center hover:bg-white dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                        >
                          <CogIcon className="w-4 h-4" />
                        </button>

                        <AnimatePresence>
                          {showHomeSettings && (
                            <motion.div
                              initial={{ opacity: 0, y: -6, scale: 0.97 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -6, scale: 0.97 }}
                              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                              className="absolute right-0 mt-2.5 surface-elevated rounded-2xl w-64 z-50 overflow-hidden p-1.5"
                            >
                              <button
                                type="button"
                                onClick={() => importInputRef.current?.click()}
                                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer text-left"
                              >
                                <ArrowUpTrayIcon className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
                                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                  匯入 JSON 備份
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setShowArchivedList(!showArchivedList)}
                                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer text-left"
                              >
                                <div className="flex items-center gap-3">
                                  <ArchiveIcon className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
                                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                    已封存旅程 ({archivedTrips.length})
                                  </span>
                                </div>
                                <ChevronRightIcon
                                  className={`w-4 h-4 text-zinc-400 transition-transform ${
                                    showArchivedList ? 'rotate-90' : ''
                                  }`}
                                />
                              </button>

                              {showArchivedList && (
                                <div className="mt-1 pl-2 pr-1 pb-1 space-y-1 max-h-44 overflow-y-auto no-scrollbar border-t border-zinc-200/70 dark:border-white/10 pt-2">
                                  {archivedTrips.length === 0 ? (
                                    <p className="text-xs text-zinc-400 text-center py-2">暫無封存紀錄</p>
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
                                            {arch.destination} · {arch.startDate}
                                          </p>
                                        </div>
                                        <RefreshIcon className="w-4 h-4 text-zinc-400 group-hover:text-[#2563EB] dark:group-hover:text-sky-400 shrink-0" />
                                      </button>
                                    ))
                                  )}
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </header>

                  {/* Center Focal Content */}
                  <div className="my-auto space-y-5">
                    {tripsList.length > 0 && selectedHomeTrip && homeStats ? (
                      <>
                        {/* Planned Journeys Header & Filter Tabs */}
                        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
                          <div className="flex items-baseline justify-between gap-3">
                            <div className="flex items-baseline gap-2.5">
                              <h1 className="text-2xl sm:text-3xl font-display font-bold text-zinc-900 dark:text-white tracking-tight">
                                我的旅程
                              </h1>
                              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 tracking-wide">
                                Planned Journeys
                              </span>
                            </div>
                            <span className="text-xs font-num font-semibold text-zinc-500 dark:text-zinc-400">
                              共 {tripsList.length} 趟
                            </span>
                          </div>

                          <SlidingSegmentedControl
                            variant="underline"
                            size="sm"
                            value={homeFilter}
                            onChange={setHomeFilter}
                            options={[
                              { id: 'ALL', label: '全部', accentFrom: '#2563EB', accentTo: '#0EA5E9' },
                              { id: 'ACTIVE', label: '進行中', accentFrom: '#059669', accentTo: '#10B981' },
                              { id: 'UPCOMING', label: '即將出發', accentFrom: '#0D9488', accentTo: '#06B6D4' },
                              { id: 'PAST', label: '已結束', accentFrom: '#4F46E5', accentTo: '#818CF8' },
                            ]}
                          />
                        </div>

                        {/* Scenic Top-Typography Home Cards (IMG_7270 Reference: No trip name, no avatars, no dock) */}
                        {filteredHomeTrips.length === 0 ? (
                          <div className="surface-elevated rounded-3xl p-8 text-center space-y-3">
                            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">此分類尚無旅程</p>
                            <button
                              type="button"
                              onClick={() => setHomeFilter('ALL')}
                              className="text-xs font-semibold text-[#2563EB] dark:text-sky-400 cursor-pointer"
                            >
                              顯示全部旅程
                            </button>
                          </div>
                        ) : (
                          <div
                            className={
                              filteredHomeTrips.length > 1
                                ? 'flex gap-3.5 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-1 px-1 py-1 lg:mx-0 lg:px-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:overflow-visible'
                                : 'grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch'
                            }
                          >
                            {filteredHomeTrips.map((item) => {
                              const span = getDaySpanUtc(item.startDate, item.endDate);
                              const dateParts = formatHomeCardDateParts(item.startDate);
                              const cardWidthClass =
                                filteredHomeTrips.length > 1
                                  ? 'w-[86%] sm:w-[340px] lg:w-full shrink-0'
                                  : 'w-full lg:col-span-7';
                              return (
                                <div
                                  key={item.id}
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
                                    className="h-52 sm:h-56 w-full"
                                    scrimClassName="bg-gradient-to-b from-black/58 via-black/14 to-black/18"
                                  >
                                    <div className="h-full p-5 sm:p-6 flex items-start justify-between gap-3 text-white">
                                      <div className="min-w-0 space-y-2.5">
                                        <h2 className="text-[22px] sm:text-[25px] font-display font-bold text-white leading-tight truncate tracking-tight drop-shadow-sm">
                                          {item.destination}
                                        </h2>
                                        <div className="inline-flex">
                                          <HomeTripWeatherPill
                                            city={item.destination}
                                            tripId={item.id}
                                            onOpenWeather={handleOpenHomeWeather}
                                          />
                                        </div>
                                      </div>

                                      <div className="text-right shrink-0 flex flex-col items-end">
                                        <span className="text-[36px] sm:text-[42px] font-display font-light leading-none tracking-tight text-white font-num drop-shadow-sm">
                                          {dateParts.day}
                                        </span>
                                        <span className="text-xs sm:text-[13px] font-display font-medium text-white/95 mt-0.5 drop-shadow-sm">
                                          {dateParts.month}
                                        </span>
                                        <span className="text-[11px] font-num font-medium text-white/80 mt-1.5 drop-shadow-sm">
                                          {item.startDate.slice(5)} ~ {item.endDate.slice(5)}
                                          {span ? ` · ${span.days}天` : ''}
                                        </span>
                                      </div>
                                    </div>
                                  </DestinationCover>
                                </div>
                              );
                            })}

                            {/* On Wide Screen with Single Trip: Companion Quick Sync & New Trip Card right beside it */}
                            {filteredHomeTrips.length === 1 && (
                              <div className="hidden lg:flex lg:col-span-5 surface-elevated rounded-[28px] p-5 flex-col justify-between gap-4">
                                <div className="space-y-2">
                                  <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                                    快速加入協作或建立新旅程
                                  </div>
                                  <form onSubmit={handleHomeJoinSubmit} className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={homeSyncCode}
                                      onChange={(e) => setHomeSyncCode(e.target.value.toUpperCase())}
                                      placeholder="SKY-XXXX-XXXX"
                                      className="flex-1 min-w-0 h-10 px-3.5 rounded-xl bg-zinc-100/90 dark:bg-white/[0.06] font-num text-xs font-semibold text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none"
                                    />
                                    <button
                                      type="submit"
                                      disabled={!homeSyncCode.trim() || isHomeJoining}
                                      className="h-10 px-4 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold text-xs disabled:opacity-35 cursor-pointer whitespace-nowrap shrink-0"
                                    >
                                      {isHomeJoining ? '連線中' : '加入'}
                                    </button>
                                  </form>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => openCreateFlow()}
                                  className="w-full min-h-[48px] px-6 rounded-full bg-gradient-to-r from-[#2563EB] to-[#0EA5E9] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 active:scale-[0.985] transition-all cursor-pointer shadow-[0_10px_24px_-8px_rgba(37,99,235,0.52)]"
                                >
                                  <PlusIcon className="w-4 h-4" />
                                  <span>新旅程</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Cross-Device Sync Bar + Centered New Trip CTA */}
                        <div
                          className={`grid grid-cols-1 gap-3 items-center ${
                            filteredHomeTrips.length === 1 ? 'lg:hidden' : 'lg:grid-cols-12'
                          }`}
                        >
                          <form
                            onSubmit={handleHomeJoinSubmit}
                            className="lg:col-span-8 surface-elevated rounded-2xl p-2 flex items-center gap-2"
                          >
                            <div className="pl-3 flex items-center gap-2 text-zinc-400 shrink-0">
                              <WifiIcon className="w-4 h-4" />
                            </div>
                            <input
                              type="text"
                              value={homeSyncCode}
                              onChange={(e) => setHomeSyncCode(e.target.value.toUpperCase())}
                              placeholder="輸入同步碼加入行程 (SKY-XXXX-XXXX)"
                              className="flex-1 min-w-0 h-10 bg-transparent font-num text-xs sm:text-sm font-medium text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none"
                            />
                            <button
                              type="submit"
                              disabled={!homeSyncCode.trim() || isHomeJoining}
                              className="h-10 px-4 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold text-xs disabled:opacity-35 cursor-pointer whitespace-nowrap shrink-0"
                            >
                              {isHomeJoining ? '連線中' : '加入'}
                            </button>
                          </form>

                          <div className="lg:col-span-4 flex justify-center lg:justify-end">
                            <button
                              type="button"
                              onClick={() => openCreateFlow()}
                              className="min-h-[48px] lg:w-full px-7 rounded-full bg-gradient-to-r from-[#2563EB] to-[#0EA5E9] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer shadow-[0_10px_24px_-8px_rgba(37,99,235,0.54)]"
                            >
                              <PlusIcon className="w-4 h-4" />
                              <span>新旅程</span>
                            </button>
                          </div>
                        </div>

                        {/* Bottom All-Trips Countdown Section */}
                        <div className="space-y-2.5 pt-1">
                          <div className="flex items-center justify-between px-1">
                            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                              行程倒數
                            </span>
                            <span className="text-[11px] font-num font-semibold text-zinc-400 dark:text-zinc-500">
                              共 {homeCountdownList.length} 趟旅程
                            </span>
                          </div>

                          <div
                            className={
                              homeCountdownList.length > 1
                                ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3'
                                : 'space-y-2.5'
                            }
                          >
                            {homeCountdownList.map((entry) => {
                              const radius = 25;
                              const circumference = 2 * Math.PI * radius;
                              const strokeDashoffset = circumference * (1 - entry.countdownProgress);
                              const isHighlighted = selectedHomeTrip?.id === entry.trip.id;

                              return (
                                <div
                                  key={entry.trip.id}
                                  onClick={() => handleOpenTrip(entry.trip)}
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
                                        {entry.trip.endDate.slice(5)} · 當地{' '}
                                        {getDestinationLocalTime(entry.intel.utcOffsetHours).timeStr}
                                      </div>
                                    </div>
                                  </div>

                                  <ChevronRightIcon className="w-5 h-5 text-zinc-400 shrink-0" />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    ) : (
                      /* Scenic Welcome Card when no trips yet (Horizontal Split on Tablet/Desktop) */
                      <div className="surface-elevated rounded-3xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
                        <DestinationCover
                          city={exploreCity || rotatingShowcaseCity}
                          debounceMs={80}
                          crossfade
                          className="h-52 sm:h-60 lg:h-full lg:min-h-[300px] w-full lg:col-span-6"
                        >
                          <div className="h-full p-6 flex flex-col justify-end text-white">
                            <span className="text-xs font-medium text-white/85 flex items-center gap-1.5">
                              {!exploreCity && (
                                <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse shrink-0" />
                              )}
                              <span>{exploreCity || `探索靈感 · ${rotatingShowcaseCity}`}</span>
                            </span>
                            <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-white mt-0.5">
                              開始下一趟旅程
                            </h1>
                          </div>
                        </DestinationCover>

                        <div className="p-6 lg:p-7 space-y-5 lg:col-span-6 flex flex-col justify-between">
                          <div className="space-y-4">
                            <div className="hidden lg:block space-y-1">
                              <div className="text-xs font-semibold text-[#2563EB] dark:text-sky-400">
                                探索全球 40 座精選城市
                              </div>
                              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                                點選城市搶先預覽實景與旋轉地球儀定位，或直接建立行程並啟用 AI 智慧路線規劃。
                              </p>
                            </div>

                            <div className="flex lg:flex-wrap gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
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
                                    {city}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="space-y-4">
                            <button
                              type="button"
                              onClick={() => openCreateFlow(exploreCity || undefined)}
                              className="w-full min-h-[50px] rounded-full bg-gradient-to-r from-[#2563EB] to-[#0EA5E9] text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.985] transition-all cursor-pointer shadow-[0_10px_24px_-8px_rgba(37,99,235,0.52)]"
                            >
                              <PlusIcon className="w-4 h-4" />
                              <span>{exploreCity ? `規劃「${exploreCity}」旅程` : '開始規劃旅程'}</span>
                            </button>

                            {archivedTrips.length > 0 && (
                              <div className="pt-4 border-t border-zinc-200/70 dark:border-white/[0.08] space-y-2">
                                <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">最近封存</div>
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
                                          {arch.destination} · {arch.startDate}
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
                          placeholder="輸入同步碼加入行程 (SKY-XXXX-XXXX)"
                          className="flex-1 min-w-0 h-10 bg-transparent font-num text-xs sm:text-sm font-medium text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none"
                        />
                        <button
                          type="submit"
                          disabled={!homeSyncCode.trim() || isHomeJoining}
                          className="h-10 px-4 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold text-xs disabled:opacity-35 cursor-pointer whitespace-nowrap shrink-0"
                        >
                          {isHomeJoining ? '連線中' : '加入'}
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
                className="h-full min-h-0 w-full flex flex-col max-w-2xl lg:max-w-5xl mx-auto pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-8 overflow-clip"
              >
                <div className="mb-4 shrink-0 flex items-center justify-between gap-3 relative z-20">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setView('HOME')}
                      aria-label="返回首頁"
                      className="surface-elevated w-10 h-10 rounded-full flex items-center justify-center text-zinc-800 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
                    >
                      <ChevronLeftIcon className="w-5 h-5" />
                    </button>
                    <h2 className="text-2xl font-display font-bold text-zinc-900 dark:text-white">
                      建立新旅程
                    </h2>
                  </div>

                  {((tripType === 'Single' && singleSpan) || (tripType === 'Multi' && activeStopSpan)) && (
                    <span className="text-xs font-num font-bold text-[#2563EB] dark:text-sky-400">
                      {tripType === 'Single'
                        ? `共 ${singleSpan!.days} 天 ${singleSpan!.nights} 夜`
                        : `第 ${activeStop?.id || 1} 站 · ${activeStopSpan!.days} 天 ${activeStopSpan!.nights} 夜`}
                    </span>
                  )}
                </div>

                <form
                  onSubmit={handleCreateTrip}
                  className="flex-1 min-h-0 overflow-y-auto no-scrollbar pb-8"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
                    {/* Left Column on Tablet/Desktop: Photo Preview, Type Switch, Cities & Name */}
                    <div className="lg:col-span-5 space-y-4">
                      {/* Live Auto-Matched Global Destination Banner */}
                      <DestinationCover
                        city={createPreviewCity || rotatingShowcaseCity}
                        debounceMs={createPreviewCity ? 360 : 80}
                        crossfade={!createPreviewCity}
                        className="h-36 sm:h-44 lg:h-48 rounded-3xl shadow-sm"
                      >
                        <div className="h-full p-5 flex flex-col justify-end text-white">
                          <div className="text-xs text-white/85 font-num flex items-center gap-1.5">
                            {!createPreviewIntel && (
                              <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse shrink-0" />
                            )}
                            <span>
                              {createPreviewIntel
                                ? `${createPreviewIntel.countryLabel} · ${createPreviewIntel.currency} · ${createPreviewIntel.timezoneLabel}`
                                : `精選靈感 · ${rotatingShowcaseCity}（輸入全球城市自動配對背景）`}
                            </span>
                          </div>
                          <div className="text-xl sm:text-2xl font-display font-bold truncate mt-0.5">
                            {createPreviewCity || '下一站目的地'}
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
                            label: '單一城市',
                            icon: <MapIcon className="w-4 h-4" />,
                            accentFrom: '#2563EB',
                            accentTo: '#0EA5E9',
                          },
                          {
                            id: 'Multi',
                            label: '多城市行程',
                            icon: <GlobeIcon className="w-4 h-4" />,
                            accentFrom: '#4F46E5',
                            accentTo: '#6366F1',
                          },
                        ]}
                      />

                      {/* Quick City Suggestions */}
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 px-1">快速選擇城市</div>
                        <div className="flex lg:flex-wrap gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                          {QUICK_CITIES.map((city) => {
                            const isPicked =
                              tripType === 'Single'
                                ? singleDestination === city
                                : stops.find((s) => s.id === activeStopId)?.destination === city;
                            return (
                              <button
                                key={city}
                                type="button"
                                onClick={() => handleQuickCitySelect(city)}
                                className={`h-8 px-3.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                  isPicked
                                    ? 'bg-gradient-to-r from-[#2563EB] to-[#0EA5E9] text-white shadow-sm'
                                    : 'surface-elevated text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800'
                                }`}
                              >
                                {city}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {tripType === 'Single' ? (
                        <div>
                          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 ml-1 mb-1.5 block">
                            目的地
                          </label>
                          <div className="surface-elevated px-4 h-12 rounded-2xl flex items-center gap-3">
                            <MapIcon className="w-4 h-4 text-[#2563EB] dark:text-sky-400 shrink-0" />
                            <input
                              required
                              type="text"
                              placeholder="東京、首爾、巴黎..."
                              value={singleDestination}
                              onChange={(e) => setSingleDestination(e.target.value)}
                              className="bg-transparent w-full font-semibold text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {stops.map((stop, index) => {
                            const span = getDaySpanUtc(stop.startDate, stop.endDate);
                            const isActiveStop = activeStopId === stop.id;
                            return (
                              <motion.div
                                key={stop.id}
                                layout
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                onClick={() => setActiveStopId(stop.id)}
                                className={`surface-elevated p-4 rounded-3xl transition-all cursor-pointer ${
                                  isActiveStop ? 'ring-2 ring-[#4F5DF5]' : ''
                                }`}
                              >
                                <div className="flex items-center gap-3 mb-2">
                                  <div
                                    className={`w-7 h-7 rounded-full flex items-center justify-center font-num font-bold text-xs shrink-0 ${
                                      isActiveStop
                                        ? 'bg-[#4F5DF5] text-white'
                                        : 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                                    }`}
                                  >
                                    {index + 1}
                                  </div>
                                  <input
                                    required
                                    type="text"
                                    placeholder={`第 ${index + 1} 站城市`}
                                    value={stop.destination}
                                    onFocus={() => setActiveStopId(stop.id)}
                                    onChange={(e) => handleStopChange(stop.id, 'destination', e.target.value)}
                                    className="flex-1 bg-transparent font-semibold text-base text-zinc-900 dark:text-white focus:outline-none placeholder-zinc-400"
                                  />
                                  {span && (
                                    <span className="text-xs font-num font-semibold text-[#4F5DF5] dark:text-indigo-400 shrink-0">
                                      {span.days}天 / {span.nights}晚
                                    </span>
                                  )}
                                  {stops.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveStop(stop.id);
                                      }}
                                      aria-label="移除站點"
                                      className="w-8 h-8 flex items-center justify-center rounded-full text-zinc-400 hover:text-red-500 transition-colors cursor-pointer"
                                    >
                                      <TrashIcon className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs font-num">
                                  <div className="bg-zinc-100/80 dark:bg-white/[0.04] px-3 py-2 rounded-xl">
                                    <span className="text-[10px] text-zinc-400 block">抵達</span>
                                    <span className="font-semibold text-zinc-900 dark:text-white">
                                      {stop.startDate || '選擇日期'}
                                    </span>
                                  </div>
                                  <div className="bg-zinc-100/80 dark:bg-white/[0.04] px-3 py-2 rounded-xl">
                                    <span className="text-[10px] text-zinc-400 block">離開</span>
                                    <span className="font-semibold text-zinc-900 dark:text-white">
                                      {stop.endDate || '選擇日期'}
                                    </span>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}

                          {stops.length < 6 && (
                            <button
                              type="button"
                              onClick={handleAddStop}
                              className="w-full min-h-[44px] border border-dashed border-zinc-300 dark:border-white/15 rounded-full text-zinc-600 dark:text-zinc-300 font-semibold text-xs hover:border-[#4F5DF5] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <PlusIcon className="w-4 h-4" />
                              <span>新增下一站</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Optional Trip Name */}
                      <div>
                        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 ml-1 mb-1.5 block">
                          旅程名稱（選填）
                        </label>
                        <div className="surface-elevated px-4 h-12 rounded-2xl flex items-center gap-3">
                          <TagIcon className="w-4 h-4 text-zinc-400 shrink-0" />
                          <input
                            type="text"
                            placeholder={
                              singleDestination.trim() ? `預設：${singleDestination.trim()} 旅程` : '自訂名稱...'
                            }
                            value={tripName}
                            onChange={(e) => setTripName(e.target.value)}
                            className="bg-transparent w-full font-semibold text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Quiet Destination Intel Line */}
                      <AnimatePresence>
                        {createPreviewIntel && (
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
                    <div className="lg:col-span-7 space-y-4">
                      {tripType === 'Single' ? (
                        <>
                          {/* Selected Dates Display Summary Pills */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="surface-pastel-sky px-4 py-2.5 rounded-2xl">
                              <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">出發日期</div>
                              <div className="font-num font-bold text-sm text-zinc-900 dark:text-white mt-0.5">
                                {singleStartDate || '未選擇'}
                              </div>
                            </div>
                            <div className="surface-pastel-sky px-4 py-2.5 rounded-2xl">
                              <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">回程日期</div>
                              <div className="font-num font-bold text-sm text-zinc-900 dark:text-white mt-0.5">
                                {singleEndDate || '未選擇'}
                              </div>
                            </div>
                          </div>

                          {/* Quick Day-Count Selector */}
                          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                            <span className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">天數：</span>
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
                                  {d}天
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
                          {/* Quick Day-Count Selector for Active Stop */}
                          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                            <span className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">
                              第 {activeStop?.id || 1} 站天數：
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
                                  {d}天
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
                        </>
                      )}

                      <div className="pt-1">
                        <button
                          type="submit"
                          className="w-full min-h-[50px] bg-gradient-to-r from-[#2563EB] to-[#0EA5E9] text-white rounded-full font-semibold text-sm active:scale-[0.985] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_10px_24px_-8px_rgba(37,99,235,0.54)]"
                        >
                          <span>開始規劃</span>
                          <ChevronRightIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
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
                className="h-full min-h-0 w-full flex flex-col lg:flex-row overflow-clip relative"
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
                        aria-label="返回首頁"
                        className="relative z-10 surface-elevated h-10 px-3 sm:px-3.5 rounded-full flex items-center gap-1 text-zinc-800 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
                      >
                        <ChevronLeftIcon className="w-4 h-4" />
                        <span className="hidden sm:inline text-xs font-semibold">返回</span>
                      </button>

                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-24 sm:px-32">
                        <h1 className="h-10 inline-flex items-center justify-center text-sm sm:text-base font-display font-bold text-zinc-900 dark:text-white tracking-tight leading-none truncate">
                          {activePageTitle}
                        </h1>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsSyncHubOpen(true)}
                        aria-label="跨裝置同步與線上裝置數量"
                        title={syncBadge.text}
                        className="relative z-10 surface-elevated h-10 px-3 sm:px-3.5 rounded-full flex items-center gap-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-100 hover:bg-white dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
                      >
                        <span className={`w-2 h-2 rounded-full ${syncBadge.dotClass}`} />
                        <DevicePhoneMobileIcon className="w-4 h-4" />
                        <span className="font-num font-bold">{effectiveDeviceCount}</span>
                        <span className="hidden sm:inline text-[11px] text-zinc-500 dark:text-zinc-400">裝置</span>
                      </button>
                    </div>
                  </header>

                  <div data-scroll-lock className="flex-1 min-h-0 h-full overflow-clip pb-[calc(88px+env(safe-area-inset-bottom))] lg:pb-0">
                    {activeTab === Tab.ITINERARY && (
                      <ItineraryTool
                        trip={tripData}
                        onUpdateTrip={handleLocalUpdateTrip}
                        onShowToast={showToast}
                        focusDateSignal={focusDateSignal}
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
                      <div className="h-full overflow-y-auto no-scrollbar px-4 sm:px-6 lg:px-8 pt-2 pb-8 lg:pb-12">
                        <div className="max-w-2xl lg:max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
                          {/* Left Column on Wide Screens: Cloud Account + Live Sync + Appearance */}
                          <div className="lg:col-span-6 space-y-5">
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
                                    {cloudAuth.user ? '雲端私人同步' : '未登入'}
                                  </span>
                                </div>

                                <div className="pt-4 flex items-end justify-between gap-2 w-full">
                                  <div className="min-w-0">
                                    <div className="font-display font-bold text-base text-zinc-900 dark:text-white truncate">
                                      {cloudAuth.user ? cloudAuth.user.displayName || '雲端帳號' : '登入雲端帳號'}
                                    </div>
                                    <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                                      {cloudAuth.user
                                        ? cloudAuth.user.email || 'Google · Apple 個人空間'
                                        : '支援 Apple 與 Google 登入'}
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
                                    {effectiveDeviceCount} 台裝置在線
                                  </span>
                                </div>

                                <div className="pt-4 flex items-end justify-between gap-2 w-full">
                                  <div className="min-w-0">
                                    <div className="font-display font-bold text-base text-white">跨裝置即時同步</div>
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
                                外觀與顯示
                              </h2>
                              <div className="surface-elevated rounded-[24px] p-4 sm:p-5 space-y-3.5">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-9 h-9 rounded-xl bg-[var(--tab-accent-soft)] flex items-center justify-center shrink-0">
                                      {renderThemeIcon()}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="font-display font-bold text-sm text-zinc-900 dark:text-white">
                                        外觀主題
                                      </div>
                                      <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                                        切換柔和日光或靜謐夜間模式
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
                                      label: '跟隨系統',
                                      icon: <ComputerDesktopIcon className="w-3.5 h-3.5" />,
                                      accentFrom: '#4F46E5',
                                      accentTo: '#6366F1',
                                    },
                                    {
                                      id: 'light',
                                      label: '日光模式',
                                      icon: <SunIcon className="w-3.5 h-3.5" />,
                                      accentFrom: '#2563EB',
                                      accentTo: '#0EA5E9',
                                    },
                                    {
                                      id: 'dark',
                                      label: '夜間模式',
                                      icon: <MoonIcon className="w-3.5 h-3.5" />,
                                      accentFrom: '#7C3AED',
                                      accentTo: '#8B5CF6',
                                    },
                                  ]}
                                />
                              </div>
                            </section>
                          </div>

                          {/* Right Column on Wide Screens: Trip & Data + Danger Zone */}
                          <div className="lg:col-span-6 space-y-5">
                            {/* Section 2: 旅程與資料管理 (Clean Grouped Hairline List) */}
                            <section className="space-y-2">
                              <h2 className="px-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                                旅程與資料管理
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
                                        修改旅程資訊
                                      </div>
                                      <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                                        編輯名稱、目的地與起迄日期
                                      </div>
                                    </div>
                                  </div>
                                  <ChevronRightIcon className="w-4 h-4 text-zinc-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                                </button>

                                <button
                                  type="button"
                                  onClick={handleShare}
                                  className="w-full px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-zinc-50/80 dark:hover:bg-white/[0.04] transition-colors cursor-pointer group"
                                >
                                  <div className="flex items-center gap-3.5 min-w-0">
                                    <div className="w-9 h-9 rounded-xl bg-indigo-500/12 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                      <ShareIcon className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="font-semibold text-sm text-zinc-900 dark:text-white">
                                        分享旅程與協作
                                      </div>
                                      <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                                        複製同步連結邀請旅伴即時編輯
                                      </div>
                                    </div>
                                  </div>
                                  <ChevronRightIcon className="w-4 h-4 text-zinc-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsExportModalOpen(true);
                                    setCopySuccess(false);
                                  }}
                                  className="w-full px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-zinc-50/80 dark:hover:bg-white/[0.04] transition-colors cursor-pointer group"
                                >
                                  <div className="flex items-center gap-3.5 min-w-0">
                                    <div className="w-9 h-9 rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                      <ArrowDownTrayIcon className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="font-semibold text-sm text-zinc-900 dark:text-white">
                                        匯出與備份
                                      </div>
                                      <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                                        下載 .TXT 行程文字檔或 .JSON 完整備份
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
                                        版本紀錄
                                      </div>
                                      <div className="text-xs font-num text-[var(--tab-accent)] font-semibold truncate">
                                        目前版本 {APP_VERSION}
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
                                進階操作
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
                                        封存旅程
                                      </div>
                                      <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                                        移至首頁歷史封存清單，可隨時還原
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
                                        移除本機旅程
                                      </div>
                                      <div className="text-xs text-red-500/75 truncate">
                                        離開工作區並清除本機列表紀錄
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
          />
        )}

        <ConfirmSheet
          open={isDeleteConfirmOpen}
          onClose={() => setIsDeleteConfirmOpen(false)}
          onConfirm={handleDeleteTrip}
          title={cloudAuth.user ? '移除此旅程？' : '移除此本機旅程？'}
          description={
            cloudAuth.user
              ? '這趟旅程將會從您的本機與私人雲端帳號中移除（若先前分享過同步代碼，房間紀錄仍會保留）。'
              : '本機列表將移除這趟旅程（若其他裝置保有同步代碼，雲端房間仍會保留）。'
          }
          confirmLabel="確認移除"
          tone="danger"
          icon={<TrashIcon className="w-6 h-6" />}
        />

        <ConfirmSheet
          open={isArchiveConfirmOpen}
          onClose={() => setIsArchiveConfirmOpen(false)}
          onConfirm={handleArchiveTrip}
          title="封存目前旅程？"
          description="旅程將會移至首頁的封存清單，可隨時還原。"
          confirmLabel="確認封存"
          tone="primary"
          icon={<ArchiveBoxArrowDownIcon className="w-6 h-6" />}
        />

        {/* Edit Trip Modal */}
        <LiquidModal
          open={isEditTripOpen}
          onClose={() => setIsEditTripOpen(false)}
          title="修改旅程"
          maxWidthClass="max-w-md"
        >
          <div className="overflow-y-auto no-scrollbar space-y-4 pr-0.5 max-h-[70vh]">
            <div>
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1.5 block">
                旅程名稱
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
                    目的地
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
                    <span className="text-[10px] text-zinc-500 block">出發日期</span>
                    <span className="font-bold text-zinc-900 dark:text-white">{editTripData.startDate}</span>
                  </div>
                  <div className="bg-zinc-100 dark:bg-white/[0.05] px-3.5 py-2.5 rounded-2xl">
                    <span className="text-[10px] text-zinc-500 block">結束日期</span>
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
                        第 {idx + 1} 站
                      </span>
                      {editStops.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveEditStop(stop.id)}
                          className="text-xs text-zinc-400 hover:text-red-500 cursor-pointer"
                        >
                          移除
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={stop.destination}
                      onChange={(e) => handleEditStopChange(stop.id, 'destination', e.target.value)}
                      placeholder="城市名稱"
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
                    + 增加站點
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={handleConfirmEdit}
              className="w-full min-h-[46px] bg-[var(--tab-accent)] hover:bg-[var(--tab-accent-hover)] text-white rounded-full font-semibold text-sm cursor-pointer mt-2 transition-colors"
            >
              儲存變更
            </button>
          </div>
        </LiquidModal>

        {/* Changelog Modal */}
        <LiquidModal
          open={isChangelogOpen}
          onClose={() => setIsChangelogOpen(false)}
          title="版本紀錄"
          maxWidthClass="max-w-md"
        >
          <div className="overflow-y-auto no-scrollbar space-y-5 pr-1 max-h-[68vh]">
            {CHANGELOG_DATA.map((log, i) => (
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
                  {log.items.map((item, j) => (
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
          title="匯出與備份"
          maxWidthClass="max-w-lg"
        >
          <div className="flex flex-col gap-4 overflow-hidden">
            <div className="bg-zinc-100 dark:bg-zinc-950/60 p-4 rounded-2xl max-h-[46vh] overflow-y-auto no-scrollbar border border-zinc-200/70 dark:border-white/10">
              <pre className="text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed">
                {exportContent}
              </pre>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleCopyToClipboard}
                className={`min-h-[44px] px-3 rounded-full font-semibold text-xs transition-colors cursor-pointer ${
                  copySuccess
                    ? 'bg-[#2563EB] text-white'
                    : 'bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200/80'
                }`}
              >
                {copySuccess ? '已複製' : '複製文字'}
              </button>
              <button
                type="button"
                onClick={handleDownloadTxt}
                className="min-h-[44px] px-3 rounded-full font-semibold text-xs bg-zinc-100 dark:bg-white/15 text-zinc-900 dark:text-white cursor-pointer"
              >
                下載 .TXT
              </button>
              <button
                type="button"
                onClick={handleDownloadJsonBackup}
                className="min-h-[44px] px-3 rounded-full font-semibold text-xs bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 cursor-pointer"
              >
                備份 .JSON
              </button>
            </div>
          </div>
        </LiquidModal>
      </div>
    </MotionConfig>
  );
}

export default App;
