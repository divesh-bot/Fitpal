import { AppError } from "./AppError.js";

/** Shape of errors returned by supabase-js / PostgREST. */
export interface DbError {
  code?: string;
  message: string;
  details?: string | null;
  hint?: string | null;
}

/**
 * Translates database errors into client-safe API errors. Raw database
 * messages are not echoed back, except our own deliberate rule messages.
 */
export function mapDbError(err: DbError): AppError {
  switch (err.code) {
    case "23505":
      return AppError.conflict("This record already exists.");
    case "23514":
      if (err.message.includes("STRICT_VEG_VIOLATION")) {
        return new AppError(
          422,
          "STRICT_VEG_VIOLATION",
          err.message.replace(/^.*STRICT_VEG_VIOLATION:\s*/, "").trim() ||
            "Egg and non-veg items are not allowed on a strictly vegetarian day.",
        );
      }
      return AppError.validation([{ path: "", message: "A value is outside the allowed range." }]);
    case "23503":
      return new AppError(422, "INVALID_REFERENCE", "A referenced item does not exist or is not available.");
    case "22P02":
    case "22023":
    case "22007":
    case "22008":
      return AppError.badRequest("Invalid value supplied.");
    case "23502":
      return AppError.validation([{ path: "", message: "A required value is missing." }]);
    case "P0002": // raised by our functions: "Recipe not found", "No active meal plan", …
      return AppError.notFound(/not found|no active/i.test(err.message) ? err.message : undefined);
    case "28000":
      return AppError.unauthorized();
    case "42501":
      return AppError.forbidden();
    case "PGRST116":
      return AppError.notFound();
    case "PGRST301":
    case "PGRST302":
      return AppError.unauthorized("Your session is invalid or has expired. Please sign in again.");
    default:
      // Unknown: let the central handler log it and return a generic 500.
      return Object.assign(new AppError(500, "INTERNAL_ERROR", "Something went wrong. Please try again."), {
        cause: err,
      });
  }
}

/** Unwraps a supabase-js result, throwing a mapped AppError on failure. */
export function unwrap<R extends { data: unknown; error: DbError | null }>(result: R): NonNullable<R["data"]> {
  // Typed on the whole result (a success/error union) so TypeScript keeps the
  // row type instead of inferring `null` from the error branch.
  if (result.error) throw mapDbError(result.error);
  if (result.data === null || result.data === undefined) throw AppError.notFound();
  return result.data as NonNullable<R["data"]>;
}
