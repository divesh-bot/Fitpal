import type { RequestHandler } from "express";
import { createRemoteJWKSet, errors as joseErrors, jwtVerify, type JWTVerifyGetKey } from "jose";
import { AppError } from "../utils/AppError.js";

/**
 * Authentication middleware.
 *
 * The browser signs in with Supabase Auth and receives a short-lived access
 * token (a JWT). It sends that token on every API call:
 *     Authorization: Bearer <token>
 * We verify the token's signature against Supabase's PUBLIC signing keys
 * (JWKS), plus its issuer, audience and expiry. Only then do we trust the
 * user id inside it. A user id sent in a request body is never trusted.
 */

export interface AuthContext {
  userId: string;
  email?: string;
  /** Raw token, forwarded to Supabase so Row Level Security applies. */
  accessToken: string;
}

export type TokenVerifier = (token: string) => Promise<{ userId: string; email?: string }>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BEARER = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/;

class SigningKeysUnavailable extends Error {}

export function createSupabaseTokenVerifier(supabaseUrl: string, keySet?: JWTVerifyGetKey): TokenVerifier {
  const jwks =
    keySet ??
    createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`), {
      timeoutDuration: 5_000,
      cooldownDuration: 30_000,
      cacheMaxAge: 10 * 60_000,
    });
  const issuer = `${supabaseUrl}/auth/v1`;

  return async (token) => {
    let payload;
    try {
      ({ payload } = await jwtVerify(token, jwks, {
        issuer,
        audience: "authenticated",
        algorithms: ["ES256", "RS256"], // asymmetric only; never accept "none" or shared-secret HS256
        clockTolerance: 5,
      }));
    } catch (err) {
      if (err instanceof joseErrors.JWKSTimeout || err instanceof TypeError) {
        throw new SigningKeysUnavailable("Could not fetch Supabase signing keys");
      }
      throw err;
    }
    if (payload.role !== "authenticated" || typeof payload.sub !== "string" || !UUID.test(payload.sub)) {
      throw new Error("Token is not a signed-in user session");
    }
    return { userId: payload.sub, ...(typeof payload.email === "string" ? { email: payload.email } : {}) };
  };
}

/** Rejects the request with 401 unless it carries a valid Supabase access token. */
export function requireAuth(verify: TokenVerifier): RequestHandler {
  return async (req, _res, next) => {
    const match = BEARER.exec(req.headers.authorization ?? "");
    if (!match?.[1]) {
      next(AppError.unauthorized());
      return;
    }
    const token = match[1];
    try {
      const claims = await verify(token);
      req.auth = { ...claims, accessToken: token };
      next();
    } catch (err) {
      if (err instanceof SigningKeysUnavailable) {
        req.log?.error({ err }, "JWKS unavailable");
        next(new AppError(503, "AUTH_UNAVAILABLE", "Sign-in service is temporarily unavailable. Please try again."));
        return;
      }
      // Log only the reason, never the token.
      req.log?.info(
        { reason: err instanceof Error ? ((err as { code?: string }).code ?? err.name) : "unknown" },
        "Token rejected",
      );
      next(AppError.unauthorized("Your session is invalid or has expired. Please sign in again."));
    }
  };
}

/** For handlers behind requireAuth: returns the verified auth context. */
export function getAuth(req: { auth?: AuthContext }): AuthContext {
  if (!req.auth) throw AppError.unauthorized();
  return req.auth;
}
