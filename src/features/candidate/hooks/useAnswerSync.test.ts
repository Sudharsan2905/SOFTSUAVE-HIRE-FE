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

  it("flushPending sends all pending answers immediately", () => {
    const { result } = renderHook(() => useAnswerSync({ submissionId: "sub-1", debounceMs: 1000 }));
    act(() => {
      result.current.setAnswer("q-1", "ans-1");
      result.current.setAnswer("q-2", "ans-2");
    });
    expect(mockPost).not.toHaveBeenCalled();

    act(() => result.current.flushPending());
    expect(mockPost).toHaveBeenCalledTimes(2);
  });

  it("flushPending clears the pending timers", () => {
    const { result } = renderHook(() => useAnswerSync({ submissionId: "sub-1", debounceMs: 1000 }));
    act(() => result.current.setAnswer("q-1", "val"));
    act(() => result.current.flushPending());
    mockPost.mockClear();

    // Advancing the timer should NOT fire again after flush
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("handles server errors silently", async () => {
    mockPost.mockRejectedValueOnce(new Error("network"));
    const { result } = renderHook(() => useAnswerSync({ submissionId: "sub-1", debounceMs: 100 }));
    act(() => result.current.setAnswer("q-1", "ans"));
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    // The hook attempts the POST then swallows the rejection
    expect(mockPost).toHaveBeenCalled();
  });
});
