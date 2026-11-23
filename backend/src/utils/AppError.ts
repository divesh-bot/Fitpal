/**
 * An expected, client-facing error (validation failure, not found, forbidden…).
 * The central error handler converts it into a consistent JSON response.
 * Anything that is NOT an AppError is treated as an unexpected 500 and its
 * details are hidden from the client.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError(400, "BAD_REQUEST", message, details);
  }
  static validation(details: unknown) {
    return new AppError(422, "VALIDATION_ERROR", "The request data is invalid.", details);
  }
  static unauthorized(message = "Authentication required.") {
    return new AppError(401, "UNAUTHORIZED", message);
  }
  static forbidden(message = "You do not have access to this resource.") {
    return new AppError(403, "FORBIDDEN", message);
  }
  static notFound(message = "Resource not found.") {
    return new AppError(404, "NOT_FOUND", message);
  }
  static conflict(message: string, details?: unknown) {
    return new AppError(409, "CONFLICT", message, details);
  }
}
