import { useCallback, useEffect, useState } from 'react';
import {
  getTactileSoundEnabled,
  playBoing,
  setTactileSoundEnabled,
  subscribeTactileSound,
} from '../services/tactileAudio';

export function useTactileSound() {
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(() => getTactileSoundEnabled());

  useEffect(() => {
    return subscribeTactileSound((next) => {
      setSoundEnabledState(next);
    });
  }, []);

  const setSoundEnabled = useCallback((next: boolean) => {
    setTactileSoundEnabled(next);
    if (next) {
      playBoing(1.12);
    }
  }, []);

  const toggleSound = useCallback(() => {
    const next = !getTactileSoundEnabled();
    setTactileSoundEnabled(next);
    if (next) {
      playBoing(1.12);
    }
  }, []);

  return { soundEnabled, setSoundEnabled, toggleSound };
}
