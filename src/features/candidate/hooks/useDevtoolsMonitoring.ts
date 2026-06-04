import { useEffect, useRef, useCallback } from "react";
import { MalpracticeType } from "../../../types";

const COOLDOWN_MS = 10_000;
const POLL_INTERVAL_MS = 1_500;
const SIZE_THRESHOLD = 160;

interface UseDevtoolsMonitoringOptions {
  enabled: boolean;
  onViolation: (type: MalpracticeType) => void;
}

function isSizeDevtoolsOpen(): boolean {
  return (
    window.outerWidth - window.innerWidth > SIZE_THRESHOLD ||
    window.outerHeight - window.innerHeight > SIZE_THRESHOLD
  );
}

export function useDevtoolsMonitoring({
  enabled,
  onViolation,
}: UseDevtoolsMonitoringOptions): void {
  const lastFlagTime = useRef<number>(0);
  const onViolationRef = useRef(onViolation);
  useEffect(() => {
    onViolationRef.current = onViolation;
  });

  const flag = useCallback(() => {
    const now = performance.now();
    if (now - lastFlagTime.current > COOLDOWN_MS) {
      lastFlagTime.current = now;
      onViolationRef.current("devtools_open");
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let eventCleanup: (() => void) | undefined;
    let pollHandle: ReturnType<typeof setInterval> | null = null;

    const init = async () => {
      if (isSizeDevtoolsOpen()) flag();

      pollHandle = setInterval(() => {
        if (isSizeDevtoolsOpen()) flag();
      }, POLL_INTERVAL_MS);

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const devtools = (await import("devtools-detect")).default as any;
        if (devtools.isOpen) flag();

        const handler = () => {
          if (devtools.isOpen) flag();
        };
        globalThis.addEventListener(devtools.eventName, handler);
        eventCleanup = () => globalThis.removeEventListener(devtools.eventName, handler);
      } catch {
        /* devtools-detect unavailable — polling covers detection */
      }
    };

    void init();

    return () => {
      if (pollHandle !== null) clearInterval(pollHandle);
      eventCleanup?.();
    };
  }, [enabled, flag]);
}
