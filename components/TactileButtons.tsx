import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowDownTrayIcon,
  ArrowsRightLeftIcon,
  BookmarkIcon,
  CheckIcon,
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
  durationMs = 780,
  tone = 'danger',
  icon,
  disabled = false,
  className = '',
}) => {
  const { t } = useI18n();
  const prefersReduced = useReducedMotion();
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const triggeredRef = useRef(false);

  const stopHold = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setHolding(false);
    if (!triggeredRef.current) {
      setProgress(0);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const startHold = () => {
    if (disabled || holding) return;
    triggeredRef.current = false;
    setHolding(true);
    tactileAudio.playTick(0.85);
    const effectiveDuration = prefersReduced ? 350 : durationMs;
    startRef.current = performance.now();

    const step = (now: number) => {
      const next = Math.min(1, (now - startRef.current) / effectiveDuration);
      setProgress(next);
      if (next < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        triggeredRef.current = true;
        setHolding(false);
        setProgress(0);
        tactileAudio.playWarn();
        onConfirm();
      }
    };
    rafRef.current = requestAnimationFrame(step);
  };

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
      ? 'bg-red-600/85 dark:bg-red-500/80'
      : 'bg-[var(--tab-accent)]/80';

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={(e) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        startHold();
      }}
      onPointerUp={stopHold}
      onPointerLeave={stopHold}
      onPointerCancel={stopHold}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      aria-label={`${label} (${resolvedHint})`}
      className={`relative overflow-hidden min-h-[46px] px-4 rounded-full font-semibold text-sm flex items-center justify-center gap-1.5 select-none touch-none transition-transform active:scale-[0.98] cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${baseToneClass} ${className}`}
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
          progress > 0.45 ? 'text-white' : ''
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
/* 9. DownloadProgressButton — Live SVG progress arc -> completion check      */
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
      setPhase('done');
      resetTimerRef.current = window.setTimeout(() => setPhase('idle'), 1600);
      return;
    }

    setPhase('loading');
    setProgress(0);
    const start = performance.now();
    const duration = 680;
    const downloadPromise = Promise.resolve(onDownload());

    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setProgress(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        void downloadPromise.finally(() => {
          tactileAudio.playChime();
          setPhase('done');
          resetTimerRef.current = window.setTimeout(() => {
            setPhase('idle');
            setProgress(0);
          }, 1700);
        });
      }
    };
    rafRef.current = requestAnimationFrame(step);
  };

  const r = 7;
  const circ = 2 * Math.PI * r;
  const resolvedDone = doneLabel || t('已儲存', '已保存', 'Saved');

  const toneClass =
    phase === 'done'
      ? 'bg-emerald-500/15 dark:bg-emerald-500/20 border-emerald-500/50 text-emerald-700 dark:text-emerald-300'
      : variant === 'accent'
        ? 'text-white border-transparent shadow-[0_10px_24px_-8px_var(--tab-accent)]'
        : 'bg-zinc-100/90 dark:bg-white/[0.08] border-zinc-200/80 dark:border-white/12 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-200/80 dark:hover:bg-white/14';

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.96 }}
      disabled={disabled || phase === 'loading'}
      onClick={handleClick}
      style={
        phase !== 'done' && variant === 'accent'
          ? {
              background:
                'linear-gradient(135deg, var(--tab-accent, #2563EB), var(--tab-accent-hover, #1D4ED8))',
            }
          : undefined
      }
      className={`min-h-[44px] px-4 py-2 rounded-2xl border font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${toneClass} ${className}`}
    >
      <span className="shrink-0 flex items-center justify-center w-4 h-4">
        {phase === 'loading' ? (
          <svg viewBox="0 0 20 20" className="w-4 h-4 -rotate-90">
            <circle
              cx="10"
              cy="10"
              r={r}
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.22"
              strokeWidth="2.2"
            />
            <circle
              cx="10"
              cy="10"
              r={r}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - progress)}
            />
          </svg>
        ) : phase === 'done' ? (
          <CheckIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-300" />
        ) : (
          icon || <ArrowDownTrayIcon className="w-4 h-4" />
        )}
      </span>
      <span className="whitespace-nowrap">
        {phase === 'loading'
          ? `${Math.round(progress * 100)}%`
          : phase === 'done'
            ? resolvedDone
            : label}
      </span>
    </motion.button>
  );
};
