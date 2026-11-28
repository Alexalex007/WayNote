import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowDownTrayIcon,
  ArrowsRightLeftIcon,
  BookmarkIcon,
  CheckIcon,
  ChevronRightIcon,
  DocumentDuplicateIcon,
  HeartIcon,
  PaperAirplaneIcon,
  StarIcon,
  TrashIcon,
} from './Icons';
import { useI18n } from '../hooks/useI18n';
import { tactileAudio } from '../services/tactileAudio';

function fallbackCopyText(text: string) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
  } catch {
    // ignore
  }
  document.body.removeChild(ta);
}

export async function copyToClipboardSafe(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    fallbackCopyText(text);
    return true;
  } catch {
    fallbackCopyText(text);
    return true;
  }
}

/* -------------------------------------------------------------------------- */
/* 1. StretchToggle — Liquid capsule stretch switch adapted to theme accent   */
/* -------------------------------------------------------------------------- */
interface StretchToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
  soundType?: 'boing' | 'liquid';
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
}

export const StretchToggle: React.FC<StretchToggleProps> = ({
  checked,
  onChange,
  ariaLabel,
  soundType = 'boing',
  size = 'md',
  disabled = false,
  className = '',
}) => {
  const prefersReduced = useReducedMotion();
  const [stretching, setStretching] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const handleToggle = () => {
    if (disabled) return;
    const next = !checked;
    if (soundType === 'liquid') {
      tactileAudio.playLiquid(next);
    } else {
      tactileAudio.playBoing(next ? 1.12 : 0.88);
    }

    if (!prefersReduced) {
      setStretching(true);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setStretching(false), 185);
    }
    onChange(next);
  };

  const trackW = size === 'sm' ? 50 : 58;
  const trackH = size === 'sm' ? 28 : 32;
  const thumbSize = size === 'sm' ? 20 : 24;
  const stretchExtra = size === 'sm' ? 9 : 11;
  const pad = 4;
  const maxTravel = trackW - pad * 2 - thumbSize;
  const thumbWidth = stretching ? thumbSize + stretchExtra : thumbSize;
  const thumbX = checked
    ? stretching
      ? maxTravel - stretchExtra
      : maxTravel
    : 0;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={handleToggle}
      className={`relative inline-flex items-center justify-center min-h-[44px] min-w-[54px] cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed select-none ${className}`}
    >
      <span
        style={{
          width: `${trackW}px`,
          height: `${trackH}px`,
          background: checked
            ? 'linear-gradient(135deg, var(--tab-accent, #2563EB), var(--tab-accent-hover, #1D4ED8))'
            : undefined,
        }}
        className={`relative inline-flex items-center rounded-full p-1 transition-colors duration-250 border ${
          checked
            ? 'border-transparent shadow-[0_6px_16px_-6px_var(--tab-accent)]'
            : 'bg-zinc-200/90 dark:bg-white/12 border-zinc-300/70 dark:border-white/15'
        }`}
      >
        <span
          style={{
            width: `${thumbWidth}px`,
            height: `${thumbSize}px`,
            transform: `translateX(${thumbX}px)`,
            transition: prefersReduced
              ? 'transform 0.15s ease'
              : 'transform 0.32s cubic-bezier(0.34, 1.4, 0.64, 1), width 0.16s ease',
          }}
          className="rounded-full bg-white shadow-sm block will-change-transform"
        />
      </span>
    </button>
  );
};

/* -------------------------------------------------------------------------- */
/* 2. CopyMorphButton — Clipboard action with inline checkmark morph          */
/* -------------------------------------------------------------------------- */
interface CopyMorphButtonProps {
  textToCopy?: string;
  onCopy?: () => void | Promise<void>;
  label: string;
  copiedLabel?: string;
  icon?: React.ReactNode;
  variant?: 'subtle' | 'accent' | 'pill';
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
}

export const CopyMorphButton: React.FC<CopyMorphButtonProps> = ({
  textToCopy,
  onCopy,
  label,
  copiedLabel,
  icon,
  variant = 'subtle',
  size = 'md',
  disabled = false,
  className = '',
}) => {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const handleClick = async () => {
    if (disabled) return;
    if (textToCopy !== undefined) {
      await copyToClipboardSafe(textToCopy);
    }
    if (onCopy) {
      await onCopy();
    }
    tactileAudio.playChime();
    setCopied(true);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCopied(false), 1600);
  };

  const resolvedCopied = copiedLabel || t('已複製', '已复制', 'Copied');

  const sizeClass =
    size === 'sm'
      ? 'min-h-[38px] px-3 py-1.5 text-xs rounded-xl'
      : 'min-h-[44px] px-4 py-2 text-xs sm:text-sm rounded-2xl';

  const variantClass = copied
    ? 'bg-emerald-500/15 dark:bg-emerald-500/20 border-emerald-500/50 text-emerald-700 dark:text-emerald-300'
    : variant === 'accent'
      ? 'text-white border-transparent shadow-[0_10px_22px_-8px_var(--tab-accent)]'
      : 'bg-zinc-100/90 dark:bg-white/[0.08] border-zinc-200/80 dark:border-white/12 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-200/80 dark:hover:bg-white/14';

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.96 }}
      disabled={disabled}
      onClick={handleClick}
      style={
        !copied && variant === 'accent'
          ? {
              background:
                'linear-gradient(135deg, var(--tab-accent, #2563EB), var(--tab-accent-hover, #1D4ED8))',
            }
          : undefined
      }
      className={`inline-flex items-center justify-center gap-1.5 font-semibold border whitespace-nowrap transition-colors duration-200 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${sizeClass} ${variantClass} ${className}`}
    >
      <span className="shrink-0 flex items-center justify-center">
        {copied ? (
          <CheckIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-300" />
        ) : (
          icon || <DocumentDuplicateIcon className="w-4 h-4" />
        )}
      </span>
      <span className="whitespace-nowrap">{copied ? resolvedCopied : label}</span>
    </motion.button>
  );
};

/* -------------------------------------------------------------------------- */
/* 3. HoldConfirmButton — Anti-misclick long-press danger confirmation        */
/* -------------------------------------------------------------------------- */
interface HoldConfirmButtonProps {
  onConfirm: () => void;
  label: string;
  holdingLabel?: string;
  durationMs?: number;
  tone?: 'danger' | 'primary';
  icon?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

export const HoldConfirmButton: React.FC<HoldConfirmButtonProps> = ({
  onConfirm,
  label,
  holdingLabel,
  durationMs = 680,
  tone = 'danger',
  icon,
  disabled = false,
  className = '',
}) => {
  const { t } = useI18n();
  const prefersReduced = useReducedMotion();
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);

