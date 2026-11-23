import type { Repositories } from "../repositories/index.js";
import type { FoodEntryInsert, FoodEntryRow } from "../repositories/foodEntries.repository.js";
import type { MealSlot } from "../repositories/mealPlans.repository.js";
import { AppError } from "../utils/AppError.js";
import type { EntryCreateInput, EntryUpdateInput } from "../validators/daily.validators.js";
import { getTargetsOn, type TargetsDto } from "./account.service.js";
import { DAY_NAMES, SLOT_ORDER, toMealDto } from "./mealPlans.service.js";
import { macrosForAmount, quantityLabel, sumMacros, type FoodBasis, type Macros } from "./nutritionMath.js";
import { isoWeekday } from "./progressMath.js";
import { getRecipe } from "./recipes.service.js";
import { setHabitByKey, toCheckinDto, type CheckinDto } from "./tracking.service.js";

type DailyRepos = Pick<
  Repositories,
  "foodEntries" | "foods" | "recipes" | "mealPlans" | "account" | "habits" | "checkins" | "workouts"
>;

// ---------- DTO ----------

export interface FoodEntryDto {
  id: string;
  date: string;
  mealSlot: string;
  source: "manual" | "food_item" | "recipe" | "plan_meal" | "snack";
  name: string;
  quantity: number | null;
  unit: string | null;
  qtyLabel: string | null;
  kcal: number;
  proteinG: number;
  carbsG: number | null;
  fatG: number | null;
  foodItemId: string | null;
  recipeId: string | null;
  planMealId: string | null;
  snackKind: "sweet" | "salty" | null;
  createdAt: string;
}

export const toEntryDto = (r: FoodEntryRow): FoodEntryDto => ({
  id: r.id,
  date: r.entry_date,
  mealSlot: r.meal_slot,
  source: r.source as FoodEntryDto["source"],
  name: r.name,
  quantity: r.quantity,
  unit: r.unit,
  qtyLabel: r.qty_label,
  kcal: r.kcal,
  proteinG: r.protein_g,
  carbsG: r.carbs_g,
  fatG: r.fat_g,
  foodItemId: r.food_item_id,
  recipeId: r.recipe_id,
  planMealId: r.plan_meal_id,
  snackKind: r.snack_kind as FoodEntryDto["snackKind"],
  createdAt: r.created_at,
});

const r1 = (n: number) => Math.round(n * 10) / 10;
const servingsLabel = (s: number) => `${s} serving${s === 1 ? "" : "s"}`;

/** Totals with unknown carbs/fat recorded as null rather than a partial number. */
const honest = (t: ReturnType<typeof sumMacros>): Macros => ({
  kcal: t.kcal,
  proteinG: t.proteinG,
  carbsG: t.carbsComplete ? t.carbsG : null,
  fatG: t.fatComplete ? t.fatG : null,
});

async function foodSnapshot(repos: DailyRepos, foodItemId: string, amount: number) {
  const food = await repos.foods.get(foodItemId);
  if (!food) throw new AppError(422, "INVALID_REFERENCE", "That food does not exist or is not available.");
  const basis = food.basis as FoodBasis;
  const m = macrosForAmount(
    { basis, kcal: food.kcal, proteinG: food.protein_g, carbsG: food.carbs_g, fatG: food.fat_g },
    amount,
  );
  return {
    name: food.name,
    quantity: amount,
    unit: food.unit_label,
    qty_label: quantityLabel(basis, food.unit_label, amount),
    kcal: m.kcal,
    protein_g: m.proteinG,
    carbs_g: m.carbsG,
    fat_g: m.fatG,
  };
}

async function recipeSnapshot(repos: DailyRepos, recipeId: string, servings: number) {
  const recipe = await getRecipe(repos.recipes, recipeId).catch((e: unknown) => {
    if (e instanceof AppError && e.statusCode === 404)
      throw new AppError(422, "INVALID_REFERENCE", "That recipe does not exist.");
    throw e;
  });
  const p = honest({ ...recipe.totals });
  const f = servings / recipe.servings;
  return {
    recipe,
    values: {
      name: recipe.name,
      quantity: servings,
      unit: "serving",
      qty_label: servingsLabel(servings),
      kcal: Math.round(p.kcal * f),
      protein_g: r1(p.proteinG * f),
      carbs_g: p.carbsG === null ? null : r1(p.carbsG * f),
      fat_g: p.fatG === null ? null : r1(p.fatG * f),
    },
  };
}

// ---------- food entries ----------

export async function listEntries(repos: DailyRepos, from: string, to: string) {
  return (await repos.foodEntries.list(from, to)).map(toEntryDto);
}

/**
 * Logs food. Nutrition is calculated on the server for food/recipe entries and
 * stored as a snapshot. Returns `created: false` when a retried request with
 * the same clientRequestId already succeeded (no duplicate is created).
 */
