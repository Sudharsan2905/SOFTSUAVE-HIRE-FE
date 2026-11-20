import { useEffect, useRef, useCallback, MutableRefObject } from "react";
import { takeAudioStream } from "../services/screenCaptureStore";

interface UseAudioMonitoringOptions {
  enabled: boolean;
  /**
   * Set to false to defer stream acquisition even when enabled.
   * Defaults to true (same as enabled). Used by ExamOrchestrator to
   * sequence permission requests one at a time.
   */
  shouldInitialize?: boolean;
  threshold?: number;
  sustainedSeconds?: number;
  onViolation: (description: string) => void;
  analyserRef?: MutableRefObject<AnalyserNode | null>;
  onStreamReady?: (stream: MediaStream) => void;
}

const COOLDOWN_MS = 15_000;
const POLL_MS = 100;
const BASELINE_WARMUP_MS = 3_000;
const RISE_DELTA = 12; // levels (0–255 scale) above the learned room baseline
const MIN_RISE_LEVEL = 10; // ignore "rises" that are still near-silence
const GRACE_MS = 800;
const FFT_SIZE = 2048;
const VOICE_LOW_HZ = 300;
const VOICE_HIGH_HZ = 3400;
const DEFAULT_THRESHOLD = 20;
const DEFAULT_SUSTAINED_S = 2; // voice/noise must last ≥2 s before a warning

export function useAudioMonitoring({
  enabled,
  shouldInitialize = true,
  threshold = DEFAULT_THRESHOLD,
  sustainedSeconds = DEFAULT_SUSTAINED_S,
  onViolation,
  analyserRef,
  onStreamReady,
}: UseAudioMonitoringOptions): void {
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastLoudRef = useRef(0);
  const baselineRef = useRef(0);
  const baselineStartRef = useRef<number | null>(null);
  const violationStartRef = useRef<number | null>(null);
  const lastFiredRef = useRef<number | null>(null);
  const isActiveRef = useRef(false);
  const onViolationRef = useRef(onViolation);
  const onStreamReadyRef = useRef(onStreamReady);

  useEffect(() => {
    onViolationRef.current = onViolation;
  });

  useEffect(() => {
    onStreamReadyRef.current = onStreamReady;
  });

  const cleanup = useCallback(() => {
    isActiveRef.current = false;
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioContextRef.current?.close();
    audioContextRef.current = null;
    if (analyserRef) analyserRef.current = null;
    violationStartRef.current = null;
    baselineRef.current = 0;
    baselineStartRef.current = null;
  }, [analyserRef]);

  useEffect(() => {
    if (!enabled || !shouldInitialize) return;

    let cancelled = false;

    const start = async () => {
      try {
        const stored = takeAudioStream();
        const stream =
          stored ??
          (await navigator.mediaDevices.getUserMedia({
            // Disable AGC/noise suppression so background voices aren't
            // silently removed or amplified before analysis.
            audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false },
          }));
        if (cancelled) {
          if (!stored) stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        onStreamReadyRef.current?.(stream);
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        // Browsers may start the context suspended (autoplay policy) → analyser reads zeros.
        if (audioContext.state === "suspended") await audioContext.resume().catch(() => undefined);
        if (cancelled) return;

        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = FFT_SIZE;
        analyser.smoothingTimeConstant = 0.3;
        source.connect(analyser);
        if (analyserRef) analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        // Only measure the human-voice band (≈300–3400 Hz) so low rumble / hiss
        // does not trigger violations and speech is weighted properly.
        const binHz = (audioContext.sampleRate || 48_000) / FFT_SIZE;
        const lo = Math.max(0, Math.floor(VOICE_LOW_HZ / binHz));
        const hi = Math.min(dataArray.length, Math.ceil(VOICE_HIGH_HZ / binHz));
        isActiveRef.current = true;

        const tick = () => {
          if (!isActiveRef.current) return;
          if (audioContext.state === "suspended") void audioContext.resume().catch(() => undefined);
          analyser.getByteFrequencyData(dataArray);

          const from = hi > lo ? lo : 0;
          const to = hi > lo ? hi : dataArray.length;
          let sum = 0;
          for (let i = from; i < to; i++) sum += dataArray[i];
          const avg = sum / Math.max(1, to - from);
          const now = performance.now();

          // Adaptive baseline: learn the room's normal level (fast during the
          // first seconds, slow afterwards) and only from non-loud samples, so
          // a noise that gets LOUDER than usual is caught even if it stays
          // under the absolute threshold (one or several sources combined).
          if (baselineStartRef.current === null) baselineStartRef.current = now;
          const warmingUp = now - baselineStartRef.current < BASELINE_WARMUP_MS;
          const absoluteLoud = avg > threshold;
          const risenLoud =
            !warmingUp && avg > MIN_RISE_LEVEL && avg > baselineRef.current + RISE_DELTA;
          if (!absoluteLoud && !risenLoud) {
            baselineRef.current += (avg - baselineRef.current) * (warmingUp ? 0.2 : 0.01);
          }
          const isLoud = absoluteLoud || risenLoud;
          // Both triggers must persist for the full sustained window (2 s default).
          const needSeconds = sustainedSeconds;

          if (isLoud) {
            lastLoudRef.current = now;
            if (violationStartRef.current === null) {
              violationStartRef.current = now;
            } else if ((now - violationStartRef.current) / 1_000 >= needSeconds) {
              const cooldownOk =
                lastFiredRef.current === null || now - lastFiredRef.current >= COOLDOWN_MS;
              if (cooldownOk) {
                lastFiredRef.current = now;
                violationStartRef.current = null;
                onViolationRef.current(
                  absoluteLoud
                    ? `Sustained voice/background noise detected above threshold for ${sustainedSeconds} seconds`
                    : `Noise level stayed well above the normal room level for ${sustainedSeconds} seconds (${Math.round(avg)} vs ${Math.round(baselineRef.current)})`
                );
              }
            }
          } else if (now - lastLoudRef.current > GRACE_MS) {
            // Tolerate brief pauses between words; reset only after real silence.
            violationStartRef.current = null;
          }
        };

        // setInterval (not requestAnimationFrame): rAF is paused in background tabs,
        // which is exactly when a candidate would cheat.
        intervalRef.current = setInterval(tick, POLL_MS);
      } catch (err) {
        console.warn("Audio monitoring could not start:", err);
      }
    };

    void start();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [enabled, shouldInitialize, threshold, sustainedSeconds, analyserRef, cleanup]);
}
