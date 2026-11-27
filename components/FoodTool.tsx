import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Trip, Expense, Budget } from '../types';
import { generateUniqueId } from '../shared/syncMerge';
import { detectDestinationIntel } from '../shared/destinationIntel';
import { localizeDestinationLabel } from '../shared/i18n';
import { useI18n } from '../hooks/useI18n';
import { LiquidModal, ConfirmSheet, SlidingSegmentedControl } from './LiquidPrimitives';
import { StretchToggle, StepperPill } from './TactileButtons';
import { tactileAudio } from '../services/tactileAudio';
import {
  PlusIcon,
  DiningIcon,
  BusIcon,
  ShoppingBagIcon,
  HomeIcon,
  TagIcon,
  ArrowsRightLeftIcon,
  CreditCardIcon,
  BanknotesIcon,
  TicketIcon,
  PlaneIcon,
  ShieldCheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChartPieIcon,
  CalendarIcon,
  TrashIcon,
  CheckIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  UsersIcon,
  EditIcon,
  RefreshIcon,
} from './Icons';

interface Props {
  trip: Trip;
  onUpdateTrip: (trip: Trip) => void;
  onShowToast: (text: string, tone?: 'info' | 'success' | 'error') => void;
}

const FALLBACK_RATES: Record<string, number> = {
  HKD: 1,
  TWD: 4.15,
  JPY: 19.8,
  USD: 0.128,
  EUR: 0.119,
  KRW: 178,
  CNY: 0.92,
  GBP: 0.101,
  AUD: 0.197,
  SGD: 0.172,
  THB: 4.45,
  CZK: 2.95,
  ISK: 17.6,
  HUF: 48.2,
};

function getCurrencySymbol(code: string): string {
  const symbols: Record<string, string> = {
    TWD: 'NT$',
    HKD: 'HK$',
    JPY: '¥',
    USD: 'US$',
    EUR: '€',
    KRW: '₩',
    CNY: '¥',
    GBP: '£',
    AUD: 'A$',
    CAD: 'C$',
    SGD: 'S$',
    CHF: 'Fr',
    THB: '฿',
    MYR: 'RM',
    VND: '₫',
    PHP: '₱',
    IDR: 'Rp',
    NZD: 'NZ$',
    MOP: 'MOP$',
    TRY: '₺',
    AED: 'AED ',
    CZK: 'Kč ',
    ISK: 'ISK ',
    HUF: 'Ft ',
  };
  return symbols[code] || `${code} `;
}

function formatMoney(amount: number, code: string): string {
  const zeroDecimals = ['JPY', 'KRW', 'VND', 'IDR', 'TWD', 'HKD', 'THB', 'CZK', 'ISK', 'HUF'];
  const rounded = zeroDecimals.includes(code) ? Math.round(amount) : Math.round(amount * 100) / 100;
  return `${getCurrencySymbol(code)}${rounded.toLocaleString(undefined, {
    maximumFractionDigits: zeroDecimals.includes(code) ? 0 : 2,
  })}`;
}

