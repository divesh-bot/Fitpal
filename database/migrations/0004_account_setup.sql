-- =============================================================================
-- 0004_account_setup.sql — new-account setup, plan import / reset.
--
-- Meal-plan JSON format (also the export/import file format, version 1):
-- {
--   "version": 1,
--   "name": "My plan",
--   "days": [ { "weekday": 1..7, "isStrictVeg": bool,
--               "meals": [ { "slot": "post_workout|breakfast|lunch|dinner",
--                            "title": "...", "note": "...",
--                            "ingredients": [ { "name", "qtyLabel", "quantity", "unit",
--                                               "kcal", "proteinG", "carbsG", "fatG",
--                                               "dietType", "foodKey" } ] } ] } ],
--   "snacks": [ { "kind": "sweet|salty", "name", "description", "ingredients": [...] } ]   -- optional
-- }
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Builds a complete meal plan for p_user from a JSON payload, replacing the
-- currently active plan (and the snack options, when "snacks" is supplied).
--
-- SECURITY INVOKER: when a signed-in user calls it (via the public wrappers
-- below), every insert is subject to RLS, so it can only ever write rows for
-- that user. Atomic: the caller's transaction rolls everything back on error.
-- Logged food entries are untouched (their nutrition is a snapshot); their
-- plan_meal_id link is simply cleared.
-- -----------------------------------------------------------------------------
create or replace function private.materialize_meal_plan(p_user uuid, p_payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_plan_id  uuid;
  v_day      jsonb;
  v_day_id   uuid;
  v_meal     jsonb;
  v_meal_id  uuid;
  v_ing      jsonb;
  v_snack    jsonb;
  v_recipe   uuid;
  v_pos      integer;
begin
  if p_user is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if jsonb_typeof(p_payload) is distinct from 'object'
     or jsonb_typeof(p_payload -> 'days') is distinct from 'array'
     or jsonb_array_length(p_payload -> 'days') > 7 then
    raise exception 'Invalid meal plan: "days" must be an array of at most 7 days' using errcode = '22023';
  end if;
  if pg_column_size(p_payload) > 512 * 1024 then
    raise exception 'Invalid meal plan: payload too large' using errcode = '22023';
  end if;

  delete from public.meal_plans where user_id = p_user and is_active;

  insert into public.meal_plans (user_id, name)
  values (p_user, coalesce(nullif(btrim(p_payload ->> 'name'), ''), 'My meal plan'))
  returning id into v_plan_id;

  for v_day in select value from jsonb_array_elements(p_payload -> 'days')
  loop
    -- Day first, so the strict-veg trigger can check each ingredient.
    insert into public.meal_plan_days (plan_id, user_id, weekday, is_strict_veg)
    values (v_plan_id, p_user, (v_day ->> 'weekday')::smallint, coalesce((v_day ->> 'isStrictVeg')::boolean, false))
    returning id into v_day_id;

    for v_meal in select value from jsonb_array_elements(coalesce(v_day -> 'meals', '[]'::jsonb))
    loop
      insert into public.meal_plan_meals (day_id, user_id, slot, title, note)
      values (v_day_id, p_user, v_meal ->> 'slot', v_meal ->> 'title', nullif(v_meal ->> 'note', ''))
      returning id into v_meal_id;

      if jsonb_array_length(coalesce(v_meal -> 'ingredients', '[]'::jsonb)) > 60 then
        raise exception 'Invalid meal plan: too many ingredients in one meal' using errcode = '22023';
      end if;

      v_pos := 0;
      for v_ing in select value from jsonb_array_elements(coalesce(v_meal -> 'ingredients', '[]'::jsonb))
      loop
        insert into public.meal_plan_meal_ingredients
          (meal_id, user_id, position, food_item_id, name, quantity, unit, qty_label,
           kcal, protein_g, carbs_g, fat_g, diet_type)
        values (
          v_meal_id, p_user, v_pos,
          (select f.id from public.food_items f where f.user_id is null and f.seed_key = v_ing ->> 'foodKey'),
          v_ing ->> 'name',
          (v_ing ->> 'quantity')::numeric,
          v_ing ->> 'unit',
          v_ing ->> 'qtyLabel',
          coalesce((v_ing ->> 'kcal')::numeric, 0),
          coalesce((v_ing ->> 'proteinG')::numeric, 0),
          (v_ing ->> 'carbsG')::numeric,
          (v_ing ->> 'fatG')::numeric,
          coalesce(v_ing ->> 'dietType', 'veg')
        );
        v_pos := v_pos + 1;
      end loop;
    end loop;
  end loop;

  -- Guarantee all seven days exist even if the payload omitted some.
  insert into public.meal_plan_days (plan_id, user_id, weekday)
  select v_plan_id, p_user, d::smallint from generate_series(1, 7) as d
  on conflict (plan_id, weekday) do nothing;

  -- Snack options (only replaced when the payload includes them).
  if jsonb_typeof(p_payload -> 'snacks') = 'array' then
    if jsonb_array_length(p_payload -> 'snacks') > 50 then
      raise exception 'Invalid meal plan: too many snack options' using errcode = '22023';
    end if;

    delete from public.recipes where user_id = p_user and category in ('snack_sweet', 'snack_salty');

    for v_snack in select value from jsonb_array_elements(p_payload -> 'snacks')
    loop
      insert into public.recipes (user_id, name, category, description)
      values (
        p_user,
        v_snack ->> 'name',
        case v_snack ->> 'kind' when 'sweet' then 'snack_sweet' when 'salty' then 'snack_salty' end,
        nullif(v_snack ->> 'description', '')
      )
      returning id into v_recipe;

      v_pos := 0;
      for v_ing in select value from jsonb_array_elements(coalesce(v_snack -> 'ingredients', '[]'::jsonb))
      loop
        insert into public.recipe_ingredients
          (recipe_id, user_id, position, food_item_id, name, quantity, unit, qty_label,
           kcal, protein_g, carbs_g, fat_g, diet_type)
        values (
          v_recipe, p_user, v_pos,
          (select f.id from public.food_items f where f.user_id is null and f.seed_key = v_ing ->> 'foodKey'),
          v_ing ->> 'name',
          (v_ing ->> 'quantity')::numeric,
          v_ing ->> 'unit',
          v_ing ->> 'qtyLabel',
          coalesce((v_ing ->> 'kcal')::numeric, 0),
          coalesce((v_ing ->> 'proteinG')::numeric, 0),
          (v_ing ->> 'carbsG')::numeric,
          (v_ing ->> 'fatG')::numeric,
          coalesce(v_ing ->> 'dietType', 'veg')
        );
        v_pos := v_pos + 1;
      end loop;
    end loop;
  end if;

  return v_plan_id;
end;
$$;

-- Creates a new "current" grocery list from a JSON array of {name, quantityLabel}.
create or replace function private.create_grocery_list(p_user uuid, p_name text, p_items jsonb, p_source text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_list uuid;
begin
  update public.grocery_lists set is_current = false where user_id = p_user and is_current;

  insert into public.grocery_lists (user_id, name) values (p_user, p_name) returning id into v_list;

  insert into public.grocery_list_items (list_id, user_id, position, name, quantity_label, source)
  select v_list, p_user, (e.ord - 1)::smallint, e.item ->> 'name', e.item ->> 'quantityLabel', p_source
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) with ordinality as e(item, ord);

  return v_list;
end;
$$;

-- -----------------------------------------------------------------------------
-- New-account setup. Runs as the function owner (SECURITY DEFINER) because the
-- new user is not signed in yet when auth.users is inserted. It only ever
-- writes rows for NEW.id. Templates are optional: if they are missing, sign-up
-- still succeeds with an empty plan.
-- -----------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_targets  jsonb;
  v_prefs    jsonb;
  v_plan     jsonb;
  v_grocery  jsonb;
begin
  select payload into v_targets from public.app_templates where key = 'default_targets';
  select payload into v_prefs   from public.app_templates where key = 'default_preferences';
  select payload into v_plan    from public.app_templates where key = 'default_meal_plan';
  select payload into v_grocery from public.app_templates where key = 'default_groceries';

  insert into public.profiles (id, display_name)
  values (new.id, left(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), 80));

  insert into public.user_preferences (user_id, whole_eggs_only, excluded_foods, food_preferences)
  values (
    new.id,
    coalesce((v_prefs ->> 'wholeEggsOnly')::boolean, true),
    coalesce(array(select jsonb_array_elements_text(v_prefs -> 'excludedFoods')), array['tofu']::text[]),
    v_prefs ->> 'foodPreferences'
  );

  -- Initial targets apply from the beginning of time; later changes add rows.
  insert into public.nutrition_targets
    (user_id, effective_from, calories_kcal, protein_g, steps, creatine_g, bmr_kcal, tdee_kcal, note)
  values (
    new.id, date '1970-01-01',
    coalesce((v_targets ->> 'caloriesKcal')::integer, 2200),
    coalesce((v_targets ->> 'proteinG')::numeric, 160),
    coalesce((v_targets ->> 'steps')::integer, 6000),
    coalesce((v_targets ->> 'creatineG')::numeric, 5),
    (v_targets ->> 'bmrKcal')::integer,
    (v_targets ->> 'tdeeKcal')::integer,
    'Initial targets'
  );

  insert into public.habits (user_id, key, name, description, position) values
    (new.id, 'creatine', 'Creatine', 'Creatine monohydrate, 5 g daily', 1),
    (new.id, 'workout',  'Workout done', 'Morning PPL session (~40 min)', 2);

  if v_plan is not null then
    perform private.materialize_meal_plan(new.id, v_plan);
  end if;

  if v_grocery is not null then
    perform private.create_grocery_list(new.id, 'Weekly groceries', v_grocery, 'template');
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- -----------------------------------------------------------------------------
-- Public RPC functions for the signed-in user (called by the API).
-- SECURITY INVOKER + auth.uid(): they can only affect the caller's own data.
-- -----------------------------------------------------------------------------
create or replace function public.replace_my_meal_plan(p_payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.materialize_meal_plan(auth.uid(), p_payload);
end;
$$;

create or replace function public.reset_my_meal_plan()
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_plan jsonb;
begin
  select payload into v_plan from public.app_templates where key = 'default_meal_plan';
  if v_plan is null then
    raise exception 'Default meal plan template is missing' using errcode = 'P0002';
  end if;
  return private.materialize_meal_plan(auth.uid(), v_plan);
end;
$$;

-- -----------------------------------------------------------------------------
-- Function privileges. Postgres lets PUBLIC execute new functions by default;
-- lock that down and grant only what the signed-in user needs.
-- -----------------------------------------------------------------------------
revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.replace_my_meal_plan(jsonb) from public, anon;
revoke all on function public.reset_my_meal_plan() from public, anon;

grant usage on schema private to authenticated;
grant execute on function private.materialize_meal_plan(uuid, jsonb) to authenticated;
grant execute on function public.replace_my_meal_plan(jsonb) to authenticated;
grant execute on function public.reset_my_meal_plan() to authenticated;
