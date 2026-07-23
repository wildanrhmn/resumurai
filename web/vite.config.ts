import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The API runs in the same Express process in production (same-origin /try, /x402).
// In dev/preview there is no bundled backend, so proxy API calls to a running server.
// Default to the local backend (npm run dev in the repo root, :8792); override with
// RESUMURAI_API to point at a deployed instance.
const target = process.env.RESUMURAI_API ?? "http://localhost:8792";
const apiProxy = {
  "/try": { target, changeOrigin: true, secure: false },
  "/x402": { target, changeOrigin: true, secure: false },
  "/artifacts": { target, changeOrigin: true, secure: false },
  "/health": { target, changeOrigin: true, secure: false },
};

export default defineConfig({
  plugins: [react()],
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
  build: { outDir: "dist", target: "es2020" },
});
