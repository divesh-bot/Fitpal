import { PGlite, type Transaction } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (rel: string) => readFileSync(`${root}/${rel}`, "utf8");

export const migrationFiles = () =>
  readdirSync(`${root}/migrations`)
    .filter((f) => /^\d{4}_.+\.sql$/.test(f))
    .sort();

/** Fresh in-memory database with the Supabase stub, all migrations and seeds applied. */
export async function createTestDb({ seed = true } = {}) {
  const db = await PGlite.create();
  await db.exec(read("tests/supabase-stub.sql"));
  for (const file of migrationFiles()) {
    await db.exec(read(`migrations/${file}`));
  }
  if (seed) await db.exec(read("seed/0001_reference_data.sql"));
  return db;
}

/** Simulates Supabase sign-up: inserting into auth.users fires the setup trigger. */
export async function signUp(db: PGlite, email: string, displayName?: string): Promise<string> {
  const res = await db.query<{ id: string }>(
    "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
    [email, JSON.stringify(displayName ? { display_name: displayName } : {})],
  );
  return res.rows[0]!.id;
}

type Role = { role: "authenticated"; userId: string } | { role: "anon" };

/**
 * Runs `fn` exactly as a Supabase request would: with the given database role
 * and JWT claims, so Row Level Security applies. Rolled back afterwards unless
 * `commit` is true.
 */
export async function as<T>(db: PGlite, who: Role, fn: (tx: Transaction) => Promise<T>, commit = false): Promise<T> {
  let result!: T;
  let error: unknown;
  await db
    .transaction(async (tx) => {
      const claims = who.role === "authenticated" ? { sub: who.userId, role: "authenticated" } : { role: "anon" };
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
      await tx.exec(`set local role ${who.role}`);
      try {
        result = await fn(tx);
      } catch (e) {
        error = e;
      }
      if (!commit || error) await tx.rollback();
    })
    .catch((e) => {
      if (!error) error = e;
    });
  if (error) throw error;
  return result;
}
