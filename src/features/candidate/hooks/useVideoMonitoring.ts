import { useEffect, useRef, useCallback } from "react";
import { MalpracticeType } from "../../../types";

const DETECTION_INTERVAL_MS = 700;
const FACE_ABSENCE_THRESHOLD_MS = 3_000;
const VIOLATION_COOLDOWN_MS = 15_000;
const LOOK_AWAY_THRESHOLD_MS = 3_000; // must look away this long before flagging
const EAR_ASYMMETRY_LIMIT = 0.25; // 0 when facing straight; lower = stricter
const YAW_LIMIT = 0.12; // |nose offset| / eye distance; ~0 when facing camera (lower = stricter)
const PITCH_DOWN_LIMIT = 0.7; // nose-to-eyes / nose-to-mouth; ~1 when facing camera
const PITCH_UP_LIMIT = 1.7;
const MIN_DETECTION_CONFIDENCE = 0.55;
const MEDIAPIPE_WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const FACE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

interface UseVideoMonitoringOptions {
  enabled: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onViolation: (type: MalpracticeType, description: string) => void;
  /** The detector (wasm/model) could not be loaded: monitoring is NOT running. */
  onInitError?: (message: string) => void;
  /** Increment to retry loading the detector. */
  attempt?: number;
}

interface VideoMonitoringState {
  faceCount: number;
  isFacingCamera: boolean;
  loggedError?: boolean;
}

interface FaceDetectorInstance {
  detectForVideo: (video: HTMLVideoElement, timestamp: number) => { detections: unknown[] };
  close?: () => void;
}

interface MediaPipeModule {
  FaceDetector: {
    createFromOptions: (vision: unknown, opts: unknown) => Promise<FaceDetectorInstance>;
  };
  FilesetResolver: { forVisionTasks: (path: string) => Promise<unknown> };
}

interface DetectionContext {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  timerRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>;
  runningRef: { current: boolean };
  lastDetectionTime: React.MutableRefObject<number>;
  detectorRef: React.MutableRefObject<FaceDetectorInstance | null>;
  faceAbsenceStart: React.MutableRefObject<number | null>;
  lookAwayStart: React.MutableRefObject<number | null>;
  stateRef: React.MutableRefObject<VideoMonitoringState>;
  canFlag: (type: MalpracticeType) => boolean;
  onViolation: (type: MalpracticeType, description: string) => void;
}

interface Keypoint {
  x: number;
  y: number;
}

/**
 * Estimate where the head is pointed from BlazeFace's 6 keypoints
 * (0 right eye, 1 left eye, 2 nose tip, 3 mouth, 4 right ear, 5 left ear).
 * Returns a reason string when the candidate looks away, otherwise null.
 */
function detectLookingAway(detection: unknown): string | null {
  const kp = (detection as { keypoints?: Keypoint[] })?.keypoints;
  if (!kp || kp.length < 4) return null;
  const [rEye, lEye, nose, mouth] = kp;
  const eyeDist = Math.hypot(lEye.x - rEye.x, lEye.y - rEye.y);
  if (eyeDist < 0.01) return null;

  // Yaw: nose drifts toward one eye when the head turns left/right.
  const eyeMidX = (rEye.x + lEye.x) / 2;
  const yaw = Math.abs(nose.x - eyeMidX) / eyeDist;
  if (yaw > YAW_LIMIT) return "Looking to the side (head turned away from the screen)";

  // Second cue: ear keypoints. Facing straight, the nose sits midway between the
  // ears; turning left/right makes one side much wider than the other.
  if (kp.length >= 6) {
    const [rEar, lEar] = [kp[4], kp[5]];
    const faceWidth = Math.abs(lEar.x - rEar.x);
    if (faceWidth > 0.01) {
      const asym = Math.abs(nose.x - rEar.x - (lEar.x - nose.x)) / faceWidth;
      if (asym > EAR_ASYMMETRY_LIMIT) {
        return "Looking to the side (head turned away from the screen)";
      }
    }
  }

  // Pitch: nose-to-eyeline vs nose-to-mouth ratio changes when looking up/down.
  const eyeMidY = (rEye.y + lEye.y) / 2;
  const noseToEyes = nose.y - eyeMidY;
  const noseToMouth = mouth.y - nose.y;
  if (noseToMouth > 0.001) {
    const pitch = noseToEyes / noseToMouth;
    if (pitch < PITCH_DOWN_LIMIT) return "Looking down away from the screen";
    if (pitch > PITCH_UP_LIMIT) return "Looking up away from the screen";
  }
  return null;
}

function checkLookingAway(ctx: DetectionContext, detection: unknown, now: number): void {
  const reason = detectLookingAway(detection);
  ctx.stateRef.current.isFacingCamera = reason === null;
  if (reason === null) {
    ctx.lookAwayStart.current = null;
    return;
  }
  if (ctx.lookAwayStart.current === null) {
    ctx.lookAwayStart.current = now;
  } else if (
    now - ctx.lookAwayStart.current > LOOK_AWAY_THRESHOLD_MS &&
    ctx.canFlag("eye_direction")
  ) {
    ctx.onViolation("eye_direction", `${reason} for over ${LOOK_AWAY_THRESHOLD_MS / 1000} seconds`);
    ctx.lookAwayStart.current = null;
  }
}

