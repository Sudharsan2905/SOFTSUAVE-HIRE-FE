import styles from "./index.module.css";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { ExamPhase } from "@/features/candidate/hooks/useExamOrchestrator";
import type { MonitoringConfig } from "@/types";

// ─── Step descriptors ─────────────────────────────────────────────────────────

interface StepDef {
  phase: ExamPhase;
  label: string;
  /** True when this step is relevant given the monitoring config. */
  active: (cfg: Partial<MonitoringConfig>) => boolean;
}

const STEPS: StepDef[] = [
  {
    phase: ExamPhase.VALIDATING_NETWORK,
    label: "Network connectivity",
    active: () => true,
  },
  {
    phase: ExamPhase.VALIDATING_DEVTOOLS,
    label: "Developer tools closed",
    active: (cfg) => !!cfg.tab_monitoring,
  },
  {
    phase: ExamPhase.VALIDATING_VIDEO,
    label: "Camera access",
    active: (cfg) => !!cfg.video_monitoring,
  },
  {
    phase: ExamPhase.VALIDATING_AUDIO,
    label: "Microphone access",
    active: (cfg) => !!cfg.audio_monitoring,
  },
  {
    phase: ExamPhase.VALIDATING_SCREEN_SHARE,
    label: "Screen sharing",
    active: (cfg) => !!(cfg.tab_monitoring || cfg.screenshot_enabled),
  },
  {
    phase: ExamPhase.VALIDATING_FULLSCREEN,
    label: "Fullscreen mode",
    active: (cfg) => !!cfg.tab_monitoring,
  },
];

type StepStatus = "done" | "active" | "error" | "pending";

function getStepStatus(
  stepPhase: ExamPhase,
  currentPhase: ExamPhase,
  hasError: boolean
): StepStatus {
  if (currentPhase > stepPhase && currentPhase < ExamPhase.SUSPENDED) return "done";
  if (currentPhase === stepPhase) return hasError ? "error" : "active";
  return "pending";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepIcon({ status }: Readonly<{ status: StepStatus }>) {
  if (status === "done") {
    return (
      <span className={`${styles.stepIcon} ${styles.stepIconDone}`}>
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M3 8l3.5 3.5L13 5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className={`${styles.stepIcon} ${styles.stepIconError}`}>
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 5v4M8 11h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
    );
  }
  if (status === "active") {
    return (
      <span className={`${styles.stepIcon} ${styles.stepIconActive}`}>
        <Spinner size="sm" />
      </span>
    );
  }
  return <span className={`${styles.stepIcon} ${styles.stepIconPending}`} aria-hidden="true" />;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ExamSetupScreenProps {
  phase: ExamPhase;
  phaseLabel: string;
  phaseError: string | null;
  config: Partial<MonitoringConfig>;
  onShareScreen: () => Promise<void>;
  onRequestFullscreen: () => Promise<void>;
  onRetryCamera: () => Promise<void>;
  onRetryAudio: () => Promise<void>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ExamSetupScreen({
  phase,
  phaseLabel,
  phaseError,
  config,
  onShareScreen,
  onRequestFullscreen,
  onRetryCamera,
  onRetryAudio,
}: Readonly<ExamSetupScreenProps>) {
  const visibleSteps = STEPS.filter((s) => s.active(config));

  return (
    <div className={styles.root}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logo} aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="var(--primary-600, #2563eb)" />
              <path
                d="M8 16l5 5 11-10"
                stroke="#fff"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className={styles.title}>Setting up your exam</h1>
          <p className={styles.subtitle}>
            Please wait while we verify your permissions and environment.
          </p>
        </div>

        <ol className={styles.stepList} aria-label="Setup progress">
          {visibleSteps.map((step) => {
            const status = getStepStatus(step.phase, phase, !!phaseError);
            const stepKey = `step_${status}`;
            const stepClass = `${styles.step} ${styles[stepKey] ?? ""}`;
            return (
              <li key={step.phase} className={stepClass}>
                <StepIcon status={status} />
                <span className={styles.stepLabel}>{step.label}</span>
                {status === "done" && <span className={styles.stepBadgeDone}>Ready</span>}
                {status === "active" && !phaseError && (
                  <span className={styles.stepBadgeActive}>Checking…</span>
                )}
              </li>
            );
          })}
        </ol>

        {phaseError && (
          <div className={styles.errorBox} role="alert">
            <span className={styles.errorIcon} aria-hidden="true">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
            <p className={styles.errorText}>{phaseError}</p>
          </div>
        )}

        {/* Phase-specific action buttons */}
        {phase === ExamPhase.VALIDATING_SCREEN_SHARE && (
          <Button fullWidth onClick={() => void onShareScreen()}>
            Share Screen
          </Button>
        )}

        {phase === ExamPhase.VALIDATING_FULLSCREEN && !phaseError && (
          <Button fullWidth onClick={() => void onRequestFullscreen()}>
            Enter Fullscreen
          </Button>
        )}

        {phase === ExamPhase.VALIDATING_VIDEO && phaseError && (
          <Button fullWidth onClick={() => void onRetryCamera()}>
            Allow Camera &amp; Retry
          </Button>
        )}

        {phase === ExamPhase.VALIDATING_AUDIO && phaseError && (
          <Button fullWidth onClick={() => void onRetryAudio()}>
            Allow Microphone &amp; Retry
          </Button>
        )}

        <p className={styles.statusText}>{phaseLabel}</p>
      </div>
    </div>
  );
}
