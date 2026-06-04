import { useCallback, useRef } from "react";

import api from "@/utils/api";

type Answer = string | string[];
type AnswerMap = Record<string, Answer>;

interface UseAnswerSyncOptions {
  submissionId: string;
  debounceMs?: number;
}

interface UseAnswerSyncReturn {
  answers: React.MutableRefObject<AnswerMap>;
  setAnswer: (questionId: string, answer: Answer) => void;
  flushPending: () => void;
}

import type React from "react";

/**
 * Manages candidate answers with debounced server sync.
 * Keeps a ref-based answer map (updated synchronously) and a debounced
 * POST call so the UI never waits on the network.
 */
export function useAnswerSync({
  submissionId,
  debounceMs = 500,
}: UseAnswerSyncOptions): UseAnswerSyncReturn {
  const answers = useRef<AnswerMap>({});
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const syncToServer = useCallback(
    async (questionId: string, answer: Answer) => {
      try {
        await api.post(`/api/candidate/submission/${submissionId}/answer`, {
          question_id: questionId,
          answer,
        });
      } catch {
        // silent — answers are best-effort synced; the user can re-answer
      }
    },
    [submissionId]
  );

  const setAnswer = useCallback(
    (questionId: string, answer: Answer) => {
      answers.current[questionId] = answer;

      if (timersRef.current[questionId]) {
        clearTimeout(timersRef.current[questionId]);
      }
      timersRef.current[questionId] = setTimeout(() => {
        delete timersRef.current[questionId];
        void syncToServer(questionId, answer);
      }, debounceMs);
    },
    [syncToServer, debounceMs]
  );

  const flushPending = useCallback(() => {
    Object.entries(timersRef.current).forEach(([qid, timer]) => {
      clearTimeout(timer);
      void syncToServer(qid, answers.current[qid]);
    });
    timersRef.current = {};
  }, [syncToServer]);

  return { answers, setAnswer, flushPending };
}
