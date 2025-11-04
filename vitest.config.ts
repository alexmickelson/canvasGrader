/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/dist-server/**",
      "**/cypress/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/storage/**",
    ],
  },
});
