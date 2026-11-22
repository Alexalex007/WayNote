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

interface DestinationPreset {
  keywords: string[];
  cityQuery: string;
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
}

const PRESETS: DestinationPreset[] = [
  {
    keywords: ['東京', 'tokyo', '新宿', '澀谷', '淺草', '銀座', '羽田', '成田'],
    cityQuery: 'Tokyo',
    countryLabel: '日本',
    currency: 'JPY',
    currencyName: '日圓',
    currencySymbol: '¥',
    utcOffsetHours: 9,
    timezoneLabel: 'UTC+9',
    voltagePlug: '100V · A型兩孔扁插',
    emergency: '報警 110 · 救護 119',
    taxFreeThreshold: 5000,
    taxFreeNote: '日本未稅滿 ¥5,000 可享 10% 免稅',
  },
  {
    keywords: ['大阪', 'osaka', '關西', '難波', '心齋橋', '梅田'],
    cityQuery: 'Osaka',
    countryLabel: '日本',
    currency: 'JPY',
    currencyName: '日圓',
    currencySymbol: '¥',
    utcOffsetHours: 9,
    timezoneLabel: 'UTC+9',
    voltagePlug: '100V · A型兩孔扁插',
    emergency: '報警 110 · 救護 119',
    taxFreeThreshold: 5000,
    taxFreeNote: '日本未稅滿 ¥5,000 可享 10% 免稅',
  },
  {
    keywords: ['京都', 'kyoto', '嵐山', '宇治'],
    cityQuery: 'Kyoto',
    countryLabel: '日本',
    currency: 'JPY',
    currencyName: '日圓',
    currencySymbol: '¥',
    utcOffsetHours: 9,
    timezoneLabel: 'UTC+9',
    voltagePlug: '100V · A型兩孔扁插',
    emergency: '報警 110 · 救護 119',
    taxFreeThreshold: 5000,
    taxFreeNote: '日本未稅滿 ¥5,000 可享 10% 免稅',
  },
  {
    keywords: ['札幌', '北海道', 'sapporo', 'hokkaido', '函館', '小樽'],
    cityQuery: 'Sapporo',
    countryLabel: '日本',
    currency: 'JPY',
    currencyName: '日圓',
    currencySymbol: '¥',
    utcOffsetHours: 9,
    timezoneLabel: 'UTC+9',
    voltagePlug: '100V · A型兩孔扁插',
    emergency: '報警 110 · 救護 119',
    taxFreeThreshold: 5000,
    taxFreeNote: '日本未稅滿 ¥5,000 可享 10% 免稅',
  },
  {
    keywords: ['沖繩', '那霸', 'okinawa', 'naha'],
    cityQuery: 'Naha',
    countryLabel: '日本',
    currency: 'JPY',
    currencyName: '日圓',
    currencySymbol: '¥',
    utcOffsetHours: 9,
    timezoneLabel: 'UTC+9',
    voltagePlug: '100V · A型兩孔扁插',
    emergency: '報警 110 · 救護 119',
    taxFreeThreshold: 5000,
    taxFreeNote: '日本未稅滿 ¥5,000 可享 10% 免稅',
  },
  {
    keywords: ['福岡', '九州', '名古屋', '仙台', '神戶', '奈良', '橫濱', '日本', 'japan', 'fukuoka', 'nagoya'],
    cityQuery: 'Fukuoka',
    countryLabel: '日本',
    currency: 'JPY',
    currencyName: '日圓',
    currencySymbol: '¥',
    utcOffsetHours: 9,
    timezoneLabel: 'UTC+9',
    voltagePlug: '100V · A型兩孔扁插',
    emergency: '報警 110 · 救護 119',
    taxFreeThreshold: 5000,
    taxFreeNote: '日本未稅滿 ¥5,000 可享 10% 免稅',
  },
  {
    keywords: ['首爾', 'seoul', '韓國', 'korea', '仁川', '弘大', '明洞'],
    cityQuery: 'Seoul',
    countryLabel: '韓國',
    currency: 'KRW',
    currencyName: '韓元',
    currencySymbol: '₩',
    utcOffsetHours: 9,
    timezoneLabel: 'UTC+9',
    voltagePlug: '220V · C/F型雙圓孔',
    emergency: '報警 112 · 救護 119',
    taxFreeThreshold: 15000,
    taxFreeNote: '韓國單筆滿 ₩15,000 可申請現場／機場退稅',
  },
  {
    keywords: ['釜山', 'busan'],
    cityQuery: 'Busan',
    countryLabel: '韓國',
    currency: 'KRW',
    currencyName: '韓元',
    currencySymbol: '₩',
    utcOffsetHours: 9,
    timezoneLabel: 'UTC+9',
    voltagePlug: '220V · C/F型雙圓孔',
    emergency: '報警 112 · 救護 119',
    taxFreeThreshold: 15000,
    taxFreeNote: '韓國單筆滿 ₩15,000 可申請退稅',
  },
  {
    keywords: ['濟州', 'jeju'],
    cityQuery: 'Jeju',
    countryLabel: '韓國',
    currency: 'KRW',
    currencyName: '韓元',
    currencySymbol: '₩',
    utcOffsetHours: 9,
    timezoneLabel: 'UTC+9',
    voltagePlug: '220V · C/F型雙圓孔',
    emergency: '報警 112 · 救護 119',
    taxFreeThreshold: 15000,
    taxFreeNote: '韓國單筆滿 ₩15,000 可申請退稅',
  },
  {
    keywords: ['台北', '新北', '台灣', 'taipei', 'taiwan', '桃園', '基隆'],
    cityQuery: 'Taipei',
    countryLabel: '台灣',
    currency: 'TWD',
    currencyName: '新台幣',
    currencySymbol: 'NT$',
    utcOffsetHours: 8,
    timezoneLabel: 'UTC+8',
    voltagePlug: '110V · A/B型扁插',
    emergency: '報警 110 · 救護 119',
    taxFreeThreshold: 2000,
    taxFreeNote: '外籍旅客同店同日滿 NT$2,000 可退稅',
  },
  {
    keywords: ['高雄', '台中', '台南', '花蓮', '宜蘭', 'kaohsiung', 'taichung', 'tainan'],
    cityQuery: 'Kaohsiung',
    countryLabel: '台灣',
    currency: 'TWD',
    currencyName: '新台幣',
    currencySymbol: 'NT$',
    utcOffsetHours: 8,
    timezoneLabel: 'UTC+8',
    voltagePlug: '110V · A/B型扁插',
    emergency: '報警 110 · 救護 119',
    taxFreeThreshold: 2000,
    taxFreeNote: null,
  },
  {
    keywords: ['香港', 'hong kong', '九龍', '港島'],
    cityQuery: 'Hong Kong',
    countryLabel: '香港',
    currency: 'HKD',
    currencyName: '港幣',
    currencySymbol: 'HK$',
    utcOffsetHours: 8,
    timezoneLabel: 'UTC+8',
    voltagePlug: '220V · G型英式三方孔',
    emergency: '報警／救護 999',
    taxFreeThreshold: null,
    taxFreeNote: '香港為免稅港（無一般消費稅）',
  },
  {
    keywords: ['澳門', 'macau', 'macao'],
    cityQuery: 'Macau',
    countryLabel: '澳門',
    currency: 'MOP',
    currencyName: '澳門幣',
    currencySymbol: 'MOP$',
    utcOffsetHours: 8,
    timezoneLabel: 'UTC+8',
    voltagePlug: '220V · G型英式三方孔',
    emergency: '報警／救護 999',
    taxFreeThreshold: null,
    taxFreeNote: null,
  },
  {
    keywords: ['曼谷', 'bangkok', '泰國', 'thailand'],
    cityQuery: 'Bangkok',
    countryLabel: '泰國',
    currency: 'THB',
    currencyName: '泰銖',
    currencySymbol: '฿',
    utcOffsetHours: 7,
    timezoneLabel: 'UTC+7',
    voltagePlug: '220V · A/B/C型插座',
    emergency: '觀光警察 1155 · 救護 1669',
    taxFreeThreshold: 2000,
    taxFreeNote: '泰國同日同店滿 ฿2,000 可申請 VAT 退稅',
  },
  {
    keywords: ['清邁', 'chiang mai', '普吉', 'phuket'],
    cityQuery: 'Chiang Mai',
    countryLabel: '泰國',
    currency: 'THB',
    currencyName: '泰銖',
    currencySymbol: '฿',
    utcOffsetHours: 7,
    timezoneLabel: 'UTC+7',
    voltagePlug: '220V · A/B/C型插座',
    emergency: '觀光警察 1155 · 救護 1669',
    taxFreeThreshold: 2000,
    taxFreeNote: '泰國同日同店滿 ฿2,000 可申請 VAT 退稅',
  },
  {
    keywords: ['新加坡', 'singapore'],
    cityQuery: 'Singapore',
    countryLabel: '新加坡',
    currency: 'SGD',
    currencyName: '新加坡幣',
    currencySymbol: 'S$',
    utcOffsetHours: 8,
    timezoneLabel: 'UTC+8',
    voltagePlug: '230V · G型英式三方孔',
    emergency: '報警 999 · 救護 995',
    taxFreeThreshold: 100,
    taxFreeNote: '新加坡同店滿 S$100 可申請 eTRS 退稅',
  },
  {
    keywords: ['吉隆坡', 'kuala lumpur', '馬來西亞', 'malaysia', '檳城', '沙巴'],
    cityQuery: 'Kuala Lumpur',
    countryLabel: '馬來西亞',
    currency: 'MYR',
    currencyName: '馬來西亞林吉特',
    currencySymbol: 'RM',
    utcOffsetHours: 8,
    timezoneLabel: 'UTC+8',
    voltagePlug: '240V · G型英式三方孔',
    emergency: '緊急救援 999',
    taxFreeThreshold: null,
    taxFreeNote: null,
  },
  {
    keywords: ['胡志明', '河內', '峴港', '越南', 'vietnam', 'hanoi', 'ho chi minh', 'danang'],
    cityQuery: 'Ho Chi Minh City',
    countryLabel: '越南',
    currency: 'VND',
    currencyName: '越南盾',
    currencySymbol: '₫',
    utcOffsetHours: 7,
    timezoneLabel: 'UTC+7',
    voltagePlug: '220V · A/C型插座',
    emergency: '報警 113 · 救護 115',
    taxFreeThreshold: 2000000,
    taxFreeNote: '越南同日同店滿 ₫2,000,000 可退稅',
  },
  {
    keywords: ['峇里島', '雅加達', '印尼', 'bali', 'jakarta', 'indonesia'],
    cityQuery: 'Denpasar',
    countryLabel: '印尼',
    currency: 'IDR',
    currencyName: '印尼盾',
    currencySymbol: 'Rp',
    utcOffsetHours: 8,
    timezoneLabel: 'UTC+8',
    voltagePlug: '230V · C/F型雙圓孔',
    emergency: '緊急救援 112',
    taxFreeThreshold: null,
    taxFreeNote: null,
  },
  {
    keywords: ['馬尼拉', '宿霧', '長灘島', '菲律賓', 'manila', 'cebu', 'philippines'],
    cityQuery: 'Manila',
    countryLabel: '菲律賓',
    currency: 'PHP',
    currencyName: '菲律賓披索',
    currencySymbol: '₱',
    utcOffsetHours: 8,
    timezoneLabel: 'UTC+8',
    voltagePlug: '220V · A/B/C型插座',
    emergency: '緊急救援 911',
    taxFreeThreshold: null,
    taxFreeNote: null,
  },
  {
    keywords: ['上海', '北京', '廣州', '深圳', '成都', '重慶', '杭州', '西安', '中國', 'shanghai', 'beijing'],
    cityQuery: 'Shanghai',
    countryLabel: '中國',
    currency: 'CNY',
    currencyName: '人民幣',
    currencySymbol: '¥',
    utcOffsetHours: 8,
    timezoneLabel: 'UTC+8',
    voltagePlug: '220V · A/I型插座',
    emergency: '報警 110 · 救護 120',
    taxFreeThreshold: 500,
    taxFreeNote: '同店同日滿 ¥500 可辦理離境退稅',
  },
  {
    keywords: ['倫敦', '愛丁堡', '曼徹斯特', '英國', 'london', 'uk', 'england', 'edinburgh'],
    cityQuery: 'London',
    countryLabel: '英國',
    currency: 'GBP',
    currencyName: '英鎊',
    currencySymbol: '£',
    utcOffsetHours: 0,
    timezoneLabel: 'UTC+0',
    voltagePlug: '230V · G型英式三方孔',
    emergency: '緊急救援 999 / 112',
    taxFreeThreshold: null,
    taxFreeNote: null,
  },
  {
    keywords: ['巴黎', 'paris', '法國', 'france', '尼斯', '里昂'],
    cityQuery: 'Paris',
    countryLabel: '法國',
    currency: 'EUR',
    currencyName: '歐元',
    currencySymbol: '€',
    utcOffsetHours: 1,
    timezoneLabel: 'UTC+1',
    voltagePlug: '230V · E/C型雙圓孔',
    emergency: '歐盟緊急 112',
    taxFreeThreshold: 100.01,
    taxFreeNote: '法國單筆滿 €100.01 可申請 VAT 退稅',
  },
  {
    keywords: ['羅馬', '米蘭', '威尼斯', '佛羅倫斯', '義大利', 'rome', 'milan', 'venice', 'italy'],
    cityQuery: 'Rome',
    countryLabel: '義大利',
    currency: 'EUR',
    currencyName: '歐元',
    currencySymbol: '€',
    utcOffsetHours: 1,
    timezoneLabel: 'UTC+1',
    voltagePlug: '230V · F/L型插座',
    emergency: '歐盟緊急 112',
    taxFreeThreshold: 70.01,
    taxFreeNote: '義大利滿 €70.01 可申請退稅',
  },
  {
    keywords: ['柏林', '慕尼黑', '法蘭克福', '德國', 'berlin', 'munich', 'frankfurt', 'germany'],
    cityQuery: 'Munich',
    countryLabel: '德國',
    currency: 'EUR',
    currencyName: '歐元',
    currencySymbol: '€',
    utcOffsetHours: 1,
    timezoneLabel: 'UTC+1',
    voltagePlug: '230V · C/F型雙圓孔',
    emergency: '歐盟緊急 112',
    taxFreeThreshold: 50,
    taxFreeNote: '德國單筆滿 €50 可申請退稅',
  },
  {
    keywords: ['巴塞隆納', '馬德里', '西班牙', 'barcelona', 'madrid', 'spain', '阿姆斯特丹', '荷蘭', 'amsterdam', '維也納', '奧地利', 'vienna'],
    cityQuery: 'Barcelona',
    countryLabel: '歐洲申根區',
    currency: 'EUR',
    currencyName: '歐元',
    currencySymbol: '€',
    utcOffsetHours: 1,
    timezoneLabel: 'UTC+1',
    voltagePlug: '230V · C/F型雙圓孔',
    emergency: '歐盟緊急 112',
    taxFreeThreshold: null,
    taxFreeNote: null,
  },
  {
    keywords: ['布拉格', '捷克', 'prague', 'czech'],
    cityQuery: 'Prague',
    countryLabel: '捷克',
    currency: 'CZK',
    currencyName: '捷克克朗',
    currencySymbol: 'Kč',
    utcOffsetHours: 1,
    timezoneLabel: 'UTC+1',
    voltagePlug: '230V · E型雙圓孔',
    emergency: '歐盟緊急 112',
    taxFreeThreshold: 2001,
    taxFreeNote: '捷克單筆滿 2,001 Kč 可申請退稅',
  },
  {
    keywords: ['雷克雅維克', '冰島', 'reykjavik', 'iceland'],
    cityQuery: 'Reykjavik',
    countryLabel: '冰島',
    currency: 'ISK',
    currencyName: '冰島克朗',
    currencySymbol: 'kr',
    utcOffsetHours: 0,
    timezoneLabel: 'UTC+0',
    voltagePlug: '230V · C/F型雙圓孔',
    emergency: '緊急救援 112',
    taxFreeThreshold: 6000,
    taxFreeNote: '冰島單筆滿 ISK 6,000 可申請退稅',
  },
  {
    keywords: ['蘇黎世', '日內瓦', '策馬特', '因特拉肯', '瑞士', 'zurich', 'geneva', 'switzerland'],
    cityQuery: 'Zurich',
    countryLabel: '瑞士',
    currency: 'CHF',
    currencyName: '瑞士法郎',
    currencySymbol: 'Fr',
    utcOffsetHours: 1,
    timezoneLabel: 'UTC+1',
    voltagePlug: '230V · J型三圓孔',
    emergency: '緊急救援 112 / 144',
    taxFreeThreshold: 300,
    taxFreeNote: '瑞士滿 CHF 300 可辦理退稅',
  },
  {
    keywords: ['紐約', '洛杉磯', '舊金山', '西雅圖', '拉斯維加斯', '芝加哥', '夏威夷', '美國', 'new york', 'los angeles', 'san francisco', 'usa'],
    cityQuery: 'New York',
    countryLabel: '美國',
    currency: 'USD',
    currencyName: '美元',
    currencySymbol: '$',
    utcOffsetHours: -5,
    timezoneLabel: 'UTC-5',
    voltagePlug: '120V · A/B型扁插',
    emergency: '緊急救援 911',
    taxFreeThreshold: null,
    taxFreeNote: null,
  },
  {
    keywords: ['雪梨', '墨爾本', '布里斯本', '澳洲', 'sydney', 'melbourne', 'australia'],
    cityQuery: 'Sydney',
    countryLabel: '澳洲',
    currency: 'AUD',
    currencyName: '澳幣',
    currencySymbol: 'A$',
    utcOffsetHours: 10,
    timezoneLabel: 'UTC+10',
    voltagePlug: '230V · I型八字扁插',
    emergency: '緊急救援 000',
    taxFreeThreshold: 300,
    taxFreeNote: '澳洲同商號滿 A$300 可申請 TRS 退稅',
  },
  {
    keywords: ['奧克蘭', '皇后鎮', '紐西蘭', 'auckland', 'queenstown', 'new zealand'],
    cityQuery: 'Auckland',
    countryLabel: '紐西蘭',
    currency: 'NZD',
    currencyName: '紐西蘭元',
    currencySymbol: 'NZ$',
    utcOffsetHours: 12,
    timezoneLabel: 'UTC+12',
    voltagePlug: '230V · I型八字扁插',
    emergency: '緊急救援 111',
    taxFreeThreshold: null,
    taxFreeNote: null,
  },
  {
    keywords: ['溫哥華', '多倫多', '班夫', '加拿大', 'vancouver', 'toronto', 'canada'],
    cityQuery: 'Vancouver',
    countryLabel: '加拿大',
    currency: 'CAD',
    currencyName: '加幣',
    currencySymbol: 'C$',
    utcOffsetHours: -8,
    timezoneLabel: 'UTC-8',
    voltagePlug: '120V · A/B型扁插',
    emergency: '緊急救援 911',
    taxFreeThreshold: null,
    taxFreeNote: null,
  },
  {
    keywords: ['杜拜', '阿布達比', '阿聯酋', 'dubai', 'uae'],
    cityQuery: 'Dubai',
    countryLabel: '阿聯酋',
    currency: 'AED',
    currencyName: '阿聯酋迪拉姆',
    currencySymbol: 'AED',
    utcOffsetHours: 4,
    timezoneLabel: 'UTC+4',
    voltagePlug: '230V · G型英式三方孔',
    emergency: '報警 999 · 救護 998',
    taxFreeThreshold: 250,
    taxFreeNote: '杜拜單筆滿 AED 250 可辦理退稅',
  },
  {
    keywords: ['伊斯坦堡', '卡帕多奇亞', '土耳其', 'istanbul', 'turkey'],
    cityQuery: 'Istanbul',
    countryLabel: '土耳其',
    currency: 'TRY',
    currencyName: '土耳其里拉',
    currencySymbol: '₺',
    utcOffsetHours: 3,
    timezoneLabel: 'UTC+3',
    voltagePlug: '220V · C/F型雙圓孔',
    emergency: '緊急救援 112',
    taxFreeThreshold: null,
    taxFreeNote: null,
  },
];

