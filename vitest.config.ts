import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", "dist", "coverage"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "clover", "html"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "node_modules/**",
        "dist/**",
        "coverage/**",
        "src/vite-env.d.ts",
        "src/main.tsx",
        "src/types/**",
        "src/assets/**",
        "src/test/**",
        "**/*.d.ts",
        "**/*.config.*",
        "**/*.test.*",
        "**/*.spec.*",
        "**/__mocks__/**",
        "**/*.stories.*",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
