import { useEffect, useRef, useCallback } from 'react';
import { MalpracticeType } from '../../../types';

interface UseDevtoolsMonitoringOptions {
  enabled: boolean;
  onViolation: (type: MalpracticeType) => void;
}

export function useDevtoolsMonitoring({ enabled, onViolation }: UseDevtoolsMonitoringOptions) {
  const lastFlagTime = useRef<number>(0);
  const COOLDOWN_MS = 30000; // 30s between flags

  const flag = useCallback(() => {
    const now = performance.now();
    if (now - lastFlagTime.current > COOLDOWN_MS) {
      lastFlagTime.current = now;
      onViolation('devtools_open');
    }
  }, [onViolation]);

  useEffect(() => {
    if (!enabled) return;

    let devtools: any;
    let cleanup: (() => void) | undefined;

    const init = async () => {
      try {
        devtools = (await import('devtools-detect')).default;
        const handler = () => {
          if (devtools.isOpen) flag();
        };
        window.addEventListener(devtools.eventName, handler);
        cleanup = () => window.removeEventListener(devtools.eventName, handler);
      } catch {
        // devtools-detect not available — fallback: size-based heuristic
        const sizeHandler = () => {
          const threshold = 160;
          const widthDiff = window.outerWidth - window.innerWidth;
          const heightDiff = window.outerHeight - window.innerHeight;
          if (widthDiff > threshold || heightDiff > threshold) flag();
        };
        window.addEventListener('resize', sizeHandler);
        cleanup = () => window.removeEventListener('resize', sizeHandler);
      }
    };

    init();
    return () => cleanup?.();
  }, [enabled, flag]);
}
