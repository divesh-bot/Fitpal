import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { generateKeyPair, SignJWT } from "jose";
import { buildTestApp, createTestIssuer, TEST_SUPABASE_URL } from "./helpers.js";
import { FakeStore } from "./fakes/accountRepository.js";
import { createSupabaseTokenVerifier } from "../src/middleware/auth.js";

const USER = "11111111-1111-4111-8111-111111111111";
let issuer: Awaited<ReturnType<typeof createTestIssuer>>;
let app: ReturnType<typeof buildTestApp>;

beforeAll(async () => {
  issuer = await createTestIssuer();
  const store = new FakeStore();
  store.seedUser(USER, "Divesh");
  app = buildTestApp({}, { verifyToken: issuer.verifyToken, repositories: store.factory() });
});

const get = (token?: string, header?: string) => {
  const req = request(app).get("/api/v1/profile");
  if (header !== undefined) return req.set("Authorization", header);
  return token ? req.set("Authorization", `Bearer ${token}`) : req;
};

describe("authentication middleware", () => {
  it("accepts a valid Supabase access token", async () => {
    const res = await get(await issuer.sign({ sub: USER }));
    expect(res.status).toBe(200);
    expect(res.body.data.displayName).toBe("Divesh");
  });

  it("rejects requests with no Authorization header", async () => {
    const res = await get();
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it.each([
    ["wrong scheme", "Basic abc"],
    ["not a JWT", "Bearer not-a-token"],
    ["empty bearer", "Bearer "],
  ])("rejects a malformed header (%s)", async (_label, header) => {
    expect((await get(undefined, header)).status).toBe(401);
  });

  it("rejects an expired token", async () => {
    const token = await issuer.sign({ sub: USER }, { expiresIn: Math.floor(Date.now() / 1000) - 60 });
    expect((await get(token)).status).toBe(401);
  });

  it("rejects a token from another issuer (different Supabase project)", async () => {
    const token = await issuer.sign({ sub: USER }, { issuer: "https://other.supabase.co/auth/v1" });
    expect((await get(token)).status).toBe(401);
  });

  it("rejects a token with the wrong audience", async () => {
    expect((await get(await issuer.sign({ sub: USER }, { audience: "something-else" }))).status).toBe(401);
  });

  it("rejects an anonymous-role token", async () => {
    expect((await get(await issuer.sign({ sub: USER, role: "anon" }))).status).toBe(401);
  });

  it("rejects a token signed with an attacker's key", async () => {
    const { privateKey } = await generateKeyPair("ES256");
    expect((await get(await issuer.sign({ sub: USER }, { key: privateKey }))).status).toBe(401);
  });

  it("rejects a forged HS256 token (algorithm confusion)", async () => {
    const forged = await new SignJWT({ role: "authenticated" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(USER)
      .setIssuer(`${TEST_SUPABASE_URL}/auth/v1`)
      .setAudience("authenticated")
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("guessed-secret-guessed-secret-123"));
    expect((await get(forged)).status).toBe(401);
  });

  it("rejects an unsigned (alg: none) token", async () => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const none = `${b64({ alg: "none" })}.${b64({ sub: USER, role: "authenticated", aud: "authenticated", iss: `${TEST_SUPABASE_URL}/auth/v1`, exp: 9999999999 })}.`;
    expect((await get(none)).status).toBe(401);
  });

  it("rejects a token whose subject is not a UUID", async () => {
    expect((await get(await issuer.sign({ sub: "admin" }))).status).toBe(401);
  });

  it("returns 503 (not 401) when Supabase signing keys cannot be fetched", async () => {
    const unreachable = createSupabaseTokenVerifier("https://127.0.0.1:1"); // nothing listens here
    const offlineApp = buildTestApp({}, { verifyToken: unreachable, repositories: new FakeStore().factory() });
    const token = await issuer.sign({ sub: USER });
    const res = await request(offlineApp).get("/api/v1/profile").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("AUTH_UNAVAILABLE");
  });

  it("protects every /api/v1 route, including unknown ones (no route discovery)", async () => {
    const res = await request(app).get("/api/v1/does-not-exist");
    expect(res.status).toBe(401);
  });
});
