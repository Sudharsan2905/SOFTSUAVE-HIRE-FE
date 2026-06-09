import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { store } from "@/store";
import { logout, setTokens } from "@/store/slices/authSlice";
import { CONFIG } from "@/constants/config";
import { API_ENDPOINTS } from "@/constants/api";

export const api = axios.create({
  baseURL: CONFIG.API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = store.getState().auth.accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token) => {
              original.headers.Authorization = `Bearer ${token}`;
              resolve(api(original));
            },
            reject,
          });
        });
      }

      original._retry = true;
      isRefreshing = true;

      const refreshToken = store.getState().auth.refreshToken;
      if (!refreshToken) {
        store.dispatch(logout());
        throw error;
      }

      try {
        const { data } = await axios.post(`${CONFIG.API_BASE_URL}${API_ENDPOINTS.AUTH.REFRESH}`, {
          refresh_token: refreshToken,
        });
        const newToken = data.data.access_token;
        store.dispatch(setTokens({ accessToken: newToken }));
        processQueue(null, newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch (refreshError) {
        processQueue(refreshError);
        store.dispatch(logout());
        throw refreshError instanceof Error ? refreshError : new Error(String(refreshError));
      } finally {
        isRefreshing = false;
      }
    }

    throw error;
  }
);

export default api;
