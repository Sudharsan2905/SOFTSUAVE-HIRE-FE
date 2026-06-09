import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";
import { Provider } from "react-redux";
import { useMalpracticeCoordinator } from "./useMalpracticeCoordinator";
import { makeStore } from "@/test/utils";

vi.mock("../../../utils/api", () => ({
  default: { post: vi.fn() },
}));
vi.mock("@/constants/api", () => ({
  API_ENDPOINTS: {
    CANDIDATE: {
      SUBMISSION_MALPRACTICE: (id: string) =>
        `/candidate/submission/${id}/malpractice`,
    },
  },
}));

const mockPrepareCapture = vi.fn(() => Symbol("capture"));
const mockCommitCapture = vi.fn();
const mockAbortCapture = vi.fn();

vi.mock("./useMalpracticeRecording", () => ({
  useMalpracticeRecording: () => ({
    prepareCapture: mockPrepareCapture,
    commitCapture: mockCommitCapture,
    abortCapture: mockAbortCapture,
  }),
}));

import api from "../../../utils/api";
const mockPost = vi.mocked((api as unknown as { post: (...args: unknown[]) => unknown }).post);

function makeWrapper(store: ReturnType<typeof makeStore>) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(Provider, { store, children });
  };
}

const defaultOptions = {
  submissionId: "sub-1",
  monitoringConfig: {} as Record<string, boolean>,
};

