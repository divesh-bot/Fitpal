import { macrosForAmount, quantityLabel } from "@/lib/nutrition";
import type { DietType, Food, Ingredient, IngredientInput, Macros } from "@/types/api";

/**
 * A builder row is either calculated from a food in the list ("food"), or has
 * explicit values ("values": manual items, or lines loaded from a saved recipe,
 * which are sent back exactly as stored with their food link).
 */
export type BuilderRow =
  | { key: string; kind: "food"; food: Food; amount: number }
  | {
      key: string;
      kind: "values";
      linkedFoodItemId: string | null;
      name: string;
      qtyLabel: string;
      quantity: number | null;
      unit: string | null;
      macros: Macros;
      dietType: DietType;
    };

const key = () => crypto.randomUUID();

export const foodRow = (food: Food, amount: number): BuilderRow => ({ key: key(), kind: "food", food, amount });

export const manualRow = (name: string, qtyLabel: string, macros: Macros): BuilderRow => ({
  key: key(),
  kind: "values",
  linkedFoodItemId: null,
  name,
  qtyLabel,
  quantity: null,
  unit: null,
  macros,
  dietType: "veg",
});

export const rowFromIngredient = (i: Ingredient): BuilderRow => ({
  key: key(),
  kind: "values",
  linkedFoodItemId: i.foodItemId,
  name: i.name,
  qtyLabel: i.qtyLabel ?? "",
  quantity: i.quantity,
  unit: i.unit,
  macros: { kcal: i.kcal, proteinG: i.proteinG, carbsG: i.carbsG, fatG: i.fatG },
  dietType: i.dietType,
});

export const rowMacros = (r: BuilderRow): Macros => (r.kind === "food" ? macrosForAmount(r.food, r.amount) : r.macros);
export const rowName = (r: BuilderRow) => (r.kind === "food" ? r.food.name : r.name);
export const rowQty = (r: BuilderRow) =>
  r.kind === "food" ? quantityLabel(r.food.basis, r.food.unitLabel, r.amount) : r.qtyLabel;

export function toIngredientInput(r: BuilderRow): IngredientInput {
  if (r.kind === "food") return { foodItemId: r.food.id, amount: r.amount };
  return {
    ...(r.linkedFoodItemId ? { linkedFoodItemId: r.linkedFoodItemId } : {}),
    name: r.name,
    qtyLabel: r.qtyLabel || undefined,
    quantity: r.quantity,
    unit: r.unit,
    kcal: r.macros.kcal,
    proteinG: r.macros.proteinG,
    carbsG: r.macros.carbsG,
    fatG: r.macros.fatG,
    dietType: r.dietType,
  };
}
