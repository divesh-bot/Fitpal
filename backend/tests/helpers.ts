import { pino } from "pino";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/app.js";
import { loadEnv, type Env } from "../src/config/env.js";
import { createSupabaseTokenVerifier, type TokenVerifier } from "../src/middleware/auth.js";
import type { RepositoriesFactory } from "../src/repositories/index.js";

export const TEST_SUPABASE_URL = "https://test-project.supabase.co";

export function testEnv(overrides: Record<string, string> = {}): Env {
  return loadEnv({
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
    CORS_ALLOWED_ORIGINS: "http://localhost:3000",
    SUPABASE_URL: TEST_SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_key_000000000000",
    ...overrides,
  });
}

/** Repositories factory that fails loudly if a test reaches the database unexpectedly. */
const noRepositories: RepositoriesFactory = () => {
  throw new Error("Test did not provide repositories");
};

/** Builds an app instance with test configuration and a silent logger. */
export function buildTestApp(
  overrides: Record<string, string> = {},
  deps: { verifyToken?: TokenVerifier; repositories?: RepositoriesFactory } = {},
) {
  return createApp({
    env: testEnv(overrides),
    logger: pino({ level: "silent" }),
    verifyToken: deps.verifyToken ?? (async () => Promise.reject(new Error("no verifier"))),
    repositories: deps.repositories ?? noRepositories,
  });
}

/**
 * A real ES256 signing key, like Supabase's, so tests exercise genuine
 * signature verification rather than a mock.
 */
export async function createTestIssuer() {
  const { privateKey, publicKey } = await generateKeyPair("ES256", { extractable: true });
  const jwk: JWK = { ...(await exportJWK(publicKey)), kid: "test-key", alg: "ES256", use: "sig" };
  const verifyToken = createSupabaseTokenVerifier(TEST_SUPABASE_URL, createLocalJWKSet({ keys: [jwk] }));

  async function sign(
    claims: Record<string, unknown> = {},
    opts: { expiresIn?: string | number; issuer?: string; audience?: string; key?: CryptoKey } = {},
  ) {
    return new SignJWT({ role: "authenticated", email: "user@example.com", ...claims })
      .setProtectedHeader({ alg: "ES256", kid: "test-key" })
      .setSubject((claims.sub as string) ?? randomUUID())
      .setIssuer(opts.issuer ?? `${TEST_SUPABASE_URL}/auth/v1`)
      .setAudience(opts.audience ?? "authenticated")
      .setIssuedAt()
      .setExpirationTime(opts.expiresIn ?? "1h")
      .sign(opts.key ?? privateKey);
  }

  return { verifyToken, sign };
}
