import type {
  Complexity,
  QuestionType,
  AssessmentAccessibility,
  SubmissionStatus,
  MalpracticeType,
  WsMessageType,
  ShareType,
  RestrictionMode,
} from "@/constants/enums";
import type { User } from "./auth.types";

// ─── Question Bank ────────────────────────────────────────────────────────────

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

// ─── Assessment ───────────────────────────────────────────────────────────────

export interface MonitoringConfig {
  tab_monitoring: boolean;
  audio_monitoring: boolean;
  video_monitoring: boolean;
  screenshot_mode: "time_interval" | "count";
  screenshot_interval_seconds?: number;
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
  expected_candidates?: number;
  created_at: string;
  updated_at: string;
}

export interface ShareLink {
  id: string;
  share_type: ShareType;
  label: string | null;
  share_link: string;
  start_time: string | null;
  end_time: string | null;
  is_active: boolean;
  created_at: string;
  restrict_candidate_access: boolean;
  restriction_mode: RestrictionMode | null;
  restricted_emails: string[];
}

// ─── Candidate Interview ──────────────────────────────────────────────────────

export interface CandidateQuestionOption {
  text: string;
}

export interface CandidateQuestion {
  id: string;
  text: string;
  type: "mcq_single" | "mcq_multiple" | "essay";
  options?: CandidateQuestionOption[];
}

// ─── Submission ───────────────────────────────────────────────────────────────

export interface Screenshot {
  url: string;
  round: number;
  taken_at: string;
}

export interface MalpracticeEvent {
  type: MalpracticeType;
  label?: string | null;
  description?: string | null;
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

// ─── WebSocket / Session ──────────────────────────────────────────────────────

export interface SessionState {
  status: SubmissionStatus;
  remaining_seconds: number | null;
  current_question_idx: number;
  current_round: number;
}

export interface WsMessage {
  type: WsMessageType;
  status?: string;
  remaining_seconds?: number | null;
  current_question_idx?: number;
  message?: string;
}

// ─── Candidate Scheduling ─────────────────────────────────────────────────────

export interface MonitoringOverrides {
  tab_monitoring?: boolean;
  audio_monitoring?: boolean;
  video_monitoring?: boolean;
  screenshot_enabled?: boolean;
  screenshot_mode?: "time_interval" | "count";
  screenshot_interval_seconds?: number;
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

// ─── Candidate Detail View ────────────────────────────────────────────────────

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
  complexity?: Complexity;
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
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    gender: string | null;
    dob: string | null;
    institution: string | null;
    location: string | null;
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
  screenshots: Screenshot[];
}
