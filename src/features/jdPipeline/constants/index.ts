export const MIN_CANDIDATES = 1;
export const RECOMMENDED_MIN_CANDIDATES = 20;
export const MAX_CANDIDATES = 50;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const POLL_INTERVAL_MS = 2000;
export const PIPELINE_UPLOAD_TIMEOUT_MS = 5 * 60_000;
export const RESUME_ACCEPT = ".pdf,.docx";
export const PHOTO_ACCEPT = "image/*";
export const EMAIL_HINT = "Add the candidate's email here if it's not in the resume";

export const STEP_ORDER = [
  "intake",
  "analysis",
  "questions",
  "assessment",
  "provisioning",
  "invites",
] as const;

export const ACTIVE_RUN_STATUSES = ["queued", "running"] as const;

export const PIPELINE_MESSAGES = {
  LOAD_FAILED: "Failed to load the pipeline.",
  LIST_FAILED: "Failed to load pipelines.",
  CREATE_FAILED: "Failed to start the pipeline.",
  CREATED: "Pipeline started.",
  RESEND_OK: "Invites resent.",
  RESEND_FAILED: "Failed to resend invites.",
  RETRY_OK: "Retry started.",
  RETRY_FAILED: "Failed to retry the step.",
  LINK_COPIED: "Exam link copied.",
  NO_WORKSPACE: "Select a workspace first.",
  JD_REQUIRED: "Paste the job description.",
  TITLE_REQUIRED: "Enter a pipeline title.",
  RESUME_REQUIRED: "Every candidate row needs a resume.",
  FILE_TOO_LARGE: "Each file must be under 5 MB.",
} as const;
