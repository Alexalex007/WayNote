import { AppLanguage, localizeSinglePlaceToken, tr } from './i18n';

export interface DestinationAirport {
  code: string;
  name: string;
  query: string;
}

export interface DestinationIntel {
  cityQuery: string;
  displayCity: string;
  countryLabel: string;
  currency: string;
  currencyName: string;
  currencySymbol: string;
  utcOffsetHours: number;
  timezoneLabel: string;
  voltagePlug: string;
  emergency: string;
  taxFreeThreshold: number | null;
  taxFreeNote: string | null;
  airports: DestinationAirport[];
}

type LocalizedText = [string, string, string]; // [zh-TW, zh-CN, en]

function pickText(tuple: LocalizedText, lang: AppLanguage): string {
  return tr(lang, tuple[0], tuple[1], tuple[2]);
}

interface DestinationPreset {
  keywords: string[];
  cityQuery: string;
  countryLabel: LocalizedText;
  currency: string;
  currencyName: LocalizedText;
  currencySymbol: string;
  utcOffsetHours: number;
  timezoneLabel: string;
  voltagePlug: LocalizedText;
  emergency: LocalizedText;
  taxFreeThreshold: number | null;
  taxFreeNote: LocalizedText | null;
}

const JP_COMMON = {
  countryLabel: ['日本', '日本', 'Japan'] as LocalizedText,
  currency: 'JPY',
  currencyName: ['日圓', '日元', 'Japanese Yen'] as LocalizedText,
  currencySymbol: '¥',
  utcOffsetHours: 9,
  timezoneLabel: 'UTC+9',
  voltagePlug: ['100V · A型兩孔扁插', '100V · A型两孔扁插', '100V · Type A (Two-pin)'] as LocalizedText,
  emergency: ['報警 110 · 救護 119', '报警 110 · 急救 119', 'Police 110 · Ambulance 119'] as LocalizedText,
  taxFreeThreshold: 5000,
  taxFreeNote: [
    '日本未稅滿 ¥5,000 可享 10% 免稅',
    '日本未税满 ¥5,000 可享 10% 免税',
    '10% tax-free on purchases over ¥5,000 (excl. tax)',
  ] as LocalizedText,
};

const KR_COMMON = {
  countryLabel: ['韓國', '韩国', 'South Korea'] as LocalizedText,
  currency: 'KRW',
  currencyName: ['韓元', '韩元', 'South Korean Won'] as LocalizedText,
  currencySymbol: '₩',
  utcOffsetHours: 9,
  timezoneLabel: 'UTC+9',
  voltagePlug: ['220V · C/F型雙圓孔', '220V · C/F型双圆孔', '220V · Type C / F'] as LocalizedText,
  emergency: ['報警 112 · 救護 119', '报警 112 · 急救 119', 'Police 112 · Ambulance 119'] as LocalizedText,
  taxFreeThreshold: 15000,
  taxFreeNote: [
    '韓國單筆滿 ₩15,000 可申請現場／機場退稅',
    '韩国单笔满 ₩15,000 可申请现场／机场退税',
    'Tax refund available on receipts over ₩15,000',
  ] as LocalizedText,
};

const TW_COMMON = {
  countryLabel: ['台灣', '中国台湾', 'Taiwan'] as LocalizedText,
  currency: 'TWD',
  currencyName: ['新台幣', '新台币', 'New Taiwan Dollar'] as LocalizedText,
  currencySymbol: 'NT$',
  utcOffsetHours: 8,
  timezoneLabel: 'UTC+8',
  voltagePlug: ['110V · A/B型扁插', '110V · A/B型扁插', '110V · Type A / B'] as LocalizedText,
  emergency: ['報警 110 · 救護 119', '报警 110 · 急救 119', 'Police 110 · Ambulance 119'] as LocalizedText,
  taxFreeThreshold: 2000,
};

