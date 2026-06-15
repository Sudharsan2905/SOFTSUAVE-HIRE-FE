import { useEffect, useRef, MutableRefObject } from "react";

const TAB_SWITCH_GRACE_MS = 1_000;
const VIOLATION_LOCK_MS = 1_000;

interface UseTabMonitoringOptions {
  enabled: boolean;
  examActiveRef: MutableRefObject<boolean>;
  isPermissionFlowActiveRef: MutableRefObject<boolean>;
  onTabSwitch: (description: string) => void;
  onFocusViolation: (description: string) => void;
}

export function useTabMonitoring({
  enabled,
  examActiveRef,
  isPermissionFlowActiveRef,
  onTabSwitch,
  onFocusViolation,
}: UseTabMonitoringOptions): void {
  const onTabSwitchRef = useRef(onTabSwitch);
  const onFocusViolationRef = useRef(onFocusViolation);
  useEffect(() => {
    onTabSwitchRef.current = onTabSwitch;
  });
  useEffect(() => {
    onFocusViolationRef.current = onFocusViolation;
  });

  const tabSwitchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastViolationRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const canFire = (): boolean => {
      if (!examActiveRef.current || isPermissionFlowActiveRef.current) return false;
      const now = performance.now();
      if (now - lastViolationRef.current <= VIOLATION_LOCK_MS) return false;
      lastViolationRef.current = now;
      return true;
    };

    const startTabSwitchTimer = () => {
      if (tabSwitchTimeoutRef.current !== null || isPermissionFlowActiveRef.current) return;
      tabSwitchTimeoutRef.current = setTimeout(() => {
        tabSwitchTimeoutRef.current = null;
        if (canFire()) {
          onTabSwitchRef.current(
            "Candidate switched away from the assessment tab for more than 1 second"
          );
        }
      }, TAB_SWITCH_GRACE_MS);
    };

    // Only fires when blur occurs while the tab is still visible — the OS
    // notification / DND-bypass case. The fullscreen guard ensures
    // useFullscreenEnforcement stays the sole handler for fullscreen exits.
    const startFocusViolationTimer = () => {
      if (focusTimeoutRef.current !== null || isPermissionFlowActiveRef.current) return;
      focusTimeoutRef.current = setTimeout(() => {
        focusTimeoutRef.current = null;
        if (!document.fullscreenElement) return;
        if (canFire()) {
          onFocusViolationRef.current(
            "Window focus lost during fullscreen assessment — possible notification interaction"
          );
        }
      }, TAB_SWITCH_GRACE_MS);
    };

    const cancelFocusTimer = () => {
      if (focusTimeoutRef.current !== null) {
        clearTimeout(focusTimeoutRef.current);
        focusTimeoutRef.current = null;
      }
    };

    const cancelAll = () => {
      if (tabSwitchTimeoutRef.current !== null) {
        clearTimeout(tabSwitchTimeoutRef.current);
        tabSwitchTimeoutRef.current = null;
      }
      cancelFocusTimer();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        // blur fires just before visibilitychange on a real tab switch; discard
        // any focus-violation timer that blur may have already started.
        cancelFocusTimer();
        startTabSwitchTimer();
      } else {
        cancelAll();
      }
    };

    const handleBlur = () => {
      // When the tab is still visible, blur means focus moved to an OS overlay
      // (notification, permission dialog, etc.) — not a tab switch.
      // If the tab is already hidden, visibilitychange handles it as tab_switch.
      if (document.visibilityState === "visible") {
        startFocusViolationTimer();
      }
    };

    const handleFocus = () => cancelAll();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      cancelAll();
    };
  }, [enabled, examActiveRef, isPermissionFlowActiveRef]);
}
