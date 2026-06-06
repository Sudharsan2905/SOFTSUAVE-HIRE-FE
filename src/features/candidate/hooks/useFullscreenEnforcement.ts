import { useCallback, useEffect, useRef, useState } from "react";

const FS_EVENTS = [
  "fullscreenchange",
  "webkitfullscreenchange",
  "mozfullscreenchange",
  "MSFullscreenChange",
] as const;

interface UseFullscreenEnforcementOptions {
  enabled: boolean;
  onExit?: () => void;
}

interface UseFullscreenEnforcementReturn {
  isFullscreen: boolean;
  requestFullscreen: () => Promise<void>;
}

export function useFullscreenEnforcement({
  enabled,
  onExit,
}: UseFullscreenEnforcementOptions): UseFullscreenEnforcementReturn {
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const onExitRef = useRef(onExit);

  useEffect(() => {
    onExitRef.current = onExit;
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
      if (!nowFullscreen) {
        onExitRef.current?.();
      }
    };

    FS_EVENTS.forEach((ev) => document.addEventListener(ev, handleChange));

    // Attempt fullscreen on load/refresh; if denied, surface the recovery modal
    const tryEnforce = async () => {
      if (cancelled) return;
      await requestFullscreen();
      if (!cancelled && !document.fullscreenElement) {
        onExitRef.current?.();
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