describe("useMalpracticeCoordinator", () => {
  let store: ReturnType<typeof makeStore>;

  beforeEach(() => {
    store = makeStore();
    mockPost.mockReset();
    mockPrepareCapture.mockReset();
    mockCommitCapture.mockReset();
    mockAbortCapture.mockReset();
    mockPrepareCapture.mockReturnValue(Symbol("capture"));
    mockPost.mockResolvedValue({
      data: { data: { malpractice_count: 1, is_terminal: false, event_index: 5 } },
    });
  });

  it("returns flagViolation and resetFirstWarnings", () => {
    const { result } = renderHook(
      () => useMalpracticeCoordinator(defaultOptions),
      { wrapper: makeWrapper(store) }
    );
    expect(typeof result.current.flagViolation).toBe("function");
    expect(typeof result.current.resetFirstWarnings).toBe("function");
  });

  it("first occurrence of two-strike type dispatches UI warning only (no POST)", async () => {
    const { result } = renderHook(
      () => useMalpracticeCoordinator(defaultOptions),
      { wrapper: makeWrapper(store) }
    );

    await act(async () => {
      await result.current.flagViolation({ type: "face_absence" });
    });

    expect(mockPost).not.toHaveBeenCalled();
    expect(mockPrepareCapture).not.toHaveBeenCalled();

    const state = store.getState().proctoring;
    expect(state.isWarningVisible).toBe(true);
    expect(state.lastViolationType).toBe("face_absence");
  });

  it("second occurrence of two-strike type goes through full POST flow", async () => {
    const { result } = renderHook(
      () => useMalpracticeCoordinator(defaultOptions),
      { wrapper: makeWrapper(store) }
    );

    await act(async () => {
      await result.current.flagViolation({ type: "face_absence" });
    });
    await act(async () => {
      await result.current.flagViolation({ type: "face_absence" });
    });

    expect(mockPost).toHaveBeenCalledOnce();
    expect(mockPrepareCapture).toHaveBeenCalledOnce();
    expect(mockCommitCapture).toHaveBeenCalled();
  });

  it("non-two-strike type goes directly to POST on first occurrence", async () => {
    const { result } = renderHook(
      () => useMalpracticeCoordinator(defaultOptions),
      { wrapper: makeWrapper(store) }
    );

    await act(async () => {
      await result.current.flagViolation({ type: "tab_switch" });
    });

    expect(mockPost).toHaveBeenCalledOnce();
    expect(mockPrepareCapture).toHaveBeenCalledOnce();
  });

  it("dispatches setMalpracticeCount and setLastViolation on non-terminal POST", async () => {
    mockPost.mockResolvedValue({
      data: { data: { malpractice_count: 2, is_terminal: false, event_index: 3 } },
    });

    const { result } = renderHook(
      () => useMalpracticeCoordinator(defaultOptions),
      { wrapper: makeWrapper(store) }
    );

    await act(async () => {
      await result.current.flagViolation({ type: "tab_switch" });
    });

    const state = store.getState().proctoring;
    expect(state.malpracticeCount).toBe(2);
    expect(state.isWarningVisible).toBe(true);
    expect(state.lastViolationType).toBe("tab_switch");
  });

  it("dispatches setTerminated and calls onTerminated on terminal POST", async () => {
    mockPost.mockResolvedValue({
      data: { data: { malpractice_count: 3, is_terminal: true, event_index: 4 } },
    });
    const onTerminated = vi.fn();

    const { result } = renderHook(
      () => useMalpracticeCoordinator({ ...defaultOptions, onTerminated }),
      { wrapper: makeWrapper(store) }
    );

    await act(async () => {
      await result.current.flagViolation({ type: "fullscreen_exit" });
    });

    const state = store.getState().proctoring;
    expect(state.isTerminated).toBe(true);
    expect(state.terminationReason).toBe("fullscreen_exit");
    expect(onTerminated).toHaveBeenCalledWith("fullscreen_exit");
  });

  it("commits capture with returned event_index on success", async () => {
    mockPost.mockResolvedValue({
      data: { data: { malpractice_count: 1, is_terminal: false, event_index: 42 } },
    });
    const captureId = Symbol("cap");
    mockPrepareCapture.mockReturnValue(captureId);

    const { result } = renderHook(
      () => useMalpracticeCoordinator(defaultOptions),
      { wrapper: makeWrapper(store) }
    );

    await act(async () => {
      await result.current.flagViolation({ type: "tab_switch" });
    });

    expect(mockCommitCapture).toHaveBeenCalledWith(captureId, 42);
    expect(mockAbortCapture).not.toHaveBeenCalled();
  });

  it("aborts capture when POST fails", async () => {
    mockPost.mockRejectedValue(new Error("Network error"));
    const captureId = Symbol("cap");
    mockPrepareCapture.mockReturnValue(captureId);

    const { result } = renderHook(
      () => useMalpracticeCoordinator(defaultOptions),
      { wrapper: makeWrapper(store) }
    );

    await act(async () => {
      await result.current.flagViolation({ type: "tab_switch" });
    });

    expect(mockAbortCapture).toHaveBeenCalledWith(captureId);
    expect(mockCommitCapture).not.toHaveBeenCalled();
  });

  it("aborts capture when POST returns no event_index", async () => {
    mockPost.mockResolvedValue({
      data: { data: {} }, // no event_index
    });
    const captureId = Symbol("cap");
    mockPrepareCapture.mockReturnValue(captureId);

    const { result } = renderHook(
      () => useMalpracticeCoordinator(defaultOptions),
      { wrapper: makeWrapper(store) }
    );

    await act(async () => {
      await result.current.flagViolation({ type: "tab_switch" });
    });

    expect(mockAbortCapture).toHaveBeenCalledWith(captureId);
    expect(mockCommitCapture).not.toHaveBeenCalled();
  });

  it("resetFirstWarnings clears two-strike state so next occurrence is first again", async () => {
    const { result } = renderHook(
      () => useMalpracticeCoordinator(defaultOptions),
      { wrapper: makeWrapper(store) }
    );

    // First occurrence
    await act(async () => {
      await result.current.flagViolation({ type: "multiple_faces" });
    });
    expect(mockPost).not.toHaveBeenCalled();

    // Reset
    act(() => {
      result.current.resetFirstWarnings();
    });

    // After reset, next occurrence is first again → no POST
    await act(async () => {
      await result.current.flagViolation({ type: "multiple_faces" });
    });
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("includes description in POST payload when provided", async () => {
    const { result } = renderHook(
      () => useMalpracticeCoordinator(defaultOptions),
      { wrapper: makeWrapper(store) }
    );

    await act(async () => {
      await result.current.flagViolation({ type: "copy_paste", description: "Ctrl+C pressed" });
    });

    const postedData = mockPost.mock.calls[0][1] as FormData;
    expect(postedData.get("description")).toBe("Ctrl+C pressed");
    expect(postedData.get("type")).toBe("copy_paste");
  });

  it("uses VIOLATION_MESSAGES as description when none is provided", async () => {
    const { result } = renderHook(
      () => useMalpracticeCoordinator(defaultOptions),
      { wrapper: makeWrapper(store) }
    );

    await act(async () => {
      await result.current.flagViolation({ type: "devtools_open" });
    });

    const postedData = mockPost.mock.calls[0][1] as FormData;
    expect(postedData.get("description")).toBe("Developer tools opened");
  });

  it("all two-strike types skip POST on first occurrence", async () => {
    const twoStrikeTypes = [
      "face_absence",
      "multiple_faces",
      "eye_direction",
      "audio_violation",
      "speaking",
      "background_noise",
    ] as const;

    for (const type of twoStrikeTypes) {
      const localStore = makeStore();
      const { result } = renderHook(
        () => useMalpracticeCoordinator(defaultOptions),
        { wrapper: makeWrapper(localStore) }
      );
      await act(async () => {
        await result.current.flagViolation({ type });
      });
      expect(mockPost).not.toHaveBeenCalled();
      mockPost.mockClear();
    }
  });
});
