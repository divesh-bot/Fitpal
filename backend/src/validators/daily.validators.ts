import { z } from "zod";
import { isoDate, nonEmpty, uuid } from "./common.js";
import { mealSlot } from "./mealPlans.validators.js";
import { dateRangeSchema, pastOrTodayDate } from "./tracking.validators.js";

const entrySlot = z.enum(["post_workout", "breakfast", "lunch", "dinner", "snack", "other"]);

const common = {
  date: pastOrTodayDate,
  mealSlot: entrySlot.default("other"),
  /** Client-generated id: retrying the same request never creates a duplicate. */
  clientRequestId: uuid.optional(),
};

export const entryCreateSchema = z.discriminatedUnion("source", [
  z
    .object({
      source: z.literal("manual"),
      ...common,
      name: z.string().trim().min(1).max(160),
      qtyLabel: z.string().trim().max(60).optional(),
      kcal: z.number().min(0).max(20_000),
      proteinG: z.number().min(0).max(2000),
      carbsG: z.number().min(0).max(2000).nullable().optional(),
      fatG: z.number().min(0).max(2000).nullable().optional(),
    })
    .strict(),
  z
    .object({
      source: z.literal("food_item"),
      ...common,
      foodItemId: uuid,
      amount: z.number().positive().max(10_000),
    })
    .strict(),
  z
    .object({
      source: z.literal("recipe"),
      ...common,
      recipeId: uuid,
      servings: z.number().min(0.25).max(20).default(1),
    })
    .strict(),
]);
export type EntryCreateInput = z.output<typeof entryCreateSchema>;

export const entryUpdateSchema = z
  .object({
    mealSlot: entrySlot.optional(),
    name: z.string().trim().min(1).max(160).optional(),
    /** food_item entries: new amount → nutrition recalculated from the food. */
    amount: z.number().positive().max(10_000).optional(),
    /** recipe entries: new number of servings. */
    servings: z.number().min(0.25).max(20).optional(),
    /** manual entries only. */
    qtyLabel: z.string().trim().max(60).optional(),
    kcal: z.number().min(0).max(20_000).optional(),
    proteinG: z.number().min(0).max(2000).optional(),
    carbsG: z.number().min(0).max(2000).nullable().optional(),
    fatG: z.number().min(0).max(2000).nullable().optional(),
  })
  .strict()
  .refine(nonEmpty, "Provide at least one field to update");
export type EntryUpdateInput = z.output<typeof entryUpdateSchema>;

export const entryListSchema = z.union([z.object({ date: isoDate }).strict(), dateRangeSchema(31)]);

export const dayParamSchema = z.object({ date: isoDate });
export const dayWriteParamSchema = z.object({ date: pastOrTodayDate });
export const planMealParamsSchema = z.object({ date: pastOrTodayDate, slot: mealSlot });
export const planMealBodySchema = z.object({ eaten: z.boolean() }).strict();
export const snackParamsSchema = z.object({ date: pastOrTodayDate, kind: z.enum(["sweet", "salty"]) });
export const snackBodySchema = z.object({ recipeId: uuid.nullable() }).strict();
