const V = "/api";

export const API_ENDPOINTS = {
  AUTH: {
    ADMIN_LOGIN: `${V}/auth/admin/login`,
    CANDIDATE_LOGIN: `${V}/auth/login`,
    LOGOUT: `${V}/auth/logout`,
    REFRESH: `${V}/auth/refresh`,
    GOOGLE: `${V}/auth/google`,
    CANDIDATE_REGISTER: `${V}/auth/register`,
    ME: `${V}/auth/me`,
  },

  USERS: {
    ROOT: `${V}/users`,
    BY_ID: (id: string) => `${V}/users/${id}`,
    ME: `${V}/users/me`,
    CHANGE_PASSWORD: `${V}/users/me/password`,
  },

  WORKSPACES: {
    ROOT: `${V}/workspaces`,
    BY_ID: (id: string) => `${V}/workspaces/${id}`,
    MEMBERS: (id: string) => `${V}/workspaces/${id}/members`,
    ADMIN_USERS: `${V}/workspaces/admin-users`,
    INVITE: (id: string) => `${V}/workspaces/${id}/invite`,
  },

  ASSESSMENTS: {
    ROOT: (workspaceId: string) => `${V}/workspaces/${workspaceId}/assessments`,
    BY_ID: (workspaceId: string, id: string) => `${V}/workspaces/${workspaceId}/assessments/${id}`,
    SHARE_LINKS: (workspaceId: string, id: string) =>
      `${V}/workspaces/${workspaceId}/assessments/${id}/share-links`,
    SHARE_LINK_BY_ID: (workspaceId: string, assessmentId: string, linkId: string) =>
      `${V}/workspaces/${workspaceId}/assessments/${assessmentId}/share-links/${linkId}`,
    BY_SHARE_LINK: (shareLink: string) => `${V}/assessments/entry/${shareLink}`,
    SHARE_VALIDATE: `${V}/assessments/share/validate`,
    SHARES: (workspaceId: string, assessmentId: string) =>
      `${V}/workspaces/${workspaceId}/assessments/${assessmentId}/shares`,
    SHARE_BY_ID: (workspaceId: string, assessmentId: string, shareId: string) =>
      `${V}/workspaces/${workspaceId}/assessments/${assessmentId}/shares/${shareId}`,
    SUBMISSIONS: (workspaceId: string, id: string) =>
      `${V}/workspaces/${workspaceId}/assessments/${id}/submissions`,
    SUBMISSIONS_EXPORT: (workspaceId: string, id: string) =>
      `${V}/workspaces/${workspaceId}/assessments/${id}/submissions/export`,
    SUBMISSION_RESUME: (workspaceId: string, assessmentId: string, submissionId: string) =>
      `${V}/workspaces/${workspaceId}/assessments/${assessmentId}/submissions/${submissionId}/resume`,
    SUBMISSION_TERMINATE: (workspaceId: string, assessmentId: string, submissionId: string) =>
      `${V}/workspaces/${workspaceId}/assessments/${assessmentId}/submissions/${submissionId}/terminate`,
    SUBMISSION_REACCESS: (workspaceId: string, assessmentId: string, submissionId: string) =>
      `${V}/workspaces/${workspaceId}/assessments/${assessmentId}/submissions/${submissionId}/reaccess`,
    CANDIDATE_SUBMISSION: (workspaceId: string, assessmentId: string, candidateId: string) =>
      `${V}/workspaces/${workspaceId}/assessments/${assessmentId}/candidates/${candidateId}/submission`,
    SHARE_EXPIRABLE: (workspaceId: string) =>
      `${V}/workspaces/${workspaceId}/assessments/share/expirable`,
  },

  QUESTIONS: {
    ROOT: `${V}/questions`,
    BY_ID: (id: string) => `${V}/questions/${id}`,
  },

  CATEGORIES: {
    ROOT: `${V}/questions/categories`,
    BY_ID: (id: string) => `${V}/questions/categories/${id}`,
    QUESTIONS: (id: string) => `${V}/questions/categories/${id}/questions`,
    BULK_CREATE: (id: string) => `${V}/questions/categories/${id}/bulk`,
    AI_GENERATE: (id: string) => `${V}/questions/categories/${id}/ai-generate`,
    EXCEL_IMPORT: (id: string) => `${V}/questions/categories/${id}/excel-import`,
  },

  SUBMISSIONS: {
    ROOT: `${V}/submissions`,
    BY_ID: (id: string) => `${V}/submissions/${id}`,
    START: (id: string) => `${V}/submissions/${id}/start`,
    ANSWER: (id: string) => `${V}/submissions/${id}/answer`,
    COMPLETE: (id: string) => `${V}/submissions/${id}/complete`,
    MALPRACTICE: (id: string) => `${V}/submissions/${id}/malpractice`,
    SCREENSHOT: (id: string) => `${V}/submissions/${id}/screenshot`,
    STATUS: (id: string) => `${V}/submissions/${id}/status`,
    TERMINATE: (id: string) => `${V}/candidate/submission/${id}/terminate`,
    RESUME: (id: string) => `${V}/candidate/submission/${id}/resume`,
  },

  CANDIDATE_SCHEDULES: {
    ROOT: `${V}/candidate-schedules`,
    BY_ID: (id: string) => `${V}/candidate-schedules/${id}`,
  },

  NOTIFICATIONS: {
    ROOT: `${V}/notifications`,
    BY_ID: (id: string) => `${V}/notifications/${id}`,
    MARK_READ: (id: string) => `${V}/notifications/${id}/read`,
    MARK_ALL_READ: `${V}/notifications/mark-all-read`,
  },

  CANDIDATE: {
    ASSESSMENT: (shareLink: string) => `${V}/candidate/assessment/${shareLink}`,
    ASSESSMENT_START: (shareLink: string) => `${V}/candidate/assessment/${shareLink}/start`,
    SUBMISSION_STATUS: `${V}/candidate/submission/status`,
    SUBMISSION_ROUND: (id: string) => `${V}/candidate/submission/${id}/round`,
    SUBMISSION_ANSWER: (id: string) => `${V}/candidate/submission/${id}/answer`,
    SUBMISSION_FINISH_ROUND: (id: string) => `${V}/candidate/submission/${id}/finish-round`,
    SUBMISSION_SCREENSHOT: (id: string) => `${V}/candidate/submission/${id}/screenshot`,
    SUBMISSION_MALPRACTICE: (id: string) => `${V}/candidate/submission/${id}/malpractice`,
    SUBMISSION_MALPRACTICE_MEDIA: (id: string, eventIndex: number) =>
      `${V}/candidate/submission/${id}/malpractice/${eventIndex}/media`,
    SUBMISSION_LIVEKIT_TOKEN: (id: string) => `${V}/candidate/submission/${id}/livekit-token`,
  },

  LIVE_MONITORING: {
    ACTIVE_SESSIONS: `${V}/candidate/live-interviews`,
    SESSION_BY_ID: (id: string) => `${V}/live-monitoring/sessions/${id}`,
    LIVEKIT_TOKEN: `${V}/live-interviews/livekit-token`,
  },
} as const;
