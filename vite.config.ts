import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
    }),
    tailwindcss(),
  ],
  server: {
    proxy: {
      "/trpc": {
        target: process.env.TRPC_TARGET || "http://localhost:3334",
      },
    },
    watch: {
      ignored: [
        "**/node_modules/**",
        "**/temp/**",
        "**/storage/**",
        "**/dist/**",
        "**/dist-server/**",
        "**/.git/**",
      ],
    },
    fs: {
      strict: false,
    },
  },
  optimizeDeps: {
    exclude: ["storage", "temp", "dist-server",  ],
  },
  clearScreen: false,
});
