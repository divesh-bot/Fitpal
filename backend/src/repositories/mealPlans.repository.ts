import type { Db } from "../config/supabase.js";
import type { Database, Json } from "../types/database.types.js";
import type { IngredientLine } from "../services/ingredients.service.js";
import { mapDbError, unwrap } from "../utils/dbErrors.js";

type Tables = Database["public"]["Tables"];
export type PlanIngredientRow = Tables["meal_plan_meal_ingredients"]["Row"];
export type MealSlot = "post_workout" | "breakfast" | "lunch" | "dinner";

export interface PlanMealRow {
  id: string;
  slot: string;
  title: string;
  note: string | null;
  meal_plan_meal_ingredients: PlanIngredientRow[];
}
export interface PlanDayRow {
  id: string;
  weekday: number;
  is_strict_veg: boolean;
  meal_plan_meals: PlanMealRow[];
}
export interface PlanRow {
  id: string;
  name: string;
  updated_at: string;
  meal_plan_days: PlanDayRow[];
}

export interface MealPlansRepository {
  getActive(): Promise<PlanRow | null>;
  saveMeal(
    weekday: number,
    slot: MealSlot,
    meal: { title: string; note: string | null; ingredients: IngredientLine[] },
  ): Promise<string>;
  /** Removes the meal from a slot; false if there was none. */
  deleteMeal(weekday: number, slot: MealSlot): Promise<boolean>;
  copyMeal(fromWeekday: number, slot: MealSlot, toWeekdays: number[]): Promise<number>;
  setStrictVeg(weekday: number, isStrictVeg: boolean): Promise<boolean>;
  /** Replaces the active plan from a v1 JSON payload (atomic). */
  replace(payload: Json): Promise<string>;
  resetToDefault(): Promise<string>;
}

const SELECT =
  "id, name, updated_at, meal_plan_days(id, weekday, is_strict_veg, meal_plan_meals(id, slot, title, note, meal_plan_meal_ingredients(*)))";

export class SupabaseMealPlansRepository implements MealPlansRepository {
  constructor(
    private readonly db: Db,
    private readonly userId: string,
  ) {}

  async getActive() {
    const res = await this.db
      .from("meal_plans")
      .select(SELECT)
      .eq("user_id", this.userId)
      .eq("is_active", true)
      .maybeSingle();
    if (res.error) throw mapDbError(res.error);
    return res.data as PlanRow | null;
  }

  async saveMeal(
    weekday: number,
    slot: MealSlot,
    meal: { title: string; note: string | null; ingredients: IngredientLine[] },
  ) {
    return unwrap(await this.db.rpc("save_my_plan_meal", { p_weekday: weekday, p_slot: slot, p_meal: meal as never }));
  }

  private async activeDayId(weekday: number) {
    const res = await this.db
      .from("meal_plan_days")
      .select("id, meal_plans!inner(is_active)")
      .eq("user_id", this.userId)
      .eq("weekday", weekday)
      .eq("meal_plans.is_active", true)
      .maybeSingle();
    if (res.error) throw mapDbError(res.error);
    return res.data?.id ?? null;
  }

  async deleteMeal(weekday: number, slot: MealSlot) {
    const dayId = await this.activeDayId(weekday);
    if (!dayId) return false;
    const res = await this.db
      .from("meal_plan_meals")
      .delete()
      .eq("user_id", this.userId)
      .eq("day_id", dayId)
      .eq("slot", slot)
      .select("id");
    if (res.error) throw mapDbError(res.error);
    return (res.data?.length ?? 0) > 0;
  }

  async copyMeal(fromWeekday: number, slot: MealSlot, toWeekdays: number[]) {
    return unwrap(
      await this.db.rpc("copy_my_plan_meal", { p_from_weekday: fromWeekday, p_slot: slot, p_to_weekdays: toWeekdays }),
    );
  }

  async setStrictVeg(weekday: number, isStrictVeg: boolean) {
    const dayId = await this.activeDayId(weekday);
    if (!dayId) return false;
    const res = await this.db
      .from("meal_plan_days")
      .update({ is_strict_veg: isStrictVeg })
      .eq("id", dayId)
      .eq("user_id", this.userId)
      .select("id");
    if (res.error) throw mapDbError(res.error);
    return (res.data?.length ?? 0) > 0;
  }

  async replace(payload: Json) {
    return unwrap(await this.db.rpc("replace_my_meal_plan", { p_payload: payload }));
  }

  async resetToDefault() {
    return unwrap(await this.db.rpc("reset_my_meal_plan"));
  }
}
