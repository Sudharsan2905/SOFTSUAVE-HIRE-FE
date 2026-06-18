import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import styles from "./InstructionsPage.module.css";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { api } from "@/utils/api";
import { API_ENDPOINTS } from "@/constants/api";
import { ROUTES } from "@/constants/routes";
import { Assessment } from "@/types";
import {
  IconCamera,
  IconGlobe,
  IconMic,
  IconMonitor,
  IconTime,
  IconShield,
  IconWarning,
  IconBell,
  IconCheck,
  IconAssessment,
  IconInvalid,
  IconSparkles,
  IconLock,
  IconArrowsRotate,
  IconQuestionCircle,
} from "@/assets/icons";
import CandidateHeader from "@/features/candidate/components/CandidateHeader";
import { useAppSelector } from "@/store/hooks";
import { markAssessmentDone, saveSubmissionId } from "@/utils/assessmentSession";
import { useInterviewSession } from "@/features/candidate/context/InterviewSessionContext";
import { storeMonitoringStreams } from "@/features/candidate/services/screenCaptureStore";
import toast from "react-hot-toast";

type NetworkCheckStatus = "checking" | "connected" | "unstable" | "disconnected";

const DEVTOOLS_SIZE_THRESHOLD = 160;

// ── Module-level helpers ──────────────────────────────────────────────────────

function isDevToolsCurrentlyOpen(): boolean {
  return (
    globalThis.outerWidth - globalThis.innerWidth > DEVTOOLS_SIZE_THRESHOLD ||
    globalThis.outerHeight - globalThis.innerHeight > DEVTOOLS_SIZE_THRESHOLD
  );
}

function isAssessmentReady(
  assessment: Assessment | null,
  networkStatus: NetworkCheckStatus,
  videoGranted: boolean,
  audioGranted: boolean,
  screenGranted: boolean
): boolean {
  if (!assessment) return false;
  if (networkStatus !== "connected") return false;
  const cfg = assessment.monitoring_config;
  if (cfg?.video_monitoring && !videoGranted) return false;
  if (cfg?.audio_monitoring && !audioGranted) return false;
  if (cfg?.screenshot_enabled && !screenGranted) return false;
  return true;
}

function extractStartErrorMessage(e: unknown): string {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "";
}

function handleStartCatchError(
  e: unknown,
  shareLink: string | undefined,
  markDone: (link: string) => void,
  navigateFn: (path: string, opts?: { replace?: boolean }) => void
): void {
  const msg = extractStartErrorMessage(e);
  if (msg.toLowerCase().includes("already completed")) {
    if (shareLink) markDone(shareLink);
    navigateFn(ROUTES.ASSESSMENT.completed(shareLink!), { replace: true });
  } else {
    toast.error(msg || "Failed to start assessment");
  }
}

function handleNotReadyError(networkStatus: NetworkCheckStatus): void {
  if (networkStatus === "connected") {
    toast.error("Please grant the required device permissions first");
  } else {
    toast.error("A stable network connection is required to start the assessment");
  }
}

const NETWORK_BADGE_VARIANT: Record<NetworkCheckStatus, "success" | "default" | "error"> = {
  connected: "success",
  checking: "default",
  unstable: "error",
  disconnected: "error",
};

const NETWORK_BADGE_LABEL: Record<NetworkCheckStatus, string> = {
  connected: "Internet Connected",
  checking: "Checking…",
  unstable: "Internet Disconnected",
  disconnected: "Internet Disconnected",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function CameraPreview({ stream }: Readonly<{ stream: MediaStream }>) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = videoRef.current;
    if (el) {
      el.srcObject = stream;
      void el.play();
    }
    return () => {
      if (el) el.srcObject = null;
    };
  }, [stream]);
  return (
    <video
      ref={videoRef}
      className={styles.cameraPreview}
      muted
      playsInline
      aria-label="Camera preview"
    />
  );
}

type IconComponent = React.ComponentType<{ size?: number; color?: string }>;

