import { z } from "zod";
import { isoDate, nonEmpty, optionalText, uuid } from "./common.js";

const DAY_MS = 86_400_000;
/** Allows "today" in any time zone (up to UTC+14) but not future days. */
export const notFuture = (d: string) => Date.parse(`${d}T00:00:00Z`) <= Date.now() + DAY_MS;
export const pastOrTodayDate = isoDate.refine(notFuture, "Date cannot be in the future");

export const dateParamSchema = z.object({ date: pastOrTodayDate });

/** Inclusive date range, at most `maxDays` long. */
export const dateRangeSchema = (maxDays: number) =>
  z
    .object({ from: isoDate, to: isoDate })
    .strict()
    .refine((r) => r.from <= r.to, "'from' must be on or before 'to'")
    .refine(
      (r) => (Date.parse(r.to) - Date.parse(r.from)) / DAY_MS < maxDays,
      `Date range can be at most ${maxDays} days`,
    );

export const checkinSchema = z
  .object({
    weightKg: z.number().min(25).max(400).nullable().optional(),
    waistCm: z.number().min(30).max(250).nullable().optional(),
    steps: z.number().int().min(0).max(200_000).nullable().optional(),
    sleepHours: z.number().min(0).max(24).nullable().optional(),
    sleepQuality: z.enum(["poor", "fair", "good", "great"]).nullable().optional(),
    hunger: z.number().int().min(1).max(10).nullable().optional(),
    energy: z.number().int().min(1).max(10).nullable().optional(),
    notes: optionalText(2000),
  })
  .strict()
  .refine(nonEmpty, "Provide at least one field");
export type CheckinInput = z.output<typeof checkinSchema>;

export const habitCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    description: optionalText(300),
  })
  .strict();

export const habitUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    description: optionalText(300),
    position: z.number().int().min(0).max(100).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine(nonEmpty, "Provide at least one field");

export const habitListSchema = z.object({ includeInactive: z.enum(["true", "false"]).default("false") }).strict();
export const habitLogParamsSchema = z.object({ habitId: uuid, date: pastOrTodayDate });
export const habitLogBodySchema = z.object({ completed: z.boolean() }).strict();