const CITY_AIRPORTS: Record<string, DestinationAirport[]> = {
  Tokyo: [
    { code: 'NRT', name: '成田國際機場 (NRT)', query: 'Narita International Airport Tokyo' },
    { code: 'HND', name: '羽田機場 (HND)', query: 'Haneda Airport Tokyo' },
  ],
  Osaka: [
    { code: 'KIX', name: '關西國際機場 (KIX)', query: 'Kansai International Airport Osaka' },
    { code: 'ITM', name: '大阪伊丹機場 (ITM)', query: 'Osaka International Airport Itami' },
  ],
  Kyoto: [
    { code: 'KIX', name: '關西國際機場 (KIX)', query: 'Kansai International Airport' },
    { code: 'ITM', name: '大阪伊丹機場 (ITM)', query: 'Osaka International Airport Itami' },
  ],
  Sapporo: [
    { code: 'CTS', name: '新千歲機場 (CTS)', query: 'New Chitose Airport Sapporo' },
    { code: 'OKD', name: '札幌丘珠機場 (OKD)', query: 'Sapporo Okadama Airport' },
  ],
  Naha: [{ code: 'OKA', name: '那霸機場 (OKA)', query: 'Naha Airport Okinawa' }],
  Fukuoka: [{ code: 'FUK', name: '福岡機場 (FUK)', query: 'Fukuoka Airport' }],
  Seoul: [
    { code: 'ICN', name: '仁川國際機場 (ICN)', query: 'Incheon International Airport Seoul' },
    { code: 'GMP', name: '金浦國際機場 (GMP)', query: 'Gimpo International Airport Seoul' },
  ],
  Busan: [{ code: 'PUS', name: '金海國際機場 (PUS)', query: 'Gimhae International Airport Busan' }],
  Jeju: [{ code: 'CJU', name: '濟州國際機場 (CJU)', query: 'Jeju International Airport' }],
  Taipei: [
    { code: 'TPE', name: '桃園國際機場 (TPE)', query: 'Taoyuan International Airport' },
    { code: 'TSA', name: '台北松山機場 (TSA)', query: 'Taipei Songshan Airport' },
  ],
  Kaohsiung: [{ code: 'KHH', name: '高雄小港機場 (KHH)', query: 'Kaohsiung International Airport' }],
  'Hong Kong': [{ code: 'HKG', name: '香港國際機場 (HKG)', query: 'Hong Kong International Airport' }],
  Macau: [{ code: 'MFM', name: '澳門國際機場 (MFM)', query: 'Macau International Airport' }],
  Bangkok: [
    { code: 'BKK', name: '蘇凡納布機場 (BKK)', query: 'Suvarnabhumi Airport Bangkok' },
    { code: 'DMK', name: '廊曼國際機場 (DMK)', query: 'Don Mueang International Airport Bangkok' },
  ],
  'Chiang Mai': [{ code: 'CNX', name: '清邁國際機場 (CNX)', query: 'Chiang Mai International Airport' }],
  Singapore: [{ code: 'SIN', name: '新加坡樟宜機場 (SIN)', query: 'Singapore Changi Airport' }],
  'Kuala Lumpur': [
    { code: 'KUL', name: '吉隆坡國際機場 (KUL)', query: 'Kuala Lumpur International Airport' },
    { code: 'SZB', name: '梳邦機場 (SZB)', query: 'Sultan Abdul Aziz Shah Airport Subang' },
  ],
  'Ho Chi Minh City': [{ code: 'SGN', name: '新山一國際機場 (SGN)', query: 'Tan Son Nhat International Airport' }],
  Denpasar: [{ code: 'DPS', name: '峇里島伍拉賴機場 (DPS)', query: 'Ngurah Rai International Airport Bali' }],
  Manila: [{ code: 'MNL', name: '尼諾伊亞基諾機場 (MNL)', query: 'Ninoy Aquino International Airport Manila' }],
  Shanghai: [
    { code: 'PVG', name: '浦東國際機場 (PVG)', query: 'Shanghai Pudong International Airport' },
    { code: 'SHA', name: '虹橋國際機場 (SHA)', query: 'Shanghai Hongqiao International Airport' },
  ],
  Hangzhou: [{ code: 'HGH', name: '杭州蕭山國際機場 (HGH)', query: 'Hangzhou Xiaoshan International Airport' }],
  Beijing: [
    { code: 'PEK', name: '北京首都國際機場 (PEK)', query: 'Beijing Capital International Airport' },
    { code: 'PKX', name: '北京大興國際機場 (PKX)', query: 'Beijing Daxing International Airport' },
  ],
  Guangzhou: [{ code: 'CAN', name: '廣州白雲國際機場 (CAN)', query: 'Guangzhou Baiyun International Airport' }],
  Shenzhen: [{ code: 'SZX', name: '深圳寶安國際機場 (SZX)', query: 'Shenzhen Baoan International Airport' }],
  Chengdu: [
    { code: 'TFU', name: '成都天府國際機場 (TFU)', query: 'Chengdu Tianfu International Airport' },
    { code: 'CTU', name: '成都雙流國際機場 (CTU)', query: 'Chengdu Shuangliu International Airport' },
  ],
  Chongqing: [{ code: 'CKG', name: '重慶江北國際機場 (CKG)', query: 'Chongqing Jiangbei International Airport' }],
  "Xi'an": [{ code: 'XIY', name: '西安咸陽國際機場 (XIY)', query: "Xi'an Xianyang International Airport" }],
  London: [
    { code: 'LHR', name: '希斯洛機場 (LHR)', query: 'London Heathrow Airport' },
    { code: 'LGW', name: '蓋威克機場 (LGW)', query: 'London Gatwick Airport' },
    { code: 'LCY', name: '倫敦城市機場 (LCY)', query: 'London City Airport' },
  ],
  Paris: [
    { code: 'CDG', name: '戴高樂機場 (CDG)', query: 'Charles de Gaulle Airport Paris' },
    { code: 'ORY', name: '奧利機場 (ORY)', query: 'Paris Orly Airport' },
  ],
  Rome: [
    { code: 'FCO', name: '費米齊諾機場 (FCO)', query: 'Leonardo da Vinci Rome Fiumicino Airport' },
    { code: 'CIA', name: '錢皮諾機場 (CIA)', query: 'Rome Ciampino Airport' },
  ],
  Munich: [{ code: 'MUC', name: '慕尼黑機場 (MUC)', query: 'Munich Airport' }],
  Barcelona: [{ code: 'BCN', name: '巴塞隆納機場 (BCN)', query: 'Barcelona El Prat Airport' }],
  Zurich: [{ code: 'ZRH', name: '蘇黎世機場 (ZRH)', query: 'Zurich Airport' }],
  'New York': [
    { code: 'JFK', name: '甘迺迪國際機場 (JFK)', query: 'John F. Kennedy International Airport New York' },
    { code: 'EWR', name: '紐華克自由機場 (EWR)', query: 'Newark Liberty International Airport' },
    { code: 'LGA', name: '拉瓜地亞機場 (LGA)', query: 'LaGuardia Airport New York' },
  ],
  Sydney: [{ code: 'SYD', name: '雪梨機場 (SYD)', query: 'Sydney Kingsford Smith Airport' }],
  Auckland: [{ code: 'AKL', name: '奧克蘭機場 (AKL)', query: 'Auckland Airport' }],
  Vancouver: [{ code: 'YVR', name: '溫哥華國際機場 (YVR)', query: 'Vancouver International Airport' }],
  Dubai: [
    { code: 'DXB', name: '杜拜國際機場 (DXB)', query: 'Dubai International Airport' },
    { code: 'DWC', name: '阿勒馬克圖姆機場 (DWC)', query: 'Al Maktoum International Airport Dubai' },
  ],
  Istanbul: [
    { code: 'IST', name: '伊斯坦堡機場 (IST)', query: 'Istanbul Airport' },
    { code: 'SAW', name: '薩比哈格克琴機場 (SAW)', query: 'Sabiha Gokcen International Airport Istanbul' },
  ],
};