  const btnRef = useRef<HTMLButtonElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const triggeredRef = useRef(false);
  const isHoldingRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;

  const stopHold = useCallback((pointerId?: number) => {
    if (
      pointerId !== undefined &&
      activePointerIdRef.current !== null &&
      pointerId !== activePointerIdRef.current
    ) {
      return;
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const capturedId = activePointerIdRef.current;
    activePointerIdRef.current = null;
    isHoldingRef.current = false;
    if (capturedId !== null && btnRef.current) {
      try {
        if (btnRef.current.hasPointerCapture(capturedId)) {
          btnRef.current.releasePointerCapture(capturedId);
        }
      } catch {
        // ignore release error
      }
    }
    setHolding(false);
    if (!triggeredRef.current) {
      setProgress(0);
    }
  }, []);

  useEffect(() => {
    const onWindowUp = (e: PointerEvent) => {
      if (isHoldingRef.current) stopHold(e.pointerId);
    };
    const onWindowBlur = () => {
      if (isHoldingRef.current) stopHold();
    };
    window.addEventListener('pointerup', onWindowUp);
    window.addEventListener('pointercancel', onWindowUp);
    window.addEventListener('blur', onWindowBlur);
    return () => {
      window.removeEventListener('pointerup', onWindowUp);
      window.removeEventListener('pointercancel', onWindowUp);
      window.removeEventListener('blur', onWindowBlur);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [stopHold]);

  const startHold = useCallback(
    (pointerId?: number) => {
      if (disabled || isHoldingRef.current) return;
      isHoldingRef.current = true;
      triggeredRef.current = false;
      if (pointerId !== undefined) {
        activePointerIdRef.current = pointerId;
        try {
          btnRef.current?.setPointerCapture(pointerId);
        } catch {
          // ignore if pointer capture is unsupported
        }
      }
      setHolding(true);
      tactileAudio.playTick(0.85);
      const effectiveDuration = prefersReduced ? 320 : durationMs;
      startRef.current = performance.now();

      const step = (now: number) => {
        if (!isHoldingRef.current) return;
        const next = Math.min(1, (now - startRef.current) / effectiveDuration);
        setProgress(next);
        if (next < 1) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          triggeredRef.current = true;
          isHoldingRef.current = false;
          activePointerIdRef.current = null;
          rafRef.current = null;
          setHolding(false);
          setProgress(0);
          tactileAudio.playWarn();
          onConfirmRef.current();
        }
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [disabled, durationMs, prefersReduced]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
      e.preventDefault();
      startHold();
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      stopHold();
    }
  };

  const resolvedHint = holdingLabel || t('按住確認...', '按住确认...', 'Hold...');

  const baseToneClass =
    tone === 'danger'
      ? 'bg-red-50 dark:bg-red-500/15 border border-red-300/80 dark:border-red-400/35 text-red-700 dark:text-red-200'
      : 'bg-zinc-100 dark:bg-white/10 border border-zinc-300/80 dark:border-white/20 text-zinc-900 dark:text-white';

  const fillToneClass =
    tone === 'danger'
      ? 'bg-red-600/90 dark:bg-red-500/85'
      : 'bg-[var(--tab-accent)]/85';

  return (
    <button
      ref={btnRef}
      type="button"
      disabled={disabled}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        e.preventDefault();
        startHold(e.pointerId);
      }}
      onPointerUp={(e) => stopHold(e.pointerId)}
      onPointerCancel={(e) => stopHold(e.pointerId)}
      onPointerLeave={(e) => {
        // Ignore stray pointerleave on touch/pen or while pointer is captured
        if (e.pointerType !== 'mouse') return;
        try {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) return;
        } catch {
          // ignore
        }
        stopHold(e.pointerId);
      }}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      style={{
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        transform: holding ? 'scale(0.985)' : 'scale(1)',
      }}
      aria-label={`${label} (${resolvedHint})`}
      className={`relative overflow-hidden min-h-[46px] px-4 rounded-full font-semibold text-sm flex items-center justify-center gap-1.5 select-none touch-none transition-transform cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${baseToneClass} ${className}`}
    >
      <span
        aria-hidden="true"
        style={{
          transform: `scaleX(${progress})`,
          transformOrigin: 'left center',
          transition: holding ? 'none' : 'transform 180ms ease-out',
        }}
        className={`absolute inset-0 ${fillToneClass} pointer-events-none`}
      />
      <span
        className={`relative z-10 inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors duration-150 ${
          progress > 0.42 ? 'text-white' : ''
        }`}
      >
        {icon || (tone === 'danger' ? <TrashIcon className="w-4 h-4 shrink-0" /> : null)}
        <span>{holding ? resolvedHint : label}</span>
      </span>
    </button>
  );
};

/* -------------------------------------------------------------------------- */
/* 4. RouteSwapButton — 180-degree rotating departure/arrival swap button     */
/* -------------------------------------------------------------------------- */
interface RouteSwapButtonProps {
  onSwap: () => void;
  ariaLabel?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const RouteSwapButton: React.FC<RouteSwapButtonProps> = ({
  onSwap,
  ariaLabel,
  size = 'md',
  className = '',
}) => {
  const { t } = useI18n();
  const prefersReduced = useReducedMotion();
  const [rotations, setRotations] = useState(0);

  const handleClick = () => {
    setRotations((r) => r + 1);
    tactileAudio.playWhoosh(true);
    onSwap();
  };

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.88 }}
      onClick={handleClick}
      aria-label={ariaLabel || t('對調出發與抵達地點', '对调出发与抵达地点', 'Swap origin and destination')}
      title={ariaLabel || t('對調出發與抵達地點', '对调出发与抵达地点', 'Swap origin & destination')}
      className={`shrink-0 inline-flex items-center justify-center rounded-full border border-[var(--tab-accent)]/25 bg-[var(--tab-accent-soft)] text-[var(--tab-accent)] hover:bg-[var(--tab-accent)] hover:text-white transition-colors duration-200 cursor-pointer shadow-xs ${
        size === 'sm' ? 'w-10 h-10' : 'w-11 h-11'
      } ${className}`}
    >
      <motion.span
        animate={{ rotate: prefersReduced ? 0 : rotations * 180 }}
        transition={{ type: 'spring', stiffness: 360, damping: 24 }}
        className="flex items-center justify-center"
      >
        <ArrowsRightLeftIcon className="w-4 h-4" />
      </motion.span>
    </motion.button>
  );
};

