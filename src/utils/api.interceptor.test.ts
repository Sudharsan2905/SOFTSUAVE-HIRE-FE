import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

const state = { auth: { accessToken: "old", refreshToken: "refresh-1" as string | null } };
const dispatch = vi.fn();
vi.mock("@/store", () => ({
  store: {
    getState: () => state,
    dispatch: (a: { type: string; payload?: { accessToken?: string } }) => {
      if (a.type === "setTokens" && a.payload?.accessToken) {
        state.auth.accessToken = a.payload.accessToken; // like the real reducer
      }
      return dispatch(a);
    },
  },
}));
vi.mock("@/store/slices/authSlice", () => ({
  logout: () => ({ type: "logout" }),
  setTokens: (p: unknown) => ({ type: "setTokens", payload: p }),
}));

import api, { isAuthEndpoint } from "./api";

/** Adapter that answers 401 until the Authorization header carries the refreshed token. */
function installAdapter() {
  const calls: string[] = [];
  api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    calls.push(String(config.url));
    const auth = String(config.headers.Authorization ?? "");
    const ok = auth.endsWith("new-token") && !isAuthEndpoint(config.url);
    if (ok) return { data: { ok: true }, status: 200, statusText: "OK", headers: {}, config };
    throw new AxiosError("unauthorized", "ERR_BAD_REQUEST", config, null, {
      status: 401,
      data: {},
      statusText: "Unauthorized",
      headers: {},
      config,
    });
  };
  return calls;
}

const refreshOk = () => ({ data: { data: { access_token: "new-token" } } });
const networkError = () => new AxiosError("Network Error");
const http = (status: number) =>
  Object.assign(new AxiosError("x"), { response: { status } }) as AxiosError;

beforeEach(() => {
  vi.useFakeTimers();
  dispatch.mockClear();
  state.auth.refreshToken = "refresh-1";
  state.auth.accessToken = "old";
  globalThis.history.pushState({}, "", "/");
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("isAuthEndpoint", () => {
  it("recognises login/register/refresh endpoints only", () => {
    expect(isAuthEndpoint("/api/auth/login")).toBe(true);
    expect(isAuthEndpoint("/api/auth/admin/login")).toBe(true);
    expect(isAuthEndpoint("/api/auth/refresh")).toBe(true);
    expect(isAuthEndpoint("/api/candidate/submission/1/round")).toBe(false);
    expect(isAuthEndpoint(undefined)).toBe(false);
  });
});

describe("401 handling", () => {
  it("a failed login (401) does not start a refresh and does not wedge later refreshes", async () => {
    installAdapter();
    const post = vi.spyOn(axios, "post").mockResolvedValue(refreshOk());
    await expect(api.post("/api/auth/login", {})).rejects.toBeTruthy();
    expect(post).not.toHaveBeenCalled();
    // A later expired-token request must still refresh normally (flag not stuck).
    const res = await api.get("/api/candidate/x");
    expect(res.data.ok).toBe(true);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("without a refresh token it logs out and never leaves the interceptor locked", async () => {
    installAdapter();
    state.auth.refreshToken = null;
    const post = vi.spyOn(axios, "post");
    await expect(api.get("/api/candidate/x")).rejects.toBeTruthy();
    await expect(api.get("/api/candidate/y")).rejects.toBeTruthy(); // would hang if wedged
    expect(dispatch).toHaveBeenCalledWith({ type: "logout" });
    expect(post).not.toHaveBeenCalled();
  });

  it("retries a transient refresh failure and then succeeds without logging out", async () => {
    installAdapter();
    const post = vi
      .spyOn(axios, "post")
      .mockRejectedValueOnce(networkError())
      .mockRejectedValueOnce(http(503))
      .mockResolvedValue(refreshOk());
    const p = api.get("/api/candidate/x");
    await vi.advanceTimersByTimeAsync(10_000);
    expect((await p).data.ok).toBe(true);
    expect(post).toHaveBeenCalledTimes(3);
    expect(dispatch).not.toHaveBeenCalledWith({ type: "logout" });
  });

  it("a definitive refresh rejection (401) logs out immediately", async () => {
    installAdapter();
    const post = vi.spyOn(axios, "post").mockRejectedValue(http(401));
    await expect(api.get("/api/candidate/x")).rejects.toBeTruthy();
    expect(post).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: "logout" });
  });

  it("mid-exam, a refresh that cannot reach the server never logs the candidate out", async () => {
    installAdapter();
    globalThis.history.pushState({}, "", "/assessment/abc/interview/123");
    const post = vi.spyOn(axios, "post").mockRejectedValue(networkError());
    const p = api.get("/api/candidate/x").catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(120_000);
    await p;
    expect(post.mock.calls.length).toBeGreaterThan(3); // kept retrying
    expect(dispatch).not.toHaveBeenCalledWith({ type: "logout" });
  });
});
