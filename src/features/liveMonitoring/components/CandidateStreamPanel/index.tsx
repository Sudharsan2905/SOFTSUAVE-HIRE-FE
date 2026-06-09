import React, { useEffect, useRef, useState } from "react";

import { RemoteTrack, Track } from "livekit-client";

import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

import styles from "./CandidateStreamPanel.module.css";

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
  connectionError: string | null;
  onTerminate: (submissionId: string) => void;
  onResume: (submissionId: string) => void;
  onClose: () => void;
  onWarnCandidate: (submissionId: string, message: string) => void;
}

export function CandidateStreamPanel({
  session,
  screenTrack,
  isConnected,
  connectionError,
  onTerminate,
  onResume,
  onClose,
  onWarnCandidate,
}: Readonly<CandidateStreamPanelProps>) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [warnMessage, setWarnMessage] = useState("");
  const [showWarnInput, setShowWarnInput] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    // Optional chain on screenTrack?.kind narrows screenTrack to non-null after the guard
    if (!el || screenTrack?.kind !== Track.Kind.Video) return;
    screenTrack.attach(el);
    return () => {
      screenTrack.detach(el);
    };
  }, [screenTrack]);

  const elapsedMins = session.started_at
    ? Math.floor((Date.now() - new Date(session.started_at).getTime()) / 60000)
    : 0;

  function handleSendWarning() {
    const trimmed = warnMessage.trim();
    if (!trimmed) return;
    onWarnCandidate(session.submission_id, trimmed);
    setWarnMessage("");
    setShowWarnInput(false);
  }

  function renderVideoArea() {
    if (connectionError) {
      return (
        <div className={styles.noStream}>
          <p>Stream connection failed</p>
          <span>{connectionError}</span>
        </div>
      );
    }
    if (isConnected && screenTrack) {
      return <video ref={videoRef} className={styles.video} autoPlay playsInline muted />;
    }
    if (isConnected) {
      return (
        <div className={styles.noStream}>
          <p>Screen share not available</p>
          <span>Candidate may not have enabled screen sharing</span>
        </div>
      );
    }
    return (
      <div className={styles.connecting}>
        <Spinner size="md" />
        <p>Connecting to stream…</p>
      </div>
    );
  }

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

      <div className={styles.videoArea}>{renderVideoArea()}</div>

      {showWarnInput && (
        <div className={styles.warnInputArea}>
          <input
            className={styles.warnInput}
            type="text"
            placeholder="Type a warning message…"
            value={warnMessage}
            onChange={(e) => setWarnMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSendWarning();
            }}
            autoFocus
          />
          <div className={styles.warnInputActions}>
            <Button
              variant="secondary"
              onClick={() => {
                setShowWarnInput(false);
                setWarnMessage("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSendWarning} disabled={!warnMessage.trim()}>
              Send
            </Button>
          </div>
        </div>
      )}

      <div className={styles.actions}>
        {session.status === "on_hold" && (
          <Button variant="secondary" onClick={() => onResume(session.submission_id)}>
            Resume Session
          </Button>
        )}
        <Button variant="secondary" onClick={() => setShowWarnInput((v) => !v)}>
          {showWarnInput ? "Cancel Warn" : "Warn Candidate"}
        </Button>
        <Button variant="danger" onClick={() => onTerminate(session.submission_id)}>
          Terminate
        </Button>
      </div>
    </div>
  );
}
