/**
 * Live end-to-end check: real Supabase Auth + real database + the running API.
 *
 *   1. Creates two temporary, pre-confirmed test users (Admin API, secret key).
 *   2. Signs in as each with email + password (real access tokens).
 *   3. Exercises the main user journeys through the API at API_BASE_URL.
 *   4. ALWAYS deletes both users at the end; their data is removed by cascade,
 *      and the script verifies nothing is left behind.
 *
 * Usage (secret key is passed in the environment only; never logged or saved):
 *   SUPABASE_SECRET_KEY=... API_BASE_URL=http://localhost:4000 \
 *     node --env-file=.env scripts/live-e2e.mjs
 *
 * Not part of `npm test`: it needs network access and a secret key.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY } = process.env;
const API = (process.env.API_BASE_URL ?? "http://localhost:4000").replace(/\/+$/, "");
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !SUPABASE_SECRET_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / SUPABASE_SECRET_KEY");
  process.exit(2);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? `  →  ${detail}` : ""}`);
};

async function api(token, method, path, body) {
  const res = await fetch(`${API}/api/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON */
  }
  return { status: res.status, data: json?.data, error: json?.error };
}

async function makeUser(label) {
  const email = `fitpal-e2e-${label}-${randomBytes(4).toString("hex")}@example.com`;
  const password = randomBytes(24).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: `E2E ${label}` } });
  if (error) throw new Error(`createUser ${label}: ${error.message}`);
  const anon = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const signIn = await anon.auth.signInWithPassword({ email, password });
  if (signIn.error) throw new Error(`signIn ${label}: ${signIn.error.message}`);
  return { id: data.user.id, token: signIn.data.session.access_token, db: anon };
}

const MONDAY = "2026-11-23";
const created = [];

