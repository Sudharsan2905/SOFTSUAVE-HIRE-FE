import { useEffect, useCallback } from "react";
import { api } from "@/utils/api";

interface UseTabMonitoringOptions {
  enabled: boolean;
  submissionId: string;
  onViolation: () => void;
}

export function useTabMonitoring({
  enabled,
  submissionId,
  onViolation,
}: UseTabMonitoringOptions): void {
  const handleViolation = useCallback(async () => {
    if (!enabled) return;

    onViolation();

    try {
      await api.post(`/api/candidate/submission/${submissionId}/malpractice`, {
        type: "tab_switch",
      });
    } catch {
      // Silently ignore network errors so the UI keeps running
    }
  }, [enabled, submissionId, onViolation]);

  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        handleViolation();
      }
    };

    const handleBlur = () => {
      handleViolation();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
    };
  }, [enabled, handleViolation]);
}
