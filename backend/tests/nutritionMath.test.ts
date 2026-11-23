import { describe, expect, it } from "vitest";
import {
  macrosForAmount,
  matchesExclusion,
  quantityLabel,
  sumMacros,
  type NutritionPer,
} from "../src/services/nutritionMath.js";

// Values copied from the seeded food database (prototype FOOD_DB).
const lowFatPaneer: NutritionPer = { basis: "per_100g", kcal: 140, proteinG: 18, carbsG: 3, fatG: 6 };
const egg: NutritionPer = { basis: "per_unit", kcal: 72, proteinG: 6.3, carbsG: 0.4, fatG: 4.8 };
const cdMilk: NutritionPer = { basis: "per_100ml", kcal: 65.1, proteinG: 5.56, carbsG: null, fatG: null };
const oats: NutritionPer = { basis: "per_100g", kcal: 390, proteinG: 13, carbsG: 67, fatG: 7 };

describe("macrosForAmount", () => {
  it("matches the plan: low-fat paneer 150 g = 210 kcal / 27 g protein", () => {
    expect(macrosForAmount(lowFatPaneer, 150)).toEqual({ kcal: 210, proteinG: 27, carbsG: 4.5, fatG: 9 });
  });

  it("per-unit foods: 2 whole eggs = 144 kcal / 12.6 g protein", () => {
    expect(macrosForAmount(egg, 2)).toMatchObject({ kcal: 144, proteinG: 12.6 });
  });

  it("Country Delight milk 450 ml = 293 kcal / 25 g protein, carbs & fat unknown", () => {
    expect(macrosForAmount(cdMilk, 450)).toEqual({ kcal: 293, proteinG: 25, carbsG: null, fatG: null });
  });

  it("oats 40 g = 156 kcal", () => {
    expect(macrosForAmount(oats, 40).kcal).toBe(156);
  });

  it("zero amount gives zero", () => {
    expect(macrosForAmount(oats, 0)).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid amount %s", (amount) => {
    expect(() => macrosForAmount(oats, amount)).toThrow(RangeError);
  });
});

describe("sumMacros", () => {
  it("sums kcal and protein; carbs/fat flagged incomplete when some are unknown", () => {
    const total = sumMacros([macrosForAmount(oats, 40), macrosForAmount(cdMilk, 450)]);
    expect(total).toMatchObject({ kcal: 449, proteinG: 30.2, carbsG: 26.8, carbsComplete: false, fatComplete: false });
  });

  it("carbs/fat are null when nothing is known, complete when everything is", () => {
    expect(sumMacros([macrosForAmount(cdMilk, 100)])).toMatchObject({ carbsG: null, carbsComplete: false });
    expect(sumMacros([macrosForAmount(oats, 100)])).toMatchObject({ carbsG: 67, carbsComplete: true });
  });

  it("empty list is all zeros", () => {
    expect(sumMacros([])).toMatchObject({ kcal: 0, proteinG: 0, carbsG: null });
  });
});

describe("helpers", () => {
  it("quantity labels match the prototype", () => {
    expect(quantityLabel("per_100g", "g", 150)).toBe("150 g");
    expect(quantityLabel("per_100ml", "ml", 450)).toBe("450 ml");
    expect(quantityLabel("per_unit", "egg", 2)).toBe("2 eggs");
    expect(quantityLabel("per_unit", "roti", 1)).toBe("1 roti");
  });

  it("detects excluded foods case-insensitively", () => {
    expect(matchesExclusion("Silken Tofu", ["tofu"])).toBe(true);
    expect(matchesExclusion("Low-fat paneer", ["tofu"])).toBe(false);
    expect(matchesExclusion("anything", [])).toBe(false);
  });
});
