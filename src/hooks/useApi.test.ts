/**
 * useApi hook tests.
 *
 * The axios instance exported from @/utils/api is mocked so network calls
 * never leave the test process. Every test operates on a fresh hook instance
 * rendered with renderHook from RTL.
 *
 * Patterns exercised:
 *  – Initial state
 *  – Success path (data extraction from response.data.data and response.data)
 *  – Error path (message from API response and fallback)
 *  – Loading flag lifecycle
 *  – onSuccess / onError callbacks
 *  – Cancellation: "canceled" error is silently swallowed
 *  – immediate option: auto-fetches on mount
 *  – setData: manual data override
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useApi } from "./useApi";

// ---------------------------------------------------------------------------
// Mock the shared axios instance
// ---------------------------------------------------------------------------

vi.mock("@/utils/api", () => ({
  api: vi.fn(),
}));

import { api } from "@/utils/api";

// Cast once so every test gets typed access
const mockApi = api as unknown as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function silentlySwallowThrow<T>(promise: Promise<T>) {
  return promise.catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useApi", () => {
  beforeEach(() => mockApi.mockReset());

  // ── Initial state ─────────────────────────────────────────────────────────

  describe("initial state", () => {
    it("starts with data=null, isLoading=false, error=null", () => {
      const { result } = renderHook(() => useApi("/test"));

      expect(result.current.data).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("uses initialData when supplied via options", () => {
      const { result } = renderHook(() =>
        useApi<string[]>("/test", undefined, { initialData: ["x", "y"] })
      );

      expect(result.current.data).toEqual(["x", "y"]);
    });

    it("exposes the execute function and setData helper", () => {
      const { result } = renderHook(() => useApi("/test"));

      expect(typeof result.current.execute).toBe("function");
      expect(typeof result.current.setData).toBe("function");
    });
  });

  // ── execute — loading lifecycle ───────────────────────────────────────────

  describe("execute — loading lifecycle", () => {
    it("sets isLoading=true while the request is in flight", () => {
      // Never-resolving promise so we can inspect mid-flight state
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      mockApi.mockReturnValueOnce(new Promise(() => {}));
      const { result } = renderHook(() => useApi("/test"));

      act(() => {
        void result.current.execute();
      });

      expect(result.current.isLoading).toBe(true);
    });

    it("resets isLoading=false after a successful response", async () => {
      mockApi.mockResolvedValueOnce({ data: { data: {} } });
      const { result } = renderHook(() => useApi("/test"));

      await act(() => result.current.execute());

      expect(result.current.isLoading).toBe(false);
    });

    it("resets isLoading=false even after a failed response", async () => {
      mockApi.mockRejectedValueOnce({ response: { data: { message: "Oops" } } });
      const { result } = renderHook(() => useApi("/test"));

      await act(() => silentlySwallowThrow(result.current.execute()));

      expect(result.current.isLoading).toBe(false);
    });
  });

  // ── execute — success path ────────────────────────────────────────────────

  describe("execute — success path", () => {
    it("sets data from response.data.data when present", async () => {
      const payload = { id: 1, name: "Test" };
      mockApi.mockResolvedValueOnce({ data: { data: payload } });

      const { result } = renderHook(() => useApi<typeof payload>("/test"));
      await act(() => result.current.execute());

      expect(result.current.data).toEqual(payload);
      expect(result.current.error).toBeNull();
    });

    it("falls back to response.data when data.data is absent", async () => {
      const payload = [1, 2, 3];
      mockApi.mockResolvedValueOnce({ data: payload });

      const { result } = renderHook(() => useApi<number[]>("/test"));
      await act(() => result.current.execute());

      expect(result.current.data).toEqual(payload);
    });

    it("returns the resolved value from execute()", async () => {
      const payload = { ok: true };
      mockApi.mockResolvedValueOnce({ data: { data: payload } });

      const { result } = renderHook(() => useApi<typeof payload>("/test"));
      let returned: unknown;
      await act(async () => {
        returned = await result.current.execute();
      });

      expect(returned).toEqual(payload);
    });

    it("calls onSuccess callback with the resolved data", async () => {
      const onSuccess = vi.fn();
      const payload = { value: 42 };
      mockApi.mockResolvedValueOnce({ data: { data: payload } });

      const { result } = renderHook(() =>
        useApi<typeof payload>("/test", undefined, { onSuccess })
      );
      await act(() => result.current.execute());

      expect(onSuccess).toHaveBeenCalledWith(payload);
    });
  });

  // ── execute — error path ──────────────────────────────────────────────────

  describe("execute — error path", () => {
    it("sets error to the API response message on failure", async () => {
      mockApi.mockRejectedValueOnce({ response: { data: { message: "Not Found" } } });

      const { result } = renderHook(() => useApi("/test"));
      await act(() => silentlySwallowThrow(result.current.execute()));

      expect(result.current.error).toBe("Not Found");
      expect(result.current.data).toBeNull();
    });

    it("falls back to err.message when response message is absent", async () => {
      mockApi.mockRejectedValueOnce(new Error("Network Error"));

      const { result } = renderHook(() => useApi("/test"));
      await act(() => silentlySwallowThrow(result.current.execute()));

      expect(result.current.error).toBe("Network Error");
    });

    it("uses 'Request failed' when neither API message nor err.message is present", async () => {
      mockApi.mockRejectedValueOnce({});

      const { result } = renderHook(() => useApi("/test"));
      await act(() => silentlySwallowThrow(result.current.execute()));

      expect(result.current.error).toBe("Request failed");
    });

    it("calls onError callback with the error message", async () => {
      const onError = vi.fn();
      mockApi.mockRejectedValueOnce({ response: { data: { message: "Server Error" } } });

      const { result } = renderHook(() => useApi("/test", undefined, { onError }));
      await act(() => silentlySwallowThrow(result.current.execute()));

      expect(onError).toHaveBeenCalledWith("Server Error");
    });

    it("does NOT set error and does NOT call onError when the request is canceled", async () => {
      const onError = vi.fn();
      mockApi.mockRejectedValueOnce(new Error("canceled"));

      const { result } = renderHook(() => useApi("/test", undefined, { onError }));
      await act(() => silentlySwallowThrow(result.current.execute()));

      expect(result.current.error).toBeNull();
      expect(onError).not.toHaveBeenCalled();
    });

    it("clears a previous error on a subsequent successful execute", async () => {
      // First call fails
      mockApi.mockRejectedValueOnce({ response: { data: { message: "Fail" } } });
      const { result } = renderHook(() => useApi("/test"));
      await act(() => silentlySwallowThrow(result.current.execute()));
      expect(result.current.error).toBe("Fail");

      // Second call succeeds
      mockApi.mockResolvedValueOnce({ data: { data: null } });
      await act(() => result.current.execute());
      expect(result.current.error).toBeNull();
    });
  });

  // ── immediate option ──────────────────────────────────────────────────────

  describe("immediate option", () => {
    it("auto-fetches on mount and populates data", async () => {
      const payload = { auto: true };
      mockApi.mockResolvedValueOnce({ data: { data: payload } });

      const { result } = renderHook(() =>
        useApi<typeof payload>("/test", undefined, { immediate: true })
      );

      await waitFor(() => expect(result.current.data).toEqual(payload));
    });

    it("does not auto-fetch when immediate is false (default)", () => {
      mockApi.mockResolvedValue({ data: {} });
      renderHook(() => useApi("/test"));

      expect(mockApi).not.toHaveBeenCalled();
    });
  });

  // ── setData ───────────────────────────────────────────────────────────────

  describe("setData", () => {
    it("allows a manual data update without triggering a network call", () => {
      const { result } = renderHook(() => useApi<string>("/test"));

      act(() => {
        result.current.setData("manual-override");
      });

      expect(result.current.data).toBe("manual-override");
      expect(mockApi).not.toHaveBeenCalled();
    });
  });

  // ── abort / request deduplication ────────────────────────────────────────

  describe("request cancellation", () => {
    it("aborts a pending request when execute is called a second time", async () => {
      // Both calls succeed; we just verify no crash occurs and final state is clean
      mockApi.mockResolvedValue({ data: { data: { seq: 1 } } });

      const { result } = renderHook(() => useApi<{ seq: number }>("/test"));

      act(() => {
        void result.current.execute();
      });
      act(() => {
        void result.current.execute();
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      // No error should be set from the canceled first request
      expect(result.current.error).toBeNull();
    });
  });
});
