-- =============================================================================
-- 0003_row_level_security.sql — who may read/write which rows.
--
-- Row Level Security (RLS) makes PostgreSQL itself check every query:
-- a signed-in user can only see and change rows whose user_id equals their
-- own auth user id (auth.uid()). This applies even if application code has a
-- bug. Supabase roles:
--   anon           not signed in        → no access to any table
--   authenticated  signed-in user       → own rows only (policies below)
--   service_role   server-side admin    → bypasses RLS (never used by the browser)
--
-- (select auth.uid()) is wrapped in a sub-select so Postgres evaluates it once
-- per query instead of once per row (Supabase performance recommendation).
-- =============================================================================

-- Not-signed-in visitors get nothing. Supabase grants table access to `anon`
-- by default, so revoke it explicitly.
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

-- -----------------------------------------------------------------------------
-- Standard owner-only tables: full CRUD on own rows.
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'nutrition_targets', 'user_preferences', 'recipes', 'recipe_ingredients',
    'meal_plans', 'meal_plan_days', 'meal_plan_meals', 'meal_plan_meal_ingredients',
    'food_entries', 'daily_checkins', 'habits', 'habit_logs',
    'workout_sessions', 'workout_exercises', 'workout_sets',
    'grocery_lists', 'grocery_list_items'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format(
      'create policy "owner can manage own rows" on public.%I
         for all to authenticated
         using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id)', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles: created by the sign-up trigger; users can read and update their
-- own profile but not insert or delete it (deleting the auth user cascades).
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
grant select, update on public.profiles to authenticated;
revoke insert, delete on public.profiles from authenticated;

create policy "owner can read own profile" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "owner can update own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- -----------------------------------------------------------------------------
-- food_items: everyone signed in can READ shared foods (user_id IS NULL) plus
-- their own; users can only create/change/delete their OWN custom foods.
-- Shared foods are changed only by migrations/seeds.
-- -----------------------------------------------------------------------------
alter table public.food_items enable row level security;
grant select, insert, update, delete on public.food_items to authenticated;

create policy "read shared and own foods" on public.food_items
  for select to authenticated
  using (user_id is null or (select auth.uid()) = user_id);

create policy "insert own foods" on public.food_items
  for insert to authenticated
  with check ((select auth.uid()) = user_id and seed_key is null);

create policy "update own foods" on public.food_items
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and seed_key is null);

create policy "delete own foods" on public.food_items
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- app_templates: read-only reference data.
-- -----------------------------------------------------------------------------
alter table public.app_templates enable row level security;
revoke insert, update, delete, truncate on public.app_templates from authenticated;
grant select on public.app_templates to authenticated;

create policy "signed-in users can read templates" on public.app_templates
  for select to authenticated
  using (true);

-- No signed-in user may TRUNCATE or alter table-level things.
revoke truncate, references, trigger on all tables in schema public from authenticated;
