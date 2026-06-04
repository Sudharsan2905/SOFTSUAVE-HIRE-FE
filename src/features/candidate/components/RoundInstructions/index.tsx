import React from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { RoundConfig } from "@/types";

import styles from "./RoundInstructions.module.css";

interface RoundInstructionsProps {
  isOpen: boolean;
  roundNumber: number;
  roundConfig: RoundConfig | null;
  totalRounds: number;
  onStart: () => void;
}

export function RoundInstructions({
  isOpen,
  roundNumber,
  roundConfig,
  totalRounds,
  onStart,
}: RoundInstructionsProps) {
  if (!roundConfig) return null;

  const durationHours = Math.floor(roundConfig.max_duration_minutes / 60);
  const durationMins = roundConfig.max_duration_minutes % 60;
  const durationLabel =
    durationHours > 0
      ? `${durationHours}h ${durationMins > 0 ? `${durationMins}m` : ""}`
      : `${durationMins} minutes`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onStart}
      title={`Round ${roundNumber} — Instructions`}
      size="md"
      footer={<Button onClick={onStart}>Start Round {roundNumber}</Button>}
    >
      <div className={styles.container}>
        <div className={styles.progressRow}>
          {Array.from({ length: totalRounds }, (_, i) => (
            <div
              key={i + 1}
              className={`${styles.progressStep} ${
                i + 1 < roundNumber
                  ? styles.stepDone
                  : i + 1 === roundNumber
                    ? styles.stepActive
                    : styles.stepPending
              }`}
            >
              <div className={styles.stepCircle}>{i + 1 < roundNumber ? "✓" : i + 1}</div>
              <span className={styles.stepLabel}>Round {i + 1}</span>
            </div>
          ))}
        </div>

        <div className={styles.statsRow}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{roundConfig.question_count}</span>
            <span className={styles.statLabel}>Questions</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.stat}>
            <span className={styles.statValue}>{durationLabel}</span>
            <span className={styles.statLabel}>Time Limit</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.stat}>
            <span className={styles.statValue}>
              {roundNumber}/{totalRounds}
            </span>
            <span className={styles.statLabel}>Round</span>
          </div>
        </div>

        <ul className={styles.rulesList}>
          <li>Answer all questions before the timer runs out.</li>
          <li>You can navigate between questions freely before submitting.</li>
          <li>Once you submit this round you cannot go back.</li>
          <li>Ensure a stable internet connection before starting.</li>
        </ul>
      </div>
    </Modal>
  );
}
