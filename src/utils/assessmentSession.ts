/**
 * Helpers for tracking candidate assessment session state in sessionStorage.
 *
 * Keys are scoped to the share link so multiple assessments in the same
 * browser session don't collide.
 *
 * sessionStorage is cleared automatically when the tab/window closes,
 * which is intentional — each assessment session is ephemeral.
 */

/** Returns the sessionStorage key that stores the active submission ID. */
export function assessmentSessionKey(shareLink: string): string {
  return `talentia_sub_${shareLink}`;
}

/** Returns the sessionStorage key that marks an assessment as completed. */
export function assessmentDoneKey(shareLink: string): string {
  return `talentia_done_${shareLink}`;
}

/** Persist the submission ID for the given share link. */
export function saveSubmissionId(shareLink: string, submissionId: string): void {
  try {
    sessionStorage.setItem(assessmentSessionKey(shareLink), submissionId);
  } catch {
    /* sessionStorage unavailable — fail silently, security still enforced server-side */
  }
}

/** Retrieve the stored submission ID (null if not found). */
export function getSubmissionId(shareLink: string): string | null {
  try {
    return sessionStorage.getItem(assessmentSessionKey(shareLink));
  } catch {
    return null;
  }
}

/** Mark the assessment as completed in session storage. */
export function markAssessmentDone(shareLink: string): void {
  try {
    sessionStorage.setItem(assessmentDoneKey(shareLink), "true");
  } catch {
    /* fail silently */
  }
}

/** Check whether this session has a completion marker for the share link. */
export function isAssessmentDone(shareLink: string): boolean {
  try {
    return sessionStorage.getItem(assessmentDoneKey(shareLink)) === "true";
  } catch {
    return false;
  }
}

/** Clear all session data for a share link (e.g. after the session ends). */
export function clearAssessmentSession(shareLink: string): void {
  try {
    sessionStorage.removeItem(assessmentSessionKey(shareLink));
    sessionStorage.removeItem(assessmentDoneKey(shareLink));
    sessionStorage.removeItem(_timerKey(shareLink));
    sessionStorage.removeItem(_questionKey(shareLink));
  } catch {
    /* fail silently */
  }
}

// ─── Timer & question-position persistence (network-loss fallback) ────────────
// These are written frequently during an active session so we use sessionStorage
// (tab-scoped) rather than localStorage.  The server is the authoritative source;
// these are only read if the server value is unavailable (e.g. first reconnect
// before the heartbeat has persisted the latest value).

function _timerKey(shareLink: string): string {
  return `talentia_timer_${shareLink}`;
}

function _questionKey(shareLink: string): string {
  return `talentia_qidx_${shareLink}`;
}

/** Persist remaining seconds locally so a page refresh can restore the timer
 *  if the server hasn't yet received the last heartbeat. */
export function saveLocalTimerState(shareLink: string, remainingSeconds: number): void {
  try {
    sessionStorage.setItem(_timerKey(shareLink), String(remainingSeconds));
  } catch {
    /* fail silently */
  }
}

/** Return the locally-persisted remaining seconds, or null if none exists. */
export function getLocalTimerState(shareLink: string): number | null {
  try {
    const raw = sessionStorage.getItem(_timerKey(shareLink));
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** Persist the current question index locally as a reconnect fallback. */
export function saveLocalQuestionIdx(shareLink: string, idx: number): void {
  try {
    sessionStorage.setItem(_questionKey(shareLink), String(idx));
  } catch {
    /* fail silently */
  }
}

/** Return the locally-persisted question index, or 0 if none exists. */
export function getLocalQuestionIdx(shareLink: string): number {
  try {
    const raw = sessionStorage.getItem(_questionKey(shareLink));
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}
