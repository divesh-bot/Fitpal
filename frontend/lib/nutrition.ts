import type { Food, FoodBasis, Macros } from "@/types/api";

/**
 * Client-side copy of the backend's nutrition maths, used ONLY for live
 * previews while typing. The server recalculates and is authoritative on save.
 */
const round1 = (n: number) => Math.round(n * 10) / 10;

export function macrosForAmount(food: Pick<Food, "basis" | "per">, amount: number): Macros {
  const f = food.basis === "per_unit" ? amount : amount / 100;
  return {
    kcal: Math.round(food.per.kcal * f),
    proteinG: round1(food.per.proteinG * f),
    carbsG: food.per.carbsG === null ? null : round1(food.per.carbsG * f),
    fatG: food.per.fatG === null ? null : round1(food.per.fatG * f),
  };
}

export function quantityLabel(basis: FoodBasis, unitLabel: string, amount: number) {
  if (basis !== "per_unit") return `${amount} ${unitLabel}`;
  return `${amount} ${unitLabel}${amount === 1 ? "" : "s"}`;
}

/** "per 100 g", "per 100 ml", "per egg" */
export const basisLabel = (f: Pick<Food, "basis" | "unitLabel">) =>
  f.basis === "per_unit" ? `per ${f.unitLabel}` : `per 100 ${f.unitLabel}`;

export function sumMacros(items: readonly Macros[]) {
  const known = (k: "carbsG" | "fatG") => items.map((i) => i[k]).filter((v): v is number => v !== null);
  const c = known("carbsG");
  const f = known("fatG");
  return {
    kcal: Math.round(items.reduce((a, i) => a + i.kcal, 0)),
    proteinG: round1(items.reduce((a, i) => a + i.proteinG, 0)),
    carbsG: c.length ? round1(c.reduce((a, b) => a + b, 0)) : null,
    fatG: f.length ? round1(f.reduce((a, b) => a + b, 0)) : null,
    carbsComplete: c.length === items.length,
    fatComplete: f.length === items.length,
  };
}

/** Client request id for idempotent creates (a retried submit never duplicates). */
export const newRequestId = () => crypto.randomUUID();
