import { useCallback, useEffect, useRef } from "react";
import type React from "react";

import api from "@/utils/api";
import { API_ENDPOINTS } from "@/constants/api";

type Answer = string | string[];
type AnswerMap = Record<string, Answer>;

interface UseAnswerSyncOptions {
  submissionId: string;
  debounceMs?: number;
}

interface UseAnswerSyncReturn {
  answers: React.MutableRefObject<AnswerMap>;
  setAnswer: (questionId: string, answer: Answer) => void;
  /** Push every unsynced answer now. Resolves true only when nothing is left unsynced. */
  flushPending: () => Promise<boolean>;
  /** Number of answers the server has not acknowledged yet. */
  pendingCount: () => number;
}

const RETRY_BASE_MS = 1_000;
const RETRY_MAX_MS = 15_000;
const FLUSH_ATTEMPTS = 3;

/**
 * Candidate answers with debounced, *reliable* server sync.
 *
 * Every answer is tracked as dirty until the server acknowledges it. Failed saves are
 * retried with exponential backoff (and again as soon as the browser comes back online),
 * and `flushPending` lets the submit path wait until nothing is outstanding.
 */
export function useAnswerSync({
  submissionId,
  debounceMs = 500,
}: UseAnswerSyncOptions): UseAnswerSyncReturn {
  const answers = useRef<AnswerMap>({});
  const dirty = useRef<Set<string>>(new Set());
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const attempts = useRef<Record<string, number>>({});
  const inFlight = useRef<Set<string>>(new Set());

  const clearTimer = useCallback((qid: string) => {
    if (timers.current[qid]) {
      clearTimeout(timers.current[qid]);
      delete timers.current[qid];
    }
  }, []);

  const syncOne = useCallback(
    async (qid: string): Promise<boolean> => {
      if (!dirty.current.has(qid)) return true;
      if (inFlight.current.has(qid)) return false;
      const sent = answers.current[qid];
      inFlight.current.add(qid);
      try {
        await api.post(API_ENDPOINTS.CANDIDATE.SUBMISSION_ANSWER(submissionId), {
          question_id: qid,
          answer: sent,
        });
        attempts.current[qid] = 0;
        // Only clean if the user did not type something newer meanwhile.
        if (answers.current[qid] === sent) dirty.current.delete(qid);
        else void syncOne(qid);
        return !dirty.current.has(qid);
      } catch {
        return false;
      } finally {
        inFlight.current.delete(qid);
      }
    },
    [submissionId]
  );

  const scheduleRetry = useCallback(
    (qid: string) => {
      clearTimer(qid);
      const n = attempts.current[qid] ?? 0;
      attempts.current[qid] = n + 1;
      const delay = Math.min(RETRY_BASE_MS * 2 ** n, RETRY_MAX_MS);
      timers.current[qid] = setTimeout(() => {
        delete timers.current[qid];
        void syncOne(qid).then((ok) => {
          if (!ok && dirty.current.has(qid)) scheduleRetry(qid);
        });
      }, delay);
    },
    [clearTimer, syncOne]
  );

  const setAnswer = useCallback(
    (questionId: string, answer: Answer) => {
      answers.current[questionId] = answer;
      dirty.current.add(questionId);
      clearTimer(questionId);
      timers.current[questionId] = setTimeout(() => {
        delete timers.current[questionId];
        void syncOne(questionId).then((ok) => {
          if (!ok && dirty.current.has(questionId)) scheduleRetry(questionId);
        });
      }, debounceMs);
    },
    [clearTimer, syncOne, scheduleRetry, debounceMs]
  );

  const flushPending = useCallback(async (): Promise<boolean> => {
    for (let attempt = 0; attempt < FLUSH_ATTEMPTS && dirty.current.size > 0; attempt += 1) {
      const ids = [...dirty.current];
      ids.forEach(clearTimer);
      await Promise.all(ids.map((qid) => syncOne(qid)));
      if (dirty.current.size > 0 && attempt < FLUSH_ATTEMPTS - 1) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
    return dirty.current.size === 0;
  }, [clearTimer, syncOne]);

  // Re-sync everything outstanding as soon as connectivity returns.
  useEffect(() => {
    const onOnline = () => {
      [...dirty.current].forEach((qid) => void syncOne(qid));
    };
    globalThis.addEventListener("online", onOnline);
    return () => globalThis.removeEventListener("online", onOnline);
  }, [syncOne]);

  // Clear pending timers on unmount.
  useEffect(() => {
    const t = timers.current;
    return () => Object.values(t).forEach(clearTimeout);
  }, []);

  const pendingCount = useCallback(() => dirty.current.size, []);

  return { answers, setAnswer, flushPending, pendingCount };
}
