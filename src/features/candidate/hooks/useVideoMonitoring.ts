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

    let running = true;

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

      const detect = () => {
        if (!running) return;

        const now = performance.now();
        if (now - lastDetectionTime.current >= DETECTION_INTERVAL_MS) {
          lastDetectionTime.current = now;
          const video = videoRef.current;
          if (video && video.readyState >= 2 && detectorRef.current) {
            try {
              const result = detectorRef.current.detectForVideo(video, now);
              const count = result?.detections?.length ?? 0;
              stateRef.current.faceCount = count;

              if (count === 0) {
                if (faceAbsenceStart.current === null) {
                  faceAbsenceStart.current = now;
                } else if (
                  now - faceAbsenceStart.current > FACE_ABSENCE_THRESHOLD_MS &&
                  canFlag("face_absence")
                ) {
                  const absenceSecs = Math.round((now - faceAbsenceStart.current) / 1_000);
                  onViolationRef.current(
                    "face_absence",
                    `No face detected in camera feed for ${absenceSecs} seconds`
                  );
                  faceAbsenceStart.current = null;
                }
              } else {
                faceAbsenceStart.current = null;
              }

              if (count > 1 && canFlag("multiple_faces")) {
                onViolationRef.current(
                  "multiple_faces",
                  `Multiple faces (${count}) detected in camera feed`
                );
              }
            } catch {
              /* detector may fail on first frames */
            }
          }
        }

        rafRef.current = requestAnimationFrame(detect);
      };

      rafRef.current = requestAnimationFrame(detect);
    };

    void init();

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
      detectorRef.current?.close?.();
    };
  }, [enabled, videoRef, canFlag]);

  return stateRef.current;
}
