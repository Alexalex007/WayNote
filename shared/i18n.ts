export type AppLanguage = 'zh-TW' | 'zh-CN' | 'en';

export const LANGUAGE_STORAGE_KEY = 'waynote_language';

export const LANGUAGE_OPTIONS: Array<{
  id: AppLanguage;
  label: string;
  shortLabel: string;
  htmlLang: string;
  localeTag: string;
}> = [
  { id: 'zh-TW', label: '繁體中文', shortLabel: '繁中', htmlLang: 'zh-Hant-TW', localeTag: 'zh-TW' },
  { id: 'zh-CN', label: '简体中文', shortLabel: '简中', htmlLang: 'zh-Hans-CN', localeTag: 'zh-CN' },
  { id: 'en', label: 'English', shortLabel: 'EN', htmlLang: 'en', localeTag: 'en-US' },
];

export function normalizeAppLanguage(raw?: string | null): AppLanguage {
  if (raw === 'zh-CN' || raw === 'en' || raw === 'zh-TW') return raw;
  return 'zh-TW';
}

export function getStoredLanguage(): AppLanguage {
  if (typeof window === 'undefined') return 'zh-TW';
  try {
    return normalizeAppLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY));
  } catch {
    return 'zh-TW';
  }
}

export function setStoredLanguage(lang: AppLanguage): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch {
    // ignore storage quota errors
  }
}

export function tr<T = string>(lang: AppLanguage, zhTw: T, zhCn: T, en: T): T {
  if (lang === 'zh-CN') return zhCn;
  if (lang === 'en') return en;
  return zhTw;
}

export function getLocaleTag(lang: AppLanguage): string {
  if (lang === 'zh-CN') return 'zh-CN';
  if (lang === 'en') return 'en-US';
  return 'zh-TW';
}

export function getHtmlLang(lang: AppLanguage): string {
  if (lang === 'zh-CN') return 'zh-Hans-CN';
  if (lang === 'en') return 'en';
  return 'zh-Hant-TW';
}

