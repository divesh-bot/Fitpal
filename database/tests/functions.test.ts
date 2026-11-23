import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { as, createTestDb, signUp } from "./db.js";

let db: PGlite;
let alice: string;
let bob: string;
const A = () => ({ role: "authenticated" as const, userId: alice });
const B = () => ({ role: "authenticated" as const, userId: bob });
const j = (v: unknown) => JSON.stringify(v);

beforeAll(async () => {
  db = await createTestDb();
  alice = await signUp(db, "alice@example.com");
  bob = await signUp(db, "bob@example.com");
}, 60_000);

const line = (name: string, kcal: number, protein_g: number, extra: object = {}) => ({ name, kcal, protein_g, ...extra });
const count = async (tx: Transaction, sql: string, params: unknown[] = []) =>
  (await tx.query<{ n: number }>(`select count(*)::int as n from (${sql}) x`, params)).rows[0]!.n;

describe("save_my_recipe", () => {
  it("creates a recipe with ordered ingredients, then replaces them atomically", async () => {
    const id = await as(
      db,
      A(),
      async (tx) => {
        const r = await tx.query<{ id: string }>("select public.save_my_recipe(null, $1) as id", [
          j({ name: "Oats bowl", category: "meal", ingredients: [line("Oats", 156, 5.2), line("Banana", 53, 0.7)] }),
        ]);
        return r.rows[0]!.id;
      },
      true,
    );
    await as(
      db,
      A(),
      (tx) => tx.query("select public.save_my_recipe($1, $2)", [id, j({ name: "Oats bowl v2", ingredients: [line("Oats", 195, 6.5)] })]),
      true,
    );
    const rows = await db.query<{ name: string; position: number }>(
      "select name, position from recipe_ingredients where recipe_id = $1 order by position",
      [id],
    );
    expect(rows.rows).toEqual([{ name: "Oats", position: 0 }]);
  });

  it("an invalid ingredient rolls back the whole save", async () => {
    await expect(
      as(db, A(), (tx) =>
        tx.query("select public.save_my_recipe(null, $1)", [
          j({ name: "Broken", ingredients: [line("Ok", 100, 5), line("Bad", -5, 1)] }),
        ]),
      true),
    ).rejects.toThrow(/check constraint/);
    const n = await db.query<{ n: number }>("select count(*)::int n from recipes where name = 'Broken'");
    expect(n.rows[0]!.n).toBe(0);
  });

  it("cannot update another user's recipe (not found)", async () => {
    const aliceRecipe = await db.query<{ id: string }>("select id from recipes where user_id = $1 and name = 'Oats bowl v2'", [alice]);
    await expect(
      as(db, B(), (tx) => tx.query("select public.save_my_recipe($1, $2)", [aliceRecipe.rows[0]!.id, j({ name: "Stolen", ingredients: [] })])),
    ).rejects.toThrow(/Recipe not found/);
  });
});

