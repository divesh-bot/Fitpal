import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { buildTestApp, createTestIssuer } from "./helpers.js";
import { FakeStore } from "./fakes/accountRepository.js";

const ALICE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BOB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MONDAY = "2026-11-23";
const TUESDAY = "2026-11-24";

let store: FakeStore;
let app: ReturnType<typeof buildTestApp>;
let alice: string;
let bob: string;
let paneer: string;

const i = (name: string, kcal: number, proteinG: number) => ({ name, kcal, proteinG });
// Monday exactly as in the prototype's default plan.
const MONDAY_PLAN = {
  version: 1,
  name: "7-Day Plan",
  days: [
    {
      weekday: 1,
      meals: [
        {
          slot: "post_workout",
          title: "Country Delight Protein Milk + Creatine",
          ingredients: [i("Country Delight Protein Milk", 293, 25), i("Creatine monohydrate", 0, 0)],
        },
        {
          slot: "breakfast",
          title: "Overnight Oats & Coffee",
          ingredients: [
            i("Rolled oats", 156, 5),
            i("Greek yogurt", 146, 18),
            i("Banana", 53, 0.7),
            i("Apple", 42, 0.2),
            i("Almonds", 29, 1),
            i("Chia", 24, 0.8),
            i("Cinnamon", 3, 0),
            i("Toned milk", 61, 3),
            i("Sugar", 20, 0),
            i("Coffee", 2, 0),
          ],
        },
        {
          slot: "lunch",
          title: "Soya Curry Rice Bowl",
          ingredients: [
            i("Soya chunks", 207, 31),
            i("Cooked rice", 130, 2.7),
            i("Low-fat curd", 60, 3.5),
            i("Cabbage + cucumber", 40, 1.5),
            i("Oil", 45, 0),
            i("Tomato/onion/spices", 35, 0.8),
          ],
        },
        {
          slot: "dinner",
          title: "Paneer Bhurji with Roti",
          ingredients: [
            i("Low-fat paneer", 210, 27),
            i("Whole-wheat atta", 204, 7),
            i("Mixed vegetables", 60, 3),
            i("Low-fat curd", 60, 3.5),
            i("Oil", 45, 0),
            i("Tomato/onion/spices", 25, 0.5),
          ],
        },
      ],
    },
    { weekday: 2, isStrictVeg: true, meals: [] },
  ],
};

beforeEach(async () => {
  const issuer = await createTestIssuer();
  store = new FakeStore();
  store.seedUser(ALICE);
  store.seedUser(BOB);
  store.defaultPlan = MONDAY_PLAN;
  paneer = store.seedSharedFood({ name: "Low-fat paneer", kcal: 140, protein_g: 18, carbs_g: 3, fat_g: 6 }).id;
  app = buildTestApp({}, { verifyToken: issuer.verifyToken, repositories: store.factory() });
  alice = await issuer.sign({ sub: ALICE });
  bob = await issuer.sign({ sub: BOB });
  await api(alice).post("/api/v1/meal-plans/active/reset", {});
});

const api = (t: string) => ({
  get: (u: string) => request(app).get(u).set("Authorization", `Bearer ${t}`),
  post: (u: string, b: object) => request(app).post(u).set("Authorization", `Bearer ${t}`).send(b),
  put: (u: string, b: object) => request(app).put(u).set("Authorization", `Bearer ${t}`).send(b),
  del: (u: string) => request(app).delete(u).set("Authorization", `Bearer ${t}`),
});
const day = async (t: string, date = MONDAY) => (await api(t).get(`/api/v1/days/${date}`)).body.data;

