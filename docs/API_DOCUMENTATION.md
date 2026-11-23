# API Documentation

Base URL: `http://localhost:4000` (local). The production URL will be set in Phase 6.

All responses are JSON in the form `{ "data": ... }` or `{ "error": { "code", "message", "details?", "requestId?" } }`.

Dates are the user's **local calendar date** as `YYYY-MM-DD`. The server never works out "today" itself. Writes to future dates are rejected.

## `GET /health`

Liveness check. No auth required and not rate-limited. Response is `Cache-Control: no-store`.

```json
200 { "data": { "status": "ok", "version": "1", "timestamp": "2026-11-23T08:39:41.441Z" } }
```

## Authentication (all `/api/v1/*` routes)

Send the Supabase access token from the signed-in session:

```
Authorization: Bearer <supabase access token>
```

The API verifies the token's ES256 signature against the project's public keys (`/auth/v1/.well-known/jwks.json`) and checks issuer, audience (`authenticated`), expiry and that the role is `authenticated`. The user id is taken **only** from the verified token. Every `/api/v1` path, including unknown ones, returns 401 without a valid token. Another user's records always behave as if they don't exist (404).

## Profile

| Method & path | Body / query | Returns |
|---|---|---|
| `GET /api/v1/profile` | | `ProfileDto` |
| `PUT /api/v1/profile` | Any subset of `displayName`, `sex` (`male`/`female`), `birthYear`, `heightCm` (100–250), `startingWeightKg` (25–400), `activityMultiplier` (1–2.5), `activityDescription`, `goal` (`fat_loss`/`maintenance`/`muscle_gain`), `trainingNotes`, `timezone` (IANA). Unknown fields → 422 | `ProfileDto` |

`ProfileDto`: `{ displayName, email, sex, birthYear, heightCm, startingWeightKg, activityMultiplier, activityDescription, goal, trainingNotes, timezone, updatedAt }`

## Targets (versioned)

| Method & path | Body / query | Returns |
|---|---|---|
| `GET /api/v1/targets?date=YYYY-MM-DD` | `date` required | `TargetsDto` in effect that day |
| `GET /api/v1/targets/history` | | `TargetsDto[]`, newest first |
| `PUT /api/v1/targets/:effectiveFrom` | `{ caloriesKcal (800–6000), proteinG (0–500), steps (0–100000), creatineG? = 5, bmrKcal?, tdeeKcal?, note? }` | `TargetsDto`. Applies from that date onwards and replaces an existing version on the same date. Earlier days keep their old target |

`TargetsDto`: `{ id, effectiveFrom, caloriesKcal, proteinG, steps, creatineG, bmrKcal, tdeeKcal, note }`

## Preferences

| Method & path | Body | Returns |
|---|---|---|
| `GET /api/v1/preferences` | | `PreferencesDto` |
| `PUT /api/v1/preferences` | Any of `wholeEggsOnly`, `excludedFoods` (lower-cased, de-duplicated, ≤ 50), `foodPreferences`, `uiSettings` (flat object of string/number/boolean/null, ≤ 30 keys) | `PreferencesDto` |

## Foods

Shared reference foods (the 42 seeded ones; read-only) plus the user's own custom foods.

| Method & path | Body / query | Returns |
|---|---|---|
| `GET /api/v1/foods` | `q?` (≤ 60 chars, case-insensitive, `%`/`_` matched literally), `limit?` (1–100, default 50), `offset?` | `FoodDto[]` sorted by name |
| `GET /api/v1/foods/:id` | | `FoodDto` |
| `POST /api/v1/foods` | `{ name, brand?, basis (per_100g / per_100ml / per_unit), unitLabel, defaultAmount, kcal, proteinG, carbsG?, fatG?, dietType? (veg / egg / non_veg), notes? }`. Unit label is forced to `g`/`ml` for per-100 bases. Per-100 protein + carbs + fat ≤ 100 g | `201 FoodDto` (`409` on a duplicate name) |
| `PUT /api/v1/foods/:id` | Any subset of the create fields | `FoodDto` (`403` for shared foods) |
| `DELETE /api/v1/foods/:id` | | `204` (`403` for shared foods) |

