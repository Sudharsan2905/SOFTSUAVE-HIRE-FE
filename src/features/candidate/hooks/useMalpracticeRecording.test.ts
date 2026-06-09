import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMalpracticeRecording } from "./useMalpracticeRecording";

vi.mock("../../../utils/api", () => ({
  default: { post: vi.fn() },
}));
vi.mock("@/constants/api", () => ({
  API_ENDPOINTS: {
    CANDIDATE: {
      SUBMISSION_MALPRACTICE_MEDIA: (id: string, idx: number) =>
        `/candidate/submissions/${id}/malpractice/${idx}/media`,
    },
  },
}));

import api from "../../../utils/api";
const mockPost = vi.mocked((api as unknown as { post: (...args: unknown[]) => unknown }).post);

// ── MediaRecorder mock ──────────────────────────────────────────────────────

let recorderInstances: MockMediaRecorder[] = [];

class MockMediaRecorder {
  static readonly isTypeSupported = vi.fn().mockReturnValue(false);
  state: MediaRecorder["state"] = "inactive";
  start = vi.fn(() => {
    this.state = "recording";
  });
  stop = vi.fn(() => {
    this.state = "inactive";
    for (const cb of this._stopCbs) cb();
  });
  addEventListener = vi.fn((event: string, cb: () => void) => {
    if (event === "stop") this._stopCbs.push(cb);
  });
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  _stopCbs: Array<() => void> = [];
  constructor(_stream: MediaStream, _opts?: MediaRecorderOptions) {
    recorderInstances.push(this);
  }
}

// ── MediaStream mock — must be a class, not an arrow fn, for `new` ──────────

class MockMediaStream {
  private readonly _tracks: MediaStreamTrack[];
  constructor(tracks?: MediaStreamTrack[]) {
    this._tracks = tracks ?? [];
  }
  getVideoTracks = () => this._tracks;
  getAudioTracks = () => this._tracks;
  getTracks = () => this._tracks;
}

function makeMockTrack(readyState: MediaStreamTrack["readyState"] = "live") {
  return { readyState, stop: vi.fn() } as unknown as MediaStreamTrack;
}

function makeMockStream(count = 1, readyState: MediaStreamTrack["readyState"] = "live") {
  const tracks = Array.from({ length: count }, () => makeMockTrack(readyState));
  return {
    getVideoTracks: () => tracks,
    getAudioTracks: () => tracks,
    getTracks: () => tracks,
  } as unknown as MediaStream;
}

const defaultOptions = {
  submissionId: "sub-1",
  screenStream: null as MediaStream | null,
  audioStream: null as MediaStream | null,
  hasScreenMonitoring: false,
  hasAudioMonitoring: false,
};