/* -------------------------------------------------------------------------- */
/* 5. StepperPill — Tabular bouncy numeric counter                            */
/* -------------------------------------------------------------------------- */
interface StepperPillProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  formatValue?: (val: number) => string;
  ariaLabel?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const StepperPill: React.FC<StepperPillProps> = ({
  value,
  onChange,
  min = 1,
  max = 99,
  formatValue,
  ariaLabel,
  size = 'md',
  className = '',
}) => {
  const { t } = useI18n();
  const prefersReduced = useReducedMotion();
  const [bumpTick, setBumpTick] = useState(0);

  const stepBy = (delta: number) => {
    const next = Math.max(min, Math.min(max, value + delta));
    if (next === value) return;
    const ratio = max > min ? (next - min) / (max - min) : 0.5;
    tactileAudio.playTick(0.84 + ratio * 0.36);
    setBumpTick((c) => c + 1);
    onChange(next);
  };

  const btnSize = size === 'sm' ? 'w-9 h-9 text-base' : 'w-10 h-10 text-base';

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`inline-flex items-center justify-between gap-2 p-1 rounded-full bg-white/90 dark:bg-white/[0.08] border border-zinc-200/80 dark:border-white/12 shadow-xs ${className}`}
    >
      <motion.button
        type="button"
        whileTap={{ scale: 0.86 }}
        disabled={value <= min}
        onClick={() => stepBy(-1)}
        aria-label={t('減少', '减少', 'Decrease')}
        className={`${btnSize} rounded-full bg-zinc-100 dark:bg-white/10 hover:bg-zinc-200 dark:hover:bg-white/20 text-zinc-800 dark:text-zinc-100 font-bold flex items-center justify-center transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed`}
      >
        −
      </motion.button>

      <motion.span
        key={prefersReduced ? 'static' : bumpTick}
        initial={prefersReduced ? false : { scale: 1.18 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 520, damping: 24 }}
        className="font-num font-bold text-sm text-zinc-900 dark:text-white min-w-[3.2rem] text-center whitespace-nowrap select-none px-1"
      >
        {formatValue ? formatValue(value) : value}
      </motion.span>

      <motion.button
        type="button"
        whileTap={{ scale: 0.86 }}
        disabled={value >= max}
        onClick={() => stepBy(1)}
        aria-label={t('增加', '增加', 'Increase')}
        className={`${btnSize} rounded-full bg-[var(--tab-accent-soft)] hover:bg-[var(--tab-accent)] text-[var(--tab-accent)] hover:text-white font-bold flex items-center justify-center transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed`}
      >
        +
      </motion.button>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 6. StampButton — Passport stamp spring confirmation button                 */
/* -------------------------------------------------------------------------- */
interface StampButtonProps {
  stamped?: boolean;
  onClick: () => void;
  idleLabel: string;
  stampedLabel?: string;
  idleIcon?: React.ReactNode;
  stampedIcon?: React.ReactNode;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export const StampButton: React.FC<StampButtonProps> = ({
  stamped = false,
  onClick,
  idleLabel,
  stampedLabel,
  idleIcon,
  stampedIcon,
  disabled = false,
  size = 'md',
  className = '',
}) => {
  const prefersReduced = useReducedMotion();
  const [pulseStamp, setPulseStamp] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const handleClick = () => {
    if (disabled) return;
    tactileAudio.playStamp();
    if (!prefersReduced) {
      setPulseStamp(true);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setPulseStamp(false), 380);
    }
    onClick();
  };

  const isStampedLook = stamped || pulseStamp;

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.94 }}
      animate={
        isStampedLook && !prefersReduced
          ? { rotate: [-2.5, 0], scale: [1.05, 1] }
          : { rotate: 0, scale: 1 }
      }
      transition={{ type: 'spring', stiffness: 460, damping: 24 }}
      disabled={disabled}
      onClick={handleClick}
      style={
        isStampedLook
          ? {
              background:
                'linear-gradient(135deg, var(--tab-accent, #E11D48), var(--tab-accent-hover, #F97316))',
            }
          : undefined
      }
      className={`inline-flex items-center justify-center gap-1.5 font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
        size === 'sm' ? 'min-h-[38px] px-3.5 text-xs rounded-xl' : 'min-h-[44px] px-4 text-xs sm:text-sm rounded-2xl'
      } ${
        isStampedLook
          ? 'text-white border border-transparent shadow-[0_10px_22px_-8px_var(--tab-accent)]'
          : 'border-[1.5px] border-dashed border-[var(--tab-accent)]/45 bg-[var(--tab-accent-soft)] text-[var(--tab-accent)] hover:border-solid hover:border-[var(--tab-accent)]'
      } ${className}`}
    >
      <span className="shrink-0 flex items-center justify-center">
        {isStampedLook ? stampedIcon || <CheckIcon className="w-3.5 h-3.5" /> : idleIcon}
      </span>
      <span className="whitespace-nowrap">{isStampedLook && stampedLabel ? stampedLabel : idleLabel}</span>
    </motion.button>
  );
};

/* -------------------------------------------------------------------------- */
/* 7. BookmarkBurstButton — Elastic bookmark/heart/star with subtle sparkle   */
/* -------------------------------------------------------------------------- */
interface BookmarkBurstButtonProps {
  active: boolean;
  onToggle: () => void;
  ariaLabel: string;
  mode?: 'bookmark' | 'heart' | 'star';
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

const BURST_ANGLES = [0, 60, 120, 180, 240, 300];

export const BookmarkBurstButton: React.FC<BookmarkBurstButtonProps> = ({
  active,
  onToggle,
  ariaLabel,
  mode = 'bookmark',
  label,
  size = 'md',
  className = '',
}) => {
  const prefersReduced = useReducedMotion();
  const [burstKey, setBurstKey] = useState(0);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !active;
    if (next) {
      tactileAudio.playPop(1.18);
      if (!prefersReduced) {
        setBurstKey((k) => k + 1);
      }
    } else {
      tactileAudio.playTick(0.82);
    }
    onToggle();
  };

