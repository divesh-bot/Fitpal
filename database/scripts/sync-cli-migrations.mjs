/**
 * The Supabase CLI reads migrations from database/supabase/migrations, but the
 * source of truth is database/migrations (project structure requirement).
 * This copies them across before every CLI command. The copy is git-ignored.
 */
import { copyFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const src = fileURLToPath(new URL("../migrations/", import.meta.url));
const dest = fileURLToPath(new URL("../supabase/migrations/", import.meta.url));

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
const files = readdirSync(src).filter((f) => /^\d{4}_[a-z0-9_]+\.sql$/.test(f)).sort();
for (const f of files) copyFileSync(src + f, dest + f);
console.log(`Synced ${files.length} migration(s) for the Supabase CLI.`);
