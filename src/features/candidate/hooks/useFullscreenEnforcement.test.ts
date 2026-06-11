import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFullscreenEnforcement } from "./useFullscreenEnforcement";

function mockFullscreenElement(el: Element | null) {
  Object.defineProperty(document, "fullscreenElement", { value: el, configurable: true });
}

function mockRequestFullscreen(shouldSucceed = true) {
  const mock = vi.fn().mockImplementation(async () => {
    if (!shouldSucceed) throw new Error("denied");
    mockFullscreenElement(document.documentElement);
  });
  Object.defineProperty(document.documentElement, "requestFullscreen", {
    value: mock,
    configurable: true,
  });
  return mock;
}

function mockExitFullscreen() {
  const mock = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(document, "exitFullscreen", { value: mock, configurable: true });
  return mock;
}

beforeEach(() => {
  mockFullscreenElement(null);
  vi.useFakeTimers();
});

afterEach(() => {
  mockFullscreenElement(null);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useFullscreenEnforcement", () => {
  it("returns isFullscreen=false initially when not in fullscreen", () => {
    mockRequestFullscreen();
    const { result } = renderHook(() => useFullscreenEnforcement({ enabled: true }));
    expect(result.current.isFullscreen).toBe(false);
  });

  it("does nothing when enabled=false", async () => {
    const rfsMock = mockRequestFullscreen();
    renderHook(() => useFullscreenEnforcement({ enabled: false }));
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(rfsMock).not.toHaveBeenCalled();
  });

  it("attempts fullscreen after 300ms delay when enabled", async () => {
    const rfsMock = mockRequestFullscreen();
    renderHook(() => useFullscreenEnforcement({ enabled: true }));
    expect(rfsMock).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(rfsMock).toHaveBeenCalledTimes(1);
  });

  it("calls onBlockRequired when fullscreen is denied", async () => {
    mockRequestFullscreen(false);
    const onBlockRequired = vi.fn();
    renderHook(() => useFullscreenEnforcement({ enabled: true, onBlockRequired }));
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(onBlockRequired).toHaveBeenCalledTimes(1);
  });

  it("does not call onBlockRequired when fullscreen succeeds", async () => {
    mockRequestFullscreen(true);
    const onBlockRequired = vi.fn();
    renderHook(() => useFullscreenEnforcement({ enabled: true, onBlockRequired }));
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(onBlockRequired).not.toHaveBeenCalled();
  });

  it("calls onExit when fullscreenchange fires with no element", async () => {
    mockRequestFullscreen(true);
    const onExit = vi.fn();
    renderHook(() => useFullscreenEnforcement({ enabled: true, onExit }));
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    // Simulate exiting fullscreen
    mockFullscreenElement(null);
    act(() => {
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    expect(onExit).toHaveBeenCalledWith("Candidate exited fullscreen mode");
  });

  it("does not call onExit when entering fullscreen (element present)", async () => {
    mockRequestFullscreen(true);
    const onExit = vi.fn();
    renderHook(() => useFullscreenEnforcement({ enabled: true, onExit }));
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    mockFullscreenElement(document.documentElement);
    act(() => {
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    expect(onExit).not.toHaveBeenCalled();
  });

  it("removes fullscreen event listeners on unmount", async () => {
    mockRequestFullscreen();
    mockExitFullscreen();
    const removeSpy = vi.spyOn(document, "removeEventListener");
    const { unmount } = renderHook(() => useFullscreenEnforcement({ enabled: true }));
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    unmount();
    expect(removeSpy).toHaveBeenCalledWith("fullscreenchange", expect.any(Function));
  });

  it("requestFullscreen function can be called manually", async () => {
    const rfsMock = mockRequestFullscreen();
    const { result } = renderHook(() => useFullscreenEnforcement({ enabled: true }));
    await act(async () => {
      await result.current.requestFullscreen();
    });
    expect(rfsMock).toHaveBeenCalled();
  });

  it("requestFullscreen is a no-op when already in fullscreen", async () => {
    const rfsMock = mockRequestFullscreen();
    mockFullscreenElement(document.documentElement);
    const { result } = renderHook(() => useFullscreenEnforcement({ enabled: true }));
    await act(async () => {
      await result.current.requestFullscreen();
    });
    expect(rfsMock).not.toHaveBeenCalled();
  });
});
