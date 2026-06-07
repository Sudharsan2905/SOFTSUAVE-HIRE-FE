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
      // Only call onExit when the user actively leaves fullscreen after it was active.
      // This is a violation signal — NOT called on initial enforcement failure.
      if (!nowFullscreen) {
        onExitRef.current?.("Candidate exited fullscreen mode");
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
      FS_EVENTS.forEach((ev) => document.removeEventListener(ev, handleChange));
    };
  }, [enabled, requestFullscreen]);

  return { isFullscreen, requestFullscreen };
}
