import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import styles from "./InterviewPage.module.css";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { api } from "@/utils/api";
import { CandidateQuestion, MonitoringConfig, RoundConfig } from "@/types";
import { RichText } from "@/components/ui/RichText";
import CandidateHeader from "@/features/candidate/components/CandidateHeader";
import { VideoMonitor } from "@/features/candidate/components/VideoMonitor";
import { AudioMonitor } from "@/features/candidate/components/AudioMonitor";
import { ConnectionLostOverlay } from "@/features/candidate/components/ConnectionLostOverlay";
import { useTabMonitoring } from "@/features/candidate/hooks/useTabMonitoring";
import { useAudioMonitoring } from "@/features/candidate/hooks/useAudioMonitoring";
import { useVideoMonitoring } from "@/features/candidate/hooks/useVideoMonitoring";
import { useScreenMonitoring } from "@/features/candidate/hooks/useScreenMonitoring";
import { useDevtoolsMonitoring } from "@/features/candidate/hooks/useDevtoolsMonitoring";
import { useMalpracticeCoordinator } from "@/features/candidate/hooks/useMalpracticeCoordinator";
import { useRoundTimer } from "@/features/candidate/hooks/useRoundTimer";
import { useAnswerSync } from "@/features/candidate/hooks/useAnswerSync";
import { useFullscreenEnforcement } from "@/features/candidate/hooks/useFullscreenEnforcement";
import { useScreenCapture } from "@/features/candidate/hooks/useScreenCapture";
import { MalpracticeWarningModal } from "@/features/candidate/components/MalpracticeWarningModal";
import { useInterviewSession } from "@/features/candidate/context/InterviewSessionContext";
import { useAppSelector } from "@/store/hooks";
import { markAssessmentDone } from "@/utils/assessmentSession";
import { takeCameraStream } from "@/features/candidate/services/screenCaptureStore";
import toast from "react-hot-toast";

// ─── Local types ──────────────────────────────────────────────────────────────

interface InterviewRoundData {
  round_number: number;
  questions: CandidateQuestion[];
  max_duration_minutes: number;
}

interface RoundApiResponse {
  round: InterviewRoundData;
  tab_monitoring?: boolean;
  video_monitoring?: boolean;
  audio_monitoring?: boolean;
  screenshot_enabled?: boolean;
  screenshot_interval_minutes?: number;
  screenshot_count?: number;
  remaining_seconds?: number | null;
  current_question_idx?: number;
  session_status?: string;
}

interface AssessmentData {
  rounds: RoundConfig[];
}

type AnswerMap = Record<string, string | string[]>;

// ─── Pure helpers ─────────────────────────────────────────────────────────────

type QBtnState = "answered" | "visited" | "active" | "default";

function getQuestionButtonState(
  q: CandidateQuestion,
  idx: number,
  currentIdx: number,
  answers: AnswerMap,
  visitedQuestions: Set<string>
): QBtnState {
  if (idx === currentIdx) return "active";
  if (answers[q.id] !== undefined) return "answered";
  if (visitedQuestions.has(q.id)) return "visited";
  return "default";
}

function getQBtnClass(state: QBtnState, styleMap: Record<string, string>): string {
  switch (state) {
    case "answered":
      return `${styleMap.qBtn} ${styleMap.qBtnAnswered}`;
    case "visited":
      return `${styleMap.qBtn} ${styleMap.qBtnVisited}`;
    case "active":
      return `${styleMap.qBtn} ${styleMap.qBtnActive}`;
    default:
      return styleMap.qBtn;
  }
}

function getRoundStatusClass(
  isActive: boolean,
  isCompleted: boolean,
  styleMap: Record<string, string>
): string {
  if (isActive) return styleMap.roundStatusActive;
  if (isCompleted) return styleMap.roundStatusCompleted;
  return styleMap.roundStatusPending;
}

function getRoundStatusLabel(isActive: boolean, isCompleted: boolean): string {
  if (isActive) return "Active";
  if (isCompleted) return "Done";
  return "Pending";
}

