const SOUND_STORAGE_KEY = 'waynote_sound_enabled';

let audioCtx: AudioContext | null = null;
let soundEnabledCache: boolean | null = null;
const soundListeners = new Set<(enabled: boolean) => void>();

function readStoredSoundPreference(): boolean {
  if (soundEnabledCache !== null) return soundEnabledCache;
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(SOUND_STORAGE_KEY);
    soundEnabledCache = raw === null ? true : raw !== 'false';
  } catch {
    soundEnabledCache = true;
  }
  return soundEnabledCache;
}

export function getTactileSoundEnabled(): boolean {
  return readStoredSoundPreference();
}

export function setTactileSoundEnabled(next: boolean): void {
  soundEnabledCache = next;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(SOUND_STORAGE_KEY, next ? 'true' : 'false');
    } catch {
      // ignore storage failure in private browsing
    }
  }
  for (const listener of soundListeners) {
    listener(next);
  }
}

export function subscribeTactileSound(listener: (enabled: boolean) => void): () => void {
  soundListeners.add(listener);
  return () => {
    soundListeners.delete(listener);
  };
}

function getCtx(): AudioContext | null {
  if (!getTactileSoundEnabled() || typeof window === 'undefined') return null;
  try {
    if (!audioCtx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') {
      void audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

function playNoiseBurst(
  ctx: AudioContext,
  dur: number,
  freq: number,
  q: number,
  vol: number,
  offset = 0
): void {
  const len = Math.max(64, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.8);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(freq, ctx.currentTime + offset);
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, ctx.currentTime + offset);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + dur);
  src.connect(f);
  f.connect(g);
  g.connect(ctx.destination);
  src.start(ctx.currentTime + offset);
}

export function playClick(freq = 520, dur = 0.045, type: OscillatorType = 'sine'): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.62), now + dur);
    gain.gain.setValueAtTime(0.065, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur);
  } catch {
    // silent fallback
  }
}

export function playKey(high = true): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    playNoiseBurst(ctx, 0.012, high ? 2800 : 2100, 1.8, 0.08);
    const osc = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const g = ctx.createGain();
    osc.type = 'triangle';
    lp.type = 'lowpass';
    lp.frequency.value = 950;
    osc.frequency.setValueAtTime(high ? 290 : 225, now);
    osc.frequency.exponentialRampToValueAtTime(78, now + 0.042);
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.048);
    osc.connect(lp);
    lp.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.052);
  } catch {
    // silent fallback
  }
}

export function playRocker(on: boolean): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    playNoiseBurst(ctx, 0.01, on ? 2400 : 1800, 2.2, 0.07, 0);
    playNoiseBurst(ctx, 0.012, on ? 3200 : 1400, 2.0, 0.08, 0.02);
    [0, 0.02].forEach((off, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      const f0 = on ? (idx === 0 ? 210 : 460) : idx === 0 ? 380 : 190;
      osc.frequency.setValueAtTime(f0, now + off);
      osc.frequency.exponentialRampToValueAtTime(110, now + off + 0.022);
      g.gain.setValueAtTime(0.08, now + off);
      g.gain.exponentialRampToValueAtTime(0.001, now + off + 0.026);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now + off);
      osc.stop(now + off + 0.028);
    });
  } catch {
    // silent fallback
  }
}

export function playPop(pitch = 1): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(880 * pitch, now + 0.058);
    g.gain.setValueAtTime(0.085, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.072);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.076);
  } catch {
    // silent fallback
  }
}

export function playWhoosh(up = true): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * 0.17);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const env = Math.sin((i / len) * Math.PI);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.9;
    filter.frequency.setValueAtTime(up ? 420 : 1650, now);
    filter.frequency.exponentialRampToValueAtTime(up ? 1950 : 390, now + 0.16);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.095, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    src.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    src.start(now);
  } catch {
    // silent fallback
  }
}

export function playChime(): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    [659.25, 987.77].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.07);
      g.gain.setValueAtTime(0.07, now + i * 0.07);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.24);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now + i * 0.07);
      osc.stop(now + i * 0.07 + 0.26);
    });
  } catch {
    // silent fallback
  }
}

export function playFanfare(): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.052);
      g.gain.setValueAtTime(0.065, now + i * 0.052);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.052 + 0.22);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now + i * 0.052);
      osc.stop(now + i * 0.052 + 0.24);
    });
  } catch {
    // silent fallback
  }
}

export function playTick(pitch = 1): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    playNoiseBurst(ctx, 0.007, 3600 * pitch, 3.0, 0.05);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1250 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(420 * pitch, now + 0.014);
    g.gain.setValueAtTime(0.05, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.016);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.018);
  } catch {
    // silent fallback
  }
}

export function playBoing(pitch = 1): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(510 * pitch, now + 0.065);
    osc.frequency.exponentialRampToValueAtTime(320 * pitch, now + 0.145);
    g.gain.setValueAtTime(0.08, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);
  } catch {
    // silent fallback
  }
}

export function playLiquid(up = true): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(up ? 290 : 580, now);
    osc.frequency.exponentialRampToValueAtTime(up ? 720 : 280, now + 0.095);
    g.gain.setValueAtTime(0.085, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  } catch {
    // silent fallback
  }
}

export function playWarn(): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    [0, 0.075].forEach((off, idx) => {
      const osc = ctx.createOscillator();
      const lp = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = 'triangle';
      lp.type = 'lowpass';
      lp.frequency.value = 380;
      osc.frequency.setValueAtTime(idx === 0 ? 185 : 145, now + off);
      osc.frequency.exponentialRampToValueAtTime(95, now + off + 0.065);
      g.gain.setValueAtTime(0.1, now + off);
      g.gain.exponentialRampToValueAtTime(0.001, now + off + 0.07);
      osc.connect(lp);
      lp.connect(g);
      g.connect(ctx.destination);
      osc.start(now + off);
      osc.stop(now + off + 0.075);
    });
  } catch {
    // silent fallback
  }
}

export function playZap(): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    [0, 0.045, 0.09].forEach((t, i) => {
      playNoiseBurst(ctx, 0.018, 4200 - i * 600, 4.0, 0.05, t);
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(980 - i * 180, now + t);
      g.gain.setValueAtTime(0.032, now + t);
      g.gain.exponentialRampToValueAtTime(0.001, now + t + 0.024);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now + t);
      osc.stop(now + t + 0.026);
    });
  } catch {
    // silent fallback
  }
}

export function playPing(): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1174.66, now);
    g.gain.setValueAtTime(0.06, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.28);
  } catch {
    // silent fallback
  }
}

export function playBell(): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    [1396.9, 2093.0, 2793.8].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      g.gain.setValueAtTime(i === 0 ? 0.065 : 0.025 / i, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.34 - i * 0.06);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.36);
    });
  } catch {
    // silent fallback
  }
}

export function playStamp(): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    playNoiseBurst(ctx, 0.018, 900, 1.2, 0.085);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(175, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.085);
    g.gain.setValueAtTime(0.16, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  } catch {
    // silent fallback
  }
}

export const tactileAudio = {
  playClick,
  playKey,
  playRocker,
  playPop,
  playWhoosh,
  playChime,
  playFanfare,
  playTick,
  playBoing,
  playLiquid,
  playWarn,
  playZap,
  playPing,
  playBell,
  playStamp,
};
