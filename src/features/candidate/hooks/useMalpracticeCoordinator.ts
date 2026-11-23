import { useCallback, useEffect, useRef } from "react";
import { useAppDispatch } from "../../../store/hooks";
import {
  setMalpracticeCount,
  setLastViolation,
  setTerminated,
} from "../../../store/slices/proctoringSlice";
import api from "../../../utils/api";
import { API_ENDPOINTS } from "@/constants/api";
import { MalpracticeType, MonitoringConfig } from "../../../types";
import { useMalpracticeRecording } from "./useMalpracticeRecording";
import type { RefObject } from "react";

const VIOLATION_MESSAGES: Record<MalpracticeType, string> = {
  tab_switch: "Tab switch detected",
  fullscreen_exit: "Fullscreen exit detected",
  screen_share_stop: "Screen sharing stopped",
  devtools_open: "Developer tools opened",
  copy_paste: "Copy/paste attempted",
  keyboard_shortcut: "Keyboard shortcut blocked",
  multiple_faces: "Multiple faces detected",
  face_absence: "Face not visible",
  eye_direction: "Looking away from screen",
  background_noise: "Background noise detected",
  audio_violation: "Audio violation detected",
  speaking: "Speaking detected",
  notification_received: "OS notification interaction detected",
  multiple_monitors: "Multiple monitors detected",
};

// Types that get one free, uncounted UI warning before the first recorded violation.
// Empty = every detected audio/video violation counts immediately, so the candidate
// is terminated on the 3rd violation (MAX_MALPRACTICE_COUNT = 3 on the backend).
// Re-add types here to restore the "free first warning" behaviour.
const TWO_STRIKE_TYPES = new Set<MalpracticeType>([]);

export interface ViolationPayload {
  type: MalpracticeType;
  description?: string;
}

interface UseMalpracticeCoordinatorOptions {
  submissionId: string;
  monitoringConfig: Partial<MonitoringConfig>;
  onTerminated?: (reason: string) => void;
  videoRef?: RefObject<HTMLVideoElement | null>;
  screenStreamRef?: RefObject<MediaStream | null>;
  audioStreamRef?: RefObject<MediaStream | null>;
  captureScreenFrame?: () => Promise<Blob | null>;
}

const RETRY_BASE_MS = 1_000;
const RETRY_MAX_MS = 30_000;
const MAX_QUEUED_VIOLATIONS = 50;

interface QueuedViolation {
  event: ViolationPayload;
  description: string;
  screenImage: Blob | null;
  faceImage: Blob | null;
}

/** Network errors, timeouts, throttling and 5xx are worth retrying; other 4xx are final. */
export function isRetryableError(err: unknown): boolean {
  const status = (err as { response?: { status?: number } } | null)?.response?.status;
  if (status === undefined) return true; // no response: offline / DNS / timeout
  return status >= 500 || status === 408 || status === 429;
}

function backoffMs(attempt: number): number {
  const ceiling = Math.min(RETRY_BASE_MS * 2 ** attempt, RETRY_MAX_MS);
  return Math.round(ceiling / 2 + Math.random() * (ceiling / 2));
}

// ─── Module-level helpers ─────────────────────────────────────────────────────

async function snapshotVideoFrame(
  videoEl: HTMLVideoElement | null | undefined
): Promise<Blob | null> {
  if (!videoEl || videoEl.videoWidth === 0) return null;
  const canvas = document.createElement("canvas");
  canvas.width = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(videoEl, 0, 0);
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/jpeg", 0.8);
  });
}

/** Applies the server's verdict to the store; returns true when the session was terminated. */
function dispatchViolationResult(
  data: { malpractice_count?: number; is_terminal?: boolean },
  event: ViolationPayload,
  dispatch: ReturnType<typeof useAppDispatch>
): boolean {
  if (data.malpractice_count !== undefined) {
    dispatch(setMalpracticeCount(data.malpractice_count));
  }
  if (data.is_terminal) {
    dispatch(setTerminated({ reason: event.type }));
    return true;
  } else {
    dispatch(
      setLastViolation({
        type: event.type,
        message: `Warning ${String(data.malpractice_count)}/3: ${VIOLATION_MESSAGES[event.type]}`,
      })
    );
    return false;
  }
}

