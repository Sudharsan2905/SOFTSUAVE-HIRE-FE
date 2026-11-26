import type { ScoreFilterResultFilter } from "../types";

/** The backend rejects more than this many assessments in one request. */
export const MAX_ASSESSMENTS = 10;

export const PASS_PERCENTAGE_MIN = 0;
export const PASS_PERCENTAGE_MAX = 100;

/** Debounce for the typed pass percentage, so the list is not re-fetched on every keystroke. */
export const PASS_PERCENTAGE_DEBOUNCE_MS = 400;

interface ResultOption {
  value: ScoreFilterResultFilter;
  label: string;
}

export const RESULT_ALL: ResultOption = { value: "all", label: "All candidates" };
export const RESULT_INCOMPLETE: ResultOption = { value: "incomplete", label: "Incomplete" };
/** Only meaningful once a pass percentage is entered. */
export const RESULT_JUDGED_OPTIONS: ResultOption[] = [
  { value: "passed", label: "Passed" },
  { value: "failed", label: "Failed" },
];

/** Readable label for a candidate's state in one assessment (see backend `ScoreFilterBreakdownItem`). */
export const BREAKDOWN_STATE_LABELS: Record<string, string> = {
  not_attempted: "Not attempted",
  pending: "Not started",
  in_progress: "In progress",
  on_hold: "On hold",
  terminated: "Terminated",
  malpractice: "Malpractice",
  scoring_pending: "Scoring pending",
  completed: "Completed",
};

export const SCORE_FILTER_ERRORS = {
  LOAD_FAILED: "Failed to load score filter results",
  ASSESSMENTS_LOAD_FAILED: "Failed to load assessments",
  PASS_PERCENTAGE_RANGE: `Enter a value between ${PASS_PERCENTAGE_MIN} and ${PASS_PERCENTAGE_MAX}`,
} as const;