  const IconComp = mode === 'heart' ? HeartIcon : mode === 'star' ? StarIcon : BookmarkIcon;
  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-[18px] h-[18px]';

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.88 }}
      onClick={handleClick}
      aria-label={ariaLabel}
      aria-pressed={active}
      title={ariaLabel}
      className={`relative inline-flex items-center justify-center gap-1.5 border transition-colors duration-200 cursor-pointer select-none ${
        label
          ? size === 'sm'
            ? 'min-h-[38px] px-3 rounded-full text-xs font-semibold'
            : 'min-h-[44px] px-3.5 rounded-full text-xs font-semibold'
          : size === 'sm'
            ? 'w-10 h-10 rounded-full'
            : 'w-11 h-11 rounded-full'
      } ${
        active
          ? mode === 'heart'
            ? 'bg-rose-500/14 dark:bg-rose-500/20 border-rose-500/45 text-rose-600 dark:text-rose-300'
            : mode === 'star'
              ? 'bg-amber-500/15 dark:bg-amber-400/20 border-amber-500/45 text-amber-600 dark:text-amber-300'
              : 'bg-[var(--tab-accent-soft)] border-[var(--tab-accent)]/45 text-[var(--tab-accent)]'
          : 'bg-white/80 dark:bg-white/[0.06] border-zinc-200/80 dark:border-white/12 text-zinc-400 dark:text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
      } ${className}`}
    >
      {burstKey > 0 && !prefersReduced && active && (
        <span key={burstKey} aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {BURST_ANGLES.map((deg) => {
            const rad = (deg * Math.PI) / 180;
            const dx = Math.cos(rad) * 18;
            const dy = Math.sin(rad) * 18;
            return (
              <motion.span
                key={deg}
                initial={{ x: 0, y: 0, scale: 1, opacity: 0.95 }}
                animate={{ x: dx, y: dy, scale: 0, opacity: 0 }}
                transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  background:
                    mode === 'heart'
                      ? '#FB7185'
                      : mode === 'star'
                        ? '#F59E0B'
                        : 'var(--tab-accent, #2563EB)',
                }}
                className="absolute w-1.5 h-1.5 rounded-full"
              />
            );
          })}
        </span>
      )}
      <motion.span
        animate={
          active && !prefersReduced
            ? { scaleY: [1, 1.24, 1], scaleX: [1, 0.92, 1] }
            : { scaleY: 1, scaleX: 1 }
        }
        transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
        className="flex items-center justify-center"
      >
        <IconComp className={iconSize} filled={active} />
      </motion.span>
      {label && <span className="whitespace-nowrap">{label}</span>}
    </motion.button>
  );
};

/* -------------------------------------------------------------------------- */
/* 8. SendPlaneButton — Diagonal paper-plane launch CTA                       */
/* -------------------------------------------------------------------------- */
interface SendPlaneButtonProps {
  onClick?: () => void | Promise<void>;
  type?: 'button' | 'submit';
  idleLabel: string;
  sendingLabel?: string;
  sentLabel?: string;
  sending?: boolean;
  sent?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

export const SendPlaneButton: React.FC<SendPlaneButtonProps> = ({
  onClick,
  type = 'button',
  idleLabel,
  sendingLabel,
  sentLabel,
  sending = false,
  sent = false,
  disabled = false,
  icon,
  className = '',
}) => {
  const { t } = useI18n();
  const prefersReduced = useReducedMotion();
  const [localPhase, setLocalPhase] = useState<'idle' | 'launching' | 'sent'>('idle');
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  const effectivePhase = sending
    ? 'launching'
    : sent
      ? 'sent'
      : localPhase;

  const handleClick = async () => {
    if (disabled || effectivePhase === 'launching') return;
    tactileAudio.playWhoosh(true);

    if (onClick) {
      if (type === 'button') {
        setLocalPhase('launching');
        try {
          await onClick();
          tactileAudio.playChime();
          setLocalPhase('sent');
          const resetId = window.setTimeout(() => setLocalPhase('idle'), 1450);
          timersRef.current.push(resetId);
        } catch {
          setLocalPhase('idle');
        }
      } else {
        void onClick();
      }
    }
  };

  const labelText =
    effectivePhase === 'launching'
      ? sendingLabel || idleLabel
      : effectivePhase === 'sent'
        ? sentLabel || t('已發送', '已发送', 'Sent')
        : idleLabel;

  return (
    <motion.button
      type={type}
      whileTap={{ scale: 0.96 }}
      disabled={disabled || effectivePhase === 'launching'}
      onClick={handleClick}
      style={
        effectivePhase === 'sent'
          ? undefined
          : {
              background:
                'linear-gradient(135deg, var(--tab-accent, #2563EB), var(--tab-accent-hover, #1D4ED8))',
            }
      }
      className={`relative overflow-hidden min-h-[46px] px-5 rounded-full font-semibold text-sm text-white inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_12px_26px_-10px_var(--tab-accent)] ${
        effectivePhase === 'sent' ? 'bg-emerald-500 shadow-emerald-500/30' : ''
      } ${className}`}
    >
      <motion.span
        animate={
          effectivePhase === 'launching' && !prefersReduced
            ? { x: [0, 26], y: [0, -20], rotate: [0, 16], opacity: [1, 0] }
            : { x: 0, y: 0, rotate: 0, opacity: 1 }
        }
        transition={{ duration: 0.36, ease: [0.4, 0, 0.2, 1] }}
        className="shrink-0 flex items-center justify-center"
      >
        {effectivePhase === 'sent' ? (
          <CheckIcon className="w-4 h-4" />
        ) : (
          icon || <PaperAirplaneIcon className="w-4 h-4" />
        )}
      </motion.span>
      <span className="whitespace-nowrap">{labelText}</span>
    </motion.button>
  );
};

/* -------------------------------------------------------------------------- */
/* 9. DownloadProgressButton — Gallery "Download Ring" 0→100% morph -> pop    */
/* -------------------------------------------------------------------------- */
interface DownloadProgressButtonProps {
  onDownload: () => void | Promise<void>;
  label: string;
  doneLabel?: string;
  icon?: React.ReactNode;
  variant?: 'accent' | 'subtle';
  disabled?: boolean;
  className?: string;
}

const DOWNLOAD_SPARK_OFFSETS = [
  { x: -20, y: -12, delay: 0 },
  { x: 20, y: -12, delay: 0.03 },
  { x: -16, y: 12, delay: 0.05 },
  { x: 18, y: 10, delay: 0.02 },
  { x: 0, y: -18, delay: 0.04 },
];

export const DownloadProgressButton: React.FC<DownloadProgressButtonProps> = ({
  onDownload,
  label,
  doneLabel,
  icon,
  variant = 'subtle',
  disabled = false,
  className = '',
}) => {
  const { t } = useI18n();
  const prefersReduced = useReducedMotion();
  const [phase, setPhase] = useState<'idle' | 'loading' | 'done'>('idle');
  const [progress, setProgress] = useState(0);
  const [doneTick, setDoneTick] = useState(0);
  const rafRef = useRef<number | null>(null);
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
    };
  }, []);

  const handleClick = async () => {
    if (disabled || phase === 'loading') return;
    tactileAudio.playClick(560, 0.045);

    if (prefersReduced) {
      await onDownload();
      tactileAudio.playChime();
      setDoneTick((n) => n + 1);
      setPhase('done');
      resetTimerRef.current = window.setTimeout(() => setPhase('idle'), 1700);
      return;
    }

    setPhase('loading');
    setProgress(0);
    const start = performance.now();
    const duration = 520; // Snappy 0->100% progress ring while preserving browser download gesture

    const step = (now: number) => {
      const elapsed = now - start;
      const tNorm = Math.min(1, elapsed / duration);
      // Fast ease-out cubic feel for 0% -> 100%
      const eased = 1 - Math.pow(1 - tNorm, 2.2);
      setProgress(eased);

      if (tNorm < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setProgress(1);
        tactileAudio.playChime();
        setDoneTick((n) => n + 1);
        setPhase('done');
        void Promise.resolve(onDownload());
        resetTimerRef.current = window.setTimeout(() => {
          setPhase('idle');
          setProgress(0);
        }, 1850);
      }
    };
    rafRef.current = requestAnimationFrame(step);
  };

  const ringRadius = 21;
  const circ = 2 * Math.PI * ringRadius;
  const resolvedDone = doneLabel || t('已儲存', '已保存', 'Saved');

  const toneClass =
    phase === 'loading'
      ? 'bg-zinc-900 dark:bg-zinc-900 border-zinc-800/80 dark:border-white/15 text-white shadow-lg'
      : phase === 'done'
        ? 'bg-emerald-500/15 dark:bg-emerald-500/20 border-emerald-500/55 text-emerald-700 dark:text-emerald-300 shadow-[0_8px_20px_-8px_rgba(16,185,129,0.45)]'
        : variant === 'accent'
          ? 'text-white border-transparent shadow-[0_10px_24px_-8px_var(--tab-accent)]'
          : 'bg-zinc-100/90 dark:bg-white/[0.08] border-zinc-200/80 dark:border-white/12 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-200/80 dark:hover:bg-white/14';

  return (
    <div className={`inline-flex items-center justify-center ${className}`}>
      <motion.button
        type="button"
        whileTap={{ scale: 0.95 }}
        animate={
          phase === 'done' && !prefersReduced
            ? { scale: [0.9, 1.07, 1] }
            : { scale: 1 }
        }
        transition={{ duration: 0.34, ease: [0.34, 1.45, 0.64, 1] }}
        disabled={disabled || phase === 'loading'}
        onClick={handleClick}
        style={{
          transition: 'width 0.32s cubic-bezier(0.34,1.35,0.64,1), min-width 0.32s cubic-bezier(0.34,1.35,0.64,1), padding 0.28s ease, background-color 0.22s ease, border-color 0.22s ease',
          ...(phase === 'idle' && variant === 'accent'
            ? {
                background:
                  'linear-gradient(135deg, var(--tab-accent, #2563EB), var(--tab-accent-hover, #1D4ED8))',
              }
            : {}),
        }}
        className={`relative overflow-visible h-[44px] rounded-full border font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer disabled:cursor-not-allowed ${
          phase === 'loading'
            ? 'w-[44px] min-w-[44px] px-0'
            : 'w-full min-w-[136px] px-5'
        } ${toneClass}`}
      >
        {phase === 'loading' && (
          <svg
            viewBox="0 0 48 48"
            className="pointer-events-none absolute -inset-[2px] w-[calc(100%+4px)] h-[calc(100%+4px)] -rotate-90"
          >
            <circle
              cx="24"
              cy="24"
              r={ringRadius}
              fill="none"
              stroke="rgba(255,255,255,0.16)"
              strokeWidth="2.5"
            />
            <circle
              cx="24"
              cy="24"
              r={ringRadius}
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - progress)}
            />
          </svg>
        )}

        {doneTick > 0 && phase === 'done' && !prefersReduced && (
          <span key={doneTick} aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
            {DOWNLOAD_SPARK_OFFSETS.map((dot, idx) => (
              <motion.span
                key={idx}
                initial={{ scale: 0.4, x: 0, y: 0, opacity: 0.9 }}
                animate={{ scale: 1, x: dot.x, y: dot.y, opacity: 0 }}
                transition={{ duration: 0.48, delay: dot.delay, ease: [0.16, 1, 0.3, 1] }}
                className="w-1.5 h-1.5 rounded-full bg-emerald-400"
              />
            ))}
          </span>
        )}

        {phase === 'loading' ? (
          <span className="font-num text-[10px] font-bold tracking-tight text-white">
            {Math.round(progress * 100)}%
          </span>
        ) : phase === 'done' ? (
          <>
            <CheckIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-300 shrink-0" />
            <span className="whitespace-nowrap">{resolvedDone}</span>
          </>
        ) : (
          <>
            <span className="shrink-0 flex items-center justify-center">
              {icon || <ArrowDownTrayIcon className="w-4 h-4" />}
            </span>
            <span className="whitespace-nowrap">{label}</span>
          </>
        )}
      </motion.button>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 10. ShareAppButton — Paper-plane launch + particle burst + share/copy      */
