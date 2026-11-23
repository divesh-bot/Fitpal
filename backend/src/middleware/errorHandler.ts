import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/AppError.js";
import type { ApiErrorBody } from "../types/api.js";

/** Catch-all for unknown routes. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(AppError.notFound(`Route ${req.method} ${req.path} does not exist.`));
};

/** Errors raised by express.json() for malformed or oversized bodies. */
function isBodyParserError(err: unknown): err is { type: string; status: number } {
  return typeof err === "object" && err !== null && "type" in err && "status" in err;
}

/**
 * Central error handler: converts every error into the standard error body.
 * Unexpected errors are logged in full on the server but the client only sees
 * a generic message (no stack traces or internals are leaked).
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId = typeof req.id === "string" || typeof req.id === "number" ? String(req.id) : undefined;

  let appError: AppError;
  if (err instanceof AppError) {
    appError = err;
  } else if (err instanceof ZodError) {
    appError = AppError.validation(err.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  } else if (isBodyParserError(err) && err.type === "entity.parse.failed") {
    appError = AppError.badRequest("Request body is not valid JSON.");
  } else if (isBodyParserError(err) && err.type === "entity.too.large") {
    appError = new AppError(413, "PAYLOAD_TOO_LARGE", "Request body is too large.");
  } else {
    req.log?.error({ err }, "Unhandled error");
    appError = new AppError(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
  }

  if (appError.statusCode < 500) {
    req.log?.warn({ code: appError.code, status: appError.statusCode }, appError.message);
  }

  const body: ApiErrorBody = {
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details !== undefined ? { details: appError.details } : {}),
      ...(requestId ? { requestId } : {}),
    },
  };
  res.status(appError.statusCode).json(body);
};
