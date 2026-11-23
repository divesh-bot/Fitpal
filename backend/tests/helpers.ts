import { pino } from "pino";
import { createApp } from "../src/app.js";
import { loadEnv, type Env } from "../src/config/env.js";

/** Builds an app instance with test configuration and a silent logger. */
export function buildTestApp(overrides: Record<string, string> = {}) {
  const env: Env = loadEnv({
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
    CORS_ALLOWED_ORIGINS: "http://localhost:3000",
    ...overrides,
  });
  return createApp({ env, logger: pino({ level: "silent" }) });
}