function getRoundMiniBarClass(
  isActive: boolean,
  isCompleted: boolean,
  styleMap: Record<string, string>
): string {
  if (isActive) return `${styleMap.roundMiniBarFill} ${styleMap.roundMiniBarActive}`;
  if (isCompleted) return `${styleMap.roundMiniBarFill} ${styleMap.roundMiniBarDone}`;
  return styleMap.roundMiniBarFill;
}

function getQuestionTypeLabel(type: string): string {
  if (type === "essay") return "Essay";
  if (type === "mcq_multiple") return "Multiple Choice";
  return "Single Choice";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InterviewPage() {
  const { shareLink, submissionId } = useParams<{
    shareLink: string;
    submissionId: string;
  }>();
  const navigate = useNavigate();

  const user = useAppSelector((state) => state.auth.user);
  const candidateName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(" ")
    : undefined;

  // ── Core state ──────────────────────────────────────────────────────────────
  const [roundData, setRoundData] = useState<InterviewRoundData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [visitedQuestions, setVisitedQuestions] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showTimeExpired, setShowTimeExpired] = useState(false);
  const [adminWarningMessage, setAdminWarningMessage] = useState<string | null>(null);
  const [fullscreenBlocked, setFullscreenBlocked] = useState(false);

  // ── Assessment / rounds state ───────────────────────────────────────────────
  const [assessmentRounds, setAssessmentRounds] = useState<RoundConfig[]>([]);
  const [monitoringConfig, setMonitoringConfig] = useState<Partial<MonitoringConfig>>({});

  // ── Network / timer pausing ─────────────────────────────────────────────────
  const [timerActive, setTimerActive] = useState(true);

  // ── UI state ────────────────────────────────────────────────────────────────
  const [audioActive, setAudioActive] = useState(false);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const screenshotIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submittingRef = useRef(false);
  const finishRoundRef = useRef<(autoSubmit?: boolean) => Promise<void>>(async () => {});
  const currentIdxRef = useRef(0);
  const roundDataRef = useRef<InterviewRoundData | null>(null);

  useEffect(() => {
    submittingRef.current = submitting;
  }, [submitting]);

  useEffect(() => {
    roundDataRef.current = roundData;
  }, [roundData]);

  // ── Timer ───────────────────────────────────────────────────────────────────
  const handleTimerExpiry = useCallback(() => {
    if (!submittingRef.current) {
      void finishRoundRef.current(true).then(() => {
        setShowTimeExpired(true);
      });
    }
  }, []);

  const { setTimeLeft, timeLeftRef, isLowTime, formattedTime } = useRoundTimer({
    initialSeconds: 0,
    active: timerActive,
    onExpired: handleTimerExpiry,
  });

  // ── Answer sync ─────────────────────────────────────────────────────────────
  const { setAnswer: syncAnswerToServer, flushPending } = useAnswerSync({
    submissionId: submissionId ?? "",
  });

  // ── WebSocket session ───────────────────────────────────────────────────────
  const { networkStatus, sessionSubmissionId, startSession, registerCallbacks } =
    useInterviewSession();

  useEffect(() => {
    if (submissionId && sessionSubmissionId !== submissionId) {
      startSession(submissionId);
    }
  }, [submissionId, sessionSubmissionId, startSession]);

  useEffect(() => {
    registerCallbacks({
      onSessionState: (remainingSeconds, questionIdx) => {
        if (remainingSeconds !== null && remainingSeconds !== undefined) {
          setTimeLeft(remainingSeconds);
        }
        if (questionIdx !== undefined) {
          setCurrentIdx(questionIdx);
          currentIdxRef.current = questionIdx;
        }
      },
      onResumeApproved: (remainingSeconds, questionIdx) => {
        if (remainingSeconds !== null && remainingSeconds !== undefined) {
          setTimeLeft(remainingSeconds);
        }
        if (questionIdx !== undefined) {
          setCurrentIdx(questionIdx);
          currentIdxRef.current = questionIdx;
        }
        toast.success("Your interview has been resumed by the administrator.");
      },
      onTerminated: () => {
        toast.error("Your session has been terminated by an administrator.");
        setTimeout(() => navigate(`/assessment/${shareLink ?? ""}`), 2000);
      },
      onAdminWarning: (message: string) => {
        setAdminWarningMessage(message);
      },
      getRemainingSeconds: () => timeLeftRef.current,
      getCurrentQuestionIdx: () => currentIdxRef.current,
    });
  }, [registerCallbacks, navigate, shareLink]);

  useEffect(() => {
    const isOffline =
      networkStatus === "offline" ||
      networkStatus === "reconnecting" ||
      networkStatus === "on_hold";
    setTimerActive(!isOffline);
  }, [networkStatus]);

  // ── Data fetching ───────────────────────────────────────────────────────────
  const fetchRound = useCallback(async (): Promise<{
    round: InterviewRoundData | null;
    monitoring: Partial<MonitoringConfig>;
    remainingSeconds: number | null;
    questionIdx: number;
  }> => {
    const { data } = await api.get(`/api/candidate/submission/${submissionId}/round`);
    const responseData: RoundApiResponse = data.data ?? {};
    const monitoring: Partial<MonitoringConfig> = {
      tab_monitoring: responseData.tab_monitoring ?? false,
      video_monitoring: responseData.video_monitoring ?? false,
      audio_monitoring: responseData.audio_monitoring ?? false,
      screenshot_enabled: responseData.screenshot_enabled ?? false,
      screenshot_interval_minutes: responseData.screenshot_interval_minutes,
      screenshot_count: responseData.screenshot_count,
    };
    return {
      round: responseData.round ?? null,
      monitoring,
      remainingSeconds: responseData.remaining_seconds ?? null,
      questionIdx: responseData.current_question_idx ?? 0,
    };
  }, [submissionId]);

  const fetchAssessment = useCallback(async (): Promise<AssessmentData | null> => {
    if (!shareLink) return null;
    const { data } = await api.get(`/api/candidate/assessment/${shareLink}`);
    return data.data as AssessmentData;
  }, [shareLink]);

  const handleLoadError = useCallback(
    (e: unknown) => {
      const status = (e as { response?: { status?: number } })?.response?.status;
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "";

      if (status === 403) {
        if (shareLink) markAssessmentDone(shareLink);
        const isRevoked = msg.toLowerCase().includes("revoked");
        navigate(isRevoked ? `/assessment/${shareLink}` : `/assessment/${shareLink}/completed`, {
          replace: true,
        });
      } else {
        toast.error("Failed to load questions");
      }
    },
    [shareLink, navigate]
  );

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [{ round: rd, monitoring: cfg, remainingSeconds, questionIdx }, assessment] =
        await Promise.all([fetchRound(), fetchAssessment()]);

      if (rd) {
        setRoundData(rd);
        const initialTime = remainingSeconds ?? (rd.max_duration_minutes || 30) * 60;
        setTimeLeft(initialTime);
        setMonitoringConfig(cfg);
        if (questionIdx > 0 && questionIdx < rd.questions.length) {
          setCurrentIdx(questionIdx);
          currentIdxRef.current = questionIdx;
        }
      }

      if (assessment?.rounds) setAssessmentRounds(assessment.rounds);
    } catch (e: unknown) {
      handleLoadError(e);
    } finally {
      setIsLoading(false);
    }
  }, [fetchRound, fetchAssessment, handleLoadError]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // ── Answer sync ─────────────────────────────────────────────────────────────
  const setAnswer = useCallback(
    (questionId: string, answer: string | string[]) => {
      setAnswers((prev) => ({ ...prev, [questionId]: answer }));
      syncAnswerToServer(questionId, answer);
    },
    [syncAnswerToServer]
  );

  // ── Navigation ──────────────────────────────────────────────────────────────
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
      const rd = roundDataRef.current;
      const prevIdx = currentIdxRef.current;
      if (rd) {
        const leavingQ = rd.questions[prevIdx];
        if (leavingQ) markVisited(leavingQ.id);
      }
      setCurrentIdx(idx);
      currentIdxRef.current = idx;
    },
    [markVisited]
  );

  // ── Finish round ────────────────────────────────────────────────────────────
  const handleFinishRound = useCallback(
    async (_autoSubmit = false): Promise<void> => {
      if (submittingRef.current) return;
      setSubmitting(true);
      submittingRef.current = true;
      setShowSubmitConfirm(false);
      flushPending();

      try {
        const { data } = await api.post(`/api/candidate/submission/${submissionId}/finish-round`);
        if (data.data?.completed) {
          if (shareLink) markAssessmentDone(shareLink);
          navigate(`/assessment/${shareLink}/completed`, { replace: true });
        } else {
          setRoundData(null);
          setCurrentIdx(0);
          currentIdxRef.current = 0;
          setAnswers({});
          setVisitedQuestions(new Set());
          setSubmitting(false);
          submittingRef.current = false;
          await loadData();
        }
      } catch {
        toast.error("Failed to submit round");
        setSubmitting(false);
        submittingRef.current = false;
      }
    },
    [submissionId, shareLink, navigate, loadData]
  );

  useEffect(() => {
    finishRoundRef.current = handleFinishRound;
  }, [handleFinishRound]);

  // ── Malpractice coordinator ─────────────────────────────────────────────────
  const { flagViolation } = useMalpracticeCoordinator({
    submissionId: submissionId ?? "",
    monitoringConfig: monitoringConfig as MonitoringConfig,
    onTerminated: useCallback(() => {
      setTimeout(() => {
        void finishRoundRef.current(true);
      }, 500);
    }, []),
  });

  // ── Fullscreen enforcement ──────────────────────────────────────────────────
  const { isFullscreen, requestFullscreen } = useFullscreenEnforcement({
    enabled: !isLoading,
    onExit: useCallback(() => {
      void flagViolation({ type: "fullscreen_exit" });
      setFullscreenBlocked(true);
    }, [flagViolation]),
  });

  useEffect(() => {
    if (isFullscreen && fullscreenBlocked) {
      setFullscreenBlocked(false);
    }
  }, [isFullscreen, fullscreenBlocked]);

  // ── Tab monitoring ──────────────────────────────────────────────────────────
  useTabMonitoring({
    enabled: monitoringConfig.tab_monitoring ?? false,
    onViolation: useCallback(() => {
      void flagViolation({ type: "tab_switch" });
    }, [flagViolation]),
  });

  // ── Audio monitoring ────────────────────────────────────────────────────────
  useAudioMonitoring({
    enabled: monitoringConfig.audio_monitoring ?? false,
    analyserRef,
    onViolation: useCallback(() => {
      void flagViolation({ type: "audio_violation" });
    }, [flagViolation]),
  });

  // ── Video monitoring ────────────────────────────────────────────────────────
  useVideoMonitoring({
    enabled: monitoringConfig.video_monitoring ?? false,
    videoRef,
    onViolation: useCallback(
      (type) => {
        void flagViolation({ type });
      },
      [flagViolation]
    ),
  });

  // ── Screen monitoring (screen_share_stop only) ──────────────────────────────
  useScreenMonitoring({
    enabled: monitoringConfig.tab_monitoring ?? false,
    onViolation: useCallback(
      (type) => {
        void flagViolation({ type });
      },
      [flagViolation]
    ),
  });

  // ── DevTools monitoring ─────────────────────────────────────────────────────
  useDevtoolsMonitoring({
    enabled: monitoringConfig.tab_monitoring ?? false,
    onViolation: useCallback(
      (type) => {
        void flagViolation({ type });
      },
      [flagViolation]
    ),
  });

  // ── Copy / paste / shortcut blocking (toast only — NOT malpractice) ─────────
  useEffect(() => {
    const BLOCKED_CTRL_KEYS = new Set(["p", "x"]);
    const ALLOWED_IN_TEXTAREA = new Set(["a", "c", "v"]);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F12") {
        e.preventDefault();
        toast.error("Developer Tools are not allowed during the assessment");
        return;
      }
      if ((e.ctrlKey || e.metaKey) && BLOCKED_CTRL_KEYS.has(e.key.toLowerCase())) {
        e.preventDefault();
        toast.error("This action is not allowed during the assessment");
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        ALLOWED_IN_TEXTAREA.has(e.key.toLowerCase()) &&
        (e.target as HTMLElement).tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        toast.error("Copy/paste is not allowed during the assessment");
      }
    };

    const handleClipboard = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "TEXTAREA" && e.type === "paste") return;
      e.preventDefault();
      const action = e.type === "copy" ? "Copy" : e.type === "paste" ? "Paste" : "Cut";
      toast.error(`${action} action is not allowed on this page`);
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      toast.error("Right-click is not allowed during the assessment");
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("copy", handleClipboard);
    document.addEventListener("paste", handleClipboard);
    document.addEventListener("cut", handleClipboard);
    document.addEventListener("contextmenu", handleContextMenu);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("copy", handleClipboard);
      document.removeEventListener("paste", handleClipboard);
      document.removeEventListener("cut", handleClipboard);
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, []);

  // ── Camera stream (uses pre-obtained stream from InstructionsPage if available) ──
  useEffect(() => {
    if (!monitoringConfig.video_monitoring) return;
    let cancelled = false;
    let stream: MediaStream | null = null;

    const setup = async () => {
      const stored = takeCameraStream();
      try {
        stream = stored ?? (await navigator.mediaDevices.getUserMedia({ video: true }));
      } catch {
        return;
      }
      if (cancelled) {
        if (!stored) stream.getTracks().forEach((t) => t.stop());
        return;
      }
      if (videoRef.current) videoRef.current.srcObject = stream;
    };

    void setup();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [monitoringConfig.video_monitoring]);

  useEffect(() => {
    if (monitoringConfig.audio_monitoring) setAudioActive(true);
  }, [monitoringConfig.audio_monitoring]);

  // ── Screen capture for screenshots ─────────────────────────────────────────
  const { captureFrame, isCapturing: isScreenCapturing } = useScreenCapture();

  useEffect(() => {
    if (!monitoringConfig.screenshot_enabled || !submissionId) return;
    if (!isScreenCapturing) return;

    const intervalMs = (monitoringConfig.screenshot_interval_minutes ?? 0.5) * 60 * 1_000;

    screenshotIntervalRef.current = setInterval(() => {
      void (async () => {
        try {
          const blob = await captureFrame();
          if (!blob) return;
          const fd = new FormData();
          fd.append("file", blob, "screenshot.jpg");
          await api.post(`/api/candidate/submission/${submissionId}/screenshot`, fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        } catch {
          /* silent — screenshot failure does not interrupt interview */
        }
      })();
    }, intervalMs);

    return () => {
      if (screenshotIntervalRef.current) {
        clearInterval(screenshotIntervalRef.current);
        screenshotIntervalRef.current = null;
      }
    };
  }, [
    monitoringConfig.screenshot_enabled,
    monitoringConfig.screenshot_interval_minutes,
    submissionId,
    isScreenCapturing,
    captureFrame,
  ]);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className={styles.loadingScreen}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (!roundData) return null;

  const questions = roundData.questions;

  if (questions.length === 0) {
    return (
      <div className={styles.emptyScreen}>
        <p>No questions found for this round. Please contact the administrator.</p>
      </div>
    );
  }

  const currentQuestion = questions[currentIdx];
  const answeredCount = Object.keys(answers).length;
  const remainingCount = questions.length - answeredCount;
  const { hh, mm, ss } = formattedTime;

  const networkBadgeClass =
    networkStatus === "connected" ? styles.monitorBadgeGreen : styles.monitorBadgeOrange;
  let networkLabel: string;
  if (networkStatus === "connected") networkLabel = "Network Stable";
  else if (networkStatus === "on_hold") networkLabel = "Session Paused";
  else networkLabel = "Reconnecting…";

  return (
    <div className={styles.page}>
      <ConnectionLostOverlay status={networkStatus} />
      <CandidateHeader candidateName={candidateName} />

      <div className={styles.body}>
        {/* ── Left Sidebar ── */}
        <aside className={`${styles.leftSidebar} ${leftSidebarOpen ? styles.leftSidebarOpen : ""}`}>
          <div className={styles.progressHeader}>
            <p className={styles.progressHeaderLabel}>Assessment Progress</p>
            <p className={styles.progressRoundTitle}>
              Round {roundData.round_number}
              {assessmentRounds.length > 0 ? ` of ${assessmentRounds.length}` : ""}
            </p>
            <div className={styles.progressBarOuter}>
              <div
                className={styles.progressBarInner}
                style={{ width: `${(answeredCount / questions.length) * 100}%` }}
              />
            </div>
            <div className={styles.progressStats}>
              <div className={`${styles.progressStat} ${styles.progressStatAnswered}`}>
                <span className={styles.progressStatValue}>{answeredCount}</span>
                <span className={styles.progressStatLabel}>Done</span>
              </div>
              <div className={styles.progressStat}>
                <span className={styles.progressStatValue}>{questions.length}</span>
                <span className={styles.progressStatLabel}>Total</span>
              </div>
              <div className={`${styles.progressStat} ${styles.progressStatRemaining}`}>
                <span className={styles.progressStatValue}>{remainingCount}</span>
                <span className={styles.progressStatLabel}>Left</span>
              </div>
            </div>
          </div>

          {assessmentRounds.length > 0 && (
            <div className={styles.roundListSection}>
              <p className={styles.sidebarSectionLabel}>Rounds</p>
              {assessmentRounds.map((round) => {
                const isActive = round.round_number === roundData.round_number;
                const isCompleted = round.round_number < roundData.round_number;
                let progress: number;
                if (isActive) progress = (answeredCount / questions.length) * 100;
                else if (isCompleted) progress = 100;
                else progress = 0;
                const roundStatusClass = getRoundStatusClass(isActive, isCompleted, styles);
                const roundStatusLabel = getRoundStatusLabel(isActive, isCompleted);
                const roundMiniBarClass = getRoundMiniBarClass(isActive, isCompleted, styles);
                return (
                  <div
                    key={round.round_number}
                    className={`${styles.roundCard} ${isActive ? styles.roundCardActive : ""} ${isCompleted ? styles.roundCardCompleted : ""}`}
                  >
                    <div className={styles.roundCardHeader}>
                      <span className={styles.roundCardName}>Round {round.round_number}</span>
                      <span className={`${styles.roundStatusPill} ${roundStatusClass}`}>
                        {roundStatusLabel}
                      </span>
                    </div>
                    <p className={styles.roundCardMeta}>
                      {round.question_count} question{round.question_count === 1 ? "" : "s"}
                    </p>
                    <div className={styles.roundMiniBar}>
                      <div className={roundMiniBarClass} style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className={styles.questionNavSection}>
            <p className={styles.sidebarSectionLabel}>Questions — Round {roundData.round_number}</p>
            <div className={styles.qGrid}>
              {questions.map((q, i) => {
                const state = getQuestionButtonState(q, i, currentIdx, answers, visitedQuestions);
                return (
                  <button
                    key={q.id}
                    type="button"
                    className={getQBtnClass(state, styles)}
                    onClick={() => {
                      navigateTo(i);
                      setLeftSidebarOpen(false);
                    }}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <div className={styles.legend}>
              <div className={styles.legendItem}>
                <div className={`${styles.legendDot} ${styles.legendAnswered}`} />
                <span>Answered</span>
              </div>
              <div className={styles.legendItem}>
                <div className={`${styles.legendDot} ${styles.legendVisited}`} />
                <span>Visited</span>
              </div>
              <div className={styles.legendItem}>
                <div className={`${styles.legendDot} ${styles.legendActive}`} />
                <span>Current</span>
              </div>
              <div className={styles.legendItem}>
                <div className={styles.legendDot} />
                <span>Not visited</span>
              </div>
            </div>
          </div>
        </aside>

        {leftSidebarOpen && (
          <div
            className={styles.leftSidebarBackdrop}
            onClick={() => setLeftSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* ── Main Content ── */}
        <main className={styles.main}>
          <div className={styles.roundBadgeRow}>
            <span className={styles.roundChip}>Round {roundData.round_number}</span>
            <span className={styles.questionCounter}>
              Q{currentIdx + 1} of {questions.length}
            </span>
            <span className={styles.qTypeChip}>{getQuestionTypeLabel(currentQuestion.type)}</span>
          </div>

          <div className={styles.questionCard}>
            <div className={styles.questionBody}>
              <RichText className={styles.questionText}>{currentQuestion.text}</RichText>

              {currentQuestion.type === "mcq_single" && (
                <div className={styles.options}>
                  {currentQuestion.options?.map((opt) => {
                    const selected = answers[currentQuestion.id] === opt.text;
                    return (
                      <label
                        key={opt.text}
                        className={`${styles.option} ${selected ? styles.optionSelected : ""}`}
                      >
                        <input
                          type="radio"
                          className={styles.optionInput}
                          name={currentQuestion.id}
                          checked={selected}
                          onChange={() => setAnswer(currentQuestion.id, opt.text)}
                        />
                        <span className={styles.optionText}>{opt.text}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {currentQuestion.type === "mcq_multiple" && (
                <div className={styles.options}>
                  {currentQuestion.options?.map((opt) => {
                    const selected = ((answers[currentQuestion.id] as string[]) || []).includes(
                      opt.text
                    );
                    return (
                      <label
                        key={opt.text}
                        className={`${styles.option} ${selected ? styles.optionSelected : ""}`}
                      >
                        <input
                          type="checkbox"
                          className={styles.optionInput}
                          checked={selected}
                          onChange={() => {
                            const current = (answers[currentQuestion.id] as string[]) || [];
                            const updated = selected
                              ? current.filter((v) => v !== opt.text)
                              : [...current, opt.text];
                            setAnswer(currentQuestion.id, updated);
                          }}
                        />
                        <span className={styles.optionText}>{opt.text}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {currentQuestion.type === "essay" && (
                <div className={styles.essayWrapper}>
                  <textarea
                    className={styles.essayBox}
                    placeholder="Write your answer here..."
                    value={answers[currentQuestion.id] || ""}
                    onChange={(e) => setAnswer(currentQuestion.id, e.target.value)}
                    rows={10}
                  />
                  <span className={styles.charCount}>
                    {((answers[currentQuestion.id] as string) || "").length} characters
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className={styles.navRow}>
            <Button
              variant="secondary"
              onClick={() => navigateTo(Math.max(0, currentIdx - 1))}
              disabled={currentIdx === 0}
            >
              Previous
            </Button>
            <div className={styles.navRight}>
              {currentIdx < questions.length - 1 ? (
                <Button onClick={() => navigateTo(currentIdx + 1)}>Next</Button>
              ) : (
                <Button onClick={() => setShowSubmitConfirm(true)} isLoading={submitting}>
                  Submit Round
                </Button>
              )}
            </div>
          </div>
        </main>

        {/* ── Right Sidebar ── */}
        <aside className={styles.rightSidebar}>
          <div className={`${styles.timerCard} ${isLowTime ? styles.timerLow : ""}`}>
            <p className={styles.sidebarSectionLabel}>
              Time Remaining
              {!timerActive && networkStatus !== "connected" && (
                <span style={{ fontSize: 11, color: "var(--warning-600, #d97706)", marginLeft: 6 }}>
                  (paused)
                </span>
              )}
            </p>
            <div className={styles.timerBoxRow}>
              <div className={styles.timerBox}>
                <span className={styles.timerDigit}>{hh}</span>
                <span className={styles.timerLabel}>Hrs</span>
              </div>
              <span className={styles.timerSep}>:</span>
              <div className={styles.timerBox}>
                <span className={styles.timerDigit}>{mm}</span>
                <span className={styles.timerLabel}>Min</span>
              </div>
              <span className={styles.timerSep}>:</span>
              <div className={styles.timerBox}>
                <span className={styles.timerDigit}>{ss}</span>
                <span className={styles.timerLabel}>Sec</span>
              </div>
            </div>
          </div>

          <div className={styles.monitoringStatus}>
            <p className={styles.sidebarSectionLabel}>Monitoring</p>
            <div className={styles.monitorBadgeList}>
              {monitoringConfig.video_monitoring && (
                <div className={`${styles.monitorBadge} ${styles.monitorBadgeGreen}`}>
                  <span className={styles.monitorBadgeDot} /> Camera Active
                </div>
              )}
              {monitoringConfig.audio_monitoring && (
                <div className={`${styles.monitorBadge} ${styles.monitorBadgeGreen}`}>
                  <span className={styles.monitorBadgeDot} /> Mic Active
                </div>
              )}
              {monitoringConfig.screenshot_enabled && (
                <div
                  className={`${styles.monitorBadge} ${isScreenCapturing ? styles.monitorBadgeGreen : styles.monitorBadgeOrange}`}
                >
                  <span className={styles.monitorBadgeDot} />{" "}
                  {isScreenCapturing ? "Screen Capture Active" : "Screen Capture Inactive"}
                </div>
              )}
              <div className={`${styles.monitorBadge} ${networkBadgeClass}`}>
                <span className={styles.monitorBadgeDot} /> {networkLabel}
              </div>
            </div>
          </div>

          {monitoringConfig.video_monitoring && (
            <div className={styles.monitorCard}>
              <VideoMonitor
                videoRef={videoRef}
                onWarning={() => void flagViolation({ type: "face_absence" })}
              />
            </div>
          )}

          {monitoringConfig.audio_monitoring && (
            <div className={styles.monitorCard}>
              <AudioMonitor analyserRef={analyserRef} active={audioActive} />
            </div>
          )}
        </aside>

        <button
          type="button"
          className={styles.leftToggleBtn}
          onClick={() => setLeftSidebarOpen((v) => !v)}
          aria-label="Toggle progress panel"
        >
          ☰
        </button>
      </div>

      {/* ── Modals ── */}

      <Modal
        isOpen={showSubmitConfirm}
        onClose={() => setShowSubmitConfirm(false)}
        title="Submit Round?"
        size="sm"
        disableBackdropClose
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowSubmitConfirm(false)}>
              Review Answers
            </Button>
            <Button onClick={() => void handleFinishRound()} isLoading={submitting}>
              Submit
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          You&apos;ve answered {answeredCount} of {questions.length} questions. Once submitted, you
          cannot change your answers.
        </p>
      </Modal>

      <MalpracticeWarningModal />

      <Modal
        isOpen={adminWarningMessage !== null}
        onClose={() => setAdminWarningMessage(null)}
        title="Message from Administrator"
        size="sm"
        disableBackdropClose
        footer={<Button onClick={() => setAdminWarningMessage(null)}>Acknowledge</Button>}
      >
        <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>{adminWarningMessage}</p>
      </Modal>

      <Modal
        isOpen={showTimeExpired}
        onClose={() => {
          setShowTimeExpired(false);
          navigate(`/assessment/${shareLink}/completed`);
        }}
        title="Time's Up"
        size="sm"
        disableBackdropClose
        footer={
          <Button
            onClick={() => {
              setShowTimeExpired(false);
              navigate(`/assessment/${shareLink}/completed`);
            }}
          >
            Continue
          </Button>
        }
      >
        <p style={{ fontSize: 14, color: "var(--text-secondary)", textAlign: "center" }}>
          Your time for this round has expired. Your answers have been automatically submitted.
        </p>
      </Modal>

      {/* Fullscreen enforcement modal — blocks all interaction until fullscreen is restored */}
      <Modal
        isOpen={fullscreenBlocked}
        onClose={() => void requestFullscreen()}
        title="Fullscreen Required"
        size="sm"
        showClose={false}
        disableBackdropClose
        disableEscapeKey
        footer={
          <Button fullWidth onClick={() => void requestFullscreen()}>
            Return to Fullscreen
          </Button>
        }
      >
        <p style={{ fontSize: 14, color: "var(--text-secondary)", textAlign: "center" }}>
          You must remain in fullscreen mode during the interview. Exiting fullscreen has been
          recorded as a violation. Click the button below to resume.
        </p>
      </Modal>
    </div>
  );
}
