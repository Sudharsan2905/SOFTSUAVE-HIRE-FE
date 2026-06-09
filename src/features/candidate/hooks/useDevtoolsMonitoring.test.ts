import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRef } from "react";
import { useDevtoolsMonitoring } from "./useDevtoolsMonitoring";
import { fireEvent } from "@testing-library/dom";

vi.mock("devtools-detect", () => ({
  default: { isOpen: false, eventName: "devtoolschange" },
}));

function setup(enabled = true, examActive = true) {
  const onViolation = vi.fn();
  const { result, unmount } = renderHook(() => {
    const examActiveRef = useRef(examActive);
    useDevtoolsMonitoring({ enabled, examActiveRef, onViolation });
    return { examActiveRef };
  });
  return { onViolation, result, unmount };
}

beforeEach(() => {
  vi.spyOn(performance, "now").mockReturnValue(0);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useDevtoolsMonitoring", () => {
  it("does not register resize listener when enabled=false", () => {
    const addSpy = vi.spyOn(globalThis, "addEventListener");
    const { unmount } = setup(false);
    const resizeCalls = addSpy.mock.calls.filter((c) => c[0] === "resize");
    expect(resizeCalls).toHaveLength(0);
    unmount();
  });

  it("does not call onViolation when exam is not active (resize fires but guard prevents it)", () => {
    // Even if a resize event fires, the examActiveRef guard prevents violation
    const { onViolation, unmount } = setup(true, false);
    act(() => fireEvent(globalThis as unknown as Window, new Event("resize")));
    expect(onViolation).not.toHaveBeenCalled();
    unmount();
  });

  it("registers a resize listener when enabled", () => {
    const addSpy = vi.spyOn(globalThis, "addEventListener");
    const { unmount } = setup();
    expect(addSpy).toHaveBeenCalledWith("resize", expect.any(Function));
    unmount();
  });

  it("cleans up resize listener on unmount", () => {
    const removeSpy = vi.spyOn(globalThis, "removeEventListener");
    const { unmount } = setup();
    unmount();
    expect(removeSpy).toHaveBeenCalledWith("resize", expect.any(Function));
  });
});
