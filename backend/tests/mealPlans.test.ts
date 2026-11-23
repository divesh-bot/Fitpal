import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { buildTestApp, createTestIssuer } from "./helpers.js";
import { FakeStore } from "./fakes/accountRepository.js";
import { parseQtyLabel } from "../src/services/mealPlans.service.js";

const ALICE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BOB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

let store: FakeStore;
let app: ReturnType<typeof buildTestApp>;
let alice: string;
let bob: string;
let paneer: string;
let egg: string;

const ing = (name: string, kcal: number, proteinG: number, dietType = "veg") => ({
  name,
  qtyLabel: "",
  kcal,
  proteinG,
  dietType,
});
const DEFAULT_PLAN = {
  version: 1,
  name: "7-Day Plan",
  days: [
    {
      weekday: 1,
      meals: [
        {
          slot: "lunch",
          title: "Soya Curry Rice Bowl",
          ingredients: [ing("Soya chunks", 207, 31), ing("Cooked rice", 130, 2.7)],
        },
      ],
    },
    {
      weekday: 2,
      isStrictVeg: true,
      meals: [{ slot: "lunch", title: "Moong Dal Rice", ingredients: [ing("Moong dal", 174, 12)] }],
    },
    { weekday: 5, meals: [{ slot: "lunch", title: "Egg Bhurji", ingredients: [ing("Whole eggs", 144, 12.6, "egg")] }] },
  ],
};

beforeEach(async () => {
  const issuer = await createTestIssuer();
  store = new FakeStore();
  store.seedUser(ALICE);
  store.seedUser(BOB);
  store.defaultPlan = DEFAULT_PLAN;
  paneer = store.seedSharedFood({ name: "Low-fat paneer", kcal: 140, protein_g: 18, carbs_g: 3, fat_g: 6 }).id;
  egg = store.seedSharedFood({
    name: "Whole egg (large)",
    basis: "per_unit",
    unit_label: "egg",
    kcal: 72,
    protein_g: 6.3,
    diet_type: "egg",
  }).id;
  app = buildTestApp({}, { verifyToken: issuer.verifyToken, repositories: store.factory() });
  alice = await issuer.sign({ sub: ALICE });
  bob = await issuer.sign({ sub: BOB });
  await api(alice).post("/api/v1/meal-plans/active/reset", {});
});

const api = (t: string) => ({
  get: (u: string) => request(app).get(u).set("Authorization", `Bearer ${t}`),
  post: (u: string, b: object) => request(app).post(u).set("Authorization", `Bearer ${t}`).send(b),
  put: (u: string, b: object) => request(app).put(u).set("Authorization", `Bearer ${t}`).send(b),
  patch: (u: string, b: object) => request(app).patch(u).set("Authorization", `Bearer ${t}`).send(b),
  del: (u: string) => request(app).delete(u).set("Authorization", `Bearer ${t}`),
});
const P = "/api/v1/meal-plans/active";

describe("GET active plan", () => {
  it("returns 7 ordered days with names, meals, totals and the veg flag", async () => {
    const res = await api(alice).get(P);
    expect(res.status).toBe(200);
    const days = res.body.data.days;
    expect(days.map((d: { dayName: string }) => d.dayName)).toEqual([
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ]);
    expect(days[0].meals[0]).toMatchObject({ title: "Soya Curry Rice Bowl", totals: { kcal: 337, proteinG: 33.7 } });
    expect(days[0].plannedTotals).toMatchObject({ kcal: 337 });
    expect(days[1].isStrictVeg).toBe(true);
    expect(days[4].meals[0].dietType).toBe("egg");
  });

  it("404 with guidance when the user has no plan", async () => {
    const res = await api(bob).get(P);
    expect(res.status).toBe(404);
    expect(res.body.error.message).toMatch(/Reset to the default plan/);
  });
});

