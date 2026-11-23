-- =============================================================================
-- 0001_core_schema.sql — FitPal core tables
-- See docs/DATABASE_SCHEMA.md for the design and rationale.
--
-- Conventions
--   * UUID primary keys; created_at / updated_at maintained by trigger.
--   * Every user-owned row has user_id. Child tables reference their parent
--     with a composite FK (parent_id, user_id), which guarantees a child row
--     can never belong to a different user than its parent.
--   * Nutrition: numeric(8,2). carbs/fat are nullable: unknown ≠ zero.
--   * Enumerations are text + CHECK (easier to evolve than Postgres enums).
--   * Weekdays are ISO: 1 = Monday … 7 = Sunday.
-- =============================================================================

-- Internal helper functions live in a schema that the Supabase Data API does
-- not expose.
create schema if not exists private;
revoke all on schema private from public;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Templates (read-only reference data used to set up new accounts)
-- -----------------------------------------------------------------------------
create table public.app_templates (
  key          text primary key check (key ~ '^[a-z0-9_]{1,64}$'),
  description  text check (char_length(description) <= 200),
  payload      jsonb not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Profile, targets, preferences
-- -----------------------------------------------------------------------------
create table public.profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  display_name          text check (char_length(display_name) <= 80),
  sex                   text check (sex in ('male', 'female')),
  -- Birth year rather than full date of birth: enough for BMR, less personal data.
  birth_year            smallint check (birth_year between 1900 and 2100),
  height_cm             numeric(5,1) check (height_cm between 100 and 250),
  starting_weight_kg    numeric(5,2) check (starting_weight_kg between 25 and 400),
  activity_multiplier   numeric(4,3) not null default 1.340 check (activity_multiplier between 1.0 and 2.5),
  activity_description  text check (char_length(activity_description) <= 200),
  goal                  text not null default 'fat_loss' check (goal in ('fat_loss', 'maintenance', 'muscle_gain')),
  training_notes        text check (char_length(training_notes) <= 2000),
  timezone              text not null default 'Asia/Kolkata' check (char_length(timezone) between 1 and 64),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Versioned: a change of target inserts a new row, so past days keep the
-- target that applied to them. Lookup = latest effective_from <= date.
create table public.nutrition_targets (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  effective_from  date not null,
  calories_kcal   integer not null check (calories_kcal between 800 and 6000),
  protein_g       numeric(6,1) not null check (protein_g between 0 and 500),
  steps           integer not null default 6000 check (steps between 0 and 100000),
  creatine_g      numeric(4,1) not null default 5 check (creatine_g between 0 and 20),
  bmr_kcal        integer check (bmr_kcal between 500 and 5000),
  tdee_kcal       integer check (tdee_kcal between 500 and 8000),
  note            text check (char_length(note) <= 500),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, effective_from)
);

create table public.user_preferences (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  whole_eggs_only   boolean not null default true,
  excluded_foods    text[] not null default array['tofu']::text[] check (cardinality(excluded_foods) <= 50),
  food_preferences  text check (char_length(food_preferences) <= 2000),
  -- Non-sensitive UI preferences only (e.g. last selected tab).
  ui_settings       jsonb not null default '{}'::jsonb
                    check (jsonb_typeof(ui_settings) = 'object' and pg_column_size(ui_settings) < 8192),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Foods
-- -----------------------------------------------------------------------------
create table public.food_items (
  id              uuid primary key default gen_random_uuid(),
  -- NULL = shared reference food (seeded); otherwise a user's custom food.
  user_id         uuid references auth.users (id) on delete cascade,
  -- Stable key for shared seed foods (e.g. 'f_oats'), used by seeds/imports.
  seed_key        text unique check (seed_key ~ '^[a-z0-9_]{1,64}$'),
  name            text not null check (char_length(btrim(name)) between 1 and 120),
  brand           text check (char_length(brand) <= 80),
  basis           text not null check (basis in ('per_100g', 'per_100ml', 'per_unit')),
  unit_label      text not null check (char_length(unit_label) between 1 and 20),
  default_amount  numeric(8,2) not null check (default_amount > 0),
  kcal            numeric(8,2) not null check (kcal between 0 and 2000),
  protein_g       numeric(8,2) not null check (protein_g between 0 and 1000),
  carbs_g         numeric(8,2) check (carbs_g between 0 and 1000),
  fat_g           numeric(8,2) check (fat_g between 0 and 1000),
  diet_type       text not null default 'veg' check (diet_type in ('veg', 'egg', 'non_veg')),
  notes           text check (char_length(notes) <= 500),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (seed_key is null or user_id is null)
);
create unique index food_items_shared_name_uq on public.food_items (lower(name)) where user_id is null;
create unique index food_items_user_name_uq on public.food_items (user_id, lower(name)) where user_id is not null;

-- -----------------------------------------------------------------------------
-- Recipes (saved meals and the sweet/salty snack options)
-- -----------------------------------------------------------------------------
create table public.recipes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 120),
  category     text not null default 'meal' check (category in ('meal', 'snack_sweet', 'snack_salty')),
  description  text check (char_length(description) <= 500),
  servings     numeric(5,2) not null default 1 check (servings > 0 and servings <= 100),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, user_id)
);
create index recipes_user_category_idx on public.recipes (user_id, category);