const ExpensesTool: React.FC<Props> = ({ trip, onUpdateTrip, onShowToast }) => {
  const { lang, localeTag, t } = useI18n();
  const prefersReduced = useReducedMotion();

  const preTripCategories = useMemo(
    () => [
      { id: 'flight', label: t('機票', '机票', 'Flights'), icon: PlaneIcon, color: '#4F46E5', tintBg: 'rgba(79, 70, 229, 0.11)' },
      { id: 'stay', label: t('住宿', '住宿', 'Stay'), icon: HomeIcon, color: '#E11D48', tintBg: 'rgba(225, 29, 72, 0.11)' },
      { id: 'ticket', label: t('門票', '门票', 'Tickets'), icon: TicketIcon, color: '#059669', tintBg: 'rgba(5, 150, 105, 0.11)' },
      { id: 'transport_pass', label: t('交通票券', '交通票券', 'Rail / Pass'), icon: BusIcon, color: '#D97706', tintBg: 'rgba(217, 119, 6, 0.12)' },
      { id: 'insurance', label: t('保險', '保险', 'Insurance'), icon: ShieldCheckIcon, color: '#0284C7', tintBg: 'rgba(2, 132, 199, 0.11)' },
      { id: 'other', label: t('其他', '其他', 'Other'), icon: TagIcon, color: '#64748B', tintBg: 'rgba(100, 116, 139, 0.12)' },
    ],
    [t]
  );

  const onTripCategories = useMemo(
    () => [
      { id: 'stay', label: t('住宿', '住宿', 'Stay'), icon: HomeIcon, color: '#E11D48', tintBg: 'rgba(225, 29, 72, 0.11)' },
      { id: 'food', label: t('餐飲', '餐饮', 'Dining'), icon: DiningIcon, color: '#EA580C', tintBg: 'rgba(234, 88, 12, 0.11)' },
      { id: 'activity', label: t('體驗與行程', '体验与行程', 'Activities'), icon: TicketIcon, color: '#4F46E5', tintBg: 'rgba(79, 70, 229, 0.11)' },
      { id: 'transport', label: t('交通', '交通', 'Transit'), icon: BusIcon, color: '#0284C7', tintBg: 'rgba(2, 132, 199, 0.11)' },
      { id: 'shopping', label: t('購物', '购物', 'Shopping'), icon: ShoppingBagIcon, color: '#DB2777', tintBg: 'rgba(219, 39, 119, 0.11)' },
      { id: 'other', label: t('其他', '其他', 'Other'), icon: TagIcon, color: '#64748B', tintBg: 'rgba(100, 116, 139, 0.12)' },
    ],
    [t]
  );

  const allCategories = useMemo(() => [...onTripCategories, ...preTripCategories], [onTripCategories, preTripCategories]);

  const allCurrencies = useMemo(
    () => [
      { code: 'HKD', name: t('港幣', '港币', 'Hong Kong Dollar') },
      { code: 'TWD', name: t('新台幣', '新台币', 'New Taiwan Dollar') },
      { code: 'JPY', name: t('日圓', '日元', 'Japanese Yen') },
      { code: 'USD', name: t('美元', '美元', 'US Dollar') },
      { code: 'EUR', name: t('歐元', '欧元', 'Euro') },
      { code: 'KRW', name: t('韓元', '韩元', 'South Korean Won') },
      { code: 'CNY', name: t('人民幣', '人民币', 'Chinese Yuan') },
      { code: 'GBP', name: t('英鎊', '英镑', 'British Pound') },
      { code: 'AUD', name: t('澳幣', '澳元', 'Australian Dollar') },
      { code: 'CAD', name: t('加幣', '加元', 'Canadian Dollar') },
      { code: 'SGD', name: t('新加坡幣', '新加坡元', 'Singapore Dollar') },
      { code: 'CHF', name: t('瑞士法郎', '瑞士法郎', 'Swiss Franc') },
      { code: 'THB', name: t('泰銖', '泰铢', 'Thai Baht') },
      { code: 'MYR', name: t('馬來西亞林吉特', '马来西亚林吉特', 'Malaysian Ringgit') },
      { code: 'VND', name: t('越南盾', '越南盾', 'Vietnamese Dong') },
      { code: 'PHP', name: t('菲律賓披索', '菲律宾比索', 'Philippine Peso') },
      { code: 'IDR', name: t('印尼盾', '印尼盾', 'Indonesian Rupiah') },
      { code: 'NZD', name: t('紐西蘭元', '新西兰元', 'New Zealand Dollar') },
      { code: 'MOP', name: t('澳門幣', '澳门元', 'Macanese Pataca') },
      { code: 'TRY', name: t('土耳其里拉', '土耳其里拉', 'Turkish Lira') },
      { code: 'AED', name: t('阿聯酋迪拉姆', '阿联酋迪拉姆', 'UAE Dirham') },
      { code: 'CZK', name: t('捷克克朗', '捷克克朗', 'Czech Koruna') },
      { code: 'ISK', name: t('冰島克朗', '冰岛克朗', 'Icelandic Króna') },
      { code: 'HUF', name: t('匈牙利福林', '匈牙利福林', 'Hungarian Forint') },
    ],
    [t]
  );

  const destinationIntel = useMemo(() => detectDestinationIntel(trip.destination, lang), [trip.destination, lang]);
  const multiCityCurrencies = useMemo(() => {
    if (trip.type !== 'Multi' || !trip.stops?.length) return [];
    const seen = new Set<string>();
    const list: { city: string; currency: string }[] = [];
    trip.stops.forEach((s) => {
      if (!s.destination.trim()) return;
      const d = detectDestinationIntel(s.destination, lang);
      if (!seen.has(d.currency)) {
        seen.add(d.currency);
        list.push({ city: localizeDestinationLabel(s.destination.trim(), lang), currency: d.currency });
      }
    });
    return list;
  }, [trip.type, trip.stops, lang]);

  const [currentView, setCurrentView] = useState<'DASHBOARD' | 'PRE_TRIP' | 'ON_TRIP'>('DASHBOARD');
  const [scopeFilter, setScopeFilter] = useState<'ALL' | 'ON_TRIP' | 'PRE_TRIP'>('ALL');
  const [selectedDayFilter, setSelectedDayFilter] = useState<string | null>(null);
  const [globalCurrency, setGlobalCurrency] = useState('HKD');
  const [activeModal, setActiveModal] = useState<'NONE' | 'BUDGET' | 'ADD_PRE' | 'ADD_ON' | 'STATS'>('NONE');
  const [detailExpense, setDetailExpense] = useState<Expense | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  const expenses = trip.expenses || [];
  const budget: Budget = trip.budget || { amount: 0, currency: destinationIntel.currency, type: 'total' };

  const [draftBudget, setDraftBudget] = useState<Budget>(budget);

  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>(() => {
    try {
      const cached = localStorage.getItem('sky_travel_rates_hkd');
      return cached ? JSON.parse(cached) : FALLBACK_RATES;
    } catch {
      return FALLBACK_RATES;
    }
  });
  const [fxRefreshing, setFxRefreshing] = useState(false);
  const [fxUpdatedAt, setFxUpdatedAt] = useState<number | null>(() => {
    try {
      const ts = Number(localStorage.getItem('sky_travel_rates_hkd_ts') || '0');
      return Number.isFinite(ts) && ts > 0 ? ts : null;
    } catch {
      return null;
    }
  });

  const defaultTopCurrency = destinationIntel.currency || 'JPY';
  const defaultBottomCurrency = defaultTopCurrency === 'HKD' ? 'JPY' : 'HKD';

  const [calcFrom, setCalcFrom] = useState(defaultTopCurrency);
  const [calcTo, setCalcTo] = useState(defaultBottomCurrency);
  const [calcFromAmount, setCalcFromAmount] = useState<string>('');
  const [calcToAmount, setCalcToAmount] = useState<string>('');
  const [calcLastEdited, setCalcLastEdited] = useState<'from' | 'to'>('from');
  const skipFxSyncRef = useRef(false);
  const calcFromInputRef = useRef<HTMLInputElement | null>(null);
  const calcToInputRef = useRef<HTMLInputElement | null>(null);

  const [taxPopKey, setTaxPopKey] = useState(0);
  const [isTaxPopping, setIsTaxPopping] = useState(false);
  const prevTaxEligibleRef = useRef(false);
  const taxPopTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const nextTop = destinationIntel.currency || 'JPY';
    const nextBottom = nextTop === 'HKD' ? 'JPY' : 'HKD';
    setCalcFrom(nextTop);
    setCalcTo(nextBottom);
  }, [trip.id, destinationIntel.currency]);

  useEffect(() => {
    return () => {
      if (taxPopTimerRef.current !== null) window.clearTimeout(taxPopTimerRef.current);
    };
  }, []);

  const [newExpense, setNewExpense] = useState<{
    amount: string;
    currency: string;
    title: string;
    category: string;
    date: string;
    paymentMethod: 'cash' | 'card' | 'other';
    splitCount: number;
  }>({
    amount: '',
    currency: destinationIntel.currency,
    title: '',
    category: '',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'cash',
    splitCount: 1,
  });

  const fetchLiveRates = async (manual = false) => {
    if (manual && fxRefreshing) return;
    setFxRefreshing(true);
    if (manual) tactileAudio.playClick(540, 0.04);
    try {
      let data: { rates?: Record<string, number> } | null = null;
      try {
        const res = await fetch(
          `https://api.exchangerate-api.com/v4/latest/HKD${manual ? `?t=${Date.now()}` : ''}`
        );
        if (res.ok) data = await res.json();
      } catch {
        data = null;
      }
      if (!data?.rates) {
        const res2 = await fetch('https://open.er-api.com/v6/latest/HKD');
        if (res2.ok) data = await res2.json();
      }
      if (data?.rates) {
        setExchangeRates(data.rates);
        const now = Date.now();
        setFxUpdatedAt(now);
        localStorage.setItem('sky_travel_rates_hkd', JSON.stringify(data.rates));
        localStorage.setItem('sky_travel_rates_hkd_ts', String(now));
        if (manual) {
          tactileAudio.playChime();
          onShowToast(
            t('已更新實時匯率（免費公開數據）', '已更新实时汇率（免费公开数据）', 'Live exchange rates updated'),
            'success'
          );
        }
      } else if (manual) {
        onShowToast(
          t('目前無法取得最新匯率，暫以快取計算', '当前无法获取最新汇率，暂以缓存计算', 'Could not refresh rates; using cached values'),
          'info'
        );
      }
    } catch {
      if (manual) {
        onShowToast(
          t('目前無法取得最新匯率，暫以快取計算', '当前无法获取最新汇率，暂以缓存计算', 'Could not refresh rates; using cached values'),
          'info'
        );
      }
    } finally {
      setFxRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchLiveRates(false);
  }, []);

  const convert = (amount: number, from: string, to: string) => {
    if (from === to) return amount;
    if (!exchangeRates[from] || !exchangeRates[to]) return amount;
    const inBase = amount / exchangeRates[from];
    return inBase * exchangeRates[to];
  };

  const getCurrencyLabel = (code: string) => allCurrencies.find((c) => c.code === code)?.name || '';

  const getEffectiveAmount = (exp: Expense): number => {
    const split = exp.splitCount && exp.splitCount > 1 ? exp.splitCount : 1;
    return exp.amount / split;
  };

  const preTripExpenses = useMemo(() => expenses.filter((e) => e.isPreTrip), [expenses]);
  const onTripExpenses = useMemo(() => expenses.filter((e) => !e.isPreTrip), [expenses]);

  const scopedExpenses = useMemo(() => {
    if (scopeFilter === 'ON_TRIP') return onTripExpenses;
    if (scopeFilter === 'PRE_TRIP') return preTripExpenses;
    return expenses;
  }, [scopeFilter, expenses, onTripExpenses, preTripExpenses]);

  const hasAnySplit = useMemo(
    () => scopedExpenses.some((e) => (e.splitCount || 1) > 1),
    [scopedExpenses]
  );

  const scopedTotalBase = useMemo(
    () => scopedExpenses.reduce((sum, e) => sum + convert(getEffectiveAmount(e), e.currency, globalCurrency), 0),
    [scopedExpenses, exchangeRates, globalCurrency]
  );

  const scopedTotalLocal = useMemo(
    () => convert(scopedTotalBase, globalCurrency, destinationIntel.currency),
    [scopedTotalBase, globalCurrency, destinationIntel.currency, exchangeRates]
  );

  const preTripTotalBase = useMemo(
    () => preTripExpenses.reduce((sum, e) => sum + convert(getEffectiveAmount(e), e.currency, globalCurrency), 0),
    [preTripExpenses, exchangeRates, globalCurrency]
  );
  const onTripTotalBase = useMemo(
    () => onTripExpenses.reduce((sum, e) => sum + convert(getEffectiveAmount(e), e.currency, globalCurrency), 0),
    [onTripExpenses, exchangeRates, globalCurrency]
  );

  // Build daily vertical bar chart series matching IMG_7242 (only dated on-trip expenses)
  const dailyChart = useMemo(() => {
    const startMs = Date.parse(`${trip.startDate}T00:00:00Z`);
    const endMs = Date.parse(`${trip.endDate}T00:00:00Z`);
    const dateList: string[] = [];

    if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs >= startMs) {
      const cur = new Date(startMs);
      let guard = 0;
      while (cur.getTime() <= endMs && guard < 31) {
        dateList.push(cur.toISOString().slice(0, 10));
        cur.setUTCDate(cur.getUTCDate() + 1);
        guard += 1;
      }
    }

    const dailyMap: Record<string, number> = {};
    scopedExpenses.forEach((exp) => {
      if (exp.isPreTrip || !exp.date) return;
      const val = convert(getEffectiveAmount(exp), exp.currency, globalCurrency);
      dailyMap[exp.date] = (dailyMap[exp.date] || 0) + val;
      if (!dateList.includes(exp.date) && dateList.length < 14) {
        dateList.push(exp.date);
      }
    });

    const sortedDates = Array.from(new Set(dateList)).sort();
    const bars = sortedDates.map((date) => {
      const dayNum = parseInt(date.slice(8, 10), 10) || 1;
      return {
        date,
        dayLabel: String(dayNum),
        total: dailyMap[date] || 0,
      };
    });

    const maxTotal = Math.max(...bars.map((b) => b.total), 0);
    const activeDaysCount = bars.filter((b) => b.total > 0).length || bars.length || 1;
    const datedTotalBase = Object.values(dailyMap).reduce((s, v) => s + v, 0);
    const avgDaily = (scopeFilter === 'PRE_TRIP' ? scopedTotalBase : datedTotalBase) / activeDaysCount;

    return { bars, maxTotal, avgDaily, avgRatio: maxTotal > 0 ? Math.min(avgDaily / maxTotal, 1) : 0 };
  }, [trip.startDate, trip.endDate, scopedExpenses, scopedTotalBase, scopeFilter, globalCurrency, exchangeRates]);

  const grandTotalBase = preTripTotalBase + onTripTotalBase;
  const grandTotalLocal = convert(grandTotalBase, globalCurrency, destinationIntel.currency);

  const displayedPreTripExpenses = preTripExpenses;

  const displayedOnTripExpenses = useMemo(
    () => (selectedDayFilter ? onTripExpenses.filter((e) => e.date === selectedDayFilter) : onTripExpenses),
    [onTripExpenses, selectedDayFilter]
  );

  const relevantExpenses = onTripExpenses.filter((e) =>
    budget.type === 'cash_only' ? e.paymentMethod === 'cash' : true
  );
  const usedBudgetAmount = relevantExpenses.reduce(
    (sum, e) => sum + convert(getEffectiveAmount(e), e.currency, budget.currency),
    0
  );
  const remainingBudget = budget.amount - usedBudgetAmount;
  const budgetProgress = budget.amount > 0 ? (usedBudgetAmount / budget.amount) * 100 : 0;
  const isOverBudget = remainingBudget < 0;

  const onTripStats = useMemo(() => {
    const catStats: Record<string, number> = {};
    const methodStats: Record<string, number> = { cash: 0, card: 0, other: 0 };
    const dailyStats: Record<string, number> = {};

    onTripExpenses.forEach((exp) => {
      const val = convert(getEffectiveAmount(exp), exp.currency, globalCurrency);
      catStats[exp.category] = (catStats[exp.category] || 0) + val;
      methodStats[exp.paymentMethod] = (methodStats[exp.paymentMethod] || 0) + val;
      if (exp.date) {
        dailyStats[exp.date] = (dailyStats[exp.date] || 0) + val;
      }
    });

    const categories = Object.entries(catStats)
      .sort(([, a], [, b]) => b - a)
      .map(([id, amount]) => {
        const catInfo = allCategories.find((c) => c.id === id) || {
          label: t('其他', '其他', 'Other'),
          color: '#64748B',
          icon: TagIcon,
        };
        return { id, amount, ...catInfo };
      });

    const days = Object.entries(dailyStats)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, total]) => ({ date, total }));

    const maxDailyTotal = Math.max(...days.map((d) => d.total), 0);
    return { categories, methods: methodStats, days, maxDailyTotal, total: onTripTotalBase };
  }, [onTripExpenses, globalCurrency, exchangeRates, onTripTotalBase]);

  const sanitizeDecimalInput = (raw: string): string =>
    raw.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');

  const formatFxInputValue = (val: number, code: string): string => {
    if (!Number.isFinite(val) || val <= 0) return '';
    const integerCurrencies = ['JPY', 'KRW', 'VND', 'IDR', 'ISK', 'HUF'];
    if (integerCurrencies.includes(code) && val >= 10) {
      return String(Math.round(val));
    }
    const rounded = Math.round(val * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
  };

  const handleFxAmountChange = (side: 'from' | 'to', rawValue: string) => {
    const cleaned = sanitizeDecimalInput(rawValue);
    setCalcLastEdited(side);
    const parsed = parseFloat(cleaned);
    const isValid = cleaned !== '' && !Number.isNaN(parsed);

    if (side === 'from') {
      setCalcFromAmount(cleaned);
      setCalcToAmount(isValid ? formatFxInputValue(convert(parsed, calcFrom, calcTo), calcTo) : '');
    } else {
      setCalcToAmount(cleaned);
      setCalcFromAmount(isValid ? formatFxInputValue(convert(parsed, calcTo, calcFrom), calcFrom) : '');
    }
  };

  useEffect(() => {
    if (skipFxSyncRef.current) {
      skipFxSyncRef.current = false;
      return;
    }
    if (calcLastEdited === 'from') {
      const parsed = parseFloat(calcFromAmount);
      if (calcFromAmount === '' || Number.isNaN(parsed)) {
        setCalcToAmount('');
      } else {
        setCalcToAmount(formatFxInputValue(convert(parsed, calcFrom, calcTo), calcTo));
      }
    } else {
      const parsed = parseFloat(calcToAmount);
      if (calcToAmount === '' || Number.isNaN(parsed)) {
        setCalcFromAmount('');
      } else {
        setCalcFromAmount(formatFxInputValue(convert(parsed, calcTo, calcFrom), calcFrom));
      }
    }
  }, [calcFrom, calcTo, exchangeRates]);

  const tripTaxCandidates = useMemo(() => {
    const list = [destinationIntel];
    if (trip.type === 'Multi' && trip.stops?.length) {
      trip.stops.forEach((s) => {
        if (!s.destination.trim()) return;
        list.push(detectDestinationIntel(s.destination, lang));
      });
    }
    return list;
  }, [destinationIntel, trip.type, trip.stops, lang]);

  const activeTaxIntel = useMemo(() => {
    const fromAmt = parseFloat(calcFromAmount) || 0;
    const toAmt = parseFloat(calcToAmount) || 0;
    if (fromAmt <= 0 && toAmt <= 0) return null;

    const matched = tripTaxCandidates.find(
      (intel) =>
        intel.taxFreeThreshold !== null &&
        intel.taxFreeRefundRate !== null &&
        (intel.currency === calcFrom || intel.currency === calcTo)
    );
    if (!matched || matched.taxFreeThreshold === null || matched.taxFreeRefundRate === null) {
      return null;
    }

    const fromMatches = calcFrom === matched.currency;
    const localVal = fromMatches ? fromAmt : toAmt;
    if (localVal <= 0) return null;
    const otherCurrency = fromMatches ? calcTo : calcFrom;
    const threshold = matched.taxFreeThreshold;
    const isEligible = threshold === 0 ? localVal > 0 : localVal >= threshold;
    const progressPct = threshold > 0 ? Math.min(100, (localVal / threshold) * 100) : 100;
    const remainingLocal = Math.max(0, threshold - localVal);
    const remainingOther = convert(remainingLocal, matched.currency, otherCurrency);
    const estimatedRefundLocal = isEligible ? localVal * (matched.taxFreeRefundRate / 100) : 0;
    const estimatedRefundOther = convert(estimatedRefundLocal, matched.currency, otherCurrency);

    return {
      threshold,
      currency: matched.currency,
      symbol: matched.currencySymbol,
      countryLabel: matched.countryLabel,
      vatRate: matched.taxFreeVatRate,
      refundRate: matched.taxFreeRefundRate,
      note: matched.taxFreeNote,
      value: localVal,
      progressPct,
      isEligible,
      remainingLocal,
      remainingOther,
      otherCurrency,
      estimatedRefundLocal,
      estimatedRefundOther,
    };
  }, [calcFrom, calcTo, calcFromAmount, calcToAmount, tripTaxCandidates, exchangeRates]);

  const triggerTaxPopCelebration = () => {
    setTaxPopKey((k) => k + 1);
    setIsTaxPopping(false);
    window.requestAnimationFrame(() => setIsTaxPopping(true));
    if (taxPopTimerRef.current !== null) window.clearTimeout(taxPopTimerRef.current);
    taxPopTimerRef.current = window.setTimeout(() => setIsTaxPopping(false), 480);
    tactileAudio.playPop(1.18);
  };

  useEffect(() => {
    const nowEligible = Boolean(activeTaxIntel?.isEligible);
    if (nowEligible && !prevTaxEligibleRef.current) {
      triggerTaxPopCelebration();
    }
    prevTaxEligibleRef.current = nowEligible;
  }, [activeTaxIntel?.isEligible]);

  const commitExpenses = (nextExpenses: Expense[], deletedId?: string) => {
    const now = Date.now();
    const tombstones = { ...(trip.tombstones || {}) };
    if (deletedId) tombstones[deletedId] = now;
    onUpdateTrip({
      ...trip,
      expenses: nextExpenses,
      tombstones,
      updatedAt: now,
    });
  };

  const handleSaveBudget = () => {
    const now = Date.now();
    onUpdateTrip({
      ...trip,
      budget: { ...draftBudget, updatedAt: now },
      budgetUpdatedAt: now,
      updatedAt: now,
    });
    setActiveModal('NONE');
    onShowToast(t('已更新預算設定', '已更新预算设置', 'Budget updated'), 'success');
  };

  const handleSaveExpense = (isPre: boolean) => {
    if (!newExpense.amount || !newExpense.title.trim() || !newExpense.category) return;
    const now = Date.now();
    const parsedAmt = parseFloat(newExpense.amount);
    if (Number.isNaN(parsedAmt) || parsedAmt <= 0) return;
    const finalSplit = newExpense.splitCount > 1 ? Math.round(newExpense.splitCount) : 1;
    const finalDate = isPre ? '' : newExpense.date || new Date().toISOString().split('T')[0];

    if (editingId) {
      const updated = expenses.map((e) =>
        e.id === editingId
          ? {
              ...e,
              title: newExpense.title.trim(),
              amount: parsedAmt,
              currency: newExpense.currency,
              category: newExpense.category,
              date: finalDate,
              isPreTrip: isPre,
              paymentMethod: newExpense.paymentMethod,
              splitCount: finalSplit > 1 ? finalSplit : undefined,
              updatedAt: now,
            }
          : e
      );
      commitExpenses(updated);
      onShowToast(t('已更新消費紀錄', '已更新消费记录', 'Expense updated'), 'success');
      setEditingId(null);
    } else {
      const expense: Expense = {
        id: generateUniqueId('exp'),
        title: newExpense.title.trim(),
        amount: parsedAmt,
        currency: newExpense.currency,
        category: newExpense.category,
        date: finalDate,
        isPreTrip: isPre,
        paymentMethod: newExpense.paymentMethod,
        splitCount: finalSplit > 1 ? finalSplit : undefined,
        updatedAt: now,
      };
      commitExpenses([expense, ...expenses]);
      onShowToast(t('已新增消費紀錄', '已添加消费记录', 'Expense added'), 'success');
    }

    setActiveModal('NONE');
    setNewExpense({
      amount: '',
      currency: destinationIntel.currency,
      title: '',
      category: '',
      date: new Date().toISOString().split('T')[0],
      paymentMethod: 'cash',
      splitCount: 1,
    });
  };

  const handleEditExpense = (exp: Expense) => {
    setDetailExpense(null);
    setEditingId(exp.id);
    setNewExpense({
      amount: exp.amount.toString(),
      currency: exp.currency,
      title: exp.title,
      category: exp.category,
      date: exp.isPreTrip ? '' : exp.date || new Date().toISOString().split('T')[0],
      paymentMethod: exp.paymentMethod,
      splitCount: exp.splitCount && exp.splitCount > 1 ? exp.splitCount : 1,
    });
    setActiveModal(exp.isPreTrip ? 'ADD_PRE' : 'ADD_ON');
  };

  const CircularProgress = ({
    percentage,
    color,
    size = 96,
    stroke = 8,
    textClassName,
  }: {
    percentage: number;
    color: string;
    size?: number;
    stroke?: number;
    textClassName?: string;
  }) => {
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const progress = Math.min(Math.max(percentage, 0), 100);
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
      <div className="relative flex items-center justify-center shrink-0">
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-zinc-900/10 dark:text-white/10"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span
            className={
              textClassName ||
              `text-base font-display font-bold font-num ${
                isOverBudget ? 'text-red-500' : 'text-zinc-900 dark:text-white'
              }`
            }
          >
            {Math.round(percentage)}%
          </span>
          {size >= 80 && (
            <span className="text-[10px] font-medium text-zinc-400">
              {t('已使用', '已使用', 'Used')}
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderExpenseRow = (exp: Expense) => {
    const personalAmt = getEffectiveAmount(exp);
    const convertedBase = convert(personalAmt, exp.currency, globalCurrency);
    return (
      <motion.div
        layout
        key={exp.id}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        onClick={() => setDetailExpense(exp)}
        className="surface-elevated rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-white dark:hover:bg-zinc-800/80 active:scale-[0.99] transition-all"
      >
        <p className="text-zinc-900 dark:text-white font-semibold text-sm truncate min-w-0">
          {exp.title}
        </p>

        <div className="flex items-center gap-1.5 shrink-0">
          {(exp.splitCount || 1) > 1 && (
            <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
              {t('人均', '人均', '/pp')}
            </span>
          )}
          <span className="text-zinc-900 dark:text-white font-num font-bold text-sm">
            {formatMoney(convertedBase, globalCurrency)}
          </span>
          <ChevronRightIcon className="w-4 h-4 text-zinc-400 shrink-0" />
        </div>
      </motion.div>
    );
  };

  const renderListView = (viewMode: 'PRE_TRIP' | 'ON_TRIP') => {
    const isPre = viewMode === 'PRE_TRIP';
    const title = isPre ? t('行前開支', '行前开支', 'Pre-Trip') : t('旅途消費', '旅途消费', 'On-Trip');
    const rawList = isPre ? preTripExpenses : onTripExpenses;
    const listExpenses = searchQuery.trim()
      ? rawList.filter((e) => e.title.toLowerCase().includes(searchQuery.toLowerCase()))
      : rawList;
    const totalAmount = isPre ? preTripTotalBase : onTripTotalBase;

    return (
      <div data-scroll-lock className="h-full min-h-0 flex flex-col max-w-4xl w-full mx-auto px-5 sm:px-8 pt-5 overflow-clip">
        <div className="relative flex items-center justify-between gap-3 pb-4 shrink-0 min-h-[44px]">
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setCurrentView('DASHBOARD');
            }}
            className="relative z-10 w-10 h-10 rounded-full surface-elevated flex items-center justify-center text-zinc-700 dark:text-zinc-200 cursor-pointer shrink-0"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>

          <div className="pointer-events-none absolute inset-x-0 top-0 bottom-4 flex flex-col items-center justify-center px-24 text-center">
            <h2 className="text-base sm:text-lg font-display font-bold text-zinc-900 dark:text-white truncate leading-tight">
              {title}
            </h2>
            <p className="text-[11px] font-num font-medium text-zinc-500 dark:text-zinc-400 leading-tight">
              {t('總計', '总计', 'Total')} {formatMoney(totalAmount, globalCurrency)}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setActiveModal(isPre ? 'ADD_PRE' : 'ADD_ON');
              setNewExpense({
                amount: '',
                currency: isPre ? globalCurrency : destinationIntel.currency,
                title: '',
                category: '',
                date: isPre ? '' : new Date().toISOString().split('T')[0],
                paymentMethod: isPre ? 'card' : 'cash',
                splitCount: 1,
              });
            }}
            className="relative z-10 min-h-[40px] px-4 rounded-full bg-[var(--tab-accent)] hover:bg-[var(--tab-accent-hover)] text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
          >
            <PlusIcon className="w-4 h-4" />
            <span>{t('記一筆', '记一笔', 'Add')}</span>
          </button>
        </div>

        <div className="surface-elevated rounded-2xl px-3.5 h-11 flex items-center gap-2.5 mb-4 shrink-0">
          <MagnifyingGlassIcon className="w-4 h-4 text-zinc-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('搜尋項目...', '搜索项目...', 'Search expenses...')}
            className="bg-transparent w-full text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none"
          />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-2.5 pb-6 lg:pb-10">
          {listExpenses.length === 0 ? (
            <div className="surface-elevated rounded-3xl py-14 flex flex-col items-center justify-center text-center">
              <TagIcon className="w-8 h-8 text-zinc-400 mb-3" />
              <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                {t(`尚無${title}紀錄`, `暂无${title}记录`, `No ${title.toLowerCase()} expenses yet`)}
              </p>
            </div>
          ) : (
            <AnimatePresence initial={false}>{listExpenses.map(renderExpenseRow)}</AnimatePresence>
          )}
        </div>
      </div>
    );
  };

  return (
    <div data-scroll-lock className="h-full min-h-0 flex flex-col relative bg-transparent overflow-clip">
      {currentView === 'DASHBOARD' ? (
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-5 sm:px-8 pt-3 pb-6 lg:pb-10">
          <div className="max-w-5xl lg:max-w-6xl mx-auto space-y-5">
            {/* Action Toolbar */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <SlidingSegmentedControl
                  size="sm"
                  value={scopeFilter}
                  onChange={(val) => {
                    setScopeFilter(val);
                    setSelectedDayFilter(null);
                  }}
                  options={[
                    { id: 'ALL', label: t('全部', '全部', 'All'), accentFrom: '#4F5DF5', accentTo: '#60A5FA' },
                    { id: 'ON_TRIP', label: t('旅途', '旅途', 'On-Trip'), accentFrom: '#F26B3A', accentTo: '#FB923C' },
                    { id: 'PRE_TRIP', label: t('行前', '行前', 'Pre-Trip'), accentFrom: '#4F46E5', accentTo: '#818CF8' },
                  ]}
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModal('STATS')}
                  className="min-h-[38px] px-3.5 rounded-full surface-elevated text-zinc-700 dark:text-zinc-200 font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <ChartPieIcon className="w-4 h-4 text-[var(--tab-accent)]" />
                  <span className="hidden sm:inline">{t('報表分析', '报表分析', 'Analytics')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setActiveModal(scopeFilter === 'PRE_TRIP' ? 'ADD_PRE' : 'ADD_ON');
                    setNewExpense({
                      amount: '',
                      currency: scopeFilter === 'PRE_TRIP' ? globalCurrency : destinationIntel.currency,
                      title: '',
                      category: '',
                      date: scopeFilter === 'PRE_TRIP' ? '' : new Date().toISOString().split('T')[0],
                      paymentMethod: scopeFilter === 'PRE_TRIP' ? 'card' : 'cash',
                      splitCount: 1,
                    });
                  }}
                  className="min-h-[38px] px-4 rounded-full bg-[var(--tab-accent)] hover:bg-[var(--tab-accent-hover)] text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <PlusIcon className="w-4 h-4" />
                  <span>{t('記一筆', '记一笔', 'Add')}</span>
                </button>
              </div>
            </div>

            {/* Unified Total Spent + Budget Tracking + Daily Bar Chart Hero Card (2-Col on Wide Tablets/Desktop) */}
            <div className="surface-elevated rounded-3xl p-5 sm:p-7">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-7 items-center">
                <div className="lg:col-span-7 space-y-4 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-xs font-semibold tracking-wide text-zinc-400 dark:text-zinc-500 uppercase">
                        {scopeFilter === 'ALL'
                          ? t('總開支與預算', '总开支与预算', 'TOTAL SPENT & BUDGET')
                          : scopeFilter === 'ON_TRIP'
                            ? t('旅途消費與預算', '旅途消费与预算', 'ON-TRIP SPENT & BUDGET')
                            : t('行前開支總覽', '行前开支总览', 'PRE-TRIP SPENT')}
                      </span>
                      <div className="mt-1 flex items-baseline gap-2.5 flex-wrap">
                        <span className="text-4xl sm:text-5xl font-display font-bold font-num text-zinc-900 dark:text-white tracking-tight">
                          {formatMoney(scopedTotalBase, globalCurrency)}
                        </span>
                        {globalCurrency !== destinationIntel.currency && (
                          <span className="text-base font-num font-semibold text-zinc-400 dark:text-zinc-500">
                            {formatMoney(scopedTotalLocal, destinationIntel.currency)}
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex items-center gap-2 text-xs font-num text-zinc-500 dark:text-zinc-400 flex-wrap">
                        <span>
                          {t('日均', '日均', 'Daily avg')} {formatMoney(dailyChart.avgDaily, globalCurrency)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {t(
                            `共 ${scopedExpenses.length} 筆明細`,
                            `共 ${scopedExpenses.length} 笔明细`,
                            `${scopedExpenses.length} entries`
                          )}
                        </span>
                        {hasAnySplit && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{t('已按攤分計算個人實付', '已按分摊计算个人实付', 'Split-adjusted personal share')}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setDraftBudget(budget);
                          setActiveModal('BUDGET');
                        }}
                        className="h-9 px-3 rounded-full bg-[var(--tab-accent-soft)] text-[var(--tab-accent)] font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap hover:brightness-95"
                      >
                        {budget.amount > 0
                          ? t('調整預算', '调整预算', 'Edit Budget')
                          : t('設定預算', '设置预算', 'Set Budget')}
                      </button>
                      <div className="relative">
                        <select
                          value={globalCurrency}
                          onChange={(e) => setGlobalCurrency(e.target.value)}
                          className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
                        >
                          {allCurrencies.map((c) => (
                            <option key={c.code} value={c.code} className="text-zinc-900">
                              {c.code} {c.name}
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-white/[0.06] hover:bg-zinc-200/70 dark:hover:bg-white/10 px-3 h-9 rounded-full transition-colors">
                          <span className="font-num font-bold text-xs text-zinc-900 dark:text-white">{globalCurrency}</span>
                          <ChevronDownIcon className="w-3.5 h-3.5 text-zinc-400" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Integrated Budget Tracking Progress Bar */}
                  {budget.amount > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setDraftBudget(budget);
                        setActiveModal('BUDGET');
                      }}
                      className="w-full text-left rounded-2xl p-3.5 sm:p-4 bg-zinc-100/75 dark:bg-white/[0.04] border border-zinc-200/60 dark:border-white/[0.07] hover:bg-zinc-100 dark:hover:bg-white/[0.07] transition-colors cursor-pointer space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`text-xs font-bold font-num px-2 py-0.5 rounded-full ${
                              isOverBudget
                                ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                                : budgetProgress >= 85
                                  ? 'bg-[#F26B3A]/15 text-[#F26B3A]'
                                  : 'bg-[var(--tab-accent-soft)] text-[var(--tab-accent)]'
                            }`}
                          >
                            {Math.round(budgetProgress)}%
                          </span>
                          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                            {budget.type === 'total'
                              ? t('旅途預算（含現金與刷卡）', '旅途预算（含现金与刷卡）', 'Trip Budget (Cash + Card)')
                              : t('旅途預算（僅計算現金）', '旅途预算（仅计算现金）', 'Trip Budget (Cash Only)')}
                          </span>
                        </div>
                        <div
                          className={`text-xs font-num font-bold ${
                            isOverBudget ? 'text-red-600 dark:text-red-400' : 'text-[var(--tab-accent)]'
                          }`}
                        >
                          {isOverBudget ? t('已超支 ', '已超支 ', 'Over by ') : t('剩餘 ', '剩余 ', 'Left ')}
                          {budget.currency} {Math.round(Math.abs(remainingBudget)).toLocaleString(localeTag)}
                        </div>
                      </div>

                      <div className="h-2 w-full rounded-full bg-zinc-200/90 dark:bg-white/10 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isOverBudget ? 'bg-red-500' : budgetProgress >= 85 ? 'bg-[#F26B3A]' : 'bg-[var(--tab-accent)]'
                          }`}
                          style={{ width: `${Math.min(Math.max(budgetProgress, 0), 100)}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-num text-zinc-500 dark:text-zinc-400">
                        <span>
                          {t('已使用', '已使用', 'Used')} {budget.currency} {Math.round(usedBudgetAmount).toLocaleString(localeTag)}
                        </span>
                        <span>
                          {t('預算上限', '预算上限', 'Cap')} {budget.currency} {budget.amount.toLocaleString(localeTag)}
                        </span>
                      </div>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setDraftBudget(budget);
                        setActiveModal('BUDGET');
                      }}
                      className="w-full rounded-2xl px-4 py-2.5 bg-zinc-100/70 dark:bg-white/[0.04] border border-dashed border-zinc-300/80 dark:border-white/15 hover:border-[var(--tab-accent)] flex items-center justify-between gap-3 transition-colors cursor-pointer"
                    >
                      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        {t('尚未設定旅途預算上限', '尚未设置旅途预算上限', 'No trip budget set yet')}
                      </span>
                      <span className="text-xs font-semibold text-[var(--tab-accent)]">
                        {t('設定預算 →', '设置预算 →', 'Set budget →')}
                      </span>
                    </button>
                  )}

                  {/* Side-by-Side Pre-Trip & On-Trip Summary */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setScopeFilter((prev) => (prev === 'PRE_TRIP' ? 'ALL' : 'PRE_TRIP'))}
                      className={`rounded-2xl p-3.5 sm:p-4 text-left border transition-all cursor-pointer ${
                        scopeFilter === 'PRE_TRIP'
                          ? 'bg-[var(--tab-accent-soft)] border-[var(--tab-accent)]/40'
                          : 'surface-pastel-sky border-zinc-200/60 dark:border-white/[0.08]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[var(--tab-accent)] shrink-0" />
                        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200 whitespace-normal">
                          {t('行前開支', '行前开支', 'Pre-Trip')}
                        </span>
                      </div>
                      <div className="mt-1.5 text-lg sm:text-xl font-display font-bold font-num text-[var(--tab-accent)] break-words">
                        {formatMoney(preTripTotalBase, globalCurrency)}
                      </div>
                      <div className="mt-0.5 text-[11px] font-num text-zinc-500 dark:text-zinc-400 whitespace-normal">
                        {t(
                          `機票、訂房、票券、保險 · ${preTripExpenses.length} 筆`,
                          `机票、订房、票券、保险 · ${preTripExpenses.length} 笔`,
                          `Flights, stay, tickets · ${preTripExpenses.length}`
                        )}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setScopeFilter((prev) => (prev === 'ON_TRIP' ? 'ALL' : 'ON_TRIP'))}
                      className={`rounded-2xl p-3.5 sm:p-4 text-left border transition-all cursor-pointer ${
                        scopeFilter === 'ON_TRIP'
                          ? 'bg-[#F26B3A]/12 border-[#F26B3A]/45'
                          : 'surface-pastel-peach border-zinc-200/60 dark:border-white/[0.08]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#F26B3A] shrink-0" />
                        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200 whitespace-normal">
                          {t('旅途消費', '旅途消费', 'On-Trip')}
                        </span>
                      </div>
                      <div className="mt-1.5 text-lg sm:text-xl font-display font-bold font-num text-[#F26B3A] break-words">
                        {formatMoney(onTripTotalBase, globalCurrency)}
                      </div>
                      <div className="mt-0.5 text-[11px] font-num text-zinc-500 dark:text-zinc-400 whitespace-normal">
                        {t(
                          `餐飲、交通、體驗、購物 · ${onTripExpenses.length} 筆`,
                          `餐饮、交通、体验、购物 · ${onTripExpenses.length} 笔`,
                          `Dining, transit, shopping · ${onTripExpenses.length}`
                        )}
                      </div>
                    </button>
                  </div>
                </div>

                {/* Daily Spend Vertical Bar Chart */}
                {dailyChart.bars.length > 0 && (
                  <div className="lg:col-span-5 lg:rounded-2xl lg:bg-zinc-100/60 lg:dark:bg-white/[0.03] lg:p-4 lg:border lg:border-zinc-200/60 lg:dark:border-white/[0.07]">
                    <div className="hidden lg:flex items-center justify-between text-xs mb-2">
                      <span className="font-semibold text-zinc-500 dark:text-zinc-400">
                        {t('每日消費趨勢', '每日消费趋势', 'Daily Spend Trend')}
                      </span>
                      <span className="font-num text-zinc-400 dark:text-zinc-500">
                        {t('點擊長條篩選單日', '点击柱状条筛选单日', 'Tap a bar to filter day')}
                      </span>
                    </div>
                    <div className="relative h-28 lg:h-36 flex items-end gap-2 sm:gap-3 overflow-x-auto no-scrollbar pr-8 pb-6">
                      {dailyChart.maxTotal > 0 && (
                        <div
                          className="absolute left-0 right-0 border-t border-dashed border-zinc-300 dark:border-white/20 pointer-events-none flex justify-end"
                          style={{ bottom: `${24 + dailyChart.avgRatio * 82}px` }}
                        >
                          <span className="text-[10px] font-num font-medium text-zinc-400 dark:text-zinc-500 -mt-3.5 bg-white/90 dark:bg-[#151924] px-1">
                            {t('日均', '日均', 'avg')}
                          </span>
                        </div>
                      )}

                      {dailyChart.bars.map((bar) => {
                        const heightPx =
                          dailyChart.maxTotal > 0 && bar.total > 0
                            ? Math.max(Math.round((bar.total / dailyChart.maxTotal) * 82), 10)
                            : 8;
                        const isSelected = selectedDayFilter === bar.date;
                        const hasSpend = bar.total > 0;
                        return (
                          <button
                            key={bar.date}
                            type="button"
                            onClick={() => setSelectedDayFilter((prev) => (prev === bar.date ? null : bar.date))}
                            title={`${bar.date}: ${formatMoney(bar.total, globalCurrency)}`}
                            className="relative flex-1 min-w-[26px] max-w-[46px] flex flex-col items-center justify-end h-full group cursor-pointer"
                          >
                            <div className="w-full flex items-end justify-center h-[82px]">
                              <div
                                className={`w-full max-w-[30px] rounded-t-lg transition-all duration-300 ${
                                  isSelected
                                    ? 'bg-[var(--tab-accent)]'
                                    : hasSpend
                                      ? 'bg-zinc-900 dark:bg-zinc-200 group-hover:bg-[var(--tab-accent)]'
                                      : 'bg-zinc-200/75 dark:bg-white/[0.08]'
                                }`}
                                style={{ height: `${heightPx}px` }}
                              />
                            </div>
                            <span
                              className={`absolute -bottom-5 text-[11px] font-num font-semibold ${
                                isSelected
                                  ? 'text-[var(--tab-accent)]'
                                  : hasSpend
                                    ? 'text-zinc-600 dark:text-zinc-300'
                                    : 'text-zinc-400 dark:text-zinc-600'
                              }`}
                            >
                              {bar.dayLabel}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Active Day Bar Filter Chip */}
            {selectedDayFilter && (
              <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl surface-pastel-sky text-xs">
                <span className="font-semibold text-zinc-800 dark:text-zinc-100 font-num">
                  {t(
                    `正在篩選 ${selectedDayFilter} 當日消費`,
                    `正在筛选 ${selectedDayFilter} 当日消费`,
                    `Filtering expenses on ${selectedDayFilter}`
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedDayFilter(null)}
                  className="font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 cursor-pointer"
                >
                  <XMarkIcon className="w-3.5 h-3.5" />
                  <span>{t('清除篩選', '清除筛选', 'Clear')}</span>
                </button>
              </div>
            )}

            {/* Separated Expense Tables (Side-by-Side 2 Columns on Wide Screens) */}
            <div className={`grid grid-cols-1 ${scopeFilter === 'ALL' ? 'lg:grid-cols-2' : ''} gap-5 items-start`}>
              {/* Table 1: 行前開支表 */}
              {(scopeFilter === 'ALL' || scopeFilter === 'PRE_TRIP') && (
                <section className="surface-elevated rounded-3xl overflow-hidden">
                  <div className="px-5 sm:px-6 py-4 border-b border-zinc-200/70 dark:border-white/[0.07] flex items-center justify-between gap-3 bg-gradient-to-r from-indigo-50/60 via-transparent to-transparent dark:from-indigo-500/[0.06]">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-[var(--tab-accent)] shrink-0" />
                      <div className="min-w-0">
                        <h3 className="font-display font-bold text-base text-zinc-900 dark:text-white">
                          {t('行前開支表', '行前开支表', 'Pre-Trip Expenses')}
                        </h3>
                        <p className="text-[11px] font-num text-zinc-500 dark:text-zinc-400">
                          {t(
                            `共 ${displayedPreTripExpenses.length} 項 · 點擊項目查看明細`,
                            `共 ${displayedPreTripExpenses.length} 项 · 点击项目查看明细`,
                            `${displayedPreTripExpenses.length} items · Tap to inspect`
                          )}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-num font-bold text-[var(--tab-accent)] shrink-0">
                      {formatMoney(preTripTotalBase, globalCurrency)}
                    </span>
                  </div>

                  {displayedPreTripExpenses.length === 0 ? (
                    <div className="py-7 px-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
                      {t('尚未紀錄任何行前開支', '尚未记录任何行前开支', 'No pre-trip expenses recorded')}
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-200/50 dark:divide-white/[0.05]">
                      {displayedPreTripExpenses.slice(0, 4).map((exp) => {
                        const convertedBase = convert(getEffectiveAmount(exp), exp.currency, globalCurrency);
                        return (
                          <button
                            key={exp.id}
                            type="button"
                            onClick={() => setDetailExpense(exp)}
                            className="w-full px-5 sm:px-6 py-3.5 flex items-center justify-between gap-4 text-left hover:bg-zinc-900/[0.025] dark:hover:bg-white/[0.03] transition-colors cursor-pointer"
                          >
                            <span className="text-sm font-semibold text-zinc-900 dark:text-white truncate min-w-0">
                              {exp.title}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {(exp.splitCount || 1) > 1 && (
                                <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
                                  {t('人均', '人均', '/pp')}
                                </span>
                              )}
                              <span className="text-sm font-num font-bold text-zinc-900 dark:text-white">
                                {formatMoney(convertedBase, globalCurrency)}
                              </span>
                              <ChevronRightIcon className="w-4 h-4 text-zinc-400" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {displayedPreTripExpenses.length > 4 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setCurrentView('PRE_TRIP');
                      }}
                      className="w-full px-5 sm:px-6 py-3 border-t border-zinc-200/60 dark:border-white/[0.06] text-xs font-semibold text-[var(--tab-accent)] hover:bg-[var(--tab-accent-soft)] flex items-center justify-center gap-1 cursor-pointer transition-colors"
                    >
                      <span>
                        {t(
                          `查看全部 ${displayedPreTripExpenses.length} 項行前開支`,
                          `查看全部 ${displayedPreTripExpenses.length} 项行前开支`,
                          `View all ${displayedPreTripExpenses.length} pre-trip items`
                        )}
                      </span>
                      <ChevronRightIcon className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <div className="px-5 sm:px-6 py-3.5 bg-zinc-100/75 dark:bg-white/[0.03] border-t border-zinc-200/70 dark:border-white/[0.06] flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                      {t('行前開支小計', '行前开支小计', 'Pre-Trip Subtotal')}
                    </span>
                    <span className="text-base font-display font-bold font-num text-[var(--tab-accent)]">
                      {formatMoney(preTripTotalBase, globalCurrency)}
                    </span>
                  </div>
                </section>
              )}

              {/* Table 2: 旅途消費表 */}
              {(scopeFilter === 'ALL' || scopeFilter === 'ON_TRIP') && (
                <section className="surface-elevated rounded-3xl overflow-hidden">
                  <div className="px-5 sm:px-6 py-4 border-b border-zinc-200/70 dark:border-white/[0.07] flex items-center justify-between gap-3 bg-gradient-to-r from-orange-50/70 via-transparent to-transparent dark:from-orange-500/[0.07]">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#F26B3A] shrink-0" />
                      <div className="min-w-0">
                        <h3 className="font-display font-bold text-base text-zinc-900 dark:text-white">
                          {t('旅途消費表', '旅途消费表', 'On-Trip Expenses')}
                        </h3>
                        <p className="text-[11px] font-num text-zinc-500 dark:text-zinc-400">
                          {t(
                            `共 ${displayedOnTripExpenses.length} 項 · 點擊項目查看明細`,
                            `共 ${displayedOnTripExpenses.length} 项 · 点击项目查看明细`,
                            `${displayedOnTripExpenses.length} items · Tap to inspect`
                          )}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-num font-bold text-[#F26B3A] shrink-0">
                      {formatMoney(onTripTotalBase, globalCurrency)}
                    </span>
                  </div>

                  {displayedOnTripExpenses.length === 0 ? (
                    <div className="py-7 px-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
                      {t('尚未紀錄任何旅途消費', '尚未记录任何旅途消费', 'No on-trip expenses recorded')}
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-200/50 dark:divide-white/[0.05]">
                      {displayedOnTripExpenses.slice(0, 4).map((exp) => {
                        const convertedBase = convert(getEffectiveAmount(exp), exp.currency, globalCurrency);
                        return (
                          <button
                            key={exp.id}
                            type="button"
                            onClick={() => setDetailExpense(exp)}
                            className="w-full px-5 sm:px-6 py-3.5 flex items-center justify-between gap-4 text-left hover:bg-zinc-900/[0.025] dark:hover:bg-white/[0.03] transition-colors cursor-pointer"
                          >
                            <span className="text-sm font-semibold text-zinc-900 dark:text-white truncate min-w-0">
                              {exp.title}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {(exp.splitCount || 1) > 1 && (
                                <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
                                  {t('人均', '人均', '/pp')}
                                </span>
                              )}
                              <span className="text-sm font-num font-bold text-zinc-900 dark:text-white">
                                {formatMoney(convertedBase, globalCurrency)}
                              </span>
                              <ChevronRightIcon className="w-4 h-4 text-zinc-400" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {displayedOnTripExpenses.length > 4 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setCurrentView('ON_TRIP');
                      }}
                      className="w-full px-5 sm:px-6 py-3 border-t border-zinc-200/60 dark:border-white/[0.06] text-xs font-semibold text-[#F26B3A] hover:bg-[#F26B3A]/[0.05] flex items-center justify-center gap-1 cursor-pointer transition-colors"
                    >
                      <span>
                        {t(
                          `查看全部 ${displayedOnTripExpenses.length} 項旅途消費`,
                          `查看全部 ${displayedOnTripExpenses.length} 项旅途消费`,
                          `View all ${displayedOnTripExpenses.length} on-trip items`
                        )}
                      </span>
                      <ChevronRightIcon className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <div className="px-5 sm:px-6 py-3.5 bg-zinc-100/75 dark:bg-white/[0.03] border-t border-zinc-200/70 dark:border-white/[0.06] flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                      {t('旅途消費小計', '旅途消费小计', 'On-Trip Subtotal')}
                    </span>
                    <span className="text-base font-display font-bold font-num text-[#F26B3A]">
                      {formatMoney(onTripTotalBase, globalCurrency)}
                    </span>
                  </div>
                </section>
              )}
            </div>

            {/* Bottom Row: Unified Grand Total + Currency Converter Side-by-Side on Wide Screens */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              <section className="lg:col-span-6 ink-card rounded-3xl p-5 sm:p-6 flex flex-col justify-between space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                      {t('統一總算', '统一总算', 'TOTAL SUMMARY')}
                    </div>
                    <h3 className="text-lg font-display font-bold text-white mt-0.5">
                      {t('行前 + 旅途總花費', '行前 + 旅途总花费', 'Pre-Trip + On-Trip Total')}
                    </h3>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl sm:text-3xl font-display font-bold font-num text-white">
                      {formatMoney(grandTotalBase, globalCurrency)}
                    </div>
                    {globalCurrency !== destinationIntel.currency && (
                      <div className="text-xs font-num text-zinc-400">
                        {t('約 ', '约 ', '≈ ')}
                        {formatMoney(grandTotalLocal, destinationIntel.currency)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-white/10 text-xs">
                  <div className="rounded-2xl bg-white/[0.06] px-3.5 py-2.5">
                    <div className="text-zinc-400">{t('行前開支小計', '行前开支小计', 'Pre-Trip')}</div>
                    <div className="font-num font-bold text-sm text-indigo-300 mt-0.5">
                      {formatMoney(preTripTotalBase, globalCurrency)}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white/[0.06] px-3.5 py-2.5">
                    <div className="text-zinc-400">{t('旅途消費小計', '旅途消费小计', 'On-Trip')}</div>
                    <div className="font-num font-bold text-sm text-[#FF9E7B] mt-0.5">
                      {formatMoney(onTripTotalBase, globalCurrency)}
                    </div>
                  </div>
                  <div className="col-span-2 sm:col-span-1 rounded-2xl bg-white/[0.06] px-3.5 py-2.5 flex sm:block items-center justify-between">
                    <div className="text-zinc-400">
                      {t(`共 ${expenses.length} 筆明細`, `共 ${expenses.length} 笔明细`, `${expenses.length} entries`)}
                    </div>
                    <div className="font-num font-bold text-sm text-emerald-300 mt-0.5">
                      {formatMoney(grandTotalBase, globalCurrency)}
                    </div>
                  </div>
                </div>
              </section>

              {/* Currency Converter & Dynamic Tax-Free */}
              <div className="lg:col-span-6 surface-elevated rounded-3xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 text-zinc-900 dark:text-white">
                    <ArrowsRightLeftIcon className="w-4 h-4 text-[var(--tab-accent)]" />
                    <h3 className="font-display font-bold text-base">
                      {t('匯率換算', '汇率换算', 'Currency Converter')}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-num text-zinc-500 dark:text-zinc-400">
                      1 {calcFrom} ={' '}
                      {(exchangeRates[calcTo] && exchangeRates[calcFrom]
                        ? exchangeRates[calcTo] / exchangeRates[calcFrom]
                        : 1
                      ).toFixed(4)}{' '}
                      {calcTo}
                    </span>
                    <button
                      type="button"
                      onClick={() => void fetchLiveRates(true)}
                      disabled={fxRefreshing}
                      title={
                        fxUpdatedAt
                          ? `${t('更新實時匯率（免費公開資料，上次更新：', '更新实时汇率（免费公开数据，上次更新：', 'Refresh live FX (free open feed, last: ')}${new Date(fxUpdatedAt).toLocaleTimeString(localeTag, { hour: '2-digit', minute: '2-digit' })}`
                          : t('更新實時匯率', '更新实时汇率', 'Refresh live exchange rates')
                      }
                      className="min-h-[30px] px-2.5 rounded-full bg-zinc-100 dark:bg-white/[0.08] hover:bg-zinc-200/80 dark:hover:bg-white/[0.14] border border-zinc-200/70 dark:border-white/10 text-[11px] font-semibold text-zinc-700 dark:text-zinc-200 inline-flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
                    >
                      <RefreshIcon className={`w-3.5 h-3.5 ${fxRefreshing ? 'animate-spin text-[var(--tab-accent)]' : ''}`} />
                      <span>{fxRefreshing ? t('更新中', '更新中', 'Updating') : t('實時匯率', '实时汇率', 'Refresh FX')}</span>
                    </button>
                  </div>
                </div>

                {multiCityCurrencies.length > 1 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                    {multiCityCurrencies.map((item) => {
                      const isActive = calcFrom === item.currency || (calcTo !== 'HKD' && calcTo === item.currency);
                      return (
                        <button
                          key={item.currency}
                          type="button"
                          onClick={() => {
                            tactileAudio.playClick(500, 0.035);
                            if (item.currency === calcTo) {
                              skipFxSyncRef.current = true;
                              setCalcFrom(calcTo);
                              setCalcTo(calcFrom);
                              setCalcFromAmount(calcToAmount);
                              setCalcToAmount(calcFromAmount);
                              setCalcLastEdited((s) => (s === 'from' ? 'to' : 'from'));
                            } else {
                              setCalcFrom(item.currency);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            isActive
                              ? 'bg-indigo-600 text-white'
                              : 'bg-zinc-100 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-300'
                          }`}
                        >
                          {item.city} · {item.currency}
                        </button>
                      );
                    })}
                  </div>
                )}

                {activeTaxIntel && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className={`relative overflow-visible rounded-2xl p-3.5 sm:p-4 border flex items-center justify-between gap-3.5 transition-colors duration-300 ${
                      activeTaxIntel.isEligible
                        ? 'bg-amber-400/12 dark:bg-amber-500/14 border-amber-400/55 shadow-[0_10px_24px_-14px_rgba(245,158,11,0.55)]'
                        : 'bg-zinc-100/80 dark:bg-white/[0.04] border-zinc-200/70 dark:border-white/[0.06]'
                    }`}
                  >
                    <div className="min-w-0 relative z-10 space-y-0.5">
                      <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 block">
                        {activeTaxIntel.threshold === 0
                          ? t(
                              `${activeTaxIntel.countryLabel}免稅額度（消費即享退稅）`,
                              `${activeTaxIntel.countryLabel}免税额度（消费即享退税）`,
                              `${activeTaxIntel.countryLabel} Tax-Free (No Min)`
                            )
                          : t(
                              `${activeTaxIntel.countryLabel}免稅 · 滿 ${formatMoney(activeTaxIntel.threshold, activeTaxIntel.currency)}`,
                              `${activeTaxIntel.countryLabel}免税 · 满 ${formatMoney(activeTaxIntel.threshold, activeTaxIntel.currency)}`,
                              `${activeTaxIntel.countryLabel} Tax-Free · Min ${formatMoney(activeTaxIntel.threshold, activeTaxIntel.currency)}`
                            )}
                      </span>

                      {activeTaxIntel.isEligible ? (
                        <>
                          <div className="font-display font-bold text-sm text-amber-700 dark:text-amber-300">
                            {t('已達免稅額度', '已达免税额度', 'Tax-Free Eligible')}
                          </div>
                          <div className="text-xs font-num font-semibold text-zinc-900 dark:text-white">
                            {t('預計可退約 ', '预计可退约 ', 'Est. refund ~')}
                            <span className="text-amber-700 dark:text-amber-300 font-bold">
                              {formatMoney(activeTaxIntel.estimatedRefundLocal, activeTaxIntel.currency)}
                            </span>
                            {activeTaxIntel.otherCurrency !== activeTaxIntel.currency && (
                              <span className="text-zinc-500 dark:text-zinc-400">
                                {' '}
                                ({t('約 ', '约 ', '≈ ')}
                                {formatMoney(activeTaxIntel.estimatedRefundOther, activeTaxIntel.otherCurrency)})
                              </span>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="font-num font-bold text-sm text-zinc-900 dark:text-white">
                            {t('還差 ', '还差 ', 'Add ')}
                            {formatMoney(activeTaxIntel.remainingLocal, activeTaxIntel.currency)}
                            {activeTaxIntel.otherCurrency !== activeTaxIntel.currency && (
                              <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
                                {' '}
                                ({t('約 ', '约 ', '≈ ')}
                                {formatMoney(activeTaxIntel.remainingOther, activeTaxIntel.otherCurrency)})
                              </span>
                            )}
                          </div>
                          {activeTaxIntel.note && (
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                              {activeTaxIntel.note}
                            </p>
                          )}
                        </>
                      )}
                    </div>

                    {/* Gallery Pop-styled Circular Tax-Free Gauge + radial Pop firework particles */}
                    <button
                      type="button"
                      onClick={() => {
                        if (activeTaxIntel.isEligible) {
                          triggerTaxPopCelebration();
                        } else {
                          tactileAudio.playTick(0.9);
                        }
                      }}
                      aria-label={t('免稅進度', '免税进度', 'Tax-free progress')}
                      className={`relative z-10 w-[62px] h-[62px] rounded-2xl flex items-center justify-center shrink-0 transition-colors cursor-pointer select-none ${
                        activeTaxIntel.isEligible
                          ? 'bg-amber-400/15 dark:bg-amber-400/12 border border-amber-400/45 shadow-xs'
                          : 'bg-white/80 dark:bg-white/[0.06] border border-zinc-200/75 dark:border-white/10'
                      } ${isTaxPopping ? 'animate-fx-pop' : ''}`}
                    >
                      {/* Persistent low-opacity perimeter firework rays when eligible (strictly outside r=31) */}
                      {activeTaxIntel.isEligible && (
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute -inset-3.5 flex items-center justify-center opacity-30"
                        >
                          <motion.svg
                            viewBox="0 0 88 88"
                            className="w-full h-full text-amber-500 dark:text-amber-300"
                            initial={prefersReduced ? undefined : { scale: 0.72, opacity: 0 }}
                            animate={
                              prefersReduced
                                ? { scale: 1, opacity: 0.9 }
                                : { scale: [0.72, 1.06, 1], opacity: [0, 1, 0.85] }
                            }
                            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                          >
                            <g stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                              <line x1="44" y1="3" x2="44" y2="10" />
                              <line x1="44" y1="78" x2="44" y2="85" />
                              <line x1="3" y1="44" x2="10" y2="44" />
                              <line x1="78" y1="44" x2="85" y2="44" />
                              <line x1="15" y1="15" x2="20" y2="20" />
                              <line x1="68" y1="68" x2="73" y2="73" />
                              <line x1="73" y1="15" x2="68" y2="20" />
                              <line x1="20" y1="68" x2="15" y2="73" />
                            </g>
                            <circle cx="29" cy="8" r="1.4" fill="currentColor" />
                            <circle cx="62" cy="10" r="1.2" fill="currentColor" />
                            <circle cx="78" cy="59" r="1.4" fill="currentColor" />
                            <circle cx="10" cy="58" r="1.2" fill="currentColor" />
                          </motion.svg>
                        </div>
                      )}

                      {/* Gallery Pop burst sparks flying outward from outer perimeter when threshold reached */}
                      {taxPopKey > 0 && activeTaxIntel.isEligible && !prefersReduced && (
                        <span
                          key={taxPopKey}
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 flex items-center justify-center"
                        >
                          {[
                            { sym: '✦', angle: -Math.PI / 2, dist: 42 },
                            { sym: '★', angle: -Math.PI / 4, dist: 44 },
                            { sym: '●', angle: 0, dist: 41 },
                            { sym: '✦', angle: Math.PI / 4, dist: 44 },
                            { sym: '★', angle: Math.PI / 2, dist: 42 },
                            { sym: '●', angle: (3 * Math.PI) / 4, dist: 44 },
                            { sym: '✦', angle: Math.PI, dist: 41 },
                            { sym: '★', angle: (-3 * Math.PI) / 4, dist: 44 },
                          ].map((p, idx) => {
                            const startR = 25;
                            const startX = Math.cos(p.angle) * startR;
                            const startY = Math.sin(p.angle) * startR;
                            const endX = Math.cos(p.angle) * p.dist;
                            const endY = Math.sin(p.angle) * p.dist;
                            return (
                              <motion.span
                                key={idx}
                                initial={{ x: startX, y: startY, scale: 0.45, opacity: 0.85 }}
                                animate={{ x: endX, y: endY, scale: 1.15, opacity: 0 }}
                                transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
                                className="absolute text-[10px] leading-none text-amber-500 dark:text-amber-300"
                              >
                                {p.sym}
                              </motion.span>
                            );
                          })}
                        </span>
                      )}

                      <CircularProgress
                        percentage={activeTaxIntel.progressPct}
                        color={activeTaxIntel.isEligible ? '#F59E0B' : '#4F46E5'}
                        size={48}
                        stroke={4.5}
                        textClassName={`text-[11px] font-num font-bold leading-none ${
                          activeTaxIntel.isEligible
                            ? 'text-amber-700 dark:text-amber-300'
                            : 'text-zinc-800 dark:text-zinc-100'
                        }`}
                      />
                    </button>
                  </motion.div>
                )}

                <div className="space-y-1">
                  {/* Top Currency Box (defaults to local destination currency) */}
                  <div className="bg-zinc-100/80 dark:bg-white/[0.04] hover:bg-zinc-100 dark:hover:bg-white/[0.06] focus-within:ring-2 focus-within:ring-[var(--tab-accent)]/35 rounded-2xl flex items-stretch justify-between border border-zinc-200/60 dark:border-white/[0.06] transition-all">
                    <label
                      htmlFor="fx-from-input"
                      className="min-w-0 flex-1 p-4 pr-2 cursor-text flex flex-col justify-center"
                    >
                      <span className="text-[11px] font-medium text-zinc-500 block mb-1">
                        {getCurrencyLabel(calcFrom)}
                      </span>
                      <input
                        id="fx-from-input"
                        ref={calcFromInputRef}
                        type="text"
                        inputMode="decimal"
                        pattern="[0-9.]*"
                        enterKeyHint="done"
                        autoComplete="off"
                        value={calcFromAmount}
                        onChange={(e) => handleFxAmountChange('from', e.target.value)}
                        placeholder={calcFrom === 'JPY' || calcFrom === 'KRW' ? '5000' : '1000'}
                        className="bg-transparent text-zinc-900 dark:text-white font-display font-bold font-num text-2xl w-full min-h-[40px] py-0.5 focus:outline-none placeholder-zinc-300 dark:placeholder-zinc-700"
                      />
                    </label>
                    <div className="p-4 pl-2 flex items-center shrink-0">
                      <div className="relative">
                        <select
                          aria-label={t('選擇上方幣別', '选择上方币种', 'Select top currency')}
                          value={calcFrom}
                          onChange={(e) => setCalcFrom(e.target.value)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        >
                          {allCurrencies.map((c) => (
                            <option key={c.code} value={c.code} className="text-zinc-900">
                              {c.code} {c.name}
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-800 py-1.5 px-3 rounded-full border border-zinc-200/80 dark:border-white/10">
                          <span className="font-num font-bold text-xs text-zinc-900 dark:text-white">{calcFrom}</span>
                          <ChevronDownIcon className="w-3.5 h-3.5 text-zinc-400" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-center -my-3 relative z-10 pointer-events-none">
                    <button
                      type="button"
                      onClick={() => {
                        tactileAudio.playClick(520, 0.035);
                        skipFxSyncRef.current = true;
                        setCalcFrom(calcTo);
                        setCalcTo(calcFrom);
                        setCalcFromAmount(calcToAmount);
                        setCalcToAmount(calcFromAmount);
                        setCalcLastEdited((s) => (s === 'from' ? 'to' : 'from'));
                      }}
                      aria-label={t('交換幣別', '交换币种', 'Swap currencies')}
                      className="pointer-events-auto w-9 h-9 rounded-full bg-indigo-600 text-white shadow-md flex items-center justify-center hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                    >
                      <ArrowsRightLeftIcon className="w-4 h-4 rotate-90" />
                    </button>
                  </div>

                  {/* Bottom Currency Box (defaults to HKD, also natively editable) */}
                  <div className="bg-zinc-100/80 dark:bg-white/[0.04] hover:bg-zinc-100 dark:hover:bg-white/[0.06] focus-within:ring-2 focus-within:ring-[var(--tab-accent)]/35 rounded-2xl flex items-stretch justify-between border border-zinc-200/60 dark:border-white/[0.06] transition-all">
                    <label
                      htmlFor="fx-to-input"
                      className="min-w-0 flex-1 p-4 pr-2 cursor-text flex flex-col justify-center"
                    >
                      <span className="text-[11px] font-medium text-zinc-500 block mb-1">
                        {getCurrencyLabel(calcTo)}
                      </span>
                      <input
                        id="fx-to-input"
                        ref={calcToInputRef}
                        type="text"
                        inputMode="decimal"
                        pattern="[0-9.]*"
                        enterKeyHint="done"
                        autoComplete="off"
                        value={calcToAmount}
                        onChange={(e) => handleFxAmountChange('to', e.target.value)}
                        placeholder="0.00"
                        className="bg-transparent text-zinc-900 dark:text-white font-display font-bold font-num text-2xl w-full min-h-[40px] py-0.5 focus:outline-none placeholder-zinc-300 dark:placeholder-zinc-700"
                      />
                    </label>
                    <div className="p-4 pl-2 flex items-center shrink-0">
                      <div className="relative">
                        <select
                          aria-label={t('選擇下方幣別', '选择下方币种', 'Select bottom currency')}
                          value={calcTo}
                          onChange={(e) => setCalcTo(e.target.value)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        >
                          {allCurrencies.map((c) => (
                            <option key={c.code} value={c.code} className="text-zinc-900">
                              {c.code} {c.name}
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-800 py-1.5 px-3 rounded-full border border-zinc-200/80 dark:border-white/10">
                          <span className="font-num font-bold text-xs text-zinc-900 dark:text-white">{calcTo}</span>
                          <ChevronDownIcon className="w-3.5 h-3.5 text-zinc-400" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
            </div>
            </div>
          </div>
        </div>
      ) : (
        renderListView(currentView)
      )}

      {/* Budget Modal */}
      <LiquidModal
        open={activeModal === 'BUDGET'}
        onClose={() => setActiveModal('NONE')}
        maxWidthClass="max-w-sm"
        title={t('設定旅途預算', '设置旅途预算', 'Set Trip Budget')}
      >
        <div className="space-y-4">
          <div className="flex gap-2.5">
            <div className="flex-1 bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200/70 dark:border-white/10 rounded-2xl p-3.5">
              <span className="text-[11px] font-medium text-zinc-500 block mb-1">
                {t('金額', '金额', 'Amount')}
              </span>
              <input
                type="number"
                value={draftBudget.amount || ''}
                onChange={(e) => setDraftBudget({ ...draftBudget, amount: parseFloat(e.target.value) || 0 })}
                className="w-full bg-transparent text-zinc-900 dark:text-white font-display font-bold font-num text-2xl focus:outline-none"
                placeholder="0"
              />
            </div>
            <div className="w-28 bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200/70 dark:border-white/10 rounded-2xl relative flex items-center justify-center">
              <select
                value={draftBudget.currency}
                onChange={(e) => setDraftBudget({ ...draftBudget, currency: e.target.value })}
                className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
              >
                {allCurrencies.map((c) => (
                  <option key={c.code} value={c.code} className="text-zinc-900">
                    {c.code} {c.name}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-1 pointer-events-none">
                <span className="font-num font-bold text-sm text-zinc-900 dark:text-white">{draftBudget.currency}</span>
                <ChevronDownIcon className="w-4 h-4 text-zinc-400" />
              </div>
            </div>
          </div>

          <SlidingSegmentedControl
            fullWidth
            size="md"
            value={draftBudget.type}
            onChange={(bt) => setDraftBudget({ ...draftBudget, type: bt })}
            options={[
              { id: 'total', label: t('總預算 (現金+卡)', '总预算 (现金+卡)', 'Total (Cash + Card)'), accentFrom: '#4F5DF5', accentTo: '#6366F1' },
              { id: 'cash_only', label: t('僅限現金', '仅限现金', 'Cash Only'), accentFrom: '#0E9F76', accentTo: '#10B981' },
            ]}
          />

          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => setActiveModal('NONE')}
              className="flex-1 min-h-[46px] rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-semibold text-sm cursor-pointer"
            >
              {t('取消', '取消', 'Cancel')}
            </button>
            <button
              type="button"
              onClick={handleSaveBudget}
              className="flex-1 min-h-[46px] rounded-full bg-[var(--tab-accent)] hover:bg-[var(--tab-accent-hover)] text-white font-semibold text-sm cursor-pointer"
            >
              {t('儲存', '保存', 'Save')}
            </button>
          </div>
        </div>
      </LiquidModal>

      {/* Expense Detail Modal (Tap row to inspect full breakdown) */}
      <LiquidModal
        open={!!detailExpense}
        onClose={() => setDetailExpense(null)}
        bottomSheetOnMobile
        maxWidthClass="max-w-md"
        title={
          detailExpense?.isPreTrip
            ? t('行前開支明細', '行前开支明细', 'Pre-Trip Detail')
            : t('旅途消費明細', '旅途消费明细', 'Expense Detail')
        }
      >
        {detailExpense &&
          (() => {
            const cat =
              allCategories.find((c) => c.id === detailExpense.category) ||
              allCategories[allCategories.length - 1];
            const splitN = detailExpense.splitCount && detailExpense.splitCount > 1 ? detailExpense.splitCount : 1;
            const personalAmt = detailExpense.amount / splitN;
            const personalBase = convert(personalAmt, detailExpense.currency, globalCurrency);
            const totalBase = convert(detailExpense.amount, detailExpense.currency, globalCurrency);
            const payLabel =
              detailExpense.paymentMethod === 'cash'
                ? t('現金', '现金', 'Cash')
                : detailExpense.paymentMethod === 'card'
                  ? t('信用卡', '信用卡', 'Card')
                  : t('其他', '其他', 'Other');

            return (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-zinc-200/70 dark:border-white/[0.08]">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: cat.tintBg, color: cat.color }}
                    >
                      <cat.icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg font-display font-bold text-zinc-900 dark:text-white break-words">
                        {detailExpense.title}
                      </h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {detailExpense.isPreTrip ? t('行前開支', '行前开支', 'Pre-Trip') : t('旅途消費', '旅途消费', 'On-Trip')} · {cat.label}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-zinc-100/80 dark:bg-white/[0.04] p-4 space-y-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      {splitN > 1
                        ? t(
                            `個人攤分金額（共 ${splitN} 人）`,
                            `个人分摊金额（共 ${splitN} 人）`,
                            `Your share (split by ${splitN})`
                          )
                        : t('消費金額', '消费金额', 'Amount')}
                    </span>
                    <span className="text-2xl font-display font-bold font-num text-zinc-900 dark:text-white">
                      {formatMoney(personalAmt, detailExpense.currency)}
                    </span>
                  </div>
                  {detailExpense.currency !== globalCurrency && (
                    <div className="flex items-center justify-between text-xs font-num text-zinc-500 dark:text-zinc-400">
                      <span>{t('折合基準幣別', '折合基准币种', 'Converted amount')}</span>
                      <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                        ≈ {formatMoney(personalBase, globalCurrency)}
                      </span>
                    </div>
                  )}
                  {splitN > 1 && (
                    <div className="pt-2 border-t border-zinc-200/70 dark:border-white/[0.08] flex items-center justify-between text-xs font-num text-indigo-600 dark:text-indigo-400 font-semibold">
                      <span>
                        {t(
                          `帳單總額（${splitN} 人平均攤分）`,
                          `账单总额（${splitN} 人平均分摊）`,
                          `Bill total (split ${splitN} ways)`
                        )}
                      </span>
                      <span>
                        {formatMoney(detailExpense.amount, detailExpense.currency)}
                        {detailExpense.currency !== globalCurrency
                          ? ` (≈ ${formatMoney(totalBase, globalCurrency)})`
                          : ''}
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="rounded-2xl bg-zinc-100/70 dark:bg-white/[0.04] px-3.5 py-2.5">
                    <span className="text-zinc-400 block">{t('分類', '分类', 'Category')}</span>
                    <span className="font-semibold text-zinc-900 dark:text-white mt-0.5 block">{cat.label}</span>
                  </div>
                  <div className="rounded-2xl bg-zinc-100/70 dark:bg-white/[0.04] px-3.5 py-2.5">
                    <span className="text-zinc-400 block">{t('付款方式', '付款方式', 'Payment')}</span>
                    <span className="font-semibold text-zinc-900 dark:text-white mt-0.5 block">{payLabel}</span>
                  </div>
                  {!detailExpense.isPreTrip && detailExpense.date && (
                    <div className="col-span-2 rounded-2xl bg-zinc-100/70 dark:bg-white/[0.04] px-3.5 py-2.5 flex items-center justify-between">
                      <span className="text-zinc-400">{t('消費日期', '消费日期', 'Date')}</span>
                      <span className="font-num font-semibold text-zinc-900 dark:text-white">
                        {detailExpense.date}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const target = detailExpense;
                      setDetailExpense(null);
                      setDeleteTarget(target);
                    }}
                    className="min-h-[46px] px-4 rounded-full bg-red-500/10 hover:bg-red-500/15 text-red-600 dark:text-red-400 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <TrashIcon className="w-4 h-4" />
                    <span>{t('刪除', '删除', 'Delete')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEditExpense(detailExpense)}
                    className="flex-1 min-h-[46px] rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <EditIcon className="w-4 h-4" />
                    <span>{t('編輯紀錄', '编辑记录', 'Edit Expense')}</span>
                  </button>
                </div>
              </div>
            );
          })()}
      </LiquidModal>

      {/* Add / Edit Expense Modal */}
      <LiquidModal
        open={activeModal === 'ADD_PRE' || activeModal === 'ADD_ON'}
        onClose={() => setActiveModal('NONE')}
        bottomSheetOnMobile
        maxWidthClass="max-w-md"
        title={
          editingId
            ? t('編輯消費紀錄', '编辑消费记录', 'Edit Expense')
            : t('記一筆開支', '记一笔开支', 'Add Expense')
        }
      >
        <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 pb-4">
          {/* Free Scope Toggle: 旅途消費 vs 行前開支 */}
          <div>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1.5 block">
              {t('歸屬類型', '归属类型', 'Expense Scope')}
            </label>
            <SlidingSegmentedControl
              fullWidth
              value={activeModal === 'ADD_PRE' ? 'ADD_PRE' : 'ADD_ON'}
              onChange={(target) => {
                if (target === 'ADD_ON') {
                  setActiveModal('ADD_ON');
                  setNewExpense((prev) => ({
                    ...prev,
                    currency: !editingId && !prev.amount ? destinationIntel.currency : prev.currency,
                    date: prev.date || new Date().toISOString().split('T')[0],
                    category: onTripCategories.some((c) => c.id === prev.category) ? prev.category : '',
                  }));
                } else {
                  setActiveModal('ADD_PRE');
                  setNewExpense((prev) => ({
                    ...prev,
                    currency: !editingId && !prev.amount ? globalCurrency : prev.currency,
                    paymentMethod: !editingId && !prev.amount ? 'card' : prev.paymentMethod,
                    date: '',
                    category: preTripCategories.some((c) => c.id === prev.category) ? prev.category : '',
                  }));
                }
              }}
              options={[
                { id: 'ADD_ON', label: t('旅途消費', '旅途消费', 'On-Trip'), accentFrom: '#F26B3A', accentTo: '#FB923C' },
                { id: 'ADD_PRE', label: t('行前開支', '行前开支', 'Pre-Trip'), accentFrom: '#4F5DF5', accentTo: '#6366F1' },
              ]}
            />
          </div>

          <div className="flex gap-2.5">
            <div className="flex-1 bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200/70 dark:border-white/10 rounded-2xl p-3.5">
              <span className="text-[11px] font-medium text-zinc-500 block mb-1">
                {newExpense.splitCount > 1
                  ? t('帳單總金額', '账单总金额', 'Total Bill Amount')
                  : t('金額', '金额', 'Amount')}
              </span>
              <input
                type="number"
                placeholder="0"
                value={newExpense.amount}
                onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                className="w-full bg-transparent text-zinc-900 dark:text-white font-display font-bold font-num text-2xl focus:outline-none"
              />
            </div>
            <div className="w-32 bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200/70 dark:border-white/10 rounded-2xl relative flex items-center justify-center">
              <select
                value={newExpense.currency}
                onChange={(e) => setNewExpense({ ...newExpense, currency: e.target.value })}
                className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
              >
                {allCurrencies.map((c) => (
                  <option key={c.code} value={c.code} className="text-zinc-900">
                    {c.code} {c.name}
                  </option>
                ))}
              </select>
              <div className="text-center pointer-events-none">
                <div className="flex items-center justify-center gap-1">
                  <span className="font-num font-bold text-sm text-zinc-900 dark:text-white">{newExpense.currency}</span>
                  <ChevronDownIcon className="w-4 h-4 text-zinc-400" />
                </div>
                <span className="text-[11px] text-zinc-500">{getCurrencyLabel(newExpense.currency)}</span>
              </div>
            </div>
          </div>

          <div className={`grid grid-cols-1 ${activeModal === 'ADD_ON' ? 'sm:grid-cols-2' : ''} gap-3`}>
            <div>
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1 block">
                {t('項目名稱', '项目名称', 'Title')}
              </label>
              <input
                type="text"
                placeholder={
                  activeModal === 'ADD_PRE'
                    ? t('來回機票、住宿訂金', '往返机票、住宿定金', 'Roundtrip flight, hotel deposit')
                    : t('拉麵、交通卡', '拉面、交通卡', 'Ramen, transit card')
                }
                value={newExpense.title}
                onChange={(e) => setNewExpense({ ...newExpense, title: e.target.value })}
                className="w-full h-11 px-4 rounded-2xl bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200/70 dark:border-white/10 text-zinc-900 dark:text-white font-medium text-sm focus:outline-none"
              />
            </div>
            {activeModal === 'ADD_ON' && (
              <div>
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1 block">
                  {t('日期', '日期', 'Date')}
                </label>
                <div className="h-11 px-3.5 rounded-2xl bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200/70 dark:border-white/10 flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-zinc-400 shrink-0" />
                  <input
                    type="date"
                    value={newExpense.date}
                    onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                    className="bg-transparent w-full text-zinc-900 dark:text-white font-num font-medium text-sm focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Multi-Person Split Option */}
          <div className="rounded-2xl bg-zinc-100/80 dark:bg-white/[0.04] border border-zinc-200/70 dark:border-white/[0.08] p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                <UsersIcon className="w-4 h-4 text-[var(--tab-accent)]" />
                <span>{t('是否有多人攤分此筆開支？', '是否有多人分摊此笔开支？', 'Split this expense?')}</span>
              </div>
              <StretchToggle
                size="sm"
                soundType="liquid"
                checked={newExpense.splitCount > 1}
                onChange={(isSplit) =>
                  setNewExpense((prev) => ({
                    ...prev,
                    splitCount: isSplit ? (prev.splitCount > 1 ? prev.splitCount : 2) : 1,
                  }))
                }
                ariaLabel={t('是否有多人攤分此筆開支？', '是否有多人分摊此笔开支？', 'Split this expense?')}
              />
            </div>

            {newExpense.splitCount > 1 && (
              <div className="pt-2 border-t border-zinc-200/60 dark:border-white/[0.08] space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {t('攤分人數', '分摊人数', 'People')}
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[2, 3, 4, 5].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => {
                          tactileAudio.playTick(0.84 + (cnt / 10) * 0.4);
                          setNewExpense((prev) => ({ ...prev, splitCount: cnt }));
                        }}
                        className={`w-8 h-8 rounded-full text-xs font-num font-bold transition-all active:scale-90 cursor-pointer ${
                          newExpense.splitCount === cnt
                            ? 'bg-[var(--tab-accent)] text-white shadow-xs'
                            : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200/70 dark:border-white/10'
                        }`}
                      >
                        {cnt}
                      </button>
                    ))}
                    <StepperPill
                      size="sm"
                      min={2}
                      max={30}
                      value={newExpense.splitCount}
                      onChange={(next) => setNewExpense((prev) => ({ ...prev, splitCount: next }))}
                      formatValue={(v) => t(`${v}人`, `${v}人`, `${v}`)}
                      ariaLabel={t('攤分人數', '分摊人数', 'Split count')}
                    />
                  </div>
                </div>
                {parseFloat(newExpense.amount) > 0 && (
                  <div className="flex items-center justify-between text-xs font-num text-indigo-600 dark:text-indigo-400 font-semibold">
                    <span>{t('每人平均應付', '每人平均应付', 'Per person share')}</span>
                    <span>
                      {formatMoney(parseFloat(newExpense.amount) / newExpense.splitCount, newExpense.currency)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1.5 block">
              {t('付款方式', '付款方式', 'Payment Method')}
            </label>
            <SlidingSegmentedControl
              fullWidth
              value={newExpense.paymentMethod}
              onChange={(pm) => setNewExpense({ ...newExpense, paymentMethod: pm })}
              options={[
                { id: 'cash', label: t('現金', '现金', 'Cash'), icon: <BanknotesIcon className="w-4 h-4" />, accentFrom: '#0E9F76', accentTo: '#10B981' },
                { id: 'card', label: t('信用卡', '信用卡', 'Card'), icon: <CreditCardIcon className="w-4 h-4" />, accentFrom: '#4F5DF5', accentTo: '#6366F1' },
                { id: 'other', label: t('其他', '其他', 'Other'), icon: <TagIcon className="w-4 h-4" />, accentFrom: '#8B5CF6', accentTo: '#A78BFA' },
              ]}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1.5 block">
              {t('分類', '分类', 'Category')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(activeModal === 'ADD_PRE' ? preTripCategories : onTripCategories).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setNewExpense({ ...newExpense, category: cat.id })}
                  className={`flex items-center gap-2.5 p-3 rounded-2xl border transition-all cursor-pointer ${
                    newExpense.category === cat.id
                      ? 'bg-indigo-600/10 border-indigo-600 text-zinc-900 dark:text-white'
                      : 'bg-zinc-100/70 dark:bg-white/[0.04] border-transparent text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="text-xs font-semibold">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            tactileAudio.playStamp();
            handleSaveExpense(activeModal === 'ADD_PRE');
          }}
          disabled={!newExpense.amount || !newExpense.title.trim() || !newExpense.category}
          className="w-full min-h-[48px] rounded-full font-semibold text-sm bg-[var(--tab-accent)] hover:bg-[var(--tab-accent-hover)] text-white disabled:opacity-35 cursor-pointer shrink-0 transition-transform active:scale-[0.98]"
        >
          {editingId ? t('儲存變更', '保存更改', 'Save Changes') : t('新增紀錄', '添加记录', 'Add Expense')}
        </button>
      </LiquidModal>

      {/* Stats Modal */}
      <LiquidModal
        open={activeModal === 'STATS'}
        onClose={() => setActiveModal('NONE')}
        maxWidthClass="max-w-md"
        title={
          <div className="flex items-center gap-2">
            <ChartPieIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>
              {t(`消費分析 (${globalCurrency})`, `消费分析 (${globalCurrency})`, `Spending Analytics (${globalCurrency})`)}
            </span>
          </div>
        }
      >
        <div className="flex-1 overflow-y-auto no-scrollbar space-y-5 pb-2">
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-zinc-100 dark:bg-white/[0.05] rounded-2xl p-3 text-center">
              <p className="text-[11px] font-medium text-zinc-500 mb-1">{t('現金', '现金', 'Cash')}</p>
              <p className="font-num font-bold text-sm text-zinc-900 dark:text-white truncate">
                {Math.round(onTripStats.methods.cash).toLocaleString(localeTag)}
              </p>
            </div>
            <div className="bg-zinc-100 dark:bg-white/[0.05] rounded-2xl p-3 text-center">
              <p className="text-[11px] font-medium text-zinc-500 mb-1">{t('信用卡', '信用卡', 'Card')}</p>
              <p className="font-num font-bold text-sm text-zinc-900 dark:text-white truncate">
                {Math.round(onTripStats.methods.card).toLocaleString(localeTag)}
              </p>
            </div>
            <div className="bg-zinc-100 dark:bg-white/[0.05] rounded-2xl p-3 text-center">
              <p className="text-[11px] font-medium text-zinc-500 mb-1">{t('其他', '其他', 'Other')}</p>
              <p className="font-num font-bold text-sm text-zinc-900 dark:text-white truncate">
                {Math.round(onTripStats.methods.other).toLocaleString(localeTag)}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              {t('類別佔比', '类别占比', 'By Category')}
            </h4>
            {onTripStats.categories.length === 0 ? (
              <p className="text-xs text-zinc-400 py-6 text-center">
                {t('尚無消費數據', '暂无消费数据', 'No expense data yet')}
              </p>
            ) : (
              onTripStats.categories.map((cat) => {
                const percent = onTripStats.total > 0 ? (cat.amount / onTripStats.total) * 100 : 0;
                return (
                  <div key={cat.id} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-zinc-800 dark:text-zinc-200">{cat.label}</span>
                      <span className="font-num text-zinc-900 dark:text-white">
                        {formatMoney(cat.amount, globalCurrency)} ({Math.round(percent)}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-200 dark:bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${percent}%`, backgroundColor: cat.color }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="space-y-2.5">
            <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              {t('每日明細', '每日明细', 'Daily Breakdown')}
            </h4>
            {onTripStats.days.length === 0 ? (
              <p className="text-xs text-zinc-400 py-4 text-center">
                {t('尚無每日數據', '暂无每日数据', 'No daily breakdown yet')}
              </p>
            ) : (
              onTripStats.days.map((day) => {
                const percent = onTripStats.maxDailyTotal > 0 ? (day.total / onTripStats.maxDailyTotal) * 100 : 0;
                return (
                  <div key={day.date} className="flex items-center gap-3">
                    <span className="w-14 text-xs font-num text-zinc-500 shrink-0">{day.date.slice(5)}</span>
                    <div className="flex-1 h-8 bg-zinc-100 dark:bg-white/[0.04] rounded-xl relative overflow-hidden flex items-center px-3">
                      <div
                        className="absolute inset-y-0 left-0 bg-indigo-600/15 rounded-xl"
                        style={{ width: `${percent}%` }}
                      />
                      <span className="relative z-10 text-xs font-num font-semibold text-zinc-800 dark:text-white">
                        {formatMoney(day.total, globalCurrency)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </LiquidModal>

      <ConfirmSheet
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          commitExpenses(
            expenses.filter((e) => e.id !== deleteTarget.id),
            deleteTarget.id
          );
          onShowToast(t('已刪除消費紀錄', '已删除消费记录', 'Expense deleted'));
          setDeleteTarget(null);
        }}
        title={t('刪除此筆消費？', '删除此笔消费？', 'Delete Expense?')}
        description={t(
          `「${deleteTarget?.title || ''}」將從紀錄移除。`,
          `「${deleteTarget?.title || ''}」将从记录移除。`,
          `"${deleteTarget?.title || ''}" will be removed from expenses.`
        )}
        confirmLabel={t('確認刪除', '确认删除', 'Delete')}
        cancelLabel={t('取消', '取消', 'Cancel')}
        icon={<TrashIcon className="w-6 h-6" />}
        requireHold
      />
    </div>
  );
};

export default ExpensesTool;
