import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { buildTestApp, createTestIssuer } from "./helpers.js";
import { FakeStore } from "./fakes/accountRepository.js";
import { epley1Rm, exerciseStats } from "../src/services/workoutMath.js";
import { aggregateGroceries, formatQuantity } from "../src/services/grocery.service.js";

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

const push = (date: string, benchKg: number) => ({
  date,
  split: "push",
  durationMin: 40,
  exercises: [
    {
      name: "Bench press",
      sets: [
        { reps: 10, weightKg: 40, isWarmup: true },
        { reps: 8, weightKg: benchKg },
        { reps: 8, weightKg: benchKg },
        { reps: 6, weightKg: benchKg + 2.5 },
      ],
    },
    { name: "Push-ups", sets: [{ reps: 15 }, { reps: 12 }] },
  ],
});

describe("workout maths", () => {
  it("Epley estimated 1RM, rounded to 0.5 kg", () => {
    expect(epley1Rm(60, 8)).toBe(76);
    expect(epley1Rm(100, 1)).toBe(100);
    expect(epley1Rm(0, 10)).toBeNull();
    expect(epley1Rm(60, 0)).toBeNull();
  });

  it("excludes warm-ups from volume, top set and 1RM", () => {
    const s = exerciseStats([
      { reps: 10, weightKg: 40, isWarmup: true },
      { reps: 8, weightKg: 60, isWarmup: false },
      { reps: 6, weightKg: 62.5, isWarmup: false },
    ]);
    expect(s).toEqual({
      workingSets: 2,
      totalReps: 14,
      volumeKg: 855,
      topSet: { weightKg: 62.5, reps: 6 },
      estimated1RmKg: 76,
    });
  });

  it("bodyweight sets count as sets but add no volume", () => {
    expect(exerciseStats([{ reps: 15, weightKg: null, isWarmup: false }])).toMatchObject({
      workingSets: 1,
      volumeKg: 0,
      topSet: null,
      estimated1RmKg: null,
    });
  });
});

describe("workouts API", () => {
  it("logs a PPL session with numbered sets and per-exercise stats", async () => {
    const res = await api(alice).post("/api/v1/workouts", push("2026-11-23", 60));
    expect(res.status).toBe(201);
    const w = res.body.data;
    expect(w).toMatchObject({ date: "2026-11-23", split: "push", durationMin: 40 });
    expect(w.exercises[0].sets.map((s: { setNumber: number }) => s.setNumber)).toEqual([1, 2, 3, 4]);
    expect(w.exercises[0].stats).toMatchObject({ workingSets: 3, topSet: { weightKg: 62.5, reps: 6 } });
    expect(w.totals.workingSets).toBe(5);
  });

  it("history is newest first; edit replaces; delete removes", async () => {
    const a = (await api(alice).post("/api/v1/workouts", push("2026-11-16", 57.5))).body.data;
    await api(alice).post("/api/v1/workouts", push("2026-11-23", 60));
    const list = await api(alice).get("/api/v1/workouts");
    expect(list.body.data.map((w: { date: string }) => w.date)).toEqual(["2026-11-23", "2026-11-16"]);
    const edited = await api(alice).put(`/api/v1/workouts/${a.id}`, {
      ...push("2026-11-16", 57.5),
      split: "legs",
      exercises: [{ name: "Squat", sets: [{ reps: 5, weightKg: 80 }] }],
    });
    expect(edited.body.data).toMatchObject({ split: "legs", exercises: [{ name: "Squat" }] });
    expect((await api(alice).del(`/api/v1/workouts/${a.id}`)).status).toBe(204);
    expect((await api(alice).get(`/api/v1/workouts/${a.id}`)).status).toBe(404);
  });

  it("tracks progression per exercise over sessions (case-insensitive)", async () => {
    await api(alice).post("/api/v1/workouts", push("2026-11-09", 55));
    await api(alice).post("/api/v1/workouts", push("2026-11-16", 57.5));
    await api(alice).post("/api/v1/workouts", push("2026-11-23", 60));
    const res = await api(alice).get("/api/v1/workouts/progression?exercise=bench%20PRESS");
    expect(res.status).toBe(200);
    expect(
      res.body.data.sessions.map((s: { date: string; topSet: { weightKg: number } }) => [s.date, s.topSet.weightKg]),
    ).toEqual([
      ["2026-11-09", 57.5],
      ["2026-11-16", 60],
      ["2026-11-23", 62.5],
    ]);
    // Best estimate across all working sets: 8 × 60 kg → 60 × (1 + 8/30) = 76 (beats 6 × 62.5 kg → 75).
    expect(res.body.data.bestEstimated1RmKg).toBe(76);
    const names = await api(alice).get("/api/v1/workouts/exercises");
    expect(names.body.data).toEqual(["Bench press", "Push-ups"]);
  });

  it("shows on the Today screen for that date", async () => {
    await api(alice).post("/api/v1/workouts", push("2026-11-23", 60));
    const d = await api(alice).get("/api/v1/days/2026-11-23");
    expect(d.body.data.workouts).toEqual([expect.objectContaining({ split: "push", durationMin: 40, exercises: 2 })]);
  });

  it("other users can't see or change my workouts", async () => {
    const w = (await api(alice).post("/api/v1/workouts", push("2026-11-23", 60))).body.data;
    expect((await api(bob).get(`/api/v1/workouts/${w.id}`)).status).toBe(404);
    expect((await api(bob).del(`/api/v1/workouts/${w.id}`)).status).toBe(404);
    expect((await api(bob).get("/api/v1/workouts")).body.data).toHaveLength(0);
  });

  it.each<[object, string]>([
    [{ ...push("2026-11-23", 60), split: "arms" }, "unknown split"],
    [{ ...push("2999-01-01", 60) }, "future date"],
    [{ ...push("2026-11-23", 60), exercises: [] }, "push day with no exercises"],
    [{ ...push("2026-11-23", 60), exercises: [{ name: "x", sets: [{ reps: -1 }] }] }, "negative reps"],
    [{ ...push("2026-11-23", 60), exercises: [{ name: "x", sets: Array(21).fill({ reps: 5 }) }] }, "too many sets"],
  ])("rejects %s", async (body) => {
    expect((await api(alice).post("/api/v1/workouts", body)).status).toBe(422);
  });

  it("a rest day may have no exercises", async () => {
    expect(
      (await api(alice).post("/api/v1/workouts", { date: "2026-11-22", split: "rest", exercises: [] })).status,
    ).toBe(201);
  });
});