const INSTRUCTION_ITEMS: Array<{
  id: string;
  Icon: IconComponent;
  iconColor: string;
  iconBg: string;
  text: string;
}> = [
  {
    id: "internet",
    Icon: IconGlobe,
    iconColor: "#64748b",
    iconBg: "#f1f5f9",
    text: "Ensure you have a stable internet connection throughout the assessment.",
  },
  {
    id: "fullscreen",
    Icon: IconMonitor,
    iconColor: "#64748b",
    iconBg: "#f1f5f9",
    text: "The interview runs in fullscreen mode — do not exit fullscreen at any point.",
  },
  {
    id: "devtools",
    Icon: IconInvalid,
    iconColor: "#64748b",
    iconBg: "#f1f5f9",
    text: "Do not open Developer Tools or AI Tools at any point during the assessment.",
  },
  {
    id: "time",
    Icon: IconTime,
    iconColor: "#64748b",
    iconBg: "#f1f5f9",
    text: "Each round has a time limit. The assessment auto-submits when time runs out.",
  },
  {
    id: "revisit",
    Icon: IconCheck,
    iconColor: "#64748b",
    iconBg: "#f1f5f9",
    text: "Once you submit a round, you cannot go back to change answers.",
  },
  {
    id: "read",
    Icon: IconAssessment,
    iconColor: "#64748b",
    iconBg: "#f1f5f9",
    text: "Read each question carefully before answering.",
  },
];

function InstructionRow({
  Icon,
  iconColor,
  iconBg,
  text,
}: Readonly<{ Icon: IconComponent; iconColor: string; iconBg: string; text: string }>) {
  return (
    <div className={styles.instructionRow}>
      <span className={styles.instructionIconWrap} style={{ background: iconBg, color: iconColor }}>
        <Icon size={18} color={iconColor} />
      </span>
      <span className={styles.instructionText}>{text}</span>
    </div>
  );
}

function DndBanner() {
  return (
    <div className={styles.dndBanner}>
      <span className={styles.dndBannerIconBox}>
        <IconBell size={20} color="#b45309" />
      </span>
      <div>
        <p className={styles.dndBannerTitle}>Enable Do Not Disturb (DND) Mode</p>
        <p className={styles.dndBannerDesc}>
          Please enable Do Not Disturb mode on your device before starting the assessment to avoid
          interruptions.
        </p>
      </div>
    </div>
  );
}

function PermissionRow({
  Icon,
  iconColor,
  iconBg,
  title,
  helperText,
  granted,
  loading,
  onGrant,
  grantLabel,
  preview,
}: Readonly<{
  Icon: IconComponent;
  iconColor: string;
  iconBg: string;
  title: string;
  helperText: string;
  granted: boolean;
  loading: boolean;
  onGrant: () => void;
  grantLabel: string;
  preview?: React.ReactNode;
}>) {
  return (
    <div className={`${styles.permissionRow} ${granted ? styles.permissionRowGranted : ""}`}>
      <span className={styles.permRowIcon} style={{ background: iconBg, color: iconColor }}>
        <Icon size={20} color={granted ? "#16a34a" : iconColor} />
      </span>
      <div className={styles.permRowBody}>
        <p
          className={styles.permRowTitle}
          style={{ color: granted ? "#16a34a" : "var(--text-primary)" }}
        >
          {title}
        </p>
        <p className={styles.permRowHelper}>{helperText}</p>
        {preview && <div className={styles.cameraPreviewWrap}>{preview}</div>}
      </div>
      <div className={styles.permRowActions}>
        <Button
          size="sm"
          variant={granted ? "secondary" : "primary"}
          disabled={granted}
          isLoading={loading && !granted}
          onClick={onGrant}
          leftIcon={granted ? <IconCheck size={14} /> : undefined}
        >
          {granted ? "Access Granted" : grantLabel}
        </Button>
      </div>
    </div>
  );
}