const PRESETS: DestinationPreset[] = [
  {
    keywords: ['東京', '东京', 'tokyo', '新宿', '澀谷', '涩谷', '淺草', '浅草', '銀座', '银座', '羽田', '成田'],
    cityQuery: 'Tokyo',
    ...JP_COMMON,
  },
  {
    keywords: ['大阪', 'osaka', '關西', '关西', '難波', '难波', '心齋橋', '心斋桥', '梅田'],
    cityQuery: 'Osaka',
    ...JP_COMMON,
  },
  {
    keywords: ['京都', 'kyoto', '嵐山', '岚山', '宇治'],
    cityQuery: 'Kyoto',
    ...JP_COMMON,
  },
  {
    keywords: ['札幌', '北海道', 'sapporo', 'hokkaido', '函館', '函馆', '小樽'],
    cityQuery: 'Sapporo',
    ...JP_COMMON,
  },
  {
    keywords: ['沖繩', '冲绳', '那霸', 'okinawa', 'naha'],
    cityQuery: 'Naha',
    ...JP_COMMON,
  },
  {
    keywords: ['福岡', '福冈', '九州', '名古屋', '仙台', '神戶', '神户', '奈良', '橫濱', '横滨', '日本', 'japan', 'fukuoka', 'nagoya'],
    cityQuery: 'Fukuoka',
    ...JP_COMMON,
  },
  {
    keywords: ['首爾', '首尔', 'seoul', '韓國', '韩国', 'korea', '仁川', '弘大', '明洞'],
    cityQuery: 'Seoul',
    ...KR_COMMON,
  },
  {
    keywords: ['釜山', 'busan'],
    cityQuery: 'Busan',
    ...KR_COMMON,
  },
  {
    keywords: ['濟州', '济州', 'jeju'],
    cityQuery: 'Jeju',
    ...KR_COMMON,
  },
  {
    keywords: ['台北', '臺北', '新北', '台灣', 'taipei', 'taiwan', '桃園', '桃园', '基隆'],
    cityQuery: 'Taipei',
    ...TW_COMMON,
    taxFreeNote: [
      '外籍旅客同店同日滿 NT$2,000 可退稅',
      '外籍旅客同店同日满 NT$2,000 可退税',
      'Foreign visitors eligible for tax refund over NT$2,000/day',
    ],
  },
  {
    keywords: ['高雄', '台中', '臺中', '台南', '臺南', '花蓮', '花莲', '宜蘭', '宜兰', 'kaohsiung', 'taichung', 'tainan'],
    cityQuery: 'Kaohsiung',
    ...TW_COMMON,
    taxFreeNote: null,
  },
  {
    keywords: ['香港', 'hong kong', '九龍', '九龙', '港島', '港岛'],
    cityQuery: 'Hong Kong',
    countryLabel: ['香港', '中国香港', 'Hong Kong'],
    currency: 'HKD',
    currencyName: ['港幣', '港币', 'Hong Kong Dollar'],
    currencySymbol: 'HK$',
    utcOffsetHours: 8,
    timezoneLabel: 'UTC+8',
    voltagePlug: ['220V · G型英式三方孔', '220V · G型英式三方孔', '220V · Type G (UK)'] as LocalizedText,
    emergency: ['報警／救護 999', '报警／急救 999', 'Emergency 999'],
    taxFreeThreshold: null,
    taxFreeNote: ['香港為免稅港（無一般消費稅）', '香港为免税港（无一般消费税）', 'Hong Kong is a tax-free port (no sales tax / VAT)'],
  },
  {
    keywords: ['澳門', '澳门', 'macau', 'macao'],
    cityQuery: 'Macau',
    countryLabel: ['澳門', '中国澳门', 'Macau'],
    currency: 'MOP',
    currencyName: ['澳門幣', '澳门币', 'Macanese Pataca'],
    currencySymbol: 'MOP$',
    utcOffsetHours: 8,
    timezoneLabel: 'UTC+8',
    voltagePlug: ['220V · G型英式三方孔', '220V · G型英式三方孔', '220V · Type G (UK)'],
    emergency: ['報警／救護 999', '报警／急救 999', 'Emergency 999'],
    taxFreeThreshold: null,
    taxFreeNote: null,
  },
  {
    keywords: ['曼谷', 'bangkok', '泰國', '泰国', 'thailand'],
    cityQuery: 'Bangkok',
    countryLabel: ['泰國', '泰国', 'Thailand'],
    currency: 'THB',
    currencyName: ['泰銖', '泰铢', 'Thai Baht'],
    currencySymbol: '฿',
    utcOffsetHours: 7,
    timezoneLabel: 'UTC+7',
    voltagePlug: ['220V · A/B/C型插座', '220V · A/B/C型插座', '220V · Type A / B / C'],
    emergency: ['觀光警察 1155 · 救護 1669', '旅游警察 1155 · 急救 1669', 'Tourist Police 1155 · Ambulance 1669'],
    taxFreeThreshold: 2000,
    taxFreeNote: ['泰國同日同店滿 ฿2,000 可申請 VAT 退稅', '泰国同日同店满 ฿2,000 可申请 VAT 退税', 'VAT refund available on same-day spend over ฿2,000'],
  },
  {
    keywords: ['清邁', '清迈', 'chiang mai', '普吉', 'phuket'],
    cityQuery: 'Chiang Mai',
    countryLabel: ['泰國', '泰国', 'Thailand'],
    currency: 'THB',
    currencyName: ['泰銖', '泰铢', 'Thai Baht'],
    currencySymbol: '฿',
    utcOffsetHours: 7,
    timezoneLabel: 'UTC+7',
    voltagePlug: ['220V · A/B/C型插座', '220V · A/B/C型插座', '220V · Type A / B / C'],
    emergency: ['觀光警察 1155 · 救護 1669', '旅游警察 1155 · 急救 1669', 'Tourist Police 1155 · Ambulance 1669'],
    taxFreeThreshold: 2000,
    taxFreeNote: ['泰國同日同店滿 ฿2,000 可申請 VAT 退稅', '泰国同日同店满 ฿2,000 可申请 VAT 退税', 'VAT refund available on same-day spend over ฿2,000'],
  },
  {
    keywords: ['新加坡', 'singapore'],
    cityQuery: 'Singapore',
    countryLabel: ['新加坡', '新加坡', 'Singapore'],
    currency: 'SGD',
    currencyName: ['新加坡幣', '新加坡元', 'Singapore Dollar'],
    currencySymbol: 'S$',
    utcOffsetHours: 8,
    timezoneLabel: 'UTC+8',
    voltagePlug: ['230V · G型英式三方孔', '230V · G型英式三方孔', '230V · Type G (UK)'],
    emergency: ['報警 999 · 救護 995', '报警 999 · 急救 995', 'Police 999 · Ambulance 995'],
    taxFreeThreshold: 100,
    taxFreeNote: ['新加坡同店滿 S$100 可申請 eTRS 退稅', '新加坡同店满 S$100 可申请 eTRS 退税', 'eTRS GST refund available on spend over S$100'],
  },
  {
    keywords: ['吉隆坡', 'kuala lumpur', '馬來西亞', '马来西亚', 'malaysia', '檳城', '槟城', '沙巴'],
    cityQuery: 'Kuala Lumpur',
    countryLabel: ['馬來西亞', '马来西亚', 'Malaysia'],
    currency: 'MYR',
    currencyName: ['馬來西亞林吉特', '马来西亚林吉特', 'Malaysian Ringgit'],
    currencySymbol: 'RM',
    utcOffsetHours: 8,
    timezoneLabel: 'UTC+8',
    voltagePlug: ['240V · G型英式三方孔', '240V · G型英式三方孔', '240V · Type G (UK)'],
    emergency: ['緊急救援 999', '紧急救援 999', 'Emergency 999'],
    taxFreeThreshold: null,
    taxFreeNote: null,
  },
  {
    keywords: ['胡志明', '河內', '河内', '峴港', '岘港', '越南', 'vietnam', 'hanoi', 'ho chi minh', 'danang'],
    cityQuery: 'Ho Chi Minh City',
    countryLabel: ['越南', '越南', 'Vietnam'],
    currency: 'VND',
    currencyName: ['越南盾', '越南盾', 'Vietnamese Dong'],
    currencySymbol: '₫',
    utcOffsetHours: 7,
    timezoneLabel: 'UTC+7',
    voltagePlug: ['220V · A/C型插座', '220V · A/C型插座', '220V · Type A / C'],
    emergency: ['報警 113 · 救護 115', '报警 113 · 急救 115', 'Police 113 · Ambulance 115'],
    taxFreeThreshold: 2000000,
    taxFreeNote: ['越南同日同店滿 ₫2,000,000 可退稅', '越南同日同店满 ₫2,000,000 可退税', 'VAT refund available on spend over ₫2,000,000'],
  },
  {
    keywords: ['峇里島', '巴厘岛', '雅加達', '雅加达', '印尼', 'bali', 'jakarta', 'indonesia'],
    cityQuery: 'Denpasar',
    countryLabel: ['印尼', '印尼', 'Indonesia'],
    currency: 'IDR',
    currencyName: ['印尼盾', '印尼盾', 'Indonesian Rupiah'],
    currencySymbol: 'Rp',
    utcOffsetHours: 8,
    timezoneLabel: 'UTC+8',
    voltagePlug: ['230V · C/F型雙圓孔', '230V · C/F型双圆孔', '230V · Type C / F'],
    emergency: ['緊急救援 112', '紧急救援 112', 'Emergency 112'],
    taxFreeThreshold: null,
    taxFreeNote: null,
  },
  {
    keywords: ['馬尼拉', '马尼拉', '宿霧', '宿务', '長灘島', '长滩岛', '菲律賓', '菲律宾', 'manila', 'cebu', 'philippines'],
    cityQuery: 'Manila',
    countryLabel: ['菲律賓', '菲律宾', 'Philippines'],
    currency: 'PHP',
    currencyName: ['菲律賓披索', '菲律宾比索', 'Philippine Peso'],
    currencySymbol: '₱',
    utcOffsetHours: 8,
    timezoneLabel: 'UTC+8',
    voltagePlug: ['220V · A/B/C型插座', '220V · A/B/C型插座', '220V · Type A / B / C'],
    emergency: ['緊急救援 911', '紧急救援 911', 'Emergency 911'],
    taxFreeThreshold: null,
    taxFreeNote: null,
  },
  {
    keywords: ['上海', '北京', '廣州', '广州', '深圳', '成都', '重慶', '重庆', '杭州', '西安', '中國', '中国', 'shanghai', 'beijing'],
    cityQuery: 'Shanghai',
    countryLabel: ['中國', '中国', 'China'],
    currency: 'CNY',
    currencyName: ['人民幣', '人民币', 'Chinese Yuan'],
    currencySymbol: '¥',
    utcOffsetHours: 8,
    timezoneLabel: 'UTC+8',
    voltagePlug: ['220V · A/I型插座', '220V · A/I型插座', '220V · Type A / I'],
    emergency: ['報警 110 · 救護 120', '报警 110 · 急救 120', 'Police 110 · Ambulance 120'],
    taxFreeThreshold: 500,
    taxFreeNote: ['同店同日滿 ¥500 可辦理離境退稅', '同店同日满 ¥500 可办理离境退税', 'Departure tax refund available over ¥500/day'],
  },
  {
    keywords: ['倫敦', '伦敦', '愛丁堡', '爱丁堡', '曼徹斯特', '曼彻斯特', '英國', '英国', 'london', 'uk', 'england', 'edinburgh'],
    cityQuery: 'London',
    countryLabel: ['英國', '英国', 'United Kingdom'],
    currency: 'GBP',
    currencyName: ['英鎊', '英镑', 'British Pound'],
    currencySymbol: '£',
    utcOffsetHours: 0,
    timezoneLabel: 'UTC+0',
    voltagePlug: ['230V · G型英式三方孔', '230V · G型英式三方孔', '230V · Type G (UK)'],
    emergency: ['緊急救援 999 / 112', '紧急救援 999 / 112', 'Emergency 999 / 112'],
    taxFreeThreshold: null,
    taxFreeNote: null,
  },
  {
    keywords: ['巴黎', 'paris', '法國', '法国', 'france', '尼斯', '里昂'],
    cityQuery: 'Paris',
    countryLabel: ['法國', '法国', 'France'],
    currency: 'EUR',
    currencyName: ['歐元', '欧元', 'Euro'],
    currencySymbol: '€',
    utcOffsetHours: 1,
    timezoneLabel: 'UTC+1',
    voltagePlug: ['230V · E/C型雙圓孔', '230V · E/C型双圆孔', '230V · Type E / C'],
    emergency: ['歐盟緊急 112', '欧盟紧急 112', 'EU Emergency 112'],
    taxFreeThreshold: 100.01,
    taxFreeNote: ['法國單筆滿 €100.01 可申請 VAT 退稅', '法国单笔满 €100.01 可申请 VAT 退税', 'VAT refund available on receipts over €100.01'],
  },
  {
    keywords: ['羅馬', '罗马', '米蘭', '米兰', '威尼斯', '佛羅倫斯', '佛罗伦萨', '義大利', '意大利', 'rome', 'milan', 'venice', 'italy'],
    cityQuery: 'Rome',
    countryLabel: ['義大利', '意大利', 'Italy'],
    currency: 'EUR',
    currencyName: ['歐元', '欧元', 'Euro'],
    currencySymbol: '€',
    utcOffsetHours: 1,
    timezoneLabel: 'UTC+1',
    voltagePlug: ['230V · F/L型插座', '230V · F/L型插座', '230V · Type F / L'],
    emergency: ['歐盟緊急 112', '欧盟紧急 112', 'EU Emergency 112'],
    taxFreeThreshold: 70.01,
    taxFreeNote: ['義大利滿 €70.01 可申請退稅', '意大利满 €70.01 可申请退税', 'VAT refund available on receipts over €70.01'],
  },
  {
    keywords: ['柏林', '慕尼黑', '法蘭克福', '法兰克福', '德國', '德国', 'berlin', 'munich', 'frankfurt', 'germany'],
    cityQuery: 'Munich',
    countryLabel: ['德國', '德国', 'Germany'],
    currency: 'EUR',
    currencyName: ['歐元', '欧元', 'Euro'],
    currencySymbol: '€',
    utcOffsetHours: 1,
    timezoneLabel: 'UTC+1',
    voltagePlug: ['230V · C/F型雙圓孔', '230V · C/F型双圆孔', '230V · Type C / F'],
    emergency: ['歐盟緊急 112', '欧盟紧急 112', 'EU Emergency 112'],
    taxFreeThreshold: 50,
    taxFreeNote: ['德國單筆滿 €50 可申請退稅', '德国单笔满 €50 可申请退税', 'VAT refund available on receipts over €50'],
  },
  {
    keywords: ['巴塞隆納', '巴塞罗那', '馬德里', '马德里', '西班牙', 'barcelona', 'madrid', 'spain', '阿姆斯特丹', '荷蘭', '荷兰', 'amsterdam', '維也納', '维也纳', '奧地利', '奥地利', 'vienna'],
    cityQuery: 'Barcelona',
    countryLabel: ['歐洲申根區', '欧洲申根区', 'Schengen Europe'],
    currency: 'EUR',
    currencyName: ['歐元', '欧元', 'Euro'],
    currencySymbol: '€',
    utcOffsetHours: 1,
    timezoneLabel: 'UTC+1',
    voltagePlug: ['230V · C/F型雙圓孔', '230V · C/F型双圆孔', '230V · Type C / F'],
    emergency: ['歐盟緊急 112', '欧盟紧急 112', 'EU Emergency 112'],
    taxFreeThreshold: null,
    taxFreeNote: null,
  },
  {
    keywords: ['布拉格', '捷克', 'prague', 'czech'],
    cityQuery: 'Prague',
    countryLabel: ['捷克', '捷克', 'Czechia'],
    currency: 'CZK',
    currencyName: ['捷克克朗', '捷克克朗', 'Czech Koruna'],
    currencySymbol: 'Kč',
    utcOffsetHours: 1,
    timezoneLabel: 'UTC+1',
    voltagePlug: ['230V · E型雙圓孔', '230V · E型双圆孔', '230V · Type E'],
    emergency: ['歐盟緊急 112', '欧盟紧急 112', 'EU Emergency 112'],
    taxFreeThreshold: 2001,
    taxFreeNote: ['捷克單筆滿 2,001 Kč 可申請退稅', '捷克单笔满 2,001 Kč 可申请退税', 'VAT refund available on receipts over 2,001 Kč'],
  },
  {
    keywords: ['雷克雅維克', '雷克雅未克', '冰島', '冰岛', 'reykjavik', 'iceland'],
    cityQuery: 'Reykjavik',
    countryLabel: ['冰島', '冰岛', 'Iceland'],
    currency: 'ISK',
    currencyName: ['冰島克朗', '冰岛克朗', 'Icelandic Króna'],
    currencySymbol: 'kr',
    utcOffsetHours: 0,
    timezoneLabel: 'UTC+0',
    voltagePlug: ['230V · C/F型雙圓孔', '230V · C/F型双圆孔', '230V · Type C / F'],
    emergency: ['緊急救援 112', '紧急救援 112', 'Emergency 112'],
    taxFreeThreshold: 6000,
    taxFreeNote: ['冰島單筆滿 ISK 6,000 可申請退稅', '冰岛单笔满 ISK 6,000 可申请退税', 'Tax refund available on receipts over ISK 6,000'],
  },
  {
    keywords: ['蘇黎世', '苏黎世', '日內瓦', '日内瓦', '策馬特', '采尔马特', '因特拉肯', '瑞士', 'zurich', 'geneva', 'switzerland'],
    cityQuery: 'Zurich',
    countryLabel: ['瑞士', '瑞士', 'Switzerland'],
    currency: 'CHF',
    currencyName: ['瑞士法郎', '瑞士法郎', 'Swiss Franc'],
    currencySymbol: 'Fr',
    utcOffsetHours: 1,
    timezoneLabel: 'UTC+1',
    voltagePlug: ['230V · J型三圓孔', '230V · J型三圆孔', '230V · Type J'],
    emergency: ['緊急救援 112 / 144', '紧急救援 112 / 144', 'Emergency 112 / 144'],
    taxFreeThreshold: 300,
    taxFreeNote: ['瑞士滿 CHF 300 可辦理退稅', '瑞士满 CHF 300 可办理退税', 'VAT refund available on spend over CHF 300'],
  },
  {
    keywords: ['紐約', '纽约', '洛杉磯', '洛杉矶', '舊金山', '旧金山', '西雅圖', '西雅图', '拉斯維加斯', '拉斯维加斯', '芝加哥', '夏威夷', '美國', '美国', 'new york', 'los angeles', 'san francisco', 'usa'],
    cityQuery: 'New York',
    countryLabel: ['美國', '美国', 'United States'],
    currency: 'USD',
    currencyName: ['美元', '美元', 'US Dollar'],
    currencySymbol: '$',
    utcOffsetHours: -5,
    timezoneLabel: 'UTC-5',
    voltagePlug: ['120V · A/B型扁插', '120V · A/B型扁插', '120V · Type A / B'],
    emergency: ['緊急救援 911', '紧急救援 911', 'Emergency 911'],
    taxFreeThreshold: null,
    taxFreeNote: null,
  },
  {
    keywords: ['雪梨', '悉尼', '墨爾本', '墨尔本', '布里斯本', '布里斯班', '澳洲', '澳大利亚', 'sydney', 'melbourne', 'australia'],
    cityQuery: 'Sydney',
    countryLabel: ['澳洲', '澳大利亚', 'Australia'],
    currency: 'AUD',
    currencyName: ['澳幣', '澳元', 'Australian Dollar'],
    currencySymbol: 'A$',
    utcOffsetHours: 10,
    timezoneLabel: 'UTC+10',
    voltagePlug: ['230V · I型八字扁插', '230V · I型八字扁插', '230V · Type I'],
    emergency: ['緊急救援 000', '紧急救援 000', 'Emergency 000'],
    taxFreeThreshold: 300,
    taxFreeNote: ['澳洲同商號滿 A$300 可申請 TRS 退稅', '澳洲同商号满 A$300 可申请 TRS 退税', 'TRS GST refund available on spend over A$300'],
  },
  {
    keywords: ['奧克蘭', '奥克兰', '皇后鎮', '皇后镇', '紐西蘭', '新西兰', 'auckland', 'queenstown', 'new zealand'],
    cityQuery: 'Auckland',
    countryLabel: ['紐西蘭', '新西兰', 'New Zealand'],
    currency: 'NZD',
    currencyName: ['紐西蘭元', '新西兰元', 'New Zealand Dollar'],
    currencySymbol: 'NZ$',
    utcOffsetHours: 12,
    timezoneLabel: 'UTC+12',
    voltagePlug: ['230V · I型八字扁插', '230V · I型八字扁插', '230V · Type I'],
    emergency: ['緊急救援 111', '紧急救援 111', 'Emergency 111'],
    taxFreeThreshold: null,
    taxFreeNote: null,
  },
  {
    keywords: ['溫哥華', '温哥华', '多倫多', '多伦多', '班夫', '加拿大', 'vancouver', 'toronto', 'canada'],
    cityQuery: 'Vancouver',
    countryLabel: ['加拿大', '加拿大', 'Canada'],
    currency: 'CAD',
    currencyName: ['加幣', '加元', 'Canadian Dollar'],
    currencySymbol: 'C$',
    utcOffsetHours: -8,
    timezoneLabel: 'UTC-8',
    voltagePlug: ['120V · A/B型扁插', '120V · A/B型扁插', '120V · Type A / B'],
    emergency: ['緊急救援 911', '紧急救援 911', 'Emergency 911'],
    taxFreeThreshold: null,
    taxFreeNote: null,
  },
  {
    keywords: ['杜拜', '迪拜', '阿布達比', '阿布扎比', '阿聯酋', '阿联酋', 'dubai', 'uae'],
    cityQuery: 'Dubai',
    countryLabel: ['阿聯酋', '阿联酋', 'UAE'],
    currency: 'AED',
    currencyName: ['阿聯酋迪拉姆', '阿联酋迪拉姆', 'UAE Dirham'],
    currencySymbol: 'AED',
    utcOffsetHours: 4,
    timezoneLabel: 'UTC+4',
    voltagePlug: ['230V · G型英式三方孔', '230V · G型英式三方孔', '230V · Type G (UK)'],
    emergency: ['報警 999 · 救護 998', '报警 999 · 急救 998', 'Police 999 · Ambulance 998'],
    taxFreeThreshold: 250,
    taxFreeNote: ['杜拜單筆滿 AED 250 可辦理退稅', '迪拜单笔满 AED 250 可办理退税', 'VAT refund available on receipts over AED 250'],
  },
  {
    keywords: ['伊斯坦堡', '伊斯坦布尔', '卡帕多奇亞', '卡帕多奇亚', '土耳其', 'istanbul', 'turkey'],
    cityQuery: 'Istanbul',
    countryLabel: ['土耳其', '土耳其', 'Türkiye'],
    currency: 'TRY',
    currencyName: ['土耳其里拉', '土耳其里拉', 'Turkish Lira'],
    currencySymbol: '₺',
    utcOffsetHours: 3,
    timezoneLabel: 'UTC+3',
    voltagePlug: ['220V · C/F型雙圓孔', '220V · C/F型双圆孔', '220V · Type C / F'],
    emergency: ['緊急救援 112', '紧急救援 112', 'Emergency 112'],
    taxFreeThreshold: null,
    taxFreeNote: null,
  },
];