describe("save_my_plan_meal / copy_my_plan_meal", () => {
  it("replaces a slot's meal in the active plan", async () => {
    await as(
      db,
      A(),
      (tx) => tx.query("select public.save_my_plan_meal(1::smallint, 'lunch', $1)", [j({ title: "Dal rice", ingredients: [line("Moong dal", 174, 12), line("Rice", 130, 2.7)] })]),
      true,
    );
    const r = await as(db, A(), (tx) =>
      tx.query<{ title: string; n: number }>(
        `select m.title, (select count(*)::int from meal_plan_meal_ingredients i where i.meal_id = m.id) as n
           from meal_plan_meals m join meal_plan_days d on d.id = m.day_id where d.weekday = 1 and m.slot = 'lunch'`,
      ),
    );
    expect(r.rows).toEqual([{ title: "Dal rice", n: 2 }]);
  });

  it("refuses eggs on Tuesday", async () => {
    await expect(
      as(db, A(), (tx) =>
        tx.query("select public.save_my_plan_meal(2::smallint, 'dinner', $1)", [j({ title: "Omelette", ingredients: [line("Whole eggs", 216, 18.9, { diet_type: "egg" })] })]),
      ),
    ).rejects.toThrow(/STRICT_VEG_VIOLATION/);
  });

  it("copies a meal to other days", async () => {
    const n = await as(db, A(), (tx) => tx.query<{ n: number }>("select public.copy_my_plan_meal(1::smallint, 'lunch', array[3,4]::smallint[]) as n"), true);
    expect(n.rows[0]!.n).toBe(2);
    const titles = await as(db, A(), (tx) =>
      tx.query<{ weekday: number; title: string }>(
        "select d.weekday, m.title from meal_plan_meals m join meal_plan_days d on d.id = m.day_id where m.slot = 'lunch' and d.weekday in (3,4) order by 1",
      ),
    );
    expect(titles.rows).toEqual([{ weekday: 3, title: "Dal rice" }, { weekday: 4, title: "Dal rice" }]);
  });

  it("copying an egg meal to all days including Tuesday changes nothing", async () => {
    // Friday lunch in the default plan contains whole eggs.
    const before = await as(db, A(), (tx) => count(tx, "select 1 from meal_plan_meal_ingredients where diet_type = 'egg'"));
    await expect(
      as(db, A(), (tx) => tx.query("select public.copy_my_plan_meal(5::smallint, 'lunch', array[1,2,3]::smallint[])"), true),
    ).rejects.toThrow(/STRICT_VEG_VIOLATION/);
    const after = await as(db, A(), (tx) => count(tx, "select 1 from meal_plan_meal_ingredients where diet_type = 'egg'"));
    expect(after).toBe(before);
  });
});

describe("set_my_snack / reset_my_day", () => {
  it("one snack per kind per day; choosing again replaces; null clears", async () => {
    const snack = (name: string) => j({ name, kcal: 129, protein_g: 5, qty_label: "1 serving" });
    await as(db, A(), async (tx) => {
      await tx.query("select public.set_my_snack('2026-11-23', 'salty', $1)", [snack("Makhana + Chana")]);
      await tx.query("select public.set_my_snack('2026-11-23', 'salty', $1)", [snack("Cucumber Chaat")]);
    }, true);
    const r = await as(db, A(), (tx) => tx.query<{ name: string }>("select name from food_entries where snack_kind = 'salty'"));
    expect(r.rows).toEqual([{ name: "Cucumber Chaat" }]);
    await as(db, A(), (tx) => tx.query("select public.set_my_snack('2026-11-23', 'salty', null)"), true);
    expect(await as(db, A(), (tx) => count(tx, "select 1 from food_entries where snack_kind = 'salty'"))).toBe(0);
  });

  it("reset clears ticks, snacks, habits and steps but keeps manual foods", async () => {
    await as(db, A(), async (tx) => {
      await tx.query("insert into food_entries (user_id, entry_date, meal_slot, source, name, kcal, protein_g) values ($1, '2026-11-24', 'lunch', 'plan_meal', 'Lunch', 500, 30)", [alice]);
      await tx.query("insert into food_entries (user_id, entry_date, source, name, kcal, protein_g) values ($1, '2026-11-24', 'manual', 'Chai', 80, 2)", [alice]);
      await tx.query("select public.set_my_snack('2026-11-24', 'sweet', $1)", [j({ name: "Fruit Chaat", kcal: 120, protein_g: 1 })]);
      await tx.query("insert into habit_logs (habit_id, user_id, log_date) select id, user_id, '2026-11-24' from habits where key = 'creatine'");
      await tx.query("insert into daily_checkins (user_id, checkin_date, steps, weight_kg) values ($1, '2026-11-24', 5000, 97.8)", [alice]);
      await tx.query("select public.reset_my_day('2026-11-24')");
    }, true);
    const r = await as(db, A(), async (tx) => ({
      entries: (await tx.query("select name from food_entries where entry_date = '2026-11-24'")).rows,
      habits: await count(tx, "select 1 from habit_logs where log_date = '2026-11-24'"),
      checkin: (await tx.query("select steps, weight_kg from daily_checkins where checkin_date = '2026-11-24'")).rows,
    }));
    expect(r).toEqual({ entries: [{ name: "Chai" }], habits: 0, checkin: [{ steps: null, weight_kg: "97.80" }] });
  });

  it("reset only touches the caller's data", async () => {
    await as(db, B(), (tx) => tx.query("select public.reset_my_day('2026-11-24')"), true);
    const r = await as(db, A(), (tx) => count(tx, "select 1 from food_entries where entry_date = '2026-11-24'"));
    expect(r).toBe(1);
  });
});

