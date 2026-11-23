import { pino, type Logger } from "pino";
import type { Env } from "../config/env.js";

/**
 * Structured JSON logger. Sensitive fields are redacted so passwords and
 * tokens can never end up in log files.
 */
export function createLogger(env: Pick<Env, "LOG_LEVEL" | "NODE_ENV">): Logger {
  return pino({
    level: env.LOG_LEVEL,
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        'res.headers["set-cookie"]',
        "*.password",
        "*.access_token",
        "*.refresh_token",
        "*.token",
      ],
      censor: "[REDACTED]",
    },
    ...(env.NODE_ENV === "development"
      ? { transport: { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:HH:MM:ss" } } }
      : {}),
  });
}
