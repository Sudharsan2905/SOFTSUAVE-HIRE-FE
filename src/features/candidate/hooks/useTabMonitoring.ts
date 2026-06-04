import { useEffect, useCallback, useRef } from "react";

interface UseTabMonitoringOptions {
  enabled: boolean;
  onViolation: () => void;
}

export function useTabMonitoring({ enabled, onViolation }: UseTabMonitoringOptions): void {
  const onViolationRef = useRef(onViolation);
  useEffect(() => {
    onViolationRef.current = onViolation;
  });

  const handleViolation = useCallback(() => {
    if (!enabled) return;
    onViolationRef.current();
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") handleViolation();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleViolation);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleViolation);
    };
  }, [enabled, handleViolation]);
}