function AssessmentSetupSection({
  needsVideo,
  needsAudio,
  needsScreen,
  videoGranted,
  audioGranted,
  screenGranted,
  checkingCamera,
  checkingMicrophone,
  checkingScreen,
  onGrantCamera,
  onGrantMicrophone,
  onGrantScreen,
  cameraPreviewStream,
}: Readonly<{
  needsVideo: boolean;
  needsAudio: boolean;
  needsScreen: boolean;
  videoGranted: boolean;
  audioGranted: boolean;
  screenGranted: boolean;
  checkingCamera: boolean;
  checkingMicrophone: boolean;
  checkingScreen: boolean;
  onGrantCamera: () => void;
  onGrantMicrophone: () => void;
  onGrantScreen: () => void;
  cameraPreviewStream: MediaStream | null;
}>) {
  const totalRequired = [needsVideo, needsAudio, needsScreen].filter(Boolean).length;
  const totalGranted = [
    needsVideo && videoGranted,
    needsAudio && audioGranted,
    needsScreen && screenGranted,
  ].filter(Boolean).length;
  const progressPct = totalRequired > 0 ? Math.round((totalGranted / totalRequired) * 100) : 0;

  return (
    <div className={styles.setupSection}>
      <h2 className={styles.sectionTitle}>Assessment Setup</h2>

      <div className={styles.progressBarTrack}>
        <div className={styles.progressBarFill} style={{ width: `${progressPct}%` }} />
      </div>

      <div className={styles.permissionRows}>
        {needsVideo && (
          <PermissionRow
            Icon={IconCamera}
            iconColor="#7c3aed"
            iconBg="#f5f3ff"
            title="Camera Access"
            helperText={
              videoGranted
                ? "Camera is active and ready."
                : "Camera access is required to continue."
            }
            granted={videoGranted}
            loading={checkingCamera}
            onGrant={onGrantCamera}
            grantLabel="Grant Camera Access"
            preview={
              videoGranted && cameraPreviewStream ? (
                <CameraPreview stream={cameraPreviewStream} />
              ) : undefined
            }
          />
        )}
        {needsAudio && (
          <PermissionRow
            Icon={IconMic}
            iconColor="#7c3aed"
            iconBg="#f5f3ff"
            title="Microphone Access"
            helperText={
              audioGranted
                ? "Microphone is active and ready."
                : "Microphone access is required to continue."
            }
            granted={audioGranted}
            loading={checkingMicrophone}
            onGrant={onGrantMicrophone}
            grantLabel="Grant Microphone Access"
          />
        )}
        {needsScreen && (
          <PermissionRow
            Icon={IconMonitor}
            iconColor="#7c3aed"
            iconBg="#f5f3ff"
            title="Screen Share Access"
            helperText={
              screenGranted
                ? "Screen sharing is active."
                : "Full-screen sharing is required to continue."
            }
            granted={screenGranted}
            loading={checkingScreen}
            onGrant={onGrantScreen}
            grantLabel="Share Screen"
          />
        )}
      </div>
    </div>
  );
}

