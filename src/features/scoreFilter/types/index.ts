import type { PaginationMeta } from "@/types";

/** Mirrors `ScoreFilterResponse` in the backend (`assessment_responses.py`). */

export type ScoreFilterResult = "passed" | "failed" | "incomplete";
export type ScoreFilterResultFilter = "all" | ScoreFilterResult;
export type ScoreFilterSortBy = "percentage" | "name";

export interface ScoreFilterAssessment {
  id: string;
  name: string;
}

/** Counts over every entry matching the search, before the result filter is applied. */
export interface ScoreFilterSummary {
  total: number;
  completed: number;
  passed: number;
  failed: number;
  incomplete: number;
}

export interface ScoreFilterCandidate {
  id: string;
  name: string;
  email: string | null;
}

/**
 * One candidate's submission in one selected assessment. The list is flat: a candidate who took
 * several of the selected assessments appears once per assessment.
 */
export interface ScoreFilterEntry {
  candidate: ScoreFilterCandidate;
  assessment: ScoreFilterAssessment;
  /** Submission status, or `scoring_pending` (completed, scoring not finished). */
  status: string;
  /** `score`, `total` and `percentage` are `null` until the submission is final. */
  score: number | null;
  total: number | null;
  percentage: number | null;
  /** `null` = final, but no pass percentage has been entered yet. */
  result: ScoreFilterResult | null;
}

export interface ScoreFilterData {
  assessments: ScoreFilterAssessment[];
  pass_percentage: number | null;
  summary: ScoreFilterSummary;
  entries: ScoreFilterEntry[];
  pagination: PaginationMeta;
}

/** One row of `/score-filter/export`: the flat, unpaged shape used for the Excel file. */
export interface ScoreFilterExportRow {
  name: string;
  email: string | null;
  assessment: string;
  status: string;
  score: number | null;
  total: number | null;
  percentage: number | null;
  result: ScoreFilterResult | null;
}
