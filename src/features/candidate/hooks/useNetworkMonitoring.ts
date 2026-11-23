/**
 * useNetworkMonitoring
 *
 * Manages the WebSocket connection to the interview session endpoint and monitors
 * network connectivity during an assessment.
 *
 * WebSocket protocol:
 *   Client → Server: { type: "ping", current_question_idx }   (the server owns the clock)
 *   Server → Client: { type: "pong" | "connected" | "on_hold" | "resume_approved" | "terminated" | "time_expired" | "error", ... }
 *
 * Reconnect strategy: exponential back-off with full jitter (so 1000 candidates never
 * reconnect in lock-step), capped at 30 s, retried indefinitely until the session ends.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";

import { WS_HEARTBEAT_INTERVAL_MS } from "@/constants/app";
import type { WsMessage } from "@/types";
import { CONFIG } from "@/constants";

const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

/** Full-jitter exponential back-off. */
function backoffDelay(attempt: number): number {
  const ceiling = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
  return Math.round(ceiling / 2 + Math.random() * (ceiling / 2));
}

type StatusSetter = React.Dispatch<React.SetStateAction<NetworkStatus>>;

interface WsMessageCallbacks {
  onSessionState?: (remaining: number | null, qIdx: number) => void;
  onSessionOnHold?: () => void;
  onResumeApproved?: (remaining: number | null, qIdx: number) => void;
  onTerminated?: () => void;
  onAdminWarning?: (message: string) => void;
  onTimeSync?: (remaining: number) => void;
  onTimeExpired?: () => void;
}

function handleConnectedMessage(
  msg: WsMessage,
  setNetworkStatus: StatusSetter,
  cbs: WsMessageCallbacks
): void {
  console.warn(
    `[WS] Session connected: remaining=${msg.remaining_seconds ?? "N/A"}s q=${msg.current_question_idx ?? 0}`
  );
  setNetworkStatus("connected");
  const hasSessionState =
    msg.remaining_seconds !== undefined || msg.current_question_idx !== undefined;
  if (hasSessionState) {
    cbs.onSessionState?.(msg.remaining_seconds ?? null, msg.current_question_idx ?? 0);
  }
}

function handleResumeApprovedMessage(
  msg: WsMessage,
  setNetworkStatus: StatusSetter,
  cbs: WsMessageCallbacks
): void {
  console.warn(
    `[WS] Session resumed: remaining=${msg.remaining_seconds ?? "N/A"}s q=${msg.current_question_idx ?? 0}`
  );
  setNetworkStatus("connected");
  cbs.onResumeApproved?.(msg.remaining_seconds ?? null, msg.current_question_idx ?? 0);
}

function processWsMessage(
  msg: WsMessage,
  setNetworkStatus: StatusSetter,
  cbs: WsMessageCallbacks
): void {
  switch (msg.type) {
    case "connected":
      handleConnectedMessage(msg, setNetworkStatus, cbs);
      break;
    case "pong":
      // Functional update: this runs from a socket handler whose closure can be stale.
      setNetworkStatus((prev) => (prev === "reconnecting" ? "connected" : prev));
      if (typeof msg.remaining_seconds === "number") cbs.onTimeSync?.(msg.remaining_seconds);
      break;
    case "time_expired":
      console.warn("[WS] Session auto-submitted by the server (time expired)");
      cbs.onTimeExpired?.();
      break;
    case "on_hold":
      console.warn("[WS] Session placed on hold by server");
      setNetworkStatus("on_hold");
      cbs.onSessionOnHold?.();
      break;
    case "resume_approved":
      handleResumeApprovedMessage(msg, setNetworkStatus, cbs);
      break;
    case "terminated":
      console.warn("[WS] Session terminated by server");
      setNetworkStatus("offline");
      cbs.onTerminated?.();
      break;
    case "admin_warning":
      console.warn(`[WS] Admin warning received: "${msg.message ?? ""}"`);
      if (msg.message) cbs.onAdminWarning?.(msg.message);
      break;
  }
}

export type NetworkStatus = "connected" | "reconnecting" | "offline" | "on_hold";

