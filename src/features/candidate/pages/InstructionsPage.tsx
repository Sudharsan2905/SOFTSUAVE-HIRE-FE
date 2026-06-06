import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import styles from "./InstructionsPage.module.css";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { api } from "@/utils/api";
import { Assessment } from "@/types";
import {
  IconCamera,
  IconGlobe,
  IconMic,
  IconMonitor,
  IconTime,
  IconShield,
  IconInfo,
  IconRefresh,
  IconWarning,
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

function buildPermissionMessage(needsVideo: boolean, needsAudio: boolean): string {
  if (needsVideo && needsAudio) return "Camera and microphone access granted";
  if (needsVideo) return "Camera access granted";
  return "Microphone access granted";
}

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

function resolveStartButtonLabel(
  networkStatus: NetworkCheckStatus,
  isMonitoring: boolean,
  allPermissionsGranted: boolean
): string {
  if (networkStatus !== "connected") return "Network Connection Required";
  if (isMonitoring && !allPermissionsGranted) return "Grant Required Access to Continue";
  return "Start Assessment";
}

function extractStartErrorMessage(e: unknown): string {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "";
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function InstructionsPage() {
  const { shareLink } = useParams<{ shareLink: string }>();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const lastName = user?.last_name ? ` ${user.last_name}` : "";
  const candidateName = user ? `${user.first_name}${lastName}` : undefined;

  const { startSession } = useInterviewSession();

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [videoGranted, setVideoGranted] = useState(false);
  const [audioGranted, setAudioGranted] = useState(false);
  const [screenGranted, setScreenGranted] = useState(false);
  const [checkingPermissions, setCheckingPermissions] = useState(false);
  const [checkingScreen, setCheckingScreen] = useState(false);
  const [showScreenInstructionModal, setShowScreenInstructionModal] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<NetworkCheckStatus>("checking");
  const [checkingNetwork, setCheckingNetwork] = useState(false);

  const checkNetwork = useCallback(async () => {
    if (!shareLink) return;
    setCheckingNetwork(true);
    setNetworkStatus("checking");
    try {
      const { data } = await api.get(`/api/candidate/assessment/${shareLink}`);
      setAssessment(data?.data || null);
      setNetworkStatus("connected");
    } catch {
      setNetworkStatus(navigator.onLine ? "unstable" : "disconnected");
    } finally {
      setCheckingNetwork(false);
    }
  }, [shareLink]);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const { data } = await api.get(`/api/candidate/assessment/${shareLink}`);
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
    const handleOnline = () => {
      if (networkStatus !== "connected") setNetworkStatus("unstable");
    };
    const handleOffline = () => setNetworkStatus("disconnected");
    globalThis.addEventListener("online", handleOnline);
    globalThis.addEventListener("offline", handleOffline);
    return () => {
      globalThis.removeEventListener("online", handleOnline);
      globalThis.removeEventListener("offline", handleOffline);
    };
  }, [networkStatus]);

  const requestPermissions = async () => {
    if (!assessment) return;
    const needsVideo = assessment.monitoring_config?.video_monitoring ?? false;
    const needsAudio = assessment.monitoring_config?.audio_monitoring ?? false;

    setCheckingPermissions(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: needsVideo,
        audio: needsAudio,
      });
      // Separate camera and audio tracks into individual streams for later use
      if (needsVideo) {
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          storeMonitoringStreams({ camera: new MediaStream([videoTrack]) });
          setVideoGranted(true);
        }
      }
      if (needsAudio) {
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          storeMonitoringStreams({ audio: new MediaStream([audioTrack]) });
          setAudioGranted(true);
        }
      }
      toast.success(buildPermissionMessage(needsVideo, needsAudio));
    } catch {
      toast.error("Please allow the required device access to proceed");
    } finally {
      setCheckingPermissions(false);
    }
  };

  const requestScreenAccess = async () => {
    setCheckingScreen(true);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "monitor",
        },
        audio: false,
      });

      const videoTrack = stream.getVideoTracks()[0];
      const { displaySurface } = videoTrack.getSettings() as MediaTrackSettings & {
        displaySurface?: string;
      };

      if (displaySurface !== "monitor") {
        stream.getTracks().forEach((t) => t.stop());
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

  const canStart = (): boolean =>
    isAssessmentReady(assessment, networkStatus, videoGranted, audioGranted, screenGranted);

  const handleStart = async () => {
    if (!assessment) return;

    if (isDevToolsCurrentlyOpen()) {
      toast.error("Please close Developer Tools before starting the assessment");
      return;
    }

    if (!canStart()) {
      if (networkStatus === "connected") {
        toast.error("Please grant the required device permissions first");
      } else {
        toast.error("A stable network connection is required to start the assessment");
      }
      return;
    }

    setStarting(true);
    try {
      const { data } = await api.post(`/api/candidate/assessment/${shareLink}/start`);
      const submissionId = data.data?.id;
      if (shareLink && submissionId) saveSubmissionId(shareLink, submissionId);
      if (submissionId) startSession(submissionId as string);
      navigate(`/assessment/${shareLink}/interview/${submissionId}`, { replace: true });
    } catch (e: unknown) {
      const msg = extractStartErrorMessage(e);
      if (msg.toLowerCase().includes("already completed")) {
        if (shareLink) markAssessmentDone(shareLink);
        navigate(`/assessment/${shareLink}/completed`, { replace: true });
      } else {
        toast.error(msg || "Failed to start assessment");
      }
    } finally {
      setStarting(false);
    }
  };

  if (isLoading)
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

  if (!assessment)
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

  const isMonitoring = assessment.accessibility === "monitoring";
  const totalQuestions = assessment.rounds?.reduce((s, r) => s + (r.question_count || 0), 0) || 0;
  const totalMinutes =
    assessment.rounds?.reduce((s, r) => s + (r.max_duration_minutes || 0), 0) || 0;

  const needsVideo = isMonitoring && (assessment.monitoring_config?.video_monitoring ?? false);
  const needsAudio = isMonitoring && (assessment.monitoring_config?.audio_monitoring ?? false);
  const needsScreen = isMonitoring && (assessment.monitoring_config?.screenshot_enabled ?? false);
  const needsAnyPermission = needsVideo || needsAudio;
  const cameraMicGranted = (!needsVideo || videoGranted) && (!needsAudio || audioGranted);
  const allPermissionsGranted = cameraMicGranted && (!needsScreen || screenGranted);

  const networkPillClass = {
    checking: styles.pillPending,
    connected: styles.pillGranted,
    unstable: styles.pillWarning,
    disconnected: styles.pillError,
  }[networkStatus];

  const networkLabel = {
    checking: "Checking…",
    connected: "Connected",
    unstable: "Unstable",
    disconnected: "Disconnected",
  }[networkStatus];

  const startButtonLabel = resolveStartButtonLabel(
    networkStatus,
    isMonitoring,
    allPermissionsGranted
  );

  return (
    <div className={styles.page}>
      <CandidateHeader candidateName={candidateName} />

      <div className={styles.content}>
        <div className={styles.container}>
          <div className={styles.header}>
            <h1 className={styles.title}>{assessment.name}</h1>
            {assessment.description && <p className={styles.desc}>{assessment.description}</p>}
          </div>

          <div className={styles.statsRow}>
            <div className={styles.stat}>
              <IconTime size={20} color="var(--primary-600)" />
              <span className={styles.statValue}>{totalMinutes} min</span>
              <span className={styles.statLabel}>Total Duration</span>
            </div>
            <div className={styles.stat}>
              <IconInfo size={20} color="var(--primary-600)" />
              <span className={styles.statValue}>{totalQuestions}</span>
              <span className={styles.statLabel}>Questions</span>
            </div>
            <div className={styles.stat}>
              <IconShield
                size={20}
                color={isMonitoring ? "var(--accent-600, #7c3aed)" : "var(--success-600)"}
              />
              <span className={styles.statValue}>{isMonitoring ? "Monitored" : "Normal"}</span>
              <span className={styles.statLabel}>Mode</span>
            </div>
            <div className={styles.stat}>
              <IconInfo size={20} color="var(--primary-600)" />
              <span className={styles.statValue}>{assessment.rounds?.length || 1}</span>
              <span className={styles.statLabel}>Rounds</span>
            </div>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>General Instructions</h2>
            <ul className={styles.list}>
              <li>Ensure you have a stable internet connection throughout the assessment.</li>
              <li>The interview runs in fullscreen mode — do not exit fullscreen.</li>
              <li>Do not open Developer Tools at any point during the assessment.</li>
              <li>Each round has a time limit. The assessment auto-submits when time runs out.</li>
              <li>Once you submit a round, you cannot go back to change answers.</li>
              <li>Read each question carefully before answering.</li>
            </ul>
          </div>

          {/* Network check */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Network Connection</h2>
            <div className={styles.permissionSetup}>
              <div className={styles.permissionRow}>
                <p className={styles.permissionLabel}>Internet connectivity</p>
                <div className={styles.permissionPills}>
                  <span className={`${styles.pill} ${networkPillClass}`}>
                    <IconGlobe size={12} />
                    {networkLabel}
                  </span>
                </div>
              </div>
              {networkStatus !== "connected" && (
                <Button
                  variant="secondary"
                  onClick={() => void checkNetwork()}
                  isLoading={checkingNetwork}
                  leftIcon={<IconRefresh size={16} />}
                >
                  Check Again
                </Button>
              )}
            </div>
          </div>

          {isMonitoring && (
            <div className={styles.monitoringSection}>
              <h2 className={styles.sectionTitle}>Monitoring Mode Requirements</h2>
              <div className={styles.monitoringCards}>
                {assessment.monitoring_config?.tab_monitoring && (
                  <div className={styles.monitorCard}>
                    <IconMonitor size={24} color="var(--accent-400, #a78bfa)" />
                    <div>
                      <p className={styles.monitorTitle}>Tab Monitoring Active</p>
                      <p className={styles.monitorDesc}>
                        Switching tabs or windows will be flagged as malpractice.
                      </p>
                    </div>
                  </div>
                )}
                {assessment.monitoring_config?.video_monitoring && (
                  <div className={styles.monitorCard}>
                    <IconCamera size={24} color="var(--accent-400, #a78bfa)" />
                    <div>
                      <p className={styles.monitorTitle}>Camera Required</p>
                      <p className={styles.monitorDesc}>
                        Your camera must remain on throughout the assessment.
                      </p>
                    </div>
                  </div>
                )}
                {assessment.monitoring_config?.audio_monitoring && (
                  <div className={styles.monitorCard}>
                    <IconMic size={24} color="var(--accent-400, #a78bfa)" />
                    <div>
                      <p className={styles.monitorTitle}>Microphone Required</p>
                      <p className={styles.monitorDesc}>
                        Audio will be monitored throughout the assessment.
                      </p>
                    </div>
                  </div>
                )}
                {assessment.monitoring_config?.screenshot_enabled && (
                  <div className={styles.monitorCard}>
                    <IconMonitor size={24} color="var(--accent-400, #a78bfa)" />
                    <div>
                      <p className={styles.monitorTitle}>Screen Capture Required</p>
                      <p className={styles.monitorDesc}>
                        Periodic screenshots of your screen will be captured during the assessment.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {needsAnyPermission && (
                <div className={styles.permissionSetup}>
                  <div className={styles.permissionRow}>
                    <p className={styles.permissionLabel}>Step 1: Grant Device Access</p>
                    <div className={styles.permissionPills}>
                      {needsVideo && (
                        <span
                          className={`${styles.pill} ${videoGranted ? styles.pillGranted : styles.pillPending}`}
                        >
                          <IconCamera size={12} />
                          {videoGranted ? "Camera granted" : "Camera pending"}
                        </span>
                      )}
                      {needsAudio && (
                        <span
                          className={`${styles.pill} ${audioGranted ? styles.pillGranted : styles.pillPending}`}
                        >
                          <IconMic size={12} />
                          {audioGranted ? "Microphone granted" : "Microphone pending"}
                        </span>
                      )}
                    </div>
                  </div>
                  {!cameraMicGranted && (
                    <Button
                      variant="secondary"
                      onClick={requestPermissions}
                      isLoading={checkingPermissions}
                      leftIcon={<IconCamera size={16} />}
                    >
                      Request Access
                    </Button>
                  )}
                </div>
              )}

              {needsScreen && (
                <div className={styles.permissionSetup}>
                  <div className={styles.permissionRow}>
                    <p className={styles.permissionLabel}>
                      {needsAnyPermission
                        ? "Step 2: Grant Screen Access"
                        : "Step 1: Grant Screen Access"}
                    </p>
                    <div className={styles.permissionPills}>
                      <span
                        className={`${styles.pill} ${screenGranted ? styles.pillGranted : styles.pillPending}`}
                      >
                        <IconMonitor size={12} />
                        {screenGranted ? "Screen granted" : "Screen pending"}
                      </span>
                    </div>
                  </div>
                  {!screenGranted && (
                    <Button
                      variant="secondary"
                      onClick={requestScreenAccess}
                      isLoading={checkingScreen}
                      leftIcon={<IconMonitor size={16} />}
                    >
                      Share Screen
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          <section className={styles.progressSection}>
            <h3>Assessment Overview</h3>
            <div className={styles.roundsList}>
              {assessment.rounds.map((round) => (
                <div key={round.round_number} className={styles.roundItem}>
                  <span className={styles.roundBadge}>Round {round.round_number}</span>
                  <span>{round.question_count} questions</span>
                  <span>{round.max_duration_minutes} min</span>
                </div>
              ))}
            </div>
          </section>

          {assessment.accessibility === "monitoring" && (
            <div className={styles.dndTip}>
              <strong>Tip:</strong> Enable Do Not Disturb mode on your device to avoid interruptions
              during the assessment.
            </div>
          )}

          <div className={styles.footer}>
            <Button
              size="lg"
              fullWidth
              onClick={handleStart}
              isLoading={starting}
              disabled={!canStart()}
            >
              {startButtonLabel}
            </Button>
          </div>
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
