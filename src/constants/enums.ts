// Const objects produce identical union types to TS enums but are tree-shaken
// and serialize predictably to JSON. Same usage: UserRole.ADMIN, role: UserRole.

export const UserRole = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  CANDIDATE: "candidate",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const SubmissionStatus = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  MALPRACTICE: "malpractice",
  ON_HOLD: "on_hold",
  TERMINATED: "terminated",
} as const;
export type SubmissionStatus = (typeof SubmissionStatus)[keyof typeof SubmissionStatus];

export const MalpracticeType = {
  TAB_SWITCH: "tab_switch",
  FULLSCREEN_EXIT: "fullscreen_exit",
  SCREEN_SHARE_STOP: "screen_share_stop",
  DEVTOOLS_OPEN: "devtools_open",
  COPY_PASTE: "copy_paste",
  KEYBOARD_SHORTCUT: "keyboard_shortcut",
  MULTIPLE_FACES: "multiple_faces",
  FACE_ABSENCE: "face_absence",
  EYE_DIRECTION: "eye_direction",
  BACKGROUND_NOISE: "background_noise",
  AUDIO_VIOLATION: "audio_violation",
  SPEAKING: "speaking",
  NOTIFICATION_RECEIVED: "notification_received",
} as const;
export type MalpracticeType = (typeof MalpracticeType)[keyof typeof MalpracticeType];

export const QuestionType = {
  MCQ_SINGLE: "mcq_single",
  MCQ_MULTI: "mcq_multi",
  ESSAY: "essay",
} as const;
export type QuestionType = (typeof QuestionType)[keyof typeof QuestionType];

export const Complexity = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
} as const;
export type Complexity = (typeof Complexity)[keyof typeof Complexity];

export const AssessmentAccessibility = {
  NORMAL: "normal",
  MONITORING: "monitoring",
} as const;
export type AssessmentAccessibility =
  (typeof AssessmentAccessibility)[keyof typeof AssessmentAccessibility];

export const WsMessageType = {
  CONNECTED: "connected",
  ON_HOLD: "on_hold",
  RESUME_APPROVED: "resume_approved",
  TERMINATED: "terminated",
  PONG: "pong",
  ERROR: "error",
  ADMIN_WARNING: "admin_warning",
} as const;
export type WsMessageType = (typeof WsMessageType)[keyof typeof WsMessageType];

export const ViewMode = {
  LIST: "list",
  GRID: "grid",
} as const;
export type ViewMode = (typeof ViewMode)[keyof typeof ViewMode];

export const SortOrder = {
  ASC: "asc",
  DESC: "desc",
} as const;
export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder];

export const ShareType = {
  EXPIRABLE: "expirable",
  CUSTOM: "custom",
} as const;
export type ShareType = (typeof ShareType)[keyof typeof ShareType];

export const Gender = {
  MALE: "male",
  FEMALE: "female",
  OTHER: "other",
} as const;
export type Gender = (typeof Gender)[keyof typeof Gender];

export const RestrictionMode = {
  INCLUDE: "INCLUDE",
  EXCLUDE: "EXCLUDE",
} as const;
export type RestrictionMode = (typeof RestrictionMode)[keyof typeof RestrictionMode];
