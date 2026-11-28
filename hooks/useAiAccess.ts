import { useCallback, useEffect, useState } from 'react';
import { getAiEnabled, setAiEnabled, subscribeAiEnabled } from '../services/aiGuard';
import { tactileAudio } from '../services/tactileAudio';

export function useAiAccess() {
  const [aiEnabled, setAiEnabledState] = useState<boolean>(() => getAiEnabled());

  useEffect(() => {
    return subscribeAiEnabled((next) => {
      setAiEnabledState(next);
    });
  }, []);

  const updateAiEnabled = useCallback((next: boolean) => {
    setAiEnabled(next);
    if (next) {
      tactileAudio.playPing();
    } else {
      tactileAudio.playTick(0.85);
    }
  }, []);

  return { aiEnabled, setAiEnabled: updateAiEnabled };
}
