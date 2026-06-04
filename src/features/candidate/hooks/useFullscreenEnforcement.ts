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
  const wasFullscreenRef = useRef(!!document.fullscreenElement);
  const onExitRef = useRef(onExit);

  useEffect(() => {
    onExitRef.current = onExit;
  });

  const requestFullscreen = useCallback(async () => {
    if (document.fullscreenElement) return;
    try {
      await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    } catch {
      /* browser may deny — modal stays visible so user can retry */
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handleChange = () => {
      const nowFullscreen = !!document.fullscreenElement;
      setIsFullscreen(nowFullscreen);
      if (wasFullscreenRef.current && !nowFullscreen) {
        onExitRef.current?.();
      }
      wasFullscreenRef.current = nowFullscreen;
    };

    FS_EVENTS.forEach((ev) => document.addEventListener(ev, handleChange));
    void requestFullscreen();

    return () => {
      FS_EVENTS.forEach((ev) => document.removeEventListener(ev, handleChange));
    };
  }, [enabled, requestFullscreen]);

  return { isFullscreen, requestFullscreen };
}
