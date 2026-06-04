import { useCallback, useRef, useState } from 'react';

import api from '@/utils/api';
import { CandidateQuestion, MonitoringConfig, RoundConfig } from '@/types';

export interface InterviewRoundData {
  round_number: number;
  questions: CandidateQuestion[];
  max_duration_minutes: number;
}

export interface LoadedRoundState {
  round: InterviewRoundData | null;
  monitoringConfig: Partial<MonitoringConfig>;
  remainingSeconds: number | null;
  questionIdx: number;
  assessmentRounds: RoundConfig[];
}

interface UseInterviewSessionOptions {
  submissionId: string;
  shareLink: string;
}

interface UseInterviewSessionReturn extends LoadedRoundState {
  isLoading: boolean;
  loadData: () => Promise<void>;
  currentIdx: number;
  setCurrentIdx: React.Dispatch<React.SetStateAction<number>>;
  currentIdxRef: React.MutableRefObject<number>;
  visitedQuestions: Set<string>;
  markVisited: (questionId: string) => void;
  navigateTo: (idx: number) => void;
}

import type React from 'react';

/**
 * Loads and manages the data layer for an interview session:
 * round questions, monitoring config, question navigation, and visited-state.
 *
 * Separated from InterviewPage so the component only orchestrates UI.
 */
export function useInterviewSession({
  submissionId,
  shareLink,
}: UseInterviewSessionOptions): UseInterviewSessionReturn {
  const [isLoading, setIsLoading] = useState(true);
  const [round, setRound] = useState<InterviewRoundData | null>(null);
  const [monitoringConfig, setMonitoringConfig] = useState<Partial<MonitoringConfig>>({});
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [assessmentRounds, setAssessmentRounds] = useState<RoundConfig[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [visitedQuestions, setVisitedQuestions] = useState<Set<string>>(new Set());

  const currentIdxRef = useRef(0);

  const fetchRound = useCallback(async () => {
    const { data } = await api.get(`/api/candidate/submission/${submissionId}/round`);
    const r = data.data ?? {};
    return {
      round: r.round ?? null,
      monitoring: {
        tab_monitoring: r.tab_monitoring ?? false,
        video_monitoring: r.video_monitoring ?? false,
        audio_monitoring: r.audio_monitoring ?? false,
        screenshot_enabled: r.screenshot_enabled ?? false,
        screenshot_interval_minutes: r.screenshot_interval_minutes,
        screenshot_count: r.screenshot_count,
      } as Partial<MonitoringConfig>,
      remainingSeconds: r.remaining_seconds ?? null,
      questionIdx: r.current_question_idx ?? 0,
    };
  }, [submissionId]);

  const fetchAssessment = useCallback(async () => {
    if (!shareLink) return null;
    const { data } = await api.get(`/api/candidate/assessment/${shareLink}`);
    return data.data ?? null;
  }, [shareLink]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [roundResult, assessment] = await Promise.all([
        fetchRound(),
        fetchAssessment(),
      ]);

      if (roundResult.round) {
        setRound(roundResult.round);
        setMonitoringConfig(roundResult.monitoring);
        setRemainingSeconds(roundResult.remainingSeconds);
        const idx = roundResult.questionIdx;
        setQuestionIdx(idx);
        setCurrentIdx(idx);
        currentIdxRef.current = idx;
      }
      if (assessment?.rounds) {
        setAssessmentRounds(assessment.rounds);
      }
    } finally {
      setIsLoading(false);
    }
  }, [fetchRound, fetchAssessment]);

  const markVisited = useCallback((questionId: string) => {
    setVisitedQuestions((prev) => {
      if (prev.has(questionId)) return prev;
      const next = new Set(prev);
      next.add(questionId);
      return next;
    });
  }, []);

  const navigateTo = useCallback(
    (idx: number) => {
      if (round) {
        const leaving = round.questions[currentIdxRef.current];
        if (leaving) markVisited(leaving.id);
      }
      setCurrentIdx(idx);
      currentIdxRef.current = idx;
    },
    [round, markVisited],
  );

  return {
    isLoading,
    round,
    monitoringConfig,
    remainingSeconds,
    questionIdx,
    assessmentRounds,
    currentIdx,
    setCurrentIdx,
    currentIdxRef,
    visitedQuestions,
    markVisited,
    navigateTo,
    loadData,
  };
}
