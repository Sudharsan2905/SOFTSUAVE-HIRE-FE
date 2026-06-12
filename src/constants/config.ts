const _wsProto = globalThis.location.protocol === "https:" ? "wss:" : "ws:";
const _wsBase = `${_wsProto}//${globalThis.location.host}`;

export const CONFIG = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || "",
  WS_URL: import.meta.env.VITE_WS_URL || _wsBase,
  LIVEKIT_URL: import.meta.env.VITE_LIVEKIT_HOST || `${_wsProto}//${globalThis.location.host}/livekit`,
  GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "",
  APP_NAME: import.meta.env.VITE_APP_NAME ?? "SoftSuave Hire",
  IS_PROD: import.meta.env.PROD,
  IS_DEV: import.meta.env.DEV,
} as const;
