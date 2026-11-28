import type { ScoreFilterResult, ScoreFilterResultFilter } from "../types";

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

/** Result text written to the Excel export (the table shows the same words through `ResultBadge`). */
export const RESULT_LABELS: Record<ScoreFilterResult, string> = {
  passed: "Passed",
  failed: "Failed",
  incomplete: "Incomplete",
};

/**
 * Same two choices as the submissions export on the assessment's View Details page.
 * "all" ignores the search, result and sort controls; the pass percentage always applies, as it
 * is what the Result column is judged against.
 */
export const EXPORT_OPTIONS = [
  { value: "all", label: "Export All" },
  { value: "filtered", label: "Export With Filters" },
] as const;

export const EXPORT_FILE_NAME = "score_filter_results.xlsx";

export const SCORE_FILTER_ERRORS = {
  LOAD_FAILED: "Failed to load score filter results",
  ASSESSMENTS_LOAD_FAILED: "Failed to load assessments",
  EXPORT_FAILED: "Failed to export score filter results.",
  PASS_PERCENTAGE_RANGE: `Enter a value between ${PASS_PERCENTAGE_MIN} and ${PASS_PERCENTAGE_MAX}`,
} as const;