describe("useMalpracticeRecording", () => {
  beforeEach(() => {
    recorderInstances = [];
    mockPost.mockReset();
    mockPost.mockResolvedValue({ data: {} });
    vi.stubGlobal("MediaRecorder", MockMediaRecorder);
    vi.stubGlobal("MediaStream", MockMediaStream);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("returns prepareCapture, commitCapture, and abortCapture", () => {
    const { result } = renderHook(() => useMalpracticeRecording(defaultOptions));
    expect(typeof result.current.prepareCapture).toBe("function");
    expect(typeof result.current.commitCapture).toBe("function");
    expect(typeof result.current.abortCapture).toBe("function");
  });

  it("prepareCapture returns a unique symbol each call", () => {
    const { result } = renderHook(() => useMalpracticeRecording(defaultOptions));
    const id1 = result.current.prepareCapture();
    const id2 = result.current.prepareCapture();
    expect(typeof id1).toBe("symbol");
    expect(id1).not.toBe(id2);
  });

  it("prepareCapture with no live tracks creates a session with null recorder", () => {
    const { result } = renderHook(() => useMalpracticeRecording(defaultOptions));
    const id = result.current.prepareCapture();
    expect(typeof id).toBe("symbol");
    // No MediaRecorder should be created when there are no tracks
    expect(recorderInstances).toHaveLength(0);
    act(() => {
      result.current.abortCapture(id);
    });
  });

  it("prepareCapture with live screen tracks creates a MediaRecorder", () => {
    const screenStream = makeMockStream(1);
    const { result } = renderHook(() =>
      useMalpracticeRecording({ ...defaultOptions, screenStream, hasScreenMonitoring: true })
    );
    result.current.prepareCapture();
    expect(recorderInstances).toHaveLength(1);
    expect(recorderInstances[0].start).toHaveBeenCalled();
    expect(recorderInstances[0].state).toBe("recording");
  });

  it("abortCapture stops recorder when it is recording", () => {
    const screenStream = makeMockStream(1);
    const { result } = renderHook(() =>
      useMalpracticeRecording({ ...defaultOptions, screenStream, hasScreenMonitoring: true })
    );
    const id = result.current.prepareCapture();
    expect(recorderInstances[0].state).toBe("recording");

    act(() => {
      result.current.abortCapture(id);
    });

    expect(recorderInstances[0].stop).toHaveBeenCalled();
  });

  it("abortCapture on unknown id is a no-op", () => {
    const { result } = renderHook(() => useMalpracticeRecording(defaultOptions));
    const unknownId = Symbol("unknown");
    expect(() => {
      act(() => {
        result.current.abortCapture(unknownId);
      });
    }).not.toThrow();
    expect(recorderInstances).toHaveLength(0);
  });

  it("commitCapture on unknown id is a no-op", () => {
    const { result } = renderHook(() => useMalpracticeRecording(defaultOptions));
    const unknownId = Symbol("unknown");
    expect(() => {
      act(() => {
        result.current.commitCapture(unknownId, 0);
      });
    }).not.toThrow();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("commitCapture schedules upload after 20-second forward window", async () => {
    vi.useFakeTimers();
    const screenStream = makeMockStream(1);
    const { result } = renderHook(() =>
      useMalpracticeRecording({ ...defaultOptions, screenStream, hasScreenMonitoring: true })
    );

    act(() => {
      const captureId = result.current.prepareCapture();
      // Simulate a data chunk so blobs is non-empty (uploadCapture guards on blobs.length === 0)
      recorderInstances[0].ondataavailable?.({ data: new Blob(["chunk"]) });
      result.current.commitCapture(captureId, 7);
    });

    // Before 20s: upload not called
    act(() => { vi.advanceTimersByTime(15_000); });
    expect(mockPost).not.toHaveBeenCalled();

    // Advance past the 20s window and flush the async chain
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockPost).toHaveBeenCalledWith(
      expect.stringContaining("malpractice/7"),
      expect.any(FormData),
      expect.any(Object)
    );
  });

  it("handles ended screen tracks gracefully (null recorder)", () => {
    const endedStream = makeMockStream(1, "ended");
    const { result } = renderHook(() =>
      useMalpracticeRecording({
        ...defaultOptions,
        screenStream: endedStream,
        hasScreenMonitoring: true,
      })
    );
    const id = result.current.prepareCapture();
    // Ended tracks produce no recorder
    expect(recorderInstances).toHaveLength(0);
    act(() => {
      result.current.abortCapture(id);
    });
  });

  it("responds to stream changes — new tracks create recorders on next prepareCapture", () => {
    const { rerender, result } = renderHook(
      (props) => useMalpracticeRecording(props),
      { initialProps: { ...defaultOptions } }
    );

    const screenStream = makeMockStream(1);
    rerender({ ...defaultOptions, screenStream, hasScreenMonitoring: true });

    result.current.prepareCapture();
    expect(recorderInstances).toHaveLength(1);
  });

  it("flushes pending sessions on unmount — stops recorder", () => {
    const screenStream = makeMockStream(1);
    const { result, unmount } = renderHook(() =>
      useMalpracticeRecording({ ...defaultOptions, screenStream, hasScreenMonitoring: true })
    );
    result.current.prepareCapture();
    expect(recorderInstances[0].stop).not.toHaveBeenCalled();

    unmount();
    expect(recorderInstances[0].stop).toHaveBeenCalled();
  });

  it("flushes active events on unmount — attempts upload", async () => {
    vi.useFakeTimers();
    const screenStream = makeMockStream(1);
    const { result, unmount } = renderHook(() =>
      useMalpracticeRecording({ ...defaultOptions, screenStream, hasScreenMonitoring: true })
    );

    act(() => {
      const id = result.current.prepareCapture();
      // Buffer a chunk so uploadCapture doesn't short-circuit on empty blobs
      recorderInstances[0].ondataavailable?.({ data: new Blob(["chunk"]) });
      result.current.commitCapture(id, 3);
    });

    await act(async () => {
      unmount();
      // Flush microtask queue so the fire-and-forget uploadCapture completes
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockPost).toHaveBeenCalled();
  });

  it("skips upload when blobs array is empty", async () => {
    vi.useFakeTimers();
    // With no live tracks, blobs stays empty — no MediaRecorder to emit data
    const { result } = renderHook(() => useMalpracticeRecording(defaultOptions));

    act(() => {
      const id = result.current.prepareCapture();
      result.current.commitCapture(id, 2);
    });

    await act(async () => {
      vi.advanceTimersByTime(21_000);
      await Promise.resolve();
    });

    // No blobs → upload skipped (api.post not called)
    expect(mockPost).not.toHaveBeenCalled();
  });
});