interface AirportRaw {
  code: string;
  names: LocalizedText;
  query: string;
}

const CITY_AIRPORTS: Record<string, AirportRaw[]> = {
  Tokyo: [
    { code: 'NRT', names: ['成田國際機場 (NRT)', '成田国际机场 (NRT)', 'Narita International Airport (NRT)'], query: 'Narita International Airport Tokyo' },
    { code: 'HND', names: ['羽田機場 (HND)', '羽田机场 (HND)', 'Haneda Airport (HND)'], query: 'Haneda Airport Tokyo' },
  ],
  Osaka: [
    { code: 'KIX', names: ['關西國際機場 (KIX)', '关西国际机场 (KIX)', 'Kansai International Airport (KIX)'], query: 'Kansai International Airport Osaka' },
    { code: 'ITM', names: ['大阪伊丹機場 (ITM)', '大阪伊丹机场 (ITM)', 'Osaka Itami Airport (ITM)'], query: 'Osaka International Airport Itami' },
  ],
  Kyoto: [
    { code: 'KIX', names: ['關西國際機場 (KIX)', '关西国际机场 (KIX)', 'Kansai International Airport (KIX)'], query: 'Kansai International Airport' },
    { code: 'ITM', names: ['大阪伊丹機場 (ITM)', '大阪伊丹机场 (ITM)', 'Osaka Itami Airport (ITM)'], query: 'Osaka International Airport Itami' },
  ],
  Sapporo: [
    { code: 'CTS', names: ['新千歲機場 (CTS)', '新千岁机场 (CTS)', 'New Chitose Airport (CTS)'], query: 'New Chitose Airport Sapporo' },
    { code: 'OKD', names: ['札幌丘珠機場 (OKD)', '札幌丘珠机场 (OKD)', 'Sapporo Okadama Airport (OKD)'], query: 'Sapporo Okadama Airport' },
  ],
  Naha: [{ code: 'OKA', names: ['那霸機場 (OKA)', '那霸机场 (OKA)', 'Naha Airport (OKA)'], query: 'Naha Airport Okinawa' }],
  Fukuoka: [{ code: 'FUK', names: ['福岡機場 (FUK)', '福冈机场 (FUK)', 'Fukuoka Airport (FUK)'], query: 'Fukuoka Airport' }],
  Seoul: [
    { code: 'ICN', names: ['仁川國際機場 (ICN)', '仁川国际机场 (ICN)', 'Incheon International Airport (ICN)'], query: 'Incheon International Airport Seoul' },
    { code: 'GMP', names: ['金浦國際機場 (GMP)', '金浦国际机场 (GMP)', 'Gimpo International Airport (GMP)'], query: 'Gimpo International Airport Seoul' },
  ],
  Busan: [{ code: 'PUS', names: ['金海國際機場 (PUS)', '金海国际机场 (PUS)', 'Gimhae International Airport (PUS)'], query: 'Gimhae International Airport Busan' }],
  Jeju: [{ code: 'CJU', names: ['濟州國際機場 (CJU)', '济州国际机场 (CJU)', 'Jeju International Airport (CJU)'], query: 'Jeju International Airport' }],
  Taipei: [
    { code: 'TPE', names: ['桃園國際機場 (TPE)', '桃园国际机场 (TPE)', 'Taoyuan International Airport (TPE)'], query: 'Taoyuan International Airport' },
    { code: 'TSA', names: ['台北松山機場 (TSA)', '台北松山机场 (TSA)', 'Taipei Songshan Airport (TSA)'], query: 'Taipei Songshan Airport' },
  ],
  Kaohsiung: [{ code: 'KHH', names: ['高雄小港機場 (KHH)', '高雄小港机场 (KHH)', 'Kaohsiung International Airport (KHH)'], query: 'Kaohsiung International Airport' }],
  'Hong Kong': [{ code: 'HKG', names: ['香港國際機場 (HKG)', '香港国际机场 (HKG)', 'Hong Kong International Airport (HKG)'], query: 'Hong Kong International Airport' }],
  Macau: [{ code: 'MFM', names: ['澳門國際機場 (MFM)', '澳门国际机场 (MFM)', 'Macau International Airport (MFM)'], query: 'Macau International Airport' }],
  Bangkok: [
    { code: 'BKK', names: ['蘇凡納布機場 (BKK)', '素万那普机场 (BKK)', 'Suvarnabhumi Airport (BKK)'], query: 'Suvarnabhumi Airport Bangkok' },
    { code: 'DMK', names: ['廊曼國際機場 (DMK)', '廊曼国际机场 (DMK)', 'Don Mueang International Airport (DMK)'], query: 'Don Mueang International Airport Bangkok' },
  ],
  'Chiang Mai': [{ code: 'CNX', names: ['清邁國際機場 (CNX)', '清迈国际机场 (CNX)', 'Chiang Mai International Airport (CNX)'], query: 'Chiang Mai International Airport' }],
  Singapore: [{ code: 'SIN', names: ['新加坡樟宜機場 (SIN)', '新加坡樟宜机场 (SIN)', 'Singapore Changi Airport (SIN)'], query: 'Singapore Changi Airport' }],
  'Kuala Lumpur': [
    { code: 'KUL', names: ['吉隆坡國際機場 (KUL)', '吉隆坡国际机场 (KUL)', 'Kuala Lumpur International Airport (KUL)'], query: 'Kuala Lumpur International Airport' },
    { code: 'SZB', names: ['梳邦機場 (SZB)', '梳邦机场 (SZB)', 'Subang Airport (SZB)'], query: 'Sultan Abdul Aziz Shah Airport Subang' },
  ],
  'Ho Chi Minh City': [{ code: 'SGN', names: ['新山一國際機場 (SGN)', '新山一国际机场 (SGN)', 'Tan Son Nhat International Airport (SGN)'], query: 'Tan Son Nhat International Airport' }],
  Denpasar: [{ code: 'DPS', names: ['峇里島伍拉賴機場 (DPS)', '巴厘岛伍拉赖机场 (DPS)', 'Ngurah Rai International Airport (DPS)'], query: 'Ngurah Rai International Airport Bali' }],
  Manila: [{ code: 'MNL', names: ['尼諾伊亞基諾機場 (MNL)', '尼诺伊·阿基诺国际机场 (MNL)', 'Ninoy Aquino International Airport (MNL)'], query: 'Ninoy Aquino International Airport Manila' }],
  Shanghai: [
    { code: 'PVG', names: ['浦東國際機場 (PVG)', '浦东国际机场 (PVG)', 'Shanghai Pudong International Airport (PVG)'], query: 'Shanghai Pudong International Airport' },
    { code: 'SHA', names: ['虹橋國際機場 (SHA)', '虹桥国际机场 (SHA)', 'Shanghai Hongqiao International Airport (SHA)'], query: 'Shanghai Hongqiao International Airport' },
  ],
  Hangzhou: [{ code: 'HGH', names: ['杭州蕭山國際機場 (HGH)', '杭州萧山国际机场 (HGH)', 'Hangzhou Xiaoshan International Airport (HGH)'], query: 'Hangzhou Xiaoshan International Airport' }],
  Beijing: [
    { code: 'PEK', names: ['北京首都國際機場 (PEK)', '北京首都国际机场 (PEK)', 'Beijing Capital International Airport (PEK)'], query: 'Beijing Capital International Airport' },
    { code: 'PKX', names: ['北京大興國際機場 (PKX)', '北京大兴国际机场 (PKX)', 'Beijing Daxing International Airport (PKX)'], query: 'Beijing Daxing International Airport' },
  ],
  Guangzhou: [{ code: 'CAN', names: ['廣州白雲國際機場 (CAN)', '广州白云国际机场 (CAN)', 'Guangzhou Baiyun International Airport (CAN)'], query: 'Guangzhou Baiyun International Airport' }],
  Shenzhen: [{ code: 'SZX', names: ['深圳寶安國際機場 (SZX)', '深圳宝安国际机场 (SZX)', 'Shenzhen Baoan International Airport (SZX)'], query: 'Shenzhen Baoan International Airport' }],
  Chengdu: [
    { code: 'TFU', names: ['成都天府國際機場 (TFU)', '成都天府国际机场 (TFU)', 'Chengdu Tianfu International Airport (TFU)'], query: 'Chengdu Tianfu International Airport' },
    { code: 'CTU', names: ['成都雙流國際機場 (CTU)', '成都双流国际机场 (CTU)', 'Chengdu Shuangliu International Airport (CTU)'], query: 'Chengdu Shuangliu International Airport' },
  ],
  Chongqing: [{ code: 'CKG', names: ['重慶江北國際機場 (CKG)', '重庆江北国际机场 (CKG)', 'Chongqing Jiangbei International Airport (CKG)'], query: 'Chongqing Jiangbei International Airport' }],
  "Xi'an": [{ code: 'XIY', names: ['西安咸陽國際機場 (XIY)', '西安咸阳国际机场 (XIY)', "Xi'an Xianyang International Airport (XIY)"], query: "Xi'an Xianyang International Airport" }],
  London: [
    { code: 'LHR', names: ['希斯洛機場 (LHR)', '希思罗机场 (LHR)', 'London Heathrow Airport (LHR)'], query: 'London Heathrow Airport' },
    { code: 'LGW', names: ['蓋威克機場 (LGW)', '盖特威克机场 (LGW)', 'London Gatwick Airport (LGW)'], query: 'London Gatwick Airport' },
    { code: 'LCY', names: ['倫敦城市機場 (LCY)', '伦敦城市机场 (LCY)', 'London City Airport (LCY)'], query: 'London City Airport' },
  ],
  Paris: [
    { code: 'CDG', names: ['戴高樂機場 (CDG)', '戴高乐机场 (CDG)', 'Charles de Gaulle Airport (CDG)'], query: 'Charles de Gaulle Airport Paris' },
    { code: 'ORY', names: ['奧利機場 (ORY)', '奥利机场 (ORY)', 'Paris Orly Airport (ORY)'], query: 'Paris Orly Airport' },
  ],
  Rome: [
    { code: 'FCO', names: ['費米齊諾機場 (FCO)', '菲乌米奇诺机场 (FCO)', 'Rome Fiumicino Airport (FCO)'], query: 'Leonardo da Vinci Rome Fiumicino Airport' },
    { code: 'CIA', names: ['錢皮諾機場 (CIA)', '钱皮诺机场 (CIA)', 'Rome Ciampino Airport (CIA)'], query: 'Rome Ciampino Airport' },
  ],
  Munich: [{ code: 'MUC', names: ['慕尼黑機場 (MUC)', '慕尼黑机场 (MUC)', 'Munich Airport (MUC)'], query: 'Munich Airport' }],
  Barcelona: [{ code: 'BCN', names: ['巴塞隆納機場 (BCN)', '巴塞罗那机场 (BCN)', 'Barcelona El Prat Airport (BCN)'], query: 'Barcelona El Prat Airport' }],
  Zurich: [{ code: 'ZRH', names: ['蘇黎世機場 (ZRH)', '苏黎世机场 (ZRH)', 'Zurich Airport (ZRH)'], query: 'Zurich Airport' }],
  'New York': [
    { code: 'JFK', names: ['甘迺迪國際機場 (JFK)', '肯尼迪国际机场 (JFK)', 'John F. Kennedy International Airport (JFK)'], query: 'John F. Kennedy International Airport New York' },
    { code: 'EWR', names: ['紐華克自由機場 (EWR)', '纽瓦克自由国际机场 (EWR)', 'Newark Liberty International Airport (EWR)'], query: 'Newark Liberty International Airport' },
    { code: 'LGA', names: ['拉瓜地亞機場 (LGA)', '拉瓜迪亚机场 (LGA)', 'LaGuardia Airport (LGA)'], query: 'LaGuardia Airport New York' },
  ],
  Sydney: [{ code: 'SYD', names: ['雪梨機場 (SYD)', '悉尼机场 (SYD)', 'Sydney Kingsford Smith Airport (SYD)'], query: 'Sydney Kingsford Smith Airport' }],
  Auckland: [{ code: 'AKL', names: ['奧克蘭機場 (AKL)', '奥克兰机场 (AKL)', 'Auckland Airport (AKL)'], query: 'Auckland Airport' }],
  Vancouver: [{ code: 'YVR', names: ['溫哥華國際機場 (YVR)', '温哥华国际机场 (YVR)', 'Vancouver International Airport (YVR)'], query: 'Vancouver International Airport' }],
  Dubai: [
    { code: 'DXB', names: ['杜拜國際機場 (DXB)', '迪拜国际机场 (DXB)', 'Dubai International Airport (DXB)'], query: 'Dubai International Airport' },
    { code: 'DWC', names: ['阿勒馬克圖姆機場 (DWC)', '阿勒马克图姆机场 (DWC)', 'Al Maktoum International Airport (DWC)'], query: 'Al Maktoum International Airport Dubai' },
  ],
  Istanbul: [
    { code: 'IST', names: ['伊斯坦堡機場 (IST)', '伊斯坦布尔机场 (IST)', 'Istanbul Airport (IST)'], query: 'Istanbul Airport' },
    { code: 'SAW', names: ['薩比哈格克琴機場 (SAW)', '萨比哈·格克琴机场 (SAW)', 'Sabiha Gokcen International Airport (SAW)'], query: 'Sabiha Gokcen International Airport Istanbul' },
  ],
};

