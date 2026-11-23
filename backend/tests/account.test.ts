import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { buildTestApp, createTestIssuer } from "./helpers.js";
import { FakeStore } from "./fakes/accountRepository.js";

const ALICE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BOB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

let store: FakeStore;
let app: ReturnType<typeof buildTestApp>;
let aliceToken: string;
let bobToken: string;

beforeEach(async () => {
  const issuer = await createTestIssuer();
  store = new FakeStore();
  store.seedUser(ALICE, "Alice");
  store.seedUser(BOB, "Bob");
  app = buildTestApp({}, { verifyToken: issuer.verifyToken, repositories: store.factory() });
  aliceToken = await issuer.sign({ sub: ALICE, email: "alice@example.com" });
  bobToken = await issuer.sign({ sub: BOB });
});

const as = (token: string) => ({
  get: (url: string) => request(app).get(url).set("Authorization", `Bearer ${token}`),
  put: (url: string, body: unknown) =>
    request(app)
      .put(url)
      .set("Authorization", `Bearer ${token}`)
      .send(body as object),
});

describe("profile", () => {
  it("returns the signed-in user's profile with email from the token", async () => {
    const res = await as(aliceToken).get("/api/v1/profile");
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ displayName: "Alice", email: "alice@example.com", goal: "fat_loss" });
  });

  it("updates only the provided fields", async () => {
    const res = await as(aliceToken).put("/api/v1/profile", { heightCm: 173, birthYear: 1999, sex: "male" });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ heightCm: 173, birthYear: 1999, sex: "male", displayName: "Alice" });
  });

  it("each user sees only their own profile", async () => {
    await as(aliceToken).put("/api/v1/profile", { displayName: "Alice Updated" });
    const bob = await as(bobToken).get("/api/v1/profile");
    expect(bob.body.data.displayName).toBe("Bob");
  });

  it("ignores attempts to target another user: unknown fields such as userId/id are rejected", async () => {
    const res = await as(bobToken).put("/api/v1/profile", { id: ALICE, displayName: "Hacked" });
    expect(res.status).toBe(422);
    expect(store.profiles.get(ALICE)!.display_name).toBe("Alice");
  });

  it.each<[object, string]>([
    [{}, "empty body"],
    [{ heightCm: 20 }, "height out of range"],
    [{ birthYear: new Date().getFullYear() }, "birth year too recent"],
    [{ sex: "other-value" }, "invalid enum"],
    [{ timezone: "Mars/Olympus" }, "unknown time zone"],
    [{ displayName: "x".repeat(81) }, "name too long"],
  ])("rejects invalid input: %j (%s)", async (body) => {
    const res = await as(aliceToken).put("/api/v1/profile", body);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("targets (versioned)", () => {
  it("returns the initial 2,200 kcal / 160 g target for any date", async () => {
    const res = await as(aliceToken).get("/api/v1/targets?date=2026-11-23");
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      caloriesKcal: 2200,
      proteinG: 160,
      steps: 6000,
      bmrKcal: 1901,
      tdeeKcal: 2550,
    });
  });

  it("a new target applies from its date onwards without changing history", async () => {
    const put = await as(aliceToken).put("/api/v1/targets/2026-12-01", {
      caloriesKcal: 2100,
      proteinG: 165,
      steps: 7000,
    });
    expect(put.status).toBe(200);

    const before = await as(aliceToken).get("/api/v1/targets?date=2026-11-30");
    const on = await as(aliceToken).get("/api/v1/targets?date=2026-12-01");
    const after = await as(aliceToken).get("/api/v1/targets?date=2027-01-15");
    expect(before.body.data.caloriesKcal).toBe(2200);
    expect(on.body.data.caloriesKcal).toBe(2100);
    expect(after.body.data.caloriesKcal).toBe(2100);

    const history = await as(aliceToken).get("/api/v1/targets/history");
    expect(history.body.data.map((t: { effectiveFrom: string }) => t.effectiveFrom)).toEqual([
      "2026-12-01",
      "1970-01-01",
    ]);
  });

  it("setting targets twice on the same date replaces that version", async () => {
    await as(aliceToken).put("/api/v1/targets/2026-12-01", { caloriesKcal: 2100, proteinG: 165, steps: 7000 });
    await as(aliceToken).put("/api/v1/targets/2026-12-01", { caloriesKcal: 2050, proteinG: 165, steps: 7000 });
    const history = await as(aliceToken).get("/api/v1/targets/history");
    expect(history.body.data).toHaveLength(2);
    expect(history.body.data[0].caloriesKcal).toBe(2050);
  });

  it("another user's targets are unaffected", async () => {
    await as(aliceToken).put("/api/v1/targets/2026-12-01", { caloriesKcal: 1800, proteinG: 150, steps: 8000 });
    const bob = await as(bobToken).get("/api/v1/targets?date=2026-12-02");
    expect(bob.body.data.caloriesKcal).toBe(2200);
  });

  it.each([
    ["/api/v1/targets", "missing date"],
    ["/api/v1/targets?date=23-11-2026", "wrong format"],
    ["/api/v1/targets?date=2026-02-30", "impossible date"],
  ])("rejects %s (%s)", async (url) => {
    expect((await as(aliceToken).get(url)).status).toBe(422);
  });

  it("rejects unsafe targets", async () => {
    const res = await as(aliceToken).put("/api/v1/targets/2026-12-01", {
      caloriesKcal: 300,
      proteinG: 160,
      steps: 6000,
    });
    expect(res.status).toBe(422);
  });

  it("rejects an invalid effective date in the URL", async () => {
    const res = await as(aliceToken).put("/api/v1/targets/tomorrow", {
      caloriesKcal: 2000,
      proteinG: 160,
      steps: 6000,
    });
    expect(res.status).toBe(422);
  });
});

describe("preferences", () => {
  it("returns default dietary rules (whole eggs only, no tofu)", async () => {
    const res = await as(aliceToken).get("/api/v1/preferences");
    expect(res.body.data).toMatchObject({ wholeEggsOnly: true, excludedFoods: ["tofu"] });
  });

  it("normalises and de-duplicates excluded foods", async () => {
    const res = await as(aliceToken).put("/api/v1/preferences", { excludedFoods: ["Tofu", " tofu ", "Mushroom"] });
    expect(res.status).toBe(200);
    expect(res.body.data.excludedFoods).toEqual(["tofu", "mushroom"]);
  });

  it("rejects nested objects in UI settings", async () => {
    const res = await as(aliceToken).put("/api/v1/preferences", { uiSettings: { tab: { nested: true } } });
    expect(res.status).toBe(422);
  });
});
