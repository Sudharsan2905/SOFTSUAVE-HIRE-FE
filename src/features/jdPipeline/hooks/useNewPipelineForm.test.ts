import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { newRow, useNewPipelineForm, validateNewPipeline } from "./useNewPipelineForm";

const jd = "x".repeat(30);

describe("useNewPipelineForm", () => {
  it("adds and removes rows but keeps at least one and at most 50", () => {
    const { result } = renderHook(() => useNewPipelineForm());
    expect(result.current.rows).toHaveLength(1);
    act(() => result.current.removeRow(result.current.rows[0].key));
    expect(result.current.rows).toHaveLength(1);
    for (let i = 0; i < 60; i++) act(() => result.current.addRow());
    expect(result.current.rows).toHaveLength(50);
    act(() => result.current.removeRow(result.current.rows[0].key));
    expect(result.current.rows).toHaveLength(49);
  });

  it("updates a row", () => {
    const { result } = renderHook(() => useNewPipelineForm());
    const key = result.current.rows[0].key;
    act(() => result.current.updateRow(key, { description: "a@b.com" }));
    expect(result.current.rows[0].description).toBe("a@b.com");
  });
});

describe("validateNewPipeline", () => {
  const ok = { ...newRow(), description: "someone" };
  it("requires workspace, title, jd and per-row content", () => {
    expect(validateNewPipeline({ title: "t", jdText: jd, rows: [ok] })).toMatch(/workspace/i);
    expect(validateNewPipeline({ workspaceId: "w", title: "", jdText: jd, rows: [ok] })).toMatch(
      /title/i
    );
    expect(
      validateNewPipeline({ workspaceId: "w", title: "t", jdText: "short", rows: [ok] })
    ).toMatch(/job description/i);
    expect(
      validateNewPipeline({ workspaceId: "w", title: "t", jdText: jd, rows: [newRow()] })
    ).toMatch(/Candidate 1/);
    expect(
      validateNewPipeline({ workspaceId: "w", title: "t", jdText: jd, rows: [ok] })
    ).toBeNull();
  });
});
