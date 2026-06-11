import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig(() => {
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
        "/api": {
          target: "http://localhost:8000",
          // target: "http://13.236.235.236",
          changeOrigin: true,
          ws: true,
        },
      },
    },
  };
});
