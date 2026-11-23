import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { buildTestApp, createTestIssuer } from "./helpers.js";
import { FakeStore } from "./fakes/accountRepository.js";
import { escapeLike } from "../src/repositories/foods.repository.js";

const ALICE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BOB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

let store: FakeStore;
let app: ReturnType<typeof buildTestApp>;
let alice: string;
let bob: string;
let paneerId: string;

const lowFatPaneer = {
  name: "Low-fat paneer",
  basis: "per_100g",
  unit_label: "g",
  default_amount: 150,
  kcal: 140,
  protein_g: 18,
  carbs_g: 3,
  fat_g: 6,
};

beforeEach(async () => {
  const issuer = await createTestIssuer();
  store = new FakeStore();
  store.seedUser(ALICE);
  store.seedUser(BOB);
  paneerId = store.seedSharedFood(lowFatPaneer).id;
  store.seedSharedFood({ name: "Whole egg (large)", basis: "per_unit", unit_label: "egg", diet_type: "egg" });
  app = buildTestApp({}, { verifyToken: issuer.verifyToken, repositories: store.factory() });
  alice = await issuer.sign({ sub: ALICE });
  bob = await issuer.sign({ sub: BOB });
});

const api = (token: string) => ({
  get: (u: string) => request(app).get(u).set("Authorization", `Bearer ${token}`),
  post: (u: string, b: object) => request(app).post(u).set("Authorization", `Bearer ${token}`).send(b),
  put: (u: string, b: object) => request(app).put(u).set("Authorization", `Bearer ${token}`).send(b),
  del: (u: string) => request(app).delete(u).set("Authorization", `Bearer ${token}`),
});

const greekYogurt = {
  name: "Epigamia Greek yogurt",
  brand: "Epigamia",
  basis: "per_100g",
  unitLabel: "anything", // forced to "g" for per_100g
  defaultAmount: 200,
  kcal: 73,
  proteinG: 9,
  carbsG: 4,
  fatG: 2,
};

describe("GET /foods (search)", () => {
  it("lists shared foods with per-basis nutrition", async () => {
    const res = await api(alice).get("/api/v1/foods");
    expect(res.status).toBe(200);
    expect(res.body.data.map((f: { name: string }) => f.name)).toEqual(["Low-fat paneer", "Whole egg (large)"]);
    expect(res.body.data[0]).toMatchObject({
      basis: "per_100g",
      per: { kcal: 140, proteinG: 18, carbsG: 3, fatG: 6 },
      isShared: true,
      isExcluded: false,
    });
  });

  it("searches case-insensitively", async () => {
    const res = await api(alice).get("/api/v1/foods?q=PANEER");
    expect(res.body.data).toHaveLength(1);
  });

  it("includes the user's own foods but never another user's", async () => {
    await api(alice).post("/api/v1/foods", greekYogurt);
    const aliceSees = await api(alice).get("/api/v1/foods?q=yogurt");
    const bobSees = await api(bob).get("/api/v1/foods?q=yogurt");
    expect(aliceSees.body.data).toHaveLength(1);
    expect(aliceSees.body.data[0].isShared).toBe(false);
    expect(bobSees.body.data).toHaveLength(0);
  });

  it("flags foods that match the user's excluded list (tofu)", async () => {
    await api(alice).post("/api/v1/foods", { ...greekYogurt, name: "Silken tofu" });
    const res = await api(alice).get("/api/v1/foods?q=tofu");
    expect(res.body.data[0].isExcluded).toBe(true);
  });

  it("validates paging and query length", async () => {
    expect((await api(alice).get("/api/v1/foods?limit=0")).status).toBe(422);
    expect((await api(alice).get(`/api/v1/foods?q=${"a".repeat(61)}`)).status).toBe(422);
    expect((await api(alice).get("/api/v1/foods?unknown=1")).status).toBe(422);
  });

  it("escapes LIKE wildcards so % and _ are matched literally", () => {
    expect(escapeLike("50%_off\\")).toBe("50\\%\\_off\\\\");
  });
});

describe("custom foods", () => {
  it("creates a custom food; g/ml unit labels follow the basis", async () => {
    const res = await api(alice).post("/api/v1/foods", greekYogurt);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: "Epigamia Greek yogurt", unitLabel: "g", isShared: false });
  });

  it("rejects duplicate names for the same user (409)", async () => {
    await api(alice).post("/api/v1/foods", greekYogurt);
    expect((await api(alice).post("/api/v1/foods", greekYogurt)).status).toBe(409);
  });

  it.each<[object, string]>([
    [{ ...greekYogurt, proteinG: 80, carbsG: 30, fatG: 10 }, "macros exceed 100 g per 100 g"],
    [{ ...greekYogurt, kcal: -5 }, "negative kcal"],
    [{ ...greekYogurt, defaultAmount: 0 }, "zero default amount"],
    [{ ...greekYogurt, name: "" }, "empty name"],
    [{ ...greekYogurt, basis: "per_cup" }, "unknown basis"],
    [{ ...greekYogurt, userId: BOB }, "attempt to set owner"],
  ])("rejects invalid food: %s", async (body) => {
    expect((await api(alice).post("/api/v1/foods", body)).status).toBe(422);
  });

  it("allows per-unit foods to exceed 100 g of macros (e.g. a large portion)", async () => {
    const res = await api(alice).post("/api/v1/foods", {
      name: "Restaurant thali",
      basis: "per_unit",
      unitLabel: "plate",
      defaultAmount: 1,
      kcal: 1100,
      proteinG: 40,
      carbsG: 140,
      fatG: 40,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.unitLabel).toBe("plate");
  });

  it("updates and deletes own foods", async () => {
    const created = await api(alice).post("/api/v1/foods", greekYogurt);
    const id = created.body.data.id;
    const upd = await api(alice).put(`/api/v1/foods/${id}`, { kcal: 70, proteinG: 10 });
    expect(upd.status).toBe(200);
    expect(upd.body.data.per).toMatchObject({ kcal: 70, proteinG: 10 });
    expect((await api(alice).del(`/api/v1/foods/${id}`)).status).toBe(204);
    expect((await api(alice).get(`/api/v1/foods/${id}`)).status).toBe(404);
  });

  it("shared foods are read-only (403)", async () => {
    expect((await api(alice).put(`/api/v1/foods/${paneerId}`, { kcal: 1 })).status).toBe(403);
    expect((await api(alice).del(`/api/v1/foods/${paneerId}`)).status).toBe(403);
    expect(store.foods.find((f) => f.id === paneerId)!.kcal).toBe(140);
  });

  it("another user's food behaves as if it does not exist (404, not 403)", async () => {
    const created = await api(alice).post("/api/v1/foods", greekYogurt);
    const id = created.body.data.id;
    expect((await api(bob).get(`/api/v1/foods/${id}`)).status).toBe(404);
    expect((await api(bob).put(`/api/v1/foods/${id}`, { kcal: 1 })).status).toBe(404);
    expect((await api(bob).del(`/api/v1/foods/${id}`)).status).toBe(404);
  });

  it("rejects a non-UUID id", async () => {
    expect((await api(alice).get("/api/v1/foods/not-an-id")).status).toBe(422);
  });
});
