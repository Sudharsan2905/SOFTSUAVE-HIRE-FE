import { useEffect, useRef, type MutableRefObject } from "react";
import { MalpracticeType } from "../../../types";

const CHECK_INTERVAL_MS = 2_000;
const COOLDOWN_MS = 15_000;

interface UseMultiMonitorMonitoringOptions {
  enabled: boolean;
  /** Only flag while the exam is actually running. */
  examActiveRef?: MutableRefObject<boolean>;
  onViolation: (type: MalpracticeType, description: string) => void;
  /** Called with true when a second monitor appears, false once it is removed. */
  onBlockChange?: (blocked: boolean) => void;
}

type ExtScreen = Screen & { isExtended?: boolean; availLeft?: number; availTop?: number };

/**
 * Synchronous multi-display check. Uses several signals because no single one is
 * reliable on every setup:
 *  - Screen.isExtended (Chromium)
 *  - the screen's available area is offset from the origin (this window is on a
 *    non-primary display, or a display sits left of / above the primary)
 *  - the browser window itself sits outside the primary display's bounds
 */
export function hasMultipleMonitors(): boolean {
  const s = globalThis.screen as ExtScreen | undefined;
  if (!s) return false;
  if (s.isExtended) return true;
  if ((s.availLeft ?? 0) !== 0 || (s.availTop ?? 0) !== 0) return true;
  const left = globalThis.screenLeft ?? 0;
  const top = globalThis.screenTop ?? 0;
  return left < -50 || top < -50 || left >= s.width || top >= s.height;
}

/**
 * Stronger async check: also asks the Window Management API for the real screen
 * list when the permission was already granted. Falls back to the sync check.
 */
export async function detectMultipleMonitors(): Promise<boolean> {
  if (hasMultipleMonitors()) return true;
  try {
    const w = globalThis as unknown as {
      getScreenDetails?: () => Promise<{ screens: unknown[] }>;
    };
    if (typeof w.getScreenDetails === "function") {
      const perm = await navigator.permissions.query({
        name: "window-management" as PermissionName,
      });
      if (perm.state === "granted") {
        const details = await w.getScreenDetails();
        return details.screens.length > 1;
      }
    }
  } catch {
    /* API unavailable — rely on the sync check */
  }
  return false;
}

/**
 * Flags a violation when a second (extended) monitor is connected.
 * Re-checks on an interval and on the Screen "change" event, so plugging in a
 * display mid-exam is caught too.
 */
export function useMultiMonitorMonitoring({
  enabled,
  examActiveRef,
  onViolation,
  onBlockChange,
}: UseMultiMonitorMonitoringOptions): void {
  const onViolationRef = useRef(onViolation);
  const onBlockChangeRef = useRef(onBlockChange);
  const lastFiredRef = useRef(0);
  const lastBlockedRef = useRef(false);

  useEffect(() => {
    onViolationRef.current = onViolation;
    onBlockChangeRef.current = onBlockChange;
  });

  useEffect(() => {
    if (!enabled) return;

    const check = async () => {
      const multi = await detectMultipleMonitors();
      // Restriction: tell the page so it can block the exam UI until the extra
      // display is disconnected (reports changes only).
      if (multi !== lastBlockedRef.current) {
        lastBlockedRef.current = multi;
        onBlockChangeRef.current?.(multi);
      }
      if (examActiveRef && !examActiveRef.current) return;
      if (!multi) return;
      const now = performance.now();
      if (lastFiredRef.current !== 0 && now - lastFiredRef.current < COOLDOWN_MS) return;
      lastFiredRef.current = now;
      onViolationRef.current(
        "multiple_monitors",
        "Multiple monitors detected. Disconnect extra displays and use a single screen."
      );
    };

    const run = () => void check();
    const id = setInterval(run, CHECK_INTERVAL_MS);
    const screenObj = globalThis.screen as unknown as EventTarget | undefined;
    screenObj?.addEventListener?.("change", run);
    run();

    return () => {
      clearInterval(id);
      screenObj?.removeEventListener?.("change", run);
    };
  }, [enabled, examActiveRef]);
}
