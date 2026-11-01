import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { readFileSync } from "fs";
import { componentTagger } from "lovable-tagger";

// Bake the version from package.json into the build so the app can show it
// in Configurações → Aplicativo — lets the user confirm a device actually
// picked up a given deploy (iOS Safari in particular can hold on to a stale
// cached build for a while).
const { version: appVersion } = JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf-8"));

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
}));
