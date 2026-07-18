const _wsProto = globalThis.location.protocol === "https:" ? "wss:" : "ws:";

export const CONFIG = {
  // Empty = axios uses relative URLs; the proxy (Vite dev server or reverse proxy in prod) routes to the backend.
  API_BASE_URL: "",
  WS_URL: `${_wsProto}//${globalThis.location.host}`,
  LIVEKIT_URL: `${_wsProto}//${globalThis.location.host}/livekit`,
  GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "",
  APP_NAME: import.meta.env.VITE_APP_NAME ?? "Talentia",
  IS_PROD: import.meta.env.PROD,
  IS_DEV: import.meta.env.DEV,
} as const;
