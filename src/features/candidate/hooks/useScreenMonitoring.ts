import { useEffect, useRef, useCallback } from 'react';
import { MalpracticeType } from '../../../types';

interface UseScreenMonitoringOptions {
  enabled: boolean;
  onViolation: (type: MalpracticeType) => void;
}

export function useScreenMonitoring({ enabled, onViolation }: UseScreenMonitoringOptions) {
  const screenStreamRef = useRef<MediaStream | null>(null);
  const isFullscreen = useRef(false);
  const lastViolationRef = useRef<number>(0);
  const COOLDOWN_MS = 10000;

  const flag = useCallback((type: MalpracticeType) => {
    const now = performance.now();
    if (now - lastViolationRef.current > COOLDOWN_MS) {
      lastViolationRef.current = now;
      onViolation(type);
    }
  }, [onViolation]);

  // Fullscreen enforcement
  useEffect(() => {
    if (!enabled) return;
    let screenfull: any;

    const init = async () => {
      try {
        screenfull = (await import('screenfull')).default;
        if (!screenfull.isEnabled) return;

        const handleChange = () => {
          const nowFull = screenfull.isFullscreen;
          if (isFullscreen.current && !nowFull) {
            flag('fullscreen_exit');
          }
          isFullscreen.current = nowFull;
        };

        screenfull.on('change', handleChange);
        await screenfull.request(document.documentElement);
        isFullscreen.current = screenfull.isFullscreen;

        return () => screenfull.off('change', handleChange);
      } catch { /* screenfull unavailable or denied */ }
    };

    const cleanup = init();
    return () => { cleanup.then(fn => fn?.()); };
  }, [enabled, flag]);

  // Screen share capture for LiveKit (separate from fullscreen)
  const startScreenShare = useCallback(async (): Promise<MediaStream | null> => {
    if (!enabled) return null;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true, audio: false,
      });
      screenStreamRef.current = stream;
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        flag('screen_share_stop');
        screenStreamRef.current = null;
      });
      return stream;
    } catch { return null; }
  }, [enabled, flag]);

  const stopScreenShare = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
  }, []);

  useEffect(() => {
    return () => stopScreenShare();
  }, [stopScreenShare]);

  return { startScreenShare, stopScreenShare, screenStream: screenStreamRef };
}
