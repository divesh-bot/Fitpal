import type { AccountRepository } from "../repositories/account.repository.js";
import type { FoodsRepository } from "../repositories/foods.repository.js";
import type { MealPlansRepository, MealSlot, PlanMealRow, PlanRow } from "../repositories/mealPlans.repository.js";
import type { RecipesRepository } from "../repositories/recipes.repository.js";
import type { Json } from "../types/database.types.js";
import { AppError } from "../utils/AppError.js";
import type { MealSaveInput, PlanFileV1, PrototypeFile } from "../validators/mealPlans.validators.js";
import {
  assertAllowed,
  effectiveDietType,
  resolveIngredients,
  strictestDiet,
  toIngredientDto,
  totalsOf,
  type DietType,
  type IngredientDto,
} from "./ingredients.service.js";
import { dietRules } from "./recipes.service.js";

export const SLOT_ORDER: MealSlot[] = ["post_workout", "breakfast", "lunch", "dinner"];
export const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

export interface PlanMealDto {
  id: string;
  slot: MealSlot;
  title: string;
  note: string | null;
  ingredients: IngredientDto[];
  totals: ReturnType<typeof totalsOf>;
  dietType: DietType;
}
export interface PlanDayDto {
  weekday: number;
  dayName: string;
  isStrictVeg: boolean;
  meals: PlanMealDto[];
  plannedTotals: ReturnType<typeof totalsOf>;
}
export interface PlanDto {
  id: string;
  name: string;
  updatedAt: string;
  days: PlanDayDto[];
}

export function toMealDto(m: PlanMealRow): PlanMealDto {
  const ingredients = [...m.meal_plan_meal_ingredients].sort((a, b) => a.position - b.position).map(toIngredientDto);
  return {
    id: m.id,
    slot: m.slot as MealSlot,
    title: m.title,
    note: m.note,
    ingredients,
    totals: totalsOf(ingredients),
    dietType: strictestDiet(ingredients.map((i) => i.dietType)),
  };
}

export function toPlanDto(p: PlanRow): PlanDto {
  const days = [...p.meal_plan_days]
    .sort((a, b) => a.weekday - b.weekday)
    .map((d) => {
      const meals = [...d.meal_plan_meals]
        .sort((a, b) => SLOT_ORDER.indexOf(a.slot as MealSlot) - SLOT_ORDER.indexOf(b.slot as MealSlot))
        .map(toMealDto);
      return {
        weekday: d.weekday,
        dayName: DAY_NAMES[d.weekday - 1]!,
        isStrictVeg: d.is_strict_veg,
        meals,
        plannedTotals: totalsOf(meals.map((m) => m.totals)),
      };
    });
  return { id: p.id, name: p.name, updatedAt: p.updated_at, days };
}

async function activePlan(repo: MealPlansRepository) {
  const p = await repo.getActive();
  if (!p) throw AppError.notFound("You don't have an active meal plan. Reset to the default plan to create one.");
  return p;
}

export async function getActivePlan(repo: MealPlansRepository) {
  return toPlanDto(await activePlan(repo));
}

/** The planned meal for a weekday/slot (or null), used by the daily log. */
export async function getPlannedMeal(repo: MealPlansRepository, weekday: number, slot: MealSlot) {
  const plan = await activePlan(repo);
  const day = plan.meal_plan_days.find((d) => d.weekday === weekday);
  const meal = day?.meal_plan_meals.find((m) => m.slot === slot);
  return meal ? toMealDto(meal) : null;
}

const vegError = (what: string) =>
  new AppError(
    422,
    "STRICT_VEG_VIOLATION",
    `${what} is a strictly vegetarian day: egg and non-veg items aren't allowed.`,
  );

export async function saveMeal(
  repos: { mealPlans: MealPlansRepository; foods: FoodsRepository; account: AccountRepository },
  weekday: number,
  slot: MealSlot,
  input: MealSaveInput,
) {
  const plan = await activePlan(repos.mealPlans);
  const lines = await resolveIngredients(input.ingredients, repos.foods, await dietRules(repos.account));
  // Friendly check first; the database trigger enforces the same rule.
  const day = plan.meal_plan_days.find((d) => d.weekday === weekday);
  if (day?.is_strict_veg && lines.some((l) => l.diet_type !== "veg")) throw vegError(DAY_NAMES[weekday - 1]!);

  await repos.mealPlans.saveMeal(weekday, slot, { title: input.title, note: input.note ?? null, ingredients: lines });
  return getActivePlan(repos.mealPlans);
}

