import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";

// ─── State machine ────────────────────────────────────────────────────────────

export enum ExamPhase {
  IDLE = 0,
  VALIDATING_NETWORK = 1,
  VALIDATING_DEVTOOLS = 2,
  VALIDATING_VIDEO = 3,
  VALIDATING_AUDIO = 4,
  VALIDATING_SCREEN_SHARE = 5,
  VALIDATING_FULLSCREEN = 6,
  ACTIVE = 7,
  SUSPENDED = 8,
  TERMINATED = 9,
}

export const EXAM_PHASE_LABELS: Record<ExamPhase, string> = {
  [ExamPhase.IDLE]: "Initializing exam environment…",
  [ExamPhase.VALIDATING_NETWORK]: "Checking network connectivity…",
  [ExamPhase.VALIDATING_DEVTOOLS]: "Checking developer tools…",
  [ExamPhase.VALIDATING_VIDEO]: "Requesting camera access…",
  [ExamPhase.VALIDATING_AUDIO]: "Requesting microphone access…",
  [ExamPhase.VALIDATING_SCREEN_SHARE]: "Requesting screen share…",
  [ExamPhase.VALIDATING_FULLSCREEN]: "Entering fullscreen mode…",
  [ExamPhase.ACTIVE]: "Exam Active",
  [ExamPhase.SUSPENDED]: "Session Suspended",
  [ExamPhase.TERMINATED]: "Session Terminated",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrchestratorConfig {
  tab_monitoring?: boolean;
  video_monitoring?: boolean;
  audio_monitoring?: boolean;
  screenshot_enabled?: boolean;
}

interface UseExamOrchestratorOptions {
  /** False while round data is still loading — orchestrator will not start. */
  enabled: boolean;
  config: OrchestratorConfig;
  networkStatus: string;
  /** Readiness signals — each resource hook signals back when ready. */
  isCameraReady: boolean;
  isAudioReady: boolean;
  isScreenShareReady: boolean;
  isFullscreen: boolean;
}

export interface UseExamOrchestratorReturn {
  phase: ExamPhase;
  phaseLabel: string;
  phaseError: string | null;
  /** Synchronous ref — true only while exam is ACTIVE and network connected. */
  examActiveRef: MutableRefObject<boolean>;
  /** True while a browser permission dialog is open (suppresses tab-switch detection). */
  isPermissionFlowActiveRef: MutableRefObject<boolean>;
  // Gate booleans — resources are only acquired when their gate opens.
  shouldAcquireCamera: boolean;
  shouldAcquireAudio: boolean;
  shouldAcquireScreen: boolean;
  shouldEnforceFullscreen: boolean;
  setPhaseError: (err: string | null) => void;
  markPermissionFlowStart: () => void;
  markPermissionFlowEnd: () => void;
  suspend: () => void;
  resume: () => void;
  terminate: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isInValidationRange(phase: ExamPhase): boolean {
  return phase >= ExamPhase.IDLE && phase <= ExamPhase.ACTIVE;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useExamOrchestrator({
  enabled,
  config,
  networkStatus,
  isCameraReady,
  isAudioReady,
  isScreenShareReady,
  isFullscreen,
}: UseExamOrchestratorOptions): UseExamOrchestratorReturn {
  const [phase, setPhase] = useState<ExamPhase>(ExamPhase.IDLE);
  const [phaseError, setPhaseError] = useState<string | null>(null);

  const examActiveRef = useRef(false);
  const isPermissionFlowActiveRef = useRef(false);

  // Keep examActiveRef accurate: ACTIVE + network connected = malpractice armed.
  useEffect(() => {
    examActiveRef.current = phase === ExamPhase.ACTIVE && networkStatus === "connected";
  }, [phase, networkStatus]);

  // ── Devtools detection via resize event (event-driven, no polling) ──────────
  // Opening/closing devtools changes window.innerWidth/Height, firing "resize".
  const [isDevtoolsOpen, setIsDevtoolsOpen] = useState(
    () =>
      window.outerWidth - window.innerWidth > 160 || window.outerHeight - window.innerHeight > 160
  );
  useEffect(() => {
    const check = () => {
      setIsDevtoolsOpen(
        window.outerWidth - window.innerWidth > 160 || window.outerHeight - window.innerHeight > 160
      );
    };
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Resolve which phase comes next, skipping disabled steps ────────────────
  const nextPhaseAfter = useCallback(
    (current: ExamPhase): ExamPhase => {
      const steps: Array<[ExamPhase, boolean]> = [
        [ExamPhase.VALIDATING_NETWORK, true],
        [ExamPhase.VALIDATING_DEVTOOLS, !!config.tab_monitoring],
        [ExamPhase.VALIDATING_VIDEO, !!config.video_monitoring],
        [ExamPhase.VALIDATING_AUDIO, !!config.audio_monitoring],
        [ExamPhase.VALIDATING_SCREEN_SHARE, !!(config.tab_monitoring || config.screenshot_enabled)],
        [ExamPhase.VALIDATING_FULLSCREEN, !!config.tab_monitoring],
        [ExamPhase.ACTIVE, true],
      ];
      const idx = steps.findIndex(([p]) => p === current);
      for (let i = idx + 1; i < steps.length; i++) {
        if (steps[i][1]) return steps[i][0];
      }
      return ExamPhase.ACTIVE;
    },
    [config]
  );

  // ── Phase advancement — purely reactive, triggered by readiness changes ─────
  useEffect(() => {
    if (!enabled || !isInValidationRange(phase) || phase === ExamPhase.ACTIVE) return;

    switch (phase) {
      case ExamPhase.IDLE:
        setPhase(ExamPhase.VALIDATING_NETWORK);
        break;

      case ExamPhase.VALIDATING_NETWORK:
        if (networkStatus === "connected") {
          setPhase(nextPhaseAfter(ExamPhase.VALIDATING_NETWORK));
        }
        break;

      case ExamPhase.VALIDATING_DEVTOOLS:
        if (isDevtoolsOpen) {
          setPhaseError("Please close developer tools before the exam can begin.");
        } else {
          setPhaseError(null);
          setPhase(nextPhaseAfter(ExamPhase.VALIDATING_DEVTOOLS));
        }
        break;

      case ExamPhase.VALIDATING_VIDEO:
        if (isCameraReady) {
          setPhase(nextPhaseAfter(ExamPhase.VALIDATING_VIDEO));
        }
        break;

      case ExamPhase.VALIDATING_AUDIO:
        if (isAudioReady) {
          setPhase(nextPhaseAfter(ExamPhase.VALIDATING_AUDIO));
        }
        break;

      case ExamPhase.VALIDATING_SCREEN_SHARE:
        if (isScreenShareReady) {
          // setPhaseError(null); --- IGNORE ---
          setPhase(nextPhaseAfter(ExamPhase.VALIDATING_SCREEN_SHARE));
        }
        break;

      case ExamPhase.VALIDATING_FULLSCREEN:
        if (isFullscreen) {
          setPhase(ExamPhase.ACTIVE);
        }
        break;
    }
  }, [
    enabled,
    phase,
    networkStatus,
    isDevtoolsOpen,
    isCameraReady,
    isAudioReady,
    isScreenShareReady,
    isFullscreen,
    nextPhaseAfter,
  ]);

  const markPermissionFlowStart = useCallback(() => {
    isPermissionFlowActiveRef.current = true;
  }, []);

  // 3-second trailing window absorbs blur/focus events fired by the OS dialog.
  const markPermissionFlowEnd = useCallback(() => {
    setTimeout(() => {
      isPermissionFlowActiveRef.current = false;
    }, 3_000);
  }, []);

  const suspend = useCallback(() => {
    examActiveRef.current = false;
    setPhase(ExamPhase.SUSPENDED);
  }, []);

  const resume = useCallback(() => {
    examActiveRef.current = true;
    setPhase(ExamPhase.ACTIVE);
  }, []);

  const terminate = useCallback(() => {
    examActiveRef.current = false;
    setPhase(ExamPhase.TERMINATED);
  }, []);

  // Resource gates: open from each validation phase through ACTIVE.
  // SUSPENDED / TERMINATED (>= 8) fall outside so resources are released.
  const inRange = (from: ExamPhase) => phase >= from && phase < ExamPhase.SUSPENDED;

  return {
    phase,
    phaseLabel: EXAM_PHASE_LABELS[phase],
    phaseError,
    examActiveRef,
    isPermissionFlowActiveRef,
    shouldAcquireCamera: inRange(ExamPhase.VALIDATING_VIDEO),
    shouldAcquireAudio: inRange(ExamPhase.VALIDATING_AUDIO),
    shouldAcquireScreen: inRange(ExamPhase.VALIDATING_SCREEN_SHARE),
    shouldEnforceFullscreen: inRange(ExamPhase.VALIDATING_FULLSCREEN),
    setPhaseError,
    markPermissionFlowStart,
    markPermissionFlowEnd,
    suspend,
    resume,
    terminate,
  };
}
