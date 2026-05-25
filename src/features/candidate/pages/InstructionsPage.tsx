import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from './InstructionsPage.module.css';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { api } from '@/utils/api';
import { Assessment } from '@/types';
import { IconCamera, IconMonitor, IconTime, IconShield, IconInfo } from '@/assets/icons';
import toast from 'react-hot-toast';

export default function InstructionsPage() {
  const { shareLink } = useParams<{ shareLink: string }>();
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [cameraGranted, setCameraGranted] = useState(false);
  const [checkingCamera, setCheckingCamera] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await api.get(`/api/candidate/assessment/${shareLink}`);
        setAssessment(data.data?.assessment || null);
      } catch { toast.error('Assessment not found'); }
      finally { setIsLoading(false); }
    };
    fetch();
  }, [shareLink]);

  const requestCamera = async () => {
    setCheckingCamera(true);
    try {
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setCameraGranted(true);
      toast.success('Camera and microphone access granted');
    } catch {
      toast.error('Please allow camera and microphone access to proceed');
    } finally { setCheckingCamera(false); }
  };

  const handleStart = async () => {
    if (!assessment) return;
    const isMonitoring = assessment.accessibility === 'monitoring';
    if (isMonitoring && !cameraGranted) {
      toast.error('Please grant camera access first');
      return;
    }
    setStarting(true);
    try {
      const { data } = await api.post(`/api/candidate/assessment/${shareLink}/start`);
      const submissionId = data.data?.submission_id;
      navigate(`/assessment/${shareLink}/interview/${submissionId}`);
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to start assessment');
    } finally { setStarting(false); }
  };

  if (isLoading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <Spinner size="lg" />
    </div>
  );

  if (!assessment) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', color: 'var(--text-tertiary)' }}>
      Assessment not found or link is invalid.
    </div>
  );

  const isMonitoring = assessment.accessibility === 'monitoring';
  const totalQuestions = assessment.rounds?.reduce((s, r) => s + (r.question_count || 0), 0) || 0;
  const totalMinutes = assessment.rounds?.reduce((s, r) => s + (r.max_duration_minutes || 0), 0) || 0;

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.logoRow}>
            <span className={styles.logoMark}>S</span>
            <span className={styles.logoText}>SoftSuave Hire</span>
          </div>
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
            <IconShield size={20} color={isMonitoring ? 'var(--accent-600, #7c3aed)' : 'var(--success-600)'} />
            <span className={styles.statValue}>{isMonitoring ? 'Monitored' : 'Normal'}</span>
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
                  <IconMonitor size={24} color="var(--accent-600, #7c3aed)" />
                  <div>
                    <p className={styles.monitorTitle}>Tab Monitoring Active</p>
                    <p className={styles.monitorDesc}>Switching tabs or windows will be flagged as malpractice.</p>
                  </div>
                </div>
              )}
              {assessment.monitoring_config?.camera && (
                <div className={styles.monitorCard}>
                  <IconCamera size={24} color="var(--accent-600, #7c3aed)" />
                  <div>
                    <p className={styles.monitorTitle}>Camera Required</p>
                    <p className={styles.monitorDesc}>Your camera must remain on throughout the assessment.</p>
                  </div>
                </div>
              )}
            </div>

            <div className={styles.cameraSetup}>
              <p className={styles.cameraLabel}>Step 1: Grant Camera & Microphone Access</p>
              {cameraGranted ? (
                <div className={styles.granted}>
                  <span style={{ color: 'var(--success-600)', fontWeight: 600 }}>✓ Access granted</span>
                </div>
              ) : (
                <Button variant="secondary" onClick={requestCamera} isLoading={checkingCamera}>
                  <IconCamera size={16} style={{ marginRight: 8 }} />
                  Request Access
                </Button>
              )}
            </div>
          </div>
        )}

        <div className={styles.footer}>
          <Button
            size="lg"
            fullWidth
            onClick={handleStart}
            isLoading={starting}
            disabled={isMonitoring && !cameraGranted}
          >
            {isMonitoring && !cameraGranted ? 'Grant Camera Access to Continue' : 'Start Assessment'}
          </Button>
        </div>
      </div>
    </div>
  );
}
