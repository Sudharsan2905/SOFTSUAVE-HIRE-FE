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
};

const TWO_STRIKE_TYPES = new Set<MalpracticeType>([
  "face_absence",
  "multiple_faces",
  "eye_direction",
  "audio_violation",
  "speaking",
  "background_noise",
]);

export interface ViolationPayload {
  type: MalpracticeType;
  description?: string;
}

interface UseMalpracticeCoordinatorOptions {
  submissionId: string;
  monitoringConfig: MonitoringConfig;
  onTerminated?: (reason: string) => void;
  videoRef?: RefObject<HTMLVideoElement | null>;
  screenStreamRef?: RefObject<MediaStream | null>;
  audioStreamRef?: RefObject<MediaStream | null>;
  captureScreenFrame?: () => Promise<Blob | null>;
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

function dispatchViolationResult(
  data: { malpractice_count?: number; is_terminal?: boolean },
  event: ViolationPayload,
  dispatch: ReturnType<typeof useAppDispatch>,
  onTerminated?: (reason: string) => void
): void {
  if (data.malpractice_count !== undefined) {
    dispatch(setMalpracticeCount(data.malpractice_count));
  }
  if (data.is_terminal) {
    dispatch(setTerminated({ reason: event.type }));
    onTerminated?.(event.type);
  } else {
    dispatch(
      setLastViolation({
        type: event.type,
        message: `Warning ${String(data.malpractice_count)}/3: ${VIOLATION_MESSAGES[event.type]}`,
      })
    );
  }
}

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
  const monitoringConfigRef = useRef(monitoringConfig);

  useEffect(() => {
    monitoringConfigRef.current = monitoringConfig;
  });

  // ── Recording — unified screen + audio stream ─────────────────────────────
  // Screen recording is active when tab_monitoring or screenshot_enabled is on.
  // Audio is merged in when audio_monitoring is on.
  // If only audio_monitoring is on (no screen share), an audio-only clip is captured.
  const { prepareCapture, commitCapture, abortCapture } = useMalpracticeRecording({
    submissionId,
    screenStream: screenStreamRef?.current ?? null,
    audioStream: audioStreamRef?.current ?? null,
    hasScreenMonitoring: !!(monitoringConfig.tab_monitoring || monitoringConfig.screenshot_enabled),
    hasAudioMonitoring: !!monitoringConfig.audio_monitoring,
  });

  const flagViolation = useCallback(
    async (event: ViolationPayload): Promise<void> => {
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
        return;
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

      const fd = new FormData();
      fd.append("type", event.type);
      fd.append("description", description);
      if (screenImage && cfg.screenshot_enabled)
        fd.append("screen_image", screenImage, "screen.jpg");
      if (faceImage && cfg.video_monitoring) fd.append("face_image", faceImage, "face.jpg");

      let eventIndex = -1;
      try {
        const response = await api.post(
          API_ENDPOINTS.CANDIDATE.SUBMISSION_MALPRACTICE(submissionId),
          fd,
          { headers: { "Content-Type": "multipart/form-data" } }
        );
        const data = response.data?.data ?? {};
        eventIndex = data.event_index ?? -1;
        dispatchViolationResult(data, event, dispatch, onTerminated);
      } catch (err) {
        console.warn("Malpractice flag failed:", err);
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
    },
    [
      submissionId,
      dispatch,
      onTerminated,
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

  return { flagViolation, resetFirstWarnings };
}
