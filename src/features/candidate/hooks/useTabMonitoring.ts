import { useEffect, useRef, MutableRefObject } from "react";

// Tab must be away longer than this before a violation is recorded.
// Covers legitimate flows: screen-share picker, browser permission dialogs,
// OS notifications that briefly steal focus.
const TAB_SWITCH_GRACE_MS = 7_000;

// Minimum time between successive tab-switch violations of the same session.
const VIOLATION_LOCK_MS = 2_000;

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

  // Timestamp (performance.now) when the tab was last hidden/blurred.
  // null means the tab is currently visible/focused.
  const tabLeaveTimeRef = useRef<number | null>(null);
  const lastViolationRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    // Called whenever the tab returns to visibility or the window regains focus.
    // Fires a violation only if the absence exceeded the grace period.
    const maybeFlag = () => {
      if (tabLeaveTimeRef.current === null) return;
      const duration = performance.now() - tabLeaveTimeRef.current;
      tabLeaveTimeRef.current = null;

      if (!examActiveRef.current || isPermissionFlowActiveRef.current) return;
      if (duration <= TAB_SWITCH_GRACE_MS) return;

      const now = performance.now();
      if (now - lastViolationRef.current <= VIOLATION_LOCK_MS) return;

      lastViolationRef.current = now;
      const secs = Math.round(duration / 1_000);
      onViolationRef.current(
        `Candidate was away from the assessment tab for ${secs} second${secs === 1 ? "" : "s"}`
      );
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (examActiveRef.current && !isPermissionFlowActiveRef.current) {
          tabLeaveTimeRef.current ??= performance.now();
        }
      } else {
        maybeFlag();
      }
    };

    const handleBlur = () => {
      if (examActiveRef.current && !isPermissionFlowActiveRef.current) {
        tabLeaveTimeRef.current ??= performance.now();
      }
    };

    const handleFocus = () => {
      maybeFlag();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      tabLeaveTimeRef.current = null;
    };
  }, [enabled, examActiveRef, isPermissionFlowActiveRef]);
}
