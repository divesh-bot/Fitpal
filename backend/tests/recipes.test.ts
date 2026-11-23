import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { buildTestApp, createTestIssuer } from "./helpers.js";
import { FakeStore } from "./fakes/accountRepository.js";
import { effectiveDietType } from "../src/services/ingredients.service.js";

const ALICE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BOB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

let store: FakeStore;
let app: ReturnType<typeof buildTestApp>;
let alice: string;
let bob: string;
let oats: string;
let banana: string;
let egg: string;
let cdMilk: string;

beforeEach(async () => {
  const issuer = await createTestIssuer();
  store = new FakeStore();
  store.seedUser(ALICE);
  store.seedUser(BOB);
  oats = store.seedSharedFood({ name: "Rolled oats (dry)", kcal: 390, protein_g: 13, carbs_g: 67, fat_g: 7 }).id;
  banana = store.seedSharedFood({ name: "Banana (edible)", kcal: 89, protein_g: 1.1, carbs_g: 23, fat_g: 0.3 }).id;
  egg = store.seedSharedFood({
    name: "Whole egg (large)",
    basis: "per_unit",
    unit_label: "egg",
    kcal: 72,
    protein_g: 6.3,
    carbs_g: 0.4,
    fat_g: 4.8,
    diet_type: "egg",
  }).id;
  cdMilk = store.seedSharedFood({
    name: "Country Delight Protein Milk",
    basis: "per_100ml",
    unit_label: "ml",
    kcal: 65.1,
    protein_g: 5.56,
  }).id;
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

describe("recipes", () => {
  it("calculates food-linked ingredients on the server and totals them", async () => {
    const res = await api(alice).post("/api/v1/recipes", {
      name: "Overnight oats",
      ingredients: [
        { foodItemId: oats, amount: 40 },
        { foodItemId: banana, amount: 60, qtyLabel: "60 g (edible)" },
        { name: "Cinnamon", qtyLabel: "1 g", kcal: 3, proteinG: 0 },
      ],
    });
    expect(res.status).toBe(201);
    const r = res.body.data;
    expect(r.ingredients.map((i: { name: string; kcal: number }) => [i.name, i.kcal])).toEqual([
      ["Rolled oats (dry)", 156],
      ["Banana (edible)", 53],
      ["Cinnamon", 3],
    ]);
    expect(r.ingredients[0]).toMatchObject({ qtyLabel: "40 g", quantity: 40, unit: "g", proteinG: 5.2 });
    expect(r.ingredients[1].qtyLabel).toBe("60 g (edible)");
    expect(r.totals).toMatchObject({ kcal: 212, proteinG: 5.9, carbsComplete: false });
    expect(r.dietType).toBe("veg");
  });

  it("ignores nutrition values sent by the client for food-linked items", async () => {
    const res = await api(alice).post("/api/v1/recipes", {
      name: "Sneaky",
      ingredients: [{ foodItemId: oats, amount: 40, kcal: 1 }],
    });
    expect(res.status).toBe(422); // unknown field on a food-linked item is rejected outright
  });

  it("computes per-serving values", async () => {
    const res = await api(alice).post("/api/v1/recipes", {
      name: "Milk x2",
      servings: 2,
      ingredients: [{ foodItemId: cdMilk, amount: 900 }],
    });
    expect(res.body.data.totals).toMatchObject({ kcal: 586, proteinG: 50, carbsG: null });
    expect(res.body.data.perServing).toEqual({ kcal: 293, proteinG: 25, carbsG: null, fatG: null });
  });

  it("marks recipes containing eggs as egg diet type", async () => {
    const res = await api(alice).post("/api/v1/recipes", {
      name: "Eggs",
      ingredients: [{ foodItemId: egg, amount: 2 }],
    });
    expect(res.body.data.ingredients[0]).toMatchObject({ qtyLabel: "2 eggs", kcal: 144, dietType: "egg" });
    expect(res.body.data.dietType).toBe("egg");
  });

  it("replaces a recipe entirely on PUT", async () => {
    const created = await api(alice).post("/api/v1/recipes", {
      name: "A",
      ingredients: [{ foodItemId: oats, amount: 40 }],
    });
    const id = created.body.data.id;
    const res = await api(alice).put(`/api/v1/recipes/${id}`, {
      name: "B",
      category: "snack_sweet",
      ingredients: [{ foodItemId: banana, amount: 100 }],
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id, name: "B", category: "snack_sweet" });
    expect(res.body.data.ingredients).toHaveLength(1);
    const snacks = await api(alice).get("/api/v1/recipes?category=snack_sweet");
    expect(snacks.body.data).toHaveLength(1);
  });

  it("other users cannot see, change or delete my recipes", async () => {
    const created = await api(alice).post("/api/v1/recipes", {
      name: "Mine",
      ingredients: [{ foodItemId: oats, amount: 40 }],
    });
    const id = created.body.data.id;
    expect((await api(bob).get(`/api/v1/recipes/${id}`)).status).toBe(404);
    expect(
      (await api(bob).put(`/api/v1/recipes/${id}`, { name: "x", ingredients: [{ foodItemId: oats, amount: 1 }] }))
        .status,
    ).toBe(404);
    expect((await api(bob).del(`/api/v1/recipes/${id}`)).status).toBe(404);
    expect((await api(bob).get("/api/v1/recipes")).body.data).toHaveLength(0);
  });

  it("a food that isn't visible to the user is rejected", async () => {
    const res = await api(alice).post("/api/v1/recipes", {
      name: "x",
      ingredients: [{ foodItemId: "99999999-9999-4999-8999-999999999999", amount: 10 }],
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("INVALID_REFERENCE");
  });
});

describe("dietary rules on recipes", () => {
  it("rejects tofu (excluded food)", async () => {
    const res = await api(alice).post("/api/v1/recipes", {
      name: "Stir fry",
      ingredients: [{ name: "Firm tofu", kcal: 144, proteinG: 15 }],
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("EXCLUDED_FOOD");
  });

  it.each(["Egg whites", "Liquid egg", "egg-white omelette"])("rejects separated egg whites: %s", async (name) => {
    const res = await api(alice).post("/api/v1/recipes", {
      name: "x",
      ingredients: [{ name, kcal: 50, proteinG: 11 }],
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("WHOLE_EGGS_ONLY");
  });

  it("allows tofu again if the user removes it from their excluded list", async () => {
    await api(alice).put("/api/v1/preferences", { excludedFoods: [] });
    const res = await api(alice).post("/api/v1/recipes", {
      name: "x",
      ingredients: [{ name: "Tofu", kcal: 144, proteinG: 15 }],
    });
    expect(res.status).toBe(201);
  });

  it("validates the recipe body", async () => {
    expect((await api(alice).post("/api/v1/recipes", { name: "x", ingredients: [] })).status).toBe(422);
    expect(
      (await api(alice).post("/api/v1/recipes", { name: "", ingredients: [{ name: "a", kcal: 1, proteinG: 1 }] }))
        .status,
    ).toBe(422);
    expect(
      (
        await api(alice).post("/api/v1/recipes", {
          name: "x",
          servings: 0,
          ingredients: [{ name: "a", kcal: 1, proteinG: 1 }],
        })
      ).status,
    ).toBe(422);
  });
});

describe("effectiveDietType", () => {
  it.each([
    ["Chicken breast", "veg", "non_veg"],
    ["Whole eggs", undefined, "egg"],
    ["Whole-Egg Omelette", "veg", "egg"],
    ["Eggplant bharta", "veg", "veg"],
    ["Paneer Bhurji", undefined, "veg"],
    ["Soya chunks", "non_veg", "non_veg"],
  ] as const)("%s (stated %s) → %s", (name, stated, expected) => {
    expect(effectiveDietType(name, stated)).toBe(expected);
  });
});
