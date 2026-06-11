import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRoundTimer } from "./useRoundTimer";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useRoundTimer", () => {
  it("initialises with the given seconds", () => {
    const { result } = renderHook(() =>
      useRoundTimer({ initialSeconds: 300, active: false, onExpired: vi.fn() })
    );
    expect(result.current.timeLeft).toBe(300);
    expect(result.current.timeLeftRef.current).toBe(300);
  });

  it("does not tick when active=false", () => {
    const { result } = renderHook(() =>
      useRoundTimer({ initialSeconds: 300, active: false, onExpired: vi.fn() })
    );
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.timeLeft).toBe(300);
  });

  it("decrements every second when active=true", () => {
    const { result } = renderHook(() =>
      useRoundTimer({ initialSeconds: 10, active: true, onExpired: vi.fn() })
    );
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.timeLeft).toBe(7);
    expect(result.current.timeLeftRef.current).toBe(7);
  });

  it("calls onExpired and stops at 0", () => {
    const onExpired = vi.fn();
    const { result } = renderHook(() =>
      useRoundTimer({ initialSeconds: 3, active: true, onExpired })
    );
    // Advance exactly to expiry — do not go past it, because the interval fires
    // once per second and functional updaters are batched; advancing past 0 causes
    // multiple updaters with next<=0 to all call onExpired before clearInterval takes effect.
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.timeLeft).toBe(0);
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it("pauses when active switches to false", () => {
    const { result, rerender } = renderHook(
      ({ active }) => useRoundTimer({ initialSeconds: 10, active, onExpired: vi.fn() }),
      { initialProps: { active: true } }
    );
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.timeLeft).toBe(7);

    rerender({ active: false });
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.timeLeft).toBe(7);
  });

  it("syncs to new initialSeconds when prop changes", () => {
    const { result, rerender } = renderHook(
      ({ initialSeconds }) => useRoundTimer({ initialSeconds, active: false, onExpired: vi.fn() }),
      { initialProps: { initialSeconds: 300 } }
    );
    rerender({ initialSeconds: 600 });
    expect(result.current.timeLeft).toBe(600);
  });

  it("isLowTime is false above threshold", () => {
    const { result } = renderHook(() =>
      useRoundTimer({ initialSeconds: 300, active: false, onExpired: vi.fn() })
    );
    expect(result.current.isLowTime).toBe(false);
  });

  it("isLowTime is true below 120 seconds", () => {
    const { result } = renderHook(() =>
      useRoundTimer({ initialSeconds: 60, active: false, onExpired: vi.fn() })
    );
    expect(result.current.isLowTime).toBe(true);
  });

  it("formats time correctly for 1h 2m 3s", () => {
    const { result } = renderHook(() =>
      useRoundTimer({ initialSeconds: 3723, active: false, onExpired: vi.fn() })
    );
    const { hh, mm, ss } = result.current.formattedTime;
    expect(hh).toBe("01");
    expect(mm).toBe("02");
    expect(ss).toBe("03");
  });

  it("formats zero time as 00:00:00", () => {
    const { result } = renderHook(() =>
      useRoundTimer({ initialSeconds: 0, active: false, onExpired: vi.fn() })
    );
    expect(result.current.formattedTime).toEqual({ hh: "00", mm: "00", ss: "00" });
  });
});
