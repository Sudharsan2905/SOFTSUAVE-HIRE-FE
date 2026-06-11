import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebounce } from "./useDebounce";

describe("useDebounce", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  // ── Rendering ────────────────────────────────────────────────────────────

  it("returns the initial value synchronously before the delay elapses", () => {
    const { result } = renderHook(() => useDebounce("hello", 300));
    expect(result.current).toBe("hello");
  });

  // ── Debounce behaviour ───────────────────────────────────────────────────

  it("returns the previous value during the delay window after a value change", () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: "initial" },
    });

    rerender({ value: "updated" });
    // Before the delay fires the debounced value should still be the old one
    expect(result.current).toBe("initial");
  });

  it("returns the new value once the delay has fully elapsed", () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: "initial" },
    });

    rerender({ value: "updated" });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe("updated");
  });

  it("resets the timer on rapid value changes and only commits the last value", () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: "a" },
    });

    rerender({ value: "b" });
    act(() => {
      vi.advanceTimersByTime(200);
    }); // partially into the delay

    rerender({ value: "c" });
    act(() => {
      vi.advanceTimersByTime(200);
    }); // still 100ms short for "c"

    expect(result.current).toBe("a"); // still held at "a"

    act(() => {
      vi.advanceTimersByTime(100);
    }); // full 300ms from "c"
    expect(result.current).toBe("c");
  });

  // ── Default delay ────────────────────────────────────────────────────────

  it("defaults to a 300 ms delay when no delay argument is provided", () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value), {
      initialProps: { value: "first" },
    });

    rerender({ value: "second" });

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe("first"); // not yet

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("second"); // exactly at 300 ms
  });

  // ── Type generics ────────────────────────────────────────────────────────

  it("works correctly with number values", () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 200), {
      initialProps: { value: 0 },
    });

    rerender({ value: 42 });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current).toBe(42);
  });

  it("works correctly with object values", () => {
    const initial = { a: 1 };
    const updated = { a: 2 };

    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 100), {
      initialProps: { value: initial },
    });

    rerender({ value: updated });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current).toEqual(updated);
  });

  // ── Cleanup ──────────────────────────────────────────────────────────────

  it("clears the pending timer when the component unmounts", () => {
    const clearSpy = vi.spyOn(global, "clearTimeout");

    const { rerender, unmount } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: "start" },
    });

    rerender({ value: "changed" }); // creates a pending timer
    unmount();

    // clearTimeout must have been called to clean up the pending timer
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
