import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAudioMonitoring } from "./useAudioMonitoring";

vi.mock("../services/screenCaptureStore", () => ({
  takeAudioStream: vi.fn().mockReturnValue(null),
}));

import { takeAudioStream } from "../services/screenCaptureStore";
const mockTakeAudio = takeAudioStream as ReturnType<typeof vi.fn>;

function makeMockStream() {
  const track = { stop: vi.fn() };
  return {
    getTracks: () => [track],
  } as unknown as MediaStream;
}

function makeMockAnalyser(avgLevel = 0) {
  return {
    fftSize: 256,
    frequencyBinCount: 128,
    connect: vi.fn(),
    getByteFrequencyData: vi.fn().mockImplementation((arr: Uint8Array) => arr.fill(avgLevel)),
  } as unknown as AnalyserNode;
}

function makeMockAudioContext(analyser: AnalyserNode) {
  const source = { connect: vi.fn() };
  return {
    createMediaStreamSource: vi.fn().mockReturnValue(source),
    createAnalyser: vi.fn().mockReturnValue(analyser),
    close: vi.fn(),
  } as unknown as AudioContext;
}

function setupAudioMocks(stream: MediaStream, shouldSucceed = true) {
  const analyser = makeMockAnalyser(0);
  const audioContext = makeMockAudioContext(analyser);
  vi.stubGlobal("AudioContext", vi.fn().mockImplementation(() => audioContext));
  vi.stubGlobal("requestAnimationFrame", vi.fn().mockImplementation(() => 0));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const getUserMedia = shouldSucceed
    ? vi.fn().mockResolvedValue(stream)
    : vi.fn().mockRejectedValue(new Error("denied"));
  Object.defineProperty(navigator, "mediaDevices", {
    value: { getUserMedia },
    configurable: true,
  });
  return { analyser, audioContext, getUserMedia };
}

beforeEach(() => {
  mockTakeAudio.mockReturnValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useAudioMonitoring", () => {
  it("does nothing when enabled=false", async () => {
    const getUserMedia = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia },
      configurable: true,
    });
    const { unmount } = renderHook(() =>
      useAudioMonitoring({ enabled: false, onViolation: vi.fn() })
    );
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    await act(async () => {});
    expect(getUserMedia).not.toHaveBeenCalled();
    unmount();
  });

  it("does nothing when shouldInitialize=false", async () => {
    const getUserMedia = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia },
      configurable: true,
    });
    const { unmount } = renderHook(() =>
      useAudioMonitoring({ enabled: true, shouldInitialize: false, onViolation: vi.fn() })
    );
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    await act(async () => {});
    expect(getUserMedia).not.toHaveBeenCalled();
    unmount();
  });

  it("uses stored audio stream instead of requesting getUserMedia", async () => {
    const storedStream = makeMockStream();
    mockTakeAudio.mockReturnValue(storedStream);
    const { getUserMedia } = setupAudioMocks(storedStream);

    const { unmount } = renderHook(() =>
      useAudioMonitoring({ enabled: true, onViolation: vi.fn() })
    );
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    await act(async () => {});
    expect(getUserMedia).not.toHaveBeenCalled();
    unmount();
  });

  it("requests microphone when no stored stream", async () => {
    const stream = makeMockStream();
    const { getUserMedia } = setupAudioMocks(stream);

    const { unmount } = renderHook(() =>
      useAudioMonitoring({ enabled: true, onViolation: vi.fn() })
    );
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    await act(async () => {});
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    unmount();
  });

  it("calls onStreamReady with the acquired stream", async () => {
    const stream = makeMockStream();
    setupAudioMocks(stream);

    const onStreamReady = vi.fn();
    const { unmount } = renderHook(() =>
      useAudioMonitoring({ enabled: true, onViolation: vi.fn(), onStreamReady })
    );
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    await act(async () => {});
    expect(onStreamReady).toHaveBeenCalledWith(stream);
    unmount();
  });

  it("sets up AudioContext after acquiring the stream", async () => {
    const stream = makeMockStream();
    const { getUserMedia } = setupAudioMocks(stream);

    const { unmount } = renderHook(() =>
      useAudioMonitoring({ enabled: true, onViolation: vi.fn() })
    );
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
    });
    expect(getUserMedia).toHaveBeenCalled();
    // AudioContext constructor should have been called
    const AudioContextMock = globalThis.AudioContext as ReturnType<typeof vi.fn>;
    expect(AudioContextMock).toHaveBeenCalled();
    unmount();
  });

  it("handles getUserMedia rejection silently", async () => {
    const getUserMedia = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia },
      configurable: true,
    });
    const onViolation = vi.fn();
    const { unmount } = renderHook(() =>
      useAudioMonitoring({ enabled: true, onViolation })
    );
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    await act(async () => {});
    expect(onViolation).not.toHaveBeenCalled();
    unmount();
  });
});