export async function createEntry(
  repos: DailyRepos,
  input: EntryCreateInput,
): Promise<{ entry: FoodEntryDto; created: boolean }> {
  if (input.clientRequestId) {
    const existing = await repos.foodEntries.findByClientRequestId(input.clientRequestId);
    if (existing) return { entry: toEntryDto(existing), created: false };
  }

  const base = { entry_date: input.date, meal_slot: input.mealSlot, client_request_id: input.clientRequestId ?? null };
  let row: FoodEntryInsert;
  if (input.source === "manual") {
    row = {
      ...base,
      source: "manual",
      name: input.name,
      qty_label: input.qtyLabel ?? null,
      kcal: input.kcal,
      protein_g: input.proteinG,
      carbs_g: input.carbsG ?? null,
      fat_g: input.fatG ?? null,
    };
  } else if (input.source === "food_item") {
    row = {
      ...base,
      source: "food_item",
      food_item_id: input.foodItemId,
      ...(await foodSnapshot(repos, input.foodItemId, input.amount)),
    };
  } else {
    const { values } = await recipeSnapshot(repos, input.recipeId, input.servings);
    row = { ...base, source: "recipe", recipe_id: input.recipeId, ...values };
  }

  try {
    return { entry: toEntryDto(await repos.foodEntries.insert(row)), created: true };
  } catch (e) {
    // Two identical requests raced: return the one that won.
    if (e instanceof AppError && e.code === "CONFLICT" && input.clientRequestId) {
      const existing = await repos.foodEntries.findByClientRequestId(input.clientRequestId);
      if (existing) return { entry: toEntryDto(existing), created: false };
    }
    throw e;
  }
}

export async function updateEntry(repos: DailyRepos, id: string, input: EntryUpdateInput) {
  const entry = await repos.foodEntries.get(id);
  if (!entry) throw AppError.notFound("Food entry not found.");

  const reject = (msg: string) => {
    throw new AppError(422, "NOT_EDITABLE", msg);
  };
  if (entry.source === "plan_meal" || entry.source === "snack") {
    reject("Planned meals and snacks are changed by ticking/selecting them on the day, not edited directly.");
  }
  const manualFields = ["qtyLabel", "kcal", "proteinG", "carbsG", "fatG"] as const;
  const usesManual = manualFields.some((f) => input[f] !== undefined);
  if (usesManual && entry.source !== "manual") reject("Nutrition values can only be edited on manually entered foods.");
  if (input.amount !== undefined && entry.source !== "food_item")
    reject("'amount' applies only to foods logged from the food list.");
  if (input.servings !== undefined && entry.source !== "recipe") reject("'servings' applies only to logged recipes.");

  let patch: Record<string, unknown> = {
    meal_slot: input.mealSlot,
    name: input.name,
    qty_label: input.qtyLabel,
    kcal: input.kcal,
    protein_g: input.proteinG,
    carbs_g: input.carbsG,
    fat_g: input.fatG,
  };
  if (input.amount !== undefined) {
    if (!entry.food_item_id) reject("The original food was deleted, so this entry can no longer be recalculated.");
    const { name: _n, ...snap } = await foodSnapshot(repos, entry.food_item_id!, input.amount);
    patch = { ...patch, ...snap };
  }
  if (input.servings !== undefined) {
    if (!entry.recipe_id) reject("The original recipe was deleted, so this entry can no longer be recalculated.");
    const { values } = await recipeSnapshot(repos, entry.recipe_id!, input.servings);
    const { name: _n, ...snap } = values;
    patch = { ...patch, ...snap };
  }

  const row = await repos.foodEntries.update(id, patch);
  if (!row) throw AppError.notFound("Food entry not found.");
  return toEntryDto(row);
}

export async function deleteEntry(repos: DailyRepos, id: string) {
  if (!(await repos.foodEntries.delete(id))) throw AppError.notFound("Food entry not found.");
}

// ---------- day actions (Today screen) ----------

/** Ticks/unticks a planned meal: ticking stores a snapshot of the planned meal's totals. */
export async function setPlanMealEaten(repos: DailyRepos, date: string, slot: MealSlot, eaten: boolean) {
  if (!eaten) {
    await repos.foodEntries.deletePlanMeal(date, slot);
    return null;
  }
  const existing = await repos.foodEntries.findPlanMeal(date, slot);
  if (existing) return toEntryDto(existing);

  const weekday = isoWeekday(date);
  const plan = await repos.mealPlans.getActive();
  const mealRow = plan?.meal_plan_days.find((d) => d.weekday === weekday)?.meal_plan_meals.find((m) => m.slot === slot);
  if (!mealRow)
    throw AppError.notFound(`There is no planned ${slot.replace("_", "-")} meal on ${DAY_NAMES[weekday - 1]}.`);
  const meal = toMealDto(mealRow);
  const t = honest(meal.totals);

  let row: FoodEntryRow;
  try {
    row = await repos.foodEntries.insert({
      entry_date: date,
      meal_slot: slot,
      source: "plan_meal",
      plan_meal_id: meal.id,
      name: meal.title,
      qty_label: "As planned",
      kcal: t.kcal,
      protein_g: t.proteinG,
      carbs_g: t.carbsG,
      fat_g: t.fatG,
    });
  } catch (e) {
    if (e instanceof AppError && e.code === "CONFLICT") {
      const again = await repos.foodEntries.findPlanMeal(date, slot);
      if (again) return toEntryDto(again);
    }
    throw e;
  }
  // Prototype behaviour: having the post-workout protein milk + creatine ticks creatine.
  if (slot === "post_workout") await setHabitByKey(repos.habits, "creatine", date, true);
  return toEntryDto(row);
}

