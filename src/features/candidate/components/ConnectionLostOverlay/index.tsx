import React from "react";
import styles from "./ConnectionLostOverlay.module.css";
import type { NetworkStatus } from "@/features/candidate/hooks/useNetworkMonitoring";

interface Props {
  status: NetworkStatus;
}

function ReconnectingDots() {
  return (
    <div className={styles.dots}>
      <span />
      <span />
      <span />
    </div>
  );
}

export function ConnectionLostOverlay({ status }: Readonly<Props>) {
  if (status === "connected") return null;

  const isOnHold = status === "on_hold";
  const isOffline = status === "offline";

  const titleText = isOnHold ? "Interview Paused" : isOffline ? "Connection Lost" : "Reconnecting…";

  const bodyText = isOnHold
    ? "Your session has been placed on hold due to a network interruption. Please wait — an administrator will resume your interview."
    : isOffline
    ? "Your internet connection was lost. Please check your network."
    : "Trying to reconnect to the interview server.";

  return (
    <div className={styles.overlay} role="alert" aria-live="assertive">
      <div className={styles.card}>
        <div className={styles.icon}>{isOnHold ? "⏸" : "📡"}</div>

        <p className={styles.title}>{titleText}</p>

        <p className={styles.body}>{bodyText}</p>

        {!isOnHold && <ReconnectingDots />}

        {!isOnHold && (
          <p className={styles.hint}>
            Your answers and progress are saved. The timer is paused.
          </p>
        )}

        {isOnHold && (
          <p className={styles.hint}>
            Once an administrator resumes your session your timer and answers will be fully restored.
          </p>
        )}
      </div>
    </div>
  );
}
