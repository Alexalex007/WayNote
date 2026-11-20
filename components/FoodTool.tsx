import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trip, Expense, Budget } from '../types';
import { generateUniqueId } from '../shared/syncMerge';
import { detectDestinationIntel } from '../shared/destinationIntel';
import { LiquidModal, ConfirmSheet, SlidingSegmentedControl } from './LiquidPrimitives';
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
  MapIcon,
  ChartPieIcon,
  CalendarIcon,
  TrashIcon,
  CheckIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  UsersIcon,
  EditIcon,
} from './Icons';

interface Props {
  trip: Trip;
  onUpdateTrip: (trip: Trip) => void;
  onShowToast: (text: string, tone?: 'info' | 'success' | 'error') => void;
}

const PRE_TRIP_CATEGORIES = [
  { id: 'flight', label: '機票', icon: PlaneIcon, color: '#4F46E5', tintBg: 'rgba(79, 70, 229, 0.11)' },
  { id: 'stay', label: '住宿', icon: HomeIcon, color: '#E11D48', tintBg: 'rgba(225, 29, 72, 0.11)' },
  { id: 'ticket', label: '門票', icon: TicketIcon, color: '#059669', tintBg: 'rgba(5, 150, 105, 0.11)' },
  { id: 'transport_pass', label: '交通票券', icon: BusIcon, color: '#D97706', tintBg: 'rgba(217, 119, 6, 0.12)' },
  { id: 'insurance', label: '保險', icon: ShieldCheckIcon, color: '#0284C7', tintBg: 'rgba(2, 132, 199, 0.11)' },
  { id: 'other', label: '其他', icon: TagIcon, color: '#64748B', tintBg: 'rgba(100, 116, 139, 0.12)' },
];

const ON_TRIP_CATEGORIES = [
  { id: 'stay', label: '住宿', icon: HomeIcon, color: '#E11D48', tintBg: 'rgba(225, 29, 72, 0.11)' },
  { id: 'food', label: '餐飲', icon: DiningIcon, color: '#EA580C', tintBg: 'rgba(234, 88, 12, 0.11)' },
  { id: 'activity', label: '體驗與行程', icon: TicketIcon, color: '#4F46E5', tintBg: 'rgba(79, 70, 229, 0.11)' },
  { id: 'transport', label: '交通', icon: BusIcon, color: '#0284C7', tintBg: 'rgba(2, 132, 199, 0.11)' },
  { id: 'shopping', label: '購物', icon: ShoppingBagIcon, color: '#DB2777', tintBg: 'rgba(219, 39, 119, 0.11)' },
  { id: 'other', label: '其他', icon: TagIcon, color: '#64748B', tintBg: 'rgba(100, 116, 139, 0.12)' },
];

const ALL_CATEGORIES = [...ON_TRIP_CATEGORIES, ...PRE_TRIP_CATEGORIES];

const ALL_CURRENCIES = [
  { code: 'HKD', name: '港幣' },
  { code: 'TWD', name: '新台幣' },
  { code: 'JPY', name: '日圓' },
  { code: 'USD', name: '美元' },
  { code: 'EUR', name: '歐元' },
  { code: 'KRW', name: '韓元' },
  { code: 'CNY', name: '人民幣' },
  { code: 'GBP', name: '英鎊' },
  { code: 'AUD', name: '澳幣' },
  { code: 'CAD', name: '加幣' },
  { code: 'SGD', name: '新加坡幣' },
  { code: 'CHF', name: '瑞士法郎' },
  { code: 'THB', name: '泰銖' },
  { code: 'MYR', name: '馬來西亞林吉特' },
  { code: 'VND', name: '越南盾' },
  { code: 'PHP', name: '菲律賓披索' },
  { code: 'IDR', name: '印尼盾' },
  { code: 'NZD', name: '紐西蘭元' },
  { code: 'MOP', name: '澳門幣' },
  { code: 'TRY', name: '土耳其里拉' },
  { code: 'AED', name: '阿聯酋迪拉姆' },
];

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
  };
  return symbols[code] || `${code} `;
}