function checkFaceAbsence(ctx: DetectionContext, now: number): void {
  if (ctx.faceAbsenceStart.current === null) {
    ctx.faceAbsenceStart.current = now;
  } else if (
    now - ctx.faceAbsenceStart.current > FACE_ABSENCE_THRESHOLD_MS &&
    ctx.canFlag("face_absence")
  ) {
    const absenceSecs = Math.round((now - ctx.faceAbsenceStart.current) / 1_000);
    ctx.onViolation("face_absence", `No face detected in camera feed for ${absenceSecs} seconds`);
    ctx.faceAbsenceStart.current = null;
  }
}

function processDetectionFrame(ctx: DetectionContext, now: number): void {
  ctx.lastDetectionTime.current = now;
  const video = ctx.videoRef.current;
  if (video && video.readyState >= 2 && ctx.detectorRef.current) {
    try {
      const result = ctx.detectorRef.current.detectForVideo(video, now);
      const count = result?.detections?.length ?? 0;
      ctx.stateRef.current.faceCount = count;
      if (count === 0) {
        checkFaceAbsence(ctx, now);
      } else {
        ctx.faceAbsenceStart.current = null;
      }
      if (count > 1 && ctx.canFlag("multiple_faces")) {
        ctx.onViolation("multiple_faces", `Multiple faces (${count}) detected in camera feed`);
      }
      if (count === 1) {
        checkLookingAway(ctx, result.detections[0], now);
      } else {
        ctx.lookAwayStart.current = null;
      }
    } catch (err) {
      // Usually only on the first frames; logged once so failures are diagnosable.
      if (!ctx.stateRef.current.loggedError) {
        ctx.stateRef.current.loggedError = true;
        console.warn("Face detection frame failed:", err);
      }
    }
  }
}

// setInterval (not a 60 fps requestAnimationFrame loop): detection only needs ~1.4 Hz, and rAF
// is paused in background tabs — exactly when a candidate would cheat.
function runDetectionLoop(ctx: DetectionContext): void {
  ctx.timerRef.current = setInterval(() => {
    if (!ctx.runningRef.current) return;
    processDetectionFrame(ctx, performance.now());
  }, DETECTION_INTERVAL_MS);
}

export function useVideoMonitoring({
  enabled,
  videoRef,
  onViolation,
  onInitError,
  attempt = 0,
}: UseVideoMonitoringOptions): VideoMonitoringState {
  const stateRef = useRef<VideoMonitoringState>({ faceCount: 0, isFacingCamera: true });
  const detectorRef = useRef<FaceDetectorInstance | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const faceAbsenceStart = useRef<number | null>(null);
  const lookAwayStart = useRef<number | null>(null);
  const lastViolationTime = useRef<Partial<Record<MalpracticeType, number>>>({});
  const lastDetectionTime = useRef<number>(0);
  const onViolationRef = useRef(onViolation);
  const onInitErrorRef = useRef(onInitError);

  useEffect(() => {
    onViolationRef.current = onViolation;
    onInitErrorRef.current = onInitError;
  });

  const canFlag = useCallback((type: MalpracticeType): boolean => {
    const now = performance.now();
    const last = lastViolationTime.current[type] ?? 0;
    if (now - last > VIOLATION_COOLDOWN_MS) {
      lastViolationTime.current[type] = now;
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const runningRef = { current: true };
    const ctx: DetectionContext = {
      videoRef,
      timerRef,
      runningRef,
      lastDetectionTime,
      detectorRef,
      faceAbsenceStart,
      lookAwayStart,
      stateRef,
      canFlag,
      onViolation: (type, desc) => onViolationRef.current(type, desc),
    };

    const init = async () => {
      try {
        const { FaceDetector, FilesetResolver } =
          (await import("@mediapipe/tasks-vision")) as unknown as MediaPipeModule;
        const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);
        const create = (delegate: "GPU" | "CPU") =>
          FaceDetector.createFromOptions(vision, {
            baseOptions: { modelAssetPath: FACE_MODEL, delegate },
            runningMode: "VIDEO",
            minDetectionConfidence: MIN_DETECTION_CONFIDENCE,
          });
        try {
          detectorRef.current = await create("GPU");
        } catch (gpuErr) {
          console.warn("Face detector GPU init failed, falling back to CPU:", gpuErr);
          detectorRef.current = await create("CPU");
        }
      } catch (err) {
        console.error("Video monitoring could not start (face detector failed to load):", err);
        // Never run silently unmonitored: surface a blocking error with a retry.
        if (runningRef.current) {
          onInitErrorRef.current?.(
            "The monitoring component failed to load. Check your internet connection and retry."
          );
        }
        return;
      }
      if (!runningRef.current) return;
      runDetectionLoop(ctx);
    };

    void init();

    return () => {
      runningRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      detectorRef.current?.close?.();
      detectorRef.current = null;
    };
  }, [enabled, videoRef, canFlag, attempt]);

  return stateRef.current;
}
