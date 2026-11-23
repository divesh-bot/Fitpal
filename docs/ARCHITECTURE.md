# Architecture

## Overview

```
User's browser / phone
   │  HTTPS
   ▼
Cloudflare: Next.js frontend (static HTML/CSS/JS)
   │  REST calls to /api/v1/...  with  Authorization: Bearer <Supabase access token>
   ▼
Render: Express API (validation, business logic, data access)
   │  queries made *as the signed-in user*
   ▼
Supabase: PostgreSQL (Row Level Security) + Supabase Auth
```

**Why the frontend and backend are separate.** The frontend only draws screens. The backend owns every rule: who you are, what you may see, how totals are calculated, and what counts as valid data. Keeping the rules in one server-side place means a broken or tampered browser can never bypass them. Each part can also be built, tested and deployed independently.

## Key decisions

| # | Decision | Reason |
|---|---|---|
| 1 | **Frontend is a Next.js static export** (`output: "export"`) | All data comes from the Express API, so the frontend needs no server. Static files are free and fast on Cloudflare and avoid Next.js-on-Workers runtime compatibility issues. Trade-off: no Next.js middleware, server actions or cookies, none of which FitPal needs. Fallback: the `@opennextjs/cloudflare` adapter if server rendering is ever required. |
| 2 | **Cache Components / PPR are off** | Next.js 16 enables them by default, but they fail the build in export mode ("PPR cannot be enabled in export mode"), and they only help data fetched by a Next.js server. |
| 3 | **Avoid dynamic route segments** (`/workouts/[id]`) | A static export can't serve unknown IDs. Use query strings (`/workouts?id=…`) or in-page state instead. |
| 4 | **Express 5, TypeScript strict, ES modules** | Express 5 forwards errors from async handlers to the error middleware automatically. |
| 5 | **TypeScript 5.9 in both apps** | TypeScript 7 (the Go-native compiler) exists, but the Next.js and ESLint tooling still targets 5.x. |
| 6 | **Layering: Routes → Controllers → Services → Repositories** | Routes map URLs. Controllers translate HTTP. Services hold business rules and calculations (pure and unit-testable). Repositories are the only code that talks to the database. |
| 7 | **Auth: Supabase access token verified by the backend** | Every `/api/v1` request needs a valid JWT. The user ID comes from the verified token, never from the request body. |
| 8 | **Database queries run as the user** | The backend forwards the user's token to Supabase, so Row Level Security applies as a second line of defence on top of the backend's own checks. The service-role key is not needed for normal requests. |
| 9 | **Dates are calendar dates sent by the client** (`YYYY-MM-DD`) | "Today" means the user's local date (IST), not the server's UTC date. |
| 10 | **Logged food is snapshotted** | A food entry stores its nutrition at logging time, so editing the plan or a food later never rewrites history. |
| 11 | **Targets are versioned** (`effective_from`) | Changing your calorie target doesn't alter what past days are measured against. |

## Request lifecycle (backend)

1. `pino-http` assigns a request ID and logs method and URL. Bodies and auth headers are never logged.
2. `helmet` sets security headers. `cors` only allows the configured frontend origins.
3. `express.json` parses the body (200 KB limit).
4. The `/api/v1` rate limiter runs (per IP; configurable).
5. *(Phase 3)* Auth middleware verifies the token and Zod validators check the input.
6. Controller → service → repository.
7. Errors go to the central handler, which returns `{ error: { code, message, details?, requestId } }`. Unexpected errors return a generic 500 with no internals.

## Response format

```json
{ "data": { ... } }
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...], "requestId": "..." } }
```

## Security checklist

- [x] Secrets only in environment variables; `.env` files are git-ignored
- [x] CORS allow-list; Helmet headers; `x-powered-by` disabled
- [x] Rate limiting on the API
- [x] Log redaction for authorization headers, cookies, passwords and tokens
- [x] Generic 500 responses (no stack traces)
- [x] JWT verification middleware (ES256 via JWKS; 15 attack-case tests)
- [x] Zod validation on every endpoint (strict: unknown fields rejected)
- [x] Row Level Security on every user table (verified live + Supabase advisors)
- [x] Cross-user access tests (API with test doubles; database in PGlite)
- [x] Live end-to-end tests against Supabase with real signed-in users (`backend/scripts/live-e2e.mjs`)
