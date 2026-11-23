# Database Schema

> **Status:** migrations written and tested locally (30 tests, PGlite / PostgreSQL 18). **Not yet applied to Supabase.**
> Source of truth: [database/migrations/](../database/migrations/).

## Migrations

| File | Contents |
|---|---|
| `0001_core_schema.sql` | All tables, constraints, indexes, `updated_at` triggers |
| `0002_business_rules.sql` | Strict-veg day rule; ownership checks on references |
| `0003_row_level_security.sql` | RLS policies and grants |
| `0004_account_setup.sql` | Sign-up setup trigger; plan import/reset functions |
| `0005_write_functions.sql` | Atomic multi-row writes used by the API: `save_my_recipe`, `save_my_plan_meal`, `copy_my_plan_meal`, `set_my_snack`, `reset_my_day`, `save_my_workout`, `generate_my_grocery_list` (all SECURITY INVOKER; **not yet applied to Supabase**) |
| `seed/0001_reference_data.sql` | 42 shared foods + default plan/snacks/groceries/targets/preferences templates (generated from the prototype) |

## Tables and relationships

```
auth.users (Supabase Auth)
 ├─1:1─ profiles
 ├─1:1─ user_preferences
 ├─1:N─ nutrition_targets            versioned by effective_from
 ├─1:N─ food_items                   user_id NULL = shared seed foods
 ├─1:N─ recipes ─1:N─ recipe_ingredients ─N:1─▶ food_items
 ├─1:N─ meal_plans ─1:7─ meal_plan_days ─1:4─ meal_plan_meals ─1:N─ meal_plan_meal_ingredients ─N:1─▶ food_items
 ├─1:N─ food_entries ─N:1─▶ food_items / recipes / meal_plan_meals (optional links)
 ├─1:N─ daily_checkins               UNIQUE (user_id, checkin_date)
 ├─1:N─ habits ─1:N─ habit_logs      UNIQUE (habit_id, log_date)
 ├─1:N─ workout_sessions ─1:N─ workout_exercises ─1:N─ workout_sets
 └─1:N─ grocery_lists ─1:N─ grocery_list_items
app_templates                        read-only reference data
```

| Table | Key columns | Notes |
|---|---|---|
| `profiles` | `id` (= auth user), sex, `birth_year`, height_cm, starting_weight_kg, activity_multiplier (default 1.34), goal, training_notes, timezone | Birth year instead of full date of birth (less personal data, enough for BMR) |
| `nutrition_targets` | effective_from, calories_kcal, protein_g, steps, creatine_g, bmr_kcal, tdee_kcal | Initial row has `effective_from = 1970-01-01`. Changes add rows. Target for a date = latest row with `effective_from <= date` |
| `user_preferences` | whole_eggs_only, excluded_foods (`{tofu}`), food_preferences, ui_settings | |
| `food_items` | seed_key, name, basis (`per_100g`/`per_100ml`/`per_unit`), unit_label, default_amount, kcal, protein_g, carbs_g?, fat_g?, diet_type (`veg`/`egg`/`non_veg`) | Unique name per owner |
| `recipes` | name, category (`meal`/`snack_sweet`/`snack_salty`), description, servings | Snacks are recipes |
| `*_ingredients` | position, food_item_id?, name, quantity, unit, qty_label, kcal, protein_g, carbs_g?, fat_g?, diet_type | Values stored per line. Linked lines are recalculated by the API when quantity changes |
| `meal_plans` | name, is_active | One active plan per user |
| `meal_plan_days` | weekday (1 = Mon … 7 = Sun), is_strict_veg | All 7 days always exist |
| `meal_plan_meals` | slot (`post_workout`/`breakfast`/`lunch`/`dinner`), title, note | One meal per slot per day |
| `food_entries` | entry_date, meal_slot, source (`manual`/`food_item`/`recipe`/`plan_meal`/`snack`), snack_kind, name, qty, kcal, protein_g, carbs_g?, fat_g?, client_request_id | **Nutrition snapshot**: never changes when foods or the plan change |
| `daily_checkins` | checkin_date, weight_kg, waist_cm, steps, sleep_hours, sleep_quality, hunger 1–10, energy 1–10, notes | Replaces a separate `weight_logs` table |
| `habits` / `habit_logs` | key, name / log_date, completed | `creatine` and `workout` created at sign-up |
| `workout_*` | session_date, split (`push`/`pull`/`legs`/`rest`/`other`), duration / exercise name / set_number, reps, weight_kg, rpe, is_warmup | Per-set detail |
| `grocery_*` | is_current / name, quantity_label, quantity, unit, is_purchased, source | One current list per user |

## Integrity rules

| Rule | Enforced by |
|---|---|
| Child rows belong to the same user as their parent | Composite FKs `(parent_id, user_id)` |
| References only to visible foods and owned recipes / plan meals | Trigger `private.assert_owned_references` |
| No egg/non-veg ingredient on a strict-veg day; can't mark a day strict-veg while it has them; can't move such a meal onto one | Triggers in `0002` (error `23514`, message `STRICT_VEG_VIOLATION`) |
| A planned slot is logged at most once per day; one sweet and one salty snack per day | Partial unique indexes on `food_entries` |
| Retried requests don't duplicate | Unique `(user_id, client_request_id)` |
| One check-in per date | Unique `(user_id, checkin_date)` |
| Value ranges (hunger 1–10, kcal ≥ 0, …) | CHECK constraints |
| "No tofu" | API validation against `user_preferences.excluded_foods` (a preference, not a hard DB rule) |

## Row Level Security policies

| Table(s) | `anon` | `authenticated` |
|---|---|---|
| All user tables (targets, preferences, recipes, plans, entries, check-ins, habits, workouts, groceries + children) | none | full CRUD where `user_id = auth.uid()` (USING and WITH CHECK) |
| `profiles` | none | SELECT/UPDATE where `id = auth.uid()`. No insert or delete (the sign-up trigger creates the profile; deleting the account cascades) |
| `food_items` | none | SELECT shared (`user_id IS NULL`) + own. INSERT/UPDATE/DELETE own only, and never with a `seed_key` |
| `app_templates` | none | SELECT only |

Functions: `public.replace_my_meal_plan(jsonb)` and `public.reset_my_meal_plan()` are `SECURITY INVOKER` and use `auth.uid()`, so RLS applies to everything they write. Only `private.handle_new_user()` (the sign-up trigger) is `SECURITY DEFINER`, and it only writes rows for the new user. All other execute rights are revoked from `public` and `anon`.

## Seed data

See [database/seed/SEED_REPORT.md](../database/seed/SEED_REPORT.md). The plan's values are seeded exactly as written. One difference from the food database is recorded (Mon lunch tomato/onion base: 35 vs 33 kcal). Country Delight milk carbs and fat are NULL.
