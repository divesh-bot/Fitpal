import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

/**
 * Temporary test users for end-to-end tests. Each spec file gets its own fresh
 * user (so tests never depend on each other's data), deleted when the file
 * finishes. Global teardown also sweeps any leftovers from interrupted runs.
 * Credentials live only in memory.
 */
export interface TestUser {
  id: string;
  email: string;
  password: string;
}

export const TEST_EMAIL_PREFIX = "fitpal-e2e-ui-";

export function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    throw new Error("E2E tests need NEXT_PUBLIC_SUPABASE_URL (.env.local) and SUPABASE_SECRET_KEY (environment).");
  }
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function createTestUser(): Promise<TestUser> {
  const email = `${TEST_EMAIL_PREFIX}${randomBytes(4).toString("hex")}@example.com`;
  const password = `${randomBytes(18).toString("base64url")}a1`;
  const { data, error } = await admin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: "E2E UI" },
  });
  if (error) throw new Error(`Could not create test user: ${error.message}`);
  return { id: data.user.id, email, password };
}

export async function deleteTestUser(id: string) {
  const { error } = await admin().auth.admin.deleteUser(id);
  if (error) throw new Error(`Could not delete test user ${id}: ${error.message}`);
}

/** Deletes every user whose email has the test prefix (safety net). Returns how many. */
export async function sweepTestUsers(): Promise<number> {
  const a = admin();
  let removed = 0;
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await a.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`Could not list users: ${error.message}`);
    for (const u of data.users) {
      if (u.email?.startsWith(TEST_EMAIL_PREFIX)) {
        await deleteTestUser(u.id);
        removed++;
      }
    }
    if (data.users.length < 200) break;
  }
  return removed;
}
