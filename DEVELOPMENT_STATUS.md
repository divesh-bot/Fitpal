# Development Status

Legend: ⬜ Planned · 🟨 In progress · ✅ Implemented · 🧪 Tested · 🚀 Deployed

_Last updated: 2026-11-23_

## Phase 0: Inspect and plan ✅

- ✅ Prototype audited: all 5 views, 42-item food database, 7-day plan, snacks, groceries, calculations and the localStorage model.
- ✅ Decisions made with the product owner:
  - Install Node.js LTS through winget: done (v26.13.1).
  - Start with fresh data. No migration from the prototype's localStorage.
  - Remove the prototype's "Load Sample 10-Day Trend" (fake data) button.

## Phase 1: Project foundation ✅ 🧪

| Item | Status | Notes |
|---|---|---|
| Git repository (`main`) | ✅ | Local only; GitHub remote comes in Phase 6 |
| Root structure, `.gitignore`, README | ✅ | |
| Prototype copied to `reference/` | ✅ | Original left in place at the root |
| Frontend: Next.js 16 / React 19 / TS / Tailwind 4 | ✅ 🧪 | Typecheck, lint and static build pass |
| Frontend design tokens (Inter, emerald, slate) | ✅ | From the prototype |
| Frontend static export (`output: "export"`) | ✅ 🧪 | Cache Components disabled (incompatible with export) |
| Backend: Express 5 / TS strict / ESM | ✅ 🧪 | Typecheck, lint and build pass |
| Backend: env validation, Helmet, CORS allow-list, rate limit, request IDs, redacted logging, central errors | ✅ 🧪 | 11 automated tests |
| `.env.example` for both apps | ✅ | |
| Prettier + ESLint in both apps | ✅ | |
| Both apps run independently and together | ✅ 🧪 | Verified with curl against running servers |

## Phase 2: Database ✅ 🧪 🚀 (applied to Supabase 2026-11-23)

| Item | Status | Notes |
|---|---|---|
| Supabase project created (Tokyo, ap-northeast-1; Postgres 17) | ✅ | Email auth on with confirmation; ES256 JWT signing keys (verified via the JWKS endpoint) |
| Migrations 0001–0004 (tables, rules, RLS, account setup) | ✅ 🧪 | 30 tests in PGlite; mutation-checked that the tests catch an RLS leak |
| Seed generated from the prototype (42 foods, 7-day plan, 5 snacks, 16 groceries) | ✅ 🧪 | Values exact; see `database/seed/SEED_REPORT.md` |
| Supabase CLI workflow (`npm run db:push:dry` / `db:push`, migrations synced from `database/migrations`) | ✅ | Primary way to apply migrations |
| Fallback migration runner (connection string, verified TLS) | ✅ 🧪 | Tested against a local PGlite server; not needed while the CLI is used |
| Apply to Supabase | ✅ 🚀 | 4 migrations + seed applied. Verified live: 20 tables, all with RLS; 42 foods; 4 templates; sign-up trigger present; 0 anon grants; anonymous REST calls to tables and RPCs refused (401); `supabase db advisors`: no issues |
| Supabase Auth URL configuration | ✅ 🚀 | Site URL http://localhost:3000; redirect http://localhost:3000/** (pushed via CLI after syncing config.toml with production) |

## Phase 3: Backend modules 🟨

| Module | Status | Notes |
|---|---|---|
| Auth middleware (Supabase JWT via JWKS, ES256) | ✅ 🧪 | 15 tests: expired, wrong issuer/audience, anon role, attacker key, HS256 forgery, alg none, non-UUID subject, JWKS outage → 503. Live check: forged token rejected with signature failure against the real project keys; token never logged |
| Per-request Supabase client acting as the user (RLS applies) + repositories scoped by user id | ✅ | Types generated from the live schema (`npm run db:types` in database/) |
| Profile / targets (versioned) / preferences | ✅ 🧪 | 23 tests incl. cross-user isolation; not yet exercised with a real signed-in user (needs the Phase 4 login screen) |
| Nutrition maths (shared calculation functions) | ✅ 🧪 | 13 tests reproduce prototype values (paneer 150 g = 210 kcal, 2 eggs = 144, CD milk 450 ml = 293 kcal / 25 g); unknown carbs/fat never counted as 0 |
| Foods (search, custom CRUD, shared read-only, tofu flag) | ✅ 🧪 | 19 route tests incl. cross-user 404s and validation; real Supabase queries not yet run with a signed-in user |
| ⚠️ Live end-to-end with a real user | ⬜ | Needs the Phase 4 sign-up screen (email confirmation is required) |
| Food entries + daily nutrition | ⬜ | next |
| Recipes | ⬜ | |
| Meal plans (edit, copy, veg flag, import/export/reset) | ⬜ | |
| Check-ins + weight progress | ⬜ | |
| Habits | ⬜ | |
| Workouts | ⬜ | |
| Grocery | ⬜ | |

## Phase 4: Frontend screens ⬜

## Phase 5: Integration and cross-device testing ⬜

## Phase 6: Deployment ⬜

Pending decision: Render free tier (sleeps after ~15 min idle) or a paid always-on instance.

## Known issues / notes

- Supabase's built-in email sender has a very low hourly limit and is meant for testing only. Before other people use the app, configure custom SMTP (for example Resend or SES) in Supabase Auth.
- Migration tests run on PostgreSQL 18 (PGlite); Supabase runs 17. The migrations applied cleanly to 17.
- Supabase project region is Tokyo (ap-northeast-1), not Mumbai. It works; latency from India is slightly higher.

- VS Code terminals opened before the Node install won't find `node` until VS Code is restarted.
- npm 11 blocks dependency install scripts by default. esbuild's postinstall is explicitly denied in backend/package.json (allowScripts); not needed because its platform binary installs as a normal package.
- In PowerShell, use `npm.cmd` / `npx.cmd` (or run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once) because script execution is disabled on this machine.
