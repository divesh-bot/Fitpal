# API Documentation

Base URL: `http://localhost:4000` (local). The production URL will be set in Phase 6.

All responses are JSON in the form `{ "data": ... }` or `{ "error": { "code", "message", "details?", "requestId?" } }`.

## Implemented

### `GET /health`

Liveness check. No auth required and not rate-limited. Response is `Cache-Control: no-store`.

```json
200 { "data": { "status": "ok", "version": "1", "timestamp": "2026-11-23T08:39:41.441Z" } }
```

### Common errors

| Status | code | When |
|---|---|---|
| 400 | `BAD_REQUEST` | Malformed JSON body |
| 404 | `NOT_FOUND` | Unknown route |
| 413 | `PAYLOAD_TOO_LARGE` | Body over 200 KB |
| 429 | `RATE_LIMITED` | Too many requests to `/api/v1` |
| 500 | `INTERNAL_ERROR` | Unexpected error (details only in server logs) |

## Planned (Phase 3): all require `Authorization: Bearer <token>`

| Resource | Endpoints |
|---|---|
| Profile | `GET/PUT /api/v1/profile` |
| Targets | `GET /api/v1/targets?date=`, `POST /api/v1/targets` (new version) |
| Preferences | `GET/PUT /api/v1/preferences` |
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