describe("Today summary", () => {
  it("shows planned vs consumed vs target for a Monday with nothing eaten yet", async () => {
    const d = await day(alice);
    expect(d).toMatchObject({
      dayName: "Monday",
      isStrictVegDay: false,
      target: { caloriesKcal: 2200, proteinG: 160 },
    });
    expect(d.planned).toMatchObject({ kcal: 1950, proteinG: 134.2 });
    expect(d.consumed).toMatchObject({ kcal: 0, proteinG: 0 });
    expect(d.remaining).toEqual({ kcal: 2200, proteinG: 160 });
    expect(d.planMeals.map((m: { slot: string; kcal: number; eaten: boolean }) => [m.slot, m.kcal, m.eaten])).toEqual([
      ["post_workout", 293, false],
      ["breakfast", 536, false],
      ["lunch", 517, false],
      ["dinner", 604, false],
    ]);
    expect(d.habits.map((h: { key: string; done: boolean }) => [h.key, h.done])).toEqual([
      ["creatine", false],
      ["workout", false],
    ]);
    expect(d.steps).toEqual({ count: 0, target: 6000 });
  });

  it("Tuesday is flagged strictly vegetarian", async () => {
    expect((await day(alice, TUESDAY)).isStrictVegDay).toBe(true);
  });

  it("works for a user without a plan (planned is null)", async () => {
    const d = await day(bob);
    expect(d.planned).toBeNull();
    expect(d.planMeals.every((m: { mealId: null }) => m.mealId === null)).toBe(true);
  });
});

describe("ticking planned meals", () => {
  it("ticking post-workout adds 293 kcal / 25 g and also ticks creatine (prototype behaviour)", async () => {
    const res = await api(alice).put(`/api/v1/days/${MONDAY}/plan-meals/post_workout`, { eaten: true });
    expect(res.status).toBe(200);
    expect(res.body.data.consumed).toMatchObject({ kcal: 293, proteinG: 25 });
    expect(res.body.data.progress).toEqual({ kcalPct: 13, proteinPct: 16 });
    expect(res.body.data.habits.find((h: { key: string }) => h.key === "creatine").done).toBe(true);
  });

  it("ticking twice does not double-count; unticking removes it", async () => {
    await api(alice).put(`/api/v1/days/${MONDAY}/plan-meals/lunch`, { eaten: true });
    const twice = await api(alice).put(`/api/v1/days/${MONDAY}/plan-meals/lunch`, { eaten: true });
    expect(twice.body.data.consumed.kcal).toBe(517);
    const off = await api(alice).put(`/api/v1/days/${MONDAY}/plan-meals/lunch`, { eaten: false });
    expect(off.body.data.consumed.kcal).toBe(0);
  });

  it("a ticked meal keeps its logged values when the plan changes afterwards", async () => {
    await api(alice).put(`/api/v1/days/${MONDAY}/plan-meals/dinner`, { eaten: true });
    await api(alice).put("/api/v1/meal-plans/active/days/1/meals/dinner", {
      title: "Lighter dinner",
      ingredients: [i("Salad", 150, 5)],
    });
    const d = await day(alice);
    expect(d.entries.find((e: { mealSlot: string }) => e.mealSlot === "dinner")).toMatchObject({
      name: "Paneer Bhurji with Roti",
      kcal: 604,
    });
    expect(d.planMeals.find((m: { slot: string }) => m.slot === "dinner")).toMatchObject({
      title: "Lighter dinner",
      kcal: 150,
      eaten: true,
    });
  });

  it("404 when nothing is planned in that slot; future dates are rejected", async () => {
    expect((await api(alice).put(`/api/v1/days/${TUESDAY}/plan-meals/lunch`, { eaten: true })).status).toBe(404);
    expect((await api(alice).put("/api/v1/days/2999-01-01/plan-meals/lunch", { eaten: true })).status).toBe(422);
  });
});

describe("snacks", () => {
  async function snackRecipe(kind: "sweet" | "salty", name: string, kcal: number, proteinG: number) {
    const res = await api(alice).post("/api/v1/recipes", {
      name,
      category: `snack_${kind}`,
      ingredients: [i(`${name} (as planned)`, kcal, proteinG)],
    });
    return res.body.data.id as string;
  }

  it("one sweet and one salty snack per day; choosing again replaces; null clears", async () => {
    const makhana = await snackRecipe("salty", "Makhana + Chana", 129, 5);
    const cucumber = await snackRecipe("salty", "Cucumber Chaat", 50, 2);
    const fruit = await snackRecipe("sweet", "Fruit Chaat", 120, 1);

    await api(alice).put(`/api/v1/days/${MONDAY}/snacks/salty`, { recipeId: makhana });
    await api(alice).put(`/api/v1/days/${MONDAY}/snacks/sweet`, { recipeId: fruit });
    let d = (await api(alice).put(`/api/v1/days/${MONDAY}/snacks/salty`, { recipeId: cucumber })).body.data;
    expect(d.snacks.salty).toMatchObject({ name: "Cucumber Chaat", kcal: 50 });
    expect(d.consumed.kcal).toBe(170);

    d = (await api(alice).put(`/api/v1/days/${MONDAY}/snacks/salty`, { recipeId: null })).body.data;
    expect(d.snacks.salty).toBeNull();
    expect(d.consumed.kcal).toBe(120);
  });

  it("rejects a sweet recipe in the salty slot", async () => {
    const fruit = await snackRecipe("sweet", "Fruit Chaat", 120, 1);
    const res = await api(alice).put(`/api/v1/days/${MONDAY}/snacks/salty`, { recipeId: fruit });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("WRONG_SNACK_KIND");
  });
});

