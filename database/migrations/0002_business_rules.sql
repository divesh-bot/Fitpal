-- =============================================================================
-- 0002_business_rules.sql — rules enforced by the database itself.
-- The API validates these first (with friendly messages); these triggers are
-- the last line of defence so no code path can bypass them.
--
-- Error codes raised here (mapped by the API):
--   23514 check_violation        → STRICT_VEG_VIOLATION
--   23503 foreign_key_violation  → reference to a row the user does not own
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Rule: a strictly vegetarian day (e.g. Tuesday) may not contain egg or
-- non-veg ingredients.
-- -----------------------------------------------------------------------------
create or replace function private.enforce_strict_veg_ingredient()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_strict boolean;
begin
  if new.diet_type = 'veg' then
    return new;
  end if;

  select d.is_strict_veg
    into v_strict
    from public.meal_plan_meals m
    join public.meal_plan_days d on d.id = m.day_id
   where m.id = new.meal_id;

  if coalesce(v_strict, false) then
    raise exception 'STRICT_VEG_VIOLATION: "%" (%) cannot be added to a strictly vegetarian day', new.name, new.diet_type
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger enforce_strict_veg
  before insert or update of diet_type, meal_id on public.meal_plan_meal_ingredients
  for each row execute function private.enforce_strict_veg_ingredient();

-- Marking a day strict-veg is refused while it still contains egg/non-veg items.
create or replace function private.enforce_strict_veg_day()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
      from public.meal_plan_meals m
      join public.meal_plan_meal_ingredients i on i.meal_id = m.id
     where m.day_id = new.id
       and i.diet_type <> 'veg'
  ) then
    raise exception 'STRICT_VEG_VIOLATION: remove egg/non-veg ingredients before marking this day strictly vegetarian'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger enforce_strict_veg_day
  before update of is_strict_veg on public.meal_plan_days
  for each row
  when (new.is_strict_veg and not old.is_strict_veg)
  execute function private.enforce_strict_veg_day();

-- Moving a meal onto a strict-veg day is checked the same way.
create or replace function private.enforce_strict_veg_meal_move()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.meal_plan_days d where d.id = new.day_id and d.is_strict_veg)
     and exists (select 1 from public.meal_plan_meal_ingredients i where i.meal_id = new.id and i.diet_type <> 'veg')
  then
    raise exception 'STRICT_VEG_VIOLATION: this meal contains egg/non-veg ingredients and cannot be moved to a strictly vegetarian day'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger enforce_strict_veg_meal_move
  before update of day_id on public.meal_plan_meals
  for each row
  when (new.day_id is distinct from old.day_id)
  execute function private.enforce_strict_veg_meal_move();

-- -----------------------------------------------------------------------------
-- Rule: rows may only reference foods the user can see (shared or their own)
-- and recipes / plan meals the user owns. Plain foreign keys do not check
-- ownership, so without this a user could link another user's private row.
-- -----------------------------------------------------------------------------
create or replace function private.assert_owned_references()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  r jsonb := to_jsonb(new);
  v uuid;
begin
  v := (r ->> 'food_item_id')::uuid;
  if v is not null and not exists (
    select 1 from public.food_items f where f.id = v and (f.user_id is null or f.user_id = new.user_id)
  ) then
    raise exception 'Referenced food item is not available' using errcode = '23503';
  end if;

  v := (r ->> 'recipe_id')::uuid;
  if v is not null and not exists (
    select 1 from public.recipes x where x.id = v and x.user_id = new.user_id
  ) then
    raise exception 'Referenced recipe is not available' using errcode = '23503';
  end if;

  v := (r ->> 'plan_meal_id')::uuid;
  if v is not null and not exists (
    select 1 from public.meal_plan_meals m where m.id = v and m.user_id = new.user_id
  ) then
    raise exception 'Referenced plan meal is not available' using errcode = '23503';
  end if;

  return new;
end;
$$;

create trigger assert_owned_references
  before insert or update on public.recipe_ingredients
  for each row execute function private.assert_owned_references();

create trigger assert_owned_references
  before insert or update on public.meal_plan_meal_ingredients
  for each row execute function private.assert_owned_references();

create trigger assert_owned_references
  before insert or update on public.food_entries
  for each row execute function private.assert_owned_references();

-- grocery_lists.generated_from_plan_id must also be the user's own plan.
create or replace function private.assert_owned_grocery_plan()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.generated_from_plan_id is not null and not exists (
    select 1 from public.meal_plans p where p.id = new.generated_from_plan_id and p.user_id = new.user_id
  ) then
    raise exception 'Referenced meal plan is not available' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger assert_owned_grocery_plan
  before insert or update of generated_from_plan_id on public.grocery_lists
  for each row execute function private.assert_owned_grocery_plan();
