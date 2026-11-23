import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTabMonitoring } from "./useTabMonitoring";

function setVisibility(state: "hidden" | "visible") {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("tab-switch flicker counting", () => {
  let nowValue = 0;
  beforeEach(() => {
    vi.useFakeTimers();
    nowValue = 10_000;
    vi.spyOn(performance, "now").mockImplementation(() => nowValue);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    setVisibility("visible");
  });

  const mount = (onTabSwitch = vi.fn()) => {
    renderHook(() =>
      useTabMonitoring({
        enabled: true,
        examActiveRef: { current: true },
        isPermissionFlowActiveRef: { current: false },
        onTabSwitch,
        onFocusViolation: vi.fn(),
      })
    );
    return onTabSwitch;
  };

  function flicker() {
    setVisibility("hidden");
    nowValue += 300;
    vi.advanceTimersByTime(300);
    setVisibility("visible");
    nowValue += 300;
  }

  it("one or two sub-second flickers are tolerated", () => {
    const onTabSwitch = mount();
    flicker();
    flicker();
    vi.advanceTimersByTime(2_000);
    expect(onTabSwitch).not.toHaveBeenCalled();
  });

  it("three quick flickers inside the window count as one tab-switch violation", () => {
    const onTabSwitch = mount();
    flicker();
    flicker();
    flicker();
    expect(onTabSwitch).toHaveBeenCalledTimes(1);
    expect(onTabSwitch.mock.calls[0][0]).toMatch(/repeatedly switched/i);
  });

  it("flickers spread beyond the window do not accumulate", () => {
    const onTabSwitch = mount();
    flicker();
    nowValue += 40_000;
    flicker();
    nowValue += 40_000;
    flicker();
    expect(onTabSwitch).not.toHaveBeenCalled();
  });

  it("a real (>1 s) tab switch still fires immediately as before", () => {
    const onTabSwitch = mount();
    setVisibility("hidden");
    nowValue += 1_100;
    vi.advanceTimersByTime(1_100);
    expect(onTabSwitch).toHaveBeenCalledTimes(1);
  });
});
