import React from "react";
import { Badge } from "@/components/ui/Badge";
import { IconCheckCircle, IconAlertTriangle, IconRefresh } from "@/assets/icons";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import type { PipelineStep } from "../types";
import styles from "./StepTracker.module.css";

type BadgeVariant = "default" | "success" | "error" | "info" | "warning";

export const STEP_VARIANT: Record<string, BadgeVariant> = {
  pending: "default",
  running: "info",
  done: "success",
  failed: "error",
  skipped: "default",
};

function StepIcon({ status }: Readonly<{ status: string }>) {
  if (status === "done") return <IconCheckCircle size={18} className={styles.iconDone} />;
  if (status === "failed") return <IconAlertTriangle size={18} className={styles.iconFailed} />;
  if (status === "running") return <Spinner size="sm" />;
  return <span className={styles.iconPending} />;
}

interface Props {
  steps: PipelineStep[];
  canRetry: boolean;
  retrying: boolean;
  onRetry: (stepKey: string) => void;
}

export function StepTracker({ steps, canRetry, retrying, onRetry }: Readonly<Props>) {
  return (
    <ol className={styles.list} aria-label="Pipeline steps">
      {steps.map((s, idx) => {
        const total = s.progress?.total ?? 0;
        const done = s.progress?.done ?? 0;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        return (
          <li
            key={s.key}
            className={`${styles.step} ${styles[s.status] ?? ""}`}
            data-testid={`step-${s.key}`}
          >
            <div className={styles.rail}>
              <StepIcon status={s.status} />
              {idx < steps.length - 1 && <span className={styles.line} />}
            </div>
            <div className={styles.body}>
              <div className={styles.head}>
                <span className={styles.title}>{s.title}</span>
                <Badge variant={STEP_VARIANT[s.status] ?? "default"} size="sm">
                  {s.status}
                </Badge>
                <span className={styles.agent}>{s.agent}</span>
                {s.status === "failed" && canRetry && (
                  <Button
                    size="sm"
                    variant="secondary"
                    leftIcon={<IconRefresh size={14} />}
                    isLoading={retrying}
                    onClick={() => onRetry(s.key)}
                  >
                    Re-run from here
                  </Button>
                )}
              </div>
              <p className={styles.desc}>{s.description}</p>
              {total > 0 && s.status !== "pending" && (
                <div className={styles.progressRow}>
                  <div className={styles.progress}>
                    <div className={styles.progressBar} style={{ width: `${pct}%` }} />
                  </div>
                  <span className={styles.progressText}>
                    {done}/{total}
                  </span>
                </div>
              )}
              {s.detail && <p className={styles.detail}>{s.detail}</p>}
              {s.error && (
                <div className={styles.error} role="alert">
                  <strong>{s.error.message}</strong>
                  {s.error.detail && <pre>{s.error.detail}</pre>}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
