import { useEffect, useRef, useCallback } from "react";
import { MalpracticeType } from "../../../types";

const DETECTION_INTERVAL_MS = 700;
const FACE_ABSENCE_THRESHOLD_MS = 3_000;
const VIOLATION_COOLDOWN_MS = 15_000;
const MIN_DETECTION_CONFIDENCE = 0.55;
const MEDIAPIPE_WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
const FACE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

interface UseVideoMonitoringOptions {
  enabled: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onViolation: (type: MalpracticeType, description: string) => void;
}

interface VideoMonitoringState {
  faceCount: number;
  isFacingCamera: boolean;
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
  rafRef: React.MutableRefObject<number>;
  runningRef: { current: boolean };
  lastDetectionTime: React.MutableRefObject<number>;
  detectorRef: React.MutableRefObject<FaceDetectorInstance | null>;
  faceAbsenceStart: React.MutableRefObject<number | null>;
  stateRef: React.MutableRefObject<VideoMonitoringState>;
  canFlag: (type: MalpracticeType) => boolean;
  onViolation: (type: MalpracticeType, description: string) => void;
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
    } catch {
      /* detector may fail on first frames */
    }
  }
}

function runDetectionStep(ctx: DetectionContext): void {
  if (!ctx.runningRef.current) return;
  const now = performance.now();
  if (now - ctx.lastDetectionTime.current >= DETECTION_INTERVAL_MS) {
    processDetectionFrame(ctx, now);
  }
  ctx.rafRef.current = requestAnimationFrame(() => runDetectionStep(ctx));
}

function runDetectionLoop(ctx: DetectionContext): void {
  ctx.rafRef.current = requestAnimationFrame(() => runDetectionStep(ctx));
}

export function useVideoMonitoring({
  enabled,
  videoRef,
  onViolation,
}: UseVideoMonitoringOptions): VideoMonitoringState {
  const stateRef = useRef<VideoMonitoringState>({ faceCount: 0, isFacingCamera: true });
  const detectorRef = useRef<FaceDetectorInstance | null>(null);
  const rafRef = useRef<number>(0);
  const faceAbsenceStart = useRef<number | null>(null);
  const lastViolationTime = useRef<Partial<Record<MalpracticeType, number>>>({});
  const lastDetectionTime = useRef<number>(0);
  const onViolationRef = useRef(onViolation);

  useEffect(() => {
    onViolationRef.current = onViolation;
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
      rafRef,
      runningRef,
      lastDetectionTime,
      detectorRef,
      faceAbsenceStart,
      stateRef,
      canFlag,
      onViolation: (type, desc) => onViolationRef.current(type, desc),
    };

    const init = async () => {
      try {
        const { FaceDetector, FilesetResolver } =
          (await import("@mediapipe/tasks-vision")) as unknown as MediaPipeModule;
        const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);
        detectorRef.current = await FaceDetector.createFromOptions(vision, {
          baseOptions: { modelAssetPath: FACE_MODEL, delegate: "GPU" },
          runningMode: "VIDEO",
          minDetectionConfidence: MIN_DETECTION_CONFIDENCE,
        });
      } catch {
        return;
      }
      runDetectionLoop(ctx);
    };

    void init();

    return () => {
      runningRef.current = false;
      cancelAnimationFrame(rafRef.current);
      detectorRef.current?.close?.();
    };
  }, [enabled, videoRef, canFlag]);

  return stateRef.current;
}
