import React from "react";
import styles from "./Badge.module.css";
import { clsx } from "@/utils/helpers";

type BadgeVariant = "default" | "primary" | "success" | "warning" | "error" | "info" | "accent";

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

export function StatusBadge({ status }: Readonly<{ status: string }>) {
  const map: Record<string, BadgeVariant> = {
    pending: "default",
    in_progress: "primary",
    completed: "success",
    malpractice: "error",
  };
  const labels: Record<string, string> = {
    pending: "Pending",
    in_progress: "In Progress",
    completed: "Completed",
    malpractice: "Malpractice",
  };
  return (
    <Badge variant={map[status] ?? "default"} dot>
      {labels[status] ?? status}
    </Badge>
  );
}
