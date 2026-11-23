import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Tests must never depend on a developer's real .env file.
    env: {
      NODE_ENV: "test",
      LOG_LEVEL: "silent",
      CORS_ALLOWED_ORIGINS: "http://localhost:3000",
    },
  },
});