const SPECIFIC_CITY_QUERIES: Array<[string[], string]> = [
  [['杭州', 'hangzhou', '西湖'], 'Hangzhou'],
  [['北京', 'beijing'], 'Beijing'],
  [['上海', 'shanghai'], 'Shanghai'],
  [['廣州', 'guangzhou'], 'Guangzhou'],
  [['深圳', 'shenzhen'], 'Shenzhen'],
  [['成都', 'chengdu'], 'Chengdu'],
  [['重慶', 'chongqing'], 'Chongqing'],
  [['西安', 'xian', "xi'an"], "Xi'an"],
  [['蘇州', 'suzhou'], 'Suzhou'],
  [['南京', 'nanjing'], 'Nanjing'],
  [['廈門', 'xiamen'], 'Xiamen'],
  [['青島', 'qingdao'], 'Qingdao'],
  [['哈爾濱', 'harbin'], 'Harbin'],
  [['麗江', 'lijiang'], 'Lijiang'],
  [['桂林', 'guilin'], 'Guilin'],
  [['三亞', 'sanya'], 'Sanya'],
  [['武漢', 'wuhan'], 'Wuhan'],
  [['長沙', 'changsha'], 'Changsha'],
  [['昆明', 'kunming'], 'Kunming'],
  [['珠海', 'zhuhai'], 'Zhuhai'],
  [['天津', 'tianjin'], 'Tianjin'],
  [['大連', 'dalian'], 'Dalian'],
  [['名古屋', 'nagoya'], 'Nagoya'],
  [['神戶', 'kobe'], 'Kobe'],
  [['奈良', 'nara'], 'Nara'],
  [['橫濱', 'yokohama'], 'Yokohama'],
  [['仙台', 'sendai'], 'Sendai'],
  [['廣島', 'hiroshima'], 'Hiroshima'],
  [['金澤', 'kanazawa'], 'Kanazawa'],
  [['箱根', 'hakone'], 'Hakone'],
  [['輕井澤', 'karuizawa'], 'Karuizawa'],
  [['河口湖', 'kawaguchiko'], 'Fujikawaguchiko'],
  [['熊本', 'kumamoto'], 'Kumamoto'],
  [['長崎', 'nagasaki'], 'Nagasaki'],
  [['鹿兒島', 'kagoshima'], 'Kagoshima'],
  [['台中', 'taichung'], 'Taichung'],
  [['台南', 'tainan'], 'Tainan'],
  [['花蓮', 'hualien'], 'Hualien'],
  [['宜蘭', 'yilan'], 'Yilan'],
  [['屏東', '墾丁', 'kenting'], 'Kenting'],
  [['台東', 'taitung'], 'Taitung'],
  [['檳城', 'penang'], 'George Town, Penang'],
  [['沙巴', '亞庇', 'sabah', 'kota kinabalu'], 'Kota Kinabalu'],
  [['河內', 'hanoi'], 'Hanoi'],
  [['峴港', 'danang', 'da nang'], 'Da Nang'],
  [['富國島', 'phu quoc'], 'Phu Quoc'],
  [['普吉', 'phuket'], 'Phuket'],
  [['蘇美島', 'koh samui', 'samui'], 'Ko Samui'],
  [['雅加達', 'jakarta'], 'Jakarta'],
  [['峇里島', 'bali'], 'Bali'],
  [['宿霧', 'cebu'], 'Cebu'],
  [['長灘島', 'boracay'], 'Boracay'],
  [['愛丁堡', 'edinburgh'], 'Edinburgh'],
  [['曼徹斯特', 'manchester'], 'Manchester'],
  [['尼斯', 'nice'], 'Nice'],
  [['里昂', 'lyon'], 'Lyon'],
  [['米蘭', 'milan'], 'Milan'],
  [['威尼斯', 'venice'], 'Venice'],
  [['佛羅倫斯', 'florence'], 'Florence'],
  [['柏林', 'berlin'], 'Berlin'],
  [['法蘭克福', 'frankfurt'], 'Frankfurt'],
  [['馬德里', 'madrid'], 'Madrid'],
  [['阿姆斯特丹', 'amsterdam'], 'Amsterdam'],
  [['維也納', 'vienna'], 'Vienna'],
  [['布拉格', 'prague'], 'Prague'],
  [['日內瓦', 'geneva'], 'Geneva'],
  [['策馬特', 'zermatt'], 'Zermatt'],
  [['因特拉肯', 'interlaken'], 'Interlaken'],
  [['洛杉磯', 'los angeles'], 'Los Angeles'],
  [['舊金山', 'san francisco'], 'San Francisco'],
  [['西雅圖', 'seattle'], 'Seattle'],
  [['拉斯維加斯', 'las vegas'], 'Las Vegas'],
  [['芝加哥', 'chicago'], 'Chicago'],
  [['夏威夷', '檀香山', 'hawaii', 'honolulu'], 'Honolulu'],
  [['墨爾本', 'melbourne'], 'Melbourne'],
  [['布里斯本', 'brisbane'], 'Brisbane'],
  [['皇后鎮', 'queenstown'], 'Queenstown'],
  [['多倫多', 'toronto'], 'Toronto'],
  [['班夫', 'banff'], 'Banff'],
  [['阿布達比', 'abu dhabi'], 'Abu Dhabi'],
  [['卡帕多奇亞', 'cappadocia'], 'Cappadocia'],
  [['九份', 'jiufen'], 'Jiufen'],
  [['淡水', 'tamsui'], 'Tamsui'],
  [['阿里山', 'alishan'], 'Alishan'],
  [['日月潭', 'sun moon lake'], 'Sun Moon Lake'],
  [['白川鄉', '合掌村', 'shirakawa'], 'Shirakawa, Gifu'],
  [['富士山', 'mount fuji', 'mt fuji'], 'Mount Fuji'],
  [['日光', 'nikko'], 'Nikko, Tochigi'],
  [['鎌倉', 'kamakura'], 'Kamakura'],
  [['小樽', 'otaru'], 'Otaru'],
  [['富良野', 'furano'], 'Furano'],
  [['由布院', '湯布院', 'yufuin'], 'Yufuin, Oita'],
  [['宮島', '嚴島', 'miyajima'], 'Itsukushima'],
  [['聖托里尼', 'santorini'], 'Santorini'],
  [['雷克雅維克', 'reykjavik'], 'Reykjavik'],
  [['哈修塔特', 'hallstatt'], 'Hallstatt'],
  [['薩爾斯堡', 'salzburg'], 'Salzburg'],
  [['布達佩斯', 'budapest'], 'Budapest'],
  [['布魯日', 'bruges'], 'Bruges'],
  [['烏鎮', 'wuzhen'], 'Wuzhen'],
  [['九寨溝', 'jiuzhaigou'], 'Jiuzhaigou'],
  [['張家界', 'zhangjiajie'], 'Zhangjiajie'],
  [['黃山', 'huangshan'], 'Huangshan'],
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
  // Never replace an explicit city name (e.g. "無錫") with a regional fallback capital ("Shanghai")
  return primaryCity;
}