`FoodDto`: `{ id, name, brand, basis, unitLabel, defaultAmount, per: { kcal, proteinG, carbsG|null, fatG|null }, dietType, notes, isShared, isExcluded }`. `per` is per 100 g, per 100 ml or per 1 unit depending on `basis`. `isExcluded` = the name matches the user's excluded foods (e.g. tofu).

**Nutrition maths** (`services/nutritionMath.ts`, shared by all modules): amount × per-basis value. kcal rounded to whole numbers, macros to 1 decimal (same as the prototype). Unknown carbs/fat stay `null`, and totals report whether they are complete.

## Ingredient input (recipes and meal plans)

Each ingredient is either:

- **food-linked** `{ foodItemId, amount, name?, qtyLabel? }`. Nutrition is calculated by the server from the food; nutrition values sent by the client are rejected.
- **manual** `{ name, qtyLabel?, quantity?, unit?, kcal, proteinG, carbsG?, fatG?, dietType? }`

Rules: excluded foods (tofu) → `EXCLUDED_FOOD`. Separated or liquid egg whites → `WHOLE_EGGS_ONLY`. The diet type can only be made *stricter* by the name ("Chicken …" is non-veg even if sent as veg). At most 60 per recipe or meal.

`IngredientDto`: `{ id, position, foodItemId, name, quantity, unit, qtyLabel, kcal, proteinG, carbsG, fatG, dietType }`

## Recipes (saved meals and snack options)

| Method & path | Body / query | Returns |
|---|---|---|
| `GET /api/v1/recipes` | `category?` = `meal` / `snack_sweet` / `snack_salty` | `RecipeDto[]` |
| `GET /api/v1/recipes/:id` | | `RecipeDto` |
| `POST /api/v1/recipes` | `{ name, category?, description?, servings? (default 1), ingredients (1–60) }` | `201 RecipeDto` |
| `PUT /api/v1/recipes/:id` | Same as POST (full replace, atomic) | `RecipeDto` |
| `DELETE /api/v1/recipes/:id` | | `204` |

`RecipeDto`: `{ id, name, category, description, servings, ingredients, totals: { kcal, proteinG, carbsG, fatG, carbsComplete, fatComplete }, perServing, dietType, updatedAt }`

## Meal plan (the active 7-day plan)

weekday: 1 = Monday … 7 = Sunday. slot: `post_workout` / `breakfast` / `lunch` / `dinner`.

| Method & path | Body | Returns |
|---|---|---|
| `GET /api/v1/meal-plans/active` | | `PlanDto` |
| `PUT /api/v1/meal-plans/active/days/:weekday/meals/:slot` | `{ title, note?, ingredients }` | `PlanDto` |
| `DELETE /api/v1/meal-plans/active/days/:weekday/meals/:slot` | | `PlanDto` |
| `POST /api/v1/meal-plans/active/days/:weekday/meals/:slot/copy` | `{ toWeekdays: [1..7] }`. All-or-nothing | `{ copied, plan }` |
| `PATCH /api/v1/meal-plans/active/days/:weekday` | `{ isStrictVeg }`. Refused while the day has egg/non-veg items | `PlanDto` |
| `GET /api/v1/meal-plans/active/export` | | FitPal plan file v1 (download) |
| `POST /api/v1/meal-plans/active/import` | A FitPal file (**v1**) or the HTML prototype's export (**v2**). Same rule checks; atomic | `PlanDto` |
| `POST /api/v1/meal-plans/active/reset` | | `PlanDto`, with the default plan and snack options restored |

`PlanDto`: `{ id, name, updatedAt, days: [{ weekday, dayName, isStrictVeg, plannedTotals, meals: [{ id, slot, title, note, ingredients, totals, dietType }] }] }`