/* -------------------------------------------------------------------------- */
interface ShareAppButtonProps {
  shareUrl: string;
  shareTitle: string;
  shareText: string;
  label: string;
  sharedLabel?: string;
  copiedLabel?: string;
  onResult?: (outcome: 'shared' | 'copied' | 'cancelled') => void;
  className?: string;
}

const SHARE_BURST_OFFSETS = [
  { x: -20, y: -14, delay: 0 },
  { x: 20, y: -14, delay: 0.03 },
  { x: -16, y: 14, delay: 0.05 },
  { x: 18, y: 12, delay: 0.02 },
  { x: 0, y: -20, delay: 0.04 },
  { x: 24, y: 0, delay: 0.06 },
];

export const ShareAppButton: React.FC<ShareAppButtonProps> = ({
  shareUrl,
  shareTitle,
  shareText,
  label,
  sharedLabel,
  copiedLabel,
  onResult,
  className = '',
}) => {
  const { t } = useI18n();
  const prefersReduced = useReducedMotion();
  const [phase, setPhase] = useState<'idle' | 'launching' | 'shared' | 'copied'>('idle');
  const [burstTick, setBurstTick] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const handlePress = async () => {
    if (phase === 'launching') return;
    tactileAudio.playWhoosh(true);
    setPhase('launching');

    let outcome: 'shared' | 'copied' | 'cancelled' = 'copied';
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        outcome = 'shared';
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') {
          setPhase('idle');
          onResult?.('cancelled');
          return;
        }
        await copyToClipboardSafe(shareUrl);
        outcome = 'copied';
      }
    } else {
      await copyToClipboardSafe(shareUrl);
      outcome = 'copied';
    }

    tactileAudio.playChime();
    setBurstTick((n) => n + 1);
    setPhase(outcome === 'shared' ? 'shared' : 'copied');
    onResult?.(outcome);

    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setPhase('idle'), 1800);
  };

  const isDone = phase === 'shared' || phase === 'copied';
  const displayLabel =
    phase === 'shared'
      ? sharedLabel || t('已分享', '已分享', 'Shared')
      : phase === 'copied'
        ? copiedLabel || t('已複製連結', '已复制链接', 'Link Copied')
        : label;

  return (
    <motion.button
      type="button"
      whileHover={prefersReduced ? undefined : { scale: 1.02 }}
      whileTap={{ scale: 0.95 }}
      disabled={phase === 'launching'}
      onClick={handlePress}
      style={
        isDone
          ? undefined
          : {
              background:
                'linear-gradient(135deg, var(--tab-accent, #7C3AED), var(--tab-accent-hover, #8B5CF6))',
            }
      }
      className={`relative overflow-visible min-h-[44px] px-4 py-2 rounded-full font-semibold text-xs sm:text-sm text-white inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors duration-200 cursor-pointer shrink-0 shadow-[0_12px_24px_-10px_var(--tab-accent)] ${
        isDone ? 'bg-emerald-500 shadow-emerald-500/30' : ''
      } ${className}`}
    >
      {burstTick > 0 && !prefersReduced && (
        <span key={burstTick} aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {SHARE_BURST_OFFSETS.map((dot, idx) => (
            <motion.span
              key={idx}
              initial={{ scale: 0.4, x: 0, y: 0, opacity: 0.95 }}
              animate={{ scale: 1, x: dot.x, y: dot.y, opacity: 0 }}
              transition={{ duration: 0.55, delay: dot.delay, ease: [0.16, 1, 0.3, 1] }}
              className="w-1.5 h-1.5 rounded-full bg-emerald-300"
            />
          ))}
        </span>
      )}

      <motion.span
        animate={
          phase === 'launching' && !prefersReduced
            ? { x: [0, 18], y: [0, -14], rotate: [0, 18], opacity: [1, 0] }
            : { x: 0, y: 0, rotate: 0, opacity: 1 }
        }
        transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
        className="shrink-0 flex items-center justify-center"
      >
        {isDone ? (
          <CheckIcon className="w-4 h-4" />
        ) : (
          <PaperAirplaneIcon className="w-4 h-4" />
        )}
      </motion.span>
      <span className="whitespace-nowrap">{displayLabel}</span>
    </motion.button>
  );
};