describe("editing meals", () => {
  it("saves a meal with food-linked ingredients calculated server-side", async () => {
    const res = await api(alice).put(`${P}/days/1/meals/dinner`, {
      title: "Paneer Bhurji with Roti",
      ingredients: [
        { foodItemId: paneer, amount: 150 },
        { name: "Whole-wheat atta", qtyLabel: "60 g", kcal: 204, proteinG: 7 },
      ],
    });
    expect(res.status).toBe(200);
    const dinner = res.body.data.days[0].meals.find((m: { slot: string }) => m.slot === "dinner");
    expect(dinner.totals).toMatchObject({ kcal: 414, proteinG: 34 });
    expect(res.body.data.days[0].meals.map((m: { slot: string }) => m.slot)).toEqual(["lunch", "dinner"]);
  });

  it("blocks eggs on strictly-vegetarian Tuesday", async () => {
    const res = await api(alice).put(`${P}/days/2/meals/dinner`, {
      title: "Omelette",
      ingredients: [{ foodItemId: egg, amount: 3 }],
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("STRICT_VEG_VIOLATION");
    expect(res.body.error.message).toMatch(/Tuesday/);
  });

  it("blocks a manual 'veg' item that is actually chicken on Tuesday", async () => {
    const res = await api(alice).put(`${P}/days/2/meals/dinner`, {
      title: "Sneaky",
      ingredients: [{ name: "Chicken breast", kcal: 180, proteinG: 33, dietType: "veg" }],
    });
    expect(res.status).toBe(422);
  });

  it("clears a slot", async () => {
    const res = await api(alice).del(`${P}/days/1/meals/lunch`);
    expect(res.status).toBe(200);
    expect(res.body.data.days[0].meals).toHaveLength(0);
    expect((await api(alice).del(`${P}/days/1/meals/lunch`)).status).toBe(404);
  });

  it.each([
    [`${P}/days/8/meals/lunch`, "weekday out of range"],
    [`${P}/days/1/meals/brunch`, "unknown slot"],
  ])("rejects %s (%s)", async (url) => {
    expect((await api(alice).put(url, { title: "x", ingredients: [] })).status).toBe(422);
  });
});

describe("copy meal", () => {
  it("copies Monday lunch to Wednesday and Thursday", async () => {
    const res = await api(alice).post(`${P}/days/1/meals/lunch/copy`, { toWeekdays: [3, 4, 3] });
    expect(res.status).toBe(200);
    expect(res.body.data.copied).toBe(2);
    expect(res.body.data.plan.days[2].meals[0].title).toBe("Soya Curry Rice Bowl");
  });

  it("refuses to copy an egg meal onto Tuesday and changes nothing", async () => {
    const res = await api(alice).post(`${P}/days/5/meals/lunch/copy`, { toWeekdays: [1, 2] });
    expect(res.status).toBe(422);
    const plan = await api(alice).get(P);
    expect(plan.body.data.days[0].meals[0].title).toBe("Soya Curry Rice Bowl");
  });
});

describe("strict-veg day toggle", () => {
  it("marks Monday (all veg) strictly vegetarian", async () => {
    const res = await api(alice).patch(`${P}/days/1`, { isStrictVeg: true });
    expect(res.status).toBe(200);
    expect(res.body.data.days[0].isStrictVeg).toBe(true);
  });

  it("refuses Friday while it has an egg meal, naming the meal", async () => {
    const res = await api(alice).patch(`${P}/days/5`, { isStrictVeg: true });
    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/Egg Bhurji/);
  });
});

describe("export / import / reset", () => {
  it("export → import round-trips the plan", async () => {
    const exported = await api(alice).get(`${P}/export`);
    expect(exported.status).toBe(200);
    expect(exported.headers["content-disposition"]).toMatch(/fitpal-plan-\d{4}-\d{2}-\d{2}\.json/);
    expect(exported.body.data).toMatchObject({ version: 1, name: "7-Day Plan" });

    const res = await api(bob).post(`${P}/import`, exported.body.data);
    expect(res.status).toBe(200);
    expect(res.body.data.days[0].meals[0]).toMatchObject({ title: "Soya Curry Rice Bowl", totals: { kcal: 337 } });
    expect(res.body.data.days[1].isStrictVeg).toBe(true);
  });

  it("imports the HTML prototype's export file (version 2)", async () => {
    const prototypeFile = {
      version: 2,
      exportedAt: "2026-11-20T10:00:00Z",
      targets: { calories: 2200, protein: 160 },
      vegDays: { Tue: true },
      plan: {
        Mon: {
          lunch: {
            title: "Soya Curry Rice Bowl",
            ingredients: [{ name: "Soya chunks", qty: "60 g dry", kcal: 207, protein: 31 }],
          },
        },
        Tue: {
          dinner: {
            title: "Paneer Tikka",
            ingredients: [{ name: "Low-fat paneer", qty: "150 g", kcal: 210, protein: 27 }],
          },
        },
      },
      snacks: { sweet: [{ id: "x", name: "Fruit Chaat", detail: "Papaya 150g", kcal: 120, protein: 1 }], salty: [] },
    };
    const res = await api(alice).post(`${P}/import`, prototypeFile);
    expect(res.status).toBe(200);
    const plan = res.body.data;
    expect(plan.name).toBe("Imported from prototype");
    expect(plan.days[0].meals[0].ingredients[0]).toMatchObject({
      qtyLabel: "60 g dry",
      quantity: 60,
      unit: "g",
      kcal: 207,
    });
    expect(plan.days[1]).toMatchObject({ isStrictVeg: true });
  });

  it("rejects an import that breaks the rules (egg on strict-veg day, tofu)", async () => {
    const eggTuesday = {
      version: 2,
      vegDays: { Tue: true },
      plan: {
        Tue: {
          lunch: { title: "Omelette", ingredients: [{ name: "Whole eggs", qty: "2", kcal: 144, protein: 12.6 }] },
        },
      },
    };
    const r1 = await api(alice).post(`${P}/import`, eggTuesday);
    expect(r1.status).toBe(422);
    expect(r1.body.error.code).toBe("STRICT_VEG_VIOLATION");

    const tofu = {
      version: 1,
      days: [
        {
          weekday: 1,
          meals: [{ slot: "lunch", title: "x", ingredients: [{ name: "Tofu", kcal: 100, proteinG: 10 }] }],
        },
      ],
    };
    const r2 = await api(alice).post(`${P}/import`, tofu);
    expect(r2.status).toBe(422);
    expect(r2.body.error.code).toBe("EXCLUDED_FOOD");

    // Nothing changed.
    const plan = await api(alice).get(P);
    expect(plan.body.data.name).toBe("7-Day Plan");
  });

  it("rejects unknown file formats and duplicate weekdays", async () => {
    expect((await api(alice).post(`${P}/import`, { foo: 1 })).status).toBe(400);
    const dup = {
      version: 1,
      days: [
        { weekday: 1, meals: [] },
        { weekday: 1, meals: [] },
      ],
    };
    expect((await api(alice).post(`${P}/import`, dup)).status).toBe(422);
  });

  it("reset restores the default plan after edits", async () => {
    await api(alice).del(`${P}/days/1/meals/lunch`);
    const res = await api(alice).post(`${P}/reset`, {});
    expect(res.body.data.days[0].meals[0].title).toBe("Soya Curry Rice Bowl");
  });

  it("users never see each other's plans", async () => {
    await api(alice).put(`${P}/days/1/meals/dinner`, { title: "Alice dinner", ingredients: [] });
    await api(bob).post(`${P}/reset`, {});
    const bobPlan = await api(bob).get(P);
    expect(bobPlan.body.data.days[0].meals.map((m: { title: string }) => m.title)).not.toContain("Alice dinner");
  });
});

describe("parseQtyLabel", () => {
  it.each([
    ["60 g dry", { quantity: 60, unit: "g" }],
    ["450 ml", { quantity: 450, unit: "ml" }],
    ["2 large", { quantity: 2, unit: "large" }],
    ["as needed", { quantity: null, unit: null }],
    ["1.5 cups", { quantity: 1.5, unit: "cups" }],
  ])("%s", (label, expected) => {
    expect(parseQtyLabel(label)).toEqual(expected);
  });
});