## Daily log and the Today screen

| Method & path | Body / query | Returns |
|---|---|---|
| `GET /api/v1/days/:date` | | **Today summary**: target (in effect that day), consumed, planned, remaining, progress %, planMeals (with ticked status), snacks, entries, habits (done or not), steps, check-in, workouts |
| `PUT /api/v1/days/:date/plan-meals/:slot` | `{ eaten }`. Ticking stores a snapshot of the planned meal (once per slot per day). Ticking post-workout also ticks creatine | Today summary |
| `PUT /api/v1/days/:date/snacks/:kind` | `{ recipeId }` or `{ recipeId: null }`; kind `sweet` / `salty` | Today summary |
| `POST /api/v1/days/:date/reset` | Clears ticked meals, snacks, habit ticks and steps; **keeps** manually logged foods and weight | Today summary |
| `GET /api/v1/nutrition/daily?date=` | | The nutrition part of the summary |
| `GET /api/v1/food-entries` | `?date=` or `?from=&to=` (≤ 31 days) | `FoodEntryDto[]` |
| `POST /api/v1/food-entries` | One of: `{ source: "manual", date, mealSlot?, name, qtyLabel?, kcal, proteinG, carbsG?, fatG? }`, `{ source: "food_item", date, mealSlot?, foodItemId, amount }`, `{ source: "recipe", date, mealSlot?, recipeId, servings? }`. All accept `clientRequestId` (UUID): a retry returns the original entry (200) instead of creating a duplicate | `201 FoodEntryDto` |
| `PUT /api/v1/food-entries/:id` | `mealSlot`, `name`; `amount` (food entries, recalculated); `servings` (recipe entries); nutrition values (manual entries only) | `FoodEntryDto` |
| `DELETE /api/v1/food-entries/:id` | | `204` |

Every entry stores a **nutrition snapshot**, so later edits to foods, recipes or the plan never change past days. Carbs and fat are `null` when any part is unknown.

## Check-ins and progress

| Method & path | Body / query | Returns |
|---|---|---|
| `GET /api/v1/checkins?from=&to=` | ≤ 366 days | `CheckinDto[]` |
| `GET /api/v1/checkins/:date` | | `CheckinDto` or `null` |
| `PUT /api/v1/checkins/:date` | Any of `weightKg`, `waistCm`, `steps`, `sleepHours`, `sleepQuality` (poor/fair/good/great), `hunger` 1–10, `energy` 1–10, `notes`. Only provided fields change; `null` clears a field | `CheckinDto` |
| `DELETE /api/v1/checkins/:date` | | `204` |
| `GET /api/v1/progress/weight?from=&to=` | | `{ points: [{ date, weightKg, avg7 }], stats: { entries, latestDate, latestWeightKg, latestAvg7, weeklyChangeKg, averageWeeklyRateKg }, waist: [{ date, waistCm }] }` |

`avg7` is the mean of weigh-ins in the 7 **calendar** days ending on that date. The prototype used the last 7 entries; the two are identical with daily weigh-ins. `weeklyChangeKg` is this 7-day average minus the one a week earlier.

## Habits

| Method & path | Body / query | Returns |
|---|---|---|
| `GET /api/v1/habits` | `includeInactive?=true` | `HabitDto[]`: `{ id, key, name, description, position, isActive, isSystem }` |
| `POST /api/v1/habits` | `{ name, description? }` (max 30 habits) | `201 HabitDto` |
| `PUT /api/v1/habits/:id` | `name?`, `description?`, `position?`, `isActive?` | `HabitDto` |
| `DELETE /api/v1/habits/:id` | Built-in `creatine` / `workout` → 403 (hide them instead) | `204` |
| `GET /api/v1/habit-logs?from=&to=` | | `[{ habitId, date, completed }]` |
| `PUT /api/v1/habit-logs/:habitId/:date` | `{ completed }` | `{ habitId, date, completed }` |

