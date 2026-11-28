const AI_ENABLED_STORAGE_KEY = 'waynote_ai_enabled';

let aiEnabledCache: boolean | null = null;
const aiListeners = new Set<(enabled: boolean) => void>();

function readStoredAiPreference(): boolean {
  if (aiEnabledCache !== null) return aiEnabledCache;
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(AI_ENABLED_STORAGE_KEY);
    aiEnabledCache = raw === null ? true : raw !== 'false';
  } catch {
    aiEnabledCache = true;
  }
  return aiEnabledCache;
}

export function getAiEnabled(): boolean {
  return readStoredAiPreference();
}

export function setAiEnabled(next: boolean): void {
  aiEnabledCache = next;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(AI_ENABLED_STORAGE_KEY, next ? 'true' : 'false');
    } catch {
      // ignore storage failure in private browsing
    }
  }
  for (const listener of aiListeners) {
    listener(next);
  }
}

export function subscribeAiEnabled(listener: (enabled: boolean) => void): () => void {
  aiListeners.add(listener);
  return () => {
    aiListeners.delete(listener);
  };
}
