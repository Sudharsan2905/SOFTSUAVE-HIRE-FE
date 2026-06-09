export const CANDIDATE_SUCCESS = {
  REGISTERED: "Registration successful. You can now log in.",
  ANSWER_SAVED: "Answer saved.",
  ROUND_COMPLETED: "Round completed successfully.",
  ASSESSMENT_SUBMITTED: "Assessment submitted successfully.",
} as const;

export const CANDIDATE_ERRORS = {
  LOGIN_FAILED: "Invalid credentials. Please try again.",
  REGISTER_FAILED: "Registration failed. Please try again.",
  LOAD_ASSESSMENT_FAILED: "Failed to load assessment. Please refresh.",
  SUBMIT_FAILED: "Failed to submit your answer. Please try again.",
  SESSION_LOST: "Your session was interrupted. Reconnecting…",
  MALPRACTICE_WARNING: "Violation detected. Further violations may disqualify you.",
  TERMINATED: "Your assessment has been terminated due to repeated violations.",
  FULLSCREEN_REQUIRED: "Fullscreen mode is required. Please go fullscreen to continue.",
  TAB_SWITCH_WARNING: "You have switched tabs. This has been recorded.",
  CAMERA_REQUIRED: "Camera access is required for this assessment.",
  MIC_REQUIRED: "Microphone access is required for this assessment.",
  SCREEN_SHARE_REQUIRED: "Screen sharing is required for this assessment.",
} as const;

export const CANDIDATE_WARNINGS = {
  MALPRACTICE_COUNT: (count: number, max: number) =>
    `Warning ${count}/${max}: Further violations will disqualify you.`,
  TIME_REMAINING: (minutes: number) => `${minutes} minute${minutes === 1 ? "" : "s"} remaining.`,
} as const;
