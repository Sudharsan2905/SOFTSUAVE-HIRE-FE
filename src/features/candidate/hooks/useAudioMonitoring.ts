import { useEffect, useRef, useCallback, MutableRefObject } from "react";
import { takeAudioStream } from "../services/screenCaptureStore";

interface UseAudioMonitoringOptions {
  enabled: boolean;
  threshold?: number;
  sustainedSeconds?: number;
  onViolation: () => void;
  analyserRef?: MutableRefObject<AnalyserNode | null>;
}

const COOLDOWN_MS = 30_000;
const DEFAULT_THRESHOLD = 20;
const DEFAULT_SUSTAINED_S = 5;

export function useAudioMonitoring({
  enabled,
  threshold = DEFAULT_THRESHOLD,
  sustainedSeconds = DEFAULT_SUSTAINED_S,
  onViolation,
  analyserRef,
}: UseAudioMonitoringOptions): void {
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafHandleRef = useRef<number | null>(null);
  const violationStartRef = useRef<number | null>(null);
  const lastFiredRef = useRef<number | null>(null);
  const isActiveRef = useRef(false);
  const onViolationRef = useRef(onViolation);

  useEffect(() => {
    onViolationRef.current = onViolation;
  });

  const cleanup = useCallback(() => {
    isActiveRef.current = false;
    if (rafHandleRef.current !== null) {
      cancelAnimationFrame(rafHandleRef.current);
      rafHandleRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioContextRef.current?.close();
    audioContextRef.current = null;
    if (analyserRef) analyserRef.current = null;
    violationStartRef.current = null;
  }, [analyserRef]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const start = async () => {
      try {
        const stored = takeAudioStream();
        const stream = stored ?? (await navigator.mediaDevices.getUserMedia({ audio: true }));
        if (cancelled) {
          if (!stored) stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;

        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        if (analyserRef) analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        isActiveRef.current = true;

        const tick = () => {
          if (!isActiveRef.current) return;
          analyser.getByteFrequencyData(dataArray);

          let sum = 0;
          for (const val of dataArray) sum += val;
          const avg = sum / dataArray.length;
          const now = performance.now();

          if (avg > threshold) {
            if (violationStartRef.current === null) {
              violationStartRef.current = now;
            } else if ((now - violationStartRef.current) / 1_000 >= sustainedSeconds) {
              const cooldownOk =
                lastFiredRef.current === null || now - lastFiredRef.current >= COOLDOWN_MS;
              if (cooldownOk) {
                lastFiredRef.current = now;
                violationStartRef.current = null;
                onViolationRef.current();
              }
            }
          } else {
            violationStartRef.current = null;
          }

          rafHandleRef.current = requestAnimationFrame(tick);
        };

        rafHandleRef.current = requestAnimationFrame(tick);
      } catch {
        /* microphone access denied */
      }
    };

    void start();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [enabled, threshold, sustainedSeconds, analyserRef, cleanup]);
}
