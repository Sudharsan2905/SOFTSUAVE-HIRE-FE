import { useCallback, useState } from "react";
import {
  MAX_CANDIDATES,
  MAX_FILE_BYTES,
  PIPELINE_MESSAGES,
  RECOMMENDED_MIN_CANDIDATES,
} from "../constants";
import type { NewCandidateRow } from "../types";

let rowSeq = 0;
export const newRow = (): NewCandidateRow => ({
  key: `row-${++rowSeq}`,
  resume: null,
  photo: null,
  description: "",
});

export function validateNewPipeline(input: {
  title: string;
  jdText: string;
  rows: NewCandidateRow[];
  workspaceId?: string;
}): string | null {
  if (!input.workspaceId) return PIPELINE_MESSAGES.NO_WORKSPACE;
  if (!input.title.trim()) return PIPELINE_MESSAGES.TITLE_REQUIRED;
  if (input.jdText.trim().length < 20) return PIPELINE_MESSAGES.JD_REQUIRED;
  if (input.rows.length === 0 || input.rows.length > MAX_CANDIDATES)
    return `Add between 1 and ${MAX_CANDIDATES} candidates.`;
  const missing = input.rows.findIndex((r) => !r.resume && !r.description.trim());
  if (missing >= 0) return `Candidate ${missing + 1} needs a resume or a description.`;
  const tooBig = input.rows.some(
    (r) => (r.resume?.size ?? 0) > MAX_FILE_BYTES || (r.photo?.size ?? 0) > MAX_FILE_BYTES
  );
  if (tooBig) return PIPELINE_MESSAGES.FILE_TOO_LARGE;
  return null;
}

export function useNewPipelineForm() {
  const [rows, setRows] = useState<NewCandidateRow[]>(() => [newRow()]);

  const addRow = useCallback(
    () => setRows((r) => (r.length >= MAX_CANDIDATES ? r : [...r, newRow()])),
    []
  );
  const removeRow = useCallback(
    (key: string) => setRows((r) => (r.length <= 1 ? r : r.filter((x) => x.key !== key))),
    []
  );
  const updateRow = useCallback(
    (key: string, patch: Partial<NewCandidateRow>) =>
      setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x))),
    []
  );

  return {
    rows,
    addRow,
    removeRow,
    updateRow,
    belowRecommended: rows.length < RECOMMENDED_MIN_CANDIDATES,
  };
}