function formatMoney(amount: number, code: string): string {
  const zeroDecimals = ['JPY', 'KRW', 'VND', 'IDR', 'TWD', 'HKD', 'THB'];
  const rounded = zeroDecimals.includes(code) ? Math.round(amount) : Math.round(amount * 100) / 100;
  return `${getCurrencySymbol(code)}${rounded.toLocaleString(undefined, {
    maximumFractionDigits: zeroDecimals.includes(code) ? 0 : 2,
  })}`;
}

const ExpensesTool: React.FC<Props> = ({ trip, onUpdateTrip, onShowToast }) => {
  const destinationIntel = useMemo(() => detectDestinationIntel(trip.destination), [trip.destination]);
  const multiCityCurrencies = useMemo(() => {
    if (trip.type !== 'Multi' || !trip.stops?.length) return [];
    const seen = new Set<string>();
    const list: { city: string; currency: string }[] = [];
    trip.stops.forEach((s) => {
      if (!s.destination.trim()) return;
      const d = detectDestinationIntel(s.destination);
      if (!seen.has(d.currency)) {
        seen.add(d.currency);
        list.push({ city: s.destination.trim(), currency: d.currency });
      }
    });
    return list;
  }, [trip.type, trip.stops]);

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

  const [calcFrom, setCalcFrom] = useState(() => destinationIntel.currency || 'JPY');
  const [calcTo, setCalcTo] = useState('HKD');
  const [calcAmount, setCalcAmount] = useState<string>('');

  useEffect(() => {
    setCalcFrom(destinationIntel.currency);
  }, [trip.id, destinationIntel.currency]);

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

  useEffect(() => {
    fetch('https://api.exchangerate-api.com/v4/latest/HKD')
      .then((res) => res.json())
      .then((data) => {
        if (data?.rates) {
          setExchangeRates(data.rates);
          localStorage.setItem('sky_travel_rates_hkd', JSON.stringify(data.rates));
        }
      })
      .catch(() => {});
  }, []);

  const convert = (amount: number, from: string, to: string) => {
    if (from === to) return amount;
    if (!exchangeRates[from] || !exchangeRates[to]) return amount;
    const inBase = amount / exchangeRates[from];
    return inBase * exchangeRates[to];
  };

  const getCurrencyLabel = (code: string) => ALL_CURRENCIES.find((c) => c.code === code)?.name || '';

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
        const catInfo = ALL_CATEGORIES.find((c) => c.id === id) || {
          label: '其他',
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

  const calcResult = useMemo(() => {
    const amt = parseFloat(calcAmount) || 0;
    return convert(amt, calcFrom, calcTo);
  }, [calcAmount, calcFrom, calcTo, exchangeRates]);

  const activeTaxIntel = useMemo(() => {
    const fromMatches = calcFrom === destinationIntel.currency;
    const toMatches = calcTo === destinationIntel.currency;
    if (!destinationIntel.taxFreeThreshold || (!fromMatches && !toMatches)) return null;
    const amt = parseFloat(calcAmount) || 0;
    if (!amt) return null;
    const localVal = fromMatches ? amt : calcResult;
    return {
      threshold: destinationIntel.taxFreeThreshold,
      currency: destinationIntel.currency,
      symbol: destinationIntel.currencySymbol,
      countryLabel: destinationIntel.countryLabel,
      value: localVal,
    };
  }, [calcFrom, calcTo, calcAmount, calcResult, destinationIntel]);

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
    onShowToast('已更新預算設定', 'success');
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
      onShowToast('已更新消費紀錄', 'success');
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
      onShowToast('已新增消費紀錄', 'success');
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
  }: {
    percentage: number;
    color: string;
    size?: number;
    stroke?: number;
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
        <div className="absolute flex flex-col items-center">
          <span
            className={`text-base font-display font-bold font-num ${
              isOverBudget ? 'text-red-500' : 'text-zinc-900 dark:text-white'
            }`}
          >
            {Math.round(percentage)}%
          </span>
          {size >= 80 && <span className="text-[10px] font-medium text-zinc-400">已使用</span>}
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
              人均
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
    const title = isPre ? '行前開支' : '旅途消費';
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
              總計 {formatMoney(totalAmount, globalCurrency)}
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
            <span>記一筆</span>
          </button>
        </div>

        <div className="surface-elevated rounded-2xl px-3.5 h-11 flex items-center gap-2.5 mb-4 shrink-0">
          <MagnifyingGlassIcon className="w-4 h-4 text-zinc-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜尋項目..."
            className="bg-transparent w-full text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none"
          />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-2.5 pb-6 lg:pb-10">
          {listExpenses.length === 0 ? (
            <div className="surface-elevated rounded-3xl py-14 flex flex-col items-center justify-center text-center">
              <TagIcon className="w-8 h-8 text-zinc-400 mb-3" />
              <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">尚無{title}紀錄</p>
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
                    { id: 'ALL', label: '全部', accentFrom: '#4F5DF5', accentTo: '#60A5FA' },
                    { id: 'ON_TRIP', label: '旅途', accentFrom: '#F26B3A', accentTo: '#FB923C' },
                    { id: 'PRE_TRIP', label: '行前', accentFrom: '#4F46E5', accentTo: '#818CF8' },
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
                  <span className="hidden sm:inline">報表分析</span>
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
                  <span>記一筆</span>
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
                        TOTAL SPENT &amp; BUDGET ·{' '}
                        {scopeFilter === 'ALL' ? '總開支與預算' : scopeFilter === 'ON_TRIP' ? '旅途消費' : '行前開支'}
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
                        <span>日均 {formatMoney(dailyChart.avgDaily, globalCurrency)}</span>
                        <span aria-hidden="true">·</span>
                        <span>共 {scopedExpenses.length} 筆明細</span>
                        {hasAnySplit && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>已按攤分計算個人實付</span>
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
                        {budget.amount > 0 ? '調整預算' : '設定預算'}
                      </button>
                      <div className="relative">
                        <select
                          value={globalCurrency}
                          onChange={(e) => setGlobalCurrency(e.target.value)}
                          className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
                        >
                          {ALL_CURRENCIES.map((c) => (
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
                            旅途預算（{budget.type === 'total' ? '含現金與刷卡' : '僅計算現金'}）
                          </span>
                        </div>
                        <div
                          className={`text-xs font-num font-bold ${
                            isOverBudget ? 'text-red-600 dark:text-red-400' : 'text-[var(--tab-accent)]'
                          }`}
                        >
                          {isOverBudget ? '已超支 ' : '剩餘 '}
                          {budget.currency} {Math.round(Math.abs(remainingBudget)).toLocaleString()}
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
                          已使用 {budget.currency} {Math.round(usedBudgetAmount).toLocaleString()}
                        </span>
                        <span>
                          預算上限 {budget.currency} {budget.amount.toLocaleString()}
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
                        尚未設定旅途預算上限
                      </span>
                      <span className="text-xs font-semibold text-[var(--tab-accent)]">設定預算 →</span>
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
                          行前開支
                        </span>
                      </div>
                      <div className="mt-1.5 text-lg sm:text-xl font-display font-bold font-num text-[var(--tab-accent)] break-words">
                        {formatMoney(preTripTotalBase, globalCurrency)}
                      </div>
                      <div className="mt-0.5 text-[11px] font-num text-zinc-500 dark:text-zinc-400 whitespace-normal">
                        機票、訂房、票券、保險 · {preTripExpenses.length} 筆
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
                          旅途消費
                        </span>
                      </div>
                      <div className="mt-1.5 text-lg sm:text-xl font-display font-bold font-num text-[#F26B3A] break-words">
                        {formatMoney(onTripTotalBase, globalCurrency)}
                      </div>
                      <div className="mt-0.5 text-[11px] font-num text-zinc-500 dark:text-zinc-400 whitespace-normal">
                        餐飲、交通、體驗、購物 · {onTripExpenses.length} 筆
                      </div>
                    </button>
                  </div>
                </div>

                {/* Daily Spend Vertical Bar Chart */}
                {dailyChart.bars.length > 0 && (
                  <div className="lg:col-span-5 lg:rounded-2xl lg:bg-zinc-100/60 lg:dark:bg-white/[0.03] lg:p-4 lg:border lg:border-zinc-200/60 lg:dark:border-white/[0.07]">
                    <div className="hidden lg:flex items-center justify-between text-xs mb-2">
                      <span className="font-semibold text-zinc-500 dark:text-zinc-400">每日消費趨勢</span>
                      <span className="font-num text-zinc-400 dark:text-zinc-500">點擊長條篩選單日</span>
                    </div>
                    <div className="relative h-28 lg:h-36 flex items-end gap-2 sm:gap-3 overflow-x-auto no-scrollbar pr-8 pb-6">
                      {dailyChart.maxTotal > 0 && (
                        <div
                          className="absolute left-0 right-0 border-t border-dashed border-zinc-300 dark:border-white/20 pointer-events-none flex justify-end"
                          style={{ bottom: `${24 + dailyChart.avgRatio * 82}px` }}
                        >
                          <span className="text-[10px] font-num font-medium text-zinc-400 dark:text-zinc-500 -mt-3.5 bg-white/90 dark:bg-[#151924] px-1">
                            avg
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
                  正在篩選 {selectedDayFilter} 當日消費
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedDayFilter(null)}
                  className="font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 cursor-pointer"
                >
                  <XMarkIcon className="w-3.5 h-3.5" />
                  <span>清除篩選</span>
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
                          行前開支表
                        </h3>
                        <p className="text-[11px] font-num text-zinc-500 dark:text-zinc-400">
                          共 {displayedPreTripExpenses.length} 項 · 點擊項目查看明細
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-num font-bold text-[var(--tab-accent)] shrink-0">
                      {formatMoney(preTripTotalBase, globalCurrency)}
                    </span>
                  </div>

                  {displayedPreTripExpenses.length === 0 ? (
                    <div className="py-7 px-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
                      尚未紀錄任何行前開支
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
                                  人均
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
                      <span>查看全部 {displayedPreTripExpenses.length} 項行前開支</span>
                      <ChevronRightIcon className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <div className="px-5 sm:px-6 py-3.5 bg-zinc-100/75 dark:bg-white/[0.03] border-t border-zinc-200/70 dark:border-white/[0.06] flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">行前開支小計</span>
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
                          旅途消費表
                        </h3>
                        <p className="text-[11px] font-num text-zinc-500 dark:text-zinc-400">
                          共 {displayedOnTripExpenses.length} 項 · 點擊項目查看明細
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-num font-bold text-[#F26B3A] shrink-0">
                      {formatMoney(onTripTotalBase, globalCurrency)}
                    </span>
                  </div>

                  {displayedOnTripExpenses.length === 0 ? (
                    <div className="py-7 px-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
                      尚未紀錄任何旅途消費
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
                                  人均
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
                      <span>查看全部 {displayedOnTripExpenses.length} 項旅途消費</span>
                      <ChevronRightIcon className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <div className="px-5 sm:px-6 py-3.5 bg-zinc-100/75 dark:bg-white/[0.03] border-t border-zinc-200/70 dark:border-white/[0.06] flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">旅途消費小計</span>
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
                      TOTAL SUMMARY · 統一總算
                    </div>
                    <h3 className="text-lg font-display font-bold text-white mt-0.5">
                      行前 + 旅途總花費
                    </h3>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl sm:text-3xl font-display font-bold font-num text-white">
                      {formatMoney(grandTotalBase, globalCurrency)}
                    </div>
                    {globalCurrency !== destinationIntel.currency && (
                      <div className="text-xs font-num text-zinc-400">
                        約 {formatMoney(grandTotalLocal, destinationIntel.currency)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-white/10 text-xs">
                  <div className="rounded-2xl bg-white/[0.06] px-3.5 py-2.5">
                    <div className="text-zinc-400">行前開支小計</div>
                    <div className="font-num font-bold text-sm text-indigo-300 mt-0.5">
                      {formatMoney(preTripTotalBase, globalCurrency)}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white/[0.06] px-3.5 py-2.5">
                    <div className="text-zinc-400">旅途消費小計</div>
                    <div className="font-num font-bold text-sm text-[#FF9E7B] mt-0.5">
                      {formatMoney(onTripTotalBase, globalCurrency)}
                    </div>
                  </div>
                  <div className="col-span-2 sm:col-span-1 rounded-2xl bg-white/[0.06] px-3.5 py-2.5 flex sm:block items-center justify-between">
                    <div className="text-zinc-400">
                      共 {expenses.length} 筆明細
                    </div>
                    <div className="font-num font-bold text-sm text-emerald-300 mt-0.5">
                      {formatMoney(grandTotalBase, globalCurrency)}
                    </div>
                  </div>
                </div>
              </section>

              {/* Currency Converter & Dynamic Tax-Free */}
              <div className="lg:col-span-6 surface-elevated rounded-3xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-zinc-900 dark:text-white">
                    <ArrowsRightLeftIcon className="w-4 h-4 text-[var(--tab-accent)]" />
                    <h3 className="font-display font-bold text-base">匯率換算</h3>
                  </div>
                  <span className="text-[11px] font-num text-zinc-500 dark:text-zinc-400">
                    1 {calcFrom} ={' '}
                    {(exchangeRates[calcTo] && exchangeRates[calcFrom]
                      ? exchangeRates[calcTo] / exchangeRates[calcFrom]
                      : 1
                    ).toFixed(4)}{' '}
                    {calcTo}
                  </span>
                </div>

                {multiCityCurrencies.length > 1 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                    {multiCityCurrencies.map((item) => (
                      <button
                        key={item.currency}
                        type="button"
                        onClick={() => setCalcFrom(item.currency)}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          calcFrom === item.currency
                            ? 'bg-indigo-600 text-white'
                            : 'bg-zinc-100 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-300'
                        }`}
                      >
                        {item.city} · {item.currency}
                      </button>
                    ))}
                  </div>
                )}

                <div className="space-y-1">
                  <div className="bg-zinc-100/80 dark:bg-white/[0.04] rounded-2xl p-4 flex justify-between items-center border border-zinc-200/60 dark:border-white/[0.06]">
                    <div className="min-w-0 flex-1 pr-2">
                      <span className="text-[11px] font-medium text-zinc-500 block mb-1">
                        {getCurrencyLabel(calcFrom)}
                      </span>
                      <input
                        type="number"
                        value={calcAmount}
                        onChange={(e) => setCalcAmount(e.target.value)}
                        placeholder="1000"
                        className="bg-transparent text-zinc-900 dark:text-white font-display font-bold font-num text-2xl w-full focus:outline-none placeholder-zinc-300 dark:placeholder-zinc-700"
                      />
                    </div>
                    <div className="relative shrink-0">
                      <select
                        value={calcFrom}
                        onChange={(e) => setCalcFrom(e.target.value)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      >
                        {ALL_CURRENCIES.map((c) => (
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

                  <div className="flex justify-center -my-3 relative z-10">
                    <button
                      type="button"
                      onClick={() => {
                        setCalcFrom(calcTo);
                        setCalcTo(calcFrom);
                      }}
                      aria-label="交換幣別"
                      className="w-9 h-9 rounded-full bg-indigo-600 text-white shadow-md flex items-center justify-center hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                    >
                      <ArrowsRightLeftIcon className="w-4 h-4 rotate-90" />
                    </button>
                  </div>

                  <div className="bg-zinc-100/80 dark:bg-white/[0.04] rounded-2xl p-4 flex justify-between items-center border border-zinc-200/60 dark:border-white/[0.06]">
                    <div className="min-w-0 flex-1 pr-2">
                      <span className="text-[11px] font-medium text-zinc-500 block mb-1">
                        {getCurrencyLabel(calcTo)}
                      </span>
                      <div className="text-zinc-900 dark:text-white font-display font-bold font-num text-2xl truncate">
                        {calcAmount ? calcResult.toFixed(2) : <span className="text-zinc-300 dark:text-zinc-700">0.00</span>}
                      </div>
                    </div>
                    <div className="relative shrink-0">
                      <select
                        value={calcTo}
                        onChange={(e) => setCalcTo(e.target.value)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      >
                        {ALL_CURRENCIES.map((c) => (
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

                {activeTaxIntel && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-2xl p-4 border flex items-center justify-between gap-3 ${
                      activeTaxIntel.value >= activeTaxIntel.threshold
                        ? 'bg-indigo-600/10 border-indigo-600/30'
                        : 'bg-zinc-100/80 dark:bg-white/[0.04] border-zinc-200/70 dark:border-white/[0.06]'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300 block mb-0.5">
                        {activeTaxIntel.countryLabel}退稅門檻 ({activeTaxIntel.symbol}
                        {activeTaxIntel.threshold.toLocaleString()})
                      </span>
                      {activeTaxIntel.value >= activeTaxIntel.threshold ? (
                        <span className="font-semibold text-sm text-indigo-700 dark:text-indigo-400">
                          已達門檻 · 結帳出示護照
                        </span>
                      ) : (
                        <span className="font-num font-bold text-sm text-zinc-900 dark:text-white">
                          還差 {activeTaxIntel.symbol}
                          {Math.ceil(activeTaxIntel.threshold - activeTaxIntel.value).toLocaleString()}
                        </span>
                      )}
                    </div>
                    {activeTaxIntel.value >= activeTaxIntel.threshold ? (
                      <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                        <CheckIcon className="w-5 h-5" />
                      </div>
                    ) : (
                      <CircularProgress
                        percentage={(activeTaxIntel.value / activeTaxIntel.threshold) * 100}
                        color="#4F46E5"
                        size={46}
                        stroke={4}
                      />
                    )}
                  </motion.div>
                )}
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
        title="設定旅途預算"
      >
        <div className="space-y-4">
          <div className="flex gap-2.5">
            <div className="flex-1 bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200/70 dark:border-white/10 rounded-2xl p-3.5">
              <span className="text-[11px] font-medium text-zinc-500 block mb-1">金額</span>
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
                {ALL_CURRENCIES.map((c) => (
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
              { id: 'total', label: '總預算 (現金+卡)', accentFrom: '#4F5DF5', accentTo: '#6366F1' },
              { id: 'cash_only', label: '僅限現金', accentFrom: '#0E9F76', accentTo: '#10B981' },
            ]}
          />

          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => setActiveModal('NONE')}
              className="flex-1 min-h-[46px] rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-semibold text-sm cursor-pointer"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSaveBudget}
              className="flex-1 min-h-[46px] rounded-full bg-[var(--tab-accent)] hover:bg-[var(--tab-accent-hover)] text-white font-semibold text-sm cursor-pointer"
            >
              儲存
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
        title={detailExpense?.isPreTrip ? '行前開支明細' : '旅途消費明細'}
      >
        {detailExpense &&
          (() => {
            const cat =
              ALL_CATEGORIES.find((c) => c.id === detailExpense.category) ||
              ALL_CATEGORIES[ALL_CATEGORIES.length - 1];
            const splitN = detailExpense.splitCount && detailExpense.splitCount > 1 ? detailExpense.splitCount : 1;
            const personalAmt = detailExpense.amount / splitN;
            const personalBase = convert(personalAmt, detailExpense.currency, globalCurrency);
            const totalBase = convert(detailExpense.amount, detailExpense.currency, globalCurrency);
            const payLabel =
              detailExpense.paymentMethod === 'cash'
                ? '現金'
                : detailExpense.paymentMethod === 'card'
                  ? '信用卡'
                  : '其他';

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
                        {detailExpense.isPreTrip ? '行前開支' : '旅途消費'} · {cat.label}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-zinc-100/80 dark:bg-white/[0.04] p-4 space-y-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      {splitN > 1 ? `個人攤分金額（共 ${splitN} 人）` : '消費金額'}
                    </span>
                    <span className="text-2xl font-display font-bold font-num text-zinc-900 dark:text-white">
                      {formatMoney(personalAmt, detailExpense.currency)}
                    </span>
                  </div>
                  {detailExpense.currency !== globalCurrency && (
                    <div className="flex items-center justify-between text-xs font-num text-zinc-500 dark:text-zinc-400">
                      <span>折合基準幣別</span>
                      <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                        ≈ {formatMoney(personalBase, globalCurrency)}
                      </span>
                    </div>
                  )}
                  {splitN > 1 && (
                    <div className="pt-2 border-t border-zinc-200/70 dark:border-white/[0.08] flex items-center justify-between text-xs font-num text-indigo-600 dark:text-indigo-400 font-semibold">
                      <span>帳單總額（{splitN} 人平均攤分）</span>
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
                    <span className="text-zinc-400 block">分類</span>
                    <span className="font-semibold text-zinc-900 dark:text-white mt-0.5 block">{cat.label}</span>
                  </div>
                  <div className="rounded-2xl bg-zinc-100/70 dark:bg-white/[0.04] px-3.5 py-2.5">
                    <span className="text-zinc-400 block">付款方式</span>
                    <span className="font-semibold text-zinc-900 dark:text-white mt-0.5 block">{payLabel}</span>
                  </div>
                  {!detailExpense.isPreTrip && detailExpense.date && (
                    <div className="col-span-2 rounded-2xl bg-zinc-100/70 dark:bg-white/[0.04] px-3.5 py-2.5 flex items-center justify-between">
                      <span className="text-zinc-400">消費日期</span>
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
                    <span>刪除</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEditExpense(detailExpense)}
                    className="flex-1 min-h-[46px] rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <EditIcon className="w-4 h-4" />
                    <span>編輯紀錄</span>
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
        title={editingId ? '編輯消費紀錄' : '記一筆開支'}
      >
        <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 pb-4">
          {/* Free Scope Toggle: 旅途消費 vs 行前開支 */}
          <div>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1.5 block">歸屬類型</label>
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
                    category: ON_TRIP_CATEGORIES.some((c) => c.id === prev.category) ? prev.category : '',
                  }));
                } else {
                  setActiveModal('ADD_PRE');
                  setNewExpense((prev) => ({
                    ...prev,
                    currency: !editingId && !prev.amount ? globalCurrency : prev.currency,
                    paymentMethod: !editingId && !prev.amount ? 'card' : prev.paymentMethod,
                    date: '',
                    category: PRE_TRIP_CATEGORIES.some((c) => c.id === prev.category) ? prev.category : '',
                  }));
                }
              }}
              options={[
                { id: 'ADD_ON', label: '旅途消費', accentFrom: '#F26B3A', accentTo: '#FB923C' },
                { id: 'ADD_PRE', label: '行前開支', accentFrom: '#4F5DF5', accentTo: '#6366F1' },
              ]}
            />
          </div>

          <div className="flex gap-2.5">
            <div className="flex-1 bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200/70 dark:border-white/10 rounded-2xl p-3.5">
              <span className="text-[11px] font-medium text-zinc-500 block mb-1">
                {newExpense.splitCount > 1 ? '帳單總金額' : '金額'}
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
                {ALL_CURRENCIES.map((c) => (
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
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1 block">項目名稱</label>
              <input
                type="text"
                placeholder={activeModal === 'ADD_PRE' ? '來回機票、住宿訂金' : '拉麵、交通卡'}
                value={newExpense.title}
                onChange={(e) => setNewExpense({ ...newExpense, title: e.target.value })}
                className="w-full h-11 px-4 rounded-2xl bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200/70 dark:border-white/10 text-zinc-900 dark:text-white font-medium text-sm focus:outline-none"
              />
            </div>
            {activeModal === 'ADD_ON' && (
              <div>
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1 block">日期</label>
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
                <span>是否有多人攤分此筆開支？</span>
              </div>
              <SlidingSegmentedControl
                size="sm"
                value={newExpense.splitCount > 1 ? 'SPLIT' : 'SOLO'}
                onChange={(mode) =>
                  setNewExpense((prev) => ({
                    ...prev,
                    splitCount: mode === 'SPLIT' ? (prev.splitCount > 1 ? prev.splitCount : 2) : 1,
                  }))
                }
                options={[
                  { id: 'SOLO', label: '單獨支付', accentFrom: '#27272A', accentTo: '#3F3F46' },
                  { id: 'SPLIT', label: '多人攤分', accentFrom: '#4F5DF5', accentTo: '#6366F1' },
                ]}
              />
            </div>

            {newExpense.splitCount > 1 && (
              <div className="pt-2 border-t border-zinc-200/60 dark:border-white/[0.08] space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">攤分人數</span>
                  <div className="flex items-center gap-1.5">
                    {[2, 3, 4, 5, 6].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setNewExpense((prev) => ({ ...prev, splitCount: cnt }))}
                        className={`w-7 h-7 rounded-full text-xs font-num font-bold transition-colors cursor-pointer ${
                          newExpense.splitCount === cnt
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200/70 dark:border-white/10'
                        }`}
                      >
                        {cnt}
                      </button>
                    ))}
                    <div className="flex items-center bg-white dark:bg-zinc-800 border border-zinc-200/70 dark:border-white/10 rounded-full px-1.5 h-7">
                      <button
                        type="button"
                        onClick={() =>
                          setNewExpense((prev) => ({ ...prev, splitCount: Math.max(2, prev.splitCount - 1) }))
                        }
                        className="w-5 h-5 text-xs font-bold text-zinc-600 dark:text-zinc-300 cursor-pointer"
                      >
                        -
                      </button>
                      <span className="px-1.5 text-xs font-num font-bold text-zinc-900 dark:text-white">
                        {newExpense.splitCount}人
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setNewExpense((prev) => ({ ...prev, splitCount: Math.min(30, prev.splitCount + 1) }))
                        }
                        className="w-5 h-5 text-xs font-bold text-zinc-600 dark:text-zinc-300 cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
                {parseFloat(newExpense.amount) > 0 && (
                  <div className="flex items-center justify-between text-xs font-num text-indigo-600 dark:text-indigo-400 font-semibold">
                    <span>每人平均應付</span>
                    <span>
                      {formatMoney(parseFloat(newExpense.amount) / newExpense.splitCount, newExpense.currency)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1.5 block">付款方式</label>
            <SlidingSegmentedControl
              fullWidth
              value={newExpense.paymentMethod}
              onChange={(pm) => setNewExpense({ ...newExpense, paymentMethod: pm })}
              options={[
                { id: 'cash', label: '現金', icon: <BanknotesIcon className="w-4 h-4" />, accentFrom: '#0E9F76', accentTo: '#10B981' },
                { id: 'card', label: '信用卡', icon: <CreditCardIcon className="w-4 h-4" />, accentFrom: '#4F5DF5', accentTo: '#6366F1' },
                { id: 'other', label: '其他', icon: <TagIcon className="w-4 h-4" />, accentFrom: '#8B5CF6', accentTo: '#A78BFA' },
              ]}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1.5 block">分類</label>
            <div className="grid grid-cols-2 gap-2">
              {(activeModal === 'ADD_PRE' ? PRE_TRIP_CATEGORIES : ON_TRIP_CATEGORIES).map((cat) => (
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
          onClick={() => handleSaveExpense(activeModal === 'ADD_PRE')}
          disabled={!newExpense.amount || !newExpense.title.trim() || !newExpense.category}
          className="w-full min-h-[48px] rounded-full font-semibold text-sm bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-35 cursor-pointer shrink-0"
        >
          {editingId ? '儲存變更' : '新增紀錄'}
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
            <span>消費分析 ({globalCurrency})</span>
          </div>
        }
      >
        <div className="flex-1 overflow-y-auto no-scrollbar space-y-5 pb-2">
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-zinc-100 dark:bg-white/[0.05] rounded-2xl p-3 text-center">
              <p className="text-[11px] font-medium text-zinc-500 mb-1">現金</p>
              <p className="font-num font-bold text-sm text-zinc-900 dark:text-white truncate">
                {Math.round(onTripStats.methods.cash).toLocaleString()}
              </p>
            </div>
            <div className="bg-zinc-100 dark:bg-white/[0.05] rounded-2xl p-3 text-center">
              <p className="text-[11px] font-medium text-zinc-500 mb-1">信用卡</p>
              <p className="font-num font-bold text-sm text-zinc-900 dark:text-white truncate">
                {Math.round(onTripStats.methods.card).toLocaleString()}
              </p>
            </div>
            <div className="bg-zinc-100 dark:bg-white/[0.05] rounded-2xl p-3 text-center">
              <p className="text-[11px] font-medium text-zinc-500 mb-1">其他</p>
              <p className="font-num font-bold text-sm text-zinc-900 dark:text-white truncate">
                {Math.round(onTripStats.methods.other).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">類別佔比</h4>
            {onTripStats.categories.length === 0 ? (
              <p className="text-xs text-zinc-400 py-6 text-center">尚無消費數據</p>
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
            <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">每日明細</h4>
            {onTripStats.days.length === 0 ? (
              <p className="text-xs text-zinc-400 py-4 text-center">尚無每日數據</p>
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
          onShowToast('已刪除消費紀錄');
          setDeleteTarget(null);
        }}
        title="刪除此筆消費？"
        description={`「${deleteTarget?.title || ''}」將從紀錄移除。`}
        confirmLabel="確認刪除"
        icon={<TrashIcon className="w-6 h-6" />}
      />
    </div>
  );
};

export default ExpensesTool;
