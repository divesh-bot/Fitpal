import { z } from "zod";

/**
 * Environment configuration, validated once at startup.
 *
 * Values come from the process environment: a local `.env` file in
 * development (loaded by `node --env-file`), or the Render dashboard in
 * production. Secrets must never be hard-coded here.
 */

const csvList = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  )
  .pipe(z.array(z.url({ protocol: /^https?$/ })).min(1, "at least one origin is required"));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),

  /** Comma-separated list of frontend origins allowed to call the API (CORS). */
  CORS_ALLOWED_ORIGINS: csvList,

  /**
   * Number of reverse proxies in front of the app (Render uses one). Needed so
   * rate limiting sees the real client IP rather than the proxy's.
   */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),

  RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    // Report which variables are wrong, never their values (they may be secret).
    const problems = parsed.error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${problems}\nSee backend/.env.example.`);
  }
  return parsed.data;
}
