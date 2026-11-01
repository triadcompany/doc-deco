import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  // Keep in sync with vite.config.ts — anything importing a module that
  // references __APP_VERSION__ (e.g. SettingsTab.tsx) needs it defined here too.
  define: {
    __APP_VERSION__: JSON.stringify("test"),
  },
});
