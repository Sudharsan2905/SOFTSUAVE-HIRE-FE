const API_BASE_PATH = "/api";

export const API_ENDPOINTS = {
  AUTH: {
    ADMIN_LOGIN: `${API_BASE_PATH}/auth/admin/login`,
    CANDIDATE_LOGIN: `${API_BASE_PATH}/auth/login`,
    LOGOUT: `${API_BASE_PATH}/auth/logout`,
    REFRESH: `${API_BASE_PATH}/auth/refresh`,
    GOOGLE: `${API_BASE_PATH}/auth/google`,
    CANDIDATE_REGISTER: `${API_BASE_PATH}/auth/register`,
    ME: `${API_BASE_PATH}/auth/me`,
  },

  USERS: {
    ROOT: `${API_BASE_PATH}/users`,
    BY_ID: (id: string) => `${API_BASE_PATH}/users/${id}`,
    ME: `${API_BASE_PATH}/users/me`,
    CHANGE_PASSWORD: `${API_BASE_PATH}/users/me/password`,
  },

  WORKSPACES: {
    ROOT: `${API_BASE_PATH}/workspaces`,
    BY_ID: (id: string) => `${API_BASE_PATH}/workspaces/${id}`,
    MEMBERS: (id: string) => `${API_BASE_PATH}/workspaces/${id}/members`,
    ADMIN_USERS: `${API_BASE_PATH}/workspaces/admin-users`,
    INVITE: (id: string) => `${API_BASE_PATH}/workspaces/${id}/invite`,
  },

  ASSESSMENTS: {
    ROOT: (workspaceId: string) => `${API_BASE_PATH}/workspaces/${workspaceId}/assessments`,
    BY_ID: (workspaceId: string, id: string) => `${API_BASE_PATH}/workspaces/${workspaceId}/assessments/${id}`,
    SHARE_LINKS: (workspaceId: string, id: string) =>
      `${API_BASE_PATH}/workspaces/${workspaceId}/assessments/${id}/share-links`,
    SHARE_LINK_BY_ID: (workspaceId: string, assessmentId: string, linkId: string) =>
      `${API_BASE_PATH}/workspaces/${workspaceId}/assessments/${assessmentId}/share-links/${linkId}`,
    BY_SHARE_LINK: (shareLink: string) => `${API_BASE_PATH}/assessments/entry/${shareLink}`,
    SHARE_VALIDATE: `${API_BASE_PATH}/assessments/share/validate`,
    SHARES: (workspaceId: string, assessmentId: string) =>
      `${API_BASE_PATH}/workspaces/${workspaceId}/assessments/${assessmentId}/shares`,
    SHARE_BY_ID: (workspaceId: string, assessmentId: string, shareId: string) =>
      `${API_BASE_PATH}/workspaces/${workspaceId}/assessments/${assessmentId}/shares/${shareId}`,
    SUBMISSIONS: (workspaceId: string, id: string) =>
      `${API_BASE_PATH}/workspaces/${workspaceId}/assessments/${id}/submissions`,
    SUBMISSIONS_EXPORT: (workspaceId: string, id: string) =>
      `${API_BASE_PATH}/workspaces/${workspaceId}/assessments/${id}/submissions/export`,
    SUBMISSION_RESUME: (workspaceId: string, assessmentId: string, submissionId: string) =>
      `${API_BASE_PATH}/workspaces/${workspaceId}/assessments/${assessmentId}/submissions/${submissionId}/resume`,
    SUBMISSION_TERMINATE: (workspaceId: string, assessmentId: string, submissionId: string) =>
      `${API_BASE_PATH}/workspaces/${workspaceId}/assessments/${assessmentId}/submissions/${submissionId}/terminate`,
    SUBMISSION_REACCESS: (workspaceId: string, assessmentId: string, submissionId: string) =>
      `${API_BASE_PATH}/workspaces/${workspaceId}/assessments/${assessmentId}/submissions/${submissionId}/reaccess`,
    CANDIDATE_SUBMISSION: (workspaceId: string, assessmentId: string, candidateId: string) =>
      `${API_BASE_PATH}/workspaces/${workspaceId}/assessments/${assessmentId}/candidates/${candidateId}/submission`,
    SHARE_EXPIRABLE: (workspaceId: string) =>
      `${API_BASE_PATH}/workspaces/${workspaceId}/assessments/share/expirable`,
  },

  QUESTIONS: {
    ROOT: `${API_BASE_PATH}/questions`,
    BY_ID: (id: string) => `${API_BASE_PATH}/questions/${id}`,
  },

  CATEGORIES: {
    ROOT: `${API_BASE_PATH}/questions/categories`,
    BY_ID: (id: string) => `${API_BASE_PATH}/questions/categories/${id}`,
    QUESTIONS: (id: string) => `${API_BASE_PATH}/questions/categories/${id}/questions`,
    BULK_CREATE: (id: string) => `${API_BASE_PATH}/questions/categories/${id}/bulk`,
    AI_GENERATE: (id: string) => `${API_BASE_PATH}/questions/categories/${id}/ai-generate`,
    EXCEL_IMPORT: (id: string) => `${API_BASE_PATH}/questions/categories/${id}/excel-import`,
  },

  SUBMISSIONS: {
    ROOT: `${API_BASE_PATH}/submissions`,
    BY_ID: (id: string) => `${API_BASE_PATH}/submissions/${id}`,
    START: (id: string) => `${API_BASE_PATH}/submissions/${id}/start`,
    ANSWER: (id: string) => `${API_BASE_PATH}/submissions/${id}/answer`,
    COMPLETE: (id: string) => `${API_BASE_PATH}/submissions/${id}/complete`,
    MALPRACTICE: (id: string) => `${API_BASE_PATH}/submissions/${id}/malpractice`,
    SCREENSHOT: (id: string) => `${API_BASE_PATH}/submissions/${id}/screenshot`,
    STATUS: (id: string) => `${API_BASE_PATH}/submissions/${id}/status`,
    TERMINATE: (id: string) => `${API_BASE_PATH}/candidate/submission/${id}/terminate`,
    RESUME: (id: string) => `${API_BASE_PATH}/candidate/submission/${id}/resume`,
  },

  CANDIDATE_SCHEDULES: {
    ROOT: `${API_BASE_PATH}/candidate-schedules`,
    BY_ID: (id: string) => `${API_BASE_PATH}/candidate-schedules/${id}`,
  },

  NOTIFICATIONS: {
    ROOT: `${API_BASE_PATH}/notifications`,
    BY_ID: (id: string) => `${API_BASE_PATH}/notifications/${id}`,
    MARK_READ: (id: string) => `${API_BASE_PATH}/notifications/${id}/read`,
    MARK_ALL_READ: `${API_BASE_PATH}/notifications/mark-all-read`,
  },

  CANDIDATE: {
    ASSESSMENT: (shareLink: string) => `${API_BASE_PATH}/candidate/assessment/${shareLink}`,
    ASSESSMENT_START: (shareLink: string) => `${API_BASE_PATH}/candidate/assessment/${shareLink}/start`,
    SUBMISSION_STATUS: `${API_BASE_PATH}/candidate/submission/status`,
    SUBMISSION_ROUND: (id: string) => `${API_BASE_PATH}/candidate/submission/${id}/round`,
    SUBMISSION_ANSWER: (id: string) => `${API_BASE_PATH}/candidate/submission/${id}/answer`,
    SUBMISSION_FINISH_ROUND: (id: string) => `${API_BASE_PATH}/candidate/submission/${id}/finish-round`,
    SUBMISSION_SCREENSHOT: (id: string) => `${API_BASE_PATH}/candidate/submission/${id}/screenshot`,
    SUBMISSION_MALPRACTICE: (id: string) => `${API_BASE_PATH}/candidate/submission/${id}/malpractice`,
    SUBMISSION_MALPRACTICE_MEDIA: (id: string, eventIndex: number) =>
      `${API_BASE_PATH}/candidate/submission/${id}/malpractice/${eventIndex}/media`,
    SUBMISSION_LIVEKIT_TOKEN: (id: string) => `${API_BASE_PATH}/candidate/submission/${id}/livekit-token`,
  },

  LIVE_MONITORING: {
    ACTIVE_SESSIONS: `${API_BASE_PATH}/candidate/live-interviews`,
    SESSION_BY_ID: (id: string) => `${API_BASE_PATH}/live-monitoring/sessions/${id}`,
    LIVEKIT_TOKEN: `${API_BASE_PATH}/live-interviews/livekit-token`,
  },
} as const;
