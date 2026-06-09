import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import styles from "./InterviewPage.module.css";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { api } from "@/utils/api";
import { API_ENDPOINTS } from "@/constants/api";
import { ROUTES } from "@/constants/routes";
import { CandidateQuestion, MonitoringConfig, RoundConfig } from "@/types";
import { RichText } from "@/components/ui/RichText";
import CandidateHeader from "@/features/candidate/components/CandidateHeader";
import { VideoMonitor } from "@/features/candidate/components/VideoMonitor";
import { AudioMonitor } from "@/features/candidate/components/AudioMonitor";
import { ConnectionLostOverlay } from "@/features/candidate/components/ConnectionLostOverlay";
import { ExamSetupScreen } from "@/features/candidate/components/ExamSetupScreen";
import { useTabMonitoring } from "@/features/candidate/hooks/useTabMonitoring";
import { useAudioMonitoring } from "@/features/candidate/hooks/useAudioMonitoring";
import { useVideoMonitoring } from "@/features/candidate/hooks/useVideoMonitoring";
import { useScreenMonitoring } from "@/features/candidate/hooks/useScreenMonitoring";
import { useDevtoolsMonitoring } from "@/features/candidate/hooks/useDevtoolsMonitoring";
import {
  useMalpracticeCoordinator,
  ViolationPayload,
} from "@/features/candidate/hooks/useMalpracticeCoordinator";
import { useRoundTimer } from "@/features/candidate/hooks/useRoundTimer";
import { useAnswerSync } from "@/features/candidate/hooks/useAnswerSync";
import { useFullscreenEnforcement } from "@/features/candidate/hooks/useFullscreenEnforcement";
import { useScreenCapture } from "@/features/candidate/hooks/useScreenCapture";
import { useLiveKitPublisher } from "@/features/candidate/hooks/useLiveKit";
import { MalpracticeWarningModal } from "@/features/candidate/components/MalpracticeWarningModal";
import { useInterviewSession } from "@/features/candidate/context/InterviewSessionContext";
import { useAppSelector } from "@/store/hooks";
import { markAssessmentDone } from "@/utils/assessmentSession";
import { takeCameraStream } from "@/features/candidate/services/screenCaptureStore";
import { useExamOrchestrator, ExamPhase } from "@/features/candidate/hooks/useExamOrchestrator";
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
  screenshot_interval_seconds?: number;
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

function getRoundStatusClass(isActive: boolean, isCompleted: boolean, sm: Record<string, string>) {
  if (isActive) return sm.roundStatusActive;
  if (isCompleted) return sm.roundStatusCompleted;
  return sm.roundStatusPending;
}

function getRoundStatusLabel(isActive: boolean, isCompleted: boolean) {
  if (isActive) return "Active";
  if (isCompleted) return "Done";
  return "Pending";
}

function getRoundMiniBarClass(isActive: boolean, isCompleted: boolean, sm: Record<string, string>) {
  if (isActive) return `${sm.roundMiniBarFill} ${sm.roundMiniBarActive}`;
  if (isCompleted) return `${sm.roundMiniBarFill} ${sm.roundMiniBarDone}`;
  return sm.roundMiniBarFill;
}

function getQuestionTypeLabel(type: string) {
  if (type === "essay") return "Essay";
  if (type === "mcq_multiple") return "Multiple Choice";
  return "Single Choice";
}

const VIOLATION_DEBOUNCE_MS = 2_000;

// ─── Component ────────────────────────────────────────────────────────────────

