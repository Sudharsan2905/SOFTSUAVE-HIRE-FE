import { useEffect, useRef, useCallback, MutableRefObject } from "react";
import { MalpracticeType } from "../../../types";

const COOLDOWN_MS = 10_000;
const SIZE_THRESHOLD = 160;

interface UseDevtoolsMonitoringOptions {
  enabled: boolean;
  /**
   * Synchronous ref — violations are suppressed while false.
   * Should be the examActiveRef from useExamOrchestrator so that devtools
   * opened during the setup/validation phase are never flagged as malpractice.
   */
  examActiveRef: MutableRefObject<boolean>;
  onViolation: (type: MalpracticeType, description: string) => void;
}

function isSizeDevtoolsOpen(): boolean {
  return (
    window.outerWidth - window.innerWidth > SIZE_THRESHOLD ||
    window.outerHeight - window.innerHeight > SIZE_THRESHOLD
  );
}

function getSizeDelta(): number {
  return Math.max(
    window.outerWidth - window.innerWidth,
    window.outerHeight - window.innerHeight
  );
}

export function useDevtoolsMonitoring({
  enabled,
  examActiveRef,
  onViolation,
}: UseDevtoolsMonitoringOptions): void {
  const lastFlagTime = useRef<number>(0);
  const onViolationRef = useRef(onViolation);
  useEffect(() => {
    onViolationRef.current = onViolation;
  });

  const flag = useCallback(() => {
    if (!examActiveRef.current) return;
    const now = performance.now();
    if (now - lastFlagTime.current > COOLDOWN_MS) {
      lastFlagTime.current = now;
      const delta = getSizeDelta();
      onViolationRef.current(
        "devtools_open",
        `Browser developer tools were opened (window size delta: ${delta}px)`
      );
    }
  }, [examActiveRef]);

  useEffect(() => {
    if (!enabled) return;

    let eventCleanup: (() => void) | undefined;

    // Resize event fires whenever devtools opens/closes (changes inner dimensions).
    // This is event-driven — no polling needed.
    const handleResize = () => {
      if (isSizeDevtoolsOpen()) flag();
    };
    window.addEventListener("resize", handleResize);

    const init = async () => {
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
        /* devtools-detect unavailable — resize handler covers detection */
      }
    };

    void init();

    return () => {
      window.removeEventListener("resize", handleResize);
      eventCleanup?.();
    };
  }, [enabled, flag]);
}