/** Chooses the day's sweet or salty snack (null clears it). */
export async function setSnack(repos: DailyRepos, date: string, kind: "sweet" | "salty", recipeId: string | null) {
  if (recipeId === null) {
    await repos.foodEntries.setSnack(date, kind, null);
    return null;
  }
  const { recipe, values } = await recipeSnapshot(repos, recipeId, 1);
  if (recipe.category !== `snack_${kind}`) {
    throw new AppError(422, "WRONG_SNACK_KIND", `"${recipe.name}" is not a ${kind} snack option.`);
  }
  await repos.foodEntries.setSnack(date, kind, {
    recipe_id: recipe.id,
    name: values.name,
    qty_label: values.qty_label,
    kcal: values.kcal,
    protein_g: values.protein_g,
    carbs_g: values.carbs_g,
    fat_g: values.fat_g,
  });
  const entries = await repos.foodEntries.list(date, date);
  const row = entries.find((e) => e.snack_kind === kind);
  return row ? toEntryDto(row) : null;
}

export async function resetDay(repos: DailyRepos, date: string) {
  await repos.foodEntries.resetDay(date);
}

// ---------- daily summary ----------

export interface DailyNutrition {
  date: string;
  weekday: number;
  dayName: string;
  isStrictVegDay: boolean;
  target: TargetsDto;
  consumed: ReturnType<typeof sumMacros>;
  planned: ReturnType<typeof sumMacros> | null;
  remaining: { kcal: number; proteinG: number };
  progress: { kcalPct: number; proteinPct: number };
  planMeals: {
    slot: MealSlot;
    mealId: string | null;
    title: string | null;
    kcal: number;
    proteinG: number;
    eaten: boolean;
    entryId: string | null;
  }[];
  snacks: { sweet: FoodEntryDto | null; salty: FoodEntryDto | null };
  entries: FoodEntryDto[];
}

export async function dailyNutrition(repos: DailyRepos, date: string): Promise<DailyNutrition> {
  const weekday = isoWeekday(date);
  const [target, rows, plan] = await Promise.all([
    getTargetsOn(repos.account, date),
    repos.foodEntries.list(date, date),
    repos.mealPlans.getActive(),
  ]);
  const entries = rows.map(toEntryDto);
  const consumed = sumMacros(entries);
  const day = plan?.meal_plan_days.find((d) => d.weekday === weekday);
  const meals = (day?.meal_plan_meals ?? []).map(toMealDto);

  const planMeals = SLOT_ORDER.map((slot) => {
    const meal = meals.find((m) => m.slot === slot);
    const entry = entries.find((e) => e.source === "plan_meal" && e.mealSlot === slot);
    return {
      slot,
      mealId: meal?.id ?? null,
      title: meal?.title ?? null,
      kcal: meal?.totals.kcal ?? 0,
      proteinG: meal?.totals.proteinG ?? 0,
      eaten: entry !== undefined,
      entryId: entry?.id ?? null,
    };
  });

  const pct = (v: number, t: number) => (t > 0 ? Math.round((v / t) * 100) : 0);
  return {
    date,
    weekday,
    dayName: DAY_NAMES[weekday - 1]!,
    isStrictVegDay: day?.is_strict_veg ?? false,
    target,
    consumed,
    planned: day ? sumMacros(meals.map((m) => m.totals)) : null,
    remaining: { kcal: target.caloriesKcal - consumed.kcal, proteinG: r1(target.proteinG - consumed.proteinG) },
    progress: { kcalPct: pct(consumed.kcal, target.caloriesKcal), proteinPct: pct(consumed.proteinG, target.proteinG) },
    planMeals,
    snacks: {
      sweet: entries.find((e) => e.snackKind === "sweet") ?? null,
      salty: entries.find((e) => e.snackKind === "salty") ?? null,
    },
    entries,
  };
}

/** Everything the Today screen needs for one date in a single request. */
export async function daySummary(repos: DailyRepos, date: string) {
  const [nutrition, habits, logs, checkinRow, workouts] = await Promise.all([
    dailyNutrition(repos, date),
    repos.habits.list(false),
    repos.habits.logs(date, date),
    repos.checkins.get(date),
    repos.workouts.list({ from: date, to: date, limit: 10 }),
  ]);
  const done = new Set(logs.filter((l) => l.completed).map((l) => l.habit_id));
  const checkin: CheckinDto | null = checkinRow ? toCheckinDto(checkinRow) : null;
  return {
    ...nutrition,
    steps: { count: checkin?.steps ?? 0, target: nutrition.target.steps },
    habits: habits.map((h) => ({ id: h.id, key: h.key, name: h.name, done: done.has(h.id) })),
    checkin,
    workouts: workouts.map((w) => ({
      id: w.id,
      split: w.split,
      durationMin: w.duration_min,
      exercises: w.workout_exercises.length,
    })),
  };
}
