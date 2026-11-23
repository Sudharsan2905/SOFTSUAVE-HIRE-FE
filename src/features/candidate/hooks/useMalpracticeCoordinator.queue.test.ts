import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";
import { Provider } from "react-redux";
import { useMalpracticeCoordinator, isRetryableError } from "./useMalpracticeCoordinator";
import { makeStore } from "@/test/utils";

vi.mock("../../../utils/api", () => ({ default: { post: vi.fn() } }));
vi.mock("@/constants/api", () => ({
  API_ENDPOINTS: {
    CANDIDATE: {
      SUBMISSION_MALPRACTICE: (id: string) => `/candidate/submission/${id}/malpractice`,
    },
  },
}));
const mockPrepare = vi.fn(() => Symbol("c"));
const mockCommit = vi.fn();
const mockAbort = vi.fn();
const mockHasActive = vi.fn(() => false);
const mockFlushActive = vi.fn(async () => undefined);
vi.mock("./useMalpracticeRecording", () => ({
  useMalpracticeRecording: () => ({
    prepareCapture: mockPrepare,
    commitCapture: mockCommit,
    abortCapture: mockAbort,
    hasActiveCaptures: mockHasActive,
    flushActiveCaptures: mockFlushActive,
  }),
}));
import api from "../../../utils/api";
const mockPost = vi.mocked((api as unknown as { post: (...a: unknown[]) => unknown }).post);

const ok = (count: number, terminal = false) => ({
  data: { data: { malpractice_count: count, is_terminal: terminal, event_index: count - 1 } },
});
const networkError = () => Object.assign(new Error("Network Error"), {});
const httpError = (status: number) => Object.assign(new Error("x"), { response: { status } });

function setup(onTerminated?: () => void) {
  const store = makeStore();
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(Provider, { store, children });
  return renderHook(
    () => useMalpracticeCoordinator({ submissionId: "s1", monitoringConfig: {}, onTerminated }),
    { wrapper }
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  mockPost.mockReset();
  mockPrepare.mockClear();
  mockAbort.mockClear();
  mockHasActive.mockReset().mockReturnValue(false);
  mockFlushActive.mockClear();
});
afterEach(() => vi.useRealTimers());

describe("isRetryableError", () => {
  it("retries network errors, 5xx, 408 and 429 but not other 4xx", () => {
    expect(isRetryableError(networkError())).toBe(true);
    expect(isRetryableError(httpError(503))).toBe(true);
    expect(isRetryableError(httpError(429))).toBe(true);
    expect(isRetryableError(httpError(408))).toBe(true);
    expect(isRetryableError(httpError(403))).toBe(false);
    expect(isRetryableError(httpError(422))).toBe(false);
  });
});

describe("violation delivery queue", () => {
  it("queues a violation whose POST failed and delivers it on retry", async () => {
    mockPost.mockRejectedValueOnce(networkError()).mockResolvedValue(ok(1));
    const { result } = setup();
    let accepted = false;
    await act(async () => {
      accepted = await result.current.flagViolation({ type: "tab_switch" });
    });
    expect(accepted).toBe(true); // accepted for delivery, not lost
    expect(result.current.pendingViolations()).toBe(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(mockPost).toHaveBeenCalledTimes(2);
    expect(result.current.pendingViolations()).toBe(0);
  });

  it("flushes the queue immediately when the browser comes back online", async () => {
    mockPost.mockRejectedValueOnce(networkError());
    const { result } = setup();
    await act(async () => {
      await result.current.flagViolation({ type: "tab_switch" });
    });
    expect(result.current.pendingViolations()).toBe(1);
    mockPost.mockResolvedValue(ok(1));
    await act(async () => {
      globalThis.dispatchEvent(new Event("online"));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.pendingViolations()).toBe(0);
  });

  it("keeps order: a new violation waits behind queued ones", async () => {
    mockPost.mockRejectedValueOnce(networkError());
    const { result } = setup();
    await act(async () => {
      await result.current.flagViolation({ type: "tab_switch" });
    });
    mockPost.mockResolvedValue(ok(1));
    await act(async () => {
      await result.current.flagViolation({ type: "fullscreen_exit" });
      await vi.advanceTimersByTimeAsync(3_000);
    });
    const types = mockPost.mock.calls.map((c) => (c[1] as FormData).get("type"));
    expect(types).toEqual(["tab_switch", "tab_switch", "fullscreen_exit"]);
    expect(result.current.pendingViolations()).toBe(0);
  });

  it("drops (does not retry) a violation rejected with a final 4xx, e.g. session ended", async () => {
    mockPost.mockRejectedValue(httpError(403));
    const { result } = setup();
    let accepted = true;
    await act(async () => {
      accepted = await result.current.flagViolation({ type: "tab_switch" });
    });
    expect(accepted).toBe(false);
    expect(result.current.pendingViolations()).toBe(0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it("a terminal result from a replayed violation still triggers onTerminated", async () => {
    const onTerminated = vi.fn();
    mockPost.mockRejectedValueOnce(networkError()).mockResolvedValue(ok(3, true));
    const { result } = setup(onTerminated);
    await act(async () => {
      await result.current.flagViolation({ type: "tab_switch" });
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(onTerminated).toHaveBeenCalledWith("tab_switch");
  });
});

describe("terminating violation evidence", () => {
  it("waits for the final clip to upload before calling onTerminated", async () => {
    const onTerminated = vi.fn();
    mockHasActive.mockReturnValue(true);
    let releaseFlush: () => void = () => undefined;
    mockFlushActive.mockImplementation(
      () => new Promise<undefined>((r) => (releaseFlush = () => r(undefined)))
    );
    mockPost.mockResolvedValue(ok(3, true));
    const { result } = setup(onTerminated);
    let done = false;
    await act(async () => {
      void result.current.flagViolation({ type: "tab_switch" }).then(() => (done = true));
      await vi.advanceTimersByTimeAsync(3_100);
    });
    expect(mockFlushActive).toHaveBeenCalled();
    expect(onTerminated).not.toHaveBeenCalled(); // still uploading the clip
    await act(async () => {
      releaseFlush();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(onTerminated).toHaveBeenCalledWith("tab_switch");
    expect(done).toBe(true);
  });

  it("terminates immediately when there is no clip to upload", async () => {
    const onTerminated = vi.fn();
    mockPost.mockResolvedValue(ok(3, true));
    const { result } = setup(onTerminated);
    await act(async () => {
      await result.current.flagViolation({ type: "tab_switch" });
    });
    expect(onTerminated).toHaveBeenCalledWith("tab_switch");
  });
});
