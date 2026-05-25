import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from './InterviewPage.module.css';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { api } from '@/utils/api';
import { CandidateQuestion } from '@/types';
import { IconTime, IconAlertTriangle } from '@/assets/icons';
import toast from 'react-hot-toast';

interface RoundData {
  round_number: number;
  questions: CandidateQuestion[];
  max_duration_minutes: number;
}

type AnswerMap = Record<string, string | string[]>;

export default function InterviewPage() {
  const { shareLink, submissionId } = useParams<{ shareLink: string; submissionId: string }>();
  const navigate = useNavigate();

  const [roundData, setRoundData] = useState<RoundData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showMalpractice, setShowMalpractice] = useState(false);
  const [malpracticeCount, setMalpracticeCount] = useState(0);
  const [tabMonitoringEnabled, setTabMonitoringEnabled] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const screenshotIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const answerSyncRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchRound = useCallback(async () => {
    try {
      const { data } = await api.get(`/api/candidate/submission/${submissionId}/round`);
      const rd: RoundData = data.data?.round;
      setRoundData(rd);
      setTimeLeft((rd.max_duration_minutes || 30) * 60);
      setTabMonitoringEnabled(data.data?.tab_monitoring ?? false);
    } catch { toast.error('Failed to load questions'); }
    finally { setIsLoading(false); }
  }, [submissionId]);

  useEffect(() => { fetchRound(); }, [fetchRound]);

  // Camera stream
  useEffect(() => {
    let stream: MediaStream | null = null;
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch { /* camera optional if already granted */ }
    };
    startCamera();
    return () => { stream?.getTracks().forEach((t) => t.stop()); };
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!roundData) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          handleFinishRound(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [roundData]);

  // Screenshot capture
  useEffect(() => {
    screenshotIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || !submissionId) return;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth || 320;
        canvas.height = videoRef.current.videoHeight || 240;
        const ctx = canvas.getContext('2d');
        if (!ctx || !videoRef.current.videoWidth) return;
        ctx.drawImage(videoRef.current, 0, 0);
        canvas.toBlob(async (blob) => {
          if (!blob) return;
          const fd = new FormData();
          fd.append('file', blob, 'screenshot.jpg');
          await api.post(`/api/candidate/submission/${submissionId}/screenshot`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        }, 'image/jpeg', 0.7);
      } catch { /* silent */ }
    }, 30000);
    return () => { if (screenshotIntervalRef.current) clearInterval(screenshotIntervalRef.current); };
  }, [submissionId]);

  // Tab visibility detection
  useEffect(() => {
    if (!tabMonitoringEnabled) return;
    const handleVisibility = async () => {
      if (document.hidden) {
        setMalpracticeCount((c) => c + 1);
        setShowMalpractice(true);
        try {
          await api.post(`/api/candidate/submission/${submissionId}/malpractice`, { type: 'tab_switch' });
        } catch { /* silent */ }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [tabMonitoringEnabled, submissionId]);

  const syncAnswer = useCallback(async (questionId: string, answer: string | string[]) => {
    if (answerSyncRef.current) clearTimeout(answerSyncRef.current);
    answerSyncRef.current = setTimeout(async () => {
      try {
        await api.post(`/api/candidate/submission/${submissionId}/answer`, { question_id: questionId, answer });
      } catch { /* silent */ }
    }, 500);
  }, [submissionId]);

  const setAnswer = (questionId: string, answer: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
    syncAnswer(questionId, answer);
  };

  const handleFinishRound = async (autoSubmit = false) => {
    if (submitting) return;
    setSubmitting(true);
    setShowSubmitConfirm(false);
    try {
      const { data } = await api.post(`/api/candidate/submission/${submissionId}/finish-round`);
      if (data.data?.completed) {
        navigate(`/assessment/${shareLink}/completed`);
      } else {
        setRoundData(null);
        setIsLoading(true);
        setCurrentIdx(0);
        setAnswers({});
        await fetchRound();
      }
    } catch {
      toast.error('Failed to submit round');
      setSubmitting(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (isLoading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <Spinner size="lg" />
    </div>
  );

  if (!roundData) return null;

  const questions = roundData.questions;
  const currentQuestion = questions[currentIdx];
  const answered = Object.keys(answers).length;
  const isLowTime = timeLeft < 120;

  return (
    <div className={styles.page}>
      {/* Camera feed (hidden, records) */}
      <video ref={videoRef} autoPlay muted playsInline className={styles.hiddenVideo} />

      {/* Top bar */}
      <div className={styles.topBar}>
        <div className={styles.topLeft}>
          <span className={styles.logoMark}>S</span>
          <span className={styles.roundBadge}>Round {roundData.round_number}</span>
        </div>
        <div className={styles.progress}>
          <span className={styles.progressText}>{answered}/{questions.length} answered</span>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${(answered / questions.length) * 100}%` }} />
          </div>
        </div>
        <div className={`${styles.timer} ${isLowTime ? styles.timerLow : ''}`}>
          <IconTime size={14} />
          <span>{formatTime(timeLeft)}</span>
        </div>
      </div>

      {/* Main layout */}
      <div className={styles.layout}>
        {/* Question navigator sidebar */}
        <div className={styles.sidebar}>
          <p className={styles.sidebarTitle}>Questions</p>
          <div className={styles.qGrid}>
            {questions.map((q, i) => (
              <button
                key={q.id}
                className={`${styles.qBtn} ${currentIdx === i ? styles.qBtnActive : ''} ${answers[q.id] !== undefined ? styles.qBtnAnswered : ''}`}
                onClick={() => setCurrentIdx(i)}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div className={styles.legend}>
            <div className={styles.legendItem}><div className={`${styles.legendDot} ${styles.legendAnswered}`} /> Answered</div>
            <div className={styles.legendItem}><div className={`${styles.legendDot} ${styles.legendCurrent}`} /> Current</div>
            <div className={styles.legendItem}><div className={styles.legendDot} /> Not answered</div>
          </div>
        </div>

        {/* Question body */}
        <div className={styles.main}>
          <div className={styles.questionCard}>
            <div className={styles.questionHeader}>
              <span className={styles.qNumber}>Q{currentIdx + 1} of {questions.length}</span>
              <span className={styles.qType}>{currentQuestion.type === 'essay' ? 'Essay' : currentQuestion.type === 'mcq_multiple' ? 'Multiple Choice' : 'Single Choice'}</span>
            </div>
            <p className={styles.questionText}>{currentQuestion.text}</p>

            {currentQuestion.type === 'essay' ? (
              <textarea
                className={styles.essayBox}
                placeholder="Write your answer here..."
                value={(answers[currentQuestion.id] as string) || ''}
                onChange={(e) => setAnswer(currentQuestion.id, e.target.value)}
                rows={8}
              />
            ) : currentQuestion.type === 'mcq_multiple' ? (
              <div className={styles.options}>
                {currentQuestion.options?.map((opt, oi) => {
                  const selected = ((answers[currentQuestion.id] as string[]) || []).includes(opt.text);
                  return (
                    <label key={oi} className={`${styles.option} ${selected ? styles.optionSelected : ''}`}>
                      <input
                        type="checkbox"
                        className={styles.optionInput}
                        checked={selected}
                        onChange={() => {
                          const current = ((answers[currentQuestion.id] as string[]) || []);
                          const updated = selected ? current.filter((v) => v !== opt.text) : [...current, opt.text];
                          setAnswer(currentQuestion.id, updated);
                        }}
                      />
                      <span>{opt.text}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className={styles.options}>
                {currentQuestion.options?.map((opt, oi) => {
                  const selected = answers[currentQuestion.id] === opt.text;
                  return (
                    <label key={oi} className={`${styles.option} ${selected ? styles.optionSelected : ''}`}>
                      <input
                        type="radio"
                        className={styles.optionInput}
                        name={currentQuestion.id}
                        checked={selected}
                        onChange={() => setAnswer(currentQuestion.id, opt.text)}
                      />
                      <span>{opt.text}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className={styles.navRow}>
            <Button variant="secondary" onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))} disabled={currentIdx === 0}>
              Previous
            </Button>
            {currentIdx < questions.length - 1 ? (
              <Button onClick={() => setCurrentIdx((i) => i + 1)}>Next</Button>
            ) : (
              <Button onClick={() => setShowSubmitConfirm(true)} isLoading={submitting}>
                Submit Round
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Submit confirmation modal */}
      <Modal
        isOpen={showSubmitConfirm}
        onClose={() => setShowSubmitConfirm(false)}
        title="Submit Round?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowSubmitConfirm(false)}>Review Answers</Button>
            <Button onClick={() => handleFinishRound()} isLoading={submitting}>Submit</Button>
          </>
        }
      >
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          You've answered {answered} of {questions.length} questions. Once submitted, you cannot change your answers.
        </p>
      </Modal>

      {/* Malpractice warning modal */}
      <Modal
        isOpen={showMalpractice}
        onClose={() => setShowMalpractice(false)}
        title="Warning: Tab Switch Detected"
        size="sm"
        footer={<Button onClick={() => setShowMalpractice(false)}>I Understand</Button>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
          <IconAlertTriangle size={40} color="var(--error-500)" />
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            Leaving the assessment tab has been flagged as malpractice ({malpracticeCount} time{malpracticeCount > 1 ? 's' : ''}). Please stay on this page.
          </p>
        </div>
      </Modal>
    </div>
  );
}