-- Ingredient lines store their own nutrition values. If food_item_id is set,
-- the API recalculates them from the food item when the quantity changes;
-- otherwise they are manual values.
create table public.recipe_ingredients (
  id            uuid primary key default gen_random_uuid(),
  recipe_id     uuid not null,
  user_id       uuid not null,
  position      smallint not null default 0 check (position between 0 and 200),
  food_item_id  uuid references public.food_items (id) on delete set null,
  name          text not null check (char_length(btrim(name)) between 1 and 120),
  quantity      numeric(10,2) check (quantity >= 0),
  unit          text check (char_length(unit) <= 20),
  qty_label     text check (char_length(qty_label) <= 40),
  kcal          numeric(8,2) not null default 0 check (kcal between 0 and 20000),
  protein_g     numeric(8,2) not null default 0 check (protein_g between 0 and 2000),
  carbs_g       numeric(8,2) check (carbs_g between 0 and 2000),
  fat_g         numeric(8,2) check (fat_g between 0 and 2000),
  diet_type     text not null default 'veg' check (diet_type in ('veg', 'egg', 'non_veg')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  foreign key (recipe_id, user_id) references public.recipes (id, user_id) on delete cascade
);
create index recipe_ingredients_recipe_idx on public.recipe_ingredients (recipe_id, position);
create index recipe_ingredients_food_idx on public.recipe_ingredients (food_item_id);

-- -----------------------------------------------------------------------------
-- Meal plan: plan → 7 days → meal per slot → ingredient lines
-- -----------------------------------------------------------------------------
create table public.meal_plans (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 120),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, user_id)
);
create unique index meal_plans_one_active_uq on public.meal_plans (user_id) where is_active;

create table public.meal_plan_days (
  id             uuid primary key default gen_random_uuid(),
  plan_id        uuid not null,
  user_id        uuid not null,
  weekday        smallint not null check (weekday between 1 and 7),
  is_strict_veg  boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (plan_id, weekday),
  unique (id, user_id),
  foreign key (plan_id, user_id) references public.meal_plans (id, user_id) on delete cascade
);

create table public.meal_plan_meals (
  id          uuid primary key default gen_random_uuid(),
  day_id      uuid not null,
  user_id     uuid not null,
  slot        text not null check (slot in ('post_workout', 'breakfast', 'lunch', 'dinner')),
  title       text not null check (char_length(btrim(title)) between 1 and 120),
  note        text check (char_length(note) <= 500),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (day_id, slot),
  unique (id, user_id),
  foreign key (day_id, user_id) references public.meal_plan_days (id, user_id) on delete cascade
);