const SPECIFIC_CITY_QUERIES: Array<[string[], string]> = [
  [['杭州', 'hangzhou', '西湖'], 'Hangzhou'],
  [['北京', 'beijing'], 'Beijing'],
  [['上海', 'shanghai'], 'Shanghai'],
  [['廣州', '广州', 'guangzhou'], 'Guangzhou'],
  [['深圳', 'shenzhen'], 'Shenzhen'],
  [['成都', 'chengdu'], 'Chengdu'],
  [['重慶', '重庆', 'chongqing'], 'Chongqing'],
  [['西安', 'xian', "xi'an"], "Xi'an"],
  [['蘇州', '苏州', 'suzhou'], 'Suzhou'],
  [['南京', 'nanjing'], 'Nanjing'],
  [['廈門', '厦门', 'xiamen'], 'Xiamen'],
  [['青島', '青岛', 'qingdao'], 'Qingdao'],
  [['哈爾濱', '哈尔滨', 'harbin'], 'Harbin'],
  [['麗江', '丽江', 'lijiang'], 'Lijiang'],
  [['桂林', 'guilin'], 'Guilin'],
  [['三亞', '三亚', 'sanya'], 'Sanya'],
  [['武漢', '武汉', 'wuhan'], 'Wuhan'],
  [['長沙', '长沙', 'changsha'], 'Changsha'],
  [['昆明', 'kunming'], 'Kunming'],
  [['珠海', 'zhuhai'], 'Zhuhai'],
  [['天津', 'tianjin'], 'Tianjin'],
  [['大連', '大连', 'dalian'], 'Dalian'],
  [['名古屋', 'nagoya'], 'Nagoya'],
  [['神戶', '神户', 'kobe'], 'Kobe'],
  [['奈良', 'nara'], 'Nara'],
  [['橫濱', '横滨', 'yokohama'], 'Yokohama'],
  [['仙台', 'sendai'], 'Sendai'],
  [['廣島', '广岛', 'hiroshima'], 'Hiroshima'],
  [['金澤', '金泽', 'kanazawa'], 'Kanazawa'],
  [['箱根', 'hakone'], 'Hakone'],
  [['輕井澤', '轻井泽', 'karuizawa'], 'Karuizawa'],
  [['河口湖', 'kawaguchiko'], 'Fujikawaguchiko'],
  [['熊本', 'kumamoto'], 'Kumamoto'],
  [['長崎', '长崎', 'nagasaki'], 'Nagasaki'],
  [['鹿兒島', '鹿儿岛', 'kagoshima'], 'Kagoshima'],
  [['台中', '臺中', 'taichung'], 'Taichung'],
  [['台南', '臺南', 'tainan'], 'Tainan'],
  [['花蓮', '花莲', 'hualien'], 'Hualien'],
  [['宜蘭', '宜兰', 'yilan'], 'Yilan'],
  [['屏東', '屏东', '墾丁', '垦丁', 'kenting'], 'Kenting'],
  [['台東', '台东', 'taitung'], 'Taitung'],
  [['檳城', '槟城', 'penang'], 'George Town, Penang'],
  [['沙巴', '亞庇', '亚庇', 'sabah', 'kota kinabalu'], 'Kota Kinabalu'],
  [['河內', '河内', 'hanoi'], 'Hanoi'],
  [['峴港', '岘港', 'danang', 'da nang'], 'Da Nang'],
  [['富國島', '富国岛', 'phu quoc'], 'Phu Quoc'],
  [['普吉', 'phuket'], 'Phuket'],
  [['蘇美島', '苏梅岛', 'koh samui', 'samui'], 'Ko Samui'],
  [['雅加達', '雅加达', 'jakarta'], 'Jakarta'],
  [['峇里島', '巴厘岛', 'bali'], 'Bali'],
  [['宿霧', '宿务', 'cebu'], 'Cebu'],
  [['長灘島', '长滩岛', 'boracay'], 'Boracay'],
  [['愛丁堡', '爱丁堡', 'edinburgh'], 'Edinburgh'],
  [['曼徹斯特', '曼彻斯特', 'manchester'], 'Manchester'],
  [['尼斯', 'nice'], 'Nice'],
  [['里昂', 'lyon'], 'Lyon'],
  [['米蘭', '米兰', 'milan'], 'Milan'],
  [['威尼斯', 'venice'], 'Venice'],
  [['佛羅倫斯', '佛罗伦萨', 'florence'], 'Florence'],
  [['柏林', 'berlin'], 'Berlin'],
  [['法蘭克福', '法兰克福', 'frankfurt'], 'Frankfurt'],
  [['馬德里', '马德里', 'madrid'], 'Madrid'],
  [['阿姆斯特丹', 'amsterdam'], 'Amsterdam'],
  [['維也納', '维也纳', 'vienna'], 'Vienna'],
  [['布拉格', 'prague'], 'Prague'],
  [['日內瓦', '日内瓦', 'geneva'], 'Geneva'],
  [['策馬特', '采尔马特', 'zermatt'], 'Zermatt'],
  [['因特拉肯', 'interlaken'], 'Interlaken'],
  [['洛杉磯', '洛杉矶', 'los angeles'], 'Los Angeles'],
  [['舊金山', '旧金山', 'san francisco'], 'San Francisco'],
  [['西雅圖', '西雅图', 'seattle'], 'Seattle'],
  [['拉斯維加斯', '拉斯维加斯', 'las vegas'], 'Las Vegas'],
  [['芝加哥', 'chicago'], 'Chicago'],
  [['夏威夷', '檀香山', 'hawaii', 'honolulu'], 'Honolulu'],
  [['墨爾本', '墨尔本', 'melbourne'], 'Melbourne'],
  [['布里斯本', '布里斯班', 'brisbane'], 'Brisbane'],
  [['皇后鎮', '皇后镇', 'queenstown'], 'Queenstown'],
  [['多倫多', '多伦多', 'toronto'], 'Toronto'],
  [['班夫', 'banff'], 'Banff'],
  [['阿布達比', '阿布扎比', 'abu dhabi'], 'Abu Dhabi'],
  [['卡帕多奇亞', '卡帕多奇亚', 'cappadocia'], 'Cappadocia'],
  [['九份', 'jiufen'], 'Jiufen'],
  [['淡水', 'tamsui'], 'Tamsui'],
  [['阿里山', 'alishan'], 'Alishan'],
  [['日月潭', 'sun moon lake'], 'Sun Moon Lake'],
  [['白川鄉', '白川乡', '合掌村', 'shirakawa'], 'Shirakawa, Gifu'],
  [['富士山', 'mount fuji', 'mt fuji'], 'Mount Fuji'],
  [['日光', 'nikko'], 'Nikko, Tochigi'],
  [['鎌倉', '镰仓', 'kamakura'], 'Kamakura'],
  [['小樽', 'otaru'], 'Otaru'],
  [['富良野', 'furano'], 'Furano'],
  [['由布院', '湯布院', '汤布院', 'yufuin'], 'Yufuin, Oita'],
  [['宮島', '宫岛', '嚴島', '严岛', 'miyajima'], 'Itsukushima'],
  [['聖托里尼', '圣托里尼', 'santorini'], 'Santorini'],
  [['雷克雅維克', '雷克雅未克', 'reykjavik'], 'Reykjavik'],
  [['哈修塔特', '哈尔施塔特', 'hallstatt'], 'Hallstatt'],
  [['薩爾斯堡', '萨尔茨堡', 'salzburg'], 'Salzburg'],
  [['布達佩斯', '布达佩斯', 'budapest'], 'Budapest'],
  [['布魯日', '布鲁日', 'bruges'], 'Bruges'],
  [['烏鎮', '乌镇', 'wuzhen'], 'Wuzhen'],
  [['九寨溝', '九寨沟', 'jiuzhaigou'], 'Jiuzhaigou'],
  [['張家界', '张家界', 'zhangjiajie'], 'Zhangjiajie'],
  [['黃山', '黄山', 'huangshan'], 'Huangshan'],
];

