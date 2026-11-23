# API Documentation

Base URL: `http://localhost:4000` (local). The production URL will be set in Phase 6.

All responses are JSON in the form `{ "data": ... }` or `{ "error": { "code", "message", "details?", "requestId?" } }`.

## Implemented

### `GET /health`

Liveness check. No auth required and not rate-limited. Response is `Cache-Control: no-store`.

```json
200 { "data": { "status": "ok", "version": "1", "timestamp": "2026-11-23T08:39:41.441Z" } }
```

### Authentication (all `/api/v1/*` routes)

Send the Supabase access token from the signed-in session:

```
Authorization: Bearer <supabase access token>
```

The API verifies the token's ES256 signature against the project's public keys (`/auth/v1/.well-known/jwks.json`) and checks issuer, audience (`authenticated`), expiry and that the role is `authenticated`. The user id is taken **only** from the verified token. Every `/api/v1` path, including unknown ones, returns 401 without a valid token.

### Profile

| Method & path | Body / query | Returns |
|---|---|---|
| `GET /api/v1/profile` | | `ProfileDto` |
| `PUT /api/v1/profile` | Any subset of `displayName`, `sex` (`male`/`female`), `birthYear`, `heightCm` (100–250), `startingWeightKg` (25–400), `activityMultiplier` (1–2.5), `activityDescription`, `goal` (`fat_loss`/`maintenance`/`muscle_gain`), `trainingNotes`, `timezone` (IANA). Unknown fields → 422 | `ProfileDto` |

`ProfileDto`: `{ displayName, email, sex, birthYear, heightCm, startingWeightKg, activityMultiplier, activityDescription, goal, trainingNotes, timezone, updatedAt }`

### Targets (versioned)

| Method & path | Body / query | Returns |
|---|---|---|
| `GET /api/v1/targets?date=YYYY-MM-DD` | `date` required | `TargetsDto` in effect that day |
| `GET /api/v1/targets/history` | | `TargetsDto[]`, newest first |
| `PUT /api/v1/targets/:effectiveFrom` | `{ caloriesKcal (800–6000), proteinG (0–500), steps (0–100000), creatineG? = 5, bmrKcal?, tdeeKcal?, note? }` | `TargetsDto`. Applies from that date onwards and replaces an existing version on the same date. Earlier days keep their old target |

`TargetsDto`: `{ id, effectiveFrom, caloriesKcal, proteinG, steps, creatineG, bmrKcal, tdeeKcal, note }`

### Preferences

| Method & path | Body | Returns |
|---|---|---|
| `GET /api/v1/preferences` | | `PreferencesDto` |
| `PUT /api/v1/preferences` | Any of `wholeEggsOnly`, `excludedFoods` (lower-cased, de-duplicated, ≤ 50), `foodPreferences`, `uiSettings` (flat object of string/number/boolean/null, ≤ 30 keys) | `PreferencesDto` |

### Common errors

| Status | code | When |
|---|---|---|
| 400 | `BAD_REQUEST` | Malformed JSON body or invalid value |
| 401 | `UNAUTHORIZED` | Missing, invalid, forged or expired token |
| 403 | `FORBIDDEN` | Database refused the operation |
| 404 | `NOT_FOUND` | Unknown route outside `/api/v1`, or record not found |
| 409 | `CONFLICT` | Duplicate record |
| 413 | `PAYLOAD_TOO_LARGE` | Body over 200 KB |
| 422 | `VALIDATION_ERROR` | Input failed validation (`details` lists field problems) |
| 422 | `STRICT_VEG_VIOLATION` | Egg/non-veg item on a strictly vegetarian day |
| 422 | `INVALID_REFERENCE` | Refers to a food/recipe/meal that isn't available |
| 429 | `RATE_LIMITED` | Too many requests to `/api/v1` |
| 503 | `AUTH_UNAVAILABLE` | Supabase signing keys temporarily unreachable |
| 500 | `INTERNAL_ERROR` | Unexpected error (details only in server logs) |

## Planned (rest of Phase 3): all require `Authorization: Bearer <token>`

| Resource | Endpoints |
|---|---|
| Foods | `GET /api/v1/foods?q=`, `POST/PUT/DELETE /api/v1/foods/:id` (own foods only) |
| Food entries | `GET /api/v1/food-entries?date=`, `POST`, `PUT /:id`, `DELETE /:id` |
| Nutrition | `GET /api/v1/nutrition/daily?date=` (consumed, planned and target) |
| Recipes | `GET/POST /api/v1/recipes`, `GET/PUT/DELETE /:id`, `POST /:id/log` |
| Meal plans | `GET /api/v1/meal-plans/active`, meal and ingredient CRUD, `POST .../copy`, `PATCH .../days/:weekday` (veg flag), `GET .../export`, `POST .../import`, `POST .../reset` |
| Check-ins | `GET /api/v1/checkins?from=&to=`, `PUT /api/v1/checkins/:date`, `DELETE /:date` |
| Progress | `GET /api/v1/progress/weight?from=&to=` (with 7-day average and weekly rate) |
| Habits | `GET/POST /api/v1/habits`, `PUT /api/v1/habit-logs/:habitId/:date` |
| Workouts | `GET/POST /api/v1/workouts`, `GET/PUT/DELETE /:id`, `GET /api/v1/workouts/progression?exercise=` |
| Grocery | `GET /api/v1/grocery-lists/current`, `POST .../generate`, item CRUD |
