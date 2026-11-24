# FitPal

Personal fitness and nutrition tracker: daily calories and protein, a 7-day Indian meal plan, a recipe and macro calculator, weight and check-in progress, PPL workouts, a grocery list and daily habits. Data syncs across devices through a secure backend.

> **Status:** all screens built and tested; deployment configuration ready (Render + Cloudflare). See [DEVELOPMENT_STATUS.md](DEVELOPMENT_STATUS.md).

## Architecture

```
Browser ──► Cloudflare (Next.js static frontend)
              │  REST + Supabase access token
              ▼
           Render (Express API) ──► Supabase (PostgreSQL + Auth, Row Level Security)
```

| Folder | What it is |
|---|---|
| [frontend/](frontend/) | Next.js 16 + React 19 + TypeScript + Tailwind 4. Built as a static export |
| [backend/](backend/) | Node.js + Express 5 + TypeScript REST API |
| [database/](database/) | SQL migrations and seed data for Supabase |
| [docs/](docs/) | Architecture, database schema, API and roadmap |
| [reference/](reference/) | The original HTML prototype (the UI/UX reference) |

Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Deploying: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Prerequisites

- Node.js 22 or newer (developed on Node 26 LTS)
- Git
- A Supabase project (from Phase 2 onwards)

## Running locally

Open two terminals.

**Backend** (http://localhost:4000):

```bash
cd backend
npm install
cp .env.example .env      # first time only; then edit values
npm run dev
```

**Frontend** (http://localhost:3000):

```bash
cd frontend
npm install
cp .env.example .env.local   # first time only
npm run dev
```

Open http://localhost:3000. The page should show **"Backend reachable"**.

## Useful commands

| Command | frontend | backend |
|---|---|---|
| `npm run dev` | Dev server with hot reload | API with auto-restart |
| `npm run build` | Static site into `out/` | Compiles to `dist/` |
| `npm run typecheck` | ✓ | ✓ |
| `npm run lint` | ✓ | ✓ |
| `npm test` | (added in Phase 4) | Vitest test suite |
| `npm run format` | Prettier | Prettier |

## Security notes

- Real `.env` / `.env.local` files are git-ignored. Only `.env.example` files with placeholders are committed.
- The frontend only ever holds browser-safe values (API URL, Supabase URL, Supabase publishable key).
- Supabase secret keys and database passwords exist only on the backend or in the Supabase dashboard.
