import { useCallback, useEffect, useRef, useState } from "react";

const FS_EVENTS = [
  "fullscreenchange",
  "webkitfullscreenchange",
  "mozfullscreenchange",
  "MSFullscreenChange",
] as const;

interface UseFullscreenEnforcementOptions {
  enabled: boolean;
  /**
   * Called when the user actively exits fullscreen after it was established.
   * This is the violation signal — only fires while monitoring is running.
   */
  onExit?: (description: string) => void;
  /**
   * Called when the initial fullscreen request fails or is denied on load/refresh.
   * This is a recovery signal — should show the recovery modal but NOT log malpractice.
   */
  onBlockRequired?: () => void;
}

interface UseFullscreenEnforcementReturn {
  isFullscreen: boolean;
  requestFullscreen: () => Promise<void>;
}

export function useFullscreenEnforcement({
  enabled,
  onExit,
  onBlockRequired,
}: UseFullscreenEnforcementOptions): UseFullscreenEnforcementReturn {
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const onExitRef = useRef(onExit);
  const onBlockRequiredRef = useRef(onBlockRequired);
  // Pending violation timer — mirrors TAB_SWITCH_GRACE_MS in useTabMonitoring.
  const exitDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onExitRef.current = onExit;
  });

  useEffect(() => {
    onBlockRequiredRef.current = onBlockRequired;
  });

  const requestFullscreen = useCallback(async () => {
    if (document.fullscreenElement) return;
    try {
      await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    } catch {
      /* browser may deny — recovery modal handles re-entry */
    }
  }, []);

  // Exit fullscreen when the interview component unmounts (navigation away)
  useEffect(() => {
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const handleChange = () => {
      const nowFullscreen = !!document.fullscreenElement;
      setIsFullscreen(nowFullscreen);

      if (nowFullscreen) {
        // Candidate returned to fullscreen before the grace period expired — cancel.
        if (exitDebounceRef.current !== null) {
          clearTimeout(exitDebounceRef.current);
          exitDebounceRef.current = null;
        }
      } else {
        // Start a 1-second grace period matching the tab-switch debounce pattern.
        // If the candidate restores fullscreen within that window, no violation fires.
        if (exitDebounceRef.current !== null) return;
        exitDebounceRef.current = setTimeout(() => {
          exitDebounceRef.current = null;
          if (!document.fullscreenElement) {
            onExitRef.current?.("Candidate exited fullscreen mode");
          }
        }, 1_000);
      }
    };

    FS_EVENTS.forEach((ev) => document.addEventListener(ev, handleChange));

    // Attempt fullscreen on load/refresh. If denied or unavailable, signal the
    // recovery UI via onBlockRequired — NOT onExit — so no malpractice is logged
    // just because the page loaded without fullscreen.
    const tryEnforce = async () => {
      if (cancelled) return;
      await requestFullscreen();
      if (!cancelled && !document.fullscreenElement) {
        onBlockRequiredRef.current?.();
      }
    };

    const timeout = setTimeout(() => {
      void tryEnforce();
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      if (exitDebounceRef.current !== null) {
        clearTimeout(exitDebounceRef.current);
        exitDebounceRef.current = null;
      }
      FS_EVENTS.forEach((ev) => document.removeEventListener(ev, handleChange));
    };
  }, [enabled, requestFullscreen]);

  return { isFullscreen, requestFullscreen };
}
