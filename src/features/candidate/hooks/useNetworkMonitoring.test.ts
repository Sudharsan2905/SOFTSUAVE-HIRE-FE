import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNetworkMonitoring } from "./useNetworkMonitoring";

vi.mock("@/constants/app", () => ({
  WS_HEARTBEAT_INTERVAL_MS: 100,
}));

let wsInstances: MockWebSocket[] = [];

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  send = vi.fn();
  close = vi.fn();
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(_url: string) {
    wsInstances.push(this);
  }

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.(new Event("open"));
  }

  simulateClose(code = 1000, reason = "") {
    this.readyState = MockWebSocket.CLOSED;
    const event = new CloseEvent("close", { code, reason, wasClean: code === 1000 });
    this.onclose?.(event);
  }

  simulateMessage(data: object) {
    const event = new MessageEvent("message", { data: JSON.stringify(data) });
    this.onmessage?.(event);
  }

  simulateError() {
    this.onerror?.(new Event("error"));
  }
}

const defaultOptions = {
  submissionId: "sub-1",
  accessToken: "token-abc",
};

describe("useNetworkMonitoring", () => {
  beforeEach(() => {
    wsInstances = [];
    vi.stubGlobal("WebSocket", MockWebSocket);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("starts with isOnline true when navigator.onLine is true", () => {
    const { result } = renderHook(() => useNetworkMonitoring(defaultOptions));
    expect(result.current.isOnline).toBe(true);
  });

  it("creates a WebSocket connection on mount", () => {
    renderHook(() => useNetworkMonitoring(defaultOptions));
    expect(wsInstances).toHaveLength(1);
  });

  it("does not connect when submissionId is missing", () => {
    renderHook(() => useNetworkMonitoring({ submissionId: undefined, accessToken: "token" }));
    expect(wsInstances).toHaveLength(0);
  });

  it("does not connect when accessToken is missing", () => {
    renderHook(() => useNetworkMonitoring({ submissionId: "sub-1", accessToken: null }));
    expect(wsInstances).toHaveLength(0);
  });

  it("sets networkStatus to connected and isOnline true on WebSocket open", () => {
    const { result } = renderHook(() => useNetworkMonitoring(defaultOptions));
    act(() => {
      wsInstances[0].simulateOpen();
    });
    expect(result.current.networkStatus).toBe("connected");
    expect(result.current.isOnline).toBe(true);
  });

  it("sets networkStatus to reconnecting on WebSocket close", () => {
    const { result } = renderHook(() => useNetworkMonitoring(defaultOptions));
    act(() => {
      wsInstances[0].simulateOpen();
    });
    act(() => {
      wsInstances[0].simulateClose(1006);
    });
    expect(result.current.networkStatus).toBe("reconnecting");
  });

  it("handles connected message and calls onSessionState", () => {
    const onSessionState = vi.fn();
    const { result } = renderHook(() =>
      useNetworkMonitoring({ ...defaultOptions, onSessionState })
    );
    act(() => {
      wsInstances[0].simulateOpen();
      wsInstances[0].simulateMessage({
        type: "connected",
        remaining_seconds: 1800,
        current_question_idx: 2,
      });
    });
    expect(result.current.networkStatus).toBe("connected");
    expect(onSessionState).toHaveBeenCalledWith(1800, 2);
  });

  it("handles pong message from server", () => {
    const { result } = renderHook(() => useNetworkMonitoring(defaultOptions));
    act(() => {
      wsInstances[0].simulateOpen();
      wsInstances[0].simulateMessage({ type: "pong" });
    });
    expect(result.current.networkStatus).toBe("connected");
  });

  it("handles on_hold message and calls onSessionOnHold", () => {
    const onSessionOnHold = vi.fn();
    const { result } = renderHook(() =>
      useNetworkMonitoring({ ...defaultOptions, onSessionOnHold })
    );
    act(() => {
      wsInstances[0].simulateOpen();
      wsInstances[0].simulateMessage({ type: "on_hold" });
    });
    expect(result.current.networkStatus).toBe("on_hold");
    expect(onSessionOnHold).toHaveBeenCalledOnce();
  });

  it("handles resume_approved message and calls onResumeApproved", () => {
    const onResumeApproved = vi.fn();
    const { result } = renderHook(() =>
      useNetworkMonitoring({ ...defaultOptions, onResumeApproved })
    );
    act(() => {
      wsInstances[0].simulateOpen();
      wsInstances[0].simulateMessage({
        type: "resume_approved",
        remaining_seconds: 900,
        current_question_idx: 3,
      });
    });
    expect(result.current.networkStatus).toBe("connected");
    expect(onResumeApproved).toHaveBeenCalledWith(900, 3);
  });

  it("handles terminated message and calls onTerminated", () => {
    const onTerminated = vi.fn();
    const { result } = renderHook(() => useNetworkMonitoring({ ...defaultOptions, onTerminated }));
    act(() => {
      wsInstances[0].simulateOpen();
      wsInstances[0].simulateMessage({ type: "terminated" });
    });
    expect(result.current.networkStatus).toBe("offline");
    expect(onTerminated).toHaveBeenCalledOnce();
  });

  it("handles admin_warning message and calls onAdminWarning with message", () => {
    const onAdminWarning = vi.fn();
    renderHook(() => useNetworkMonitoring({ ...defaultOptions, onAdminWarning }));
    act(() => {
      wsInstances[0].simulateOpen();
      wsInstances[0].simulateMessage({ type: "admin_warning", message: "Please focus" });
    });
    expect(onAdminWarning).toHaveBeenCalledWith("Please focus");
  });

  it("ignores admin_warning with no message body", () => {
    const onAdminWarning = vi.fn();
    renderHook(() => useNetworkMonitoring({ ...defaultOptions, onAdminWarning }));
    act(() => {
      wsInstances[0].simulateOpen();
      wsInstances[0].simulateMessage({ type: "admin_warning" });
    });
    expect(onAdminWarning).not.toHaveBeenCalled();
  });

  it("ignores malformed JSON WebSocket messages without crashing", () => {
    const { result } = renderHook(() => useNetworkMonitoring(defaultOptions));
    act(() => {
      wsInstances[0].simulateOpen();
      const badEvent = new MessageEvent("message", { data: "not valid json {{{" });
      wsInstances[0].onmessage?.(badEvent);
    });
    expect(result.current.networkStatus).toBe("connected");
  });

  it("sends heartbeat pings when WebSocket is open", () => {
    const getRemainingSeconds = vi.fn().mockReturnValue(600);
    const getCurrentQuestionIdx = vi.fn().mockReturnValue(1);
    renderHook(() =>
      useNetworkMonitoring({ ...defaultOptions, getRemainingSeconds, getCurrentQuestionIdx })
    );
    act(() => {
      wsInstances[0].simulateOpen();
      vi.advanceTimersByTime(200);
    });
    expect(wsInstances[0].send).toHaveBeenCalledWith(expect.stringContaining('"type":"ping"'));
  });

  it("schedules reconnect after WebSocket close", () => {
    renderHook(() => useNetworkMonitoring(defaultOptions));
    act(() => {
      wsInstances[0].simulateOpen();
      wsInstances[0].simulateClose(1006);
    });
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(wsInstances).toHaveLength(2);
  });

  it("stays on_hold when WebSocket closes while on_hold", () => {
    const { result } = renderHook(() => useNetworkMonitoring(defaultOptions));
    act(() => {
      wsInstances[0].simulateOpen();
      wsInstances[0].simulateMessage({ type: "on_hold" });
    });
    act(() => {
      wsInstances[0].simulateClose(1006);
    });
    expect(result.current.networkStatus).toBe("on_hold");
  });

  it("sets isOnline false and status offline on browser offline event", () => {
    const { result } = renderHook(() => useNetworkMonitoring(defaultOptions));
    act(() => {
      wsInstances[0].simulateOpen();
      globalThis.dispatchEvent(new Event("offline"));
    });
    expect(result.current.isOnline).toBe(false);
    expect(result.current.networkStatus).toBe("offline");
  });

  it("sets isOnline true on browser online event", () => {
    const { result } = renderHook(() => useNetworkMonitoring(defaultOptions));
    act(() => {
      wsInstances[0].simulateOpen();
      globalThis.dispatchEvent(new Event("offline"));
      globalThis.dispatchEvent(new Event("online"));
    });
    expect(result.current.isOnline).toBe(true);
  });

  it("closes WebSocket on unmount", () => {
    const { unmount } = renderHook(() => useNetworkMonitoring(defaultOptions));
    act(() => {
      wsInstances[0].simulateOpen();
    });
    unmount();
    expect(wsInstances[0].close).toHaveBeenCalled();
  });

  it("transitions pong to connected when reconnecting", () => {
    const { result } = renderHook(() => useNetworkMonitoring(defaultOptions));
    act(() => {
      wsInstances[0].simulateOpen();
      wsInstances[0].simulateClose(1006);
    });
    expect(result.current.networkStatus).toBe("reconnecting");
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    act(() => {
      wsInstances[1]?.simulateOpen();
      wsInstances[1]?.simulateMessage({ type: "pong" });
    });
    expect(result.current.networkStatus).toBe("connected");
  });

  it("handles connected message with no session data gracefully", () => {
    const onSessionState = vi.fn();
    const { result } = renderHook(() =>
      useNetworkMonitoring({ ...defaultOptions, onSessionState })
    );
    act(() => {
      wsInstances[0].simulateOpen();
      wsInstances[0].simulateMessage({ type: "connected" });
    });
    expect(result.current.networkStatus).toBe("connected");
    expect(onSessionState).not.toHaveBeenCalled();
  });
});