describe("food entries", () => {
  it("logs a food by amount with server-side calculation", async () => {
    const res = await api(alice).post("/api/v1/food-entries", {
      source: "food_item",
      date: MONDAY,
      mealSlot: "dinner",
      foodItemId: paneer,
      amount: 150,
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      name: "Low-fat paneer",
      qtyLabel: "150 g",
      kcal: 210,
      proteinG: 27,
      carbsG: 4.5,
      fatG: 9,
    });
  });

  it("logs a recipe by servings", async () => {
    const recipe = await api(alice).post("/api/v1/recipes", {
      name: "Paneer bowl",
      servings: 2,
      ingredients: [{ foodItemId: paneer, amount: 300 }],
    });
    const res = await api(alice).post("/api/v1/food-entries", {
      source: "recipe",
      date: MONDAY,
      recipeId: recipe.body.data.id,
      servings: 1.5,
    });
    expect(res.body.data).toMatchObject({ name: "Paneer bowl", qtyLabel: "1.5 servings", kcal: 315, proteinG: 40.5 });
  });

  it("a retried request with the same clientRequestId is not duplicated", async () => {
    const body = {
      source: "manual",
      date: MONDAY,
      name: "Masala chai",
      kcal: 80,
      proteinG: 2,
      clientRequestId: "6f1c5c1e-4f5a-4a0e-9a59-2f8a3d1d0b11",
    };
    const first = await api(alice).post("/api/v1/food-entries", body);
    const retry = await api(alice).post("/api/v1/food-entries", body);
    expect(first.status).toBe(201);
    expect(retry.status).toBe(200);
    expect(retry.body.data.id).toBe(first.body.data.id);
    expect((await day(alice)).entries).toHaveLength(1);
  });

  it("edits: amount recalculates food entries; manual values only on manual entries", async () => {
    const food = (
      await api(alice).post("/api/v1/food-entries", {
        source: "food_item",
        date: MONDAY,
        foodItemId: paneer,
        amount: 150,
      })
    ).body.data;
    const upd = await api(alice).put(`/api/v1/food-entries/${food.id}`, { amount: 100 });
    expect(upd.body.data).toMatchObject({ qtyLabel: "100 g", kcal: 140, proteinG: 18 });
    const bad = await api(alice).put(`/api/v1/food-entries/${food.id}`, { kcal: 1 });
    expect(bad.status).toBe(422);
    expect(bad.body.error.code).toBe("NOT_EDITABLE");

    const manual = (
      await api(alice).post("/api/v1/food-entries", {
        source: "manual",
        date: MONDAY,
        name: "Chai",
        kcal: 80,
        proteinG: 2,
      })
    ).body.data;
    const fixed = await api(alice).put(`/api/v1/food-entries/${manual.id}`, { kcal: 95, mealSlot: "breakfast" });
    expect(fixed.body.data).toMatchObject({ kcal: 95, mealSlot: "breakfast" });
  });

  it("planned-meal entries can't be edited directly", async () => {
    const d = (await api(alice).put(`/api/v1/days/${MONDAY}/plan-meals/lunch`, { eaten: true })).body.data;
    const res = await api(alice).put(`/api/v1/food-entries/${d.planMeals[2].entryId}`, { name: "x" });
    expect(res.status).toBe(422);
  });

  it("lists by date or range and deletes", async () => {
    const e = (
      await api(alice).post("/api/v1/food-entries", {
        source: "manual",
        date: MONDAY,
        name: "Chai",
        kcal: 80,
        proteinG: 2,
      })
    ).body.data;
    expect((await api(alice).get(`/api/v1/food-entries?date=${MONDAY}`)).body.data).toHaveLength(1);
    expect((await api(alice).get("/api/v1/food-entries?from=2026-11-01&to=2026-11-30")).body.data).toHaveLength(1);
    expect((await api(alice).get("/api/v1/food-entries?from=2026-01-01&to=2026-11-30")).status).toBe(422); // > 31 days
    expect((await api(alice).del(`/api/v1/food-entries/${e.id}`)).status).toBe(204);
  });

  it("other users can't see, edit or delete my entries", async () => {
    const e = (
      await api(alice).post("/api/v1/food-entries", {
        source: "manual",
        date: MONDAY,
        name: "Chai",
        kcal: 80,
        proteinG: 2,
      })
    ).body.data;
    expect((await api(bob).get(`/api/v1/food-entries?date=${MONDAY}`)).body.data).toHaveLength(0);
    expect((await api(bob).put(`/api/v1/food-entries/${e.id}`, { name: "x" })).status).toBe(404);
    expect((await api(bob).del(`/api/v1/food-entries/${e.id}`)).status).toBe(404);
  });

  it.each<[object, string]>([
    [{ source: "manual", date: MONDAY, name: "x", kcal: -1, proteinG: 0 }, "negative kcal"],
    [{ source: "manual", date: "2999-01-01", name: "x", kcal: 1, proteinG: 0 }, "future date"],
    [
      { source: "food_item", date: MONDAY, foodItemId: "99999999-9999-4999-8999-999999999999", amount: 10 },
      "unknown food",
    ],
    [{ source: "plan_meal", date: MONDAY, name: "x", kcal: 1, proteinG: 1 }, "plan meals only via the day endpoint"],
    [{ source: "food_item", date: MONDAY, foodItemId: "x", amount: 10, kcal: 5 }, "extra fields"],
  ])("rejects %j (%s)", async (body) => {
    expect((await api(alice).post("/api/v1/food-entries", body)).status).toBe(422);
  });
});

