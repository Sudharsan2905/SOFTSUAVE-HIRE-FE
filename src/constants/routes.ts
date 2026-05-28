export const ROUTES = {
  // Auth
  ADMIN_LOGIN: "/admin/login",

  // Admin
  DASHBOARD: "/dashboard",
  QUESTION_BANK: "/question-bank",
  QUESTION_BANK_CATEGORY: "/question-bank/:categoryId",
  ASSESSMENTS: "/workspaces/:workspaceId/assessments",
  ASSESSMENT_DETAIL: "/workspaces/:workspaceId/assessments/:assessmentId",
  LIVE_INTERVIEWS: "/live-interviews",

  // Candidate
  CANDIDATE_REGISTER: "/register",
  CANDIDATE_LOGIN: "/login",
  CANDIDATE_INSTRUCTIONS: "/interview/:shareLink/instructions",
  CANDIDATE_INTERVIEW: "/interview/:shareLink/start",
  CANDIDATE_COMPLETE: "/interview/complete",
  ASSESSMENT_ENTRY: "/assessment/:shareLink",
} as const;
