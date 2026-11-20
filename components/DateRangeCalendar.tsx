import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from './Icons';

export function getTodayLocalIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysUtc(dateStr: string, days: number): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function getDaySpanUtc(startDate: string, endDate: string): { days: number; nights: number } | null {
  if (!startDate || !endDate) return null;
  const s = Date.parse(`${startDate}T00:00:00Z`);
  const e = Date.parse(`${endDate}T00:00:00Z`);
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return null;
  const nights = Math.round((e - s) / 86400000);
  return { days: nights + 1, nights };
}

interface DateRangeCalendarProps {
  startDate: string;
  endDate: string;
  onChangeRange: (start: string, end: string) => void;
  minDate?: string;
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export const DateRangeCalendar: React.FC<DateRangeCalendarProps> = ({
  startDate,
  endDate,
  onChangeRange,
  minDate,
}) => {
  const todayIso = useMemo(() => getTodayLocalIso(), []);

  const initialAnchor = startDate || todayIso;
  const [viewYear, setViewYear] = useState<number>(() => parseInt(initialAnchor.slice(0, 4), 10) || new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(() => (parseInt(initialAnchor.slice(5, 7), 10) || 1) - 1);

  // Sync displayed month when startDate jumps significantly (e.g. switching stops)
  useEffect(() => {
    if (startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      const y = parseInt(startDate.slice(0, 4), 10);
      const m = parseInt(startDate.slice(5, 7), 10) - 1;
      setViewYear(y);
      setViewMonth(m);
    }
  }, [startDate]);

  // Interactive tap + press/long-press drag state
  const [pickPhase, setPickPhase] = useState<'START' | 'END'>('START');
  const dragStateRef = useRef<{
    pointerId: number | null;
    anchorDate: string | null;
    startX: number;
    startY: number;
    didDrag: boolean;
    lastHoverDate: string | null;
  }>({
    pointerId: null,
    anchorDate: null,
    startX: 0,
    startY: 0,
    didDrag: false,
    lastHoverDate: null,
  });
  const [isDragging, setIsDragging] = useState(false);

  const calendarCells = useMemo(() => {
    const firstDayUtc = new Date(Date.UTC(viewYear, viewMonth, 1));
    const startWeekday = firstDayUtc.getUTCDay(); // 0=Sun..6=Sat
    const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();

    const cells: { iso: string; day: number; inMonth: boolean }[] = [];

    // Leading days from previous month
    for (let i = startWeekday - 1; i >= 0; i--) {
      const dt = new Date(Date.UTC(viewYear, viewMonth, -i));
      cells.push({
        iso: dt.toISOString().slice(0, 10),
        day: dt.getUTCDate(),
        inMonth: false,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(Date.UTC(viewYear, viewMonth, d));
      cells.push({
        iso: dt.toISOString().slice(0, 10),
        day: d,
        inMonth: true,
      });
    }

    // Trailing days to complete 6 rows max or full week row
    const remainder = cells.length % 7;
    if (remainder !== 0) {
      const need = 7 - remainder;
      for (let i = 1; i <= need; i++) {
        const dt = new Date(Date.UTC(viewYear, viewMonth + 1, i));
        cells.push({
          iso: dt.toISOString().slice(0, 10),
          day: dt.getUTCDate(),
          inMonth: false,
        });
      }
    }

    return cells;
  }, [viewYear, viewMonth]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const isDisabledDate = (iso: string) => Boolean(minDate && iso < minDate);

  const applyTapSelection = (iso: string) => {
    if (isDisabledDate(iso)) return;
    if (pickPhase === 'START' || !startDate || (startDate && endDate && startDate !== endDate)) {
      onChangeRange(iso, iso);
      setPickPhase('END');
      return;
    }

    // Second tap completes range
    if (iso < startDate) {
      onChangeRange(iso, startDate);
    } else {
      onChangeRange(startDate, iso);
    }
    setPickPhase('START');
  };

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const state = dragStateRef.current;
      if (state.pointerId === null || e.pointerId !== state.pointerId || !state.anchorDate) return;

      const dx = Math.abs(e.clientX - state.startX);
      const dy = Math.abs(e.clientY - state.startY);
      if (!state.didDrag && (dx > 6 || dy > 6)) {
        state.didDrag = true;
        setIsDragging(true);
      }

      const el = document.elementFromPoint(e.clientX, e.clientY);
      const cell = el?.closest('[data-cal-date]') as HTMLElement | null;
      const hoverIso = cell?.getAttribute('data-cal-date');
      if (!hoverIso || isDisabledDate(hoverIso)) return;

      if (state.didDrag && hoverIso !== state.lastHoverDate) {
        state.lastHoverDate = hoverIso;
        const a = state.anchorDate;
        if (hoverIso < a) {
          onChangeRange(hoverIso, a);
        } else {
          onChangeRange(a, hoverIso);
        }
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const state = dragStateRef.current;
      if (state.pointerId === null || e.pointerId !== state.pointerId) return;
      const anchor = state.anchorDate;
      const wasDrag = state.didDrag;
      dragStateRef.current = {
        pointerId: null,
        anchorDate: null,
        startX: 0,
        startY: 0,
        didDrag: false,
        lastHoverDate: null,
      };
      setIsDragging(false);

      if (wasDrag) {
        setPickPhase('START');
      } else if (anchor) {
        applyTapSelection(anchor);
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  });

  const handleCellPointerDown = (e: React.PointerEvent, iso: string) => {
    if (isDisabledDate(iso)) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    dragStateRef.current = {
      pointerId: e.pointerId,
      anchorDate: iso,
      startX: e.clientX,
      startY: e.clientY,
      didDrag: false,
      lastHoverDate: iso,
    };
  };

  const monthLabel = `${viewYear} 年 ${viewMonth + 1} 月`;

  return (
    <div className="surface-elevated rounded-3xl p-4 sm:p-5 space-y-3 select-none">
      {/* Month Header */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={handlePrevMonth}
          aria-label="上個月"
          className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-white/[0.06] hover:bg-zinc-200/70 dark:hover:bg-white/10 flex items-center justify-center text-zinc-700 dark:text-zinc-200 transition-colors cursor-pointer"
        >
          <ChevronLeftIcon className="w-4 h-4" />
        </button>

        <div className="text-center">
          <div className="text-sm font-display font-bold font-num text-zinc-900 dark:text-white">
            {monthLabel}
          </div>
          <div className="text-[11px] text-zinc-400 dark:text-zinc-500">
            {isDragging ? '拖曳選擇回程日期中…' : pickPhase === 'END' ? '點選回程日期或拖曳選區間' : '點選或按住拖曳出發 → 回程'}
          </div>
        </div>

        <button
          type="button"
          onClick={handleNextMonth}
          aria-label="下個月"
          className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-white/[0.06] hover:bg-zinc-200/70 dark:hover:bg-white/10 flex items-center justify-center text-zinc-700 dark:text-zinc-200 transition-colors cursor-pointer"
        >
          <ChevronRightIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Weekday Labels */}
      <div className="grid grid-cols-7 text-center">
        {WEEKDAYS.map((w) => (
          <span key={w} className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 py-1">
            {w}
          </span>
        ))}
      </div>

      {/* Interactive Day Grid (touch-none ensures smooth press-drag on mobile without scroll hijack) */}
      <div className="grid grid-cols-7 gap-y-1 touch-none">
        {calendarCells.map((cell) => {
          const disabled = isDisabledDate(cell.iso);
          const isStart = Boolean(startDate && cell.iso === startDate);
          const isEnd = Boolean(endDate && cell.iso === endDate);
          const isSingleDay = isStart && isEnd;
          const isInRange = Boolean(startDate && endDate && cell.iso > startDate && cell.iso < endDate);
          const isToday = cell.iso === todayIso;

          return (
            <div
              key={cell.iso}
              data-cal-date={cell.iso}
              onPointerDown={(e) => handleCellPointerDown(e, cell.iso)}
              role="button"
              tabIndex={disabled ? -1 : 0}
              aria-label={cell.iso}
              aria-selected={isStart || isEnd || isInRange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  applyTapSelection(cell.iso);
                }
              }}
              className={`relative h-10 flex items-center justify-center cursor-pointer transition-colors ${
                disabled ? 'opacity-25 pointer-events-none' : ''
              } ${
                isInRange
                  ? 'bg-[#F26B3A]/14 dark:bg-[#F47A4D]/22'
                  : isStart && endDate && !isSingleDay
                    ? 'bg-gradient-to-r from-transparent via-[#F26B3A]/14 to-[#F26B3A]/14 dark:via-[#F47A4D]/22 dark:to-[#F47A4D]/22'
                    : isEnd && startDate && !isSingleDay
                      ? 'bg-gradient-to-l from-transparent via-[#F26B3A]/14 to-[#F26B3A]/14 dark:via-[#F47A4D]/22 dark:to-[#F47A4D]/22'
                      : ''
              }`}
            >
              <span
                className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center text-xs font-num font-semibold transition-transform ${
                  isStart || isEnd
                    ? 'bg-[#F26B3A] text-white shadow-[0_6px_16px_-4px_rgba(242,107,58,0.65)] scale-105'
                    : isInRange
                      ? 'text-[#D65022] dark:text-[#FF9E7B] font-bold'
                      : cell.inMonth
                        ? 'text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-white/10'
                        : 'text-zinc-300 dark:text-zinc-600'
                }`}
              >
                {cell.day}
                {isToday && !isStart && !isEnd && (
                  <span className="absolute bottom-1 w-1 h-1 rounded-full bg-[#F26B3A]" />
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
