import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("../api/pipelineApi", () => ({ getPipeline: vi.fn() }));
vi.mock("@/utils/api", () => ({
  extractApiErrorMessage: (_e: unknown, fb: string) => fb,
}));

import { getPipeline } from "../api/pipelineApi";
import { usePipelineRun } from "./usePipelineRun";
import type { PipelineRun } from "../types";

const base = {
  id: "p1",
  workspace_id: "w",
  jd_title: "T",
  steps: [],
  events: [],
  candidates: [],
  created_at: null,
  updated_at: null,
};
const run = (status: PipelineRun["status"]) => ({ ...base, status }) as PipelineRun;

describe("usePipelineRun", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(getPipeline).mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it("polls every 2s while running and stops when done", async () => {
    vi.mocked(getPipeline)
      .mockResolvedValueOnce(run("running"))
      .mockResolvedValueOnce(run("running"))
      .mockResolvedValue(run("done"));
    const { result } = renderHook(() => usePipelineRun("p1"));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.run?.status).toBe("running");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(getPipeline).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(result.current.run?.status).toBe("done");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(getPipeline).toHaveBeenCalledTimes(3);
  });

  it("exposes an error message and keeps retrying", async () => {
    vi.mocked(getPipeline).mockRejectedValueOnce(new Error("x")).mockResolvedValue(run("done"));
    const { result } = renderHook(() => usePipelineRun("p1"));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.error).toBe("Failed to load the pipeline.");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(result.current.error).toBeNull();
    expect(result.current.run?.status).toBe("done");
  });
});
