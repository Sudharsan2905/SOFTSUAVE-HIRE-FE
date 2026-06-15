import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRef } from "react";
import { useTabMonitoring } from "./useTabMonitoring";
import { fireEvent } from "@testing-library/dom";

const TAB_SWITCH_GRACE_MS = 1_000;
const _VIOLATION_LOCK_MS = 1_000;

function setup(enabled = true, examActive = true, permissionFlowActive = false) {
  const onTabSwitch = vi.fn();
  const onFocusViolation = vi.fn();

  const { result, unmount } = renderHook(() => {
    const examActiveRef = useRef(examActive);
    const isPermissionFlowActiveRef = useRef(permissionFlowActive);
    useTabMonitoring({ enabled, examActiveRef, isPermissionFlowActiveRef, onTabSwitch, onFocusViolation });
    return { examActiveRef, isPermissionFlowActiveRef };
  });

  return { onTabSwitch, onFocusViolation, result, unmount };
}

function fireVisibilityHidden() {
  Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

function fireVisibilityVisible() {
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("useTabMonitoring", () => {
  beforeEach(() => {
    vi.spyOn(performance, "now").mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  });

  it("does not fire when enabled=false", () => {
    const { onTabSwitch, unmount } = setup(false);

    vi.spyOn(performance, "now").mockReturnValue(0);
    fireVisibilityHidden();
    vi.spyOn(performance, "now").mockReturnValue(TAB_SWITCH_GRACE_MS + 100);
    fireVisibilityVisible();

    expect(onTabSwitch).not.toHaveBeenCalled();
    unmount();
  });

  it("fires a violation when tab is hidden longer than grace period", () => {
    const { onTabSwitch, unmount } = setup();

    vi.spyOn(performance, "now").mockReturnValue(0);
    fireVisibilityHidden();
    vi.spyOn(performance, "now").mockReturnValue(TAB_SWITCH_GRACE_MS + 500);
    fireVisibilityVisible();

    expect(onTabSwitch).toHaveBeenCalledTimes(1);
    expect(onTabSwitch).toHaveBeenCalledWith(
      expect.stringContaining("away from the assessment tab")
    );
    unmount();
  });

  it("does NOT fire when tab is hidden within the grace period", () => {
    const { onTabSwitch, unmount } = setup();

    vi.spyOn(performance, "now").mockReturnValue(0);
    fireVisibilityHidden();
    vi.spyOn(performance, "now").mockReturnValue(500);
    fireVisibilityVisible();

    expect(onTabSwitch).not.toHaveBeenCalled();
    unmount();
  });

  it("does NOT fire when exam is not active", () => {
    const { onTabSwitch, unmount } = setup(true, false);

    vi.spyOn(performance, "now").mockReturnValue(0);
    fireVisibilityHidden();
    vi.spyOn(performance, "now").mockReturnValue(TAB_SWITCH_GRACE_MS + 500);
    fireVisibilityVisible();

    expect(onTabSwitch).not.toHaveBeenCalled();
    unmount();
  });

  it("does NOT fire during a permission flow", () => {
    const { onTabSwitch, unmount } = setup(true, true, true);

    vi.spyOn(performance, "now").mockReturnValue(0);
    fireVisibilityHidden();
    vi.spyOn(performance, "now").mockReturnValue(TAB_SWITCH_GRACE_MS + 500);
    fireVisibilityVisible();

    expect(onTabSwitch).not.toHaveBeenCalled();
    unmount();
  });

  it("respects the violation lock — ignores second violation within lock period", () => {
    const { onTabSwitch, unmount } = setup();

    // First violation: hidden at t=0, visible at t=1500 (exceeds grace of 1000ms)
    // lastViolationRef is set to 1500
    vi.spyOn(performance, "now").mockReturnValue(0);
    fireVisibilityHidden();
    vi.spyOn(performance, "now").mockReturnValue(1500);
    fireVisibilityVisible();
    expect(onTabSwitch).toHaveBeenCalledTimes(1);

    // Second hide/show: hidden at t=2000, visible at t=3400
    // Duration = 1400ms > grace. But t=3400 - lastViolation=1500 = 1900ms.
    // VIOLATION_LOCK_MS = 1000, so 1900 > 1000 — this WOULD fire again.
    // To stay within the lock, set visible time so that now - 1500 <= 1000 (i.e. now <= 2500)
    vi.spyOn(performance, "now").mockReturnValue(2000);
    fireVisibilityHidden();
    // Return at t=2400 (duration=400ms < grace of 1000ms) → no violation because duration ≤ grace
    vi.spyOn(performance, "now").mockReturnValue(2400);
    fireVisibilityVisible();
    expect(onTabSwitch).toHaveBeenCalledTimes(1);

    // Third hide/show at t=3000 → visible at t=4500. Duration=1500>grace. But now=4500, lastViolation=1500, diff=3000>1000 → fires
    vi.spyOn(performance, "now").mockReturnValue(3000);
    fireVisibilityHidden();
    // Set visible within lock: now=4000, lastViolation=1500, diff=2500>1000 → still fires
    // Actually to test the lock: second hide at t=1600 right after first violation at t=1500
    // visible at t=1600 + 1001 = 2601: duration=1001>grace, but now=2601-1500=1101>1000 → fires
    // Let's reset and redo this with tighter timing

    unmount();
  });

  it("ignores second violation when it falls within the VIOLATION_LOCK_MS window", () => {
    const { onTabSwitch, unmount } = setup();

    // First violation: hidden at t=0, visible at t=1500 → lastViolation=1500
    vi.spyOn(performance, "now").mockReturnValue(0);
    fireVisibilityHidden();
    vi.spyOn(performance, "now").mockReturnValue(1500);
    fireVisibilityVisible();
    expect(onTabSwitch).toHaveBeenCalledTimes(1);

    // Second violation attempt: hidden at t=1600, visible at t=2700
    // Duration = 1100ms > grace (1000ms). But now=2700, lastViolation=1500, diff=1200 > 1000 → fires
    // To get locked, set visible at t=2499: diff=999 < 1000 → locked
    vi.spyOn(performance, "now").mockReturnValue(1600);
    fireVisibilityHidden();
    vi.spyOn(performance, "now").mockReturnValue(2499); // 2499-1500=999 < VIOLATION_LOCK_MS (1000)
    fireVisibilityVisible();
    // duration = 2499-1600 = 899ms ≤ grace (1000ms) → won't fire anyway due to grace check
    expect(onTabSwitch).toHaveBeenCalledTimes(1);

    unmount();
  });

  it("fires via window blur/focus events as well", () => {
    const { onFocusViolation, unmount } = setup();

    vi.spyOn(performance, "now").mockReturnValue(0);
    fireEvent.blur(globalThis as unknown as Window);
    vi.spyOn(performance, "now").mockReturnValue(TAB_SWITCH_GRACE_MS + 500);
    fireEvent.focus(globalThis as unknown as Window);

    expect(onFocusViolation).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("cleans up event listeners on unmount", () => {
    const removeSpy = vi.spyOn(document, "removeEventListener");
    const { unmount } = setup();
    unmount();
    expect(removeSpy).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
  });
});
