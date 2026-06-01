import { useEffect, useRef, useCallback, MutableRefObject } from "react";
import { api } from "@/utils/api";

interface UseAudioMonitoringOptions {
  enabled: boolean;
  submissionId: string;
  threshold?: number;
  sustainedSeconds?: number;
  onViolation: () => void;
  /** Optional ref that will be populated with the AnalyserNode for external consumers. */
  analyserRef?: MutableRefObject<AnalyserNode | null>;
}

const COOLDOWN_MS = 30_000;
const DEFAULT_THRESHOLD = 20;     // 0–255 average amplitude
const DEFAULT_SUSTAINED_S = 10;

export function useAudioMonitoring({
  enabled,
  submissionId,
  threshold = DEFAULT_THRESHOLD,
  sustainedSeconds = DEFAULT_SUSTAINED_S,
  onViolation,
  analyserRef,
}: UseAudioMonitoringOptions): void {
  const internalAnalyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafHandleRef = useRef<number | null>(null);
  const violationStartRef = useRef<number | null>(null);
  const lastFiredRef = useRef<number | null>(null);
  const isActiveRef = useRef(false);

  const reportViolation = useCallback(async () => {
    onViolation();
    try {
      await api.post(
        `/api/candidate/submission/${submissionId}/malpractice`,
        { type: "audio_violation" }
      );
    } catch {
      // Silently ignore network errors
    }
  }, [submissionId, onViolation]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;

        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        internalAnalyserRef.current = analyser;
        if (analyserRef) {
          analyserRef.current = analyser;
        }

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        isActiveRef.current = true;

        function tick() {
          if (!isActiveRef.current) return;

          analyser.getByteFrequencyData(dataArray);

          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;

          const now = performance.now();

          if (average > threshold) {
            if (violationStartRef.current === null) {
              violationStartRef.current = now;
            } else {
              const elapsed = (now - violationStartRef.current) / 1_000;
              if (elapsed >= sustainedSeconds) {
                const cooldownOk =
                  lastFiredRef.current === null ||
                  now - lastFiredRef.current >= COOLDOWN_MS;

                if (cooldownOk) {
                  lastFiredRef.current = now;
                  violationStartRef.current = null;
                  reportViolation();
                }
              }
            }
          } else {
            violationStartRef.current = null;
          }

          rafHandleRef.current = requestAnimationFrame(tick);
        }

        rafHandleRef.current = requestAnimationFrame(tick);
      } catch {
        // Microphone access denied or unavailable — fail silently
      }
    }

    start();

    return () => {
      cancelled = true;
      isActiveRef.current = false;

      if (rafHandleRef.current !== null) {
        cancelAnimationFrame(rafHandleRef.current);
        rafHandleRef.current = null;
      }

      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;

      audioContextRef.current?.close();
      audioContextRef.current = null;

      internalAnalyserRef.current = null;
      if (analyserRef) {
        analyserRef.current = null;
      }

      violationStartRef.current = null;
    };
  }, [enabled, threshold, sustainedSeconds, analyserRef, reportViolation]);
}