try {
  const A = await makeUser("a");
  created.push(A.id);
  const B = await makeUser("b");
  created.push(B.id);
  check("two test users created and signed in via Supabase Auth", true);

  // --- account setup by the sign-up trigger -------------------------------------
  const profile = await api(A.token, "GET", "/profile");
  check("profile created at sign-up", profile.status === 200 && profile.data.displayName === "E2E a", JSON.stringify(profile));
  const plan = await api(A.token, "GET", "/meal-plans/active");
  const meals = plan.data?.days?.reduce((n, d) => n + d.meals.length, 0);
  check("default 7-day plan copied (7 days, 28 meals, Tuesday strict veg)", plan.status === 200 && plan.data.days.length === 7 && meals === 28 && plan.data.days[1].isStrictVeg === true, `${plan.status} meals=${meals}`);

  // --- Today screen -----------------------------------------------------------------
  let day = await api(A.token, "GET", `/days/${MONDAY}`);
  check("Monday: target 2200 kcal / 160 g, planned 1950 kcal (prototype values)", day.data?.target.caloriesKcal === 2200 && day.data?.target.proteinG === 160 && day.data?.planned.kcal === 1950, JSON.stringify(day.data?.planned));

  day = await api(A.token, "PUT", `/days/${MONDAY}/plan-meals/post_workout`, { eaten: true });
  check("tick post-workout → 293 kcal / 25 g, creatine ticked", day.data?.consumed.kcal === 293 && day.data?.consumed.proteinG === 25 && day.data?.habits.find((h) => h.key === "creatine")?.done === true, JSON.stringify(day.error ?? day.data?.consumed));
  day = await api(A.token, "PUT", `/days/${MONDAY}/plan-meals/post_workout`, { eaten: true });
  check("ticking again does not double-count", day.data?.consumed.kcal === 293);

  const snacks = await api(A.token, "GET", "/recipes?category=snack_salty");
  const makhana = snacks.data?.find((r) => r.name === "Makhana + Chana");
  day = await api(A.token, "PUT", `/days/${MONDAY}/snacks/salty`, { recipeId: makhana?.id });
  check("choose salty snack (Makhana + Chana, 129 kcal)", day.data?.snacks.salty?.kcal === 129 && day.data?.consumed.kcal === 422, JSON.stringify(day.error ?? day.data?.consumed));

  // --- food log ---------------------------------------------------------------------------
  const foods = await api(A.token, "GET", "/foods?q=low-fat%20paneer");
  const paneer = foods.data?.find((f) => f.name === "Low-fat paneer");
  check("food search finds shared foods", foods.status === 200 && !!paneer);
  const crid = randomUUID();
  const e1 = await api(A.token, "POST", "/food-entries", { source: "food_item", date: MONDAY, mealSlot: "dinner", foodItemId: paneer?.id, amount: 150, clientRequestId: crid });
  check("log 150 g paneer → 210 kcal / 27 g (server-side calculation)", e1.status === 201 && e1.data.kcal === 210 && e1.data.proteinG === 27, JSON.stringify(e1));
  const e2 = await api(A.token, "POST", "/food-entries", { source: "food_item", date: MONDAY, mealSlot: "dinner", foodItemId: paneer?.id, amount: 150, clientRequestId: crid });
  check("retried request is not duplicated (same id, 200)", e2.status === 200 && e2.data?.id === e1.data?.id);

  // --- rules enforced by the live database -----------------------------------------------
  const egg = (await api(A.token, "GET", "/foods?q=whole%20egg")).data?.[0];
  const tueEgg = await api(A.token, "PUT", "/meal-plans/active/days/2/meals/dinner", { title: "Omelette", ingredients: [{ foodItemId: egg?.id, amount: 3 }] });
  check("eggs on strictly-vegetarian Tuesday are refused", tueEgg.status === 422 && tueEgg.error?.code === "STRICT_VEG_VIOLATION", JSON.stringify(tueEgg));
  const copy = await api(A.token, "POST", "/meal-plans/active/days/5/meals/lunch/copy", { toWeekdays: [2] });
  check("copying Friday's egg lunch onto Tuesday is refused", copy.status === 422);
  const tofu = await api(A.token, "POST", "/recipes", { name: "Stir fry", ingredients: [{ name: "Firm tofu", kcal: 144, proteinG: 15 }] });
  check("tofu is refused in recipes", tofu.status === 422 && tofu.error?.code === "EXCLUDED_FOOD");

  // --- recipes / plan editing (atomic DB functions) ------------------------------------
  const oats = (await api(A.token, "GET", "/foods?q=rolled%20oats")).data?.[0];
  const recipe = await api(A.token, "POST", "/recipes", { name: "E2E oats", ingredients: [{ foodItemId: oats?.id, amount: 40 }, { name: "Cinnamon", kcal: 3, proteinG: 0 }] });
  check("save recipe via save_my_recipe → 159 kcal", recipe.status === 201 && recipe.data.totals.kcal === 159, JSON.stringify(recipe.error ?? recipe.data?.totals));
  const editMeal = await api(A.token, "PUT", "/meal-plans/active/days/3/meals/dinner", { title: "E2E dinner", ingredients: [{ foodItemId: paneer?.id, amount: 100 }] });
  check("edit a plan meal via save_my_plan_meal", editMeal.status === 200 && editMeal.data.days[2].meals.find((m) => m.slot === "dinner")?.title === "E2E dinner", JSON.stringify(editMeal.error));

  // --- progress, workouts, grocery --------------------------------------------------------
  await api(A.token, "PUT", "/checkins/2026-11-22", { weightKg: 98.0 });
  const ci = await api(A.token, "PUT", `/checkins/${MONDAY}`, { weightKg: 97.6, sleepHours: 7.5, hunger: 5, energy: 7 });
  const prog = await api(A.token, "GET", "/progress/weight?from=2026-11-01&to=2026-11-30");
  check("check-ins and 7-day average (97.8)", ci.status === 200 && prog.data?.stats.latestAvg7 === 97.8, JSON.stringify(prog.data?.stats));
  const wo = await api(A.token, "POST", "/workouts", { date: MONDAY, split: "push", durationMin: 40, exercises: [{ name: "Bench press", sets: [{ reps: 8, weightKg: 60 }, { reps: 6, weightKg: 62.5 }] }] });
  const pr = await api(A.token, "GET", "/workouts/progression?exercise=bench%20press");
  check("workout saved via save_my_workout; progression works", wo.status === 201 && pr.data?.sessions.length === 1 && pr.data.bestEstimated1RmKg === 76, JSON.stringify(wo.error ?? pr.data));
  const groc = await api(A.token, "POST", "/grocery-lists/generate", {});
  const soya = groc.data?.items.find((i) => i.name.startsWith("Soya chunks"));
  check("grocery list generated from the plan (soya chunks summed)", groc.status === 200 && !!soya?.quantityLabel?.match(/\d/), JSON.stringify(groc.error ?? soya));

  // --- export from A, import into B --------------------------------------------------------
  const exp = await api(A.token, "GET", "/meal-plans/active/export");
  const imp = await api(B.token, "POST", "/meal-plans/active/import", exp.data);
  check("export from user A imports into user B", imp.status === 200 && imp.data.days[2].meals.find((m) => m.slot === "dinner")?.title === "E2E dinner", JSON.stringify(imp.error));

  // --- isolation between users --------------------------------------------------------------
  const bEntries = await api(B.token, "GET", `/food-entries?date=${MONDAY}`);
  check("user B cannot see user A's food log", bEntries.status === 200 && bEntries.data.length === 0);
  const bEdit = await api(B.token, "PUT", `/food-entries/${e1.data?.id}`, { name: "hacked" });
  const bDel = await api(B.token, "DELETE", `/food-entries/${e1.data?.id}`);
  check("user B cannot edit or delete user A's entry (404)", bEdit.status === 404 && bDel.status === 404);
  const bWorkout = await api(B.token, "GET", `/workouts/${wo.data?.id}`);
  check("user B cannot read user A's workout (404)", bWorkout.status === 404);
  const direct = await B.db.from("food_entries").select("id").eq("user_id", A.id);
  check("RLS: B querying Supabase directly for A's rows gets nothing", !direct.error && direct.data.length === 0, direct.error?.message);
  const noAuth = await fetch(`${API}/api/v1/days/${MONDAY}`);
  check("API without a token → 401", noAuth.status === 401);

  // --- reset day ---------------------------------------------------------------------------------
  day = await api(A.token, "POST", `/days/${MONDAY}/reset`, {});
  check("reset day keeps the logged paneer, clears ticks and snack", day.data?.entries.length === 1 && day.data.entries[0].name === "Low-fat paneer" && day.data.consumed.kcal === 210, JSON.stringify(day.data?.consumed));
} catch (err) {
  check("script ran without unexpected errors", false, err instanceof Error ? err.message : String(err));
} finally {
  // --- cleanup: always delete the test users --------------------------------------------------
  for (const id of created) {
    const { error } = await admin.auth.admin.deleteUser(id);
    check(`test user deleted (${id.slice(0, 8)}…)`, !error, error?.message);
  }
  if (created.length) {
    const tables = ["profiles", "food_entries", "meal_plans", "recipes", "daily_checkins", "habits", "workout_sessions", "grocery_lists", "nutrition_targets", "user_preferences"];
    let leftovers = 0;
    for (const t of tables) {
      const col = t === "profiles" ? "id" : "user_id";
      const { count } = await admin.from(t).select("*", { count: "exact", head: true }).in(col, created);
      leftovers += count ?? 0;
    }
    check("no test data left behind (cascade delete)", leftovers === 0, `${leftovers} rows remain`);
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
}
