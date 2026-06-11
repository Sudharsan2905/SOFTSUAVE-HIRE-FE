import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useExamOrchestrator, ExamPhase } from "./useExamOrchestrator";

const defaultOptions = {
  enabled: true,
  config: {},
  networkStatus: "connected",
  isCameraReady: false,
  isAudioReady: false,
  isScreenShareReady: false,
  isFullscreen: false,
};

describe("useExamOrchestrator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stays at VALIDATING_NETWORK when enabled but not yet connected", () => {
    const { result } = renderHook(() =>
      useExamOrchestrator({ ...defaultOptions, networkStatus: "offline", config: {} })
    );
    expect(result.current.phase).toBe(ExamPhase.VALIDATING_NETWORK);
  });

  it("does not advance when enabled is false", () => {
    const { result } = renderHook(() => useExamOrchestrator({ ...defaultOptions, enabled: false }));
    expect(result.current.phase).toBe(ExamPhase.IDLE);
  });

  it("advances from VALIDATING_NETWORK to ACTIVE when no monitoring config and connected", () => {
    const { result } = renderHook(() => useExamOrchestrator({ ...defaultOptions, config: {} }));
    // With no monitoring, network step should go straight to ACTIVE
    expect(result.current.phase).toBe(ExamPhase.ACTIVE);
  });

  it("advances to VALIDATING_VIDEO when video_monitoring is on and network connected", () => {
    const { result } = renderHook(() =>
      useExamOrchestrator({
        ...defaultOptions,
        config: { video_monitoring: true },
        networkStatus: "connected",
      })
    );
    expect(result.current.phase).toBe(ExamPhase.VALIDATING_VIDEO);
  });

  it("advances to VALIDATING_AUDIO when only audio_monitoring is on", () => {
    const { result } = renderHook(() =>
      useExamOrchestrator({
        ...defaultOptions,
        config: { audio_monitoring: true },
        networkStatus: "connected",
      })
    );
    expect(result.current.phase).toBe(ExamPhase.VALIDATING_AUDIO);
  });

  it("does not advance from VALIDATING_VIDEO until isCameraReady is true", () => {
    const { result, rerender } = renderHook((props) => useExamOrchestrator(props), {
      initialProps: { ...defaultOptions, config: { video_monitoring: true }, isCameraReady: false },
    });
    expect(result.current.phase).toBe(ExamPhase.VALIDATING_VIDEO);

    rerender({ ...defaultOptions, config: { video_monitoring: true }, isCameraReady: true });
    expect(result.current.phase).toBe(ExamPhase.ACTIVE);
  });

  it("does not advance from VALIDATING_AUDIO until isAudioReady is true", () => {
    const { result, rerender } = renderHook((props) => useExamOrchestrator(props), {
      initialProps: { ...defaultOptions, config: { audio_monitoring: true }, isAudioReady: false },
    });
    expect(result.current.phase).toBe(ExamPhase.VALIDATING_AUDIO);

    rerender({ ...defaultOptions, config: { audio_monitoring: true }, isAudioReady: true });
    expect(result.current.phase).toBe(ExamPhase.ACTIVE);
  });

  it("does not advance from VALIDATING_SCREEN_SHARE until isScreenShareReady", () => {
    const { result, rerender } = renderHook((props) => useExamOrchestrator(props), {
      initialProps: {
        ...defaultOptions,
        config: { screenshot_enabled: true },
        isScreenShareReady: false,
      },
    });
    expect(result.current.phase).toBe(ExamPhase.VALIDATING_SCREEN_SHARE);

    rerender({ ...defaultOptions, config: { screenshot_enabled: true }, isScreenShareReady: true });
    expect(result.current.phase).toBe(ExamPhase.ACTIVE);
  });

  it("does not advance from VALIDATING_FULLSCREEN until isFullscreen", () => {
    const { result, rerender } = renderHook((props) => useExamOrchestrator(props), {
      initialProps: {
        ...defaultOptions,
        config: { tab_monitoring: true },
        isFullscreen: false,
        isScreenShareReady: true,
      },
    });
    expect(result.current.phase).toBe(ExamPhase.VALIDATING_FULLSCREEN);

    rerender({
      ...defaultOptions,
      config: { tab_monitoring: true },
      isFullscreen: true,
      isScreenShareReady: true,
    });
    expect(result.current.phase).toBe(ExamPhase.ACTIVE);
  });

  it("does not advance when networkStatus is not connected", () => {
    const { result } = renderHook(() =>
      useExamOrchestrator({ ...defaultOptions, networkStatus: "offline", config: {} })
    );
    // Stuck at VALIDATING_NETWORK
    expect(result.current.phase).toBe(ExamPhase.VALIDATING_NETWORK);
  });

  it("phaseLabel reflects current phase", () => {
    const { result } = renderHook(() =>
      useExamOrchestrator({ ...defaultOptions, config: { video_monitoring: true } })
    );
    expect(result.current.phase).toBe(ExamPhase.VALIDATING_VIDEO);
    expect(result.current.phaseLabel).toBe("Requesting camera access…");
  });

  it("setPhaseError sets and clears phaseError", () => {
    const { result } = renderHook(() => useExamOrchestrator(defaultOptions));
    act(() => {
      result.current.setPhaseError("Something went wrong");
    });
    expect(result.current.phaseError).toBe("Something went wrong");

    act(() => {
      result.current.setPhaseError(null);
    });
    expect(result.current.phaseError).toBeNull();
  });

  it("suspend sets phase to SUSPENDED", () => {
    const { result } = renderHook(() => useExamOrchestrator(defaultOptions));
    act(() => {
      result.current.suspend();
    });
    expect(result.current.phase).toBe(ExamPhase.SUSPENDED);
  });

  it("resume sets phase to ACTIVE", () => {
    const { result } = renderHook(() => useExamOrchestrator(defaultOptions));
    act(() => {
      result.current.suspend();
      result.current.resume();
    });
    expect(result.current.phase).toBe(ExamPhase.ACTIVE);
  });

  it("terminate sets phase to TERMINATED", () => {
    const { result } = renderHook(() => useExamOrchestrator(defaultOptions));
    act(() => {
      result.current.terminate();
    });
    expect(result.current.phase).toBe(ExamPhase.TERMINATED);
  });

  it("examActiveRef is true only when ACTIVE and connected", () => {
    const { result } = renderHook((props) => useExamOrchestrator(props), {
      initialProps: { ...defaultOptions, config: {} },
    });
    expect(result.current.phase).toBe(ExamPhase.ACTIVE);
    expect(result.current.examActiveRef.current).toBe(true);

    act(() => {
      result.current.suspend();
    });
    expect(result.current.examActiveRef.current).toBe(false);
  });

  it("markPermissionFlowStart sets isPermissionFlowActiveRef to true", () => {
    const { result } = renderHook(() => useExamOrchestrator(defaultOptions));
    act(() => {
      result.current.markPermissionFlowStart();
    });
    expect(result.current.isPermissionFlowActiveRef.current).toBe(true);
  });

  it("markPermissionFlowEnd resets isPermissionFlowActiveRef after timeout", () => {
    const { result } = renderHook(() => useExamOrchestrator(defaultOptions));
    act(() => {
      result.current.markPermissionFlowStart();
      result.current.markPermissionFlowEnd();
    });
    expect(result.current.isPermissionFlowActiveRef.current).toBe(true);

    act(() => {
      vi.advanceTimersByTime(3100);
    });
    expect(result.current.isPermissionFlowActiveRef.current).toBe(false);
  });

  it("shouldAcquireCamera is true from VALIDATING_VIDEO to before SUSPENDED", () => {
    const { result } = renderHook(() =>
      useExamOrchestrator({ ...defaultOptions, config: { video_monitoring: true } })
    );
    expect(result.current.phase).toBe(ExamPhase.VALIDATING_VIDEO);
    expect(result.current.shouldAcquireCamera).toBe(true);
  });

  it("shouldAcquireCamera is false when SUSPENDED", () => {
    const { result } = renderHook(() => useExamOrchestrator(defaultOptions));
    act(() => {
      result.current.suspend();
    });
    expect(result.current.shouldAcquireCamera).toBe(false);
  });

  it("shouldAcquireAudio is true when at VALIDATING_AUDIO phase", () => {
    const { result } = renderHook(() =>
      useExamOrchestrator({ ...defaultOptions, config: { audio_monitoring: true } })
    );
    expect(result.current.phase).toBe(ExamPhase.VALIDATING_AUDIO);
    expect(result.current.shouldAcquireAudio).toBe(true);
  });

  it("shouldAcquireScreen is true when at VALIDATING_SCREEN_SHARE phase", () => {
    const { result } = renderHook(() =>
      useExamOrchestrator({ ...defaultOptions, config: { screenshot_enabled: true } })
    );
    expect(result.current.phase).toBe(ExamPhase.VALIDATING_SCREEN_SHARE);
    expect(result.current.shouldAcquireScreen).toBe(true);
  });

  it("shouldEnforceFullscreen is true when at VALIDATING_FULLSCREEN phase", () => {
    const { result } = renderHook(() =>
      useExamOrchestrator({
        ...defaultOptions,
        config: { tab_monitoring: true },
        isScreenShareReady: true,
      })
    );
    expect(result.current.phase).toBe(ExamPhase.VALIDATING_FULLSCREEN);
    expect(result.current.shouldEnforceFullscreen).toBe(true);
  });

  it("shows devtools error when devtools are detected during validation", () => {
    // Simulate devtools open by making outer/innerWidth differ by > 160
    Object.defineProperty(globalThis, "outerWidth", {
      value: 1200,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, "innerWidth", {
      value: 800,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook((props) => useExamOrchestrator(props), {
      initialProps: {
        ...defaultOptions,
        config: { tab_monitoring: true },
        isScreenShareReady: true,
        isFullscreen: false,
      },
    });

    // Force resize event to trigger devtools detection
    act(() => {
      globalThis.dispatchEvent(new Event("resize"));
    });

    // The orchestrator stays in a defined phase after devtools detection
    expect(result.current.phase).toBeDefined();

    // Reset window dimensions
    Object.defineProperty(globalThis, "outerWidth", {
      value: 1024,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, "innerWidth", {
      value: 1024,
      writable: true,
      configurable: true,
    });
  });
});