function resolveCityAirports(cityQuery: string, displayCity: string): DestinationAirport[] {
  const mapped = CITY_AIRPORTS[cityQuery];
  if (mapped && mapped.length > 0) return mapped;
  return [
    {
      code: 'AIRPORT',
      name: `${displayCity || cityQuery} 機場`,
      query: `${cityQuery} International Airport`,
    },
  ];
}

export function detectDestinationIntel(rawDestination: string): DestinationIntel {
  const cleaned = (rawDestination || '').trim();
  const primaryCity = cleaned.split(/\s*[-→>/,]\s*/)[0]?.trim() || cleaned;
  const lower = primaryCity.toLowerCase();

  for (const preset of PRESETS) {
    if (preset.keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
      const displayCity = primaryCity || preset.cityQuery;
      const exactCityQuery = resolveSpecificCityQuery(primaryCity, preset);
      return {
        cityQuery: exactCityQuery,
        displayCity,
        countryLabel: preset.countryLabel,
        currency: preset.currency,
        currencyName: preset.currencyName,
        currencySymbol: preset.currencySymbol,
        utcOffsetHours: preset.utcOffsetHours,
        timezoneLabel: preset.timezoneLabel,
        voltagePlug: preset.voltagePlug,
        emergency: preset.emergency,
        taxFreeThreshold: preset.taxFreeThreshold,
        taxFreeNote: preset.taxFreeNote,
        airports: resolveCityAirports(exactCityQuery, displayCity),
      };
    }
  }

  // Fallback for unknown city: still resolve SPECIFIC_CITY_QUERIES before Open-Meteo geocoding
  const lowerPrimary = primaryCity.toLowerCase();
  let mappedSpecific = primaryCity;
  for (const [keys, exactQuery] of SPECIFIC_CITY_QUERIES) {
    if (keys.some((k) => lowerPrimary.includes(k))) {
      mappedSpecific = exactQuery;
      break;
    }
  }
  const fallbackCity = mappedSpecific || 'Tokyo';
  return {
    cityQuery: fallbackCity,
    displayCity: primaryCity || '目的地',
    countryLabel: '旅遊目的地',
    currency: 'USD',
    currencyName: '美元',
    currencySymbol: '$',
    utcOffsetHours: 8,
    timezoneLabel: '當地時區',
    voltagePlug: '出發前請確認當地轉接頭',
    emergency: '國際緊急 112 / 911',
    taxFreeThreshold: null,
    taxFreeNote: null,
    airports: resolveCityAirports(fallbackCity, primaryCity || fallbackCity),
  };
}

export function resolveAirportByCode(iataCode?: string | null): DestinationAirport | null {
  const code = (iataCode || '').trim().toUpperCase();
  if (!code) return null;
  for (const list of Object.values(CITY_AIRPORTS)) {
    const found = list.find((item) => item.code.toUpperCase() === code);
    if (found) return found;
  }
  return {
    code,
    name: `${code} 機場`,
    query: `${code} Airport`,
  };
}

export function getDestinationLocalTime(utcOffsetHours: number): { timeStr: string; dateStr: string } {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const target = new Date(utcMs + utcOffsetHours * 3600000);
  const hh = String(target.getHours()).padStart(2, '0');
  const mm = String(target.getMinutes()).padStart(2, '0');
  const month = target.getMonth() + 1;
  const day = target.getDate();
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const wd = weekdays[target.getDay()];
  return {
    timeStr: `${hh}:${mm}`,
    dateStr: `${month}/${day} (週${wd})`,
  };
}