function resolveSpecificCityQuery(primaryCity: string, preset: DestinationPreset): string {
  const lower = primaryCity.toLowerCase();
  for (const [keys, exactQuery] of SPECIFIC_CITY_QUERIES) {
    if (keys.some((k) => lower.includes(k))) {
      return exactQuery;
    }
  }
  const primaryMatchesDefault =
    lower.includes(preset.cityQuery.toLowerCase()) ||
    preset.keywords[0]?.toLowerCase() === lower;
  if (primaryMatchesDefault || !primaryCity) {
    return preset.cityQuery;
  }
  return primaryCity;
}

function resolveCityAirports(cityQuery: string, displayCity: string, lang: AppLanguage): DestinationAirport[] {
  const mapped = CITY_AIRPORTS[cityQuery];
  if (mapped && mapped.length > 0) {
    return mapped.map((item) => ({
      code: item.code,
      name: pickText(item.names, lang),
      query: item.query,
    }));
  }
  const cityLabel = displayCity || cityQuery;
  return [
    {
      code: 'AIRPORT',
      name: tr(lang, `${cityLabel} 機場`, `${cityLabel} 机场`, `${cityLabel} Airport`),
      query: `${cityQuery} International Airport`,
    },
  ];
}

export function detectDestinationIntel(rawDestination: string, lang: AppLanguage = 'zh-TW'): DestinationIntel {
  const cleaned = (rawDestination || '').trim();
  const primaryCity = cleaned.split(/\s*[-→>/,]\s*/)[0]?.trim() || cleaned;
  const lower = primaryCity.toLowerCase();

  for (const preset of PRESETS) {
    if (preset.keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
      const displayCity = primaryCity ? localizeSinglePlaceToken(primaryCity, lang) : preset.cityQuery;
      const exactCityQuery = resolveSpecificCityQuery(primaryCity, preset);
      return {
        cityQuery: exactCityQuery,
        displayCity,
        countryLabel: pickText(preset.countryLabel, lang),
        currency: preset.currency,
        currencyName: pickText(preset.currencyName, lang),
        currencySymbol: preset.currencySymbol,
        utcOffsetHours: preset.utcOffsetHours,
        timezoneLabel: preset.timezoneLabel,
        voltagePlug: pickText(preset.voltagePlug, lang),
        emergency: pickText(preset.emergency, lang),
        taxFreeThreshold: preset.taxFreeThreshold,
        taxFreeNote: preset.taxFreeNote ? pickText(preset.taxFreeNote, lang) : null,
        airports: resolveCityAirports(exactCityQuery, displayCity, lang),
      };
    }
  }

  const lowerPrimary = primaryCity.toLowerCase();
  let mappedSpecific = primaryCity;
  for (const [keys, exactQuery] of SPECIFIC_CITY_QUERIES) {
    if (keys.some((k) => lowerPrimary.includes(k))) {
      mappedSpecific = exactQuery;
      break;
    }
  }
  const fallbackCity = mappedSpecific || 'Tokyo';
  const displayCity = primaryCity
    ? localizeSinglePlaceToken(primaryCity, lang)
    : tr(lang, '目的地', '目的地', 'Destination');

  return {
    cityQuery: fallbackCity,
    displayCity,
    countryLabel: tr(lang, '旅遊目的地', '旅游目的地', 'Travel Destination'),
    currency: 'USD',
    currencyName: tr(lang, '美元', '美元', 'US Dollar'),
    currencySymbol: '$',
    utcOffsetHours: 8,
    timezoneLabel: tr(lang, '當地時區', '当地时区', 'Local Timezone'),
    voltagePlug: tr(lang, '出發前請確認當地轉接頭', '出发前请确认当地转接头', 'Check local power adapter before departure'),
    emergency: tr(lang, '國際緊急 112 / 911', '国际紧急 112 / 911', 'Emergency 112 / 911'),
    taxFreeThreshold: null,
    taxFreeNote: null,
    airports: resolveCityAirports(fallbackCity, primaryCity ? displayCity : fallbackCity, lang),
  };
}