describe("grocery maths", () => {
  it("formats quantities", () => {
    expect(formatQuantity(1260, "g")).toBe("1.26 kg");
    expect(formatQuantity(3150, "ml")).toBe("3.15 L");
    expect(formatQuantity(350, "g")).toBe("350 g");
    expect(formatQuantity(5, "egg")).toBe("5 eggs");
    expect(formatQuantity(1, "roti")).toBe("1 roti");
    expect(formatQuantity(7, "cup")).toBe("7 cups");
  });

  it("aggregates a week by food and unit; unmeasured items become 'As needed'", () => {
    const soya = "11111111-1111-4111-8111-111111111111";
    const items = aggregateGroceries(
      [
        { foodItemId: soya, name: "Soya chunks", quantity: 60, unit: "g" },
        { foodItemId: soya, name: "Soya (dry)", quantity: 35, unit: "g" },
        { foodItemId: soya, name: "Soya chunks", quantity: 60, unit: "g" },
        { foodItemId: null, name: "Spices / lemon", quantity: null, unit: null },
        { foodItemId: null, name: "spices / lemon", quantity: null, unit: null },
      ],
      new Map([[soya, "Soya chunks (dry)"]]),
    );
    expect(items).toEqual([
      { name: "Soya chunks (dry)", quantity: 155, unit: "g", quantity_label: "155 g" },
      { name: "Spices / lemon", quantity: null, unit: null, quantity_label: "As needed" },
    ]);
  });
});

describe("grocery API", () => {
  it("creates a list on first use, adds, ticks, unticks all, deletes", async () => {
    let list = (await api(alice).get("/api/v1/grocery-lists/current")).body.data;
    expect(list).toMatchObject({ total: 0, purchased: 0 });
    list = (await api(alice).post("/api/v1/grocery-lists/current/items", { name: "Dish soap" })).body.data;
    const item = list.items[0];
    expect(item).toMatchObject({ name: "Dish soap", quantityLabel: "As needed", source: "custom" });
    await api(alice).put(`/api/v1/grocery-items/${item.id}`, { isPurchased: true, quantityLabel: "1 bottle" });
    list = (await api(alice).get("/api/v1/grocery-lists/current")).body.data;
    expect(list).toMatchObject({ purchased: 1, items: [{ quantityLabel: "1 bottle" }] });
    list = (await api(alice).post("/api/v1/grocery-lists/current/uncheck-all", {})).body.data;
    expect(list.purchased).toBe(0);
    expect((await api(alice).del(`/api/v1/grocery-items/${item.id}`)).status).toBe(204);
  });

  it("generates from the active plan and carries over unpurchased custom items", async () => {
    store.defaultPlan = {
      version: 1,
      name: "Plan",
      days: [
        {
          weekday: 1,
          meals: [
            {
              slot: "lunch",
              title: "L",
              ingredients: [
                { name: "Soya chunks", quantity: 60, unit: "g", qtyLabel: "60 g dry", kcal: 207, proteinG: 31 },
              ],
            },
          ],
        },
        {
          weekday: 3,
          meals: [
            {
              slot: "lunch",
              title: "L",
              ingredients: [
                { name: "Soya chunks", quantity: 60, unit: "g", qtyLabel: "60 g dry", kcal: 207, proteinG: 31 },
              ],
            },
          ],
        },
      ],
    };
    await api(alice).post("/api/v1/meal-plans/active/reset", {});
    await api(alice).post("/api/v1/grocery-lists/current/items", { name: "Dish soap" });
    const res = await api(alice).post("/api/v1/grocery-lists/generate", {});
    expect(res.status).toBe(200);
    expect(
      res.body.data.items.map((i: { name: string; quantityLabel: string; source: string }) => [
        i.name,
        i.quantityLabel,
        i.source,
      ]),
    ).toEqual([
      ["Soya chunks", "120 g", "generated"],
      ["Dish soap", "As needed", "custom"],
    ]);
  });

  it("404 when generating without a plan; other users can't touch my items", async () => {
    expect((await api(bob).post("/api/v1/grocery-lists/generate", {})).status).toBe(404);
    const item = (await api(alice).post("/api/v1/grocery-lists/current/items", { name: "Milk" })).body.data.items[0];
    expect((await api(bob).put(`/api/v1/grocery-items/${item.id}`, { isPurchased: true })).status).toBe(404);
    expect((await api(bob).del(`/api/v1/grocery-items/${item.id}`)).status).toBe(404);
  });
});
