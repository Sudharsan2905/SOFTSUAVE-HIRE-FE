export interface LiveSession {
  submission_id: string;
  candidate_name: string;
  assessment_name: string;
  workspace_id: string;
  status: string;
  current_round: number;
  started_at: string;
  malpractice_count: number;
}
