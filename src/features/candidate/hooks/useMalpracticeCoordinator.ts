import { useCallback, useEffect, useRef, RefObject } from "react";
import { useAppDispatch } from "../../../store/hooks";
import {
  setMalpracticeCount,
  setLastViolation,
  setTerminated,
} from "../../../store/slices/proctoringSlice";
import api from "../../../utils/api";
import { MalpracticeType, MonitoringConfig } from "../../../types";
import { useMediaRingBuffer } from "./useMediaRingBuffer";

const FORWARD_RECORD_MS = 10_000;
const RING_BUFFER_MS = 10_000;

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

interface InFlightRecording {
  eventIndex: number;
  stopVideoEarly: () => void;
  stopAudioEarly: () => void;
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
  onTerminated?: (reason: string) => void,
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

async function uploadMediaEvidence(
  submissionId: string,
  eventIndex: number,
  videoBlobs: Blob[],
  audioBlobs: Blob[],
  cfg: MonitoringConfig,
  videoMimeType: string,
  audioMimeType: string,
): Promise<void> {
  const hasVideo = videoBlobs.length > 0 && cfg.video_monitoring;
  const hasAudio = audioBlobs.length > 0 && cfg.audio_monitoring;
  if (!hasVideo && !hasAudio) return;

  const mediaFd = new FormData();
  if (hasVideo) {
    mediaFd.append(
      "video_chunk",
      new Blob(videoBlobs, { type: videoMimeType || "video/webm" }),
      "clip.webm",
    );
  }
  if (hasAudio) {
    mediaFd.append(
      "audio_clip",
      new Blob(audioBlobs, { type: audioMimeType || "audio/webm" }),
      "audio.webm",
    );
  }

  await api.post(
    `/api/candidate/submission/${submissionId}/malpractice/${eventIndex}/media`,
    mediaFd,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
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
  const inFlightRef = useRef<InFlightRecording[]>([]);
  const monitoringConfigRef = useRef(monitoringConfig);

  useEffect(() => {
    monitoringConfigRef.current = monitoringConfig;
  });

  // ── Ring buffers — only active when monitoring flags are enabled ───────────
  const { snapshotRing: snapshotVideoRing, startForwardRecording: startVideoFwd } =
    useMediaRingBuffer({
      stream: monitoringConfig.video_monitoring ? (screenStreamRef?.current ?? null) : null,
      maxDurationMs: RING_BUFFER_MS,
      mimeType: "video/webm;codecs=vp9",
      videoBitsPerSecond: 1_500_000,
    });

  const { snapshotRing: snapshotAudioRing, startForwardRecording: startAudioFwd } =
    useMediaRingBuffer({
      stream: monitoringConfig.audio_monitoring ? (audioStreamRef?.current ?? null) : null,
      maxDurationMs: RING_BUFFER_MS,
      mimeType: "audio/webm;codecs=opus",
      audioBitsPerSecond: 128_000,
    });

  // ── Flush in-flight recordings on unmount / page unload ──────────────────
  useEffect(() => {
    const flush = () => {
      for (const entry of inFlightRef.current) {
        entry.stopVideoEarly();
        entry.stopAudioEarly();
      }
    };
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      flush();
      inFlightRef.current = [];
    };
  }, []);

  const flagViolation = useCallback(
    async (event: ViolationPayload): Promise<void> => {
      const cfg = monitoringConfigRef.current;

      // Two-strike rule: first occurrence dispatches a warning, not a server flag
      if (TWO_STRIKE_TYPES.has(event.type) && !firstWarningIssued.current[event.type]) {
        firstWarningIssued.current[event.type] = true;
        dispatch(setLastViolation({ type: event.type, message: `Warning: ${VIOLATION_MESSAGES[event.type]}` }));
        return;
      }

      // ── Phase 1: start evidence capture, POST violation immediately ───────
      const description = event.description ?? VIOLATION_MESSAGES[event.type] ?? "";

      // Snapshot ring buffers for MIME-type lookup (blobs no longer concatenated —
      // forward recordings from a fresh MediaRecorder are always keyframe-aligned).
      const videoRingSnapshot = cfg.video_monitoring ? snapshotVideoRing() : null;
      const audioRingSnapshot = cfg.audio_monitoring ? snapshotAudioRing() : null;

      const videoFwd = cfg.video_monitoring
        ? startVideoFwd(FORWARD_RECORD_MS)
        : { promise: Promise.resolve([] as Blob[]), stopEarly: () => {} };
      const audioFwd = cfg.audio_monitoring
        ? startAudioFwd(FORWARD_RECORD_MS)
        : { promise: Promise.resolve([] as Blob[]), stopEarly: () => {} };

      const [screenImage, faceImage] = await Promise.all([
        cfg.screenshot_enabled && captureScreenFrame ? captureScreenFrame() : null,
        cfg.video_monitoring ? snapshotVideoFrame(videoRef?.current) : null,
      ]);

      const fd = new FormData();
      fd.append("type", event.type);
      fd.append("description", description);
      if (screenImage && cfg.screenshot_enabled) fd.append("screen_image", screenImage, "screen.jpg");
      if (faceImage && cfg.video_monitoring) fd.append("face_image", faceImage, "face.jpg");

      let eventIndex = -1;
      try {
        const response = await api.post(
          `/api/candidate/submission/${submissionId}/malpractice`,
          fd,
          { headers: { "Content-Type": "multipart/form-data" } },
        );
        const data = response.data?.data ?? {};
        eventIndex = data.event_index ?? -1;
        dispatchViolationResult(data, event, dispatch, onTerminated);
      } catch (err) {
        console.warn("Malpractice flag failed:", err);
      }

      // ── Phase 2: upload media evidence — fire and forget ──────────────────
      if (eventIndex < 0) {
        videoFwd.stopEarly();
        audioFwd.stopEarly();
        return;
      }

      const entry: InFlightRecording = {
        eventIndex,
        stopVideoEarly: videoFwd.stopEarly,
        stopAudioEarly: audioFwd.stopEarly,
      };
      inFlightRef.current.push(entry);

      void (async () => {
        try {
          const [videoBlobs, audioBlobs] = await Promise.all([videoFwd.promise, audioFwd.promise]);
          await uploadMediaEvidence(
            submissionId,
            eventIndex,
            videoBlobs,
            audioBlobs,
            cfg,
            videoRingSnapshot?.mimeType ?? "",
            audioRingSnapshot?.mimeType ?? "",
          );
        } catch (err) {
          console.warn("Malpractice media upload failed:", err);
        } finally {
          inFlightRef.current = inFlightRef.current.filter((e) => e !== entry);
        }
      })();
    },
    [
      submissionId,
      dispatch,
      onTerminated,
      snapshotVideoRing,
      snapshotAudioRing,
      startVideoFwd,
      startAudioFwd,
      videoRef,
      captureScreenFrame,
    ],
  );

  const resetFirstWarnings = useCallback(() => {
    firstWarningIssued.current = {};
  }, []);

  return { flagViolation, resetFirstWarnings };
}
