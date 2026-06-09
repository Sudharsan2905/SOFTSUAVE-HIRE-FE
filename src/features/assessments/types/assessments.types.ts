import type { AssessmentAccessibility, MonitoringConfig } from "@/types";

// ─── Wizard / Form types ──────────────────────────────────────────────────────
// These are form-layer types that live here rather than in global domain types
// because they represent transient UI state, not persisted domain objects.

export interface RoundSetup {
  round_number: number;
  question_count: number;
  max_duration_minutes: number;
  question_ids: string[];
}

export interface AssessmentDraft {
  name: string;
  description: string;
  rounds: RoundSetup[];
  accessibility: AssessmentAccessibility;
  monitoring_config: MonitoringConfig;
}

export interface AssessmentWizardProps {
  workspaceId: string;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Partial<AssessmentDraft>;
  editMode?: boolean;
  assessmentId?: string;
  availableWorkspaces?: { id: string; name: string }[];
}

// Re-export domain types that are heavily used within this feature
export type { Assessment, ShareLink, Submission, RoundConfig } from "@/types";
