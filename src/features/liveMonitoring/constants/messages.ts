export const LIVE_MONITORING_SUCCESS = {
  SESSION_APPROVED: "Session approved. Candidate may continue.",
  SESSION_TERMINATED: "Session terminated.",
  WARNING_SENT: "Warning sent to candidate.",
} as const;

export const LIVE_MONITORING_ERRORS = {
  LOAD_FAILED: "Failed to load live sessions.",
  ACTION_FAILED: "Action failed. Please try again.",
} as const;
