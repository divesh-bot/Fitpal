import { env } from "@/lib/env";
import { supabase } from "@/lib/supabase";

/**
 * The ONE place the frontend talks to the backend. Every request carries the
 * signed-in user's Supabase access token; the API verifies it and only ever
 * returns that user's data.
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function accessToken(forceRefresh = false): Promise<string | null> {
  const auth = supabase().auth;
  if (forceRefresh) {
    const { data } = await auth.refreshSession();
    return data.session?.access_token ?? null;
  }
  const { data } = await auth.getSession(); // refreshes automatically if expired
  return data.session?.access_token ?? null;
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

async function send(method: Method, path: string, body: unknown, token: string | null, signal?: AbortSignal) {
  try {
    return await fetch(`${env.apiBaseUrl}/api/v1${path}`, {
      method,
      signal,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(0, "NETWORK_ERROR", "Can't reach FitPal right now. Check your connection and try again.");
  }
}

export async function api<T>(method: Method, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  let res = await send(method, path, body, await accessToken(), signal);
  // The token may have expired between checks: refresh once and retry.
  if (res.status === 401) {
    const fresh = await accessToken(true);
    if (fresh) res = await send(method, path, body, fresh, signal);
  }
  if (res.status === 401) {
    await supabase().auth.signOut({ scope: "local" });
    throw new ApiError(401, "UNAUTHORIZED", "Your session has expired. Please sign in again.");
  }
  if (res.status === 204) return undefined as T;

  let json: { data?: T; error?: { code: string; message: string; details?: unknown } } | null = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON response */
  }
  if (!res.ok) {
    const e = json?.error;
    throw new ApiError(
      res.status,
      e?.code ?? "HTTP_ERROR",
      e?.message ?? `Request failed (HTTP ${res.status}).`,
      e?.details,
    );
  }
  return json?.data as T;
}

/** Human-readable message for any error, including field-level validation details. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === "VALIDATION_ERROR" && Array.isArray(err.details) && err.details.length) {
      const first = err.details[0] as { path?: string; message?: string };
      return first.message ? `${first.path ? `${first.path}: ` : ""}${first.message}` : err.message;
    }
    return err.message;
  }
  return err instanceof Error ? err.message : "Something went wrong.";
}
