// ─── Barrel shim ─────────────────────────────────────────────────────────────
// All types now live in dedicated files. This file re-exports everything so
// existing imports (`from "@/types"`) continue to work without changes.
// New code should import directly from the specific file.

// Enums (value + type — re-export without `type` keyword so value is preserved)
export {
  UserRole,
  SubmissionStatus,
  MalpracticeType,
  QuestionType,
  Complexity,
  AssessmentAccessibility,
  WsMessageType,
  ViewMode,
  SortOrder,
  ShareType,
  Gender,
} from "@/constants/enums";

// API types
export type { ApiResponse, PaginationMeta, PaginatedResponse, ApiError } from "./api.types";

// Auth types
export type {
  User,
  CandidateProfile,
  AuthTokens,
  WorkspaceMember,
  WorkspaceRef,
  Workspace,
} from "./auth.types";

// Domain types
export type {
  QuestionCategory,
  QuestionOption,
  Question,
  MonitoringConfig,
  RoundConfig,
  Assessment,
  ShareLink,
  CandidateQuestionOption,
  CandidateQuestion,
  Screenshot,
  MalpracticeEvent,
  RoundData,
  Submission,
  SubmissionStatusResponse,
  SessionState,
  WsMessage,
  MonitoringOverrides,
  ScheduledRound,
  CandidateSchedule,
  VersionSummary,
  QuestionAnswer,
  RoundResult,
  CandidateSubmissionDetail,
  MonitoringDetails,
} from "./domain.types";

// UI types
export type { FilterState } from "./ui.types";

// Utility types
export type { PartialBy, RequiredBy, SelectOption, AsyncState } from "./common.types";
