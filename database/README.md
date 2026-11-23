# Database

SQL and tooling for the Supabase PostgreSQL database. Schema design: [../docs/DATABASE_SCHEMA.md](../docs/DATABASE_SCHEMA.md).

| Path | What |
|---|---|
| `migrations/` | Numbered, append-only schema changes. **Never edit one that has been applied.** Add a new file instead (the runner enforces this with checksums) |
| `seed/0001_reference_data.sql` | Shared foods + default plan templates. **Generated** from the prototype by `npm run seed:build`; idempotent |
| `seed/SEED_REPORT.md` | What the generator kept, linked or changed |
| `scripts/migrate.mjs` | Migration runner |
| `tests/` | Migration + RLS tests (in-process PostgreSQL via PGlite; no Supabase needed) |

> **What is a migration?** A script that moves the database from one version of its structure to the next. Keeping migrations in git means every environment can be rebuilt identically and every change is reviewed and recorded. Nobody makes manual edits in the dashboard.

## Commands

```bash
cd database
npm install
npm test                    # run all schema/RLS tests locally
npm run seed:build          # regenerate seed SQL from the prototype
```

## Applying migrations to Supabase (Supabase CLI, the primary method)

One-time setup: run `npx.cmd supabase@3.2.0 login` in a real terminal (it opens the browser), then `npm run db:link`.

```bash
npm run db:push:dry   # show what would be applied (changes nothing)
npm run db:push       # apply pending migrations + seed (asks for confirmation)
npm run db:advisors   # Supabase security/performance checks
```

The CLI reads `database/supabase/migrations/`, which is a **generated, git-ignored copy** of `database/migrations/` (the `db:*` scripts refresh it automatically). Always edit `database/migrations/`.

## Fallback: connection-string runner (only if the CLI can't be used)

```bash
npm run migrate             # status (changes nothing)
npm run migrate -- --apply  # apply
```

Setup for the fallback:

1. **Connection string:** in the Supabase Dashboard, click **Connect** (top bar) and open the **Session pooler** tab. Copy the URI.
2. **CA certificate:** go to Dashboard → **Database → Settings → SSL Configuration** and click **Download certificate**. Save it as `database/certs/supabase-ca.crt`.
3. Copy `database/.env.example` to `database/.env`. Paste the URI into `DATABASE_URL` and replace `[YOUR-PASSWORD]` with your database password. URL-encode any `@ : / ? # %` characters.
4. Run `npm run migrate`, check the list, then run `npm run migrate -- --apply`.

`database/.env` and `database/certs/` are git-ignored. The runner always verifies the server's TLS certificate and never prints the connection string.
