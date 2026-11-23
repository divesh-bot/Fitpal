import { z } from "zod";
import { isoDate, optionalText } from "./common.js";
import { pastOrTodayDate } from "./tracking.validators.js";

export const workoutSplit = z.enum(["push", "pull", "legs", "rest", "other"]);

export const workoutSaveSchema = z
  .object({
    date: pastOrTodayDate,
    split: workoutSplit,
    durationMin: z.number().int().min(0).max(600).nullable().optional(),
    notes: optionalText(2000),
    exercises: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(120),
            notes: optionalText(1000),
            sets: z
              .array(
                z
                  .object({
                    reps: z.number().int().min(0).max(1000),
                    weightKg: z.number().min(0).max(1000).nullable().optional(),
                    rpe: z.number().min(1).max(10).nullable().optional(),
                    isWarmup: z.boolean().default(false),
                  })
                  .strict(),
              )
              .max(20),
          })
          .strict(),
      )
      .max(30),
  })
  .strict();
export type WorkoutSaveInput = z.output<typeof workoutSaveSchema>;

export const workoutListSchema = z
  .object({
    from: isoDate.optional(),
    to: isoDate.optional(),
    limit: z.coerce.number().int().min(1).max(200).default(30),
  })
  .strict()
  .refine((q) => !q.from || !q.to || q.from <= q.to, "'from' must be on or before 'to'");

export const progressionQuerySchema = z.object({ exercise: z.string().trim().min(1).max(120) }).strict();