describe("daily totals and reset", () => {
  it("adds plan meals, snacks and extra foods; reset keeps manually logged foods", async () => {
    await api(alice).put(`/api/v1/days/${MONDAY}/plan-meals/post_workout`, { eaten: true });
    await api(alice).put(`/api/v1/days/${MONDAY}/plan-meals/breakfast`, { eaten: true });
    await api(alice).post("/api/v1/food-entries", {
      source: "manual",
      date: MONDAY,
      name: "Masala chai",
      kcal: 80,
      proteinG: 2,
    });
    await api(alice).put(`/api/v1/checkins/${MONDAY}`, { steps: 4500, weightKg: 97.9 });

    let d = await day(alice);
    expect(d.consumed).toMatchObject({ kcal: 293 + 536 + 80, proteinG: 25 + 28.7 + 2 });
    expect(d.remaining).toEqual({ kcal: 2200 - 909, proteinG: 104.3 });
    expect(d.steps).toEqual({ count: 4500, target: 6000 });

    const nutrition = await api(alice).get(`/api/v1/nutrition/daily?date=${MONDAY}`);
    expect(nutrition.body.data.consumed.kcal).toBe(909);

    d = (await api(alice).post(`/api/v1/days/${MONDAY}/reset`, {})).body.data;
    expect(d.entries.map((e: { name: string }) => e.name)).toEqual(["Masala chai"]);
    expect(d.habits.every((h: { done: boolean }) => !h.done)).toBe(true);
    expect(d.steps.count).toBe(0);
    expect(d.checkin.weightKg).toBe(97.9); // weight is kept
  });

  it("uses the target that was in effect on that date", async () => {
    await api(alice).put("/api/v1/targets/2026-11-24", { caloriesKcal: 2000, proteinG: 165, steps: 7000 });
    expect((await day(alice, MONDAY)).target.caloriesKcal).toBe(2200);
    expect((await day(alice, TUESDAY)).target.caloriesKcal).toBe(2000);
  });
});
