# Deployment

```
GitHub (main) ──► Render: backend/ ──────────► https://fitpal-api.onrender.com (API)
             └──► Cloudflare: frontend/ ─────► https://fitpal.<subdomain>.workers.dev (app)
Supabase (Postgres + Auth) is already live; migrations are applied with the Supabase CLI.
```

Both hosts redeploy automatically on every push to `main`.

## 1. Backend on Render (free plan)

Configured by [`render.yaml`](../render.yaml) (a Render "Blueprint"): Singapore region, `backend/` as root, build `npm ci --include=dev && npm run build`, start `npm start`, health check `/health`, Node 24.

1. Sign up at https://render.com with **GitHub** and allow access to the `Fitpal` repository.
2. **New → Blueprint** → pick the `Fitpal` repo. Render reads `render.yaml`.
3. When asked for the `sync: false` values, enter:
   | Key | Value |
   |---|---|
   | `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
   | `SUPABASE_PUBLISHABLE_KEY` | your Supabase **publishable** key (never the secret key) |
   | `CORS_ALLOWED_ORIGINS` | your Cloudflare app URL from step 2 (use `https://example.com` temporarily, then update) |
4. Apply. When the deploy finishes, open `https://<service>.onrender.com/health` and check that it shows `"status":"ok"`.

**Free plan:** the service sleeps after 15 minutes without traffic. The first request then takes about a minute, and the app shows a "Waking up the FitPal server…" notice. Upgrade anytime in Render → service → Settings → Instance type.

## 2. Frontend on Cloudflare (Workers static assets)

Configured by [`frontend/wrangler.jsonc`](../frontend/wrangler.jsonc): serves the static export in `out/`, with trailing-slash routes and the custom 404 page. `npm run build` also writes `out/_headers` (security headers + a strict per-page Content-Security-Policy).

1. Sign up at https://dash.cloudflare.com (free).
2. **Workers & Pages → Create → Import a repository** → connect GitHub → pick `Fitpal`.
3. Settings:
   | Setting | Value |
   |---|---|
   | Project / Worker name | `fitpal` (must match `name` in `wrangler.jsonc`) |
   | Root directory | `frontend` |
   | Build command | `npm run build` |
   | Deploy command | `npx wrangler deploy` |
4. **Build variables** (used at build time only, all browser-safe):
   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_API_BASE_URL` | the Render URL, e.g. `https://fitpal-api.onrender.com` |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |
   | `NODE_VERSION` | `24` |
5. Deploy. The app URL is shown in the dashboard (`https://fitpal.<subdomain>.workers.dev`).

## 3. Connect the pieces

1. **Render → Environment:** set `CORS_ALLOWED_ORIGINS` to the exact Cloudflare URL (no trailing slash) and redeploy.
2. **Supabase Auth URLs:** add the Cloudflare URL as **Site URL** and `https://<app-url>/**` to **Redirect URLs** (keep the localhost entries for local development). Change this through the Supabase CLI config (`database/supabase/config.toml` → `npm run`/`config push`), or in the dashboard.
3. Sign up with your real account on the live URL, confirm the email, and log something on your laptop and on your phone.

## Security checklist for production

- [x] No secrets in git (`.env*` ignored); the frontend only receives browser-safe values
- [x] API: JWT verification (ES256 via JWKS), RLS, CORS allow-list, rate limit 600 req / 15 min / IP, Helmet, redacted logs
- [x] App: CSP with per-page script hashes (no `unsafe-inline` scripts), `frame-ancestors 'none'`, HSTS, nosniff, Referrer-Policy, Permissions-Policy
- [ ] After first deploy: confirm `TRUST_PROXY_HOPS=1` is right (rate limiting must see the real client IP)
- [ ] Before inviting other people: custom SMTP in Supabase Auth (the built-in sender is rate-limited)

## Verifying a production build locally

```bash
cd frontend
NEXT_PUBLIC_API_BASE_URL=http://localhost:4100 npm run build   # writes out/ and out/_headers
npx wrangler dev --port 8787 --local                            # serves out/ with Cloudflare's runtime + _headers
# backend with CORS for :8787 (separate terminal):
cd ../backend && PORT=4100 CORS_ALLOWED_ORIGINS=http://localhost:8787 NODE_ENV=production node --env-file=.env dist/server.js
# then: E2E_BASE_URL=http://localhost:8787 SUPABASE_SECRET_KEY=... npm run test:e2e
```

Result on 2026-11-24: 14/14 browser tests passed with the strict CSP enforced.

## Notes

- Next.js link **prefetching is disabled** (`prefetch={false}`): Next 16's static export writes segment-prefetch files at paths that don't match what the client requests, which caused harmless 404s on static hosting. Navigation works normally.
- `cacheComponents` / PPR are off: incompatible with `output: "export"`.
