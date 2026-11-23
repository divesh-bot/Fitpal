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

## Phase 3: Backend ✅ 🧪 (complete; verified end-to-end against live Supabase on 2026-11-23)

| Module | Status | Notes |
|---|---|---|
| Auth middleware (Supabase JWT via JWKS, ES256) | ✅ 🧪 | 15 tests: expired, wrong issuer/audience, anon role, attacker key, HS256 forgery, alg none, non-UUID subject, JWKS outage → 503. Live check: forged token rejected with signature failure against the real project keys; token never logged |
| Per-request Supabase client acting as the user (RLS applies) + repositories scoped by user id | ✅ | Types generated from the live schema (`npm run db:types` in database/) |
| Profile / targets (versioned) / preferences | ✅ 🧪 | 23 tests incl. cross-user isolation; not yet exercised with a real signed-in user (needs the Phase 4 login screen) |
| Nutrition maths (shared calculation functions) | ✅ 🧪 | 13 tests reproduce prototype values (paneer 150 g = 210 kcal, 2 eggs = 144, CD milk 450 ml = 293 kcal / 25 g); unknown carbs/fat never counted as 0 |
| Foods (search, custom CRUD, shared read-only, tofu flag) | ✅ 🧪 | 19 route tests incl. cross-user 404s and validation; real Supabase queries not yet run with a signed-in user |
| Live end-to-end (`backend/scripts/live-e2e.mjs`) | ✅ 🧪 | 28/28 checks against real Supabase Auth + DB through the running API: sign-up setup, Today summary with prototype values, ticks/snacks/food log, idempotency, strict-veg/tofu rules in the live DB, recipes/plan/workout/grocery writes, export→import, cross-user isolation (API and direct RLS), reset. Two temporary users created with the secret key (passed via env only), then deleted; 0 rows and 0 users left behind; 0 server errors |
| Migration 0005: atomic write functions (recipes, plan meals, copy, snacks, reset day, workouts, grocery) | ✅ 🧪 🚀 | 17 PGlite tests; applied to Supabase; advisors: no issues |
| Recipes + shared ingredient rules (tofu, egg whites, stricter diet type) | ✅ 🧪 | |
| Meal plans (view, edit, copy, veg flag, import v1 + prototype v2, export, reset) | ✅ 🧪 | |
| Check-ins + weight progress (calendar 7-day average) | ✅ 🧪 | Deliberate change from the prototype's last-7-entries average |
| Habits (built-in creatine/workout + custom) | ✅ 🧪 | |
| Daily log: food entries, planned-meal ticks, snacks, reset day, Today summary | ✅ 🧪 | Idempotent via clientRequestId; nutrition snapshots |
| Workouts + progression (Epley e1RM, warm-ups excluded) | ✅ 🧪 | |
| Grocery (generate from plan, custom items carried over) | ✅ 🧪 | Plan quantities are as eaten (cooked rice) |
| Totals | | 192 backend tests + 47 database tests passing |

## Phase 4: Frontend screens 🟨

| Item | Status | Notes |
|---|---|---|
| Foundation: Supabase Auth (PKCE) sign-up / sign-in / sign-out / forgot + reset password / email callback; API client; app shell (sidebar + mobile tabs) | ✅ 🧪 | Confirmation and reset links must be opened in the same browser (PKCE); other devices: email still confirmed, then sign in |
| Today screen: week selector (real dates), rings, steps, habits, planned-meal ticks, inline meal editor (copy/clear), snacks (pick/edit/add/delete), log food from list or manually, reset checkmarks, veg-day toggle | ✅ 🧪 | Playwright against live Supabase: 6/6 (desktop journey, phone layout, auth redirects, wrong password); screenshots reviewed |
| Calculator | ⬜ | next |
| Log & Progress (check-ins, weight chart, workouts) | ⬜ | |
| Grocery | ⬜ | |
| Plan & Rules (plan management, import/export/reset, profile, targets, preferences) | ⬜ | |

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
