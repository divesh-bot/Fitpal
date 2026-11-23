import { z } from "zod";
import { optionalText } from "./common.js";
import { ingredientListSchema } from "./ingredients.validators.js";

export const mealSlot = z.enum(["post_workout", "breakfast", "lunch", "dinner"]);
export const weekday = z.coerce.number().int().min(1).max(7);

export const dayParamsSchema = z.object({ weekday });
export const mealParamsSchema = z.object({ weekday, slot: mealSlot });

export const mealSaveSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    note: optionalText(500),
    ingredients: ingredientListSchema,
  })
  .strict();
export type MealSaveInput = z.output<typeof mealSaveSchema>;

export const copyMealSchema = z
  .object({
    toWeekdays: z
      .array(z.number().int().min(1).max(7))
      .min(1)
      .max(7)
      .transform((d) => [...new Set(d)]),
  })
  .strict();

export const dayUpdateSchema = z.object({ isStrictVeg: z.boolean() }).strict();

// ---------- import formats ----------

const num = (max: number) => z.number().min(0).max(max);

/** FitPal plan file, version 1 (what GET /export produces). */
const v1Ingredient = z
  .object({
    name: z.string().trim().min(1).max(120),
    qtyLabel: z.string().trim().max(40).nullable().optional(),
    quantity: num(100_000).nullable().optional(),
    unit: z.string().trim().max(20).nullable().optional(),
    kcal: num(20_000),
    proteinG: num(2000),
    carbsG: num(2000).nullable().optional(),
    fatG: num(2000).nullable().optional(),
    dietType: z.enum(["veg", "egg", "non_veg"]).optional(),
    foodKey: z
      .string()
      .regex(/^[a-z0-9_]{1,64}$/)
      .nullable()
      .optional(),
  })
  .strip();

export const planFileV1Schema = z
  .object({
    version: z.literal(1),
    name: z.string().trim().min(1).max(120).optional(),
    days: z
      .array(
        z.object({
          weekday: z.number().int().min(1).max(7),
          isStrictVeg: z.boolean().default(false),
          meals: z
            .array(
              z.object({
                slot: mealSlot,
                title: z.string().trim().min(1).max(120),
                note: z.string().max(500).nullable().optional(),
                ingredients: z.array(v1Ingredient).max(60),
              }),
            )
            .max(4),
        }),
      )
      .max(7)
      .refine((days) => new Set(days.map((d) => d.weekday)).size === days.length, "Each weekday may appear once"),
    snacks: z
      .array(
        z.object({
          kind: z.enum(["sweet", "salty"]),
          name: z.string().trim().min(1).max(120),
          description: z.string().max(500).nullable().optional(),
          ingredients: z.array(v1Ingredient).min(1).max(60),
        }),
      )
      .max(50)
      .optional(),
  })
  .strip();
export type PlanFileV1 = z.output<typeof planFileV1Schema>;

/** The HTML prototype's export file (version 2), so prototype edits can be brought in. */
const v2Ingredient = z.object({
  name: z.string().trim().min(1).max(120),
  qty: z.string().max(40).default(""),
  kcal: num(20_000),
  protein: num(2000),
});
const v2Meal = z.object({
  title: z.string().trim().min(1).max(120),
  note: z.string().max(500).optional(),
  ingredients: z.array(v2Ingredient).max(60),
});
const v2Day = z.object({
  postWorkout: v2Meal.optional(),
  breakfast: v2Meal.optional(),
  lunch: v2Meal.optional(),
  dinner: v2Meal.optional(),
});
const v2Snack = z.object({
  name: z.string().trim().min(1).max(120),
  detail: z.string().max(500).optional(),
  kcal: num(20_000),
  protein: num(2000),
});
export const prototypeFileSchema = z
  .object({
    version: z.literal(2),
    plan: z.object({
      Mon: v2Day.optional(),
      Tue: v2Day.optional(),
      Wed: v2Day.optional(),
      Thu: v2Day.optional(),
      Fri: v2Day.optional(),
      Sat: v2Day.optional(),
      Sun: v2Day.optional(),
    }),
    vegDays: z.record(z.string(), z.boolean()).optional(),
    snacks: z
      .object({ sweet: z.array(v2Snack).max(25).default([]), salty: z.array(v2Snack).max(25).default([]) })
      .optional(),
  })
  .strip();
export type PrototypeFile = z.output<typeof prototypeFileSchema>;
