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

  it("is inert until synchronised: a timer that was never given a value never expires", () => {
    const onExpired = vi.fn();
    renderHook(() => useRoundTimer({ active: true, onExpired }));
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(onExpired).not.toHaveBeenCalled();
  });

  it("does not expire when started with initialSeconds 0 and activated (the auto-submit bug)", () => {
    const onExpired = vi.fn();
    const { result } = renderHook(() =>
      useRoundTimer({ initialSeconds: 0, active: true, onExpired })
    );
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(onExpired).not.toHaveBeenCalled();
    expect(result.current.isLowTime).toBe(false);
  });

  it("starts counting once the server value arrives, even if active first", () => {
    const onExpired = vi.fn();
    const { result } = renderHook(() => useRoundTimer({ active: true, onExpired }));
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    act(() => result.current.setTimeLeft(10));
    act(() => {
      vi.advanceTimersByTime(4_000);
    });
    expect(result.current.timeLeft).toBe(6);
    expect(onExpired).not.toHaveBeenCalled();
  });

  it("a server value of exactly 0 means expired and fires onExpired once", () => {
    const onExpired = vi.fn();
    const { result } = renderHook(() => useRoundTimer({ active: true, onExpired }));
    act(() => result.current.setTimeLeft(0));
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it("is wall-clock based: a throttled/suspended tab catches up instead of lagging", () => {
    const { result } = renderHook(() =>
      useRoundTimer({ initialSeconds: 100, active: true, onExpired: vi.fn() })
    );
    // One huge jump (like a backgrounded tab waking up) must land on the true remaining time.
    act(() => {
      vi.setSystemTime(Date.now() + 60_000);
      vi.advanceTimersByTime(300);
    });
    expect(result.current.timeLeft).toBeLessThanOrEqual(40);
    expect(result.current.timeLeft).toBeGreaterThanOrEqual(39);
  });

  it("re-syncing to a new server value replaces the countdown and re-arms expiry", () => {
    const onExpired = vi.fn();
    const { result } = renderHook(() =>
      useRoundTimer({ initialSeconds: 2, active: true, onExpired })
    );
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(onExpired).toHaveBeenCalledTimes(1);
    act(() => result.current.setTimeLeft(5));
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(onExpired).toHaveBeenCalledTimes(2);
  });
});