create table public.meal_plan_meal_ingredients (
  id            uuid primary key default gen_random_uuid(),
  meal_id       uuid not null,
  user_id       uuid not null,
  position      smallint not null default 0 check (position between 0 and 200),
  food_item_id  uuid references public.food_items (id) on delete set null,
  name          text not null check (char_length(btrim(name)) between 1 and 120),
  quantity      numeric(10,2) check (quantity >= 0),
  unit          text check (char_length(unit) <= 20),
  qty_label     text check (char_length(qty_label) <= 40),
  kcal          numeric(8,2) not null default 0 check (kcal between 0 and 20000),
  protein_g     numeric(8,2) not null default 0 check (protein_g between 0 and 2000),
  carbs_g       numeric(8,2) check (carbs_g between 0 and 2000),
  fat_g         numeric(8,2) check (fat_g between 0 and 2000),
  diet_type     text not null default 'veg' check (diet_type in ('veg', 'egg', 'non_veg')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  foreign key (meal_id, user_id) references public.meal_plan_meals (id, user_id) on delete cascade
);
create index meal_plan_meal_ingredients_meal_idx on public.meal_plan_meal_ingredients (meal_id, position);
create index meal_plan_meal_ingredients_food_idx on public.meal_plan_meal_ingredients (food_item_id);

-- -----------------------------------------------------------------------------
-- Food log: what was actually eaten. Nutrition is a SNAPSHOT taken when logged,
-- so later edits to foods, recipes or the plan never rewrite history.
-- -----------------------------------------------------------------------------
create table public.food_entries (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  entry_date         date not null,
  meal_slot          text not null default 'other'
                     check (meal_slot in ('post_workout', 'breakfast', 'lunch', 'dinner', 'snack', 'other')),
  source             text not null check (source in ('manual', 'food_item', 'recipe', 'plan_meal', 'snack')),
  food_item_id       uuid references public.food_items (id) on delete set null,
  recipe_id          uuid references public.recipes (id) on delete set null,
  plan_meal_id       uuid references public.meal_plan_meals (id) on delete set null,
  snack_kind         text check (snack_kind in ('sweet', 'salty')),
  name               text not null check (char_length(btrim(name)) between 1 and 160),
  quantity           numeric(10,2) check (quantity >= 0),
  unit               text check (char_length(unit) <= 20),
  qty_label          text check (char_length(qty_label) <= 60),
  kcal               numeric(8,2) not null check (kcal between 0 and 20000),
  protein_g          numeric(8,2) not null check (protein_g between 0 and 2000),
  carbs_g            numeric(8,2) check (carbs_g between 0 and 2000),
  fat_g              numeric(8,2) check (fat_g between 0 and 2000),
  -- Client-generated ID so a retried request cannot create a duplicate entry.
  client_request_id  uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check ((source = 'snack') = (snack_kind is not null))
);
create index food_entries_user_date_idx on public.food_entries (user_id, entry_date);
create index food_entries_food_idx on public.food_entries (food_item_id);
create index food_entries_recipe_idx on public.food_entries (recipe_id);
create index food_entries_plan_meal_idx on public.food_entries (plan_meal_id);
-- A planned meal slot can be ticked off once per day; one sweet + one salty snack per day.
create unique index food_entries_plan_slot_once_uq
  on public.food_entries (user_id, entry_date, meal_slot) where source = 'plan_meal';
create unique index food_entries_snack_once_uq
  on public.food_entries (user_id, entry_date, snack_kind) where snack_kind is not null;
create unique index food_entries_idempotency_uq
  on public.food_entries (user_id, client_request_id) where client_request_id is not null;

-- -----------------------------------------------------------------------------
-- Daily check-ins (one row per user per date; weight lives here)
-- -----------------------------------------------------------------------------
create table public.daily_checkins (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  checkin_date   date not null,
  weight_kg      numeric(5,2) check (weight_kg between 25 and 400),
  waist_cm       numeric(5,1) check (waist_cm between 30 and 250),
  steps          integer check (steps between 0 and 200000),
  sleep_hours    numeric(3,1) check (sleep_hours between 0 and 24),
  sleep_quality  text check (sleep_quality in ('poor', 'fair', 'good', 'great')),
  hunger         smallint check (hunger between 1 and 10),
  energy         smallint check (energy between 1 and 10),
  notes          text check (char_length(notes) <= 2000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, checkin_date)
);

-- -----------------------------------------------------------------------------
-- Habits (creatine, workout done, plus user-defined) and their daily logs
-- -----------------------------------------------------------------------------
create table public.habits (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  key          text not null check (key ~ '^[a-z0-9_]{1,40}$'),
  name         text not null check (char_length(btrim(name)) between 1 and 80),
  description  text check (char_length(description) <= 300),
  position     smallint not null default 0 check (position between 0 and 100),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, key),
  unique (id, user_id)
);

