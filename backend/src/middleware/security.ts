import cors from "cors";
import { rateLimit } from "express-rate-limit";
import type { RequestHandler } from "express";
import type { Env } from "../config/env.js";
import type { ApiErrorBody } from "../types/api.js";

/**
 * CORS: only the configured frontend origins may call the API from a browser.
 * Requests with no Origin header (curl, Render health checks) are allowed —
 * every data endpoint still requires a valid Supabase access token.
 */
export function corsMiddleware(env: Pick<Env, "CORS_ALLOWED_ORIGINS">): RequestHandler {
  const allowed = new Set(env.CORS_ALLOWED_ORIGINS);
  return cors({
    origin(origin, callback) {
      // Returning `false` omits CORS headers, so the browser blocks the response.
      callback(null, origin === undefined || allowed.has(origin));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Authorization", "Content-Type", "Idempotency-Key"],
    maxAge: 600,
  });
}

/** Per-IP rate limit to slow down abuse and brute-force attempts. */
export function rateLimiter(env: Pick<Env, "RATE_LIMIT_WINDOW_MS" | "RATE_LIMIT_MAX">): RequestHandler {
  const body: ApiErrorBody = {
    error: { code: "RATE_LIMITED", message: "Too many requests. Please slow down and try again shortly." },
  };
  return rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.RATE_LIMIT_MAX,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: body,
  });
}
