import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.types.js";
import type { Env } from "./env.js";

export type Db = SupabaseClient<Database>;

/**
 * Creates a Supabase client that acts AS the signed-in user: the user's access
 * token is sent with every query, so PostgreSQL Row Level Security limits it to
 * that user's rows. Repositories ALSO filter by user id explicitly, so data
 * access stays scoped even if a policy were ever misconfigured.
 */
export function createUserDbFactory(env: Pick<Env, "SUPABASE_URL" | "SUPABASE_PUBLISHABLE_KEY">) {
  return (accessToken: string): Db =>
    createClient<Database>(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      db: { schema: "public" },
    });
}
