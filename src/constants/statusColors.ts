import { SubmissionStatus } from "../types";

export interface StatusColorConfig {
  bg: string;
  text: string;
  border: string;
  label: string;
  variant: "default" | "primary" | "success" | "warning" | "error" | "accent";
}

export const STATUS_COLORS: Record<SubmissionStatus, StatusColorConfig> = {
  pending: {
    bg: "var(--color-muted)",
    text: "var(--text-secondary)",
    border: "var(--border-primary)",
    label: "Not Started",
    variant: "default",
  },
  in_progress: {
    bg: "var(--color-primary-500)",
    text: "#ffffff",
    border: "var(--color-primary-600)",
    label: "Attending",
    variant: "primary",
  },
  on_hold: {
    bg: "var(--color-warning-500)",
    text: "#ffffff",
    border: "var(--color-warning-600)",
    label: "On Hold",
    variant: "warning",
  },
  malpractice: {
    bg: "var(--color-error-500)",
    text: "#ffffff",
    border: "var(--color-error-600)",
    label: "Malpractice",
    variant: "error",
  },
  terminated: {
    bg: "#1e293b",
    text: "#ffffff",
    border: "#334155",
    label: "Terminated",
    variant: "default",
  },
  completed: {
    bg: "var(--color-success-500)",
    text: "#ffffff",
    border: "var(--color-success-600)",
    label: "Completed",
    variant: "success",
  },
};

export function getStatusColor(status: SubmissionStatus): StatusColorConfig {
  return STATUS_COLORS[status] ?? STATUS_COLORS.pending;
}

export function getStatusLabel(status: SubmissionStatus): string {
  return STATUS_COLORS[status]?.label ?? status;
}