/* -------------------------------------------------------------------------- */
/* 11. DayNightOrbButton — 180° rotating cosmic/daylight theme orb            */
/* -------------------------------------------------------------------------- */
interface DayNightOrbButtonProps {
  mode: 'system' | 'light' | 'dark';
  isDark: boolean;
  onClick: () => void;
  ariaLabel: string;
  title?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const DayNightOrbButton: React.FC<DayNightOrbButtonProps> = ({
  mode,
  isDark,
  onClick,
  ariaLabel,
  title,
  size = 'md',
  className = '',
}) => {
  const prefersReduced = useReducedMotion();
  const dim = size === 'sm' ? 'w-10 h-10' : 'w-11 h-11';

  return (
    <motion.button
      type="button"
      onClick={() => {
        tactileAudio.playPop(isDark ? 1.25 : 0.85);
        onClick();
      }}
      whileHover={prefersReduced ? undefined : { scale: 1.05 }}
      whileTap={{ scale: 0.92 }}
      aria-label={ariaLabel}
      title={title}
      className={`relative ${dim} rounded-full flex items-center justify-center cursor-pointer transition-colors duration-300 border select-none shrink-0 ${
        isDark
          ? 'bg-[#17163B] border-indigo-400/35 shadow-[0_6px_18px_-4px_rgba(99,102,241,0.45),inset_0_1px_1px_rgba(255,255,255,0.16)]'
          : 'bg-gradient-to-br from-[#F0F7FF] to-[#DBEAFE] border-sky-400/45 shadow-[0_6px_16px_-4px_rgba(37,99,235,0.28),inset_0_1px_1px_rgba(255,255,255,0.9)]'
      } ${className}`}
    >
      <motion.span
        aria-hidden="true"
        animate={prefersReduced ? undefined : { rotate: isDark ? 180 : 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className="w-5 h-5 flex items-center justify-center"
      >
        {isDark ? (
          <svg viewBox="0 0 24 24" className="w-5 h-5 drop-shadow-[0_0_6px_rgba(253,224,71,0.65)]" style={{ transform: 'rotate(180deg)' }}>
            <defs>
              <linearGradient id="waynote-moon-orb" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FEF08A" />
                <stop offset="100%" stopColor="#F59E0B" />
              </linearGradient>
            </defs>
            <path
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
              fill="url(#waynote-moon-orb)"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="w-5 h-5 drop-shadow-[0_0_6px_rgba(245,158,11,0.45)]">
            <defs>
              <radialGradient id="waynote-sun-orb" cx="42%" cy="38%" r="60%">
                <stop offset="0%" stopColor="#FEF08A" />
                <stop offset="55%" stopColor="#FBBF24" />
                <stop offset="100%" stopColor="#F97316" />
              </radialGradient>
            </defs>
            <circle cx="12" cy="12" r="5.2" fill="url(#waynote-sun-orb)" />
            <g stroke="#F59E0B" strokeWidth="1.9" strokeLinecap="round">
              <line x1="12" y1="2.2" x2="12" y2="4.1" />
              <line x1="12" y1="19.9" x2="12" y2="21.8" />
              <line x1="2.2" y1="12" x2="4.1" y2="12" />
              <line x1="19.9" y1="12" x2="21.8" y2="12" />
              <line x1="5.07" y1="5.07" x2="6.42" y2="6.42" />
              <line x1="17.58" y1="17.58" x2="18.93" y2="18.93" />
              <line x1="18.93" y1="5.07" x2="17.58" y2="6.42" />
              <line x1="6.42" y1="17.58" x2="5.07" y2="18.93" />
            </g>
          </svg>
        )}
      </motion.span>

      {mode === 'system' && (
        <span
          aria-hidden="true"
          className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full text-[8px] font-bold flex items-center justify-center border ${
            isDark
              ? 'bg-indigo-500 text-white border-[#080D1B]'
              : 'bg-[#2563EB] text-white border-white'
          }`}
        >
          A
        </span>
      )}
    </motion.button>
  );
};

/* -------------------------------------------------------------------------- */
/* 12. MovingBorderBeamButton — Rotating conic-gradient laser border CTA      */
/* -------------------------------------------------------------------------- */
interface MovingBorderBeamButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  beamFrom?: string;
  beamTo?: string;
  className?: string;
  innerClassName?: string;
}

export const MovingBorderBeamButton: React.FC<MovingBorderBeamButtonProps> = ({
  children,
  onClick,
  type = 'button',
  disabled = false,
  beamFrom,
  beamTo,
  className = '',
  innerClassName = '',
}) => {
  const prefersReduced = useReducedMotion();
  const c1 = beamFrom || '#2563EB';
  const c2 = beamTo || '#38BDF8';
  const gradId = useId();
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [boxSize, setBoxSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = btnRef.current;
    if (!el) return;
    const measure = () => {
      const w = Math.round(el.offsetWidth);
      const h = Math.round(el.offsetHeight);
      if (w > 0 && h > 0) {
        setBoxSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
      }
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const strokeInset = 1.25;
  const rectW = Math.max(8, boxSize.w - strokeInset * 2);
  const rectH = Math.max(8, boxSize.h - strokeInset * 2);
  const rx = rectH / 2;

  return (
    <motion.button
      ref={btnRef}
      type={type}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        tactileAudio.playWhoosh(true);
        onClick?.();
      }}
      whileHover={disabled || prefersReduced ? undefined : { scale: 1.012 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      className={`relative rounded-full inline-flex items-center justify-center min-h-[46px] p-[1.75px] cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed shadow-[0_12px_28px_-10px_rgba(37,99,235,0.42)] dark:shadow-[0_14px_32px_-10px_rgba(0,0,0,0.75)] group ${className}`}
    >
      {/* Subtle Ambient Rim */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-full border border-zinc-300/70 dark:border-white/15"
      />
      {/* Inner Capsule Core */}
      <span
        className={`relative z-10 w-full h-full min-h-[42.5px] px-5 py-2.5 rounded-full bg-white/95 dark:bg-[#10192D] text-zinc-900 dark:text-white font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-2 transition-colors group-hover:bg-white dark:group-hover:bg-[#142038] ${innerClassName}`}
      >
        {children}
      </span>
      {/* Continuous True-Perimeter SVG Beam (Zero Clipping / Flicker at Any Width) */}
      {boxSize.w > 0 && boxSize.h > 0 && !prefersReduced && (
        <svg
          aria-hidden="true"
          viewBox={`0 0 ${boxSize.w} ${boxSize.h}`}
          className="pointer-events-none absolute inset-0 w-full h-full overflow-visible z-20"
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={c1} />
              <stop offset="50%" stopColor={c2} />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.95" />
            </linearGradient>
          </defs>
          <rect
            x={strokeInset}
            y={strokeInset}
            width={rectW}
            height={rectH}
            rx={rx}
            ry={rx}
            fill="none"
            stroke={c2}
            strokeWidth={4}
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray="24 76"
            opacity={0.32}
            className="beam-perimeter-track"
          />
          <rect
            x={strokeInset}
            y={strokeInset}
            width={rectW}
            height={rectH}
            rx={rx}
            ry={rx}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={2}
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray="24 76"
            className="beam-perimeter-track"
          />
        </svg>
      )}
    </motion.button>
  );
};

/* -------------------------------------------------------------------------- */
/* 13. NeonOutlineButton — Glowing luminous outline button                    */
/* -------------------------------------------------------------------------- */
interface NeonOutlineButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  tone?: 'accent' | 'sky' | 'rose' | 'emerald';
  size?: 'sm' | 'md';
  className?: string;
}

export const NeonOutlineButton: React.FC<NeonOutlineButtonProps> = ({
  children,
  onClick,
  type = 'button',
  disabled = false,
  tone = 'accent',
  size = 'md',
  className = '',
}) => {
  const prefersReduced = useReducedMotion();
  const [lit, setLit] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const toneClasses: Record<'accent' | 'sky' | 'rose' | 'emerald', string> = {
    accent:
      'border-[var(--tab-accent)] text-[var(--tab-accent)] bg-[var(--tab-accent-soft)] shadow-[0_0_14px_-4px_var(--tab-accent)] hover:bg-[var(--tab-accent)] hover:text-white',
    sky:
      'border-sky-500/80 dark:border-sky-400/85 text-sky-700 dark:text-sky-300 bg-sky-500/10 dark:bg-sky-500/12 shadow-[0_0_14px_-3px_rgba(56,189,248,0.45)] hover:bg-sky-500 hover:text-white dark:hover:bg-sky-400 dark:hover:text-slate-950',
    rose:
      'border-rose-500/85 dark:border-orange-400/85 text-rose-600 dark:text-orange-300 bg-rose-500/10 dark:bg-orange-500/12 shadow-[0_0_14px_-3px_rgba(244,63,94,0.42)] hover:bg-gradient-to-r hover:from-[#E11D48] hover:to-[#F97316] hover:text-white hover:border-transparent',
    emerald:
      'border-emerald-500/85 dark:border-emerald-400/85 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 dark:bg-emerald-500/12 shadow-[0_0_14px_-3px_rgba(16,185,129,0.42)] hover:bg-emerald-500 hover:text-white dark:hover:bg-emerald-400 dark:hover:text-slate-950',
  };

  const sizeClass =
    size === 'sm'
      ? 'min-h-[38px] px-3.5 text-xs'
      : 'min-h-[44px] px-4.5 text-xs sm:text-sm';

  return (
    <motion.button
      type={type}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        tactileAudio.playZap();
        setLit(true);
        if (timerRef.current !== null) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => setLit(false), 320);
        onClick?.();
      }}
      whileHover={disabled || prefersReduced ? undefined : { scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.95 }}
      className={`rounded-full border-[1.5px] font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-all duration-200 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${sizeClass} ${toneClasses[tone]} ${
        lit ? 'brightness-110 ring-2 ring-current/25' : ''
      } ${className}`}
    >
      {children}
    </motion.button>
  );
};

/* -------------------------------------------------------------------------- */
/* 14. SplitFlapBoard — Airport 3D split-flap interactive display             */
/* -------------------------------------------------------------------------- */
interface SplitFlapBoardProps {
  words: string[];
  size?: 'sm' | 'md';
  padLength?: number;
  ariaLabel?: string;
  onWordChange?: (word: string, index: number) => void;
  className?: string;
}

export const SplitFlapBoard: React.FC<SplitFlapBoardProps> = ({
  words,
  size = 'md',
  padLength,
  ariaLabel,
  onWordChange,
  className = '',
}) => {
  const prefersReduced = useReducedMotion();
  const safeWords = words.length > 0 ? words.map((w) => w.toUpperCase()) : ['GATE'];
  const maxLen = padLength || Math.max(3, ...safeWords.map((w) => w.length));
  const [wordIdx, setWordIdx] = useState(0);
  const [displayChars, setDisplayChars] = useState<string[]>(() =>
    safeWords[0].padEnd(maxLen, ' ').slice(0, maxLen).split('')
  );
  const [flippingSlots, setFlippingSlots] = useState<boolean[]>(() =>
    Array.from({ length: maxLen }, () => false)
  );
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    setWordIdx(0);
    setDisplayChars(safeWords[0].padEnd(maxLen, ' ').slice(0, maxLen).split(''));
    setFlippingSlots(Array.from({ length: maxLen }, () => false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words.join('|'), maxLen]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
    };
  }, []);