create table public.habit_logs (
  id          uuid primary key default gen_random_uuid(),
  habit_id    uuid not null,
  user_id     uuid not null,
  log_date    date not null,
  completed   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (habit_id, log_date),
  foreign key (habit_id, user_id) references public.habits (id, user_id) on delete cascade
);
create index habit_logs_user_date_idx on public.habit_logs (user_id, log_date);

-- -----------------------------------------------------------------------------
-- Workouts: session → exercises → sets
-- -----------------------------------------------------------------------------
create table public.workout_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  session_date  date not null,
  split         text not null check (split in ('push', 'pull', 'legs', 'rest', 'other')),
  duration_min  smallint check (duration_min between 0 and 600),
  notes         text check (char_length(notes) <= 2000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (id, user_id)
);
create index workout_sessions_user_date_idx on public.workout_sessions (user_id, session_date desc);

create table public.workout_exercises (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null,
  user_id     uuid not null,
  position    smallint not null default 0 check (position between 0 and 100),
  name        text not null check (char_length(btrim(name)) between 1 and 120),
  notes       text check (char_length(notes) <= 1000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, user_id),
  foreign key (session_id, user_id) references public.workout_sessions (id, user_id) on delete cascade
);
create index workout_exercises_session_idx on public.workout_exercises (session_id, position);
-- Progression lookups by exercise name.
create index workout_exercises_user_name_idx on public.workout_exercises (user_id, lower(name));

create table public.workout_sets (
  id           uuid primary key default gen_random_uuid(),
  exercise_id  uuid not null,
  user_id      uuid not null,
  set_number   smallint not null check (set_number between 1 and 100),
  reps         smallint not null check (reps between 0 and 1000),
  weight_kg    numeric(6,2) check (weight_kg between 0 and 1000),
  rpe          numeric(3,1) check (rpe between 1 and 10),
  is_warmup    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (exercise_id, set_number),
  foreign key (exercise_id, user_id) references public.workout_exercises (id, user_id) on delete cascade
);

-- -----------------------------------------------------------------------------
-- Grocery lists
-- -----------------------------------------------------------------------------
create table public.grocery_lists (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users (id) on delete cascade,
  name                    text not null check (char_length(btrim(name)) between 1 and 120),
  is_current              boolean not null default true,
  generated_from_plan_id  uuid references public.meal_plans (id) on delete set null,
  generated_at            timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (id, user_id)
);
create unique index grocery_lists_one_current_uq on public.grocery_lists (user_id) where is_current;

create table public.grocery_list_items (
  id              uuid primary key default gen_random_uuid(),
  list_id         uuid not null,
  user_id         uuid not null,
  position        smallint not null default 0 check (position between 0 and 1000),
  name            text not null check (char_length(btrim(name)) between 1 and 120),
  quantity_label  text check (char_length(quantity_label) <= 60),
  quantity        numeric(10,2) check (quantity >= 0),
  unit            text check (char_length(unit) <= 20),
  is_purchased    boolean not null default false,
  source          text not null default 'custom' check (source in ('generated', 'custom', 'template')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  foreign key (list_id, user_id) references public.grocery_lists (id, user_id) on delete cascade
);
create index grocery_list_items_list_idx on public.grocery_list_items (list_id, position);

-- -----------------------------------------------------------------------------
-- updated_at triggers for every table
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'app_templates', 'profiles', 'nutrition_targets', 'user_preferences', 'food_items',
    'recipes', 'recipe_ingredients', 'meal_plans', 'meal_plan_days', 'meal_plan_meals',
    'meal_plan_meal_ingredients', 'food_entries', 'daily_checkins', 'habits', 'habit_logs',
    'workout_sessions', 'workout_exercises', 'workout_sets', 'grocery_lists', 'grocery_list_items'
  ]
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function private.set_updated_at()', t);
  end loop;
end;
$$;
