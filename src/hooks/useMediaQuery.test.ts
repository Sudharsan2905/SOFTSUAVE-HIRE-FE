import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMediaQuery } from "./useMediaQuery";

type Listener = (e: MediaQueryListEvent) => void;

function mockMatchMedia(matches: boolean) {
  const listeners: Listener[] = [];
  const mql = {
    matches,
    addEventListener: vi.fn((_event: string, cb: Listener) => listeners.push(cb)),
    removeEventListener: vi.fn(),
  };
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn(() => mql),
  });
  return { mql, listeners };
}

describe("useMediaQuery", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns true when query matches", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery("(max-width: 768px)"));
    expect(result.current).toBe(true);
  });

  it("returns false when query does not match", () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery("(max-width: 768px)"));
    expect(result.current).toBe(false);
  });

  it("updates when the media query change event fires", () => {
    const { listeners } = mockMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery("(max-width: 768px)"));
    expect(result.current).toBe(false);

    act(() => {
      listeners.forEach((l) => l({ matches: true } as MediaQueryListEvent));
    });

    expect(result.current).toBe(true);
  });

  it("removes the event listener on unmount", () => {
    const { mql } = mockMatchMedia(true);
    const { unmount } = renderHook(() => useMediaQuery("(max-width: 768px)"));
    unmount();
    expect(mql.removeEventListener).toHaveBeenCalled();
  });
});
