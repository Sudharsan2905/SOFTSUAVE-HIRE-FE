// ─── Registration ─────────────────────────────────────────────────────────────

export interface GooglePrefillData {
  email: string;
  first_name: string;
  last_name: string;
  google_id: string;
  picture: string;
}

// ─── Re-exports of domain types heavily used in this feature ──────────────────

export type {
  CandidateQuestion,
  CandidateQuestionOption,
  CandidateSubmissionDetail,
  SessionState,
  WsMessage,
  MonitoringConfig,
  RoundConfig,
  RoundData,
  Submission,
  SubmissionStatusResponse,
  MalpracticeEvent,
  Screenshot,
  CandidateSchedule,
  VersionSummary,
  RoundResult,
  QuestionAnswer,
} from "@/types";
