export const LOCAL_STORAGE_KEYS = {
  ACCESS_TOKEN: "talentia_access",
  REFRESH_TOKEN: "talentia_refresh",
  USER: "talentia_user",
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

/**
 * Older builds kept the session in localStorage, which is shared by every tab and so let
 * several candidates on one machine see each other's tokens. All client state now lives in
 * sessionStorage (per tab, cleared on close); this removes any leftovers once at startup.
 */
const LEGACY_LOCAL_KEYS = [
  ...Object.values(LOCAL_STORAGE_KEYS),
  "talentia_theme",
  "talentia_sidebar_collapsed",
];

export function purgeLegacyLocalStorage(): void {
  try {
    for (const key of LEGACY_LOCAL_KEYS) localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}
