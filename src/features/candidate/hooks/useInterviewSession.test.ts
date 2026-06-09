import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useInterviewSession } from "./useInterviewSession";

vi.mock("@/utils/api", () => ({
  default: { get: vi.fn() },
}));
vi.mock("@/constants/api", () => ({
  API_ENDPOINTS: {
    CANDIDATE: {
      SUBMISSION_ROUND: (id: string) => `/candidate/submissions/${id}/round`,
      ASSESSMENT: (link: string) => `/candidate/assessments/${link}`,
    },
  },
}));

import api from "@/utils/api";
const mockGet = (api as unknown as { get: ReturnType<typeof vi.fn> }).get;

const defaultOptions = { submissionId: "sub-1", shareLink: "link-abc" };

function makeRoundResponse(overrides = {}) {
  return {
    data: {
      data: {
        round: {
          round_number: 1,
          questions: [
            { id: "q1", type: "mcq", content: "Question 1?" },
            { id: "q2", type: "mcq", content: "Question 2?" },
          ],
          max_duration_minutes: 30,
        },
        tab_monitoring: false,
        video_monitoring: false,
        audio_monitoring: false,
        screenshot_enabled: false,
        remaining_seconds: 1800,
        current_question_idx: 0,
        ...overrides,
      },
    },
  };
}

function makeAssessmentResponse(rounds = []) {
  return {
    data: {
      data: {
        rounds,
      },
    },
  };
}

const wrapper = ({ children }: { children: React.ReactNode }) => children as React.ReactElement;

describe("useInterviewSession", () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it("starts with isLoading true", () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    mockGet.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useInterviewSession(defaultOptions), { wrapper });
    expect(result.current.isLoading).toBe(true);
  });

  it("loads round data successfully", async () => {
    mockGet
      .mockResolvedValueOnce(makeRoundResponse())
      .mockResolvedValueOnce(makeAssessmentResponse());

    const { result } = renderHook(() => useInterviewSession(defaultOptions), { wrapper });

    await act(async () => {
      await result.current.loadData();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.round).not.toBeNull();
    expect(result.current.round?.round_number).toBe(1);
    expect(result.current.round?.questions).toHaveLength(2);
  });

  it("sets monitoring config from round response", async () => {
    mockGet
      .mockResolvedValueOnce(makeRoundResponse({ tab_monitoring: true, video_monitoring: true }))
      .mockResolvedValueOnce(makeAssessmentResponse());

    const { result } = renderHook(() => useInterviewSession(defaultOptions), { wrapper });

    await act(async () => {
      await result.current.loadData();
    });

    expect(result.current.monitoringConfig.tab_monitoring).toBe(true);
    expect(result.current.monitoringConfig.video_monitoring).toBe(true);
  });

  it("sets remainingSeconds from round response", async () => {
    mockGet
      .mockResolvedValueOnce(makeRoundResponse({ remaining_seconds: 900 }))
      .mockResolvedValueOnce(makeAssessmentResponse());

    const { result } = renderHook(() => useInterviewSession(defaultOptions), { wrapper });

    await act(async () => {
      await result.current.loadData();
    });

    expect(result.current.remainingSeconds).toBe(900);
  });

  it("sets assessment rounds from assessment response", async () => {
    const rounds = [
      { id: "r1", round_number: 1, question_count: 5, max_duration_minutes: 20 },
      { id: "r2", round_number: 2, question_count: 5, max_duration_minutes: 20 },
    ];
    mockGet
      .mockResolvedValueOnce(makeRoundResponse())
      .mockResolvedValueOnce(makeAssessmentResponse(rounds as never[]));

    const { result } = renderHook(() => useInterviewSession(defaultOptions), { wrapper });

    await act(async () => {
      await result.current.loadData();
    });

    expect(result.current.assessmentRounds).toHaveLength(2);
  });

  it("handles API errors gracefully (isLoading becomes false)", async () => {
    mockGet.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useInterviewSession(defaultOptions), { wrapper });

    await act(async () => {
      try {
        await result.current.loadData();
      } catch {
        // loadData has finally but no catch — error propagates; isLoading is still set to false
      }
    });

    expect(result.current.isLoading).toBe(false);
  });

  it("tracks visited questions via markVisited", async () => {
    mockGet
      .mockResolvedValueOnce(makeRoundResponse())
      .mockResolvedValueOnce(makeAssessmentResponse());

    const { result } = renderHook(() => useInterviewSession(defaultOptions), { wrapper });

    await act(async () => {
      await result.current.loadData();
    });

    act(() => {
      result.current.markVisited("q1");
    });

    expect(result.current.visitedQuestions.has("q1")).toBe(true);
    expect(result.current.visitedQuestions.has("q2")).toBe(false);
  });

  it("does not add duplicate to visited questions", async () => {
    mockGet
      .mockResolvedValueOnce(makeRoundResponse())
      .mockResolvedValueOnce(makeAssessmentResponse());

    const { result } = renderHook(() => useInterviewSession(defaultOptions), { wrapper });

    await act(async () => {
      await result.current.loadData();
    });

    act(() => {
      result.current.markVisited("q1");
    });
    const afterFirst = result.current.visitedQuestions;

    act(() => {
      result.current.markVisited("q1");
    });
    // Second call with same id returns same Set reference (no-op)
    expect(result.current.visitedQuestions).toBe(afterFirst);
  });

  it("navigates to a question index", async () => {
    mockGet
      .mockResolvedValueOnce(makeRoundResponse())
      .mockResolvedValueOnce(makeAssessmentResponse());

    const { result } = renderHook(() => useInterviewSession(defaultOptions), { wrapper });

    await act(async () => {
      await result.current.loadData();
    });

    act(() => {
      result.current.navigateTo(1);
    });

    expect(result.current.currentIdx).toBe(1);
    expect(result.current.currentIdxRef.current).toBe(1);
  });

  it("marks current question as visited when navigating away", async () => {
    mockGet
      .mockResolvedValueOnce(makeRoundResponse())
      .mockResolvedValueOnce(makeAssessmentResponse());

    const { result } = renderHook(() => useInterviewSession(defaultOptions), { wrapper });

    await act(async () => {
      await result.current.loadData();
    });

    // Navigate away from question 0 (id = "q1")
    act(() => {
      result.current.navigateTo(1);
    });

    expect(result.current.visitedQuestions.has("q1")).toBe(true);
  });

  it("does not crash when shareLink is empty", async () => {
    mockGet.mockResolvedValue(makeRoundResponse());

    const { result } = renderHook(
      () => useInterviewSession({ submissionId: "sub-1", shareLink: "" }),
      { wrapper }
    );

    await act(async () => {
      await result.current.loadData();
    });

    expect(result.current.isLoading).toBe(false);
  });
});
