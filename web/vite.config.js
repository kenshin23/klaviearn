import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Klaviearn",
        short_name: "Klaviearn",
        description: "Learn to sight read piano music — accessibility-first.",
        theme_color: "#191621",
        background_color: "#191621",
        display: "standalone",
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            // Fonts keep working offline once seen.
            urlPattern: ({ url }) =>
              url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com",
            handler: "CacheFirst",
            options: { cacheName: "google-fonts", expiration: { maxEntries: 24 } },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: { "/api": "http://localhost:8787" },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: { vexflow: ["vexflow"], react: ["react", "react-dom"] },
      },
    },
  },
});
