import { z } from "zod";

/** Calendar date "YYYY-MM-DD" that must be a real date (rejects 2026-02-30). */
export const isoDate = z.iso.date({ message: "Must be a date in YYYY-MM-DD format" });

export const uuid = z.uuid({ message: "Must be a valid id" });

/** Optional nullable free text, trimmed; empty string becomes null. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

/** Parses input with a schema; a ZodError becomes a 422 in the error handler. */
export function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  return schema.parse(input);
}

/** Rejects an update body that contains no fields at all. */
export const nonEmpty = <T extends object>(v: T) => Object.values(v).some((x) => x !== undefined);
