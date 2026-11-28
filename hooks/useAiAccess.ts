import { useCallback, useEffect, useState } from 'react';
import {
  getAiEnabled,
  requestAiEnable as triggerAiEnableConfirm,
  setAiEnabled,
  subscribeAiEnabled,
} from '../services/aiGuard';
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

  const requestAiEnable = useCallback(() => {
    tactileAudio.playTick(0.95);
    triggerAiEnableConfirm();
  }, []);

  return { aiEnabled, setAiEnabled: updateAiEnabled, requestAiEnable };
}
