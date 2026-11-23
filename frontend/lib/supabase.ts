import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

/**
 * Supabase is used in the browser ONLY for authentication (sign-up, login,
 * session refresh, password reset). All application data goes through the
 * FitPal API, never directly to the database.
 *
 * flowType "pkce": email links carry a one-time code that is exchanged for a
 * session, so access tokens never appear in URLs. The code can only be
 * exchanged in the browser that requested it.
 */
let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  client ??= createClient(env.supabaseUrl, env.supabasePublishableKey, {
    auth: {
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return client;
}

/** Absolute URL for a path in this app (used for email redirect links). */
export const appUrl = (path: string) => `${window.location.origin}${path}`;
