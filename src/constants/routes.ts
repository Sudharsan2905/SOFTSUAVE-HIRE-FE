export const ROUTES = {
  ROOT: "/",

  CANDIDATE: {
    LOGIN: "/candidate/login",
    REGISTER: "/candidate/register",
    DASHBOARD: "/candidate/dashboard",
  },

  ASSESSMENT: {
    ENTRY: "/assessment/:shareLink",
    INSTRUCTIONS: "/assessment/:shareLink/instructions",
    INTERVIEW: "/assessment/:shareLink/interview/:submissionId",
    COMPLETED: "/assessment/:shareLink/completed",
    entry: (shareLink: string) => `/assessment/${shareLink}`,
    instructions: (shareLink: string) => `/assessment/${shareLink}/instructions`,
    interview: (shareLink: string, submissionId: string) =>
      `/assessment/${shareLink}/interview/${submissionId}`,
    completed: (shareLink: string) => `/assessment/${shareLink}/completed`,
  },

  ADMIN: {
    LOGIN: "/admin/login",
    NO_ACCESS: "/admin/no-access",
    LOADER: "/loader",
    DASHBOARD: "/dashboard",
    QUESTION_BANK: "/question-bank",
    QUESTION_BANK_CATEGORY: "/question-bank/:categoryId",
    ASSESSMENTS: "/workspaces/:workspaceId/assessments",
    ASSESSMENT_DETAIL: "/workspaces/:workspaceId/assessments/:id",
    CANDIDATE_DETAIL: "/workspaces/:workspaceId/assessments/:assessmentId/candidates/:candidateId",
    LIVE_INTERVIEWS: "/live-interviews",
    PROFILE: "/profile",
    PROFILE_BY_ID: "/profile/:userId",
    NOTIFICATIONS: "/notifications",
    USERS: "/users",
    CANDIDATES: "/candidates",
    CANDIDATE_PROFILE: "/candidates/:candidateId",
    // Builders
    questionBankCategory: (categoryId: string) => `/question-bank/${categoryId}`,
    assessments: (workspaceId: string) => `/workspaces/${workspaceId}/assessments`,
    assessmentDetail: (workspaceId: string, id: string) =>
      `/workspaces/${workspaceId}/assessments/${id}`,
    candidateDetail: (workspaceId: string, assessmentId: string, candidateId: string) =>
      `/workspaces/${workspaceId}/assessments/${assessmentId}/candidates/${candidateId}`,
    profileById: (userId: string) => `/profile/${userId}`,
    candidateProfile: (candidateId: string) => `/candidates/${candidateId}`,
  },
} as const;
