-- =============================================================================
-- 0005_write_functions.sql — atomic multi-row writes for the API.
--
-- The Supabase Data API runs each request as its own statement, so saving
-- "a recipe and its ingredients" as separate calls could leave half-saved
-- data if one call failed. These functions do each multi-row change in ONE
-- transaction: it fully succeeds or nothing changes.
--
-- All are SECURITY INVOKER and act on auth.uid(): Row Level Security and the
-- business-rule triggers (strict-veg, ownership checks) still apply.
-- Nutrition values are computed by the API and passed in; SQL only stores them.
--
-- Ingredient line JSON (snake_case, as stored):
--   { food_item_id?, name, quantity?, unit?, qty_label?, kcal, protein_g,
--     carbs_g?, fat_g?, diet_type? }
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Recipes (including snack options): create or replace with all ingredients.
-- -----------------------------------------------------------------------------
create or replace function public.save_my_recipe(p_recipe_id uuid, p_recipe jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if jsonb_typeof(p_recipe -> 'ingredients') is distinct from 'array'
     or jsonb_array_length(p_recipe -> 'ingredients') > 60 then
    raise exception 'ingredients must be an array of at most 60 items' using errcode = '22023';
  end if;

  if p_recipe_id is null then
    insert into public.recipes (user_id, name, category, description, servings)
    values (
      v_uid,
      p_recipe ->> 'name',
      coalesce(p_recipe ->> 'category', 'meal'),
      nullif(p_recipe ->> 'description', ''),
      coalesce((p_recipe ->> 'servings')::numeric, 1)
    )
    returning id into v_id;
  else
    update public.recipes
       set name = p_recipe ->> 'name',
           category = coalesce(p_recipe ->> 'category', category),
           description = nullif(p_recipe ->> 'description', ''),
           servings = coalesce((p_recipe ->> 'servings')::numeric, servings)
     where id = p_recipe_id and user_id = v_uid
    returning id into v_id;
    if v_id is null then
      raise exception 'Recipe not found' using errcode = 'P0002';
    end if;
    delete from public.recipe_ingredients where recipe_id = v_id;
  end if;

  insert into public.recipe_ingredients
    (recipe_id, user_id, position, food_item_id, name, quantity, unit, qty_label,
     kcal, protein_g, carbs_g, fat_g, diet_type)
  select v_id, v_uid, (e.ord - 1)::smallint,
         (e.item ->> 'food_item_id')::uuid, e.item ->> 'name',
         (e.item ->> 'quantity')::numeric, e.item ->> 'unit', e.item ->> 'qty_label',
         (e.item ->> 'kcal')::numeric, (e.item ->> 'protein_g')::numeric,
         (e.item ->> 'carbs_g')::numeric, (e.item ->> 'fat_g')::numeric,
         coalesce(e.item ->> 'diet_type', 'veg')
    from jsonb_array_elements(p_recipe -> 'ingredients') with ordinality as e(item, ord);

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Meal plan: set the meal in one slot of one weekday of the ACTIVE plan
-- (title, note and all ingredients). Strict-veg triggers still apply.
-- -----------------------------------------------------------------------------
create or replace function public.save_my_plan_meal(p_weekday smallint, p_slot text, p_meal jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_day  uuid;
  v_meal uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if jsonb_typeof(p_meal -> 'ingredients') is distinct from 'array'
     or jsonb_array_length(p_meal -> 'ingredients') > 60 then
    raise exception 'ingredients must be an array of at most 60 items' using errcode = '22023';
  end if;

  select d.id into v_day
    from public.meal_plan_days d
    join public.meal_plans p on p.id = d.plan_id
   where p.user_id = v_uid and p.is_active and d.weekday = p_weekday;
  if v_day is null then
    raise exception 'No active meal plan' using errcode = 'P0002';
  end if;

  insert into public.meal_plan_meals (day_id, user_id, slot, title, note)
  values (v_day, v_uid, p_slot, p_meal ->> 'title', nullif(p_meal ->> 'note', ''))
  on conflict (day_id, slot) do update set title = excluded.title, note = excluded.note
  returning id into v_meal;

  delete from public.meal_plan_meal_ingredients where meal_id = v_meal;

  insert into public.meal_plan_meal_ingredients
    (meal_id, user_id, position, food_item_id, name, quantity, unit, qty_label,
     kcal, protein_g, carbs_g, fat_g, diet_type)
  select v_meal, v_uid, (e.ord - 1)::smallint,
         (e.item ->> 'food_item_id')::uuid, e.item ->> 'name',
         (e.item ->> 'quantity')::numeric, e.item ->> 'unit', e.item ->> 'qty_label',
         (e.item ->> 'kcal')::numeric, (e.item ->> 'protein_g')::numeric,
         (e.item ->> 'carbs_g')::numeric, (e.item ->> 'fat_g')::numeric,
         coalesce(e.item ->> 'diet_type', 'veg')
    from jsonb_array_elements(p_meal -> 'ingredients') with ordinality as e(item, ord);

  return v_meal;
end;
$$;

-- Copies one weekday's meal in a slot to other weekdays. All-or-nothing: if
-- any target is a strict-veg day and the meal has egg/non-veg, nothing changes.
create or replace function public.copy_my_plan_meal(p_from_weekday smallint, p_slot text, p_to_weekdays smallint[])
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_meal   jsonb;
  v_target smallint;
  v_count  integer := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select jsonb_build_object(
           'title', m.title,
           'note', m.note,
           'ingredients', coalesce(
             (select jsonb_agg(to_jsonb(i) order by i.position)
                from public.meal_plan_meal_ingredients i where i.meal_id = m.id),
             '[]'::jsonb))
    into v_meal
    from public.meal_plan_meals m
    join public.meal_plan_days d on d.id = m.day_id
    join public.meal_plans p on p.id = d.plan_id
   where p.user_id = v_uid and p.is_active and d.weekday = p_from_weekday and m.slot = p_slot;

  if v_meal is null then
    raise exception 'Source meal not found' using errcode = 'P0002';
  end if;

  foreach v_target in array p_to_weekdays
  loop
    if v_target <> p_from_weekday then
      perform public.save_my_plan_meal(v_target, p_slot, v_meal);
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- Daily log: choose (or clear) the sweet / salty snack for a date.
-- p_entry is the nutrition snapshot computed by the API, or NULL to clear.
-- -----------------------------------------------------------------------------
create or replace function public.set_my_snack(p_date date, p_kind text, p_entry jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  delete from public.food_entries
   where user_id = v_uid and entry_date = p_date and snack_kind = p_kind;

  if p_entry is null or jsonb_typeof(p_entry) = 'null' then
    return null;
  end if;

  insert into public.food_entries
    (user_id, entry_date, meal_slot, source, snack_kind, recipe_id, name, qty_label,
     kcal, protein_g, carbs_g, fat_g)
  values (
    v_uid, p_date, 'snack', 'snack', p_kind,
    (p_entry ->> 'recipe_id')::uuid, p_entry ->> 'name', p_entry ->> 'qty_label',
    (p_entry ->> 'kcal')::numeric, (p_entry ->> 'protein_g')::numeric,
    (p_entry ->> 'carbs_g')::numeric, (p_entry ->> 'fat_g')::numeric
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- Clears a date's checkmarks: ticked plan meals, chosen snacks, habit ticks and
-- steps. Manually logged foods are KEPT (they are real data the user typed).
create or replace function public.reset_my_day(p_date date)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  delete from public.food_entries
   where user_id = v_uid and entry_date = p_date and source in ('plan_meal', 'snack');
  delete from public.habit_logs where user_id = v_uid and log_date = p_date;
  update public.daily_checkins set steps = null where user_id = v_uid and checkin_date = p_date;
end;
$$;

-- -----------------------------------------------------------------------------
-- Workouts: create or replace a session with all exercises and sets.
-- { session_date, split, duration_min?, notes?,
--   exercises: [ { name, notes?, sets: [ { reps, weight_kg?, rpe?, is_warmup? } ] } ] }
-- -----------------------------------------------------------------------------
create or replace function public.save_my_workout(p_session_id uuid, p_workout jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
  v_ex  record;
  v_ex_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if jsonb_typeof(p_workout -> 'exercises') is distinct from 'array'
     or jsonb_array_length(p_workout -> 'exercises') > 30 then
    raise exception 'exercises must be an array of at most 30 items' using errcode = '22023';
  end if;

  if p_session_id is null then
    insert into public.workout_sessions (user_id, session_date, split, duration_min, notes)
    values (v_uid, (p_workout ->> 'session_date')::date, p_workout ->> 'split',
            (p_workout ->> 'duration_min')::smallint, nullif(p_workout ->> 'notes', ''))
    returning id into v_id;
  else
    update public.workout_sessions
       set session_date = (p_workout ->> 'session_date')::date,
           split = p_workout ->> 'split',
           duration_min = (p_workout ->> 'duration_min')::smallint,
           notes = nullif(p_workout ->> 'notes', '')
     where id = p_session_id and user_id = v_uid
    returning id into v_id;
    if v_id is null then
      raise exception 'Workout not found' using errcode = 'P0002';
    end if;
    delete from public.workout_exercises where session_id = v_id; -- cascades to sets
  end if;

  for v_ex in
    select e.item, e.ord from jsonb_array_elements(p_workout -> 'exercises') with ordinality as e(item, ord)
  loop
    if jsonb_array_length(coalesce(v_ex.item -> 'sets', '[]'::jsonb)) > 20 then
      raise exception 'an exercise can have at most 20 sets' using errcode = '22023';
    end if;

    insert into public.workout_exercises (session_id, user_id, position, name, notes)
    values (v_id, v_uid, (v_ex.ord - 1)::smallint, v_ex.item ->> 'name', nullif(v_ex.item ->> 'notes', ''))
    returning id into v_ex_id;

    insert into public.workout_sets (exercise_id, user_id, set_number, reps, weight_kg, rpe, is_warmup)
    select v_ex_id, v_uid, s.ord::smallint,
           (s.item ->> 'reps')::smallint,
           (s.item ->> 'weight_kg')::numeric,
           (s.item ->> 'rpe')::numeric,
           coalesce((s.item ->> 'is_warmup')::boolean, false)
      from jsonb_array_elements(coalesce(v_ex.item -> 'sets', '[]'::jsonb)) with ordinality as s(item, ord);
  end loop;

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Grocery: replace the current list with a newly generated one. Custom items
-- the user added that are not yet purchased are carried over.
-- p_items: [ { name, quantity_label?, quantity?, unit? } ]
-- -----------------------------------------------------------------------------
create or replace function public.generate_my_grocery_list(p_name text, p_items jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_old   uuid;
  v_new   uuid;
  v_count integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 300 then
    raise exception 'items must be an array of at most 300 items' using errcode = '22023';
  end if;

  select id into v_old from public.grocery_lists where user_id = v_uid and is_current;
  if v_old is not null then
    update public.grocery_lists set is_current = false where id = v_old;
  end if;

  insert into public.grocery_lists (user_id, name, generated_from_plan_id, generated_at)
  values (
    v_uid,
    coalesce(nullif(btrim(p_name), ''), 'Weekly groceries'),
    (select p.id from public.meal_plans p where p.user_id = v_uid and p.is_active),
    now()
  )
  returning id into v_new;

  insert into public.grocery_list_items (list_id, user_id, position, name, quantity_label, quantity, unit, source)
  select v_new, v_uid, (e.ord - 1)::smallint, e.item ->> 'name', e.item ->> 'quantity_label',
         (e.item ->> 'quantity')::numeric, e.item ->> 'unit', 'generated'
    from jsonb_array_elements(p_items) with ordinality as e(item, ord);

  v_count := jsonb_array_length(p_items);

  if v_old is not null then
    insert into public.grocery_list_items (list_id, user_id, position, name, quantity_label, quantity, unit, source)
    select v_new, v_uid, (v_count + row_number() over (order by i.position))::smallint,
           i.name, i.quantity_label, i.quantity, i.unit, 'custom'
      from public.grocery_list_items i
     where i.list_id = v_old and i.source = 'custom' and not i.is_purchased;
  end if;

  return v_new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Privileges: signed-in users only.
-- -----------------------------------------------------------------------------
revoke all on function public.save_my_recipe(uuid, jsonb) from public, anon;
revoke all on function public.save_my_plan_meal(smallint, text, jsonb) from public, anon;
revoke all on function public.copy_my_plan_meal(smallint, text, smallint[]) from public, anon;
revoke all on function public.set_my_snack(date, text, jsonb) from public, anon;
revoke all on function public.reset_my_day(date) from public, anon;
revoke all on function public.save_my_workout(uuid, jsonb) from public, anon;
revoke all on function public.generate_my_grocery_list(text, jsonb) from public, anon;

grant execute on function public.save_my_recipe(uuid, jsonb) to authenticated;
grant execute on function public.save_my_plan_meal(smallint, text, jsonb) to authenticated;
grant execute on function public.copy_my_plan_meal(smallint, text, smallint[]) to authenticated;
grant execute on function public.set_my_snack(date, text, jsonb) to authenticated;
grant execute on function public.reset_my_day(date) to authenticated;
grant execute on function public.save_my_workout(uuid, jsonb) to authenticated;
grant execute on function public.generate_my_grocery_list(text, jsonb) to authenticated;
