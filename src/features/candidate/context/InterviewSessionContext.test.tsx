import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import React from "react";
import {
  InterviewSessionProvider,
  useInterviewSession,
} from "./InterviewSessionContext";

// ── Mock @/store/hooks (useAppSelector) ─────────────────────────────────────
vi.mock("@/store/hooks", () => ({
  useAppSelector: vi.fn((selector: (s: unknown) => unknown) =>
    selector({ auth: { accessToken: "mock-token" } })
  ),
}));

// ── Mock useNetworkMonitoring ────────────────────────────────────────────────
// We keep a reference to the options passed to the hook so individual tests can
// inspect / invoke the forwarded callbacks.
let capturedNetworkOptions: Record<string, unknown> = {};
const mockNetworkResult = {
  networkStatus: "connected" as const,
  isOnline: true,
};

vi.mock("@/features/candidate/hooks/useNetworkMonitoring", () => ({
  useNetworkMonitoring: vi.fn((opts: Record<string, unknown>) => {
    capturedNetworkOptions = opts;
    return mockNetworkResult;
  }),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function Wrapper({ children }: { children: React.ReactNode }) {
  return <InterviewSessionProvider>{children}</InterviewSessionProvider>;
}

function renderSessionHook() {
  return renderHook(() => useInterviewSession(), { wrapper: Wrapper });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("InterviewSessionProvider / useInterviewSession", () => {
  beforeEach(() => {
    capturedNetworkOptions = {};
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── Context value ──────────────────────────────────────────────────────────

  it("provides initial context values", () => {
    const { result } = renderSessionHook();
    expect(result.current.networkStatus).toBe("connected");
    expect(result.current.isOnline).toBe(true);
    expect(result.current.sessionSubmissionId).toBeNull();
    expect(typeof result.current.startSession).toBe("function");
    expect(typeof result.current.registerCallbacks).toBe("function");
  });

  // ── startSession ──────────────────────────────────────────────────────────

  it("startSession updates sessionSubmissionId", () => {
    const { result } = renderSessionHook();
    expect(result.current.sessionSubmissionId).toBeNull();

    act(() => {
      result.current.startSession("sub-123");
    });

    expect(result.current.sessionSubmissionId).toBe("sub-123");
  });

  it("startSession can be called multiple times to update the id", () => {
    const { result } = renderSessionHook();

    act(() => {
      result.current.startSession("sub-abc");
    });
    expect(result.current.sessionSubmissionId).toBe("sub-abc");

    act(() => {
      result.current.startSession("sub-xyz");
    });
    expect(result.current.sessionSubmissionId).toBe("sub-xyz");
  });

  // ── registerCallbacks ─────────────────────────────────────────────────────

  it("registerCallbacks stores the onSessionState callback and forwards it via the hook", () => {
    const { result } = renderSessionHook();

    const onSessionState = vi.fn();
    act(() => {
      result.current.registerCallbacks({ onSessionState });
    });

    // Simulate the network hook invoking onSessionState via the forwarding wrapper
    act(() => {
      (capturedNetworkOptions.onSessionState as (rs: number | null, qi: number) => void)?.(
        120,
        2
      );
    });

    expect(onSessionState).toHaveBeenCalledWith(120, 2);
  });

  it("registerCallbacks stores the onSessionOnHold callback", () => {
    const { result } = renderSessionHook();

    const onSessionOnHold = vi.fn();
    act(() => {
      result.current.registerCallbacks({ onSessionOnHold });
    });

    act(() => {
      (capturedNetworkOptions.onSessionOnHold as () => void)?.();
    });

    expect(onSessionOnHold).toHaveBeenCalled();
  });

  it("registerCallbacks stores the onResumeApproved callback", () => {
    const { result } = renderSessionHook();

    const onResumeApproved = vi.fn();
    act(() => {
      result.current.registerCallbacks({ onResumeApproved });
    });

    act(() => {
      (capturedNetworkOptions.onResumeApproved as (rs: number | null, qi: number) => void)?.(
        90,
        1
      );
    });

    expect(onResumeApproved).toHaveBeenCalledWith(90, 1);
  });

  it("registerCallbacks stores the onTerminated callback", () => {
    const { result } = renderSessionHook();

    const onTerminated = vi.fn();
    act(() => {
      result.current.registerCallbacks({ onTerminated });
    });

    act(() => {
      (capturedNetworkOptions.onTerminated as () => void)?.();
    });

    expect(onTerminated).toHaveBeenCalled();
  });

  it("registerCallbacks stores the onAdminWarning callback", () => {
    const { result } = renderSessionHook();

    const onAdminWarning = vi.fn();
    act(() => {
      result.current.registerCallbacks({ onAdminWarning });
    });

    act(() => {
      (capturedNetworkOptions.onAdminWarning as (msg: string) => void)?.("Test warning");
    });

    expect(onAdminWarning).toHaveBeenCalledWith("Test warning");
  });

  it("registerCallbacks stores the getRemainingSeconds getter", () => {
    const { result } = renderSessionHook();

    const getRemainingSeconds = vi.fn().mockReturnValue(42);
    act(() => {
      result.current.registerCallbacks({ getRemainingSeconds });
    });

    const value = (capturedNetworkOptions.getRemainingSeconds as () => number)?.();
    expect(value).toBe(42);
  });

  it("registerCallbacks stores the getCurrentQuestionIdx getter", () => {
    const { result } = renderSessionHook();

    const getCurrentQuestionIdx = vi.fn().mockReturnValue(3);
    act(() => {
      result.current.registerCallbacks({ getCurrentQuestionIdx });
    });

    const value = (capturedNetworkOptions.getCurrentQuestionIdx as () => number)?.();
    expect(value).toBe(3);
  });

  it("partial registerCallbacks does not overwrite previously registered callbacks", () => {
    const { result } = renderSessionHook();

    const onSessionState = vi.fn();
    const onTerminated = vi.fn();

    act(() => {
      result.current.registerCallbacks({ onSessionState });
    });
    // Register only onTerminated — onSessionState should still be stored
    act(() => {
      result.current.registerCallbacks({ onTerminated });
    });

    act(() => {
      (capturedNetworkOptions.onSessionState as (rs: number | null, qi: number) => void)?.(
        60,
        0
      );
    });
    expect(onSessionState).toHaveBeenCalledWith(60, 0);

    act(() => {
      (capturedNetworkOptions.onTerminated as () => void)?.();
    });
    expect(onTerminated).toHaveBeenCalled();
  });

  // ── Default getter fallbacks ───────────────────────────────────────────────

  it("default getRemainingSeconds returns 0 when not registered", () => {
    renderSessionHook();
    const value = (capturedNetworkOptions.getRemainingSeconds as () => number)?.();
    expect(value).toBe(0);
  });

  it("default getCurrentQuestionIdx returns 0 when not registered", () => {
    renderSessionHook();
    const value = (capturedNetworkOptions.getCurrentQuestionIdx as () => number)?.();
    expect(value).toBe(0);
  });

  // ── Error boundary for missing provider ───────────────────────────────────

  it("throws when useInterviewSession is used outside the provider", () => {
    // Suppress React's error boundary console output
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      renderHook(() => useInterviewSession());
    }).toThrow("useInterviewSession must be used within an InterviewSessionProvider");

    errorSpy.mockRestore();
  });

  // ── Provider renders children ──────────────────────────────────────────────

  it("renders children inside the provider", () => {
    render(
      <InterviewSessionProvider>
        <span data-testid="child">hello</span>
      </InterviewSessionProvider>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });
});
