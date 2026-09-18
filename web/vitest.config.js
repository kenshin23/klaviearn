import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Separate from vite.config.js on purpose: the PWA plugin generates a service
// worker and would run on every test invocation for no benefit.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.js"],
    include: ["src/**/*.test.{js,jsx}"],
    // restoreMocks alone only un-spies; without clearMocks a module-level
    // vi.fn() keeps its call history across tests and assertions on "was it
    // called" silently depend on test order.
    clearMocks: true,
    restoreMocks: true,
  },
});