const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTHS_EN_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function formatHomeCardDateParts(isoDate: string, lang: AppLanguage): { day: string; monthLabel: string } {
  const m = String(isoDate || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return { day: '--', monthLabel: '' };
  const monthIdx = Math.max(0, Math.min(11, Number(m[2]) - 1));
  const day = String(Number(m[3]));
  const monthLabel =
    lang === 'en'
      ? MONTHS_EN[monthIdx]
      : `${monthIdx + 1}月`;
  return { day, monthLabel };
}

export function formatShortMonthDay(isoDate: string, lang: AppLanguage): string {
  const m = String(isoDate || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return isoDate || '';
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (lang === 'en') {
    return `${MONTHS_EN_SHORT[Math.max(0, Math.min(11, month - 1))]} ${day}`;
  }
  return `${month}/${day}`;
}

export function formatMonthHeading(year: number, monthIndex0: number, lang: AppLanguage): string {
  const safeM = Math.max(0, Math.min(11, monthIndex0));
  if (lang === 'en') {
    return `${MONTHS_EN[safeM]} ${year}`;
  }
  return `${year}年 ${safeM + 1}月`;
}

export function getWeekdayHeaders(lang: AppLanguage): string[] {
  if (lang === 'en') return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return ['日', '一', '二', '三', '四', '五', '六'];
}

export function formatWeekdayBadge(isoDate: string, lang: AppLanguage): string {
  const m = String(isoDate || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return '';
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  const w = d.getUTCDay();
  if (lang === 'en') {
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][w];
  }
  const cjk = ['日', '一', '二', '三', '四', '五', '六'][w];
  return lang === 'zh-CN' ? `周${cjk}` : `週${cjk}`;
}

export function formatDayBadge(dayNum: number, lang: AppLanguage): string {
  if (lang === 'en') return `Day ${dayNum}`;
  return `第 ${dayNum} 天`;
}

export function formatDayProgress(current: number, total: number, lang: AppLanguage): string {
  if (lang === 'en') return `Day ${current} of ${total}`;
  return `第 ${current}/${total} 天`;
}

export function formatStopsCount(count: number, lang: AppLanguage): string {
  if (lang === 'en') return `${count} ${count === 1 ? 'stop' : 'stops'}`;
  return `${count} 站`;
}

export function formatDurationLabel(rawDur: string | undefined, lang: AppLanguage): string {
  const clean = String(rawDur || '1.5h').trim();
  const numMatch = clean.match(/^(\d+(?:\.\d+)?)\s*h$/i);
  if (!numMatch) return clean;
  const val = numMatch[1];
  if (lang === 'en') return `${val}h`;
  if (lang === 'zh-CN') return `${val} 小时`;
  return `${val} 小時`;
}

export function formatTimeDisplay(hhmm: string | undefined, lang: AppLanguage): { main: string; suffix: string } {
  const clean = String(hhmm || '09:00').trim();
  const [hStr, mStr] = clean.split(':');
  const h = Number(hStr);
  if (Number.isNaN(h)) return { main: clean, suffix: '' };
  const mm = mStr || '00';
  if (lang === 'en') {
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return { main: `${h12}:${mm}`, suffix: h < 12 ? 'am' : 'pm' };
  }
  return { main: `${String(h).padStart(2, '0')}:${mm}`, suffix: '' };
}

export interface LocalizedPlaceToken {
  keys: string[];
  'zh-TW': string;
  'zh-CN': string;
  en: string;
}

const CITY_NAME_TRANSLATIONS: LocalizedPlaceToken[] = [
  { keys: ['東京', '东京', 'tokyo'], 'zh-TW': '東京', 'zh-CN': '东京', en: 'Tokyo' },
  { keys: ['大阪', 'osaka'], 'zh-TW': '大阪', 'zh-CN': '大阪', en: 'Osaka' },
  { keys: ['京都', 'kyoto'], 'zh-TW': '京都', 'zh-CN': '京都', en: 'Kyoto' },
  { keys: ['北海道', 'hokkaido'], 'zh-TW': '北海道', 'zh-CN': '北海道', en: 'Hokkaido' },
  { keys: ['札幌', 'sapporo'], 'zh-TW': '札幌', 'zh-CN': '札幌', en: 'Sapporo' },
  { keys: ['沖繩', '冲绳', 'okinawa'], 'zh-TW': '沖繩', 'zh-CN': '冲绳', en: 'Okinawa' },
  { keys: ['那霸', '那覇', 'naha'], 'zh-TW': '那霸', 'zh-CN': '那霸', en: 'Naha' },
  { keys: ['福岡', '福冈', 'fukuoka'], 'zh-TW': '福岡', 'zh-CN': '福冈', en: 'Fukuoka' },
  { keys: ['名古屋', 'nagoya'], 'zh-TW': '名古屋', 'zh-CN': '名古屋', en: 'Nagoya' },
  { keys: ['仙台', 'sendai'], 'zh-TW': '仙台', 'zh-CN': '仙台', en: 'Sendai' },
  { keys: ['神戶', '神户', 'kobe'], 'zh-TW': '神戶', 'zh-CN': '神户', en: 'Kobe' },
  { keys: ['奈良', 'nara'], 'zh-TW': '奈良', 'zh-CN': '奈良', en: 'Nara' },
  { keys: ['橫濱', '横滨', 'yokohama'], 'zh-TW': '橫濱', 'zh-CN': '横滨', en: 'Yokohama' },
  { keys: ['廣島', '广岛', 'hiroshima'], 'zh-TW': '廣島', 'zh-CN': '广岛', en: 'Hiroshima' },
  { keys: ['金澤', '金泽', 'kanazawa'], 'zh-TW': '金澤', 'zh-CN': '金泽', en: 'Kanazawa' },
  { keys: ['箱根', 'hakone'], 'zh-TW': '箱根', 'zh-CN': '箱根', en: 'Hakone' },
  { keys: ['輕井澤', '轻井泽', 'karuizawa'], 'zh-TW': '輕井澤', 'zh-CN': '轻井泽', en: 'Karuizawa' },
  { keys: ['河口湖', 'kawaguchiko', 'fujikawaguchiko'], 'zh-TW': '河口湖', 'zh-CN': '河口湖', en: 'Kawaguchiko' },
  { keys: ['小樽', 'otaru'], 'zh-TW': '小樽', 'zh-CN': '小樽', en: 'Otaru' },
  { keys: ['函館', '函馆', 'hakodate'], 'zh-TW': '函館', 'zh-CN': '函馆', en: 'Hakodate' },
  { keys: ['首爾', '首尔', 'seoul'], 'zh-TW': '首爾', 'zh-CN': '首尔', en: 'Seoul' },
  { keys: ['釜山', 'busan'], 'zh-TW': '釜山', 'zh-CN': '釜山', en: 'Busan' },
  { keys: ['濟州', '济州', '濟州島', '济州岛', 'jeju'], 'zh-TW': '濟州島', 'zh-CN': '济州岛', en: 'Jeju' },
  { keys: ['台北', '臺北', 'taipei'], 'zh-TW': '台北', 'zh-CN': '台北', en: 'Taipei' },
  { keys: ['新北', 'new taipei'], 'zh-TW': '新北', 'zh-CN': '新北', en: 'New Taipei' },
  { keys: ['台中', '臺中', 'taichung'], 'zh-TW': '台中', 'zh-CN': '台中', en: 'Taichung' },
  { keys: ['台南', '臺南', 'tainan'], 'zh-TW': '台南', 'zh-CN': '台南', en: 'Tainan' },
  { keys: ['高雄', 'kaohsiung'], 'zh-TW': '高雄', 'zh-CN': '高雄', en: 'Kaohsiung' },
  { keys: ['花蓮', '花莲', 'hualien'], 'zh-TW': '花蓮', 'zh-CN': '花莲', en: 'Hualien' },
  { keys: ['宜蘭', '宜兰', 'yilan'], 'zh-TW': '宜蘭', 'zh-CN': '宜兰', en: 'Yilan' },
  { keys: ['九份', 'jiufen'], 'zh-TW': '九份', 'zh-CN': '九份', en: 'Jiufen' },
  { keys: ['日月潭', 'sun moon lake'], 'zh-TW': '日月潭', 'zh-CN': '日月潭', en: 'Sun Moon Lake' },
  { keys: ['香港', 'hong kong'], 'zh-TW': '香港', 'zh-CN': '香港', en: 'Hong Kong' },
  { keys: ['澳門', '澳门', 'macau', 'macao'], 'zh-TW': '澳門', 'zh-CN': '澳门', en: 'Macau' },
  { keys: ['曼谷', 'bangkok'], 'zh-TW': '曼谷', 'zh-CN': '曼谷', en: 'Bangkok' },
  { keys: ['清邁', '清迈', 'chiang mai'], 'zh-TW': '清邁', 'zh-CN': '清迈', en: 'Chiang Mai' },
  { keys: ['普吉', '普吉島', '普吉岛', 'phuket'], 'zh-TW': '普吉島', 'zh-CN': '普吉岛', en: 'Phuket' },
  { keys: ['新加坡', 'singapore'], 'zh-TW': '新加坡', 'zh-CN': '新加坡', en: 'Singapore' },
  { keys: ['吉隆坡', 'kuala lumpur'], 'zh-TW': '吉隆坡', 'zh-CN': '吉隆坡', en: 'Kuala Lumpur' },
  { keys: ['檳城', '槟城', 'penang'], 'zh-TW': '檳城', 'zh-CN': '槟城', en: 'Penang' },
  { keys: ['沙巴', '亞庇', '亚庇', 'sabah', 'kota kinabalu'], 'zh-TW': '沙巴', 'zh-CN': '沙巴', en: 'Sabah' },
  { keys: ['胡志明', '胡志明市', 'ho chi minh', 'ho chi minh city'], 'zh-TW': '胡志明市', 'zh-CN': '胡志明市', en: 'Ho Chi Minh City' },
  { keys: ['河內', '河内', 'hanoi'], 'zh-TW': '河內', 'zh-CN': '河内', en: 'Hanoi' },
  { keys: ['峴港', '岘港', 'danang', 'da nang'], 'zh-TW': '峴港', 'zh-CN': '岘港', en: 'Da Nang' },
  { keys: ['峇里島', '巴厘岛', 'bali', 'denpasar'], 'zh-TW': '峇里島', 'zh-CN': '巴厘岛', en: 'Bali' },
  { keys: ['雅加達', '雅加达', 'jakarta'], 'zh-TW': '雅加達', 'zh-CN': '雅加达', en: 'Jakarta' },
  { keys: ['馬尼拉', '马尼拉', 'manila'], 'zh-TW': '馬尼拉', 'zh-CN': '马尼拉', en: 'Manila' },
  { keys: ['宿霧', '宿务', 'cebu'], 'zh-TW': '宿霧', 'zh-CN': '宿务', en: 'Cebu' },
  { keys: ['上海', 'shanghai'], 'zh-TW': '上海', 'zh-CN': '上海', en: 'Shanghai' },
  { keys: ['北京', 'beijing'], 'zh-TW': '北京', 'zh-CN': '北京', en: 'Beijing' },
  { keys: ['廣州', '广州', 'guangzhou'], 'zh-TW': '廣州', 'zh-CN': '广州', en: 'Guangzhou' },
  { keys: ['深圳', 'shenzhen'], 'zh-TW': '深圳', 'zh-CN': '深圳', en: 'Shenzhen' },
  { keys: ['杭州', 'hangzhou'], 'zh-TW': '杭州', 'zh-CN': '杭州', en: 'Hangzhou' },
  { keys: ['成都', 'chengdu'], 'zh-TW': '成都', 'zh-CN': '成都', en: 'Chengdu' },
  { keys: ['重慶', '重庆', 'chongqing'], 'zh-TW': '重慶', 'zh-CN': '重庆', en: 'Chongqing' },
  { keys: ['西安', 'xian', "xi'an"], 'zh-TW': '西安', 'zh-CN': '西安', en: "Xi'an" },
  { keys: ['蘇州', '苏州', 'suzhou'], 'zh-TW': '蘇州', 'zh-CN': '苏州', en: 'Suzhou' },
  { keys: ['南京', 'nanjing'], 'zh-TW': '南京', 'zh-CN': '南京', en: 'Nanjing' },
  { keys: ['廈門', '厦门', 'xiamen'], 'zh-TW': '廈門', 'zh-CN': '厦门', en: 'Xiamen' },
  { keys: ['倫敦', '伦敦', 'london'], 'zh-TW': '倫敦', 'zh-CN': '伦敦', en: 'London' },
  { keys: ['愛丁堡', '爱丁堡', 'edinburgh'], 'zh-TW': '愛丁堡', 'zh-CN': '爱丁堡', en: 'Edinburgh' },
  { keys: ['巴黎', 'paris'], 'zh-TW': '巴黎', 'zh-CN': '巴黎', en: 'Paris' },
  { keys: ['尼斯', 'nice'], 'zh-TW': '尼斯', 'zh-CN': '尼斯', en: 'Nice' },
  { keys: ['羅馬', '罗马', 'rome'], 'zh-TW': '羅馬', 'zh-CN': '罗马', en: 'Rome' },
  { keys: ['米蘭', '米兰', 'milan'], 'zh-TW': '米蘭', 'zh-CN': '米兰', en: 'Milan' },
  { keys: ['威尼斯', 'venice'], 'zh-TW': '威尼斯', 'zh-CN': '威尼斯', en: 'Venice' },
  { keys: ['佛羅倫斯', '佛罗伦萨', 'florence'], 'zh-TW': '佛羅倫斯', 'zh-CN': '佛罗伦萨', en: 'Florence' },
  { keys: ['柏林', 'berlin'], 'zh-TW': '柏林', 'zh-CN': '柏林', en: 'Berlin' },
  { keys: ['慕尼黑', 'munich'], 'zh-TW': '慕尼黑', 'zh-CN': '慕尼黑', en: 'Munich' },
  { keys: ['法蘭克福', '法兰克福', 'frankfurt'], 'zh-TW': '法蘭克福', 'zh-CN': '法兰克福', en: 'Frankfurt' },
  { keys: ['巴塞隆納', '巴塞罗那', 'barcelona'], 'zh-TW': '巴塞隆納', 'zh-CN': '巴塞罗那', en: 'Barcelona' },
  { keys: ['馬德里', '马德里', 'madrid'], 'zh-TW': '馬德里', 'zh-CN': '马德里', en: 'Madrid' },
  { keys: ['阿姆斯特丹', 'amsterdam'], 'zh-TW': '阿姆斯特丹', 'zh-CN': '阿姆斯特丹', en: 'Amsterdam' },
  { keys: ['維也納', '维也纳', 'vienna'], 'zh-TW': '維也納', 'zh-CN': '维也纳', en: 'Vienna' },
  { keys: ['布拉格', 'prague'], 'zh-TW': '布拉格', 'zh-CN': '布拉格', en: 'Prague' },
  { keys: ['雷克雅維克', '雷克雅未克', 'reykjavik'], 'zh-TW': '雷克雅維克', 'zh-CN': '雷克雅未克', en: 'Reykjavik' },
  { keys: ['冰島', '冰岛', 'iceland'], 'zh-TW': '冰島', 'zh-CN': '冰岛', en: 'Iceland' },
  { keys: ['蘇黎世', '苏黎世', 'zurich'], 'zh-TW': '蘇黎世', 'zh-CN': '苏黎世', en: 'Zurich' },
  { keys: ['日內瓦', '日内瓦', 'geneva'], 'zh-TW': '日內瓦', 'zh-CN': '日内瓦', en: 'Geneva' },
  { keys: ['策馬特', '采尔马特', 'zermatt'], 'zh-TW': '策馬特', 'zh-CN': '采尔马特', en: 'Zermatt' },
  { keys: ['因特拉肯', 'interlaken'], 'zh-TW': '因特拉肯', 'zh-CN': '因特拉肯', en: 'Interlaken' },
  { keys: ['紐約', '纽约', 'new york'], 'zh-TW': '紐約', 'zh-CN': '纽约', en: 'New York' },
  { keys: ['洛杉磯', '洛杉矶', 'los angeles'], 'zh-TW': '洛杉磯', 'zh-CN': '洛杉矶', en: 'Los Angeles' },
  { keys: ['舊金山', '旧金山', 'san francisco'], 'zh-TW': '舊金山', 'zh-CN': '旧金山', en: 'San Francisco' },
  { keys: ['西雅圖', '西雅图', 'seattle'], 'zh-TW': '西雅圖', 'zh-CN': '西雅图', en: 'Seattle' },
  { keys: ['拉斯維加斯', '拉斯维加斯', 'las vegas'], 'zh-TW': '拉斯維加斯', 'zh-CN': '拉斯维加斯', en: 'Las Vegas' },
  { keys: ['夏威夷', '檀香山', 'hawaii', 'honolulu'], 'zh-TW': '夏威夷', 'zh-CN': '夏威夷', en: 'Honolulu' },
  { keys: ['雪梨', '悉尼', 'sydney'], 'zh-TW': '雪梨', 'zh-CN': '悉尼', en: 'Sydney' },
  { keys: ['墨爾本', '墨尔本', 'melbourne'], 'zh-TW': '墨爾本', 'zh-CN': '墨尔本', en: 'Melbourne' },
  { keys: ['布里斯本', '布里斯班', 'brisbane'], 'zh-TW': '布里斯本', 'zh-CN': '布里斯班', en: 'Brisbane' },
  { keys: ['奧克蘭', '奥克兰', 'auckland'], 'zh-TW': '奧克蘭', 'zh-CN': '奥克兰', en: 'Auckland' },
  { keys: ['皇后鎮', '皇后镇', 'queenstown'], 'zh-TW': '皇后鎮', 'zh-CN': '皇后镇', en: 'Queenstown' },
  { keys: ['溫哥華', '温哥华', 'vancouver'], 'zh-TW': '溫哥華', 'zh-CN': '温哥华', en: 'Vancouver' },
  { keys: ['多倫多', '多伦多', 'toronto'], 'zh-TW': '多倫多', 'zh-CN': '多伦多', en: 'Toronto' },
  { keys: ['班夫', 'banff'], 'zh-TW': '班夫', 'zh-CN': '班夫', en: 'Banff' },
  { keys: ['杜拜', '迪拜', 'dubai'], 'zh-TW': '杜拜', 'zh-CN': '迪拜', en: 'Dubai' },
  { keys: ['阿布達比', '阿布扎比', 'abu dhabi'], 'zh-TW': '阿布達比', 'zh-CN': '阿布扎比', en: 'Abu Dhabi' },
  { keys: ['伊斯坦堡', '伊斯坦布尔', 'istanbul'], 'zh-TW': '伊斯坦堡', 'zh-CN': '伊斯坦布尔', en: 'Istanbul' },
  { keys: ['聖托里尼', '圣托里尼', 'santorini'], 'zh-TW': '聖托里尼', 'zh-CN': '圣托里尼', en: 'Santorini' },
  { keys: ['哈修塔特', '哈尔施塔特', 'hallstatt'], 'zh-TW': '哈修塔特', 'zh-CN': '哈尔施塔特', en: 'Hallstatt' },
  { keys: ['薩爾斯堡', '萨尔茨堡', 'salzburg'], 'zh-TW': '薩爾斯堡', 'zh-CN': '萨尔茨堡', en: 'Salzburg' },
  { keys: ['布達佩斯', '布达佩斯', 'budapest'], 'zh-TW': '布達佩斯', 'zh-CN': '布达佩斯', en: 'Budapest' },
  { keys: ['布魯日', '布鲁日', 'bruges'], 'zh-TW': '布魯日', 'zh-CN': '布鲁日', en: 'Bruges' },
];

export function localizeSinglePlaceToken(token: string, lang: AppLanguage): string {
  const clean = token.trim();
  if (!clean) return clean;
  const lower = clean.toLowerCase();
  for (const item of CITY_NAME_TRANSLATIONS) {
    if (item.keys.some((k) => k.toLowerCase() === lower)) {
      return item[lang];
    }
  }
  for (const item of CITY_NAME_TRANSLATIONS) {
    if (item.keys.some((k) => lower.includes(k.toLowerCase()))) {
      return item[lang];
    }
  }
  return clean;
}

export function localizeDestinationLabel(rawDestination: string, lang: AppLanguage): string {
  const clean = String(rawDestination || '').trim();
  if (!clean) return clean;
  const parts = clean.split(/\s*([-→>/,&]+)\s*/);
  if (parts.length === 1) {
    return localizeSinglePlaceToken(clean, lang);
  }
  return parts
    .map((part, idx) => (idx % 2 === 0 ? localizeSinglePlaceToken(part, lang) : ` ${part} `))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getChangelogItems(lang: AppLanguage): Array<{ version: string; date: string; notes: string[] }> {
  if (lang === 'en') {
    return [
      {
        version: '6.8',
        date: 'Latest',
        notes: [
          'Restored local-on-top FX layout with full-box keyboard tap, two-way sync, single % ring, and Pop firework celebration.',
        ],
      },
      {
        version: '6.7',
        date: 'Update',
        notes: [
          'Added batch Google Calendar export, simplified app copy, and redesigned Toolbox as a zero-scroll Bento widget grid.',
        ],
      },
      {
        version: '6.6',
        date: 'Update',
        notes: [
          'Moved calendar export into Settings with progress ring animation, added live FX refresh and global tax-free tracking.',
        ],
      },
      {
        version: '6.5',
        date: 'Update',
        notes: [
          'Switched AI Explore to manual trigger, marked current device in Sync Hub, added App Share, and refined top blur.',
        ],
      },
      {
        version: '6.4',
        date: 'Update',
        notes: [
          'Fixed AI Explore with unified trip planning, smoothed globe transitions, and removed stray shadows on date pills.',
        ],
      },
      {
        version: '6.3',
        date: 'Update',
        notes: [
          'Fixed iPhone standalone PWA bottom safe-area gap so gradients and content extend cleanly to the screen edge.',
        ],
      },
      {
        version: '6.2',
        date: 'Update',
        notes: [
          'Added tactile travel buttons, morphing feedback, hold-to-delete, accent adaptation, and optional synthesized audio.',
        ],
      },
      {
        version: '6.1',
        date: 'Update',
        notes: [
          'Resolved Cloud Run port startup timeouts and dev client errors for reliable cross-device loading.',
        ],
      },
      {
        version: '6.0',
        date: 'Baseline',
        notes: [
          'Trilingual UI support, crisp geometric numerals, iPhone live status-bar sync, and 10m vector map backdrop.',
        ],
      },
    ];
  }
  if (lang === 'zh-CN') {
    return [
      {
        version: '6.8',
        date: '最新版本',
        notes: [
          '汇率换算改回当地货币在上、港币在下，双框皆支持整格点击弹出键盘并实时双向换算；修正免税进度环百分比重叠，达标触发 Pop 弹跳与小烟花特效。',
        ],
      },
      {
        version: '6.7',
        date: '更新记录',
        notes: [
          '新增 Google 日历单日与整趟一键批量加入，精简全站说明文字；百宝箱改版为单页免滚动多尺寸工具格，点击主卡片可查看完整时区天气与插座信息。',
        ],
      },
      {
        version: '6.6',
        date: '更新记录',
        notes: [
          '将加入日历整合至设置并为日历文件加入进度环动画，精简设置分享栏与移除易误触按钮；汇率新增免费实时刷新与全球目的地免税额度自动追踪。',
        ],
      },
      {
        version: '6.5',
        date: '更新记录',
        notes: [
          '改为手动点击才触发 AI 探索避免误耗额度；跨设备同步标示本机与他机，设置页新增分享本 App 与日历导出，并调整顶部模糊遮罩确保文字清晰。',
        ],
      },
      {
        version: '6.4',
        date: '更新记录',
        notes: [
          '修复 AI 探索推荐并整合行程规划为单一完整页面，优化首页切换旅程时背景地图滑动流畅度，并移除日期标签底部多余阴影，呈现轻盈悬浮视觉效果。',
        ],
      },
      {
        version: '6.3',
        date: '更新记录',
        notes: [
          '修复 iPhone 主屏幕网页应用底部导航栏下方的空白断层问题，动态补齐安全区域视窗高度，让背景渐变与页面内容完整延伸并贴合全屏幕边缘。',
        ],
      },
      {
        version: '6.2',
        date: '更新记录',
        notes: [
          '全面导入旅游触感互动按钮，包含路线对调、护照盖章、书签粒子、复制发送变形与长按防误触删除，并依日夜分页色系适配及新增按键音效开关。',
        ],
      },
      {
        version: '6.1',
        date: '更新记录',
        notes: [
          '修复云端容器启动超时与开发环境连接错误，强化服务器监听与启动流程，确保网页应用在各类设备与浏览器上皆能稳定连接并顺畅实时开启。',
        ],
      },
      {
        version: '6.0',
        date: '基础版本',
        notes: [
          '完整适配繁简中文与英文三语切换、几何无衬线字体、iPhone 状态栏日夜即时同步变色，以及 10m 超高清矢量地图背景与三分类 AI 探索体验。',
        ],
      },
    ];
  }
  return [
    {
      version: '6.8',
      date: '最新版本',
      notes: [
        '匯率換算改回當地貨幣在上、港幣在下，雙框皆支援整格點擊彈出鍵盤並即時雙向換算；修正免稅進度環百分比重疊，達標時觸發 Pop 彈跳與小煙花特效。',
      ],
    },
    {
      version: '6.7',
      date: '更新紀錄',
      notes: [
        '新增 Google 日曆單日與整趟一鍵批量加入，精簡全站說明文字；百寶箱改版為單頁免滾動多尺寸工具格，點擊主卡片可查看完整時區天氣與插座資訊。',
      ],
    },
    {
      version: '6.6',
      date: '更新紀錄',
      notes: [
        '將加入日曆整合至設定並為行事曆檔加入進度環動畫，精簡設定分享列與移除易誤觸按鈕；匯率新增免費實時刷新與全球目的地免稅額度自動追蹤。',
      ],
    },
    {
      version: '6.5',
      date: '更新紀錄',
      notes: [
        '改為手動點擊才觸發 AI 探索避免誤耗額度；跨裝置同步標示本機與他機，設定頁新增分享本 App 與日曆匯出，並調整頂部模糊遮罩確保按鈕文字清晰。',
      ],
    },
    {
      version: '6.4',
      date: '更新紀錄',
      notes: [
        '修復 AI 探索推薦並整合行程規劃為單一完整頁面，優化首頁切換旅程時背景地圖滑動流暢度，並移除日期標籤底部多餘陰影，呈現輕盈懸浮視覺效果。',
      ],
    },
    {
      version: '6.3',
      date: '更新紀錄',
      notes: [
        '修復 iPhone 主畫面網頁應用程式底部導覽列下方的空白斷層問題，動態補齊安全區域視窗高度，讓背景漸層與頁面內容完整延伸並貼合全螢幕邊緣。',
      ],
    },
    {
      version: '6.2',
      date: '更新紀錄',
      notes: [
        '全面導入旅遊觸感互動按鈕，包含路線對調、護照蓋章、書籤粒子、複製發送變形與長按防誤觸刪除，並依日夜分頁色系適配及新增按鍵音效開關。',
      ],
    },
    {
      version: '6.1',
      date: '更新紀錄',
      notes: [
        '修復雲端容器啟動逾時與開發環境連線錯誤，強化伺服器監聽與啟動流程，確保網頁應用程式在各類裝置與瀏覽器上皆能穩定連線並順暢即時開啟。',
      ],
    },
    {
      version: '6.0',
      date: '基礎版本',
      notes: [
        '完整支援繁簡中文與英文三語切換、幾何無襯線字體、iPhone 狀態欄日夜即時同步變色，以及 10m 超高清向量地圖背景與三分類 AI 探索體驗。',
      ],
    },
  ];
}