export function resolveAirportByCode(iataCode?: string | null, lang: AppLanguage = 'zh-TW'): DestinationAirport | null {
  const code = (iataCode || '').trim().toUpperCase();
  if (!code) return null;
  for (const list of Object.values(CITY_AIRPORTS)) {
    const found = list.find((item) => item.code.toUpperCase() === code);
    if (found) {
      return {
        code: found.code,
        name: pickText(found.names, lang),
        query: found.query,
      };
    }
  }
  return {
    code,
    name: tr(lang, `${code} 機場`, `${code} 机场`, `${code} Airport`),
    query: `${code} Airport`,
  };
}

export function getDestinationLocalTime(
  utcOffsetHours: number,
  lang: AppLanguage = 'zh-TW'
): { timeStr: string; dateStr: string } {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const target = new Date(utcMs + utcOffsetHours * 3600000);
  const hh = String(target.getHours()).padStart(2, '0');
  const mm = String(target.getMinutes()).padStart(2, '0');
  const month = target.getMonth() + 1;
  const day = target.getDate();

  if (lang === 'en') {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const weekdaysEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return {
      timeStr: `${hh}:${mm}`,
      dateStr: `${weekdaysEn[target.getDay()]}, ${months[target.getMonth()]} ${day}`,
    };
  }

  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const wd = weekdays[target.getDay()];
  const prefix = lang === 'zh-CN' ? '周' : '週';
  return {
    timeStr: `${hh}:${mm}`,
    dateStr: `${month}/${day} (${prefix}${wd})`,
  };
}
