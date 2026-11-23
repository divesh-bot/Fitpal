/**
 * FitPal migration runner.
 *
 *   npm run migrate            → show status (what is applied / pending). Changes nothing.
 *   npm run migrate -- --apply → apply pending migrations, then (re)apply changed seed files.
 *
 * Reads DATABASE_URL and DATABASE_SSL_CA_PATH from database/.env (git-ignored).
 * - Each migration runs in its own transaction: it fully applies or not at all.
 * - Applied migrations are recorded with a SHA-256 checksum; if an applied file
 *   is later edited, the runner stops (write a NEW migration instead).
 * - TLS certificate verification is always on. The connection string is never printed.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const APPLY = process.argv.includes("--apply");

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

function sqlFiles(dir) {
  return readdirSync(`${ROOT}/${dir}`)
    .filter((f) => /^\d{4}_[a-z0-9_]+\.sql$/.test(f))
    .sort()
    .map((name) => {
      const sql = readFileSync(`${ROOT}/${dir}/${name}`, "utf8");
      return { name, sql, checksum: createHash("sha256").update(sql).digest("hex") };
    });
}

function connectionConfig() {
  const raw = process.env.DATABASE_URL;
  if (!raw) fail("DATABASE_URL is not set. Copy database/.env.example to database/.env and fill it in.");

  let url;
  try {
    url = new URL(raw);
  } catch {
    fail("DATABASE_URL is not a valid URL (if your password has special characters, URL-encode it).");
  }
  const isLocal = ["localhost", "127.0.0.1"].includes(url.hostname);
  // TLS options are set explicitly below; drop URL ssl params so they cannot weaken them.
  for (const p of ["sslmode", "ssl", "sslcert", "sslkey", "sslrootcert"]) url.searchParams.delete(p);

  let ssl = false;
  if (!isLocal) {
    const caPath = process.env.DATABASE_SSL_CA_PATH;
    if (!caPath) fail("DATABASE_SSL_CA_PATH is not set (download the CA certificate from Supabase, see database/README.md).");
    const resolved = fileURLToPath(new URL(caPath, `file:///${ROOT.replace(/\\/g, "/")}/`));
    if (!existsSync(resolved)) fail(`CA certificate not found at ${caPath}.`);
    ssl = { ca: readFileSync(resolved, "utf8"), rejectUnauthorized: true };
  }
  return { connectionString: url.toString(), ssl, host: url.hostname, database: url.pathname.slice(1) };
}

async function main() {
  const migrations = sqlFiles("migrations");
  const seeds = sqlFiles("seed");
  const cfg = connectionConfig();
  console.log(`Database: ${cfg.host} / ${cfg.database}`);
  console.log(APPLY ? "Mode: APPLY\n" : "Mode: status only (add --apply to make changes)\n");

  const client = new pg.Client({ connectionString: cfg.connectionString, ssl: cfg.ssl, application_name: "fitpal-migrate" });
  try {
    await client.connect();
  } catch (err) {
    fail(`Could not connect: ${err.message}`);
  }

  try {
    await client.query(`
      create schema if not exists fitpal_meta;
      revoke all on schema fitpal_meta from public;
      create table if not exists fitpal_meta.applied_files (
        kind        text not null check (kind in ('migration', 'seed')),
        name        text not null,
        checksum    text not null,
        applied_at  timestamptz not null default now(),
        primary key (kind, name)
      );`);

    const applied = new Map(
      (await client.query("select kind, name, checksum from fitpal_meta.applied_files")).rows.map((r) => [
        `${r.kind}:${r.name}`,
        r.checksum,
      ]),
    );

    // Safety: applied migrations must be unchanged.
    for (const m of migrations) {
      const prev = applied.get(`migration:${m.name}`);
      if (prev && prev !== m.checksum) {
        fail(`${m.name} was edited after it was applied. Revert the edit and create a new migration instead.`);
      }
    }

    const pendingMigrations = migrations.filter((m) => !applied.has(`migration:${m.name}`));
    const pendingSeeds = seeds.filter((s) => applied.get(`seed:${s.name}`) !== s.checksum);

    for (const m of migrations) console.log(`  ${applied.has(`migration:${m.name}`) ? "✔ applied " : "• pending "} ${m.name}`);
    for (const s of seeds) console.log(`  ${pendingSeeds.includes(s) ? "• pending " : "✔ current "} seed/${s.name}`);

    if (!APPLY) {
      console.log(`\n${pendingMigrations.length} migration(s) and ${pendingSeeds.length} seed file(s) pending.`);
      return;
    }

    for (const [kind, list] of [
      ["migration", pendingMigrations],
      ["seed", pendingSeeds],
    ]) {
      for (const f of list) {
        process.stdout.write(`\nApplying ${kind} ${f.name} … `);
        try {
          await client.query("begin");
          await client.query(f.sql);
          await client.query(
            `insert into fitpal_meta.applied_files (kind, name, checksum) values ($1, $2, $3)
             on conflict (kind, name) do update set checksum = excluded.checksum, applied_at = now()`,
            [kind, f.name, f.checksum],
          );
          await client.query("commit");
          console.log("done");
        } catch (err) {
          await client.query("rollback").catch(() => {});
          console.log("FAILED (rolled back)");
          fail(`${kind} ${f.name}: ${err.message}`);
        }
      }
    }
    console.log("\n✔ Database is up to date.");
  } finally {
    await client.end();
  }
}

main().catch((err) => fail(err.message));