  const triggerFlip = (nextIndex: number) => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];

    const nextWord = safeWords[nextIndex].padEnd(maxLen, ' ').slice(0, maxLen);
    if (prefersReduced) {
      setDisplayChars(nextWord.split(''));
      onWordChange?.(safeWords[nextIndex], nextIndex);
      return;
    }

    nextWord.split('').forEach((ch, idx) => {
      const startTimer = window.setTimeout(() => {
        tactileAudio.playTick(0.95 + idx * 0.08);
        setFlippingSlots((prev) => prev.map((v, i) => (i === idx ? true : v)));
        const swapTimer = window.setTimeout(() => {
          setDisplayChars((prev) => prev.map((c, i) => (i === idx ? ch : c)));
          setFlippingSlots((prev) => prev.map((v, i) => (i === idx ? false : v)));
        }, 105);
        timersRef.current.push(swapTimer);
      }, idx * 45);
      timersRef.current.push(startTimer);
    });

    onWordChange?.(safeWords[nextIndex], nextIndex);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextIndex = (wordIdx + 1) % safeWords.length;
    setWordIdx(nextIndex);
    triggerFlip(nextIndex);
  };

  const tileDim =
    size === 'sm'
      ? 'w-[22px] h-[28px] text-[12px]'
      : 'w-[28px] h-[36px] text-[15px]';

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={ariaLabel || safeWords[wordIdx]}
      className={`split-flap-stage inline-flex items-center gap-1 p-1.5 rounded-xl bg-[#0D0E12] border border-white/14 shadow-[0_6px_16px_-4px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.08)] cursor-pointer active:scale-[0.97] transition-transform select-none shrink-0 ${
        size === 'sm' ? 'min-h-[40px]' : 'min-h-[48px]'
      } ${className}`}
    >
      {displayChars.map((ch, idx) => (
        <span
          key={idx}
          className={`split-flap-tile ${tileDim} ${flippingSlots[idx] ? 'is-flipping' : ''}`}
        >
          {ch === ' ' ? '\u00A0' : ch}
        </span>
      ))}
    </button>
  );
};

