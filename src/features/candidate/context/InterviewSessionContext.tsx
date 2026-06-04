import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import {
  useNetworkMonitoring,
  type NetworkStatus,
} from "@/features/candidate/hooks/useNetworkMonitoring";
import { useAppSelector } from "@/store/hooks";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface SessionCallbacks {
  onSessionState: (remainingSeconds: number | null, questionIdx: number) => void;
  onSessionOnHold: () => void;
  onResumeApproved: (remainingSeconds: number | null, questionIdx: number) => void;
  onTerminated: () => void;
  onAdminWarning: (message: string) => void;
  getRemainingSeconds: () => number;
  getCurrentQuestionIdx: () => number;
}

interface InterviewSessionContextValue {
  networkStatus: NetworkStatus;
  isOnline: boolean;
  /** Submission ID the session was started for (null before startSession is called). */
  sessionSubmissionId: string | null;
  /**
   * Activate the WebSocket connection for a submission.
   * Called by InstructionsPage after creating/resuming a submission so the
   * connection is already established by the time InterviewPage mounts.
   * Safe to call from InterviewPage as a refresh fallback.
   */
  startSession: (submissionId: string) => void;
  /**
   * Register InterviewPage callbacks that the shared WebSocket will invoke.
   * Call on mount; the context stores them in refs so the connection is not
   * restarted when the callbacks change.
   */
  registerCallbacks: (callbacks: Partial<SessionCallbacks>) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const InterviewSessionContext = createContext<InterviewSessionContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function InterviewSessionProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [sessionSubmissionId, setSessionSubmissionId] = useState<string | null>(null);
  const accessToken = useAppSelector((s) => s.auth.accessToken);

  // Stable refs updated by InterviewPage without restarting the WebSocket
  const onSessionStateRef = useRef<SessionCallbacks["onSessionState"] | null>(null);
  const onSessionOnHoldRef = useRef<SessionCallbacks["onSessionOnHold"] | null>(null);
  const onResumeApprovedRef = useRef<SessionCallbacks["onResumeApproved"] | null>(null);
  const onTerminatedRef = useRef<SessionCallbacks["onTerminated"] | null>(null);
  const onAdminWarningRef = useRef<SessionCallbacks["onAdminWarning"] | null>(null);
  const getRemainingSecondsRef = useRef<SessionCallbacks["getRemainingSeconds"]>(() => 0);
  const getCurrentQuestionIdxRef = useRef<SessionCallbacks["getCurrentQuestionIdx"]>(() => 0);

  const { networkStatus, isOnline } = useNetworkMonitoring({
    submissionId: sessionSubmissionId ?? undefined,
    accessToken,
    onSessionState: useCallback(
      (rs: number | null, qi: number) => onSessionStateRef.current?.(rs, qi),
      []
    ),
    onSessionOnHold: useCallback(() => onSessionOnHoldRef.current?.(), []),
    onResumeApproved: useCallback(
      (rs: number | null, qi: number) => onResumeApprovedRef.current?.(rs, qi),
      []
    ),
    onTerminated: useCallback(() => onTerminatedRef.current?.(), []),
    onAdminWarning: useCallback((msg: string) => onAdminWarningRef.current?.(msg), []),
    getRemainingSeconds: useCallback(() => getRemainingSecondsRef.current(), []),
    getCurrentQuestionIdx: useCallback(() => getCurrentQuestionIdxRef.current(), []),
  });

  const startSession = useCallback((submissionId: string) => {
    setSessionSubmissionId(submissionId);
  }, []);

  const registerCallbacks = useCallback((callbacks: Partial<SessionCallbacks>) => {
    if (callbacks.onSessionState) onSessionStateRef.current = callbacks.onSessionState;
    if (callbacks.onSessionOnHold) onSessionOnHoldRef.current = callbacks.onSessionOnHold;
    if (callbacks.onResumeApproved) onResumeApprovedRef.current = callbacks.onResumeApproved;
    if (callbacks.onTerminated) onTerminatedRef.current = callbacks.onTerminated;
    if (callbacks.onAdminWarning) onAdminWarningRef.current = callbacks.onAdminWarning;
    if (callbacks.getRemainingSeconds)
      getRemainingSecondsRef.current = callbacks.getRemainingSeconds;
    if (callbacks.getCurrentQuestionIdx)
      getCurrentQuestionIdxRef.current = callbacks.getCurrentQuestionIdx;
  }, []);

  const contextValue = useMemo(
    () => ({ networkStatus, isOnline, sessionSubmissionId, startSession, registerCallbacks }),
    [networkStatus, isOnline, sessionSubmissionId, startSession, registerCallbacks]
  );

  return (
    <InterviewSessionContext.Provider value={contextValue}>
      {children}
    </InterviewSessionContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useInterviewSession(): InterviewSessionContextValue {
  const ctx = useContext(InterviewSessionContext);
  if (!ctx) {
    throw new Error("useInterviewSession must be used within an InterviewSessionProvider");
  }
  return ctx;
}

export type { NetworkStatus };
