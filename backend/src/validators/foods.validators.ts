import { z } from "zod";
import { nonEmpty, optionalText, uuid } from "./common.js";

const basis = z.enum(["per_100g", "per_100ml", "per_unit"]);
const dietType = z.enum(["veg", "egg", "non_veg"]);

const foodFields = {
  name: z.string().trim().min(1).max(120),
  brand: optionalText(80),
  basis,
  unitLabel: z.string().trim().min(1).max(20),
  defaultAmount: z.number().positive().max(5000),
  kcal: z.number().min(0).max(2000),
  proteinG: z.number().min(0).max(1000),
  carbsG: z.number().min(0).max(1000).nullable().default(null),
  fatG: z.number().min(0).max(1000).nullable().default(null),
  dietType: dietType.default("veg"),
  notes: optionalText(500),
};

/** Per-100 g/ml values can't contain more than 100 g of macronutrients (small tolerance for label rounding). */
function macrosFit(v: { basis?: string; proteinG?: number; carbsG?: number | null; fatG?: number | null }) {
  if (v.basis === "per_unit" || v.basis === undefined) return true;
  return (v.proteinG ?? 0) + (v.carbsG ?? 0) + (v.fatG ?? 0) <= 105;
}
const macrosMessage = { message: "Protein + carbs + fat cannot exceed 100 g per 100 g/ml", path: ["proteinG"] };

export const foodCreateSchema = z
  .object(foodFields)
  .strict()
  .transform((v) => ({ ...v, unitLabel: v.basis === "per_100g" ? "g" : v.basis === "per_100ml" ? "ml" : v.unitLabel }))
  .refine(macrosFit, macrosMessage);
export type FoodCreate = z.output<typeof foodCreateSchema>;

export const foodUpdateSchema = z
  .object({
    name: foodFields.name.optional(),
    brand: foodFields.brand,
    basis: basis.optional(),
    unitLabel: foodFields.unitLabel.optional(),
    defaultAmount: foodFields.defaultAmount.optional(),
    kcal: foodFields.kcal.optional(),
    proteinG: foodFields.proteinG.optional(),
    carbsG: z.number().min(0).max(1000).nullable().optional(),
    fatG: z.number().min(0).max(1000).nullable().optional(),
    dietType: dietType.optional(),
    notes: foodFields.notes,
  })
  .strict()
  .refine(nonEmpty, "Provide at least one field to update")
  .refine(macrosFit, macrosMessage);
export type FoodUpdate = z.output<typeof foodUpdateSchema>;

export const foodSearchSchema = z
  .object({
    q: z.string().trim().max(60).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(10_000).default(0),
  })
  .strict();

export const idParamSchema = z.object({ id: uuid });