const EVIDENCE_FORWARD_WAIT_MS = 3_000; // let the final clip record a little before leaving
const EVIDENCE_FLUSH_MAX_MS = 8_000;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMalpracticeCoordinator({
  submissionId,
  monitoringConfig,
  onTerminated,
  videoRef,
  screenStreamRef,
  audioStreamRef,
  captureScreenFrame,
}: UseMalpracticeCoordinatorOptions) {
  const dispatch = useAppDispatch();
  const firstWarningIssued = useRef<Partial<Record<MalpracticeType, boolean>>>({});
  // Violations that could not be delivered yet. They are retried with backoff and as soon
  // as the browser is back online, so a flaky network can never swallow a strike.
  const queueRef = useRef<QueuedViolation[]>([]);
  const retryAttemptRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushingRef = useRef(false);
  const onTerminatedRef = useRef(onTerminated);
  useEffect(() => {
    onTerminatedRef.current = onTerminated;
  }, [onTerminated]);
  const monitoringConfigRef = useRef(monitoringConfig);

  useEffect(() => {
    monitoringConfigRef.current = monitoringConfig;
  });

  // ── Recording — unified screen + audio stream ─────────────────────────────
  // Screen recording is active when tab_monitoring or screenshot_enabled is on.
  // Audio is merged in when audio_monitoring is on.
  // If only audio_monitoring is on (no screen share), an audio-only clip is captured.
  const { prepareCapture, commitCapture, abortCapture, hasActiveCaptures, flushActiveCaptures } =
    useMalpracticeRecording({
      submissionId,
      screenStream: screenStreamRef?.current ?? null,
      audioStream: audioStreamRef?.current ?? null,
      hasScreenMonitoring: !!(
        monitoringConfig.tab_monitoring || monitoringConfig.screenshot_enabled
      ),
      hasAudioMonitoring: !!monitoringConfig.audio_monitoring,
    });

  const postViolation = useCallback(
    async (item: QueuedViolation): Promise<{ eventIndex: number; terminal: boolean }> => {
      const fd = new FormData();
      fd.append("type", item.event.type);
      fd.append("description", item.description);
      if (item.screenImage) fd.append("screen_image", item.screenImage, "screen.jpg");
      if (item.faceImage) fd.append("face_image", item.faceImage, "face.jpg");
      const response = await api.post(
        API_ENDPOINTS.CANDIDATE.SUBMISSION_MALPRACTICE(submissionId),
        fd,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      const data = response.data?.data ?? {};
      const terminal = dispatchViolationResult(data, item.event, dispatch);
      return { eventIndex: data.event_index ?? -1, terminal };
    },
    [submissionId, dispatch]
  );

  /** Leave the exam only after the terminating violation's clip is safely uploaded. */
  const terminateAfterEvidence = useCallback(
    async (reason: string): Promise<void> => {
      try {
        if (hasActiveCaptures?.()) {
          await new Promise((r) => setTimeout(r, EVIDENCE_FORWARD_WAIT_MS));
          await flushActiveCaptures?.(EVIDENCE_FLUSH_MAX_MS);
        }
      } finally {
        onTerminatedRef.current?.(reason);
      }
    },
    [hasActiveCaptures, flushActiveCaptures]
  );

  const flushQueue = useCallback(async (): Promise<void> => {
    if (flushingRef.current) return;
    flushingRef.current = true;
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = null;
    try {
      while (queueRef.current.length > 0) {
        const head = queueRef.current[0];
        try {
          const { terminal } = await postViolation(head);
          queueRef.current.shift();
          retryAttemptRef.current = 0;
          if (terminal) void terminateAfterEvidence(head.event.type);
        } catch (err) {
          if (!isRetryableError(err)) {
            queueRef.current.shift(); // e.g. 403 session already ended: nothing to record
            continue;
          }
          const delay = backoffMs(retryAttemptRef.current);
          retryAttemptRef.current += 1;
          retryTimerRef.current = setTimeout(() => void flushQueue(), delay);
          return;
        }
      }
    } finally {
      flushingRef.current = false;
    }
  }, [postViolation, terminateAfterEvidence]);

  /** Schedule a (backed-off) flush unless one is already pending. */
  const scheduleFlush = useCallback(() => {
    if (retryTimerRef.current || flushingRef.current) return;
    const delay = backoffMs(retryAttemptRef.current);
    retryAttemptRef.current += 1;
    retryTimerRef.current = setTimeout(() => void flushQueue(), delay);
  }, [flushQueue]);

  useEffect(() => {
    const onOnline = () => void flushQueue();
    globalThis.addEventListener("online", onOnline);
    return () => {
      globalThis.removeEventListener("online", onOnline);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [flushQueue]);

  const flagViolation = useCallback(
    async (event: ViolationPayload): Promise<boolean> => {
      const cfg = monitoringConfigRef.current;

      // Two-strike rule: first occurrence dispatches a UI warning only
      if (TWO_STRIKE_TYPES.has(event.type) && !firstWarningIssued.current[event.type]) {
        firstWarningIssued.current[event.type] = true;
        dispatch(
          setLastViolation({
            type: event.type,
            message: `Warning: ${VIOLATION_MESSAGES[event.type]}`,
          })
        );
        return true;
      }

      // ── Phase 1: start evidence capture BEFORE the POST ───────────────────
      // prepareCapture snapshots the ring buffer (last 5 s) and registers a
      // forward listener immediately, so footage from the violation moment is
      // captured even while the POST request is in-flight.
      const captureId = prepareCapture();

      const description = event.description ?? VIOLATION_MESSAGES[event.type] ?? "";

      const [screenImage, faceImage] = await Promise.all([
        cfg.screenshot_enabled && captureScreenFrame ? captureScreenFrame() : null,
        cfg.video_monitoring ? snapshotVideoFrame(videoRef?.current) : null,
      ]);

      const item: QueuedViolation = {
        event,
        description,
        screenImage: cfg.screenshot_enabled ? screenImage : null,
        faceImage: cfg.video_monitoring ? faceImage : null,
      };

      // Anything still queued must be delivered first so strikes stay in order.
      let eventIndex = -1;
      let terminal = false;
      let accepted = true;
      if (queueRef.current.length > 0) {
        queueRef.current.push(item);
        void flushQueue();
      } else {
        try {
          const posted = await postViolation(item);
          eventIndex = posted.eventIndex;
          terminal = posted.terminal;
        } catch (err) {
          if (isRetryableError(err)) {
            if (queueRef.current.length < MAX_QUEUED_VIOLATIONS) queueRef.current.push(item);
            console.warn("Malpractice flag failed — queued for retry:", err);
            scheduleFlush();
          } else {
            console.warn("Malpractice flag rejected:", err);
            accepted = false;
          }
        }
      }

      // ── Phase 2: commit or abort the capture ──────────────────────────────
      if (eventIndex >= 0) {
        // Associate the pre-captured ring snapshot + forward listener with
        // this eventIndex and start the 20-second forward countdown.
        commitCapture(captureId, eventIndex);
      } else {
        // POST failed — discard the pending capture to free the listener
        abortCapture(captureId);
      }
      if (terminal) await terminateAfterEvidence(event.type);
      return accepted;
    },
    [
      postViolation,
      flushQueue,
      scheduleFlush,
      terminateAfterEvidence,
      dispatch,
      videoRef,
      captureScreenFrame,
      prepareCapture,
      commitCapture,
      abortCapture,
    ]
  );

  const resetFirstWarnings = useCallback(() => {
    firstWarningIssued.current = {};
  }, []);

  const pendingViolations = useCallback(() => queueRef.current.length, []);

  return { flagViolation, resetFirstWarnings, pendingViolations };
}
