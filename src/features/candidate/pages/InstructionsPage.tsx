import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import styles from "./InstructionsPage.module.css";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { api } from "@/utils/api";
import { Assessment } from "@/types";
import { IconCamera, IconMic, IconMonitor, IconTime, IconShield, IconInfo } from "@/assets/icons";
import CandidateHeader from "@/features/candidate/components/CandidateHeader";
import { useAppSelector } from "@/store/hooks";
import toast from "react-hot-toast";

export default function InstructionsPage() {
  const { shareLink } = useParams<{ shareLink: string }>();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const lastName = user?.last_name ? ` ${user.last_name}` : "";
  const candidateName = user ? `${user.first_name}${lastName}` : undefined;

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [videoGranted, setVideoGranted] = useState(false);
  const [audioGranted, setAudioGranted] = useState(false);
  const [checkingPermissions, setCheckingPermissions] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await api.get(`/api/candidate/assessment/${shareLink}`);
        setAssessment(data?.data || null);
      } catch {
        toast.error("Assessment not found");
      } finally {
        setIsLoading(false);
      }
    };
    fetch();
  }, [shareLink]);

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
      // Stop all tracks immediately — we only needed the permission grant
      stream.getTracks().forEach((t) => t.stop());

      if (needsVideo) setVideoGranted(true);
      if (needsAudio) setAudioGranted(true);

      let permissionMsg = "Microphone access granted";
      if (needsVideo && needsAudio) permissionMsg = "Camera and microphone access granted";
      else if (needsVideo) permissionMsg = "Camera access granted";
      toast.success(permissionMsg);
    } catch {
      toast.error("Please allow the required device access to proceed");
    } finally {
      setCheckingPermissions(false);
    }
  };

  const canStart = (): boolean => {
    if (!assessment) return false;
    const cfg = assessment.monitoring_config;
    if (cfg?.video_monitoring && !videoGranted) return false;
    if (cfg?.audio_monitoring && !audioGranted) return false;
    return true;
  };

  const handleStart = async () => {
    if (!assessment) return;
    if (!canStart()) {
      toast.error("Please grant the required device permissions first");
      return;
    }
    setStarting(true);
    try {
      const { data } = await api.post(`/api/candidate/assessment/${shareLink}/start`);
      const submissionId = data.data?.id;
      navigate(`/assessment/${shareLink}/interview/${submissionId}`);
    } catch (e: unknown) {
      toast.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          "Failed to start assessment"
      );
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
  const needsAnyPermission = needsVideo || needsAudio;
  const allPermissionsGranted = (!needsVideo || videoGranted) && (!needsAudio || audioGranted);

  const startButtonLabel =
    isMonitoring && !allPermissionsGranted
      ? "Grant Required Access to Continue"
      : "Start Assessment";

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
              <li>Do not refresh the page or navigate away — your progress may be lost.</li>
              <li>Each round has a time limit. The assessment auto-submits when time runs out.</li>
              <li>Once you submit a round, you cannot go back to change answers.</li>
              <li>Read each question carefully before answering.</li>
            </ul>
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
                    <IconShield size={24} color="var(--accent-400, #a78bfa)" />
                    <div>
                      <p className={styles.monitorTitle}>Screenshots Enabled</p>
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
                  {!allPermissionsGranted && (
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
            </div>
          )}

          <div className={styles.footer}>
            <Button
              size="lg"
              fullWidth
              onClick={handleStart}
              isLoading={starting}
              disabled={isMonitoring && !allPermissionsGranted}
            >
              {startButtonLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
