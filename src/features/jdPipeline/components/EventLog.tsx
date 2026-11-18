import type { PipelineEvent } from "../types";
import styles from "./EventLog.module.css";

export function EventLog({ events }: Readonly<{ events: PipelineEvent[] }>) {
  const rows = [...events].reverse();
  if (rows.length === 0) return <p className={styles.empty}>No activity yet.</p>;
  return (
    <ul className={styles.log} aria-label="Live event log">
      {rows.map((e, i) => (
        <li key={`${e.ts}-${i}`} className={styles.row}>
          <time className={styles.time}>{new Date(e.ts).toLocaleTimeString()}</time>
          <span className={styles.step}>{e.step}</span>
          <span className={`${styles.msg} ${styles[e.level] ?? ""}`}>{e.message}</span>
        </li>
      ))}
    </ul>
  );
}
