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
npm run migrate             # show what is applied / pending (changes nothing)
npm run migrate -- --apply  # apply pending migrations and seeds
```

## One-time setup to apply migrations to Supabase

1. **Connection string:** in the Supabase Dashboard, click **Connect** (top bar) and open the **Session pooler** tab. Copy the URI.
2. **CA certificate:** go to Dashboard → **Database → Settings → SSL Configuration** and click **Download certificate**. Save it as `database/certs/supabase-ca.crt`.
3. Copy `database/.env.example` to `database/.env`. Paste the URI into `DATABASE_URL` and replace `[YOUR-PASSWORD]` with your database password. URL-encode any `@ : / ? # %` characters.
4. Run `npm run migrate`, check the list, then run `npm run migrate -- --apply`.

`database/.env` and `database/certs/` are git-ignored. The runner always verifies the server's TLS certificate and never prints the connection string.
