/**
 * useNetworkMonitoring
 *
 * Manages the WebSocket connection to the interview session endpoint and monitors
 * network connectivity during an assessment.
 *
 * WebSocket protocol:
 *   Client → Server: { type: "ping", remaining_seconds, current_question_idx }
 *   Server → Client: { type: "pong" | "connected" | "on_hold" | "resume_approved" | "terminated" | "error", ... }
 *
 * Reconnect strategy: exponential back-off capped at 10 s, up to MAX_RETRIES attempts.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { WS_HEARTBEAT_INTERVAL_MS } from "@/constants/app";
import type { WsMessage } from "@/types";

const MAX_RETRIES = 10;
const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 10_000;

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
  /** Live getter for current remaining seconds (called each heartbeat) */
  getRemainingSeconds?: () => number;
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
  getRemainingSeconds,
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

  // Stable callback refs so the WebSocket handlers don't need to be recreated
  const onSessionStateRef = useRef(onSessionState);
  const onSessionOnHoldRef = useRef(onSessionOnHold);
  const onResumeApprovedRef = useRef(onResumeApproved);
  const onTerminatedRef = useRef(onTerminated);
  const onAdminWarningRef = useRef(onAdminWarning);
  const getRemainingSecondsRef = useRef(getRemainingSeconds);
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
    getRemainingSecondsRef.current = getRemainingSeconds;
  }, [getRemainingSeconds]);
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
          const remaining = getRemainingSecondsRef.current?.() ?? null;
          const qIdx = getCurrentQuestionIdxRef.current?.() ?? 0;
          ws.send(
            JSON.stringify({
              type: "ping",
              remaining_seconds: remaining,
              current_question_idx: qIdx,
            })
          );
        }
      }, WS_HEARTBEAT_INTERVAL_MS);
    },
    [stopHeartbeat]
  );

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      let msg: WsMessage;
      try {
        msg = JSON.parse(event.data as string) as WsMessage;
      } catch {
        return;
      }

      switch (msg.type) {
        case "connected":
          console.log(`[WS] Session connected: remaining=${msg.remaining_seconds ?? "N/A"}s q=${msg.current_question_idx ?? 0}`);
          setNetworkStatus("connected");
          if (msg.remaining_seconds !== undefined || msg.current_question_idx !== undefined) {
            onSessionStateRef.current?.(
              msg.remaining_seconds ?? null,
              msg.current_question_idx ?? 0
            );
          }
          break;
        case "pong":
          if (networkStatus === "reconnecting") setNetworkStatus("connected");
          break;
        case "on_hold":
          console.warn("[WS] Session placed on hold by server");
          setNetworkStatus("on_hold");
          onSessionOnHoldRef.current?.();
          break;
        case "resume_approved":
          console.log(`[WS] Session resumed: remaining=${msg.remaining_seconds ?? "N/A"}s q=${msg.current_question_idx ?? 0}`);
          setNetworkStatus("connected");
          onResumeApprovedRef.current?.(
            msg.remaining_seconds ?? null,
            msg.current_question_idx ?? 0
          );
          break;
        case "terminated":
          console.warn("[WS] Session terminated by server");
          setNetworkStatus("offline");
          onTerminatedRef.current?.();
          break;
        case "admin_warning":
          console.log(`[WS] Admin warning received: "${msg.message ?? ""}"`);
          if (msg.message) onAdminWarningRef.current?.(msg.message);
          break;
      }
    },
    [networkStatus]
  );

  const connect = useCallback(() => {
    if (!submissionId || !accessToken || unmountedRef.current) return;

    const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
    const url = `${apiBase.replace(/^https/, "wss").replace(/^http/, "ws")}/api/ws/interview/${submissionId}?token=${accessToken}`;

    console.log(`[WS] Connecting: submission=${submissionId}`);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (unmountedRef.current) {
        ws.close();
        return;
      }
      console.log(`[WS] Connected: submission=${submissionId}`);
      retryCountRef.current = 0;
      setNetworkStatus("connected");
      setIsOnline(true);
      startHeartbeat(ws);
    };

    ws.onmessage = handleMessage;

    ws.onclose = (event) => {
      const reasonPart = event.reason ? ` reason="${event.reason}"` : "";
      console.log(`[WS] Closed: submission=${submissionId} code=${event.code}${reasonPart}`);
      stopHeartbeat();
      if (unmountedRef.current) return;
      setIsOnline(false);
      // Only retry if we haven't been marked on_hold (server might push that before close)
      setNetworkStatus((prev) => {
        if (prev === "on_hold") return "on_hold";
        return "reconnecting";
      });
      scheduleReconnect();
    };

    ws.onerror = (event) => {
      console.error(`[WS] Error: submission=${submissionId}`, event);
      // onclose fires after onerror; no additional action needed here
    };
  }, [submissionId, accessToken, startHeartbeat, stopHeartbeat, handleMessage]);

  const scheduleReconnect = useCallback(() => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    if (retryCountRef.current >= MAX_RETRIES || unmountedRef.current) {
      if (retryCountRef.current >= MAX_RETRIES) {
        console.error(`[WS] Max retries (${MAX_RETRIES}) reached, giving up. submission=${submissionId ?? ""}`);
      }
      return;
    }

    const delay = Math.min(BASE_BACKOFF_MS * 2 ** retryCountRef.current, MAX_BACKOFF_MS);
    retryCountRef.current += 1;
    console.log(`[WS] Reconnect attempt ${retryCountRef.current}/${MAX_RETRIES} in ${delay}ms. submission=${submissionId ?? ""}`);
    retryTimerRef.current = setTimeout(() => {
      if (!unmountedRef.current) connect();
    }, delay);
  }, [connect, submissionId]);

  // Browser online/offline events (supplements WebSocket)
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (networkStatus !== "on_hold") {
        setNetworkStatus("reconnecting");
        connect();
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
      setNetworkStatus((prev) => (prev === "on_hold" ? "on_hold" : "offline"));
      stopHeartbeat();
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [connect, stopHeartbeat, networkStatus]);

  // Initial connection
  useEffect(() => {
    if (!submissionId || !accessToken) return;
    unmountedRef.current = false;
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
