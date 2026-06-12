import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.VITE_PROXY_TARGET || "http://localhost:8000";
  console.log("APITARGET", apiTarget);
  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 5173,
      allowedHosts: ["outsider-curtsy-concert.ngrok-free.dev"],
      proxy: {
        "/api/ws": {
          target: apiTarget.replace(/^https?/, (p) => (p === "https" ? "wss" : "ws")),
          changeOrigin: true,
          ws: true,
        },
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