function LaunchCard({
  firstName,
  isReady,
  isMonitoring,
  allPermissionsGranted,
  starting,
  onStart,
}: Readonly<{
  firstName: string;
  isReady: boolean;
  isMonitoring: boolean;
  allPermissionsGranted: boolean;
  starting: boolean;
  onStart: () => void;
}>) {
  const buttonLabel =
    isMonitoring && !allPermissionsGranted
      ? "Grant Required Access to Continue"
      : "Start Assessment";

  return (
    <div className={styles.launchCard}>
      <div className={styles.launchLeft}>
        <span className={styles.launchIconBox}>
          <IconSparkles size={26} color="#2563eb" />
        </span>
        <div>
          <p className={styles.launchTitle}>All the Best, {firstName}!</p>
          <p className={styles.launchDesc}>
            Take a deep breath, stay confident, and do your best. We believe in you.
          </p>
        </div>
      </div>

      <div className={styles.launchDivider} />

      <div className={styles.launchRight}>
        <Button
          size="lg"
          variant={isReady ? "primary" : "danger"}
          onClick={onStart}
          isLoading={starting}
          disabled={!isReady}
        >
          {buttonLabel}
        </Button>
        <p className={styles.launchNote}>
          <IconLock size={14} />
          You will be redirected to the assessment
        </p>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function InstructionsPage() {
  const { shareLink } = useParams<{ shareLink: string }>();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const firstName = user?.first_name || "Candidate";
  const lastName = user?.last_name ? ` ${user.last_name}` : "";
  const candidateName = user ? `${user.first_name}${lastName}` : undefined;

  const { startSession } = useInterviewSession();

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [videoGranted, setVideoGranted] = useState(false);
  const [audioGranted, setAudioGranted] = useState(false);
  const [screenGranted, setScreenGranted] = useState(false);
  const [checkingCamera, setCheckingCamera] = useState(false);
  const [checkingMicrophone, setCheckingMicrophone] = useState(false);
  const [checkingScreen, setCheckingScreen] = useState(false);
  const [cameraPreviewStream, setCameraPreviewStream] = useState<MediaStream | null>(null);
  const [showScreenInstructionModal, setShowScreenInstructionModal] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<NetworkCheckStatus>("checking");

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const { data } = await api.get(API_ENDPOINTS.CANDIDATE.ASSESSMENT(shareLink!));
        setAssessment(data?.data || null);
        setNetworkStatus("connected");
      } catch {
        toast.error("Assessment not found");
        setNetworkStatus(navigator.onLine ? "unstable" : "disconnected");
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [shareLink]);

  useEffect(() => {
    const handleConnectivityChange = () => {
      if (!navigator.onLine) {
        setNetworkStatus("disconnected");
      } else if (networkStatus !== "connected") {
        setNetworkStatus("unstable");
      }
    };
    globalThis.addEventListener("online", handleConnectivityChange);
    globalThis.addEventListener("offline", handleConnectivityChange);
    return () => {
      globalThis.removeEventListener("online", handleConnectivityChange);
      globalThis.removeEventListener("offline", handleConnectivityChange);
    };
  }, [networkStatus]);

  const requestCameraAccess = async () => {
    setCheckingCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        storeMonitoringStreams({ camera: new MediaStream([videoTrack]) });
        setCameraPreviewStream(new MediaStream([videoTrack]));
        setVideoGranted(true);
      }
      toast.success("Camera access granted");
    } catch {
      toast.error("Please allow camera access to proceed");
    } finally {
      setCheckingCamera(false);
    }
  };

  const requestMicrophoneAccess = async () => {
    setCheckingMicrophone(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        storeMonitoringStreams({ audio: new MediaStream([audioTrack]) });
        setAudioGranted(true);
      }
      toast.success("Microphone access granted");
    } catch {
      toast.error("Please allow microphone access to proceed");
    } finally {
      setCheckingMicrophone(false);
    }
  };

  const requestScreenAccess = async () => {
    setCheckingScreen(true);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "monitor" },
        audio: false,
      });
      const videoTrack = stream.getVideoTracks()[0];
      const { displaySurface } = videoTrack.getSettings() as MediaTrackSettings & {
        displaySurface?: string;
      };
      if (displaySurface !== "monitor") {
        for (const track of stream.getTracks()) track.stop();
        setShowScreenInstructionModal(true);
        return;
      }
      storeMonitoringStreams({ screen: stream });
      setScreenGranted(true);
      toast.success("Screen access granted");
    } catch {
      toast.error("Screen sharing access is required to proceed");
    } finally {
      setCheckingScreen(false);
    }
  };

  const handleStart = async () => {
    if (!assessment) return;
    if (isDevToolsCurrentlyOpen()) {
      toast.error("Please close Developer Tools before starting the assessment");
      return;
    }
    if (!isAssessmentReady(assessment, networkStatus, videoGranted, audioGranted, screenGranted)) {
      handleNotReadyError(networkStatus);
      return;
    }
    setStarting(true);
    try {
      const { data } = await api.post(API_ENDPOINTS.CANDIDATE.ASSESSMENT_START(shareLink!));
      const submissionId = data.data?.id;
      const canSaveSession = shareLink && submissionId;
      if (canSaveSession) saveSubmissionId(shareLink, submissionId);
      if (submissionId) startSession(submissionId as string);
      navigate(ROUTES.ASSESSMENT.interview(shareLink!, submissionId as string), { replace: true });
    } catch (e: unknown) {
      handleStartCatchError(e, shareLink, markAssessmentDone, navigate);
    } finally {
      setStarting(false);
    }
  };

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
        }}
      >
        <Spinner size="lg" />
      </div>
    );
  }

  if (!assessment) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          color: "var(--text-tertiary)",
        }}
      >
        Assessment not found or link is invalid.
      </div>
    );
  }

  const isMonitoring = assessment.accessibility === "monitoring";
  const totalQuestions = assessment.rounds?.reduce((s, r) => s + (r.question_count || 0), 0) || 0;
  const totalMinutes =
    assessment.rounds?.reduce((s, r) => s + (r.max_duration_minutes || 0), 0) || 0;

  const needsVideo = isMonitoring && (assessment.monitoring_config?.video_monitoring ?? false);
  const needsAudio = isMonitoring && (assessment.monitoring_config?.audio_monitoring ?? false);
  const needsScreen = isMonitoring && (assessment.monitoring_config?.screenshot_enabled ?? false);
  const allPermissionsGranted =
    (!needsVideo || videoGranted) &&
    (!needsAudio || audioGranted) &&
    (!needsScreen || screenGranted);
  const isReady = isAssessmentReady(
    assessment,
    networkStatus,
    videoGranted,
    audioGranted,
    screenGranted
  );

  const networkBadgeVariant = NETWORK_BADGE_VARIANT[networkStatus];
  const networkBadgeLabel = NETWORK_BADGE_LABEL[networkStatus];

  return (
    <div className={styles.page}>
      <CandidateHeader candidateName={candidateName} />

      <div className={styles.content}>
        <div className={styles.container}>
          {/* Assessment Header */}
          <div className={styles.header}>
            <div className={styles.headerTop}>
              <h1 className={styles.title}>{assessment.name}</h1>
              <Badge variant={networkBadgeVariant} dot>
                {networkBadgeLabel}
              </Badge>
            </div>
            {assessment.description && <p className={styles.desc}>{assessment.description}</p>}
          </div>

          {/* Stats Row */}
          <div className={styles.statsRow}>
            <div className={styles.stat}>
              <span className={styles.statIcon} style={{ color: "var(--primary-600)" }}>
                <IconTime size={24} color="var(--primary-400)" />
              </span>
              <span className={styles.statValue}>{totalMinutes} min</span>
              <span className={styles.statLabel}>Total Duration</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statIcon} style={{ color: "var(--primary-400)" }}>
                <IconQuestionCircle size={24} />
              </span>
              <span className={styles.statValue}>{totalQuestions}</span>
              <span className={styles.statLabel}>Questions</span>
            </div>
            <div className={styles.stat}>
              <span
                className={styles.statIcon}
                style={{ color: isMonitoring ? "var(--primary-400)" : "var(--success-600)" }}
              >
                <IconShield
                  size={24}
                  color={isMonitoring ? "var(--primary-400)" : "var(--success-600)"}
                />
              </span>
              <span className={styles.statValue}>{isMonitoring ? "Monitored" : "Normal"}</span>
              <span className={styles.statLabel}>Mode</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statIcon} style={{ color: "var(--primary-400)" }}>
                <IconArrowsRotate size={24} />
              </span>
              <span className={styles.statValue}>{assessment.rounds?.length || 1}</span>
              <span className={styles.statLabel}>Rounds</span>
            </div>
          </div>

          {/* General Instructions */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>General Instructions</h2>
            <div className={styles.instructionList}>
              {INSTRUCTION_ITEMS.map((item) => (
                <InstructionRow
                  key={item.id}
                  Icon={item.Icon}
                  iconColor={item.iconColor}
                  iconBg={item.iconBg}
                  text={item.text}
                />
              ))}
            </div>
            {assessment.accessibility === "monitoring" && <DndBanner />}
          </div>

          {/* Assessment Setup */}
          {isMonitoring && (
            <AssessmentSetupSection
              needsVideo={needsVideo}
              needsAudio={needsAudio}
              needsScreen={needsScreen}
              videoGranted={videoGranted}
              audioGranted={audioGranted}
              screenGranted={screenGranted}
              checkingCamera={checkingCamera}
              checkingMicrophone={checkingMicrophone}
              checkingScreen={checkingScreen}
              onGrantCamera={() => void requestCameraAccess()}
              onGrantMicrophone={() => void requestMicrophoneAccess()}
              onGrantScreen={() => void requestScreenAccess()}
              cameraPreviewStream={cameraPreviewStream}
            />
          )}

          {/* Encouragement + Action */}
          <LaunchCard
            firstName={firstName}
            isReady={isReady}
            isMonitoring={isMonitoring}
            allPermissionsGranted={allPermissionsGranted}
            starting={starting}
            onStart={handleStart}
          />
        </div>
      </div>

      <Modal
        isOpen={showScreenInstructionModal}
        onClose={() => setShowScreenInstructionModal(false)}
        title="Entire Screen Required"
        disableBackdropClose={true}
        size="md"
        footer={
          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
            <Button variant="secondary" onClick={() => setShowScreenInstructionModal(false)}>
              Cancel
            </Button>
            <Button
              leftIcon={<IconMonitor size={16} />}
              onClick={() => {
                setShowScreenInstructionModal(false);
                void requestScreenAccess();
              }}
            >
              Try Again
            </Button>
          </div>
        }
      >
        <div className={styles.modalContent}>
          {<IconWarning size={50} />}
          <p className={styles.modalDesc}>
            You shared a window or browser tab instead of your entire screen. This assessment
            requires full-screen monitoring.
          </p>
        </div>
        <ol className={styles.modalSteps}>
          <li>
            1. Click <strong>Try Again</strong> below.
          </li>
          <li>
            2. In the browser dialog, open the <strong>Entire Screen</strong> tab.
          </li>
          <li>
            3. Select your monitor and click <strong>Share</strong>.
          </li>
        </ol>
      </Modal>
    </div>
  );
}
