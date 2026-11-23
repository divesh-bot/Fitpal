import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { buildTestApp, createTestIssuer } from "./helpers.js";
import { FakeStore } from "./fakes/accountRepository.js";

const ALICE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BOB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

let store: FakeStore;
let app: ReturnType<typeof buildTestApp>;
let alice: string;
let bob: string;

beforeEach(async () => {
  const issuer = await createTestIssuer();
  store = new FakeStore();
  store.seedUser(ALICE);
  store.seedUser(BOB);
  app = buildTestApp({}, { verifyToken: issuer.verifyToken, repositories: store.factory() });
  alice = await issuer.sign({ sub: ALICE });
  bob = await issuer.sign({ sub: BOB });
});

const api = (t: string) => ({
  get: (u: string) => request(app).get(u).set("Authorization", `Bearer ${t}`),
  post: (u: string, b: object) => request(app).post(u).set("Authorization", `Bearer ${t}`).send(b),
  put: (u: string, b: object) => request(app).put(u).set("Authorization", `Bearer ${t}`).send(b),
  del: (u: string) => request(app).delete(u).set("Authorization", `Bearer ${t}`),
});

describe("check-ins", () => {
  it("creates and then partially updates a day's check-in (one row per date)", async () => {
    const first = await api(alice).put("/api/v1/checkins/2026-11-20", {
      weightKg: 98.2,
      sleepHours: 7.5,
      sleepQuality: "good",
      hunger: 5,
      energy: 7,
    });
    expect(first.status).toBe(200);
    const second = await api(alice).put("/api/v1/checkins/2026-11-20", { steps: 6200 });
    expect(second.body.data).toMatchObject({ date: "2026-11-20", weightKg: 98.2, steps: 6200, sleepQuality: "good" });
    expect(store.checkins.filter((c) => c.user_id === ALICE)).toHaveLength(1);
  });

  it("clears a field with null", async () => {
    await api(alice).put("/api/v1/checkins/2026-11-20", { weightKg: 98.2, waistCm: 101 });
    const res = await api(alice).put("/api/v1/checkins/2026-11-20", { waistCm: null });
    expect(res.body.data).toMatchObject({ weightKg: 98.2, waistCm: null });
  });

  it("lists a date range, returns null for an empty day, and deletes", async () => {
    await api(alice).put("/api/v1/checkins/2026-11-20", { weightKg: 98.2 });
    await api(alice).put("/api/v1/checkins/2026-11-21", { weightKg: 98.0 });
    const list = await api(alice).get("/api/v1/checkins?from=2026-11-01&to=2026-11-30");
    expect(list.body.data.map((c: { date: string }) => c.date)).toEqual(["2026-11-20", "2026-11-21"]);
    expect((await api(alice).get("/api/v1/checkins/2026-11-22")).body.data).toBeNull();
    expect((await api(alice).del("/api/v1/checkins/2026-11-20")).status).toBe(204);
    expect((await api(alice).del("/api/v1/checkins/2026-11-20")).status).toBe(404);
  });

  it("keeps users separate", async () => {
    await api(alice).put("/api/v1/checkins/2026-11-20", { weightKg: 98.2 });
    const bobList = await api(bob).get("/api/v1/checkins?from=2026-11-01&to=2026-11-30");
    expect(bobList.body.data).toHaveLength(0);
    expect((await api(bob).del("/api/v1/checkins/2026-11-20")).status).toBe(404);
  });

  it.each<[string, object, string]>([
    ["/api/v1/checkins/2026-11-20", { hunger: 11 }, "hunger above 10"],
    ["/api/v1/checkins/2026-11-20", { weightKg: 10 }, "implausible weight"],
    ["/api/v1/checkins/2026-11-20", {}, "empty body"],
    ["/api/v1/checkins/2026-11-20", { sleepQuality: "amazing" }, "unknown sleep quality"],
    ["/api/v1/checkins/2999-01-01", { weightKg: 90 }, "future date"],
    ["/api/v1/checkins/2026-13-01", { weightKg: 90 }, "invalid date"],
  ])("rejects %s %j (%s)", async (url, body) => {
    expect((await api(alice).put(url, body)).status).toBe(422);
  });

  it("validates list ranges", async () => {
    expect((await api(alice).get("/api/v1/checkins?from=2026-11-30&to=2026-11-01")).status).toBe(422);
    expect((await api(alice).get("/api/v1/checkins?from=2024-01-01&to=2026-11-01")).status).toBe(422);
    expect((await api(alice).get("/api/v1/checkins")).status).toBe(422);
  });
});

