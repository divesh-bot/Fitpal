/**
 * Every API response uses one of these two shapes, so the frontend can handle
 * all endpoints the same way.
 */
export interface ApiSuccess<T> {
  data: T;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}
