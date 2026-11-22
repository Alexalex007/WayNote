import React, { useEffect, useLayoutEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { XMarkIcon, CheckIcon, DevicePhoneMobileIcon } from './Icons';
import { useI18n } from '../hooks/useI18n';

const modalCountListeners = new Set<(count: number) => void>();
let activeModalCount = 0;

function notifyModalCount() {
  for (const listener of modalCountListeners) {
    listener(activeModalCount);
  }
}

export function useAnyModalOpen(): boolean {
  const [isOpen, setIsOpen] = useState(() => activeModalCount > 0);
  useEffect(() => {
    const onChange = (count: number) => setIsOpen(count > 0);
    modalCountListeners.add(onChange);
    setIsOpen(activeModalCount > 0);
    return () => {
      modalCountListeners.delete(onChange);
    };
  }, []);
  return isOpen;
}

export interface SegmentedOption<T extends string> {
  id: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  accentFrom?: string;
  accentTo?: string;
}

interface SlidingSegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  defaultFrom?: string;
  defaultTo?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'pill' | 'rounded' | 'underline';
  fullWidth?: boolean;
  className?: string;
  inactiveTextClass?: string;
  activeTextClass?: string;
}

export function SlidingSegmentedControl<T extends string>({
  options,
  value,
  onChange,
  defaultFrom = 'var(--tab-accent, #F26B3A)',
  defaultTo = 'var(--tab-accent-hover, #E15A2A)',
  size = 'md',
  variant = 'pill',
  fullWidth = false,
  className = '',
  inactiveTextClass = 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white',
  activeTextClass = 'text-white',
}: SlidingSegmentedControlProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeIdx = Math.max(0, options.findIndex((o) => o.id === value));
  const activeOption = options[activeIdx];

  const [thumbRect, setThumbRect] = useState<{ left: number; width: number; top: number; height: number } | null>(null);
  const currentGradientFrom = activeOption?.accentFrom || defaultFrom;
  const currentGradientTo = activeOption?.accentTo || defaultTo;
  const prevColorsRef = useRef<{ from: string; to: string }>({
    from: currentGradientFrom,
    to: currentGradientTo,
  });
  const [gradCycle, setGradCycle] = useState<{
    fromA: string;
    fromB: string;
    toA: string;
    toB: string;
    tick: number;
  }>({
    fromA: currentGradientFrom,
    fromB: currentGradientTo,
    toA: currentGradientFrom,
    toB: currentGradientTo,
    tick: 0,
  });

  useEffect(() => {
    const prev = prevColorsRef.current;
    if (prev.from !== currentGradientFrom || prev.to !== currentGradientTo) {
      setGradCycle((c) => ({
        fromA: prev.from,
        fromB: prev.to,
        toA: currentGradientFrom,
        toB: currentGradientTo,
        tick: c.tick + 1,
      }));
      prevColorsRef.current = { from: currentGradientFrom, to: currentGradientTo };
    }
  }, [currentGradientFrom, currentGradientTo]);

  useLayoutEffect(() => {
    const measure = () => {
      const btn = buttonRefs.current[activeIdx];
      const container = containerRef.current;
      if (!btn || !container) return;
      setThumbRect({
        left: btn.offsetLeft,
        width: btn.offsetWidth,
        top: btn.offsetTop,
        height: btn.offsetHeight,
      });
    };

    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro && containerRef.current) {
      ro.observe(containerRef.current);
      buttonRefs.current.forEach((b) => {
        if (b) ro.observe(b);
      });
    }
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [activeIdx, options.length, fullWidth, size, value]);

  const paddingClass = size === 'sm' ? 'p-0.5' : 'p-1';
  const heightClass = size === 'sm' ? 'min-h-[34px]' : size === 'lg' ? 'min-h-[46px]' : 'min-h-[40px]';
  const radiusClass =
    variant === 'underline' ? 'rounded-none' : variant === 'rounded' ? 'rounded-2xl' : 'rounded-full';
  const thumbRadiusClass =
    variant === 'underline' ? 'rounded-full' : variant === 'rounded' ? 'rounded-xl' : 'rounded-full';
  const btnPaddingClass =
    size === 'sm' ? 'px-3 py-1 text-xs' : size === 'lg' ? 'px-4 py-2 text-xs sm:text-sm' : 'px-3.5 py-1.5 text-xs';

  if (variant === 'underline') {
    return (
      <div
        ref={containerRef}
        className={`relative flex items-center gap-5 border-b border-zinc-200/70 dark:border-white/[0.08] ${className}`}
      >
        {thumbRect && (
          <motion.div
            aria-hidden="true"
            initial={false}
            animate={{
              x: thumbRect.left,
              width: thumbRect.width,
              backgroundImage:
                gradCycle.tick > 0
                  ? [
                      `linear-gradient(90deg, ${gradCycle.fromA}, ${gradCycle.fromB})`,
                      `linear-gradient(90deg, ${gradCycle.fromA}, ${gradCycle.toA})`,
                      `linear-gradient(90deg, ${gradCycle.toA}, ${gradCycle.toB})`,
                    ]
                  : `linear-gradient(90deg, ${currentGradientFrom}, ${currentGradientTo})`,
            }}
            transition={{
              x: { type: 'spring', stiffness: 450, damping: 34, mass: 0.8 },
              width: { type: 'spring', stiffness: 450, damping: 34, mass: 0.8 },
              backgroundImage: { duration: 0.42, ease: 'easeInOut' },
            }}
            className="absolute bottom-[-1px] left-0 h-[2.5px] rounded-full pointer-events-none"
          />
        )}
        {options.map((opt, idx) => {
          const active = opt.id === value;
          return (
            <button
              key={opt.id}
              ref={(el) => {
                buttonRefs.current[idx] = el;
              }}
              type="button"
              onClick={() => onChange(opt.id)}
              className={`relative z-10 pb-2.5 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                active ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              {opt.icon}
              <span>{opt.label}</span>
              {opt.badge !== undefined && opt.badge !== null && <span>{opt.badge}</span>}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative ${fullWidth ? 'flex w-full' : 'inline-flex'} items-center ${paddingClass} ${heightClass} ${radiusClass} bg-zinc-200/70 dark:bg-white/[0.065] border border-zinc-200/70 dark:border-white/10 ${className}`}
    >
      {thumbRect && (
        <motion.div
          aria-hidden="true"
          initial={false}
          animate={{
            x: thumbRect.left,
            width: thumbRect.width,
            backgroundImage:
              gradCycle.tick > 0
                ? [
                    `linear-gradient(135deg, ${gradCycle.fromA}, ${gradCycle.fromB})`,
                    `linear-gradient(135deg, ${gradCycle.fromA}, ${gradCycle.toA})`,
                    `linear-gradient(135deg, ${gradCycle.toA}, ${gradCycle.toB})`,
                  ]
                : `linear-gradient(135deg, ${currentGradientFrom}, ${currentGradientTo})`,
          }}
          transition={{
            x: { type: 'spring', stiffness: 450, damping: 34, mass: 0.82 },
            width: { type: 'spring', stiffness: 450, damping: 34, mass: 0.82 },
            backgroundImage: { duration: 0.45, ease: 'easeInOut' },
          }}
          style={{
            top: thumbRect.top,
            height: thumbRect.height,
          }}
          className={`absolute left-0 ${thumbRadiusClass} shadow-sm pointer-events-none z-0`}
        />
      )}
      {options.map((opt, idx) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            ref={(el) => {
              buttonRefs.current[idx] = el;
            }}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`relative z-10 ${fullWidth ? 'flex-1' : ''} ${btnPaddingClass} h-full ${thumbRadiusClass} font-semibold transition-colors duration-200 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap select-none ${
              active ? activeTextClass : inactiveTextClass
            }`}
          >
            {opt.icon}
            <span>{opt.label}</span>
            {opt.badge !== undefined && opt.badge !== null && (
              <span className={`font-num text-[11px] ${active ? 'opacity-90' : 'opacity-65'}`}>
                {opt.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface LiquidModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  maxWidthClass?: string;
  zIndexClass?: string;
  bottomSheetOnMobile?: boolean;
}

export const LiquidModal: React.FC<LiquidModalProps> = ({
  open,
  onClose,
  title,
  children,
  maxWidthClass = 'max-w-md',
  zIndexClass = 'z-[80]',
  bottomSheetOnMobile = false,
}) => {
  const { t } = useI18n();
  const [viewportMetrics, setViewportMetrics] = useState<{ keyboardInset: number; maxModalHeight: number | null }>({
    keyboardInset: 0,
    maxModalHeight: null,
  });
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    activeModalCount += 1;
    notifyModalCount();
    return () => {
      activeModalCount = Math.max(0, activeModalCount - 1);
      notifyModalCount();
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setViewportMetrics({ keyboardInset: 0, maxModalHeight: null });
      return;
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);

    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    const syncViewport = () => {
      if (!vv) return;
      const inset = Math.max(0, Math.round(window.innerHeight - (vv.height + vv.offsetTop)));
      const nextHeight = inset > 40 ? Math.max(260, Math.round(vv.height - 20)) : null;
      setViewportMetrics({
        keyboardInset: inset > 40 ? inset : 0,
        maxModalHeight: nextHeight,
      });
    };

    syncViewport();
    if (vv) {
      vv.addEventListener('resize', syncViewport);
      vv.addEventListener('scroll', syncViewport);
    }

    return () => {
      window.removeEventListener('keydown', onKey);
      if (vv) {
        vv.removeEventListener('resize', syncViewport);
        vv.removeEventListener('scroll', syncViewport);
      }
    };
  }, [open, onClose]);

  const handleFocusCapture = (e: React.FocusEvent<HTMLDivElement>) => {
    const target = e.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    ) {
      window.setTimeout(() => {
        if (cardRef.current && cardRef.current.contains(target)) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 140);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          style={
            viewportMetrics.keyboardInset > 0
              ? { paddingBottom: `${viewportMetrics.keyboardInset + 8}px` }
              : undefined
          }
          className={`fixed inset-0 ${zIndexClass} flex ${
            bottomSheetOnMobile || viewportMetrics.keyboardInset > 0 ? 'items-end sm:items-center' : 'items-center'
          } justify-center bg-zinc-950/40 dark:bg-black/70 backdrop-blur-sm p-0 sm:p-4 transition-[padding-bottom] duration-150`}
        >
          <motion.div
            ref={cardRef}
            initial={bottomSheetOnMobile ? { opacity: 0, y: 36 } : { opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={bottomSheetOnMobile ? { opacity: 0, y: 30 } : { opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.85 }}
            onClick={(e) => e.stopPropagation()}
            onFocusCapture={handleFocusCapture}
            style={
              viewportMetrics.maxModalHeight
                ? { maxHeight: `${viewportMetrics.maxModalHeight}px` }
                : undefined
            }
            className={`surface-elevated w-full ${maxWidthClass} ${
              bottomSheetOnMobile ? 'rounded-t-3xl sm:rounded-3xl' : 'rounded-3xl'
            } p-6 flex flex-col max-h-[86dvh] overflow-clip relative`}
          >
            {bottomSheetOnMobile && (
              <div className="sm:hidden w-9 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto mb-3 shrink-0" />
            )}
            {title && (
              <div className="flex items-center justify-between gap-4 mb-5 shrink-0">
                <div className="text-lg font-display font-bold text-zinc-900 dark:text-zinc-50 tracking-tight flex items-center gap-2.5 min-w-0">
                  {title}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={t('關閉', '关闭', 'Close')}
                  className="min-w-[40px] min-h-[40px] rounded-full bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/70 dark:border-zinc-700/60 flex items-center justify-center text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200/80 dark:hover:bg-zinc-700 active:scale-95 transition-all cursor-pointer shrink-0"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

interface ConfirmSheetProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  icon?: React.ReactNode;
}

export const ConfirmSheet: React.FC<ConfirmSheetProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = 'danger',
  icon,
}) => {
  const { t } = useI18n();
  const resolvedConfirm = confirmLabel || t('確認', '确认', 'Confirm');
  const resolvedCancel = cancelLabel || t('取消', '取消', 'Cancel');
  return (
    <LiquidModal open={open} onClose={onClose} maxWidthClass="max-w-sm" zIndexClass="z-[110]">
      <div className="text-center pt-1">
        {icon && (
          <div
            className={`w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-4 ${
              tone === 'danger'
                ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                : 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
            }`}
          >
            {icon}
          </div>
        )}
        <h3 className="text-lg font-display font-bold text-zinc-900 dark:text-zinc-50 mb-1.5">{title}</h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed mb-6">{description}</p>
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[46px] rounded-full font-semibold text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200/80 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
          >
            {resolvedCancel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 min-h-[46px] rounded-full font-semibold text-sm transition-transform active:scale-[0.98] cursor-pointer ${
              tone === 'danger'
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-zinc-900 hover:bg-black text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900'
            }`}
          >
            {resolvedConfirm}
          </button>
        </div>
      </div>
    </LiquidModal>
  );
};

interface ToastMessage {
  id: number;
  text: string;
  tone?: 'info' | 'success' | 'error';
}

export const ToastBanner: React.FC<{ toast: ToastMessage | null }> = ({ toast }) => {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: -14, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 440, damping: 32 }}
          className="fixed top-[max(1.25rem,env(safe-area-inset-top))] left-1/2 -translate-x-1/2 z-[140] pointer-events-none px-4 w-full max-w-sm flex justify-center"
        >
          <div className="ink-card px-4 py-2.5 rounded-full flex items-center gap-2.5 text-xs sm:text-sm font-medium text-white shadow-xl">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                toast.tone === 'error'
                  ? 'bg-red-500 text-white'
                  : toast.tone === 'success'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-zinc-700 text-white'
              }`}
            >
              <CheckIcon className="w-3 h-3" />
            </span>
            <span className="truncate">{toast.text}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export interface SyncBubbleMessage {
  id: number;
  deviceName: string;
  sectionLabel: string;
  targetTab?: 'ITINERARY' | 'EXPLORE' | 'EXPENSES' | 'TOOLBOX' | 'SETTINGS';
}

export const TopSyncBubble: React.FC<{
  bubble: SyncBubbleMessage | null;
  onPress?: (bubble: SyncBubbleMessage) => void;
  onDismiss?: () => void;
}> = ({ bubble, onPress, onDismiss }) => {
  const { t } = useI18n();
  return (
    <AnimatePresence>
      {bubble && (
        <motion.div
          key={bubble.id}
          initial={{ opacity: 0, y: -42, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -32, scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 460, damping: 30, mass: 0.85 }}
          className="fixed top-[max(0.625rem,env(safe-area-inset-top))] left-1/2 -translate-x-1/2 z-[150] px-3 w-full max-w-md flex justify-center pointer-events-none"
        >
          <button
            type="button"
            onClick={() => {
              if (onPress) onPress(bubble);
              else onDismiss?.();
            }}
            className="pointer-events-auto surface-dock h-[46px] pl-3.5 pr-4 rounded-[26px] flex items-center gap-2.5 max-w-full cursor-pointer hover:scale-[1.015] active:scale-[0.98] transition-transform"
          >
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>

            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--tab-accent-soft)] text-[var(--tab-accent)] text-[11px] font-bold shrink-0">
              <DevicePhoneMobileIcon className="w-3.5 h-3.5" />
              <span className="max-w-[84px] truncate">{bubble.deviceName}</span>
            </span>

            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-100 truncate">
              {t(
                `剛剛編輯了「${bubble.sectionLabel}」`,
                `刚刚编辑了「${bubble.sectionLabel}」`,
                `Updated "${bubble.sectionLabel}"`
              )}
            </span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