describe("weight progress", () => {
  it("returns points with 7-day averages, using earlier data for the first averages", async () => {
    const weights = [98.4, 98.2, 98.5, 98.0, 97.8, 98.1, 97.6, 97.5, 97.7, 97.3, 97.4, 97.2, 97.0, 97.1];
    for (const [i, w] of weights.entries()) {
      await api(alice).put(`/api/v1/checkins/2026-11-${String(i + 1).padStart(2, "0")}`, {
        weightKg: w,
        ...(i % 7 === 0 ? { waistCm: 101 - i / 7 } : {}),
      });
    }
    const res = await api(alice).get("/api/v1/progress/weight?from=2026-11-08&to=2026-11-14");
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.points).toHaveLength(7);
    // avg7 on 11-08 = (98.2 + 98.5 + 98.0 + 97.8 + 98.1 + 97.6 + 97.5) / 7 = 97.96
    expect(d.points[0]).toEqual({ date: "2026-11-08", weightKg: 97.5, avg7: 97.96 });
    expect(d.stats).toMatchObject({ latestAvg7: 97.31, weeklyChangeKg: -0.78 });
    expect(d.waist).toEqual([{ date: "2026-11-08", waistCm: 100 }]);
  });

  it("ignores check-ins without a weight", async () => {
    await api(alice).put("/api/v1/checkins/2026-11-20", { steps: 5000 });
    const res = await api(alice).get("/api/v1/progress/weight?from=2026-11-01&to=2026-11-30");
    expect(res.body.data.stats.entries).toBe(0);
  });
});

describe("habits", () => {
  it("lists the built-in creatine and workout habits", async () => {
    const res = await api(alice).get("/api/v1/habits");
    expect(res.body.data.map((h: { key: string; isSystem: boolean }) => [h.key, h.isSystem])).toEqual([
      ["creatine", true],
      ["workout", true],
    ]);
  });

  it("creates custom habits with unique keys", async () => {
    const a = await api(alice).post("/api/v1/habits", { name: "Drink 3L water" });
    const b = await api(alice).post("/api/v1/habits", { name: "Drink 3L water!" });
    expect(a.status).toBe(201);
    expect(a.body.data).toMatchObject({ key: "drink_3l_water", isSystem: false, position: 3 });
    expect(b.body.data.key).toBe("drink_3l_water_2");
  });

  it("built-in habits can be hidden but not deleted", async () => {
    const creatine = (await api(alice).get("/api/v1/habits")).body.data[0];
    expect((await api(alice).del(`/api/v1/habits/${creatine.id}`)).status).toBe(403);
    const hidden = await api(alice).put(`/api/v1/habits/${creatine.id}`, { isActive: false });
    expect(hidden.body.data.isActive).toBe(false);
    expect((await api(alice).get("/api/v1/habits")).body.data).toHaveLength(1);
    expect((await api(alice).get("/api/v1/habits?includeInactive=true")).body.data).toHaveLength(2);
  });

  it("ticks and unticks a habit for a date", async () => {
    const creatine = (await api(alice).get("/api/v1/habits")).body.data[0];
    await api(alice).put(`/api/v1/habit-logs/${creatine.id}/2026-11-23`, { completed: true });
    await api(alice).put(`/api/v1/habit-logs/${creatine.id}/2026-11-23`, { completed: true }); // idempotent
    let logs = await api(alice).get("/api/v1/habit-logs?from=2026-11-23&to=2026-11-23");
    expect(logs.body.data).toEqual([{ habitId: creatine.id, date: "2026-11-23", completed: true }]);
    await api(alice).put(`/api/v1/habit-logs/${creatine.id}/2026-11-23`, { completed: false });
    logs = await api(alice).get("/api/v1/habit-logs?from=2026-11-23&to=2026-11-23");
    expect(logs.body.data).toEqual([]);
  });

  it("cannot tick another user's habit", async () => {
    const aliceHabit = (await api(alice).get("/api/v1/habits")).body.data[0];
    expect((await api(bob).put(`/api/v1/habit-logs/${aliceHabit.id}/2026-11-23`, { completed: true })).status).toBe(
      404,
    );
    expect((await api(bob).put(`/api/v1/habits/${aliceHabit.id}`, { name: "x" })).status).toBe(404);
  });
});
