import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { store } from "@/store";
import { logout, setTokens } from "@/store/slices/authSlice";
import { CONFIG } from "@/constants/config";
import { API_ENDPOINTS } from "@/constants/api";

const API_TIMEOUT_MS = 45_000;
const BEARER_TOKEN_PREFIX = "Bearer";

export function extractApiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    return (err.response?.data as { message?: string })?.message ?? fallback;
  }
  return fallback;
}

export const api = axios.create({
  baseURL: CONFIG.API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: API_TIMEOUT_MS,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = store.getState().auth.accessToken;
  if (token) {
    config.headers.Authorization = `${BEARER_TOKEN_PREFIX} ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((p) => {
    if (error) {
      p.reject(error);
    } else if (token !== null) {
      p.resolve(token);
    }
  });
  failedQueue = [];
};

const REFRESH_ATTEMPTS = 3;
const REFRESH_ATTEMPTS_IN_EXAM = 6;
const REFRESH_BACKOFF_BASE_MS = 1_000;
const REFRESH_BACKOFF_MAX_MS = 15_000;

/** Login / register / refresh endpoints must never trigger the token-refresh flow. */
export function isAuthEndpoint(url: string | undefined): boolean {
  return !!url && /\/auth\/(admin\/login|login|register|refresh|google|logout|setup)/.test(url);
}

function isOnInterviewRoute(): boolean {
  return globalThis.location?.pathname?.includes("/interview/") ?? false;
}

/** True when the refresh endpoint did not give a definitive answer (network / 5xx / throttling). */
function isTransientRefreshFailure(err: unknown): boolean {
  const status = (err as { response?: { status?: number } } | null)?.response?.status;
  return status === undefined || status >= 500 || status === 408 || status === 429;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Exchange the refresh token for a new access token, retrying transient failures with
 * jittered exponential backoff. Resolves with the new token or throws the last error.
 */
async function refreshAccessToken(
  refreshToken: string,
  attempts: number
): Promise<{ accessToken: string; refreshToken?: string }> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const { data } = await axios.post(`${CONFIG.API_BASE_URL}${API_ENDPOINTS.AUTH.REFRESH}`, {
        refresh_token: refreshToken,
      });
      return {
        accessToken: data.data.access_token as string,
        refreshToken: data.data.refresh_token as string | undefined,
      };
    } catch (err) {
      lastErr = err;
      if (!isTransientRefreshFailure(err)) break; // refresh token genuinely rejected
      if (attempt < attempts - 1) {
        const ceiling = Math.min(REFRESH_BACKOFF_BASE_MS * 2 ** attempt, REFRESH_BACKOFF_MAX_MS);
        await sleep(Math.round(ceiling / 2 + Math.random() * (ceiling / 2)));
      }
    }
  }
  throw lastErr;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // A 401 from login/refresh is a real answer, not an expired session.
    if (error.response?.status === 401 && !original._retry && !isAuthEndpoint(original.url)) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token) => {
              original.headers.Authorization = `${BEARER_TOKEN_PREFIX} ${token}`;
              resolve(api(original));
            },
            reject,
          });
        });
      }

      const refreshToken = store.getState().auth.refreshToken;
      if (!refreshToken) {
        // Nothing to refresh with. isRefreshing was never set, so later requests aren't blocked.
        store.dispatch(logout());
        throw error;
      }

      original._retry = true;
      isRefreshing = true;
      const inExam = isOnInterviewRoute();

      try {
        const refreshed = await refreshAccessToken(
          refreshToken,
          inExam ? REFRESH_ATTEMPTS_IN_EXAM : REFRESH_ATTEMPTS
        );
        const newToken = refreshed.accessToken;
        store.dispatch(setTokens({ accessToken: newToken, refreshToken: refreshed.refreshToken }));
        processQueue(null, newToken);
        original.headers.Authorization = `${BEARER_TOKEN_PREFIX} ${newToken}`;
        return api(original);
      } catch (refreshError) {
        processQueue(refreshError);
        // Mid-exam, a refresh that merely could not reach the server must not eject the
        // candidate (that would unmount the interview). Only a definitive rejection logs out.
        if (!(inExam && isTransientRefreshFailure(refreshError))) {
          store.dispatch(logout());
        }
        throw refreshError instanceof Error ? refreshError : new Error(String(refreshError));
      } finally {
        isRefreshing = false;
      }
    }

    throw error;
  }
);

export default api;