export async function deleteMeal(repo: MealPlansRepository, weekday: number, slot: MealSlot) {
  if (!(await repo.deleteMeal(weekday, slot))) throw AppError.notFound("There is no meal in that slot.");
  return getActivePlan(repo);
}

export async function copyMeal(repo: MealPlansRepository, fromWeekday: number, slot: MealSlot, toWeekdays: number[]) {
  const plan = await activePlan(repo);
  const source = plan.meal_plan_days
    .find((d) => d.weekday === fromWeekday)
    ?.meal_plan_meals.find((m) => m.slot === slot);
  if (!source) throw AppError.notFound("There is no meal in that slot to copy.");
  const sourceDiet = toMealDto(source).dietType;
  const blocked = plan.meal_plan_days.find(
    (d) => toWeekdays.includes(d.weekday) && d.is_strict_veg && d.weekday !== fromWeekday,
  );
  if (blocked && sourceDiet !== "veg") throw vegError(DAY_NAMES[blocked.weekday - 1]!);

  const copied = await repo.copyMeal(fromWeekday, slot, toWeekdays);
  return { copied, plan: await getActivePlan(repo) };
}

export async function setStrictVeg(repo: MealPlansRepository, weekday: number, isStrictVeg: boolean) {
  if (isStrictVeg) {
    const day = (await activePlan(repo)).meal_plan_days.find((d) => d.weekday === weekday);
    const offending = day?.meal_plan_meals.find((m) => toMealDto(m).dietType !== "veg");
    if (offending) {
      throw new AppError(
        422,
        "STRICT_VEG_VIOLATION",
        `"${offending.title}" contains egg or non-veg items. Change it before marking ${DAY_NAMES[weekday - 1]} strictly vegetarian.`,
      );
    }
  }
  if (!(await repo.setStrictVeg(weekday, isStrictVeg))) throw AppError.notFound("Day not found in your active plan.");
  return getActivePlan(repo);
}

// ---------- export / import ----------

export async function exportPlan(repos: {
  mealPlans: MealPlansRepository;
  recipes: RecipesRepository;
  foods: FoodsRepository;
}) {
  const plan = await activePlan(repos.mealPlans);
  const snacks = (await repos.recipes.list()).filter((r) => r.category !== "meal");
  const foodIds = [
    ...plan.meal_plan_days.flatMap((d) =>
      d.meal_plan_meals.flatMap((m) => m.meal_plan_meal_ingredients.map((i) => i.food_item_id)),
    ),
    ...snacks.flatMap((s) => s.recipe_ingredients.map((i) => i.food_item_id)),
  ].filter((id): id is string => id !== null);
  const seedKeys = new Map((await repos.foods.getMany(foodIds)).map((f) => [f.id, f.seed_key]));

  const ing = (i: {
    name: string;
    qty_label: string | null;
    quantity: number | null;
    unit: string | null;
    kcal: number;
    protein_g: number;
    carbs_g: number | null;
    fat_g: number | null;
    diet_type: string;
    food_item_id: string | null;
    position: number;
  }) => ({
    name: i.name,
    qtyLabel: i.qty_label,
    quantity: i.quantity,
    unit: i.unit,
    kcal: i.kcal,
    proteinG: i.protein_g,
    carbsG: i.carbs_g,
    fatG: i.fat_g,
    dietType: i.diet_type,
    foodKey: i.food_item_id ? (seedKeys.get(i.food_item_id) ?? null) : null,
  });
  const byPos = <T extends { position: number }>(a: T[]) => [...a].sort((x, y) => x.position - y.position);

  return {
    version: 1 as const,
    app: "FitPal",
    exportedAt: new Date().toISOString(),
    name: plan.name,
    days: [...plan.meal_plan_days]
      .sort((a, b) => a.weekday - b.weekday)
      .map((d) => ({
        weekday: d.weekday,
        isStrictVeg: d.is_strict_veg,
        meals: [...d.meal_plan_meals]
          .sort((a, b) => SLOT_ORDER.indexOf(a.slot as MealSlot) - SLOT_ORDER.indexOf(b.slot as MealSlot))
          .map((m) => ({
            slot: m.slot,
            title: m.title,
            note: m.note,
            ingredients: byPos(m.meal_plan_meal_ingredients).map(ing),
          })),
      })),
    snacks: snacks.map((s) => ({
      kind: s.category === "snack_sweet" ? "sweet" : "salty",
      name: s.name,
      description: s.description,
      ingredients: byPos(s.recipe_ingredients).map(ing),
    })),
  };
}

