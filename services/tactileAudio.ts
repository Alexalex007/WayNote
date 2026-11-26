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
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(high ? 320 : 240, now);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.045);
    g.gain.setValueAtTime(0.11, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.052);

    const osc2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(high ? 1450 : 1050, now);
    g2.gain.setValueAtTime(0.036, now);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.015);
    osc2.connect(g2);
    g2.connect(ctx.destination);
    osc2.start(now);
    osc2.stop(now + 0.018);
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
    osc.frequency.setValueAtTime(280 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(860 * pitch, now + 0.075);
    g.gain.setValueAtTime(0.08, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  } catch {
    // silent fallback
  }
}

export function playWhoosh(up = true): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * 0.16);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.6;
    filter.frequency.setValueAtTime(up ? 420 : 1500, now);
    filter.frequency.exponentialRampToValueAtTime(up ? 1900 : 380, now + 0.15);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.09, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
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
    [587.33, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.075);
      g.gain.setValueAtTime(0.07, now + i * 0.075);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.075 + 0.22);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now + i * 0.075);
      osc.stop(now + i * 0.075 + 0.24);
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
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1100 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(320 * pitch, now + 0.018);
    g.gain.setValueAtTime(0.052, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.022);
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
    osc.frequency.setValueAtTime(210 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(520 * pitch, now + 0.07);
    osc.frequency.exponentialRampToValueAtTime(310 * pitch, now + 0.15);
    g.gain.setValueAtTime(0.075, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
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
    osc.frequency.setValueAtTime(up ? 260 : 540, now);
    osc.frequency.exponentialRampToValueAtTime(up ? 640 : 250, now + 0.11);
    g.gain.setValueAtTime(0.08, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  } catch {
    // silent fallback
  }
}

export function playWarn(): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(155, now);
    osc.frequency.linearRampToValueAtTime(110, now + 0.14);
    g.gain.setValueAtTime(0.052, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);
  } catch {
    // silent fallback
  }
}

export function playBell(): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    [1318.5, 1975.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      g.gain.setValueAtTime(i === 0 ? 0.065 : 0.03, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.34);
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
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.08);
    g.gain.setValueAtTime(0.15, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
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
  playPop,
  playWhoosh,
  playChime,
  playTick,
  playBoing,
  playLiquid,
  playWarn,
  playBell,
  playStamp,
};
