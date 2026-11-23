import { z } from "zod";
import { isoDate, nonEmpty, optionalText } from "./common.js";

const TIME_ZONES = new Set([...Intl.supportedValuesOf("timeZone"), "UTC"]);
const currentYear = () => new Date().getUTCFullYear();

export const profileUpdateSchema = z
  .object({
    displayName: optionalText(80),
    sex: z.enum(["male", "female"]).nullable().optional(),
    birthYear: z
      .number()
      .int()
      .min(1900)
      .refine((y) => y <= currentYear() - 10, "Birth year is too recent")
      .nullable()
      .optional(),
    heightCm: z.number().min(100).max(250).nullable().optional(),
    startingWeightKg: z.number().min(25).max(400).nullable().optional(),
    activityMultiplier: z.number().min(1).max(2.5).optional(),
    activityDescription: optionalText(200),
    goal: z.enum(["fat_loss", "maintenance", "muscle_gain"]).optional(),
    trainingNotes: optionalText(2000),
    timezone: z
      .string()
      .refine((tz) => TIME_ZONES.has(tz), "Unknown time zone")
      .optional(),
  })
  .strict()
  .refine(nonEmpty, "Provide at least one field to update");
export type ProfileUpdate = z.output<typeof profileUpdateSchema>;

export const targetsInputSchema = z
  .object({
    caloriesKcal: z.number().int().min(800).max(6000),
    proteinG: z.number().min(0).max(500),
    steps: z.number().int().min(0).max(100_000),
    creatineG: z.number().min(0).max(20).default(5),
    bmrKcal: z.number().int().min(500).max(5000).nullable().optional(),
    tdeeKcal: z.number().int().min(500).max(8000).nullable().optional(),
    note: optionalText(500),
  })
  .strict();
export type TargetsInput = z.output<typeof targetsInputSchema>;

export const targetsQuerySchema = z.object({ date: isoDate }).strict();
export const effectiveFromParamSchema = z.object({ effectiveFrom: isoDate });

export const preferencesUpdateSchema = z
  .object({
    wholeEggsOnly: z.boolean().optional(),
    excludedFoods: z
      .array(z.string().trim().toLowerCase().min(1).max(60))
      .max(50)
      .transform((list) => [...new Set(list)])
      .optional(),
    foodPreferences: optionalText(2000),
    uiSettings: z
      .record(z.string().max(60), z.union([z.string().max(200), z.number(), z.boolean(), z.null()]))
      .refine((o) => Object.keys(o).length <= 30, "Too many UI settings")
      .optional(),
  })
  .strict()
  .refine(nonEmpty, "Provide at least one field to update");
export type PreferencesUpdate = z.output<typeof preferencesUpdateSchema>;
