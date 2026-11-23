import { z } from "zod";
import { optionalText } from "./common.js";
import { ingredientListSchema } from "./ingredients.validators.js";

export const recipeCategory = z.enum(["meal", "snack_sweet", "snack_salty"]);

export const recipeSaveSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    category: recipeCategory.default("meal"),
    description: optionalText(500),
    servings: z.number().positive().max(100).default(1),
    ingredients: ingredientListSchema.min(1, "Add at least one ingredient"),
  })
  .strict();
export type RecipeSaveInput = z.output<typeof recipeSaveSchema>;

export const recipeListSchema = z.object({ category: recipeCategory.optional() }).strict();
