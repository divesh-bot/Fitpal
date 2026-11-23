/**
 * Pure nutrition calculations (no database, no HTTP), shared by foods,
 * food entries, recipes and meal plans. Rounding matches the HTML prototype:
 * kcal to the nearest whole number, macros to 1 decimal place.
 */

export type FoodBasis = "per_100g" | "per_100ml" | "per_unit";

export interface NutritionPer {
  basis: FoodBasis;
  kcal: number;
  proteinG: number;
  /** null = unknown (e.g. no verified label value) — never treated as 0. */
  carbsG: number | null;
  fatG: number | null;
}

export interface Macros {
  kcal: number;
  proteinG: number;
  carbsG: number | null;
  fatG: number | null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Multiplier from an amount: grams/ml are per 100; units (eggs, rotis) are per 1. */
export function basisFactor(basis: FoodBasis, amount: number): number {
  if (!Number.isFinite(amount) || amount < 0) throw new RangeError("Amount must be a non-negative number");
  return basis === "per_unit" ? amount : amount / 100;
}

/** Nutrition for `amount` of a food (grams, millilitres, or units depending on basis). */
export function macrosForAmount(food: NutritionPer, amount: number): Macros {
  const f = basisFactor(food.basis, amount);
  return {
    kcal: Math.round(food.kcal * f),
    proteinG: round1(food.proteinG * f),
    carbsG: food.carbsG === null ? null : round1(food.carbsG * f),
    fatG: food.fatG === null ? null : round1(food.fatG * f),
  };
}

/**
 * Sums macros. kcal/protein are always known. For carbs/fat, the total is null
 * when NO item has a value; `complete` is false when only SOME items do, so the
 * UI can show "≥ 45 g carbs (some items unknown)" instead of a misleading number.
 */
export function sumMacros(items: readonly Macros[]): Macros & { carbsComplete: boolean; fatComplete: boolean } {
  const sumKnown = (key: "carbsG" | "fatG") => {
    const known = items.map((i) => i[key]).filter((v): v is number => v !== null);
    return {
      total: known.length === 0 ? null : round1(known.reduce((a, b) => a + b, 0)),
      complete: known.length === items.length,
    };
  };
  const carbs = sumKnown("carbsG");
  const fat = sumKnown("fatG");
  return {
    kcal: Math.round(items.reduce((a, i) => a + i.kcal, 0)),
    proteinG: round1(items.reduce((a, i) => a + i.proteinG, 0)),
    carbsG: carbs.total,
    fatG: fat.total,
    carbsComplete: carbs.complete,
    fatComplete: fat.complete,
  };
}

/** Human label like the prototype: "150 g", "450 ml", "2 eggs", "1 roti". */
export function quantityLabel(basis: FoodBasis, unitLabel: string, amount: number): string {
  if (basis !== "per_unit") return `${amount} ${unitLabel}`;
  return `${amount} ${unitLabel}${amount === 1 ? "" : "s"}`;
}

/** True if a food name matches one of the user's excluded foods (e.g. "tofu"). */
export function matchesExclusion(name: string, excluded: readonly string[]): boolean {
  const n = name.toLowerCase();
  return excluded.some((term) => term.length > 0 && n.includes(term.toLowerCase()));
}