/* -------------------------------------------------------------------------- */
/* 15. SwipeConfirmButton — Gallery #27 swipe-to-confirm physical safeguard   */
/* -------------------------------------------------------------------------- */
interface SwipeConfirmButtonProps {
  onConfirm: () => void;
  label: string;
  confirmedLabel?: string;
  disabled?: boolean;
  className?: string;
}

export const SwipeConfirmButton: React.FC<SwipeConfirmButtonProps> = ({
  onConfirm,
  label,
  confirmedLabel,
  disabled = false,
  className = '',
}) => {
  const { t } = useI18n();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const activePointerRef = useRef<number | null>(null);
  const startXRef = useRef<number>(0);
  const startProgressRef = useRef<number>(0);
  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;

  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [trackWidth, setTrackWidth] = useState(240);

  const thumbSize = 40;
  const padding = 4;
  const maxTravel = Math.max(40, trackWidth - thumbSize - padding * 2);

  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const measure = () => {
      if (el.offsetWidth > 0) setTrackWidth(el.offsetWidth);
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const finishDrag = useCallback(
    (finalProgress: number) => {
      setDragging(false);
      activePointerRef.current = null;
      if (finalProgress >= 0.85) {
        setProgress(1);
        setConfirmed(true);
        tactileAudio.playPing();
        window.setTimeout(() => {
          onConfirmRef.current();
        }, 200);
      } else {
        setProgress(0);
      }
    },
    []
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || confirmed) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    activePointerRef.current = e.pointerId;
    startXRef.current = e.clientX;
    startProgressRef.current = progress;
    setDragging(true);
    tactileAudio.playTick(0.92);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || activePointerRef.current !== e.pointerId || confirmed) return;
    const delta = e.clientX - startXRef.current;
    const next = Math.max(0, Math.min(1, startProgressRef.current + delta / maxTravel));
    setProgress(next);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || activePointerRef.current !== e.pointerId) return;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }
    finishDrag(progress);
  };

  const thumbX = padding + progress * maxTravel;
  const fillWidth = thumbX + thumbSize + padding;
  const resolvedConfirmed = confirmedLabel || t('已確認開啟', '已确认开启', 'Enabled');

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={(e) => {
        if (disabled || confirmed) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          finishDrag(1);
        }
      }}
      style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
      className={`relative h-[48px] w-full rounded-full overflow-hidden select-none touch-none flex items-center justify-center border transition-colors cursor-grab active:cursor-grabbing ${
        confirmed
          ? 'bg-emerald-500/18 border-emerald-500/50 text-emerald-700 dark:text-emerald-300'
          : 'bg-zinc-100/95 dark:bg-zinc-900/90 border-zinc-300/80 dark:border-white/15 text-zinc-600 dark:text-zinc-300'
      } ${disabled ? 'opacity-45 cursor-not-allowed' : ''} ${className}`}
    >
      {/* Progressive Fill Behind Thumb */}
      <span
        aria-hidden="true"
        style={{
          width: `${Math.min(trackWidth, fillWidth)}px`,
          transition: dragging ? 'none' : 'width 260ms cubic-bezier(0.34, 1.35, 0.64, 1)',
        }}
        className={`absolute left-0 top-0 bottom-0 rounded-full pointer-events-none ${
          confirmed
            ? 'bg-emerald-500/20'
            : 'bg-gradient-to-r from-[#2563EB]/16 to-[#0EA5E9]/26'
        }`}
      />

      {/* Label */}
      <span
        style={{ opacity: confirmed ? 1 : Math.max(0.18, 1 - progress * 1.25) }}
        className="relative z-10 text-xs sm:text-sm font-semibold pointer-events-none pl-7 pr-3 transition-opacity truncate"
      >
        {confirmed ? resolvedConfirmed : label}
      </span>

      {/* Draggable Capsule Thumb */}
      <div
        style={{
          transform: `translate3d(${thumbX}px, 0, 0)`,
          transition: dragging ? 'none' : 'transform 260ms cubic-bezier(0.34, 1.35, 0.64, 1)',
        }}
        className={`absolute left-0 top-[3.5px] w-10 h-10 rounded-full flex items-center justify-center shadow-md pointer-events-none z-20 transition-colors ${
          confirmed
            ? 'bg-emerald-500 text-white'
            : 'bg-gradient-to-br from-[#2563EB] to-[#0EA5E9] text-white'
        }`}
      >
        {confirmed ? (
          <CheckIcon className="w-4 h-4" />
        ) : (
          <ChevronRightIcon className="w-4 h-4" />
        )}
      </div>
    </div>
  );
};


