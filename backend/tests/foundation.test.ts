import { describe, expect, it } from "vitest";
import request from "supertest";
import { buildTestApp, createTestIssuer } from "./helpers.js";
import { FakeStore } from "./fakes/accountRepository.js";
import { loadEnv } from "../src/config/env.js";

const SUPABASE = {
  SUPABASE_URL: "https://x.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_key_000000000000",
};

describe("GET /health", () => {
  it("returns ok in the standard success shape", async () => {
    const res = await request(buildTestApp()).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: "ok", version: "1" });
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("sets security headers and hides the framework", async () => {
    const res = await request(buildTestApp()).get("/health");
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["strict-transport-security"]).toBeDefined();
  });
});

describe("error handling", () => {
  it("returns a structured 404 for unknown routes outside the API", async () => {
    const res = await request(buildTestApp()).get("/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({ code: "NOT_FOUND" });
    expect(res.body.error.requestId).toBeTypeOf("string");
  });

  it("rejects malformed JSON with 400 and no stack trace", async () => {
    const res = await request(buildTestApp())
      .post("/api/v1/anything")
      .set("Content-Type", "application/json")
      .send("{ not json");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
    expect(JSON.stringify(res.body)).not.toMatch(/at .+\.(ts|js):\d+/);
  });
});

describe("CORS", () => {
  it("allows the configured frontend origin", async () => {
    const res = await request(buildTestApp()).get("/health").set("Origin", "http://localhost:3000");
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
  });

  it("does not grant access to other origins", async () => {
    const res = await request(buildTestApp()).get("/health").set("Origin", "https://evil.example.com");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("rate limiting", () => {
  it("throttles anonymous floods per IP at 3× the per-user limit", async () => {
    const app = buildTestApp({ RATE_LIMIT_MAX: "2" });
    for (let i = 0; i < 6; i++) expect((await request(app).get("/api/v1/x")).status).toBe(401);
    const res = await request(app).get("/api/v1/x");
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("RATE_LIMITED");
  });

  it("limits each signed-in user separately, by verified account (not IP)", async () => {
    const issuer = await createTestIssuer();
    const store = new FakeStore();
    const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    store.seedUser(A);
    store.seedUser(B);
    const app = buildTestApp(
      { RATE_LIMIT_MAX: "2" },
      { verifyToken: issuer.verifyToken, repositories: store.factory() },
    );
    const tokenA = await issuer.sign({ sub: A });
    const tokenB = await issuer.sign({ sub: B });
    const get = (t: string) => request(app).get("/api/v1/profile").set("Authorization", `Bearer ${t}`);

    expect((await get(tokenA)).status).toBe(200);
    expect((await get(tokenA)).status).toBe(200);
    const limited = await get(tokenA);
    expect(limited.status).toBe(429);
    // Same IP, different account: unaffected.
    expect((await get(tokenB)).status).toBe(200);
  });

  it("never throttles the health check", async () => {
    const app = buildTestApp({ RATE_LIMIT_MAX: "1" });
    for (let i = 0; i < 3; i++) {
      expect((await request(app).get("/health")).status).toBe(200);
    }
  });
});

describe("environment validation", () => {
  it("fails fast when CORS origins are missing", () => {
    expect(() => loadEnv({ NODE_ENV: "test", ...SUPABASE })).toThrow(/CORS_ALLOWED_ORIGINS/);
  });

  it("fails fast when Supabase settings are missing", () => {
    expect(() => loadEnv({ CORS_ALLOWED_ORIGINS: "http://localhost:3000" })).toThrow(/SUPABASE_URL/);
  });

  it("rejects origins that are not http(s) URLs", () => {
    expect(() => loadEnv({ ...SUPABASE, CORS_ALLOWED_ORIGINS: "javascript:alert(1)" })).toThrow(/CORS_ALLOWED_ORIGINS/);
  });

  it("parses a comma-separated origin list and applies defaults", () => {
    const env = loadEnv({ ...SUPABASE, CORS_ALLOWED_ORIGINS: "http://localhost:3000, https://fitpal.example.com" });
    expect(env.CORS_ALLOWED_ORIGINS).toEqual(["http://localhost:3000", "https://fitpal.example.com"]);
    expect(env.PORT).toBe(4000);
  });
});
