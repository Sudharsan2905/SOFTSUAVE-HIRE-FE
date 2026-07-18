export const COMPLEXITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
] as const;

export const QUESTION_TYPE_OPTIONS = [
  { value: "mcq_single", label: "MCQ – Single Answer" },
  { value: "mcq_multi", label: "MCQ – Multiple Answers" },
  { value: "essay", label: "Essay / Text" },
] as const;

export const SORT_ORDER_OPTIONS = [
  { value: "asc", label: "Ascending" },
  { value: "desc", label: "Descending" },
] as const;

export const PAGE_SIZE_OPTIONS = [20, 50, 100, 200] as const;
export const DEFAULT_PAGE_SIZE = 20;

export const SUBMISSION_STATUS_OPTIONS = [
  { value: "pending", label: "Not Started" },
  { value: "in_progress", label: "Attending" },
  { value: "completed", label: "Completed" },
  { value: "malpractice", label: "Malpractice" },
  { value: "on_hold", label: "On Hold" },
  { value: "terminated", label: "Terminated" },
] as const;

export const HOLD_RECONNECT_THRESHOLD_MS = 30_000; // show overlay after 30s offline
export const WS_HEARTBEAT_INTERVAL_MS = 10_000; // ping every 10s

export const AVATAR_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#ea580c",
  "#16a34a",
  "#0891b2",
  "#9333ea",
  "#dc2626",
  "#b45309",
  "#059669",
] as const;

export const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
] as const;
