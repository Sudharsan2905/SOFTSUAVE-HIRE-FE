import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useScreenCapture } from "./useScreenCapture";

vi.mock("../services/screenCaptureStore", () => ({
  takeScreenStream: vi.fn(),
}));

import { takeScreenStream } from "../services/screenCaptureStore";
const mockTakeScreenStream = takeScreenStream as ReturnType<typeof vi.fn>;

function makeTrack(overrides: Record<string, unknown> = {}) {
  return {
    readyState: "live" as const,
    stop: vi.fn(),
    addEventListener: vi.fn(),
    getSettings: vi.fn().mockReturnValue({}),
    ...overrides,
  } as unknown as MediaStreamTrack;
}

function makeStream(tracks: ReturnType<typeof makeTrack>[] = [makeTrack()]) {
  return {
    getVideoTracks: () => tracks,
    getAudioTracks: () => [],
    getTracks: () => tracks,
  } as unknown as MediaStream;
}

describe("useScreenCapture", () => {
  beforeEach(() => {
    mockTakeScreenStream.mockReset();
    mockTakeScreenStream.mockReturnValue(null);

    // Mock HTMLMediaElement.play so JSDOM doesn't throw on video.play()
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);

    vi.stubGlobal("navigator", {
      ...navigator,
      mediaDevices: {
        getDisplayMedia: vi.fn(),
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns all expected API methods", () => {
    const { result } = renderHook(() => useScreenCapture());
    expect(typeof result.current.startScreenCapture).toBe("function");
    expect(typeof result.current.stopScreenCapture).toBe("function");
    expect(typeof result.current.captureFrame).toBe("function");
    expect(typeof result.current.validateScreenStream).toBe("function");
    expect(result.current.streamRef).toBeDefined();
  });

  it("starts with isCapturing false", () => {
    const { result } = renderHook(() => useScreenCapture());
    expect(result.current.isCapturing).toBe(false);
  });

  it("starts with isInitialized false when shouldInitialize is false", () => {
    const { result } = renderHook(() => useScreenCapture({ shouldInitialize: false }));
    expect(result.current.isInitialized).toBe(false);
  });

  it("sets isInitialized true when no stored stream and shouldInitialize is true", async () => {
    mockTakeScreenStream.mockReturnValue(null);
    const { result } = renderHook(() => useScreenCapture({ shouldInitialize: true }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.isInitialized).toBe(true);
  });

  it("validateScreenStream returns false when no stream", () => {
    const { result } = renderHook(() => useScreenCapture());
    expect(result.current.validateScreenStream()).toBe(false);
  });

  it("captureFrame returns null when no video element loaded", async () => {
    const { result } = renderHook(() => useScreenCapture());
    let frame: Blob | null = new Blob(["x"]);
    await act(async () => {
      frame = await result.current.captureFrame();
    });
    expect(frame).toBeNull();
  });

  it("stopScreenCapture when not capturing is a no-op", async () => {
    mockTakeScreenStream.mockReturnValue(null);
    const { result } = renderHook(() => useScreenCapture());
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      result.current.stopScreenCapture();
    });
    expect(result.current.isCapturing).toBe(false);
  });

  it("returns false from startScreenCapture when getDisplayMedia throws", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      mediaDevices: {
        getDisplayMedia: vi.fn().mockRejectedValue(new Error("Permission denied")),
      },
    });

    const { result } = renderHook(() => useScreenCapture());
    await act(async () => {
      await Promise.resolve();
    });

    let success = true;
    await act(async () => {
      success = await result.current.startScreenCapture();
    });
    expect(success).toBe(false);
  });

  it("returns false from startScreenCapture when non-monitor surface is selected", async () => {
    const track = makeTrack({
      getSettings: vi.fn().mockReturnValue({ displaySurface: "window" }),
    });
    const stream = makeStream([track]);
    vi.stubGlobal("navigator", {
      ...navigator,
      mediaDevices: {
        getDisplayMedia: vi.fn().mockResolvedValue(stream),
      },
    });

    const { result } = renderHook(() => useScreenCapture());
    await act(async () => {
      await Promise.resolve();
    });

    let success = true;
    await act(async () => {
      success = await result.current.startScreenCapture();
    });
    expect(success).toBe(false);
  });

  it("returns true from startScreenCapture when monitor surface is selected", async () => {
    const track = makeTrack({
      getSettings: vi.fn().mockReturnValue({ displaySurface: "monitor" }),
    });
    const stream = makeStream([track]);
    vi.stubGlobal("navigator", {
      ...navigator,
      mediaDevices: {
        getDisplayMedia: vi.fn().mockResolvedValue(stream),
      },
    });

    const { result } = renderHook(() => useScreenCapture());
    await act(async () => {
      await Promise.resolve();
    });

    let success = false;
    await act(async () => {
      success = await result.current.startScreenCapture();
    });
    expect(success).toBe(true);
    expect(result.current.isCapturing).toBe(true);
  });

  it("returns true from second startScreenCapture call when already capturing", async () => {
    const track = makeTrack({
      getSettings: vi.fn().mockReturnValue({ displaySurface: "monitor" }),
    });
    const stream = makeStream([track]);
    vi.stubGlobal("navigator", {
      ...navigator,
      mediaDevices: {
        getDisplayMedia: vi.fn().mockResolvedValue(stream),
      },
    });

    const { result } = renderHook(() => useScreenCapture());
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.startScreenCapture();
    });

    let success = false;
    await act(async () => {
      success = await result.current.startScreenCapture();
    });
    expect(success).toBe(true);
  });

  it("stopScreenCapture sets isCapturing to false", async () => {
    const track = makeTrack({
      getSettings: vi.fn().mockReturnValue({ displaySurface: "monitor" }),
    });
    const stream = makeStream([track]);
    vi.stubGlobal("navigator", {
      ...navigator,
      mediaDevices: {
        getDisplayMedia: vi.fn().mockResolvedValue(stream),
      },
    });

    const { result } = renderHook(() => useScreenCapture());
    await act(async () => {
      await Promise.resolve();
      await result.current.startScreenCapture();
    });

    act(() => {
      result.current.stopScreenCapture();
    });
    expect(result.current.isCapturing).toBe(false);
    expect(result.current.streamRef.current).toBeNull();
  });

  it("validateScreenStream returns false when track readyState is not live", async () => {
    const track = makeTrack({
      readyState: "ended",
      getSettings: vi.fn().mockReturnValue({ displaySurface: "monitor" }),
    });
    const stream = makeStream([track]);
    vi.stubGlobal("navigator", {
      ...navigator,
      mediaDevices: {
        getDisplayMedia: vi.fn().mockResolvedValue(stream),
      },
    });

    const { result } = renderHook(() => useScreenCapture());
    await act(async () => {
      await result.current.startScreenCapture();
    });

    // Override stream ref directly to test validate logic
    expect(result.current.validateScreenStream()).toBe(false);
  });

  it("revalidates on browser online event without crashing", async () => {
    mockTakeScreenStream.mockReturnValue(null);
    const { result } = renderHook(() => useScreenCapture({ shouldInitialize: true }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(() => {
      act(() => {
        globalThis.dispatchEvent(new Event("online"));
      });
    }).not.toThrow();
    expect(result.current.validateScreenStream()).toBe(false);
  });

  it("revalidates on visibility change without crashing", async () => {
    mockTakeScreenStream.mockReturnValue(null);
    const { result } = renderHook(() => useScreenCapture({ shouldInitialize: true }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(() => {
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
    }).not.toThrow();
    expect(result.current.validateScreenStream()).toBe(false);
  });

  it("picks up stored stream from store on initialization", async () => {
    const track = makeTrack({
      getSettings: vi.fn().mockReturnValue({ displaySurface: "monitor" }),
    });
    const storedStream = makeStream([track]);
    mockTakeScreenStream.mockReturnValue(storedStream);

    const { result } = renderHook(() => useScreenCapture({ shouldInitialize: true }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isInitialized).toBe(true);
  });

  it("cleans up on unmount", async () => {
    mockTakeScreenStream.mockReturnValue(null);
    const { result, unmount } = renderHook(() => useScreenCapture());
    await act(async () => {
      await Promise.resolve();
    });
    unmount();
    expect(result.current.streamRef.current).toBeNull();
  });
});
