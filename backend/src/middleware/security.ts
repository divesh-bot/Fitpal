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
const rateLimitedBody: ApiErrorBody = {
  error: { code: "RATE_LIMITED", message: "Too many requests. Please slow down and try again shortly." },
};

/**
 * Coarse per-IP limit applied BEFORE authentication (3× the per-user limit).
 * It protects against floods of anonymous requests. It depends on the proxy
 * configuration (TRUST_PROXY_HOPS) to see the real client IP.
 */
export function rateLimiter(env: Pick<Env, "RATE_LIMIT_WINDOW_MS" | "RATE_LIMIT_MAX">): RequestHandler {
  return rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.RATE_LIMIT_MAX * 3,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: rateLimitedBody,
  });
}

/**
 * Per-ACCOUNT limit applied AFTER authentication, keyed by the verified user
 * id. Reliable regardless of proxies, shared networks or changing phone IPs.
 */
export function userRateLimiter(env: Pick<Env, "RATE_LIMIT_WINDOW_MS" | "RATE_LIMIT_MAX">): RequestHandler {
  return rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.RATE_LIMIT_MAX,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: rateLimitedBody,
    keyGenerator: (req) => `user:${req.auth?.userId ?? "anonymous"}`,
  });
}
