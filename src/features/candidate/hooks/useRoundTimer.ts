import { useCallback, useEffect, useRef, useState } from 'react';

interface UseRoundTimerOptions {
  initialSeconds: number;
  active: boolean;
  onExpired: () => void;
}

interface UseRoundTimerReturn {
  timeLeft: number;
  setTimeLeft: React.Dispatch<React.SetStateAction<number>>;
  timeLeftRef: React.MutableRefObject<number>;
  isLowTime: boolean;
  formattedTime: { hh: string; mm: string; ss: string };
}

import type React from 'react';

const LOW_TIME_THRESHOLD_SECONDS = 120;

function formatHMS(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return {
    hh: h.toString().padStart(2, '0'),
    mm: m.toString().padStart(2, '0'),
    ss: s.toString().padStart(2, '0'),
  };
}

/**
 * Countdown timer for an interview round.
 *
 * - Ticks only when `active` is true (pauses on network loss / on_hold).
 * - Calls `onExpired` exactly once when the counter reaches zero.
 * - Exposes `timeLeftRef` so callbacks closed over this hook can read the
 *   current value without stale-closure issues.
 */
export function useRoundTimer({
  initialSeconds,
  active,
  onExpired,
}: UseRoundTimerOptions): UseRoundTimerReturn {
  const [timeLeft, setTimeLeft] = useState(initialSeconds);
  const timeLeftRef = useRef(initialSeconds);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onExpiredRef = useRef(onExpired);

  useEffect(() => {
    onExpiredRef.current = onExpired;
  }, [onExpired]);

  // Sync external initial value (e.g. server restore after network loss)
  useEffect(() => {
    setTimeLeft(initialSeconds);
    timeLeftRef.current = initialSeconds;
  }, [initialSeconds]);

  useEffect(() => {
    if (!active) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        const next = prev - 1;
        timeLeftRef.current = next;
        if (next <= 0) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          onExpiredRef.current();
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [active]);

  return {
    timeLeft,
    setTimeLeft,
    timeLeftRef,
    isLowTime: timeLeft < LOW_TIME_THRESHOLD_SECONDS,
    formattedTime: formatHMS(timeLeft),
  };
}
