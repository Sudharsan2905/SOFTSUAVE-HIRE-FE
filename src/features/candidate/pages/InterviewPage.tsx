import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  RefObject,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import styles from "./InterviewPage.module.css";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { api } from "@/utils/api";
import { CandidateQuestion, MonitoringConfig, RoundConfig } from "@/types";
import { IconAlertTriangle } from "@/assets/icons";
import { RichText } from "@/components/ui/RichText";
import CandidateHeader from "@/features/candidate/components/CandidateHeader";
import { VideoMonitor } from "@/features/candidate/components/VideoMonitor";
import { AudioMonitor } from "@/features/candidate/components/AudioMonitor";
import { useTabMonitoring } from "@/features/candidate/hooks/useTabMonitoring";
import { useAudioMonitoring } from "@/features/candidate/hooks/useAudioMonitoring";
import { useAppSelector } from "@/store/hooks";
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
}

interface AssessmentData {
  rounds: RoundConfig[];
}

type AnswerMap = Record<string, string | string[]>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatHMS(totalSeconds: number): { hh: string; mm: string; ss: string } {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return {
    hh: h.toString().padStart(2, "0"),
    mm: m.toString().padStart(2, "0"),
    ss: s.toString().padStart(2, "0"),
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InterviewPage() {
  const { shareLink, submissionId } = useParams<{
    shareLink: string;
    submissionId: string;
  }>();
  const navigate = useNavigate();

  // Redux user name
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
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showMalpractice, setShowMalpractice] = useState(false);
  const [showTimeExpired, setShowTimeExpired] = useState(false);
  const [malpracticeCount, setMalpracticeCount] = useState(0);
  const [malpracticeType, setMalpracticeType] = useState("tab_switch");

  // ── Assessment / rounds state ───────────────────────────────────────────────
  const [assessmentRounds, setAssessmentRounds] = useState<RoundConfig[]>([]);
  const [roundsExpanded, setRoundsExpanded] = useState<Record<number, boolean>>({});
  const [monitoringConfig, setMonitoringConfig] = useState<Partial<MonitoringConfig>>({});

  // ── Monitoring state ────────────────────────────────────────────────────────
  const [audioActive, setAudioActive] = useState(false);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null) as RefObject<HTMLVideoElement>;
  const analyserRef = useRef<AnalyserNode | null>(null);
  const screenshotIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const answerSyncRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submittingRef = useRef(false);
  // Stable ref for finish-round so malpractice callback is always current
  const finishRoundRef = useRef<(autoSubmit?: boolean) => Promise<void>>(
    async () => { /* placeholder, replaced below */ }
  );

  // Keep submittingRef in sync
  useEffect(() => {
    submittingRef.current = submitting;
  }, [submitting]);

  // ── Data fetching ───────────────────────────────────────────────────────────
  const fetchRound = useCallback(async (): Promise<{ round: InterviewRoundData | null; monitoring: Partial<MonitoringConfig> }> => {
    const { data } = await api.get(
      `/api/candidate/submission/${submissionId}/round`
    );
    const responseData: RoundApiResponse = data.data ?? {};
    const monitoring: Partial<MonitoringConfig> = {
      tab_monitoring: responseData.tab_monitoring ?? false,
      video_monitoring: responseData.video_monitoring ?? false,
      audio_monitoring: responseData.audio_monitoring ?? false,
      screenshot_enabled: responseData.screenshot_enabled ?? false,
      screenshot_interval_minutes: responseData.screenshot_interval_minutes,
      screenshot_count: responseData.screenshot_count,
    };
    return { round: responseData.round ?? null, monitoring };
  }, [submissionId]);

  const fetchAssessment = useCallback(async (): Promise<AssessmentData | null> => {
    if (!shareLink) return null;
    const { data } = await api.get(`/api/candidate/assessment/${shareLink}`);
    return data.data as AssessmentData;
  }, [shareLink]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [{ round: rd, monitoring: cfg }, assessment] = await Promise.all([
        fetchRound(),
        fetchAssessment(),
      ]);

      if (rd) {
        setRoundData(rd);
        setTimeLeft((rd.max_duration_minutes || 30) * 60);
        setMonitoringConfig(cfg);
        setRoundsExpanded({ [rd.round_number]: true });
      }

      if (assessment?.rounds) {
        setAssessmentRounds(assessment.rounds);
      }
    } catch {
      toast.error("Failed to load questions");
    } finally {
      setIsLoading(false);
    }
  }, [fetchRound, fetchAssessment]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // ── Answer sync ─────────────────────────────────────────────────────────────
  const syncAnswer = useCallback(
    (questionId: string, answer: string | string[]) => {
      if (answerSyncRef.current) clearTimeout(answerSyncRef.current);
      answerSyncRef.current = setTimeout(async () => {
        try {
          await api.post(`/api/candidate/submission/${submissionId}/answer`, {
            question_id: questionId,
            answer,
          });
        } catch {
          /* silent */
        }
      }, 500);
    },
    [submissionId]
  );

  const setAnswer = useCallback(
    (questionId: string, answer: string | string[]) => {
      setAnswers((prev) => ({ ...prev, [questionId]: answer }));
      syncAnswer(questionId, answer);
    },
    [syncAnswer]
  );

  // Stable ref so navigateTo can read the latest roundData without being a dep
  const roundDataRef = useRef<InterviewRoundData | null>(null);
  useEffect(() => {
    roundDataRef.current = roundData;
  }, [roundData]);

  // Stable ref for currentIdx
  const currentIdxRef = useRef(0);
  useEffect(() => {
    currentIdxRef.current = currentIdx;
  }, [currentIdx]);

  // ── Navigation helpers ──────────────────────────────────────────────────────
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

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      try {
        const { data } = await api.post(
          `/api/candidate/submission/${submissionId}/finish-round`
        );
        if (data.data?.completed) {
          navigate(`/assessment/${shareLink}/completed`);
        } else {
          setRoundData(null);
          setCurrentIdx(0);
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

  // Keep finishRoundRef current so malpractice can call it without stale closure
  useEffect(() => {
    finishRoundRef.current = handleFinishRound;
  }, [handleFinishRound]);

  // ── Malpractice handler ─────────────────────────────────────────────────────
  const handleMalpractice = useCallback(
    async (type: string) => {
      setMalpracticeCount((prev) => {
        const newCount = prev + 1;
        if (newCount >= 3) {
          // Trigger auto-submit outside this updater to avoid nested setState issues
          setTimeout(() => {
            setShowMalpractice(false);
            void finishRoundRef.current(true);
          }, 0);
        }
        return newCount;
      });
      setMalpracticeType(type);
      setShowMalpractice(true);

      try {
        await api.post(`/api/candidate/submission/${submissionId}/malpractice`, {
          type,
        });
      } catch {
        /* silent */
      }
    },
    [submissionId]
  );

  // ── Tab monitoring hook (unconditional) ────────────────────────────────────
  useTabMonitoring({
    enabled: monitoringConfig.tab_monitoring ?? false,
    submissionId: submissionId ?? "",
    onViolation: useCallback(() => {
      void handleMalpractice("tab_switch");
    }, [handleMalpractice]),
  });

  // ── Audio monitoring hook (unconditional) ──────────────────────────────────
  useAudioMonitoring({
    enabled: monitoringConfig.audio_monitoring ?? false,
    submissionId: submissionId ?? "",
    analyserRef,
    onViolation: useCallback(() => {
      void handleMalpractice("audio_violation");
    }, [handleMalpractice]),
  });

  // ── Camera stream ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!monitoringConfig.video_monitoring) return;
    let stream: MediaStream | null = null;
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch {
        /* camera optional */
      }
    };
    void startCamera();
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [monitoringConfig.video_monitoring]);

  // Track audio active state when audio monitoring starts
  useEffect(() => {
    if (monitoringConfig.audio_monitoring) {
      setAudioActive(true);
    }
  }, [monitoringConfig.audio_monitoring]);

  // ── Countdown timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!roundData) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          if (!submittingRef.current) {
            void finishRoundRef.current(true).then(() => {
              setShowTimeExpired(true);
            });
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [roundData]);

  // ── Screenshot capture ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!monitoringConfig.screenshot_enabled || !submissionId) return;

    const intervalMs =
      (monitoringConfig.screenshot_interval_minutes ?? 0.5) * 60 * 1000;

    screenshotIntervalRef.current = setInterval(async () => {
      const video = videoRef.current;
      if (!video || !video.videoWidth) return;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 240;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(video, 0, 0);
        canvas.toBlob(
          async (blob) => {
            if (!blob) return;
            const fd = new FormData();
            fd.append("file", blob, "screenshot.jpg");
            await api.post(
              `/api/candidate/submission/${submissionId}/screenshot`,
              fd,
              { headers: { "Content-Type": "multipart/form-data" } }
            );
          },
          "image/jpeg",
          0.7
        );
      } catch {
        /* silent */
      }
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
  ]);

  // ── Accordion toggle ────────────────────────────────────────────────────────
  const toggleAccordion = (roundNumber: number) => {
    setRoundsExpanded((prev) => ({
      ...prev,
      [roundNumber]: !prev[roundNumber],
    }));
  };

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
  const isLowTime = timeLeft < 120;
  const { hh, mm, ss } = formatHMS(timeLeft);

  type QBtnState = "answered" | "visited" | "active" | "default";

  const getQuestionButtonState = (
    q: CandidateQuestion,
    idx: number,
    isCurrentRound: boolean
  ): QBtnState => {
    if (!isCurrentRound) return "default";
    if (idx === currentIdx) return "active";
    if (answers[q.id] !== undefined) return "answered";
    if (visitedQuestions.has(q.id)) return "visited";
    return "default";
  };

  const qBtnClass = (state: QBtnState): string => {
    switch (state) {
      case "answered":
        return `${styles.qBtn} ${styles.qBtnAnswered}`;
      case "visited":
        return `${styles.qBtn} ${styles.qBtnVisited}`;
      case "active":
        return `${styles.qBtn} ${styles.qBtnActive}`;
      default:
        return styles.qBtn;
    }
  };

  return (
    <div className={styles.page}>
      {/* Sticky header */}
      <CandidateHeader candidateName={candidateName} />

      {/* Body row */}
      <div className={styles.body}>
        {/* ── Main content (left, scrollable) ── */}
        <main className={styles.main}>
          {/* Round badge row */}
          <div className={styles.roundBadgeRow}>
            <span className={styles.roundChip}>Round {roundData.round_number}</span>
            <span className={styles.questionCounter}>
              Q{currentIdx + 1} of {questions.length}
            </span>
            <span className={styles.qTypeChip}>
              {currentQuestion.type === "essay"
                ? "Essay"
                : currentQuestion.type === "mcq_multiple"
                ? "Multiple Choice"
                : "Single Choice"}
            </span>
          </div>

          {/* Question card */}
          <div className={styles.questionCard}>
            <div className={styles.questionBody}>
              <RichText className={styles.questionText}>
                {currentQuestion.text}
              </RichText>

              {/* MCQ single */}
              {currentQuestion.type === "mcq_single" && (
                <div className={styles.options}>
                  {currentQuestion.options?.map((opt, oi) => {
                    const selected = answers[currentQuestion.id] === opt.text;
                    return (
                      <label
                        key={oi}
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

              {/* MCQ multiple */}
              {currentQuestion.type === "mcq_multiple" && (
                <div className={styles.options}>
                  {currentQuestion.options?.map((opt, oi) => {
                    const selected = (
                      (answers[currentQuestion.id] as string[]) || []
                    ).includes(opt.text);
                    return (
                      <label
                        key={oi}
                        className={`${styles.option} ${selected ? styles.optionSelected : ""}`}
                      >
                        <input
                          type="checkbox"
                          className={styles.optionInput}
                          checked={selected}
                          onChange={() => {
                            const current =
                              (answers[currentQuestion.id] as string[]) || [];
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

              {/* Essay */}
              {currentQuestion.type === "essay" && (
                <div className={styles.essayWrapper}>
                  <textarea
                    className={styles.essayBox}
                    placeholder="Write your answer here..."
                    value={(answers[currentQuestion.id] as string) || ""}
                    onChange={(e) =>
                      setAnswer(currentQuestion.id, e.target.value)
                    }
                    rows={10}
                  />
                  <span className={styles.charCount}>
                    {((answers[currentQuestion.id] as string) || "").length}{" "}
                    characters
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
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
                <Button
                  onClick={() => setShowSubmitConfirm(true)}
                  isLoading={submitting}
                >
                  Submit Round
                </Button>
              )}
            </div>
          </div>
        </main>

        {/* ── Right sidebar (fixed) ── */}
        <aside className={styles.sidebar}>
          {/* 1. Timer */}
          <div className={`${styles.timerCard} ${isLowTime ? styles.timerLow : ""}`}>
            <p className={styles.sidebarSectionLabel}>Time Remaining</p>
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

          {/* 2. Rounds accordion */}
          <div className={styles.roundsCard}>
            <p className={styles.sidebarSectionLabel}>Rounds</p>

            {/* Fallback: if assessment fetch returned no rounds, show current round only */}
            {assessmentRounds.length === 0 ? (
              <div className={styles.accordionItem}>
                <button
                  type="button"
                  className={`${styles.accordionHeader} ${styles.accordionHeaderActive}`}
                  onClick={() => toggleAccordion(roundData.round_number)}
                  aria-expanded={roundsExpanded[roundData.round_number] ?? true}
                >
                  <span>Round {roundData.round_number}</span>
                  <span className={styles.accordionChevron}>
                    {(roundsExpanded[roundData.round_number] ?? true) ? "▲" : "▼"}
                  </span>
                </button>
                {(roundsExpanded[roundData.round_number] ?? true) && (
                  <div className={styles.accordionBody}>
                    <div className={styles.qGrid}>
                      {questions.map((q, i) => {
                        const state = getQuestionButtonState(q, i, true);
                        return (
                          <button
                            key={q.id}
                            type="button"
                            className={qBtnClass(state)}
                            onClick={() => navigateTo(i)}
                          >
                            {i + 1}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              assessmentRounds.map((round) => {
                const isCurrentRound =
                  round.round_number === roundData.round_number;
                const isExpanded = roundsExpanded[round.round_number] ?? false;
                return (
                  <div key={round.round_number} className={styles.accordionItem}>
                    <button
                      type="button"
                      className={`${styles.accordionHeader} ${
                        isCurrentRound ? styles.accordionHeaderActive : ""
                      }`}
                      onClick={() => toggleAccordion(round.round_number)}
                      aria-expanded={isExpanded}
                    >
                      <span>Round {round.round_number}</span>
                      <span className={styles.accordionChevron}>
                        {isExpanded ? "▲" : "▼"}
                      </span>
                    </button>
                    {isExpanded && (
                      <div className={styles.accordionBody}>
                        {isCurrentRound ? (
                          <div className={styles.qGrid}>
                            {questions.map((q, i) => {
                              const state = getQuestionButtonState(
                                q,
                                i,
                                isCurrentRound
                              );
                              return (
                                <button
                                  key={q.id}
                                  type="button"
                                  className={qBtnClass(state)}
                                  onClick={() => navigateTo(i)}
                                >
                                  {i + 1}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className={styles.qGrid}>
                            {Array.from(
                              { length: round.question_count },
                              (_, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  className={`${styles.qBtn} ${styles.qBtnDisabled}`}
                                  disabled
                                >
                                  {i + 1}
                                </button>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Legend */}
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

          {/* 3. Stats card */}
          <div className={styles.statsCard}>
            <p className={styles.sidebarSectionLabel}>Progress</p>
            <div className={styles.statsRow}>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{questions.length}</span>
                <span className={styles.statLabel}>Total</span>
              </div>
              <div className={`${styles.statItem} ${styles.statAnswered}`}>
                <span className={styles.statValue}>{answeredCount}</span>
                <span className={styles.statLabel}>Answered</span>
              </div>
              <div className={`${styles.statItem} ${styles.statRemaining}`}>
                <span className={styles.statValue}>{remainingCount}</span>
                <span className={styles.statLabel}>Remaining</span>
              </div>
            </div>
          </div>

          {/* 4. Video monitor */}
          {monitoringConfig.video_monitoring && (
            <div className={styles.monitorCard}>
              <VideoMonitor
                videoRef={videoRef}
                onWarning={() => void handleMalpractice("camera_occlusion")}
              />
            </div>
          )}

          {/* 5. Audio monitor */}
          {monitoringConfig.audio_monitoring && (
            <div className={styles.monitorCard}>
              <AudioMonitor analyserRef={analyserRef} active={audioActive} />
            </div>
          )}
        </aside>
      </div>

      {/* ── Modals ── */}

      {/* Submit confirmation */}
      <Modal
        isOpen={showSubmitConfirm}
        onClose={() => setShowSubmitConfirm(false)}
        title="Submit Round?"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowSubmitConfirm(false)}
            >
              Review Answers
            </Button>
            <Button
              onClick={() => void handleFinishRound()}
              isLoading={submitting}
            >
              Submit
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          You've answered {answeredCount} of {questions.length} questions. Once
          submitted, you cannot change your answers.
        </p>
      </Modal>

      {/* Malpractice warning */}
      <Modal
        isOpen={showMalpractice}
        onClose={() => setShowMalpractice(false)}
        title="Warning: Suspicious Activity Detected"
        size="sm"
        footer={
          <Button onClick={() => setShowMalpractice(false)}>I Understand</Button>
        }
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            textAlign: "center",
          }}
        >
          <IconAlertTriangle size={40} color="var(--error-500)" />
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            A{" "}
            {malpracticeType === "tab_switch"
              ? "tab switch"
              : malpracticeType === "audio_violation"
              ? "noise / audio violation"
              : "suspicious activity"}{" "}
            has been detected and flagged ({malpracticeCount} violation
            {malpracticeCount !== 1 ? "s" : ""}). Please stay on this page.{" "}
            {malpracticeCount >= 2 &&
              "One more violation will result in automatic submission."}
          </p>
        </div>
      </Modal>

      {/* Time expired */}
      <Modal
        isOpen={showTimeExpired}
        onClose={() => {
          setShowTimeExpired(false);
          navigate(`/assessment/${shareLink}/completed`);
        }}
        title="Time's Up"
        size="sm"
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
          Your time for this round has expired. Your answers have been
          automatically submitted.
        </p>
      </Modal>
    </div>
  );
}