interface UseNetworkMonitoringOptions {
  submissionId: string | undefined;
  accessToken: string | null | undefined;
  /** Called with remaining seconds and question index on every successful pong / resume */
  onSessionState?: (remainingSeconds: number | null, questionIdx: number) => void;
  /** Called when the server signals ON_HOLD (admin must resume) */
  onSessionOnHold?: () => void;
  /** Called when admin resumes — provides restored timer/position */
  onResumeApproved?: (remainingSeconds: number | null, questionIdx: number) => void;
  /** Called when the session is terminated by admin */
  onTerminated?: () => void;
  /** Called when an admin sends a warning message to the candidate */
  onAdminWarning?: (message: string) => void;
  /** Server-computed remaining seconds, delivered with every heartbeat reply */
  onTimeSync?: (remainingSeconds: number) => void;
  /** Called when the server auto-submitted the session */
  onTimeExpired?: () => void;
  /** Live getter for current question index (called each heartbeat) */
  getCurrentQuestionIdx?: () => number;
}

interface UseNetworkMonitoringResult {
  networkStatus: NetworkStatus;
  isOnline: boolean;
}

export function useNetworkMonitoring({
  submissionId,
  accessToken,
  onSessionState,
  onSessionOnHold,
  onResumeApproved,
  onTerminated,
  onAdminWarning,
  onTimeSync,
  onTimeExpired,
  getCurrentQuestionIdx,
}: UseNetworkMonitoringOptions): UseNetworkMonitoringResult {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>(
    navigator.onLine ? "connected" : "offline"
  );
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);
  // Set once the server ends the session — never reconnect after that.
  const endedRef = useRef(false);

  // Stable callback refs so the WebSocket handlers don't need to be recreated
  const onSessionStateRef = useRef(onSessionState);
  const onSessionOnHoldRef = useRef(onSessionOnHold);
  const onResumeApprovedRef = useRef(onResumeApproved);
  const onTerminatedRef = useRef(onTerminated);
  const onAdminWarningRef = useRef(onAdminWarning);
  const onTimeSyncRef = useRef(onTimeSync);
  const onTimeExpiredRef = useRef(onTimeExpired);
  const getCurrentQuestionIdxRef = useRef(getCurrentQuestionIdx);

  useEffect(() => {
    onSessionStateRef.current = onSessionState;
  }, [onSessionState]);
  useEffect(() => {
    onSessionOnHoldRef.current = onSessionOnHold;
  }, [onSessionOnHold]);
  useEffect(() => {
    onResumeApprovedRef.current = onResumeApproved;
  }, [onResumeApproved]);
  useEffect(() => {
    onTerminatedRef.current = onTerminated;
  }, [onTerminated]);
  useEffect(() => {
    onAdminWarningRef.current = onAdminWarning;
  }, [onAdminWarning]);
  useEffect(() => {
    onTimeSyncRef.current = onTimeSync;
  }, [onTimeSync]);
  useEffect(() => {
    onTimeExpiredRef.current = onTimeExpired;
  }, [onTimeExpired]);
  useEffect(() => {
    getCurrentQuestionIdxRef.current = getCurrentQuestionIdx;
  }, [getCurrentQuestionIdx]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  const startHeartbeat = useCallback(
    (ws: WebSocket) => {
      stopHeartbeat();
      heartbeatRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          const qIdx = getCurrentQuestionIdxRef.current?.() ?? 0;
          ws.send(JSON.stringify({ type: "ping", current_question_idx: qIdx }));
        }
      }, WS_HEARTBEAT_INTERVAL_MS);
    },
    [stopHeartbeat]
  );

  const handleMessage = useCallback((event: MessageEvent) => {
    let msg: WsMessage;
    try {
      msg = JSON.parse(event.data as string) as WsMessage;
    } catch {
      return;
    }
    processWsMessage(msg, setNetworkStatus, {
      onSessionState: onSessionStateRef.current,
      onSessionOnHold: onSessionOnHoldRef.current,
      onResumeApproved: onResumeApprovedRef.current,
      onTerminated: () => {
        endedRef.current = true;
        onTerminatedRef.current?.();
      },
      onAdminWarning: onAdminWarningRef.current,
      onTimeSync: onTimeSyncRef.current,
      onTimeExpired: () => {
        endedRef.current = true;
        onTimeExpiredRef.current?.();
      },
    });
  }, []);

  const connect = useCallback(() => {
    if (!submissionId || !accessToken || unmountedRef.current || endedRef.current) return;

    // Never keep two sockets: drop any previous one without triggering its reconnect path.
    const previous = wsRef.current;
    if (previous) {
      previous.onclose = null;
      previous.onerror = null;
      previous.onmessage = null;
      if (previous.readyState !== WebSocket.CLOSED) previous.close();
    }

    const url = `${CONFIG.WS_URL}/api/ws/interview/${submissionId}?token=${accessToken}`;

    console.warn(`[WS] Connecting: submission=${submissionId}`);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (unmountedRef.current) {
        ws.close();
        return;
      }
      console.warn(`[WS] Connected: submission=${submissionId}`);
      retryCountRef.current = 0;
      // Do NOT mark "connected" here: only a server message may leave on_hold /
      // reconnecting, so a held session can never be un-held by simply reconnecting.
      setIsOnline(true);
      startHeartbeat(ws);
    };

    ws.onmessage = handleMessage;

    ws.onclose = (event) => {
      if (wsRef.current !== ws) return; // a newer socket replaced this one
      const reasonPart = event.reason ? ` reason="${event.reason}"` : "";
      console.warn(`[WS] Closed: submission=${submissionId} code=${event.code}${reasonPart}`);
      stopHeartbeat();
      if (unmountedRef.current) return;
      setIsOnline(false);
      // Only retry if we haven't been marked on_hold (server might push that before close)
      setNetworkStatus((prev) => {
        if (prev === "on_hold") return "on_hold";
        return "reconnecting";
      });
      // 4003 = session ended on the server; 4001/4004 = auth / unknown submission.
      if (event.code === 4003 || event.code === 4001 || event.code === 4004) {
        endedRef.current = true;
        return;
      }
      scheduleReconnect();
    };

    ws.onerror = (event) => {
      console.error(`[WS] Error: submission=${submissionId}`, event);
      // onclose fires after onerror; no additional action needed here
    };
  }, [submissionId, accessToken, startHeartbeat, stopHeartbeat, handleMessage]);

  const scheduleReconnect = useCallback(() => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    if (unmountedRef.current || endedRef.current) return;

    const delay = backoffDelay(retryCountRef.current);
    retryCountRef.current += 1;
    console.warn(
      `[WS] Reconnect attempt ${retryCountRef.current} in ${delay}ms. submission=${submissionId ?? ""}`
    );
    retryTimerRef.current = setTimeout(() => {
      if (!unmountedRef.current) connect();
    }, delay);
  }, [connect, submissionId]);

  // Browser online/offline events (supplements WebSocket)
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (networkStatus !== "on_hold" && !endedRef.current) {
        setNetworkStatus("reconnecting");
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        connect();
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
      setNetworkStatus((prev) => (prev === "on_hold" ? "on_hold" : "offline"));
      stopHeartbeat();
    };
    globalThis.addEventListener("online", handleOnline);
    globalThis.addEventListener("offline", handleOffline);
    return () => {
      globalThis.removeEventListener("online", handleOnline);
      globalThis.removeEventListener("offline", handleOffline);
    };
  }, [connect, stopHeartbeat, networkStatus]);

  // Initial connection
  useEffect(() => {
    if (!submissionId || !accessToken) return;
    unmountedRef.current = false;
    endedRef.current = false;
    connect();
    return () => {
      unmountedRef.current = true;
      stopHeartbeat();
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws) {
        // Null out onclose so the scheduleReconnect path never fires for this ws
        ws.onclose = null;
        ws.onerror = null;
        ws.onmessage = null;
        // Avoid closing a still-connecting socket (causes a browser warning);
        // onopen will see unmountedRef.current=true and close it there instead.
        if (ws.readyState !== WebSocket.CONNECTING) {
          ws.close();
        }
      }
    };
  }, [submissionId, accessToken]);

  return { networkStatus, isOnline };
}
