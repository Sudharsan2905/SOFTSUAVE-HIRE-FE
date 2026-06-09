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

function getProgressStepClass(stepNum: number, currentRound: number): string {
  if (stepNum < currentRound) return styles.stepDone;
  if (stepNum === currentRound) return styles.stepActive;
  return styles.stepPending;
}

export function RoundInstructions({
  isOpen,
  roundNumber,
  roundConfig,
  totalRounds,
  onStart,
}: Readonly<RoundInstructionsProps>) {
  if (!roundConfig) return null;

  const durationHours = Math.floor(roundConfig.max_duration_minutes / 60);
  const durationMins = roundConfig.max_duration_minutes % 60;
  const minsLabel = durationMins > 0 ? `${durationMins}m` : "";
  const durationLabel =
    durationHours > 0 ? `${durationHours}h ${minsLabel}` : `${durationMins} minutes`;

  const roundNums = Array.from({ length: totalRounds }, (_, i) => i + 1);

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
          {roundNums.map((roundNum) => (
            <div
              key={`progress-step-${roundNum}`}
              className={`${styles.progressStep} ${getProgressStepClass(roundNum, roundNumber)}`}
            >
              <div className={styles.stepCircle}>{roundNum < roundNumber ? "✓" : roundNum}</div>
              <span className={styles.stepLabel}>Round {roundNum}</span>
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
