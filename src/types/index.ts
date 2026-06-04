// ─── Auth ────────────────────────────────────────────────────────────────────

export enum UserRole {
  SUPER_ADMIN = "super_admin",
  ADMIN = "admin",
  CANDIDATE = "candidate",
}

export interface User {
  id: string;
  first_name: string;
  last_name?: string;
  email: string;
  role: UserRole;
  is_active?: boolean;
  workspaces?: WorkspaceRef[];
  default_workspace_id?: string;
  created_at: string;
  updated_at: string;
  profile?: CandidateProfile;
}

export interface CandidateProfile {
  id: string;
  user_id: string;
  phone: string;
  father_name: string;
  gender: "male" | "female" | "other";
  dob?: string;
  college_name?: string;
  college_city?: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

// ─── Workspace ───────────────────────────────────────────────────────────────

export interface WorkspaceMember {
  user_id: string;
  email?: string;
  role: UserRole;
}

export interface WorkspaceRef {
  id: string;
  name: string;
}

export interface Workspace {
  id: string;
  name: string;
  description: string;
  created_by: string;
  members: WorkspaceMember[];
  created_at: string;
  updated_at: string;
}

// ─── Question Bank ───────────────────────────────────────────────────────────

export type Complexity = "low" | "medium" | "high";
export type QuestionType = "mcq_single" | "mcq_multi" | "essay";

export interface QuestionCategory {
  id: string;
  name: string;
  description: string;
  question_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface QuestionOption {
  id: string;
  text: string;
  is_correct: boolean;
}

export interface Question {
  id: string;
  category_id: string;
  question_text: string;
  question_type: QuestionType;
  complexity: Complexity;
  options: QuestionOption[];
  correct_answer?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ─── Assessment ──────────────────────────────────────────────────────────────

export type AssessmentAccessibility = "normal" | "monitoring";

export interface MonitoringConfig {
  tab_monitoring: boolean;
  audio_monitoring: boolean;
  video_monitoring: boolean;
  screenshot_mode: "time_interval" | "count";
  screenshot_interval_minutes?: number;
  screenshot_count?: number;
  screenshot_enabled: boolean;
}

export interface RoundConfig {
  round_number: number;
  question_count: number;
  max_duration_minutes: number;
  question_ids: string[];
}

export interface Assessment {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  rounds: RoundConfig[];
  accessibility: AssessmentAccessibility;
  monitoring_config?: MonitoringConfig;
  share_link: string;
  created_by: string;
  submission_count?: number;
  created_at: string;
  updated_at: string;
}

// ─── Candidate question (server strips is_correct, uses flat field names) ────

export interface CandidateQuestionOption {
  text: string;
}

export interface CandidateQuestion {
  id: string;
  text: string;
  type: "mcq_single" | "mcq_multiple" | "essay";
  options?: CandidateQuestionOption[];
}

// ─── Submission ──────────────────────────────────────────────────────────────

export type SubmissionStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "malpractice"
  | "on_hold"
  | "terminated";

export type MalpracticeType =
  | 'tab_switch' | 'fullscreen_exit' | 'screen_share_stop' | 'devtools_open'
  | 'copy_paste' | 'keyboard_shortcut' | 'multiple_faces' | 'face_absence'
  | 'eye_direction' | 'background_noise' | 'audio_violation' | 'speaking';

export interface MalpracticeEvent {
  type: MalpracticeType;
  timestamp: string;
  round: number;
  screen_image_url: string | null;
  face_image_url: string | null;
  screen_video_url: string | null;
  audio_clip_url: string | null;
  is_terminal: boolean;
}

export interface RoundData {
  round_number: number;
  question_count: number;
  max_duration_minutes: number;
  questions: Question[];
  answers: Record<string, string | string[]>;
  completed: boolean;
  started_at?: string;
}

export interface Submission {
  id: string;
  assessment_id: string;
  candidate_id: string;
  candidate?: User;
  status: SubmissionStatus;
  rounds_data: RoundData[];
  rounds?: RoundData[];
  current_round: number;
  score: number;
  percentage: number;
  score_percentage?: number;
  screenshots: Screenshot[];
  is_malpractice: boolean;
  malpractice_data: MalpracticeEvent[];
  malpractice_count: number;
  malpractice_reason?: string;
  reaccess_count: number;
  started_at: string;
  completed_at?: string;
  paused_at?: string;
  resumed_at?: string;
  remaining_seconds?: number;
  current_question_idx?: number;
  created_at: string;
  updated_at: string;
}

// ─── Submission Status (candidate route guard) ────────────────────────────────

export interface SubmissionStatusResponse {
  submission_id: string;
  status: SubmissionStatus;
  assessment_id: string;
  candidate_id: string;
  current_round: number;
  completed_at?: string | null;
  paused_at?: string | null;
  malpractice_reason?: string | null;
}

// ─── Interview Session / Network ─────────────────────────────────────────────

export interface SessionState {
  status: SubmissionStatus;
  remaining_seconds: number | null;
  current_question_idx: number;
  current_round: number;
}

export type WsMessageType =
  | "connected"
  | "on_hold"
  | "resume_approved"
  | "terminated"
  | "pong"
  | "error";

export interface WsMessage {
  type: WsMessageType;
  status?: string;
  remaining_seconds?: number | null;
  current_question_idx?: number;
  message?: string;
}

export interface Screenshot {
  url: string;
  round: number;
  taken_at: string;
}

// ─── Candidate Scheduling ────────────────────────────────────────────────────

export interface MonitoringOverrides {
  tab_monitoring?: boolean;
  audio_monitoring?: boolean;
  video_monitoring?: boolean;
  screenshot_enabled?: boolean;
  screenshot_mode?: "time_interval" | "count";
  screenshot_interval_minutes?: number;
  screenshot_count?: number;
}

export interface ScheduledRound {
  round_number: number;
  question_ids: string[];
}

export interface CandidateSchedule {
  id: string;
  assessment_id: string;
  workspace_id: string;
  candidate_id: string;
  candidate?: { first_name?: string; last_name?: string; email?: string };
  monitoring_overrides: MonitoringOverrides | null;
  rounds: ScheduledRound[] | null;
  effective_monitoring?: MonitoringConfig;
  share_link: string;
  start_time: string | null;
  end_time: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ─── Pagination ──────────────────────────────────────────────────────────────

export interface PaginationMeta {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

// ─── API Response ─────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
  detail?: string;
}

// ─── UI State ─────────────────────────────────────────────────────────────────

export type ViewMode = "list" | "grid";
export type SortOrder = "asc" | "desc";

export interface FilterState {
  search: string;
  complexity?: Complexity;
  question_type?: QuestionType;
  sort_by: string;
  sort_order: SortOrder;
  page: number;
  page_size: number;
}

// ─── Candidate Details ────────────────────────────────────────────────────────

export interface VersionSummary {
  version: number;
  status: SubmissionStatus;
  percentage: number;
  started_at: string | null;
  ended_at: string | null;
  reaccess_reason: string | null;
}

export interface QuestionAnswer {
  question_id: string;
  question_text: string;
  question_type: QuestionType;
  options: { id: string; text: string; is_correct: boolean | null }[];
  candidate_answer: string | string[];
  is_correct: boolean | null;
}

export interface RoundResult {
  round_number: number;
  score: number;
  percentage: number;
  started_at: string | null;
  completed_at: string | null;
  question_answers: QuestionAnswer[];
}

export interface CandidateSubmissionDetail {
  candidate: {
    id: string; first_name: string; last_name: string; email: string;
    phone: string | null; gender: string | null; dob: string | null;
    institution: string | null; location: string | null;
  };
  submission_id: string;
  status: SubmissionStatus;
  score: number;
  percentage: number;
  malpractice_count: number;
  reaccess_count: number;
  started_at: string | null;
  completed_at: string | null;
  current_version: number;
  available_versions: VersionSummary[];
  rounds: RoundResult[];
  malpractice_events: MalpracticeEvent[];
  screenshots: { url: string; round: number; taken_at: string }[];
}

// ─── Share Links ──────────────────────────────────────────────────────────────

export interface ShareLink {
  id: string;
  share_type: 'expirable' | 'custom';
  label: string | null;
  share_link: string;
  start_time: string | null;
  end_time: string | null;
  is_active: boolean;
  created_at: string;
}
