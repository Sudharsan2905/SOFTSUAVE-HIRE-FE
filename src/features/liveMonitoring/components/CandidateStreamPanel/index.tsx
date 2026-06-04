import React, { useEffect, useRef } from 'react';

import { RemoteTrack, Track } from 'livekit-client';

import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';

import styles from './CandidateStreamPanel.module.css';

interface LiveSession {
  submission_id: string;
  candidate_name: string;
  assessment_name: string;
  workspace_id: string;
  status: string;
  current_round: number;
  started_at: string;
}

interface CandidateStreamPanelProps {
  session: LiveSession;
  screenTrack: RemoteTrack | null;
  isConnected: boolean;
  onTerminate: (submissionId: string) => void;
  onResume: (submissionId: string) => void;
  onClose: () => void;
}

export function CandidateStreamPanel({
  session,
  screenTrack,
  isConnected,
  onTerminate,
  onResume,
  onClose,
}: CandidateStreamPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoRef.current || !screenTrack) return;
    if (screenTrack.kind === Track.Kind.Video) {
      screenTrack.attach(videoRef.current);
      return () => {
        screenTrack.detach(videoRef.current!);
      };
    }
  }, [screenTrack]);

  const elapsedMins = session.started_at
    ? Math.floor((Date.now() - new Date(session.started_at).getTime()) / 60000)
    : 0;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <p className={styles.candidateName}>{session.candidate_name}</p>
          <p className={styles.assessmentName}>
            {session.assessment_name} — Round {session.current_round}
          </p>
          <span className={styles.elapsed}>{elapsedMins}m elapsed</span>
        </div>
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      <div className={styles.videoArea}>
        {!isConnected ? (
          <div className={styles.connecting}>
            <Spinner size="md" />
            <p>Connecting to stream…</p>
          </div>
        ) : !screenTrack ? (
          <div className={styles.noStream}>
            <p>Screen share not available</p>
            <span>Candidate may not have enabled screen sharing</span>
          </div>
        ) : (
          <video
            ref={videoRef}
            className={styles.video}
            autoPlay
            playsInline
            muted
          />
        )}
      </div>

      <div className={styles.actions}>
        {session.status === 'on_hold' && (
          <Button
            variant="secondary"
            onClick={() => onResume(session.submission_id)}
          >
            Resume Session
          </Button>
        )}
        <Button
          variant="danger"
          onClick={() => onTerminate(session.submission_id)}
        >
          Terminate
        </Button>
      </div>
    </div>
  );
}
