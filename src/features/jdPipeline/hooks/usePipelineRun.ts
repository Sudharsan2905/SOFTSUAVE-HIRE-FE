import { useCallback, useEffect, useRef, useState } from "react";
import { extractApiErrorMessage } from "@/utils/api";
import { getPipeline } from "../api/pipelineApi";
import { ACTIVE_RUN_STATUSES, PIPELINE_MESSAGES, POLL_INTERVAL_MS } from "../constants";
import type { PipelineRun } from "../types";

export function isRunActive(run: PipelineRun | null): boolean {
  return !!run && (ACTIVE_RUN_STATUSES as readonly string[]).includes(run.status);
}

/** Loads a pipeline run and polls every 2s while it is queued/running. */
export function usePipelineRun(pipelineId: string | undefined) {
  const [run, setRun] = useState<PipelineRun | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelled = useRef(false);

  const refresh = useCallback(async (): Promise<PipelineRun | null> => {
    if (!pipelineId) return null;
    try {
      const next = await getPipeline(pipelineId);
      if (cancelled.current) return null;
      setRun(next);
      setError(null);
      return next;
    } catch (err) {
      if (!cancelled.current) setError(extractApiErrorMessage(err, PIPELINE_MESSAGES.LOAD_FAILED));
      return null;
    } finally {
      if (!cancelled.current) setIsLoading(false);
    }
  }, [pipelineId]);

  useEffect(() => {
    cancelled.current = false;
    setIsLoading(true);

    const tick = async () => {
      const next = await refresh();
      if (cancelled.current) return;
      // Keep polling while running, and keep retrying after transient errors.
      if (next === null || isRunActive(next)) {
        timer.current = setTimeout(tick, POLL_INTERVAL_MS);
      }
    };
    tick();

    return () => {
      cancelled.current = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [refresh]);

  /** Re-fetch and make sure polling resumes (e.g. after a retry flips the run to running). */
  const reload = useCallback(async () => {
    const next = await refresh();
    if (next && isRunActive(next) && !cancelled.current) {
      if (timer.current) clearTimeout(timer.current);
      const poll = async () => {
        const n = await refresh();
        if (cancelled.current) return;
        if (n === null || isRunActive(n)) timer.current = setTimeout(poll, POLL_INTERVAL_MS);
      };
      timer.current = setTimeout(poll, POLL_INTERVAL_MS);
    }
  }, [refresh]);

  return { run, isLoading, error, reload };
}