describe("save_my_workout", () => {
  const workout = {
    session_date: "2026-11-23",
    split: "push",
    duration_min: 40,
    exercises: [
      { name: "Bench press", sets: [{ reps: 8, weight_kg: 60 }, { reps: 8, weight_kg: 60 }, { reps: 6, weight_kg: 62.5 }] },
      { name: "Incline DB press", sets: [{ reps: 10, weight_kg: 20 }] },
    ],
  };

  it("saves a session with exercises and numbered sets, and replaces on update", async () => {
    const id = await as(db, A(), async (tx) => (await tx.query<{ id: string }>("select public.save_my_workout(null, $1) as id", [j(workout)])).rows[0]!.id, true);
    const sets = await db.query<{ n: number; max: number }>(
      "select count(*)::int n, max(set_number)::int max from workout_sets s join workout_exercises e on e.id = s.exercise_id where e.session_id = $1",
      [id],
    );
    expect(sets.rows[0]).toEqual({ n: 4, max: 3 });

    await as(db, A(), (tx) => tx.query("select public.save_my_workout($1, $2)", [id, j({ ...workout, exercises: [workout.exercises[1]] })]), true);
    const after = await db.query<{ n: number }>("select count(*)::int n from workout_exercises where session_id = $1", [id]);
    expect(after.rows[0]!.n).toBe(1);
  });

  it("rejects invalid sets atomically", async () => {
    await expect(
      as(db, A(), (tx) => tx.query("select public.save_my_workout(null, $1)", [j({ ...workout, session_date: "2026-11-25", exercises: [{ name: "Squat", sets: [{ reps: -1 }] }] })]), true),
    ).rejects.toThrow(/check constraint/);
    const n = await db.query<{ n: number }>("select count(*)::int n from workout_sessions where session_date = '2026-11-25'");
    expect(n.rows[0]!.n).toBe(0);
  });
});

describe("generate_my_grocery_list", () => {
  it("creates a new current list and carries over unpurchased custom items", async () => {
    await as(db, A(), async (tx) => {
      const list = await tx.query<{ id: string }>("select id from grocery_lists where is_current");
      await tx.query("insert into grocery_list_items (list_id, user_id, name, source) values ($1, $2, 'Dish soap', 'custom')", [list.rows[0]!.id, alice]);
      await tx.query("insert into grocery_list_items (list_id, user_id, name, source, is_purchased) values ($1, $2, 'Already bought', 'custom', true)", [list.rows[0]!.id, alice]);
      await tx.query("select public.generate_my_grocery_list('Week 48', $1)", [j([{ name: "Soya chunks", quantity: 350, unit: "g", quantity_label: "350 g" }])]);
    }, true);
    const r = await as(db, A(), async (tx) => ({
      current: (await tx.query("select name from grocery_lists where is_current")).rows,
      lists: await count(tx, "select 1 from grocery_lists"),
      items: (await tx.query("select i.name, i.source from grocery_list_items i join grocery_lists l on l.id = i.list_id where l.is_current order by i.position")).rows,
    }));
    expect(r.current).toEqual([{ name: "Week 48" }]);
    expect(r.lists).toBe(2);
    expect(r.items).toEqual([
      { name: "Soya chunks", source: "generated" },
      { name: "Dish soap", source: "custom" },
    ]);
  });
});

describe("privileges", () => {
  it.each([
    "select public.save_my_recipe(null, '{}')",
    "select public.reset_my_day('2026-01-01')",
    "select public.save_my_workout(null, '{}')",
    "select public.generate_my_grocery_list('x', '[]')",
  ])("anonymous cannot call: %s", async (sql) => {
    await expect(as(db, { role: "anon" }, (tx) => tx.query(sql))).rejects.toThrow(/permission denied/);
  });
});
