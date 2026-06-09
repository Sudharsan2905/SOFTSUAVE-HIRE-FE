/**
 * authSlice tests — reducers and async thunks.
 *
 * The axios instance and react-hot-toast are mocked so no real HTTP requests
 * are made and no toast DOM nodes are rendered.
 *
 * Strategy:
 *  – Reducer tests dispatch synchronous actions and inspect the resulting state
 *  – Thunk tests dispatch async thunks against a real (but isolated) store and
 *    verify both the state changes and any side-effects (localStorage, toast)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import authReducer, {
  logout,
  setTokens,
  updateUser,
  setAuthData,
  adminLogin,
  candidateLogin,
  googleLogin,
  candidateRegister,
} from "./authSlice";
import { LOCAL_STORAGE_KEYS } from "@/constants/storage";
import { makeAdminUser, makeCandidateUser, makeAuthPayload } from "@/test/mocks";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@/utils/api", () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
  extractApiErrorMessage: (err: unknown, fallback: string): string => {
    if (err && typeof err === "object" && "response" in err) {
      const resp = (err as { response?: { data?: { message?: string } } }).response;
      return resp?.data?.message ?? fallback;
    }
    return fallback;
  },
}));

vi.mock("react-hot-toast", () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

import { api } from "@/utils/api";
import toast from "react-hot-toast";

const mockPost = api.post as ReturnType<typeof vi.fn>;
const mockToastError = toast.error as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStore(preloadedState?: Partial<{ auth: ReturnType<typeof authReducer> }>) {
  return configureStore({
    // @ts-expect-error RTK 2.x preloadedState inference requires undefined in reducer type
    reducer: { auth: authReducer },
    middleware: (g) => g({ serializableCheck: false }),
    ...(preloadedState && { preloadedState }),
  });
}

const adminUser = makeAdminUser();
const candidateUser = makeCandidateUser();
const validPayload = makeAuthPayload(adminUser);

// ---------------------------------------------------------------------------
// Reducers
// ---------------------------------------------------------------------------

describe("authSlice — reducers", () => {
  describe("initial state", () => {
    it("starts unauthenticated when localStorage is empty", () => {
      const state = makeStore().getState().auth;

      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(state.isLoading).toBe(false);
    });

    // NOTE: loadFromStorage() runs once at module-initialisation time (not
    // per-store creation), so localStorage values set after import won't affect
    // the initial Redux state inside the same test file.  Hydration behaviour is
    // covered indirectly via setTokens / setAuthData (which write to storage)
    // and through the logout test (which removes keys from storage).
  });

  // ── logout ────────────────────────────────────────────────────────────────

  describe("logout", () => {
    it("clears user, tokens, and isAuthenticated flag", () => {
      const store = makeStore({
        auth: {
          user: adminUser,
          accessToken: "tok",
          refreshToken: "ref",
          isAuthenticated: true,
          isLoading: false,
        },
      });

      mockPost.mockResolvedValue({}); // best-effort logout API call
      store.dispatch(logout());

      const state = store.getState().auth;
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });

    it("removes all three localStorage keys", () => {
      localStorage.setItem(LOCAL_STORAGE_KEYS.ACCESS_TOKEN, "tok");
      localStorage.setItem(LOCAL_STORAGE_KEYS.REFRESH_TOKEN, "ref");
      localStorage.setItem(LOCAL_STORAGE_KEYS.USER, JSON.stringify(adminUser));

      const store = makeStore({
        auth: {
          user: adminUser,
          accessToken: "tok",
          refreshToken: "ref",
          isAuthenticated: true,
          isLoading: false,
        },
      });

      mockPost.mockResolvedValue({});
      store.dispatch(logout());

      expect(localStorage.getItem(LOCAL_STORAGE_KEYS.ACCESS_TOKEN)).toBeNull();
      expect(localStorage.getItem(LOCAL_STORAGE_KEYS.REFRESH_TOKEN)).toBeNull();
      expect(localStorage.getItem(LOCAL_STORAGE_KEYS.USER)).toBeNull();
    });
  });

  // ── setTokens ─────────────────────────────────────────────────────────────

  describe("setTokens", () => {
    it("updates accessToken in state", () => {
      const store = makeStore();
      store.dispatch(setTokens({ accessToken: "new-token" }));

      expect(store.getState().auth.accessToken).toBe("new-token");
    });

    it("persists the new accessToken to localStorage", () => {
      const store = makeStore();
      store.dispatch(setTokens({ accessToken: "persisted" }));

      expect(localStorage.getItem(LOCAL_STORAGE_KEYS.ACCESS_TOKEN)).toBe("persisted");
    });
  });

  // ── updateUser ────────────────────────────────────────────────────────────

  describe("updateUser", () => {
    it("updates the user in state", () => {
      const store = makeStore();
      store.dispatch(updateUser(adminUser));

      expect(store.getState().auth.user).toEqual(adminUser);
    });

    it("serialises the user to localStorage", () => {
      const store = makeStore();
      store.dispatch(updateUser(adminUser));

      const stored = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.USER) ?? "null");
      expect(stored).toEqual(adminUser);
    });
  });

  // ── setAuthData ───────────────────────────────────────────────────────────

  describe("setAuthData", () => {
    it("sets isAuthenticated, tokens, and user in one go", () => {
      const store = makeStore();
      store.dispatch(setAuthData(validPayload));

      const state = store.getState().auth;
      expect(state.isAuthenticated).toBe(true);
      expect(state.accessToken).toBe(validPayload.access_token);
      expect(state.refreshToken).toBe(validPayload.refresh_token);
      expect(state.user).toEqual(adminUser);
      expect(state.isLoading).toBe(false);
    });

    it("persists all three values to localStorage", () => {
      const store = makeStore();
      store.dispatch(setAuthData(validPayload));

      expect(localStorage.getItem(LOCAL_STORAGE_KEYS.ACCESS_TOKEN)).toBe(
        validPayload.access_token
      );
      expect(localStorage.getItem(LOCAL_STORAGE_KEYS.REFRESH_TOKEN)).toBe(
        validPayload.refresh_token
      );
      expect(JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.USER) ?? "null")).toEqual(
        adminUser
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Async thunks
// ---------------------------------------------------------------------------

describe("authSlice — async thunks", () => {
  beforeEach(() => mockPost.mockReset());

  // ── adminLogin ────────────────────────────────────────────────────────────

  describe("adminLogin", () => {
    it("sets isLoading=true on pending", async () => {
      // Use a deferred so we can check mid-flight state before resolving,
      // avoiding a hanging promise that would cause Vitest to timeout.
      let resolvePost!: (v: unknown) => void;
      mockPost.mockReturnValueOnce(new Promise((r) => { resolvePost = r; }));

      const store = makeStore();
      const dispatchPromise = store.dispatch(adminLogin({ email: "a@b.com", password: "pass" }));

      expect(store.getState().auth.isLoading).toBe(true);

      // Resolve cleanly so the thunk finishes
      resolvePost({ data: { data: validPayload } });
      await dispatchPromise;
    });

    it("authenticates the user on fulfilled", async () => {
      mockPost.mockResolvedValueOnce({ data: { data: validPayload } });
      const store = makeStore();

      await store.dispatch(adminLogin({ email: "a@b.com", password: "secret" }));

      const state = store.getState().auth;
      expect(state.isAuthenticated).toBe(true);
      expect(state.accessToken).toBe(validPayload.access_token);
      expect(state.user).toEqual(adminUser);
      expect(state.isLoading).toBe(false);
    });

    it("sets isLoading=false and calls toast.error on rejected", async () => {
      mockPost.mockRejectedValueOnce({
        response: { data: { message: "Invalid credentials" } },
      });
      const store = makeStore();

      await store.dispatch(adminLogin({ email: "a@b.com", password: "wrong" }));

      expect(store.getState().auth.isLoading).toBe(false);
      expect(mockToastError).toHaveBeenCalledWith("Invalid credentials");
    });

    it("uses the fallback message 'Login failed' when the API sends no message", async () => {
      mockPost.mockRejectedValueOnce({ response: { data: {} } });
      const store = makeStore();

      await store.dispatch(adminLogin({ email: "a@b.com", password: "wrong" }));

      expect(mockToastError).toHaveBeenCalledWith("Login failed");
    });

    it("does not mutate isAuthenticated on failure", async () => {
      mockPost.mockRejectedValueOnce({ response: { data: { message: "Bad" } } });
      const store = makeStore();

      await store.dispatch(adminLogin({ email: "a@b.com", password: "bad" }));

      expect(store.getState().auth.isAuthenticated).toBe(false);
    });
  });

  // ── candidateLogin ────────────────────────────────────────────────────────

  describe("candidateLogin", () => {
    it("authenticates the candidate on fulfilled", async () => {
      const candidatePayload = makeAuthPayload(candidateUser);
      mockPost.mockResolvedValueOnce({ data: { data: candidatePayload } });
      const store = makeStore();

      await store.dispatch(candidateLogin({ email: "c@b.com", password: "pass" }));

      expect(store.getState().auth.isAuthenticated).toBe(true);
      expect(store.getState().auth.user?.role).toBe("candidate");
    });

    it("calls toast.error with API message on rejected", async () => {
      mockPost.mockRejectedValueOnce({
        response: { data: { message: "Candidate not found" } },
      });
      const store = makeStore();

      await store.dispatch(candidateLogin({ email: "c@b.com", password: "bad" }));

      expect(mockToastError).toHaveBeenCalledWith("Candidate not found");
    });
  });

  // ── googleLogin ───────────────────────────────────────────────────────────

  describe("googleLogin", () => {
    it("authenticates via Google credential on fulfilled", async () => {
      mockPost.mockResolvedValueOnce({ data: { data: validPayload } });
      const store = makeStore();

      await store.dispatch(googleLogin("google-id-token"));

      expect(store.getState().auth.isAuthenticated).toBe(true);
    });

    it("falls back to 'Google login failed' when the API sends no message", async () => {
      mockPost.mockRejectedValueOnce({ response: { data: {} } });
      const store = makeStore();

      await store.dispatch(googleLogin("bad-token"));

      expect(mockToastError).toHaveBeenCalledWith("Google login failed");
    });
  });

  // ── candidateRegister ─────────────────────────────────────────────────────

  describe("candidateRegister", () => {
    it("authenticates the new candidate on fulfilled", async () => {
      const candidatePayload = makeAuthPayload(candidateUser);
      mockPost.mockResolvedValueOnce({ data: { data: candidatePayload } });
      const store = makeStore();

      await store.dispatch(
        candidateRegister({
          first_name: "New",
          email: "new@example.com",
          password: "Pass1!word",
        })
      );

      expect(store.getState().auth.isAuthenticated).toBe(true);
    });

    it("falls back to 'Registration failed' when the API sends no message", async () => {
      mockPost.mockRejectedValueOnce({ response: { data: {} } });
      const store = makeStore();

      await store.dispatch(candidateRegister({ email: "bad@b.com" }));

      expect(mockToastError).toHaveBeenCalledWith("Registration failed");
    });
  });
});
