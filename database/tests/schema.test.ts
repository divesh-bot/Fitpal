import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { as, createTestDb, signUp } from "./db.js";

let db: PGlite;
let alice: string;
let bob: string;

const userA = () => ({ role: "authenticated" as const, userId: alice });
const userB = () => ({ role: "authenticated" as const, userId: bob });

beforeAll(async () => {
  db = await createTestDb();
  alice = await signUp(db, "alice@example.com", "Alice");
  bob = await signUp(db, "bob@example.com");
}, 60_000);

// Helper: planned kcal / protein per meal for a user, keyed "weekday:slot".
async function plannedTotals(userId: string) {
  const res = await as(db, { role: "authenticated", userId }, (tx) =>
    tx.query<{ weekday: number; slot: string; kcal: string; protein: string }>(`
      select d.weekday, m.slot, sum(i.kcal) as kcal, sum(i.protein_g) as protein
        from meal_plans p
        join meal_plan_days d on d.plan_id = p.id
        join meal_plan_meals m on m.day_id = d.id
        join meal_plan_meal_ingredients i on i.meal_id = m.id
       where p.is_active
       group by d.weekday, m.slot`),
  );
  return new Map(res.rows.map((r) => [`${r.weekday}:${r.slot}`, { kcal: Number(r.kcal), protein: Number(r.protein) }]));
}

describe("migrations and seed", () => {
  it("seeds the 42 shared foods with Country Delight carbs/fat left unknown", async () => {
    const foods = await db.query<{ n: number }>("select count(*)::int as n from food_items where user_id is null");
    expect(foods.rows[0]!.n).toBe(42);
    const milk = await db.query<{ kcal: string; protein_g: string; carbs_g: null; fat_g: null }>(
      "select kcal, protein_g, carbs_g, fat_g from food_items where seed_key = 'f_cdmilk'",
    );
    expect(milk.rows[0]).toMatchObject({ kcal: "65.10", protein_g: "5.56", carbs_g: null, fat_g: null });
  });

  it("seed is idempotent (re-running does not duplicate)", async () => {
    const { readFileSync } = await import("node:fs");
    const sql = readFileSync(new URL("../seed/0001_reference_data.sql", import.meta.url), "utf8");
    await db.exec(sql);
    const foods = await db.query<{ n: number }>("select count(*)::int as n from food_items where user_id is null");
    expect(foods.rows[0]!.n).toBe(42);
  });
});

describe("new account setup (sign-up trigger)", () => {
  it("creates profile, preferences, targets and habits", async () => {
    const r = await as(db, userA(), async (tx) => ({
      profile: (await tx.query("select display_name from profiles")).rows,
      prefs: (await tx.query("select whole_eggs_only, excluded_foods from user_preferences")).rows,
      targets: (await tx.query("select calories_kcal, protein_g, steps, bmr_kcal, tdee_kcal from nutrition_targets"))
        .rows,
      habits: (await tx.query("select key from habits order by position")).rows,
    }));
    expect(r.profile).toEqual([{ display_name: "Alice" }]);
    expect(r.prefs).toEqual([{ whole_eggs_only: true, excluded_foods: ["tofu"] }]);
    expect(r.targets).toEqual([{ calories_kcal: 2200, protein_g: "160.0", steps: 6000, bmr_kcal: 1901, tdee_kcal: 2550 }]);
    expect(r.habits).toEqual([{ key: "creatine" }, { key: "workout" }]);
  });

  it("copies the 7-day plan: 7 days × 4 meals, Tuesday strictly vegetarian", async () => {
    const r = await as(db, userA(), async (tx) => ({
      days: (await tx.query<{ weekday: number; is_strict_veg: boolean }>(
        "select weekday, is_strict_veg from meal_plan_days order by weekday",
      )).rows,
      meals: (await tx.query<{ n: number }>("select count(*)::int as n from meal_plan_meals")).rows[0]!.n,
      snacks: (await tx.query<{ n: number }>("select count(*)::int as n from recipes where category like 'snack_%'"))
        .rows[0]!.n,
      groceries: (await tx.query<{ n: number }>("select count(*)::int as n from grocery_list_items")).rows[0]!.n,
    }));
    expect(r.days).toHaveLength(7);
    expect(r.days.filter((d) => d.is_strict_veg).map((d) => d.weekday)).toEqual([2]);
    expect(r.meals).toBe(28);
    expect(r.snacks).toBe(5);
    expect(r.groceries).toBe(16);
  });

  it("preserves the prototype's nutrition values exactly", async () => {
    const t = await plannedTotals(alice);
    // Breakfast is 536 kcal; with 293-kcal protein milk = 829 (the plan's stated total).
    expect(t.get("1:breakfast")!.kcal).toBe(536);
    expect(t.get("1:post_workout")).toEqual({ kcal: 293, protein: 25 });
    expect(t.get("1:breakfast")!.kcal + t.get("1:post_workout")!.kcal).toBe(829);
    // Monday lunch: Soya Curry Rice Bowl = 207+130+60+40+45+35
    expect(t.get("1:lunch")!.kcal).toBe(517);
    // Wednesday lunch: Chicken Rice Bowl = 180+169+60+55+45+5
    expect(t.get("3:lunch")!.kcal).toBe(514);
  });

  it("gives each user their own independent copy", async () => {
    const t = await plannedTotals(bob);
    expect(t.size).toBe(28);
  });
});