## Workouts

| Method & path | Body / query | Returns |
|---|---|---|
| `GET /api/v1/workouts` | `from?`, `to?`, `limit?` (≤ 200, default 30); newest first | `WorkoutDto[]` |
| `GET /api/v1/workouts/:id` | | `WorkoutDto` |
| `POST /api/v1/workouts` | `{ date, split (push/pull/legs/rest/other), durationMin?, notes?, exercises: [{ name, notes?, sets: [{ reps, weightKg?, rpe?, isWarmup? }] (≤ 20) }] (≤ 30) }`. Non-rest sessions need at least 1 exercise | `201 WorkoutDto` |
| `PUT /api/v1/workouts/:id` | Same (full replace, atomic) | `WorkoutDto` |
| `DELETE /api/v1/workouts/:id` | | `204` |
| `GET /api/v1/workouts/exercises` | | Exercise names, most used first |
| `GET /api/v1/workouts/progression?exercise=` | Case-insensitive | `{ exercise, sessions: [{ date, split, workingSets, totalReps, volumeKg, topSet, estimated1RmKg }], bestEstimated1RmKg }` |

Warm-up sets are excluded from volume, top set and estimated 1RM (Epley: weight × (1 + reps/30), rounded to 0.5 kg). Historical PBs are never used as targets.

## Grocery

| Method & path | Body | Returns |
|---|---|---|
| `GET /api/v1/grocery-lists/current` | (created empty on first use) | `{ id, name, generatedAt, items: [{ id, name, quantityLabel, isPurchased, source, position }], purchased, total }` |
| `POST /api/v1/grocery-lists/current/items` | `{ name, quantityLabel? }` | `201`, the list |
| `POST /api/v1/grocery-lists/current/uncheck-all` | | The list |
| `POST /api/v1/grocery-lists/generate` | `{ name? }`. Sums the active plan's week per food and unit ("1.26 kg", "5 eggs"; unmeasured → "As needed"). Unpurchased custom items are carried over | The list |
| `PUT /api/v1/grocery-items/:id` | `name?`, `quantityLabel?`, `isPurchased?` | The item |
| `DELETE /api/v1/grocery-items/:id` | | `204` |

Plan quantities are as eaten (e.g. rice is cooked weight), so generated amounts may need adjusting for what you buy.

## Common errors

| Status | code | When |
|---|---|---|
| 400 | `BAD_REQUEST` | Malformed JSON body, invalid value, or unrecognised import file |
| 401 | `UNAUTHORIZED` | Missing, invalid, forged or expired token |
| 403 | `FORBIDDEN` | Changing a shared food, deleting a built-in habit, or the database refused |
| 404 | `NOT_FOUND` | Unknown route outside `/api/v1`, record not found, or another user's record |
| 409 | `CONFLICT` | Duplicate record |
| 413 | `PAYLOAD_TOO_LARGE` | Body over 200 KB |
| 422 | `VALIDATION_ERROR` | Input failed validation (`details` lists field problems) |
| 422 | `STRICT_VEG_VIOLATION` | Egg/non-veg item on a strictly vegetarian day |
| 422 | `INVALID_REFERENCE` | Refers to a food/recipe/meal that isn't available |
| 422 | `EXCLUDED_FOOD` | Ingredient matches the user's excluded foods (e.g. tofu) |
| 422 | `WHOLE_EGGS_ONLY` | Separated/liquid egg whites while the whole-eggs-only rule is on |
| 422 | `NOT_EDITABLE` | The field doesn't apply to this kind of food entry |
| 422 | `WRONG_SNACK_KIND` | A sweet recipe chosen as the salty snack, or vice versa |
| 429 | `RATE_LIMITED` | Too many requests to `/api/v1` |
| 503 | `AUTH_UNAVAILABLE` | Supabase signing keys temporarily unreachable |
| 500 | `INTERNAL_ERROR` | Unexpected error (details only in server logs) |
