export type StepStatus = "pending" | "running" | "done" | "failed" | "skipped";

export interface PipelineStepError {
  message: string;
  detail?: string | null;
}

export interface PipelineStep {
  key: string;
  agent: string;
  title: string;
  description: string;
  status: StepStatus;
  progress?: { done: number; total: number } | null;
  detail?: string | null;
  error?: PipelineStepError | null;
  started_at?: string | null;
  finished_at?: string | null;
}

export interface PipelineEvent {
  ts: string;
  step: string;
  level: "info" | "warn" | "error" | string;
  message: string;
}

export interface CandidateAnalysis {
  name?: string | null;
  match_score?: number | null;
  matched_skills?: string[];
  missing_skills?: string[];
  experience_years?: number | null;
  strengths?: string[];
  gaps?: string[];
  focus_topics?: string[];
  suitable?: boolean | null;
  summary?: string | null;
}

export interface PipelineCandidate {
  id: string;
  name: string | null;
  email: string | null;
  email_source?: string | null;
  description?: string;
  has_resume?: boolean;
  has_photo?: boolean;
  resume_filename?: string | null;
  status: string;
  analysis?: CandidateAnalysis | null;
  user_id?: string | null;
  submission_id?: string | null;
  invite_status?: string | null;
  invite_error?: string | null;
  invited_at?: string | null;
  exam_status?: string | null;
  score?: number | null;
  percentage?: number | null;
  report_status?: string | null;
  report_sent_at?: string | null;
  report_error?: string | null;
  error?: string | null;
  failed_step?: string | null;
}

export type PipelineStatus = "queued" | "running" | "done" | "done_with_errors" | "failed";

export interface PipelineCounts {
  total: number;
  needs_email: number;
  analyzed: number;
  invited: number;
  invite_failed: number;
  submitted: number;
  report_sent: number;
  report_failed: number;
  failed: number;
}

export interface PipelineSummary {
  id: string;
  workspace_id: string;
  jd_title: string | null;
  status: PipelineStatus;
  error?: string | null;
  failed_step?: string | null;
  assessment_id?: string | null;
  share_link?: string | null;
  steps: PipelineStep[];
  counts?: PipelineCounts;
  created_at: string | null;
  updated_at: string | null;
}

export interface PipelineRun extends PipelineSummary {
  category_id?: string | null;
  share_id?: string | null;
  exam_url?: string | null;
  question_config?: {
    counts: Record<string, number>;
    duration_minutes?: number;
  } | null;
  events: PipelineEvent[];
  candidates: PipelineCandidate[];
}

export interface PipelineListResult {
  pipelines: PipelineSummary[];
  pagination: {
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

export interface ResendResult {
  invited: number;
  failed: number;
}

export interface NewCandidateRow {
  key: string;
  resume: File | null;
  photo: File | null;
  description: string;
}

export interface CreatePipelineInput {
  workspaceId: string;
  title: string;
  jdText: string;
  rows: NewCandidateRow[];
}
