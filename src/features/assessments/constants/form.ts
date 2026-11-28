import type { AssessmentDraft } from "../types/assessments.types";

// Shortest allowed gap between periodic screenshots (mirrors the backend limit).
export const MIN_SCREENSHOT_INTERVAL_SECONDS = 20;

export const DEFAULT_MONITORING_CONFIG = {
  tab_monitoring: true,
  audio_monitoring: true,
  video_monitoring: true,
  screenshot_mode: "time_interval" as const,
  screenshot_interval_seconds: MIN_SCREENSHOT_INTERVAL_SECONDS,
  screenshot_enabled: true,
};

export const DEFAULT_ROUND = {
  round_number: 1,
  question_count: 10,
  max_duration_minutes: 30,
  question_ids: [] as string[],
};

export const ASSESSMENT_DRAFT_DEFAULTS: AssessmentDraft = {
  name: "",
  description: "",
  rounds: [{ ...DEFAULT_ROUND }],
  accessibility: "normal",
  monitoring_config: { ...DEFAULT_MONITORING_CONFIG },
};

export const ASSESSMENT_WIZARD_STEPS = [
  { step: 1, label: "Basic Info", key: "basic" },
  { step: 2, label: "Questions", key: "questions" },
] as const;
