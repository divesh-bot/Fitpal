import type { FoodRow, FoodsRepository } from "../repositories/foods.repository.js";
import { AppError } from "../utils/AppError.js";
import { isFromFood, type IngredientInput } from "../validators/ingredients.validators.js";
import { macrosForAmount, matchesExclusion, quantityLabel, sumMacros, type FoodBasis } from "./nutritionMath.js";

export type DietType = "veg" | "egg" | "non_veg";

/** Stored ingredient line (snake_case = the JSON the SQL write functions expect). */
export interface IngredientLine {
  food_item_id: string | null;
  name: string;
  quantity: number | null;
  unit: string | null;
  qty_label: string | null;
  kcal: number;
  protein_g: number;
  carbs_g: number | null;
  fat_g: number | null;
  diet_type: DietType;
}

/** Ingredient as returned by the API. */
export interface IngredientDto {
  id: string;
  position: number;
  foodItemId: string | null;
  name: string;
  quantity: number | null;
  unit: string | null;
  qtyLabel: string | null;
  kcal: number;
  proteinG: number;
  carbsG: number | null;
  fatG: number | null;
  dietType: DietType;
}

export interface IngredientRow {
  id: string;
  position: number;
  food_item_id: string | null;
  name: string;
  quantity: number | null;
  unit: string | null;
  qty_label: string | null;
  kcal: number;
  protein_g: number;
  carbs_g: number | null;
  fat_g: number | null;
  diet_type: string;
}

export const toIngredientDto = (r: IngredientRow): IngredientDto => ({
  id: r.id,
  position: r.position,
  foodItemId: r.food_item_id,
  name: r.name,
  quantity: r.quantity,
  unit: r.unit,
  qtyLabel: r.qty_label,
  kcal: r.kcal,
  proteinG: r.protein_g,
  carbsG: r.carbs_g,
  fatG: r.fat_g,
  dietType: r.diet_type as DietType,
});

/** Totals for a list of ingredients (rows or DTOs). */
export function totalsOf(
  items: readonly { kcal: number; proteinG: number; carbsG: number | null; fatG: number | null }[],
) {
  return sumMacros(items);
}

// ---------- dietary rules ----------

const DIET_RANK: Record<DietType, number> = { veg: 0, egg: 1, non_veg: 2 };
const NON_VEG_WORDS =
  /\b(chicken|mutton|lamb|goat|beef|pork|fish|prawns?|shrimp|crab|keema|meat|tuna|salmon|bacon|ham)\b/i;
// "egg"/"eggs"/"omelette" as whole words: "Eggplant" and "Paneer Bhurji" stay veg.
const EGG_WORDS = /\beggs?\b|\bomelet(te)?s?\b/i;
const EGG_WHITE = /\begg[\s-]*whites?\b|\bliquid\s+eggs?\b|\balbumen\b/i;

/** The stricter of the stated diet type and what the name implies. */
export function effectiveDietType(name: string, stated: DietType | undefined): DietType {
  const inferred: DietType = NON_VEG_WORDS.test(name) ? "non_veg" : EGG_WORDS.test(name) ? "egg" : "veg";
  const s = stated ?? "veg";
  return DIET_RANK[inferred] > DIET_RANK[s] ? inferred : s;
}

export const strictestDiet = (types: readonly DietType[]): DietType =>
  types.reduce<DietType>((acc, t) => (DIET_RANK[t] > DIET_RANK[acc] ? t : acc), "veg");

export interface DietRules {
  excludedFoods: readonly string[];
  wholeEggsOnly: boolean;
}

export function assertAllowed(name: string, rules: DietRules) {
  if (matchesExclusion(name, rules.excludedFoods)) {
    throw new AppError(422, "EXCLUDED_FOOD", `"${name}" is on your excluded foods list.`);
  }
  if (rules.wholeEggsOnly && EGG_WHITE.test(name)) {
    throw new AppError(422, "WHOLE_EGGS_ONLY", "Your rules allow whole eggs only — no separated or liquid egg whites.");
  }
}

// ---------- resolution ----------

/**
 * Turns user input into stored ingredient lines: food-linked items are
 * calculated from the food database (server-side, never trusted from the
 * client); manual items keep the given values. Dietary rules are enforced.
 */
export async function resolveIngredients(
  inputs: readonly IngredientInput[],
  foodsRepo: FoodsRepository,
  rules: DietRules,
): Promise<IngredientLine[]> {
  const ids = inputs.filter(isFromFood).map((i) => i.foodItemId);
  const foods = new Map<string, FoodRow>((await foodsRepo.getMany(ids)).map((f) => [f.id, f]));

  return inputs.map((input) => {
    if (isFromFood(input)) {
      const food = foods.get(input.foodItemId);
      if (!food) throw new AppError(422, "INVALID_REFERENCE", "A selected food does not exist or is not available.");
      const name = input.name ?? food.name;
      assertAllowed(food.name, rules);
      assertAllowed(name, rules);
      const basis = food.basis as FoodBasis;
      const m = macrosForAmount(
        { basis, kcal: food.kcal, proteinG: food.protein_g, carbsG: food.carbs_g, fatG: food.fat_g },
        input.amount,
      );
      return {
        food_item_id: food.id,
        name,
        quantity: input.amount,
        unit: food.unit_label,
        qty_label: input.qtyLabel ?? quantityLabel(basis, food.unit_label, input.amount),
        kcal: m.kcal,
        protein_g: m.proteinG,
        carbs_g: m.carbsG,
        fat_g: m.fatG,
        diet_type: effectiveDietType(name, food.diet_type as DietType),
      };
    }
    assertAllowed(input.name, rules);
    return {
      food_item_id: null,
      name: input.name,
      quantity: input.quantity ?? null,
      unit: input.unit ?? null,
      qty_label: input.qtyLabel ?? null,
      kcal: input.kcal,
      protein_g: input.proteinG,
      carbs_g: input.carbsG ?? null,
      fat_g: input.fatG ?? null,
      diet_type: effectiveDietType(input.name, input.dietType),
    };
  });
}

export const lineTotals = (lines: readonly IngredientLine[]) =>
  sumMacros(lines.map((l) => ({ kcal: l.kcal, proteinG: l.protein_g, carbsG: l.carbs_g, fatG: l.fat_g })));
