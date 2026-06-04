import { useEffect, useRef, useCallback } from "react";
import { MalpracticeType } from "../../../types";

const COOLDOWN_MS = 10_000;

interface UseScreenMonitoringOptions {
  enabled: boolean;
  onViolation: (type: MalpracticeType) => void;
}

interface UseScreenMonitoringReturn {
  startScreenShare: () => Promise<MediaStream | null>;
  stopScreenShare: () => void;
  screenStream: React.MutableRefObject<MediaStream | null>;
}

export function useScreenMonitoring({
  enabled,
  onViolation,
}: UseScreenMonitoringOptions): UseScreenMonitoringReturn {
  const screenStreamRef = useRef<MediaStream | null>(null);
  const lastViolationRef = useRef<number>(0);
  const onViolationRef = useRef(onViolation);
  useEffect(() => {
    onViolationRef.current = onViolation;
  });

  const flag = useCallback((type: MalpracticeType) => {
    const now = performance.now();
    if (now - lastViolationRef.current > COOLDOWN_MS) {
      lastViolationRef.current = now;
      onViolationRef.current(type);
    }
  }, []);

  const stopScreenShare = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
  }, []);

  const startScreenShare = useCallback(async (): Promise<MediaStream | null> => {
    if (!enabled) return null;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      screenStreamRef.current = stream;
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        flag("screen_share_stop");
        screenStreamRef.current = null;
      });
      return stream;
    } catch {
      return null;
    }
  }, [enabled, flag]);

  useEffect(() => {
    return () => stopScreenShare();
  }, [stopScreenShare]);

  return { startScreenShare, stopScreenShare, screenStream: screenStreamRef };
}
