import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";

interface UseRoundTimerOptions {
  /** Optional seed. 0 / omitted means "not synchronised with the server yet". */
  initialSeconds?: number;
  active: boolean;
  onExpired: () => void;
}

interface UseRoundTimerReturn {
  timeLeft: number;
  /** Synchronise the countdown with the server clock. */
  setTimeLeft: (seconds: number) => void;
  timeLeftRef: React.MutableRefObject<number>;
  isLowTime: boolean;
  formattedTime: { hh: string; mm: string; ss: string };
}

const LOW_TIME_THRESHOLD_SECONDS = 120;
const TICK_MS = 250;

function formatHMS(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return {
    hh: h.toString().padStart(2, "0"),
    mm: m.toString().padStart(2, "0"),
    ss: s.toString().padStart(2, "0"),
  };
}

/**
 * Countdown for an interview round.
 *
 * - The duration always comes from the server (`setTimeLeft`); there is no default here.
 * - Wall-clock based (`Date.now()`), so background-tab throttling can't slow it down.
 * - Never expires until it has been given a value — an unsynchronised timer is inert.
 * - Ticks only while `active` (paused while the server holds the session).
 * - Calls `onExpired` exactly once per synchronised value that reaches zero.
 */
export function useRoundTimer({
  initialSeconds = 0,
  active,
  onExpired,
}: UseRoundTimerOptions): UseRoundTimerReturn {
  const [timeLeft, setTimeLeftState] = useState(Math.max(0, initialSeconds));
  const timeLeftRef = useRef(Math.max(0, initialSeconds));
  const initialisedRef = useRef(initialSeconds > 0);
  const endsAtRef = useRef<number | null>(null);
  const firedRef = useRef(false);
  const activeRef = useRef(active);
  const onExpiredRef = useRef(onExpired);

  useEffect(() => {
    onExpiredRef.current = onExpired;
  }, [onExpired]);

  const publish = useCallback((seconds: number) => {
    timeLeftRef.current = seconds;
    setTimeLeftState((prev) => (prev === seconds ? prev : seconds));
  }, []);

  const setTimeLeft = useCallback(
    (seconds: number) => {
      const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
      initialisedRef.current = true;
      firedRef.current = false;
      endsAtRef.current = activeRef.current ? Date.now() + safe * 1000 : null;
      publish(safe);
    },
    [publish]
  );

  // Seed from the optional prop (only meaningful when > 0).
  useEffect(() => {
    if (initialSeconds > 0) setTimeLeft(initialSeconds);
  }, [initialSeconds, setTimeLeft]);

  useEffect(() => {
    activeRef.current = active;
    if (!active) {
      // Freeze: remember what is left so resuming continues from here.
      if (endsAtRef.current !== null) {
        publish(Math.max(0, Math.ceil((endsAtRef.current - Date.now()) / 1000)));
        endsAtRef.current = null;
      }
      return;
    }
    if (initialisedRef.current) endsAtRef.current = Date.now() + timeLeftRef.current * 1000;

    const id = setInterval(() => {
      if (!initialisedRef.current) return; // inert until synchronised with the server
      endsAtRef.current ??= Date.now() + timeLeftRef.current * 1000;
      const remaining = Math.max(0, Math.ceil((endsAtRef.current - Date.now()) / 1000));
      publish(remaining);
      if (remaining <= 0 && !firedRef.current) {
        firedRef.current = true;
        onExpiredRef.current();
      }
    }, TICK_MS);

    return () => clearInterval(id);
  }, [active, publish]);

  return {
    timeLeft,
    setTimeLeft,
    timeLeftRef,
    isLowTime: initialisedRef.current && timeLeft < LOW_TIME_THRESHOLD_SECONDS,
    formattedTime: formatHMS(timeLeft),
  };
}
