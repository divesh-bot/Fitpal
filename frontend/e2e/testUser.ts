import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

/** Temporary test-user credentials, kept in a git-ignored file for the duration of a run. */
const DIR = "e2e/.auth";
const FILE = `${DIR}/user.json`;

export interface TestUser {
  id: string;
  email: string;
  password: string;
}

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret)
    throw new Error("E2E tests need NEXT_PUBLIC_SUPABASE_URL (.env.local) and SUPABASE_SECRET_KEY (environment).");
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function createTestUser(): Promise<TestUser> {
  const email = `fitpal-e2e-ui-${randomBytes(4).toString("hex")}@example.com`;
  const password = `${randomBytes(18).toString("base64url")}a1`;
  const { data, error } = await admin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: "E2E UI" },
  });
  if (error) throw new Error(`Could not create test user: ${error.message}`);
  const user = { id: data.user.id, email, password };
  mkdirSync(DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(user));
  return user;
}

export function readTestUser(): TestUser {
  return JSON.parse(readFileSync(FILE, "utf8")) as TestUser;
}

export async function deleteTestUser() {
  if (!existsSync(FILE)) return;
  const { id } = readTestUser();
  const { error } = await admin().auth.admin.deleteUser(id);
  rmSync(DIR, { recursive: true, force: true });
  if (error) throw new Error(`Could not delete test user ${id}: ${error.message}`);
  console.log(`E2E: test user ${id.slice(0, 8)}… deleted`);
}