describe("Row Level Security", () => {
  it("users only see their own rows", async () => {
    const counts = await as(db, userB(), async (tx) => ({
      profiles: (await tx.query<{ n: number }>("select count(*)::int as n from profiles")).rows[0]!.n,
      plans: (await tx.query<{ n: number }>("select count(*)::int as n from meal_plans")).rows[0]!.n,
      aliceRows: (
        await tx.query<{ n: number }>("select count(*)::int as n from meal_plans where user_id = $1", [alice])
      ).rows[0]!.n,
    }));
    expect(counts).toEqual({ profiles: 1, plans: 1, aliceRows: 0 });
  });

  it("a user cannot insert rows for another user", async () => {
    await expect(
      as(db, userB(), (tx) =>
        tx.query("insert into daily_checkins (user_id, checkin_date, weight_kg) values ($1, '2026-11-20', 90)", [
          alice,
        ]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("a user cannot update or delete another user's rows (silently matches nothing)", async () => {
    await as(
      db,
      userA(),
      (tx) => tx.query("insert into daily_checkins (user_id, checkin_date, weight_kg) values ($1, '2026-11-20', 98)", [alice]),
      true,
    );
    const result = await as(db, userB(), async (tx) => ({
      updated: (await tx.query("update daily_checkins set weight_kg = 50 where user_id = $1", [alice])).affectedRows,
      deleted: (await tx.query("delete from daily_checkins where user_id = $1", [alice])).affectedRows,
    }));
    expect(result).toEqual({ updated: 0, deleted: 0 });
    const still = await db.query<{ weight_kg: string }>("select weight_kg from daily_checkins where user_id = $1", [alice]);
    expect(still.rows).toEqual([{ weight_kg: "98.00" }]);
  });

  it("a user cannot move their row to another user (WITH CHECK)", async () => {
    await expect(
      as(db, userA(), (tx) => tx.query("update daily_checkins set user_id = $1 where user_id = $2", [bob, alice])),
    ).rejects.toThrow(/row-level security/);
  });

  it("anonymous (not signed in) requests get no table access", async () => {
    await expect(as(db, { role: "anon" }, (tx) => tx.query("select * from food_items"))).rejects.toThrow(
      /permission denied/,
    );
    await expect(as(db, { role: "anon" }, (tx) => tx.query("select * from profiles"))).rejects.toThrow(
      /permission denied/,
    );
  });

  it("anonymous requests cannot call the plan RPCs", async () => {
    await expect(as(db, { role: "anon" }, (tx) => tx.query("select public.reset_my_meal_plan()"))).rejects.toThrow(
      /permission denied/,
    );
  });

  it("shared foods are readable but not editable; custom foods are private", async () => {
    const r = await as(db, userA(), async (tx) => {
      const updated = (await tx.query("update food_items set kcal = 1 where seed_key = 'f_oats'")).affectedRows;
      await tx.query(
        "insert into food_items (user_id, name, basis, unit_label, default_amount, kcal, protein_g) values ($1, 'Alice yogurt', 'per_100g', 'g', 100, 60, 10)",
        [alice],
      );
      return { updated };
    }, true);
    expect(r.updated).toBe(0);
    const bobSees = await as(db, userB(), (tx) =>
      tx.query<{ n: number }>("select count(*)::int as n from food_items where name = 'Alice yogurt'"),
    );
    expect(bobSees.rows[0]!.n).toBe(0);
  });

  it("users cannot create shared foods (user_id NULL) or fake seed keys", async () => {
    await expect(
      as(db, userA(), (tx) =>
        tx.query(
          "insert into food_items (user_id, name, basis, unit_label, default_amount, kcal, protein_g) values (null, 'Fake shared', 'per_100g', 'g', 100, 1, 1)",
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("users cannot modify templates or create profiles", async () => {
    await expect(as(db, userA(), (tx) => tx.query("update app_templates set payload = '{}'"))).rejects.toThrow(
      /permission denied/,
    );
    await expect(as(db, userA(), (tx) => tx.query("insert into profiles (id) values ($1)", [bob]))).rejects.toThrow(
      /permission denied/,
    );
  });

  it("cannot reference another user's private food from a recipe or food entry", async () => {
    const aliceFood = await db.query<{ id: string }>("select id from food_items where name = 'Alice yogurt'");
    const foodId = aliceFood.rows[0]!.id;
    await expect(
      as(db, userB(), (tx) =>
        tx.query(
          "insert into food_entries (user_id, entry_date, source, food_item_id, name, kcal, protein_g) values ($1, '2026-11-21', 'food_item', $2, 'x', 1, 1)",
          [bob, foodId],
        ),
      ),
    ).rejects.toThrow(/not available/);
  });

  it("cannot attach a child row to another user's parent (composite FK)", async () => {
    const alicePlanMeal = await db.query<{ id: string }>(
      "select id from meal_plan_meals where user_id = $1 limit 1",
      [alice],
    );
    await expect(
      as(db, userB(), (tx) =>
        tx.query("insert into meal_plan_meal_ingredients (meal_id, user_id, name) values ($1, $2, 'x')", [
          alicePlanMeal.rows[0]!.id,
          bob,
        ]),
      ),
    ).rejects.toThrow(/foreign key/);
  });
});

describe("strict vegetarian day rule", () => {
  async function mealId(userId: string, weekday: number, slot: string) {
    const r = await db.query<{ id: string }>(
      `select m.id from meal_plan_meals m join meal_plan_days d on d.id = m.day_id
        where m.user_id = $1 and d.weekday = $2 and m.slot = $3`,
      [userId, weekday, slot],
    );
    return r.rows[0]!.id;
  }

  it("rejects eggs on Tuesday", async () => {
    const tueLunch = await mealId(alice, 2, "lunch");
    await expect(
      as(db, userA(), (tx) =>
        tx.query(
          "insert into meal_plan_meal_ingredients (meal_id, user_id, name, kcal, protein_g, diet_type) values ($1, $2, 'Whole eggs', 144, 12.6, 'egg')",
          [tueLunch, alice],
        ),
      ),
    ).rejects.toThrow(/STRICT_VEG_VIOLATION/);
  });

  it("rejects changing a Tuesday ingredient to non-veg", async () => {
    const tueLunch = await mealId(alice, 2, "lunch");
    await expect(
      as(db, userA(), (tx) =>
        tx.query("update meal_plan_meal_ingredients set diet_type = 'non_veg' where meal_id = $1", [tueLunch]),
      ),
    ).rejects.toThrow(/STRICT_VEG_VIOLATION/);
  });

  it("allows eggs on Friday", async () => {
    const friLunch = await mealId(alice, 5, "lunch");
    await expect(
      as(db, userA(), (tx) =>
        tx.query(
          "insert into meal_plan_meal_ingredients (meal_id, user_id, name, kcal, protein_g, diet_type) values ($1, $2, 'Whole eggs', 72, 6.3, 'egg')",
          [friLunch, alice],
        ),
      ),
    ).resolves.toBeDefined();
  });

  it("refuses to mark Wednesday strict-veg while it contains chicken", async () => {
    await expect(
      as(db, userA(), (tx) => tx.query("update meal_plan_days set is_strict_veg = true where weekday = 3")),
    ).rejects.toThrow(/STRICT_VEG_VIOLATION/);
  });

  it("allows marking an all-veg day (Thursday) strict-veg", async () => {
    const r = await as(db, userA(), (tx) =>
      tx.query("update meal_plan_days set is_strict_veg = true where weekday = 4"),
    );
    expect(r.affectedRows).toBe(1);
  });
});

describe("food log integrity", () => {
  it("allows a planned meal slot to be logged only once per day", async () => {
    const insert = (tx: Parameters<Parameters<typeof as>[2]>[0]) =>
      tx.query(
        "insert into food_entries (user_id, entry_date, meal_slot, source, name, kcal, protein_g) values ($1, '2026-11-22', 'lunch', 'plan_meal', 'Lunch', 500, 30)",
        [alice],
      );
    await expect(
      as(db, userA(), async (tx) => {
        await insert(tx);
        await insert(tx);
      }),
    ).rejects.toThrow(/duplicate key/);
  });

  it("rejects duplicate submissions with the same client_request_id", async () => {
    const id = "6f1c5c1e-4f5a-4a0e-9a59-2f8a3d1d0b11";
    const insert = (tx: Parameters<Parameters<typeof as>[2]>[0]) =>
      tx.query(
        "insert into food_entries (user_id, entry_date, source, name, kcal, protein_g, client_request_id) values ($1, '2026-11-22', 'manual', 'Chai', 80, 2, $2)",
        [alice, id],
      );
    await expect(
      as(db, userA(), async (tx) => {
        await insert(tx);
        await insert(tx);
      }),
    ).rejects.toThrow(/duplicate key/);
  });

  it("only one check-in per user per date", async () => {
    await expect(
      as(db, userA(), (tx) =>
        tx.query("insert into daily_checkins (user_id, checkin_date, weight_kg) values ($1, '2026-11-20', 97.5)", [alice]),
      ),
    ).rejects.toThrow(/duplicate key/);
  });

  it("rejects out-of-range values", async () => {
    await expect(
      as(db, userA(), (tx) =>
        tx.query("insert into daily_checkins (user_id, checkin_date, hunger) values ($1, '2026-11-01', 11)", [alice]),
      ),
    ).rejects.toThrow(/check constraint/);
  });
});

describe("plan reset / import", () => {
  it("logged food survives a plan reset unchanged (history is a snapshot)", async () => {
    await as(
      db,
      userB(),
      async (tx) => {
        const meal = await tx.query<{ id: string }>(
          "select m.id from meal_plan_meals m join meal_plan_days d on d.id = m.day_id where d.weekday = 1 and m.slot = 'lunch'",
        );
        await tx.query(
          "insert into food_entries (user_id, entry_date, meal_slot, source, plan_meal_id, name, kcal, protein_g) values ($1, '2026-11-23', 'lunch', 'plan_meal', $2, 'Soya Curry Rice Bowl', 517, 39.5)",
          [bob, meal.rows[0]!.id],
        );
        await tx.query("update meal_plan_meals set title = 'Changed' where id = $1", [meal.rows[0]!.id]);
        await tx.query("select public.reset_my_meal_plan()");
      },
      true,
    );
    const r = await as(db, userB(), async (tx) => ({
      entry: (await tx.query("select name, kcal, plan_meal_id from food_entries")).rows,
      plans: (await tx.query<{ n: number }>("select count(*)::int as n from meal_plans")).rows[0]!.n,
      monLunch: (
        await tx.query(
          "select m.title from meal_plan_meals m join meal_plan_days d on d.id = m.day_id where d.weekday = 1 and m.slot = 'lunch'",
        )
      ).rows,
    }));
    expect(r.entry).toEqual([{ name: "Soya Curry Rice Bowl", kcal: "517.00", plan_meal_id: null }]);
    expect(r.plans).toBe(1);
    expect(r.monLunch).toEqual([{ title: "Soya Curry Rice Bowl" }]);
  });

  it("import is atomic: an invalid plan (egg on strict-veg day) changes nothing", async () => {
    const bad = {
      name: "Bad",
      days: [
        {
          weekday: 2,
          isStrictVeg: true,
          meals: [{ slot: "lunch", title: "Egg bhurji", ingredients: [{ name: "Eggs", kcal: 144, dietType: "egg" }] }],
        },
      ],
    };
    await expect(
      as(db, userB(), (tx) => tx.query("select public.replace_my_meal_plan($1)", [JSON.stringify(bad)]), true),
    ).rejects.toThrow(/STRICT_VEG_VIOLATION/);
    const plan = await as(db, userB(), (tx) => tx.query("select name from meal_plans"));
    expect(plan.rows).toEqual([{ name: "7-Day Indian Fat Loss & Muscle Plan" }]);
  });

  it("a user calling the materializer for someone else is blocked by RLS", async () => {
    await expect(
      as(db, userB(), (tx) =>
        tx.query("select private.materialize_meal_plan($1, $2)", [alice, JSON.stringify({ days: [] })]),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("timestamps", () => {
  it("updated_at is refreshed by the trigger on update", async () => {
    // created_at was set at sign-up (an earlier transaction); now() is fixed
    // per transaction, so a later update must produce a strictly later value.
    await new Promise((res) => setTimeout(res, 10));
    await as(db, userA(), (tx) => tx.query("update profiles set height_cm = 173"), true);
    const r = await db.query<{ created_at: Date; updated_at: Date }>(
      "select created_at, updated_at from profiles where id = $1",
      [alice],
    );
    expect(r.rows[0]!.updated_at.getTime()).toBeGreaterThan(r.rows[0]!.created_at.getTime());
  });
});
