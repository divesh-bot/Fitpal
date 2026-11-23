import { describe, expect, it } from "vitest";
import request from "supertest";
import { buildTestApp } from "./helpers.js";
import { loadEnv } from "../src/config/env.js";

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
  it("returns a structured 404 for unknown routes", async () => {
    const res = await request(buildTestApp()).get("/api/v1/does-not-exist");
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
  it("throttles /api/v1 after the configured limit", async () => {
    const app = buildTestApp({ RATE_LIMIT_MAX: "2" });
    await request(app).get("/api/v1/x");
    await request(app).get("/api/v1/x");
    const res = await request(app).get("/api/v1/x");
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("RATE_LIMITED");
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
    expect(() => loadEnv({ NODE_ENV: "test" })).toThrow(/CORS_ALLOWED_ORIGINS/);
  });

  it("rejects origins that are not http(s) URLs", () => {
    expect(() => loadEnv({ CORS_ALLOWED_ORIGINS: "javascript:alert(1)" })).toThrow(/CORS_ALLOWED_ORIGINS/);
  });

  it("parses a comma-separated origin list and applies defaults", () => {
    const env = loadEnv({ CORS_ALLOWED_ORIGINS: "http://localhost:3000, https://fitpal.example.com" });
    expect(env.CORS_ALLOWED_ORIGINS).toEqual(["http://localhost:3000", "https://fitpal.example.com"]);
    expect(env.PORT).toBe(4000);
  });
});
