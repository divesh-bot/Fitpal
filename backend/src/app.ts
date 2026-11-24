import express, { type Express } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { randomUUID } from "node:crypto";
import type { Logger } from "pino";
import type { Env } from "./config/env.js";
import { getHealth } from "./controllers/health.controller.js";
import { corsMiddleware, rateLimiter } from "./middleware/security.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { createApiRouter } from "./routes/index.js";
import { createSupabaseTokenVerifier, type TokenVerifier } from "./middleware/auth.js";
import { createSupabaseRepositories, type RepositoriesFactory } from "./repositories/index.js";
import { createUserDbFactory } from "./config/supabase.js";

export interface AppDependencies {
  env: Env;
  logger: Logger;
  /** Override in tests; defaults to verifying against Supabase's JWKS. */
  verifyToken?: TokenVerifier;
  /** Override in tests; defaults to Supabase-backed repositories. */
  repositories?: RepositoriesFactory;
}

/**
 * Builds the Express application without starting a server, so tests can
 * exercise it directly with supertest.
 */
export function createApp({ env, logger, verifyToken, repositories }: AppDependencies): Express {
  const app = express();
  const verify = verifyToken ?? createSupabaseTokenVerifier(env.SUPABASE_URL);
  const repos = repositories ?? createSupabaseRepositories(createUserDbFactory(env));

  app.disable("x-powered-by");
  if (env.TRUST_PROXY_HOPS > 0) app.set("trust proxy", env.TRUST_PROXY_HOPS);

  // Request logging with a per-request ID (echoed back in error responses).
  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const id = randomUUID();
        res.setHeader("X-Request-Id", id);
        return id;
      },
      // Keep logs lean: never log bodies (they can contain personal data).
      serializers: {
        req: (req: { id: unknown; method: string; url: string }) => ({ id: req.id, method: req.method, url: req.url }),
      },
    }),
  );

  app.use(helmet());
  app.use(corsMiddleware(env));
  app.use(express.json({ limit: "200kb" }));

  // Health check sits outside the rate limiter so uptime probes never get throttled.
  app.get("/health", getHealth);

  app.use("/api/v1", rateLimiter(env), createApiRouter({ verifyToken: verify, repositories: repos, env }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
