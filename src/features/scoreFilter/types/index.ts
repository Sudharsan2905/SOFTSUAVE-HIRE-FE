import type { PaginationMeta } from "@/types";

/** Mirrors `ScoreFilterResponse` in the backend (`assessment_responses.py`). */

export type ScoreFilterResult = "passed" | "failed" | "incomplete";
export type ScoreFilterResultFilter = "all" | ScoreFilterResult;
export type ScoreFilterSortBy = "combined_percentage" | "name";

export interface ScoreFilterAssessment {
  id: string;
  name: string;
}

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

/** A candidate's state in one selected assessment. */
export interface ScoreFilterBreakdownItem {
  assessment_id: string;
  /** Submission status, or `not_attempted` / `scoring_pending`. */
  status: string;
  score: number | null;
  total: number | null;
  percentage: number | null;
}

export interface ScoreFilterRow {
  candidate: ScoreFilterCandidate;
  completed_count: number;
  combined_score: number | null;
  combined_total: number | null;
  combined_percentage: number | null;
  /** `null` = every assessment is done but no pass percentage has been entered yet. */
  result: ScoreFilterResult | null;
  breakdown: ScoreFilterBreakdownItem[];
}

export interface ScoreFilterData {
  assessments: ScoreFilterAssessment[];
  pass_percentage: number | null;
  summary: ScoreFilterSummary;
  candidates: ScoreFilterRow[];
  pagination: PaginationMeta;
}
