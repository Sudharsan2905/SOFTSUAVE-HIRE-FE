export const LOCAL_STORAGE_KEYS = {
  ACCESS_TOKEN: "ssh_access",
  REFRESH_TOKEN: "ssh_refresh",
  USER: "ssh_user",
  WORKSPACE: "hire_workspace",
  THEME: "hire_theme",
  SIDEBAR_COLLAPSED: "hire_sidebar_collapsed",
} as const;

export const SESSION_STORAGE_KEYS = {
  INTERVIEW_STATE: "hire_interview_state",
  ASSESSMENT_ENTRY: "hire_assessment_entry",
  PROCTORING_CONSENT: "hire_proctoring_consent",
} as const;

export type LocalStorageKey = (typeof LOCAL_STORAGE_KEYS)[keyof typeof LOCAL_STORAGE_KEYS];
export type SessionStorageKey = (typeof SESSION_STORAGE_KEYS)[keyof typeof SESSION_STORAGE_KEYS];
