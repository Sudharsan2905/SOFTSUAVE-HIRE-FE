import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useScreenMonitoring } from "./useScreenMonitoring";

describe("useScreenMonitoring", () => {
  const onViolation = vi.fn();

  beforeEach(() => {
    onViolation.mockReset();
    vi.stubGlobal("navigator", {
      ...navigator,
      mediaDevices: {
        getDisplayMedia: vi.fn(),
      },
    });
    // Ensure performance.now() returns a value past the 10s cooldown
    vi.spyOn(performance, "now").mockReturnValue(100_000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function makeTrack(overrides: Record<string, unknown> = {}) {
    return {
      readyState: "live",
      stop: vi.fn(),
      addEventListener: vi.fn(),
      ...overrides,
    } as unknown as MediaStreamTrack;
  }

  function makeStream(tracks: unknown[] = [{}]) {
    const mockTracks = tracks.map((t) => makeTrack(t as Record<string, unknown>));
    return {
      getVideoTracks: () => mockTracks,
      getAudioTracks: () => [],
      getTracks: () => mockTracks,
    } as unknown as MediaStream;
  }

  it("returns startScreenShare, stopScreenShare, and screenStream", () => {
    const { result } = renderHook(() =>
      useScreenMonitoring({ enabled: true, onViolation })
    );
    expect(typeof result.current.startScreenShare).toBe("function");
    expect(typeof result.current.stopScreenShare).toBe("function");
    expect(result.current.screenStream).toBeDefined();
  });

  it("returns null from startScreenShare when disabled", async () => {
    const { result } = renderHook(() =>
      useScreenMonitoring({ enabled: false, onViolation })
    );
    let stream: MediaStream | null = null;
    await act(async () => {
      stream = await result.current.startScreenShare();
    });
    expect(stream).toBeNull();
  });

  it("returns null when getDisplayMedia throws (permission denied)", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      mediaDevices: {
        getDisplayMedia: vi.fn().mockRejectedValue(new Error("NotAllowedError")),
      },
    });

    const { result } = renderHook(() =>
      useScreenMonitoring({ enabled: true, onViolation })
    );
    let stream: MediaStream | null = null;
    await act(async () => {
      stream = await result.current.startScreenShare();
    });
    expect(stream).toBeNull();
  });

  it("returns stream when getDisplayMedia resolves", async () => {
    const mockStream = makeStream([{}]);
    vi.stubGlobal("navigator", {
      ...navigator,
      mediaDevices: {
        getDisplayMedia: vi.fn().mockResolvedValue(mockStream),
      },
    });

    const { result } = renderHook(() =>
      useScreenMonitoring({ enabled: true, onViolation })
    );
    let stream: MediaStream | null = null;
    await act(async () => {
      stream = await result.current.startScreenShare();
    });

    expect(stream).toBe(mockStream);
    expect(result.current.screenStream.current).toBe(mockStream);
  });

  it("registers ended event listener on first video track", async () => {
    let capturedEndedCallback: (() => void) | null = null;
    const track = makeTrack({
      addEventListener: vi.fn((_evt: string, cb: () => void) => {
        capturedEndedCallback = cb;
      }),
    });
    const mockStream = makeStream([track]);
    vi.stubGlobal("navigator", {
      ...navigator,
      mediaDevices: {
        getDisplayMedia: vi.fn().mockResolvedValue(mockStream),
      },
    });

    const { result } = renderHook(() =>
      useScreenMonitoring({ enabled: true, onViolation })
    );
    await act(async () => {
      await result.current.startScreenShare();
    });

    // Simulate the track ending
    act(() => {
      capturedEndedCallback?.();
    });

    expect(onViolation).toHaveBeenCalledWith(
      "screen_share_stop",
      expect.stringContaining("stopped")
    );
    expect(result.current.screenStream.current).toBeNull();
  });

  it("stopScreenShare stops tracks and clears the streamRef", async () => {
    const stopFn = vi.fn();
    const track = makeTrack({ stop: stopFn });
    const mockStream = makeStream([track]);
    vi.stubGlobal("navigator", {
      ...navigator,
      mediaDevices: {
        getDisplayMedia: vi.fn().mockResolvedValue(mockStream),
      },
    });

    const { result } = renderHook(() =>
      useScreenMonitoring({ enabled: true, onViolation })
    );
    await act(async () => {
      await result.current.startScreenShare();
    });

    act(() => {
      result.current.stopScreenShare();
    });

    expect(result.current.screenStream.current).toBeNull();
  });

  it("respects cooldown — second violation within cooldown window is suppressed", async () => {
    let capturedEndedCallback: (() => void) | null = null;
    const track = makeTrack({
      addEventListener: vi.fn((_evt: string, cb: () => void) => {
        capturedEndedCallback = cb;
      }),
    });
    const mockStream = makeStream([track]);
    vi.stubGlobal("navigator", {
      ...navigator,
      mediaDevices: {
        getDisplayMedia: vi.fn().mockResolvedValue(mockStream),
      },
    });

    const { result } = renderHook(() =>
      useScreenMonitoring({ enabled: true, onViolation })
    );
    await act(async () => {
      await result.current.startScreenShare();
    });

    // First call fires violation; second call within cooldown is suppressed.
    // performance.now mock returns 100_000 for first call.
    // After the first violation, lastViolationRef is set to 100_000.
    // For the second call, performance.now still returns 100_000,
    // so 100_000 - 100_000 = 0 which is NOT > 10_000 → suppressed.
    act(() => {
      capturedEndedCallback?.();
      capturedEndedCallback?.();
    });

    expect(onViolation).toHaveBeenCalledTimes(1);
  });

  it("cleans up stream on unmount", async () => {
    const stopFn = vi.fn();
    const track = makeTrack({ stop: stopFn });
    const mockStream = makeStream([track]);
    vi.stubGlobal("navigator", {
      ...navigator,
      mediaDevices: {
        getDisplayMedia: vi.fn().mockResolvedValue(mockStream),
      },
    });

    const { result, unmount } = renderHook(() =>
      useScreenMonitoring({ enabled: true, onViolation })
    );
    await act(async () => {
      await result.current.startScreenShare();
    });

    unmount();
    expect(result.current.screenStream.current).toBeNull();
  });

  it("stopScreenShare on already-stopped stream is a no-op", () => {
    const { result } = renderHook(() =>
      useScreenMonitoring({ enabled: true, onViolation })
    );
    // Nothing is capturing; calling stopScreenShare should not throw
    act(() => {
      result.current.stopScreenShare();
    });
    expect(result.current.screenStream.current).toBeNull();
  });
});
