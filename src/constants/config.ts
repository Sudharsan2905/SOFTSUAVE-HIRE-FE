export const CONFIG = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000",
  WS_URL: import.meta.env.VITE_WS_URL ?? "ws://localhost:8000",
  LIVEKIT_URL: import.meta.env.VITE_LIVEKIT_URL ?? "",
  GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "",
  APP_NAME: import.meta.env.VITE_APP_NAME ?? "SoftSuave Hire",
  IS_PROD: import.meta.env.PROD,
  IS_DEV: import.meta.env.DEV,
} as const;
