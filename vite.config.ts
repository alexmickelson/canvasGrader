import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ["babel-plugin-react-compiler"],
      },
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
      ignored: ["**/temp/**", "**/storage/**", "environments/**"],
    },
  },
  clearScreen: false,
});
