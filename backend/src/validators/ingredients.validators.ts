import { z } from "zod";
import { uuid } from "./common.js";

const dietType = z.enum(["veg", "egg", "non_veg"]);

/** An ingredient calculated from a food in the database: "150 g of food X". */
const fromFood = z
  .object({
    foodItemId: uuid,
    amount: z.number().positive().max(10_000),
    /** Optional display overrides, e.g. name "Soya chunks", label "60 g dry". */
    name: z.string().trim().min(1).max(120).optional(),
    qtyLabel: z.string().trim().max(40).optional(),
  })
  .strict();

/**
 * An ingredient with explicit nutrition values: either typed in manually, or an
 * existing line being kept as-is. `linkedFoodItemId` preserves an existing
 * line's link to a food WITHOUT recalculating it, so re-saving a meal never
 * silently changes stored values (e.g. the plan's 35 kcal tomato base).
 */
const manual = z
  .object({
    linkedFoodItemId: uuid.optional(),
    name: z.string().trim().min(1).max(120),
    qtyLabel: z.string().trim().max(40).optional(),
    quantity: z.number().min(0).max(100_000).nullable().optional(),
    unit: z.string().trim().max(20).nullable().optional(),
    kcal: z.number().min(0).max(20_000),
    proteinG: z.number().min(0).max(2000),
    carbsG: z.number().min(0).max(2000).nullable().optional(),
    fatG: z.number().min(0).max(2000).nullable().optional(),
    dietType: dietType.optional(),
  })
  .strict();

export const ingredientInputSchema = z.union([fromFood, manual]);
export type IngredientInput = z.output<typeof ingredientInputSchema>;
export const isFromFood = (i: IngredientInput): i is z.output<typeof fromFood> => "foodItemId" in i && "amount" in i;

export const ingredientListSchema = z.array(ingredientInputSchema).max(60);
