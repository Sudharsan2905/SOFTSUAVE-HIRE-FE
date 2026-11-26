import React from "react";
import styles from "./Badge.module.css";
import { clsx } from "@/utils/helpers";

type BadgeVariant =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "accent"
  | "brand";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: "sm" | "md";
  dot?: boolean;
  className?: string;
}

export function Badge({
  children,
  variant = "default",
  size = "md",
  dot = false,
  className,
}: Readonly<BadgeProps>) {
  return (
    <span className={clsx(styles.badge, styles[variant], styles[size], className)}>
      {dot && <span className={styles.dot} />}
      {children}
    </span>
  );
}

export function ComplexityBadge({ complexity }: Readonly<{ complexity: string }>) {
  const map: Record<string, BadgeVariant> = {
    low: "success",
    medium: "warning",
    high: "error",
  };
  return (
    <Badge variant={map[complexity] ?? "default"}>
      {complexity.charAt(0).toUpperCase() + complexity.slice(1)}
    </Badge>
  );
}

/**
 * Admin-facing pass/fail outcome. Renders nothing special ("—") while there is no result yet.
 * "incomplete" is used by the Score Filter for candidates who have not finished every assessment.
 */
export function ResultBadge({ result }: Readonly<{ result?: string | null }>) {
  if (result === "passed") return <Badge variant="success">Passed</Badge>;
  if (result === "failed") return <Badge variant="error">Failed</Badge>;
  if (result === "incomplete") return <Badge variant="warning">Incomplete</Badge>;
  return <span style={{ color: "var(--text-tertiary)" }}>—</span>;
}

export function StatusBadge({ status }: Readonly<{ status: string }>) {
  const map: Record<string, BadgeVariant> = {
    pending: "default",
    in_progress: "primary",
    completed: "success",
    malpractice: "error",
    terminated: "error",
    on_hold: "warning",
  };
  const labels: Record<string, string> = {
    pending: "Not Started",
    in_progress: "Attending",
    completed: "Completed",
    malpractice: "Malpractice",
    terminated: "Terminated",
    on_hold: "On Hold",
  };
  return (
    <Badge variant={map[status] ?? "default"} dot>
      {labels[status] ?? status}
    </Badge>
  );
}
