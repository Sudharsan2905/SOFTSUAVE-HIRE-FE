import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createRef } from "react";
import type { MutableRefObject } from "react";

// ── @mediapipe/tasks-vision mock ─────────────────────────────────────────────
// detectForVideo is controllable per-test via this mutable ref.
let detectResult: { detections: unknown[] } = { detections: [] };
let detectThrows = false;
const closeSpy = vi.fn();
const createFromOptions = vi.fn();
const forVisionTasks = vi.fn().mockResolvedValue({});

vi.mock("@mediapipe/tasks-vision", () => ({
  FaceDetector: {
    createFromOptions: (...args: unknown[]) => createFromOptions(...args),
  },
  FilesetResolver: {
    forVisionTasks: (...args: unknown[]) => forVisionTasks(...args),
  },
}));

import { useVideoMonitoring } from "./useVideoMonitoring";

// ── rAF / performance.now control ────────────────────────────────────────────
let rafCallbacks: FrameRequestCallback[] = [];
let rafId = 0;
let nowValue = 0;

function flushRaf(times = 1) {
  for (let i = 0; i < times; i++) {
    const cbs = rafCallbacks;
    rafCallbacks = [];
    for (const cb of cbs) cb(nowValue);
  }
}

// Drains the microtask queue so the async init() chain (dynamic import +
// FilesetResolver + FaceDetector.createFromOptions) fully resolves and the
// detection loop is scheduled before we start flushing rAF frames.
async function flushInit() {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

function makeVideoRef(
  readyState = 4
): MutableRefObject<HTMLVideoElement | null> {
  const ref = createRef<HTMLVideoElement | null>() as MutableRefObject<HTMLVideoElement | null>;
  ref.current = { readyState } as unknown as HTMLVideoElement;
  return ref;
}

beforeEach(() => {
  rafCallbacks = [];
  rafId = 0;
  nowValue = 0;
  detectResult = { detections: [] };
  detectThrows = false;
  closeSpy.mockReset();
  createFromOptions.mockReset();
  createFromOptions.mockImplementation(async () => ({
    detectForVideo: vi.fn(() => {
      if (detectThrows) throw new Error("detector not ready");
      return detectResult;
    }),
    close: closeSpy,
  }));
  forVisionTasks.mockClear();
  forVisionTasks.mockResolvedValue({});

  vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(
    (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return ++rafId;
    }
  );
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});
  vi.spyOn(performance, "now").mockImplementation(() => nowValue);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useVideoMonitoring", () => {
  it("returns the initial monitoring state shape", () => {
    const onViolation = vi.fn();
    const { result } = renderHook(() =>
      useVideoMonitoring({ enabled: false, videoRef: makeVideoRef(), onViolation })
    );
    expect(result.current.faceCount).toBe(0);
    expect(result.current.isFacingCamera).toBe(true);
  });

  it("does nothing (no detector init) when disabled", () => {
    const onViolation = vi.fn();
    renderHook(() =>
      useVideoMonitoring({ enabled: false, videoRef: makeVideoRef(), onViolation })
    );
    expect(forVisionTasks).not.toHaveBeenCalled();
    expect(createFromOptions).not.toHaveBeenCalled();
  });

  it("initializes the MediaPipe detector and starts the rAF loop when enabled", async () => {
    const onViolation = vi.fn();
    renderHook(() =>
      useVideoMonitoring({ enabled: true, videoRef: makeVideoRef(), onViolation })
    );

    await act(async () => {
      await flushInit();
    });

    expect(forVisionTasks).toHaveBeenCalled();
    expect(createFromOptions).toHaveBeenCalled();
    // The loop schedules a frame
    expect(rafCallbacks.length).toBeGreaterThan(0);
  });

  it("bails out of init when detector creation throws (no loop scheduled)", async () => {
    createFromOptions.mockRejectedValueOnce(new Error("gpu unavailable"));
    const onViolation = vi.fn();
    renderHook(() =>
      useVideoMonitoring({ enabled: true, videoRef: makeVideoRef(), onViolation })
    );

    await act(async () => {
      await flushInit();
    });

    // init returned early before runDetectionLoop, so no frame was scheduled
    expect(rafCallbacks).toHaveLength(0);
    expect(onViolation).not.toHaveBeenCalled();
  });

  it("updates faceCount and flags face_absence after the absence threshold", async () => {
    const onViolation = vi.fn();
    const videoRef = makeVideoRef(4);
    renderHook(() =>
      useVideoMonitoring({ enabled: true, videoRef, onViolation })
    );
    await act(async () => {
      await flushInit();
    });

    // No faces detected
    detectResult = { detections: [] };

    // First detection frame records faceAbsenceStart. Use a base past the
    // 15s violation cooldown so canFlag will later permit the flag.
    nowValue = 20000;
    act(() => flushRaf());
    expect(onViolation).not.toHaveBeenCalled();

    // A later frame beyond FACE_ABSENCE_THRESHOLD_MS (3000ms) fires the violation
    nowValue = 24000;
    act(() => flushRaf());

    expect(onViolation).toHaveBeenCalledWith(
      "face_absence",
      expect.stringContaining("No face detected")
    );
  });

  it("flags multiple_faces when more than one face is detected", async () => {
    const onViolation = vi.fn();
    const videoRef = makeVideoRef(4);
    renderHook(() =>
      useVideoMonitoring({ enabled: true, videoRef, onViolation })
    );
    await act(async () => {
      await flushInit();
    });

    detectResult = { detections: [{}, {}, {}] };
    // Past the 15s violation cooldown so the first multiple_faces flag is allowed.
    nowValue = 20000;
    act(() => flushRaf());

    expect(onViolation).toHaveBeenCalledWith(
      "multiple_faces",
      expect.stringContaining("Multiple faces (3)")
    );
  });

  it("does not flag when exactly one face is detected and resets absence", async () => {
    const onViolation = vi.fn();
    const videoRef = makeVideoRef(4);
    renderHook(() =>
      useVideoMonitoring({ enabled: true, videoRef, onViolation })
    );
    await act(async () => {
      await flushInit();
    });

    detectResult = { detections: [{}] };
    nowValue = 1000;
    act(() => flushRaf());
    nowValue = 6000;
    act(() => flushRaf());

    expect(onViolation).not.toHaveBeenCalled();
  });

  it("respects the violation cooldown (does not double-flag within 15s)", async () => {
    const onViolation = vi.fn();
    const videoRef = makeVideoRef(4);
    renderHook(() =>
      useVideoMonitoring({ enabled: true, videoRef, onViolation })
    );
    await act(async () => {
      await flushInit();
    });

    detectResult = { detections: [{}, {}] };

    // First flag (past the initial cooldown window since last=0, now>15000)
    nowValue = 20000;
    act(() => flushRaf());
    expect(onViolation).toHaveBeenCalledTimes(1);

    // Within the 15s cooldown — canFlag returns false (25000-20000=5000 < 15000)
    nowValue = 25000;
    act(() => flushRaf());
    expect(onViolation).toHaveBeenCalledTimes(1);

    // Past the cooldown — flags again (40000-20000=20000 > 15000)
    nowValue = 40000;
    act(() => flushRaf());
    expect(onViolation).toHaveBeenCalledTimes(2);
  });

  it("skips detection when video is not ready (readyState < 2)", async () => {
    const onViolation = vi.fn();
    const videoRef = makeVideoRef(1); // HAVE_METADATA, < HAVE_CURRENT_DATA
    renderHook(() =>
      useVideoMonitoring({ enabled: true, videoRef, onViolation })
    );
    await act(async () => {
      await flushInit();
    });

    detectResult = { detections: [] };
    nowValue = 5000;
    act(() => flushRaf());
    act(() => flushRaf());

    expect(onViolation).not.toHaveBeenCalled();
  });

  it("does not run detection before the detection interval elapses", async () => {
    const onViolation = vi.fn();
    const videoRef = makeVideoRef(4);
    renderHook(() =>
      useVideoMonitoring({ enabled: true, videoRef, onViolation })
    );
    await act(async () => {
      await flushInit();
    });

    detectResult = { detections: [{}, {}] };
    // now stays at 0 (< DETECTION_INTERVAL_MS = 700), so processDetectionFrame is skipped
    nowValue = 100;
    act(() => flushRaf());

    expect(onViolation).not.toHaveBeenCalled();
  });

  it("swallows detector errors during a frame without throwing", async () => {
    const onViolation = vi.fn();
    const videoRef = makeVideoRef(4);
    renderHook(() =>
      useVideoMonitoring({ enabled: true, videoRef, onViolation })
    );
    await act(async () => {
      await flushInit();
    });

    detectThrows = true;
    nowValue = 1000;
    expect(() => act(() => flushRaf())).not.toThrow();
    expect(onViolation).not.toHaveBeenCalled();
  });

  it("uses the latest onViolation callback without re-running the detection effect", async () => {
    const firstCb = vi.fn();
    const secondCb = vi.fn();
    const videoRef = makeVideoRef(4);
    const { rerender } = renderHook(
      ({ cb }: { cb: typeof firstCb }) =>
        useVideoMonitoring({ enabled: true, videoRef, onViolation: cb }),
      { initialProps: { cb: firstCb } }
    );
    await act(async () => {
      await flushInit();
    });

    rerender({ cb: secondCb });

    detectResult = { detections: [{}, {}] };
    // Past the 15s violation cooldown so a flag is emitted.
    nowValue = 20000;
    act(() => flushRaf());

    expect(secondCb).toHaveBeenCalled();
    expect(firstCb).not.toHaveBeenCalled();
  });

  it("stops the loop and closes the detector on unmount", async () => {
    const onViolation = vi.fn();
    const videoRef = makeVideoRef(4);
    const { unmount } = renderHook(() =>
      useVideoMonitoring({ enabled: true, videoRef, onViolation })
    );
    await act(async () => {
      await flushInit();
    });

    const cancelSpy = vi.spyOn(globalThis, "cancelAnimationFrame");
    unmount();

    expect(cancelSpy).toHaveBeenCalled();
    expect(closeSpy).toHaveBeenCalled();
  });

  it("does not detect after unmount (running flag cleared)", async () => {
    const onViolation = vi.fn();
    const videoRef = makeVideoRef(4);
    const { unmount } = renderHook(() =>
      useVideoMonitoring({ enabled: true, videoRef, onViolation })
    );
    await act(async () => {
      await flushInit();
    });

    unmount();
    detectResult = { detections: [{}, {}] };
    nowValue = 1000;
    act(() => flushRaf());

    expect(onViolation).not.toHaveBeenCalled();
  });
});
