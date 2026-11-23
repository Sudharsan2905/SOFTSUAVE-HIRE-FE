import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAnswerSync } from "./useAnswerSync";

vi.mock("@/utils/api", () => ({
  default: { post: vi.fn().mockResolvedValue({}) },
}));

import api from "@/utils/api";
const mockPost = api.post as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  mockPost.mockReset();
  mockPost.mockResolvedValue({});
});
afterEach(() => vi.useRealTimers());

describe("useAnswerSync", () => {
  it("stores an answer in the ref immediately", () => {
    const { result } = renderHook(() => useAnswerSync({ submissionId: "sub-1" }));
    act(() => result.current.setAnswer("q-1", "option A"));
    expect(result.current.answers.current["q-1"]).toBe("option A");
  });

  it("debounces the server sync", () => {
    const { result } = renderHook(() => useAnswerSync({ submissionId: "sub-1", debounceMs: 500 }));
    act(() => result.current.setAnswer("q-1", "option A"));
    expect(mockPost).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it("resets debounce timer on rapid updates", () => {
    const { result } = renderHook(() => useAnswerSync({ submissionId: "sub-1", debounceMs: 500 }));
    act(() => result.current.setAnswer("q-1", "A"));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    act(() => result.current.setAnswer("q-1", "B"));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    // Only 300ms since last update, should not have synced yet
    expect(mockPost).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ answer: "B" })
    );
  });

  it("flushPending sends all pending answers immediately and resolves true", async () => {
    const { result } = renderHook(() => useAnswerSync({ submissionId: "sub-1", debounceMs: 1000 }));
    act(() => {
      result.current.setAnswer("q-1", "ans-1");
      result.current.setAnswer("q-2", "ans-2");
    });
    expect(mockPost).not.toHaveBeenCalled();

    let ok = false;
    await act(async () => {
      ok = await result.current.flushPending();
    });
    expect(mockPost).toHaveBeenCalledTimes(2);
    expect(ok).toBe(true);
    expect(result.current.pendingCount()).toBe(0);
  });

  it("flushPending clears the pending timers", async () => {
    const { result } = renderHook(() => useAnswerSync({ submissionId: "sub-1", debounceMs: 1000 }));
    act(() => result.current.setAnswer("q-1", "val"));
    await act(async () => {
      await result.current.flushPending();
    });
    mockPost.mockClear();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("keeps a failed answer dirty and retries it with backoff until it is saved", async () => {
    mockPost.mockRejectedValueOnce(new Error("network"));
    const { result } = renderHook(() => useAnswerSync({ submissionId: "sub-1", debounceMs: 100 }));
    act(() => result.current.setAnswer("q-1", "ans"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(result.current.pendingCount()).toBe(1); // not lost

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_100); // first retry (1s backoff)
    });
    expect(mockPost).toHaveBeenCalledTimes(2);
    expect(result.current.pendingCount()).toBe(0);
  });

  it("flushPending resolves false when the server keeps rejecting, so submit can wait", async () => {
    mockPost.mockRejectedValue(new Error("down"));
    const { result } = renderHook(() => useAnswerSync({ submissionId: "sub-1", debounceMs: 100 }));
    act(() => result.current.setAnswer("q-1", "ans"));
    let ok = true;
    await act(async () => {
      const p = result.current.flushPending();
      await vi.advanceTimersByTimeAsync(5_000);
      ok = await p;
    });
    expect(ok).toBe(false);
    expect(result.current.pendingCount()).toBe(1);
  });

  it("re-syncs outstanding answers when the browser comes back online", async () => {
    mockPost.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useAnswerSync({ submissionId: "sub-1", debounceMs: 100 }));
    act(() => result.current.setAnswer("q-1", "ans"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(result.current.pendingCount()).toBe(1);
    await act(async () => {
      globalThis.dispatchEvent(new Event("online"));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.pendingCount()).toBe(0);
  });
});
