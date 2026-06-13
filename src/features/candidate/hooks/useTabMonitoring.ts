import { useEffect, useRef, MutableRefObject } from "react";

// Candidate must be away for longer than this before a violation fires.
// Covers accidental Alt-Tab, OS notifications, and the brief focus loss
// when a browser permission dialog (screen-share picker) opens.
const TAB_SWITCH_GRACE_MS = 1_000;

// Minimum gap between successive tab-switch violations in the same session.
const VIOLATION_LOCK_MS = 1_000;

interface UseTabMonitoringOptions {
  enabled: boolean;
  /**
   * Synchronous ref — tab events are silently ignored while false.
   * Populated by useExamOrchestrator; true only once the exam is ACTIVE
   * and the network is connected.
   */
  examActiveRef: MutableRefObject<boolean>;
  /**
   * Ref tracking whether a browser permission flow (e.g. getDisplayMedia picker)
   * is in progress. Focus changes caused by the native dialog are ignored.
   */
  isPermissionFlowActiveRef: MutableRefObject<boolean>;
  onViolation: (description: string) => void;
}

export function useTabMonitoring({
  enabled,
  examActiveRef,
  isPermissionFlowActiveRef,
  onViolation,
}: UseTabMonitoringOptions): void {
  const onViolationRef = useRef(onViolation);
  useEffect(() => {
    onViolationRef.current = onViolation;
  });

  // Holds the pending grace-period timeout. null = tab is currently visible.
  const tabSwitchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastViolationRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    // Start the 1-second grace-period timer when the tab leaves focus.
    // If the candidate returns before it fires, cancelTimeout() clears it.
    // If it fires, the absence exceeded the grace period → record violation.
    const startTimeout = () => {
      if (tabSwitchTimeoutRef.current !== null || isPermissionFlowActiveRef.current) return;
      tabSwitchTimeoutRef.current = setTimeout(() => {
        tabSwitchTimeoutRef.current = null;
        if (!examActiveRef.current || isPermissionFlowActiveRef.current) return;
        const now = performance.now();
        if (now - lastViolationRef.current <= VIOLATION_LOCK_MS) return;
        lastViolationRef.current = now;
        onViolationRef.current(
          "Candidate switched away from the assessment tab for more than 1 second"
        );
      }, TAB_SWITCH_GRACE_MS);
    };

    const cancelTimeout = () => {
      if (tabSwitchTimeoutRef.current !== null) {
        clearTimeout(tabSwitchTimeoutRef.current);
        tabSwitchTimeoutRef.current = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        startTimeout();
      } else {
        cancelTimeout();
      }
    };

    // blur/focus cover window-level focus loss without a full tab switch
    // (e.g. Alt-Tab to another app while the tab remains "visible").
    const handleBlur = () => startTimeout();
    const handleFocus = () => cancelTimeout();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      cancelTimeout();
    };
  }, [enabled, examActiveRef, isPermissionFlowActiveRef]);
}
