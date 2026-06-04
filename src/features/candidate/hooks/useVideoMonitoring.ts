import { useEffect, useRef, useCallback } from 'react';
import { MalpracticeType } from '../../../types';

interface UseVideoMonitoringOptions {
  enabled: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onViolation: (type: MalpracticeType, faceImageBlob?: Blob) => void;
}

interface VideoMonitoringState {
  faceCount: number;
  isFacingCamera: boolean;
}

export function useVideoMonitoring({ enabled, videoRef, onViolation }: UseVideoMonitoringOptions): VideoMonitoringState {
  const stateRef = useRef<VideoMonitoringState>({ faceCount: 0, isFacingCamera: true });
  const detectorRef = useRef<any>(null);
  const landmarkerRef = useRef<any>(null);
  const rafRef = useRef<number>(0);
  const faceAbsenceStart = useRef<number | null>(null);
  const eyeDeviationStart = useRef<number | null>(null);
  const FACE_ABSENCE_THRESHOLD_MS = 3000;
  const EYE_DEVIATION_THRESHOLD_MS = 2000;
  const lastViolationTime = useRef<Partial<Record<MalpracticeType, number>>>({});
  const VIOLATION_COOLDOWN_MS = 15000; // 15s cooldown per type

  const canFlag = useCallback((type: MalpracticeType) => {
    const now = performance.now();
    const last = lastViolationTime.current[type] ?? 0;
    if (now - last > VIOLATION_COOLDOWN_MS) {
      lastViolationTime.current[type] = now;
      return true;
    }
    return false;
  }, []);

  const captureFrame = useCallback((): Blob | undefined => {
    const video = videoRef.current;
    if (!video) return undefined;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    ctx.drawImage(video, 0, 0);
    // Return synchronously — toBlob is async, skip for simplicity; caller handles null
    return undefined;
  }, [videoRef]);

  useEffect(() => {
    if (!enabled) return;

    let running = true;

    const initMediaPipe = async () => {
      try {
        // Dynamic import to avoid bundle bloat when not needed
        const { FaceDetector, FilesetResolver } = await import(
          '@mediapipe/tasks-vision' as any
        );
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        detectorRef.current = await FaceDetector.createFromOptions(vision, {
          baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite', delegate: 'GPU' },
          runningMode: 'VIDEO',
          minDetectionConfidence: 0.5,
        });
      } catch {
        // MediaPipe unavailable — skip face detection silently
        return;
      }

      const detect = () => {
        if (!running) return;
        const video = videoRef.current;
        if (video && video.readyState >= 2 && detectorRef.current) {
          try {
            const result = detectorRef.current.detectForVideo(video, performance.now());
            const count = result?.detections?.length ?? 0;
            stateRef.current.faceCount = count;
            const now = performance.now();

            if (count === 0) {
              if (faceAbsenceStart.current === null) faceAbsenceStart.current = now;
              else if (now - faceAbsenceStart.current > FACE_ABSENCE_THRESHOLD_MS && canFlag('face_absence')) {
                onViolation('face_absence');
                faceAbsenceStart.current = null;
              }
            } else {
              faceAbsenceStart.current = null;
            }
            if (count > 1 && canFlag('multiple_faces')) {
              onViolation('multiple_faces');
            }
          } catch { /* detector may fail on first frames */ }
        }
        rafRef.current = requestAnimationFrame(detect);
      };
      rafRef.current = requestAnimationFrame(detect);
    };

    initMediaPipe();
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
      detectorRef.current?.close?.();
    };
  }, [enabled, videoRef, onViolation, canFlag]);

  return stateRef.current;
}