const PROTOTYPE_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const PROTOTYPE_SLOTS = {
  postWorkout: "post_workout",
  breakfast: "breakfast",
  lunch: "lunch",
  dinner: "dinner",
} as const;

/** "60 g dry" → { quantity: 60, unit: "g" }; "as needed" → nulls. */
export function parseQtyLabel(label: string) {
  const m = /^\s*(\d+(?:\.\d+)?)\s*([a-z]+)?/i.exec(label);
  return m ? { quantity: Number(m[1]), unit: m[2]?.toLowerCase() ?? null } : { quantity: null, unit: null };
}

/** Converts the HTML prototype's export (version 2) into FitPal's plan format. */
export function fromPrototypeFile(file: PrototypeFile): PlanFileV1 {
  const days = PROTOTYPE_DAYS.map((key, idx) => {
    const day = file.plan[key];
    const meals = Object.entries(PROTOTYPE_SLOTS).flatMap(([pKey, slot]) => {
      const meal = day?.[pKey as keyof typeof PROTOTYPE_SLOTS];
      if (!meal) return [];
      return [
        {
          slot,
          title: meal.title,
          note: meal.note ?? null,
          ingredients: meal.ingredients.map((i) => ({
            name: i.name,
            qtyLabel: i.qty || null,
            ...parseQtyLabel(i.qty),
            kcal: i.kcal,
            proteinG: i.protein,
            carbsG: null,
            fatG: null,
          })),
        },
      ];
    });
    return { weekday: idx + 1, isStrictVeg: file.vegDays?.[key] === true, meals };
  });
  const snack =
    (kind: "sweet" | "salty") => (s: { name: string; detail?: string | undefined; kcal: number; protein: number }) => ({
      kind,
      name: s.name,
      description: s.detail ?? null,
      ingredients: [
        {
          name: `${s.name} (as planned)`,
          qtyLabel: "1 serving",
          quantity: 1,
          unit: "serving",
          kcal: s.kcal,
          proteinG: s.protein,
          carbsG: null,
          fatG: null,
        },
      ],
    });
  return {
    version: 1,
    name: "Imported from prototype",
    days,
    ...(file.snacks
      ? { snacks: [...file.snacks.sweet.map(snack("sweet")), ...file.snacks.salty.map(snack("salty"))] }
      : {}),
  };
}

/**
 * Applies dietary rules to an imported plan: excluded foods and egg whites are
 * rejected, diet types can only become stricter, and strict-veg days are checked
 * up front so the user gets a clear message (the database enforces it too).
 */
export function checkImportedPlan(
  plan: PlanFileV1,
  rules: { excludedFoods: readonly string[]; wholeEggsOnly: boolean },
): PlanFileV1 {
  const fix = <T extends { name: string; dietType?: DietType | undefined }>(i: T) => {
    assertAllowed(i.name, rules);
    return { ...i, dietType: effectiveDietType(i.name, i.dietType) };
  };
  const days = plan.days.map((d) => {
    const meals = d.meals.map((m) => ({ ...m, ingredients: m.ingredients.map(fix) }));
    if (d.isStrictVeg) {
      const bad = meals.find((m) => m.ingredients.some((i) => i.dietType !== "veg"));
      if (bad) {
        throw new AppError(
          422,
          "STRICT_VEG_VIOLATION",
          `${DAY_NAMES[d.weekday - 1]} is marked strictly vegetarian but "${bad.title}" contains egg or non-veg items.`,
        );
      }
    }
    return { ...d, meals };
  });
  const snacks = plan.snacks?.map((s) => ({ ...s, ingredients: s.ingredients.map(fix) }));
  return { ...plan, days, ...(snacks ? { snacks } : {}) };
}

export async function importPlan(
  repos: { mealPlans: MealPlansRepository; account: AccountRepository },
  plan: PlanFileV1,
) {
  const checked = checkImportedPlan(plan, await dietRules(repos.account));
  await repos.mealPlans.replace(checked as unknown as Json);
  return getActivePlan(repos.mealPlans);
}

export async function resetPlan(repo: MealPlansRepository) {
  await repo.resetToDefault();
  return getActivePlan(repo);
}
