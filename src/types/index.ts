// ─── Auth ────────────────────────────────────────────────────────────────────

export type UserRole = "super_admin" | "admin" | "candidate";

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
  voice_monitoring: boolean;
  camera: boolean;
  screenshot_mode: "time_interval" | "count";
  screenshot_interval_minutes?: number;
  screenshot_count?: number;
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

export type SubmissionStatus = "pending" | "in_progress" | "completed" | "malpractice";

export interface MalpracticeFlag {
  type: string;
  flagged_at: string;
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
  malpractice_flags?: MalpracticeFlag[];
  malpractice_reason?: string;
  reaccess_count: number;
  started_at: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Screenshot {
  url: string;
  round: number;
  taken_at: string;
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