export default function InterviewPage() {
  const { shareLink, submissionId } = useParams<{ shareLink: string; submissionId: string }>();
  const navigate = useNavigate();

  const user = useAppSelector((s) => s.auth.user);
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
  // These modals only appear AFTER the exam is ACTIVE
  const [fullscreenBlocked, setFullscreenBlocked] = useState(false);
  const [screenShareBlocked, setScreenShareBlocked] = useState(false);

  const [assessmentRounds, setAssessmentRounds] = useState<RoundConfig[]>([]);
  const [monitoringConfig, setMonitoringConfig] = useState<Partial<MonitoringConfig>>({});
  const [timerActive, setTimerActive] = useState(false);
  const [audioActive, setAudioActive] = useState(false);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false);

  // Readiness signals — fed into the orchestrator
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isAudioReady, setIsAudioReady] = useState(false);
  // Tracks document.fullscreenElement independently — fed into orchestrator
  const [isFullscreen, setIsFullscreen] = useState(() => !!document.fullscreenElement);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const captureFrameRef = useRef<(() => Promise<Blob | null>) | null>(null);
  const screenshotIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submittingRef = useRef(false);
  const finishRoundRef = useRef<(autoSubmit?: boolean) => Promise<void>>(async () => { return; });
  const currentIdxRef = useRef(0);
  const roundDataRef = useRef<InterviewRoundData | null>(null);
  const violationCooldownRef = useRef<Partial<Record<string, number>>>({});

  useEffect(() => {
    submittingRef.current = submitting;
  }, [submitting]);
  useEffect(() => {
    roundDataRef.current = roundData;
  }, [roundData]);

  // Independent fullscreen tracker — no circular dep with orchestrator
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    document.addEventListener("webkitfullscreenchange", handler);
    return () => {
      document.removeEventListener("fullscreenchange", handler);
      document.removeEventListener("webkitfullscreenchange", handler);
    };
  }, []);

  // Exit fullscreen on unmount (navigation away from interview)
  useEffect(() => {
    return () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    };
  }, []);

  // ── Timer ───────────────────────────────────────────────────────────────────
  const handleTimerExpiry = useCallback(() => {
    if (!submittingRef.current) {
      void finishRoundRef.current(true).then(() => setShowTimeExpired(true));
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

  // ── WebSocket session — must be before orchestrator (provides networkStatus) ─
  const { networkStatus, sessionSubmissionId, startSession, registerCallbacks } =
    useInterviewSession();

  useEffect(() => {
    if (submissionId && sessionSubmissionId !== submissionId) startSession(submissionId);
  }, [submissionId, sessionSubmissionId, startSession]);

  useEffect(() => {
    registerCallbacks({
      onSessionState: (remainingSeconds, questionIdx) => {
        if (remainingSeconds !== null) setTimeLeft(remainingSeconds);
        if (questionIdx !== undefined) {
          setCurrentIdx(questionIdx);
          currentIdxRef.current = questionIdx;
        }
      },
      onResumeApproved: (remainingSeconds, questionIdx) => {
        if (remainingSeconds !== null) setTimeLeft(remainingSeconds);
        if (questionIdx !== undefined) {
          setCurrentIdx(questionIdx);
          currentIdxRef.current = questionIdx;
        }
        toast.success("Your interview has been resumed by the administrator.");
      },
      onTerminated: () => {
        toast.error("Your session has been terminated by an administrator.");
        setTimeout(() => navigate(ROUTES.ASSESSMENT.entry(shareLink ?? "")), 2000);
      },
      onAdminWarning: (message: string) => setAdminWarningMessage(message),
      getRemainingSeconds: () => timeLeftRef.current,
      getCurrentQuestionIdx: () => currentIdxRef.current,
    });
  }, [registerCallbacks, navigate, shareLink]);

  // ── Screen capture — initialized once orchestrator opens the gate ───────────
  // shouldInitScreenCapture starts false; an effect below sets it true when
  // the orchestrator reaches VALIDATING_SCREEN_SHARE. This breaks the
  // circular dependency between useScreenCapture and useExamOrchestrator.
  const [shouldInitScreenCapture, setShouldInitScreenCapture] = useState(false);

  const {
    captureFrame,
    isCapturing: isScreenCapturing,
    isInitialized: isScreenCaptureInitialized,
    startScreenCapture,
    streamRef: screenStreamRef,
  } = useScreenCapture({ shouldInitialize: shouldInitScreenCapture });

  captureFrameRef.current = captureFrame;

  // ── Exam orchestrator (state machine) ───────────────────────────────────────
  const {
    phase,
    phaseLabel,
    phaseError,
    examActiveRef,
    isPermissionFlowActiveRef,
    shouldAcquireCamera,
    shouldAcquireAudio,
    shouldAcquireScreen,
    shouldEnforceFullscreen,
    setPhaseError,
    markPermissionFlowStart,
    markPermissionFlowEnd,
  } = useExamOrchestrator({
    enabled: !isLoading && !!roundData,
    config: monitoringConfig,
    networkStatus,
    isCameraReady,
    isAudioReady,
    isScreenShareReady: isScreenCapturing,
    isFullscreen,
  });

  // Open the screen capture gate when the orchestrator signals it
  useEffect(() => {
    if (shouldAcquireScreen && !shouldInitScreenCapture) {
      setShouldInitScreenCapture(true);
    }
  }, [shouldAcquireScreen, shouldInitScreenCapture]);

  // Timer only runs once the exam is ACTIVE — paused during setup and on network loss
  useEffect(() => {
    const isOffline =
      networkStatus === "offline" ||
      networkStatus === "reconnecting" ||
      networkStatus === "on_hold";
    setTimerActive(phase >= ExamPhase.ACTIVE && !isOffline);
  }, [networkStatus, phase]);

  // ── Data fetching ───────────────────────────────────────────────────────────
  const fetchRound = useCallback(async () => {
    const { data } = await api.get(API_ENDPOINTS.CANDIDATE.SUBMISSION_ROUND(submissionId!));
    const rd: RoundApiResponse = data.data ?? {};
    const monitoring: Partial<MonitoringConfig> = {
      tab_monitoring: rd.tab_monitoring ?? false,
      video_monitoring: rd.video_monitoring ?? false,
      audio_monitoring: rd.audio_monitoring ?? false,
      screenshot_enabled: rd.screenshot_enabled ?? false,
      screenshot_interval_seconds: rd.screenshot_interval_seconds,
      screenshot_count: rd.screenshot_count,
    };
    return {
      round: rd.round ?? null,
      monitoring,
      remainingSeconds: rd.remaining_seconds ?? null,
      questionIdx: rd.current_question_idx ?? 0,
    };
  }, [submissionId]);

  const fetchAssessment = useCallback(async (): Promise<AssessmentData | null> => {
    if (!shareLink) return null;
    const { data } = await api.get(API_ENDPOINTS.CANDIDATE.ASSESSMENT(shareLink));
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
        navigate(
          isRevoked ? ROUTES.ASSESSMENT.entry(shareLink!) : ROUTES.ASSESSMENT.completed(shareLink!),
          {
            replace: true,
          }
        );
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
        setTimeLeft(remainingSeconds ?? (rd.max_duration_minutes || 30) * 60);
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

  // ── Answer helpers ──────────────────────────────────────────────────────────
  const setAnswer = useCallback(
    (questionId: string, answer: string | string[]) => {
      setAnswers((prev) => ({ ...prev, [questionId]: answer }));
      syncAnswerToServer(questionId, answer);
    },
    [syncAnswerToServer]
  );

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
      if (rd) {
        const leaving = rd.questions[currentIdxRef.current];
        if (leaving) markVisited(leaving.id);
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
        const { data } = await api.post(
          API_ENDPOINTS.CANDIDATE.SUBMISSION_FINISH_ROUND(submissionId!)
        );
        if (data.data?.completed) {
          if (shareLink) markAssessmentDone(shareLink);
          navigate(ROUTES.ASSESSMENT.completed(shareLink!), { replace: true });
        } else {
          // Round transition — reset media readiness so orchestrator re-validates
          setRoundData(null);
          setCurrentIdx(0);
          currentIdxRef.current = 0;
          setAnswers({});
          setVisitedQuestions(new Set());
          setIsCameraReady(false);
          setIsAudioReady(false);
          setShouldInitScreenCapture(false);
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
      setTimeout(() => void finishRoundRef.current(true), 500);
    }, []),
    videoRef,
    screenStreamRef,
    audioStreamRef,
    captureScreenFrame: useCallback(() => captureFrameRef.current?.() ?? Promise.resolve(null), []),
  });

  // ── Safe violation wrapper ──────────────────────────────────────────────────
  // All malpractice calls pass through here. Violations are silently dropped
  // unless examActiveRef is true (exam ACTIVE + network connected).
  const flagViolationSafe = useCallback(
    async (event: ViolationPayload): Promise<void> => {
      if (!examActiveRef.current) return;
      const now = performance.now();
      const last = violationCooldownRef.current[event.type] ?? 0;
      if (now - last < VIOLATION_DEBOUNCE_MS) return;
      violationCooldownRef.current[event.type] = now;
      return flagViolation(event);
    },
    [flagViolation, examActiveRef]
  );

  // ── Fullscreen enforcement ──────────────────────────────────────────────────
  // Enabled only after the orchestrator reaches the fullscreen validation phase.
  // onExit is only actionable once the exam is ACTIVE (guarded by flagViolationSafe).
  const { requestFullscreen } = useFullscreenEnforcement({
    enabled: shouldEnforceFullscreen,
    onBlockRequired: useCallback(() => {
      // During active exam: show blocking modal. During setup: ExamSetupScreen handles it.
      if (examActiveRef.current) setFullscreenBlocked(true);
    }, [examActiveRef]),
    onExit: useCallback(
      (description: string) => {
        if (examActiveRef.current) {
          setFullscreenBlocked(true);
          void flagViolationSafe({ type: "fullscreen_exit", description });
        }
      },
      [examActiveRef, flagViolationSafe]
    ),
  });

  useEffect(() => {
    if (isFullscreen && fullscreenBlocked) setFullscreenBlocked(false);
  }, [isFullscreen, fullscreenBlocked]);

  // ── Camera stream ───────────────────────────────────────────────────────────
  // Gated on shouldAcquireCamera — no camera dialog until orchestrator signals.
  useEffect(() => {
    if (!monitoringConfig.video_monitoring || !shouldAcquireCamera) return;
    let cancelled = false;

    const setup = async () => {
      const stored = takeCameraStream();
      let stream: MediaStream | null = null;
      try {
        stream = stored ?? (await navigator.mediaDevices.getUserMedia({ video: true }));
      } catch {
        setPhaseError("Camera access was denied. Please allow camera permission and retry.");
        return;
      }
      if (cancelled) {
        if (!stored) stream.getTracks().forEach((t) => t.stop());
        return;
      }
      cameraStreamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setIsCameraReady(true);
    };

    void setup();

    return () => {
      cancelled = true;
      cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
      setIsCameraReady(false);
    };
  }, [monitoringConfig.video_monitoring, shouldAcquireCamera, setPhaseError]);

  // Rebind camera stream after round transitions or when the exam goes ACTIVE.
  // The <video> element only exists in the DOM once the active exam UI mounts
  // (phase >= ACTIVE), so the initial stream assignment during VALIDATING_VIDEO
  // always finds videoRef.current null and must be retried here.
  useEffect(() => {
    const stream = cameraStreamRef.current;
    if (!stream || !videoRef.current) return;
    if (videoRef.current.srcObject !== stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => undefined);
    }
  }, [roundData, phase]);

  useEffect(() => {
    if (monitoringConfig.audio_monitoring) setAudioActive(true);
  }, [monitoringConfig.audio_monitoring]);

  // ── Audio monitoring ────────────────────────────────────────────────────────
  useAudioMonitoring({
    enabled: monitoringConfig.audio_monitoring ?? false,
    shouldInitialize: shouldAcquireAudio,
    analyserRef,
    onStreamReady: useCallback((stream: MediaStream) => {
      audioStreamRef.current = stream;
      setIsAudioReady(true);
    }, []),
    onViolation: useCallback(
      (description: string) => {
        void flagViolationSafe({ type: "audio_violation", description });
      },
      [flagViolationSafe]
    ),
  });

  // ── Video monitoring ────────────────────────────────────────────────────────
  // Begin loading MediaPipe as soon as camera is ready; violations guarded by flagViolationSafe.
  useVideoMonitoring({
    enabled: monitoringConfig.video_monitoring ?? false,
    videoRef,
    onViolation: useCallback(
      (type, description) => {
        void flagViolationSafe({ type, description });
      },
      [flagViolationSafe]
    ),
  });

  // ── Screen monitoring (screen share stop) ───────────────────────────────────
  useScreenMonitoring({
    enabled: monitoringConfig.tab_monitoring ?? false,
    onViolation: useCallback(
      (type, description) => {
        void flagViolationSafe({ type, description });
      },
      [flagViolationSafe]
    ),
  });

  // ── DevTools monitoring ─────────────────────────────────────────────────────
  // Only active once exam is ACTIVE (examActiveRef gates it internally too).
  useDevtoolsMonitoring({
    enabled: monitoringConfig.tab_monitoring ?? false,
    examActiveRef,
    onViolation: useCallback(
      (type, description) => {
        void flagViolationSafe({ type, description });
      },
      [flagViolationSafe]
    ),
  });

  // ── Tab monitoring ──────────────────────────────────────────────────────────
  useTabMonitoring({
    enabled: monitoringConfig.tab_monitoring ?? false,
    examActiveRef,
    isPermissionFlowActiveRef,
    onViolation: useCallback(
      (description: string) => {
        void flagViolationSafe({ type: "tab_switch", description });
      },
      [flagViolationSafe]
    ),
  });

  // ── LiveKit ─────────────────────────────────────────────────────────────────
  const { isPublishing: isLkPublishing, startPublishing: startLkPublishing } = useLiveKitPublisher({
    submissionId: submissionId ?? null,
    enabled: !isLoading && !!roundData,
    screenStreamRef,
    cameraStreamRef,
    audioStreamRef,
  });

  useEffect(() => {
    if (isScreenCapturing && !isLkPublishing) void startLkPublishing();
  }, [isScreenCapturing, isLkPublishing, startLkPublishing]);

  // ── Screen share recovery (active exam only) ────────────────────────────────
  useEffect(() => {
    if (!monitoringConfig.screenshot_enabled) return;
    if (!isScreenCaptureInitialized) return;
    if (!isScreenCapturing && examActiveRef.current) setScreenShareBlocked(true);
  }, [
    monitoringConfig.screenshot_enabled,
    isScreenCaptureInitialized,
    isScreenCapturing,
    examActiveRef,
  ]);

  useEffect(() => {
    if (isScreenCapturing && screenShareBlocked) setScreenShareBlocked(false);
  }, [isScreenCapturing, screenShareBlocked]);

  // ── Screen capture with permission flow guard ───────────────────────────────
  const startScreenCaptureWithGuard = useCallback(async (): Promise<boolean> => {
    markPermissionFlowStart();
    try {
      return await startScreenCapture();
    } finally {
      markPermissionFlowEnd();
    }
  }, [startScreenCapture, markPermissionFlowStart, markPermissionFlowEnd]);

  // ── Periodic screenshot ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!monitoringConfig.screenshot_enabled || !submissionId) return;
    if (!isScreenCapturing) return;
    const intervalMs = (monitoringConfig.screenshot_interval_seconds ?? 30) * 1_000;
    screenshotIntervalRef.current = setInterval(() => {
      void (async () => {
        try {
          const blob = await captureFrame();
          if (!blob) return;
          const fd = new FormData();
          fd.append("file", blob, "screenshot.jpg");
          await api.post(API_ENDPOINTS.CANDIDATE.SUBMISSION_SCREENSHOT(submissionId!), fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        } catch {
          /* silent */
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
    monitoringConfig.screenshot_interval_seconds,
    submissionId,
    isScreenCapturing,
    captureFrame,
  ]);

  // ── Copy / paste / shortcut blocking ───────────────────────────────────────
  useEffect(() => {
    const BLOCKED_CTRL = new Set(["p", "x"]);
    const ALLOWED_IN_TEXTAREA = new Set(["a", "c", "v"]);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F12") {
        e.preventDefault();
        toast.error("Developer Tools are not allowed during the assessment");
        return;
      }
      if ((e.ctrlKey || e.metaKey) && BLOCKED_CTRL.has(e.key.toLowerCase())) {
        e.preventDefault();
        toast.error("This action is not allowed during the assessment");
      }
      if ((e.ctrlKey || e.metaKey) && ALLOWED_IN_TEXTAREA.has(e.key.toLowerCase())) {
        e.preventDefault();
        toast.error("Copy/paste is not allowed during the assessment");
      }
    };

    const handleClipboard = (e: ClipboardEvent) => {
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

  // ── Render ──────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className={styles.loadingScreen}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (!roundData) return null;

  // Show the sequential setup screen until the exam is ACTIVE
  if (phase < ExamPhase.ACTIVE) {
    return (
      <ExamSetupScreen
        phase={phase}
        phaseLabel={phaseLabel}
        phaseError={phaseError}
        config={monitoringConfig}
        onShareScreen={async () => {
          markPermissionFlowStart();
          try {
            const ok = await startScreenCapture();
            if (ok) setPhaseError(null);
            else
              setPhaseError(
                "Screen sharing was denied or cancelled. Please share your entire screen."
              );
          } finally {
            markPermissionFlowEnd();
          }
        }}
        onRequestFullscreen={async () => {
          if (!document.fullscreenElement) {
            await document.documentElement
              .requestFullscreen({ navigationUI: "hide" })
              .catch(() => undefined);
          }
        }}
        onRetryCamera={async () => {
          setIsCameraReady(false);
          setPhaseError(null);
          // The camera useEffect will re-run since isCameraReady resets
        }}
        onRetryAudio={async () => {
          setIsAudioReady(false);
          setPhaseError(null);
        }}
      />
    );
  }

  // ── Active exam UI ──────────────────────────────────────────────────────────

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
  const networkLabel =
    networkStatus === "connected"
      ? "Network Stable"
      : networkStatus === "on_hold"
        ? "Session Paused"
        : "Reconnecting…";

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
                const progress = isActive
                  ? (answeredCount / questions.length) * 100
                  : isCompleted
                    ? 100
                    : 0;
                return (
                  <div
                    key={round.round_number}
                    className={`${styles.roundCard} ${isActive ? styles.roundCardActive : ""} ${isCompleted ? styles.roundCardCompleted : ""}`}
                  >
                    <div className={styles.roundCardHeader}>
                      <span className={styles.roundCardName}>Round {round.round_number}</span>
                      <span
                        className={`${styles.roundStatusPill} ${getRoundStatusClass(isActive, isCompleted, styles)}`}
                      >
                        {getRoundStatusLabel(isActive, isCompleted)}
                      </span>
                    </div>
                    <p className={styles.roundCardMeta}>
                      {round.question_count} question{round.question_count === 1 ? "" : "s"}
                    </p>
                    <div className={styles.roundMiniBar}>
                      <div
                        className={getRoundMiniBarClass(isActive, isCompleted, styles)}
                        style={{ width: `${progress}%` }}
                      />
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
                    value={(answers[currentQuestion.id] as string) || ""}
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
                  <span className={styles.monitorBadgeDot} />
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
                onWarning={() => void flagViolationSafe({ type: "face_absence" })}
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

      {/* ── Modals (active exam only) ── */}

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
          navigate(ROUTES.ASSESSMENT.completed(shareLink ?? ""));
        }}
        title="Time's Up"
        size="sm"
        disableBackdropClose
        footer={
          <Button
            onClick={() => {
              setShowTimeExpired(false);
              navigate(ROUTES.ASSESSMENT.completed(shareLink ?? ""));
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

      {/* Screen share recovery — shown only during active exam */}
      <Modal
        isOpen={screenShareBlocked}
        onClose={() => void startScreenCaptureWithGuard()}
        title="Screen Sharing Required"
        size="sm"
        showClose={false}
        disableBackdropClose
        disableEscapeKey
        footer={
          <Button fullWidth onClick={() => void startScreenCaptureWithGuard()}>
            Share Screen Again
          </Button>
        }
      >
        <p style={{ fontSize: 14, color: "var(--text-secondary)", textAlign: "center" }}>
          Screen sharing has stopped or is unavailable. This assessment requires continuous screen
          monitoring. Click the button below and share your entire screen to resume.
        </p>
      </Modal>

      {/* Fullscreen recovery — shown only during active exam */}
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
