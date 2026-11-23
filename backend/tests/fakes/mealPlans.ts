import type { Json } from "../../src/types/database.types.js";
import type { IngredientLine } from "../../src/services/ingredients.service.js";
import type {
  MealPlansRepository,
  MealSlot,
  PlanIngredientRow,
  PlanRow,
} from "../../src/repositories/mealPlans.repository.js";
import { AppError } from "../../src/utils/AppError.js";
import type { FakeStore } from "./accountRepository.js";

interface V1Ingredient {
  name: string;
  qtyLabel?: string | null;
  quantity?: number | null;
  unit?: string | null;
  kcal: number;
  proteinG: number;
  carbsG?: number | null;
  fatG?: number | null;
  dietType?: string;
}
interface V1 {
  name?: string;
  days: {
    weekday: number;
    isStrictVeg?: boolean;
    meals: { slot: string; title: string; note?: string | null; ingredients: V1Ingredient[] }[];
  }[];
}

const veg = () => new AppError(422, "STRICT_VEG_VIOLATION", "strictly vegetarian day");

/** Mirrors the meal-plan SQL functions, including the strict-veg trigger. */
export class FakeMealPlansRepository implements MealPlansRepository {
  constructor(
    private s: FakeStore,
    private userId: string,
  ) {}

  private plan() {
    return this.s.plans.get(this.userId) ?? null;
  }

  private line(mealId: string, l: IngredientLine, position: number): PlanIngredientRow {
    const now = new Date().toISOString();
    return {
      ...l,
      id: crypto.randomUUID(),
      meal_id: mealId,
      user_id: this.userId,
      position,
      created_at: now,
      updated_at: now,
    };
  }

  async getActive() {
    const p = this.plan();
    return p ? structuredClone(p) : null;
  }

  async saveMeal(
    weekday: number,
    slot: MealSlot,
    meal: { title: string; note: string | null; ingredients: IngredientLine[] },
  ) {
    const day = this.plan()?.meal_plan_days.find((d) => d.weekday === weekday);
    if (!day) throw AppError.notFound("No active meal plan");
    if (day.is_strict_veg && meal.ingredients.some((i) => i.diet_type !== "veg")) throw veg();
    let m = day.meal_plan_meals.find((x) => x.slot === slot);
    if (!m) {
      m = { id: crypto.randomUUID(), slot, title: meal.title, note: meal.note, meal_plan_meal_ingredients: [] };
      day.meal_plan_meals.push(m);
    }
    const mealId = m.id;
    Object.assign(m, {
      title: meal.title,
      note: meal.note,
      meal_plan_meal_ingredients: meal.ingredients.map((l, i) => this.line(mealId, l, i)),
    });
    return mealId;
  }

  async deleteMeal(weekday: number, slot: MealSlot) {
    const day = this.plan()?.meal_plan_days.find((d) => d.weekday === weekday);
    const i = day?.meal_plan_meals.findIndex((m) => m.slot === slot) ?? -1;
    if (!day || i < 0) return false;
    day.meal_plan_meals.splice(i, 1);
    return true;
  }

  async copyMeal(fromWeekday: number, slot: MealSlot, toWeekdays: number[]) {
    const p = this.plan();
    const src = p?.meal_plan_days.find((d) => d.weekday === fromWeekday)?.meal_plan_meals.find((m) => m.slot === slot);
    if (!p || !src) throw AppError.notFound("Source meal not found");
    const snapshot = structuredClone(p);
    try {
      let n = 0;
      for (const t of toWeekdays.filter((w) => w !== fromWeekday)) {
        await this.saveMeal(t, slot, {
          title: src.title,
          note: src.note,
          ingredients: src.meal_plan_meal_ingredients.map((i) => ({
            food_item_id: i.food_item_id,
            name: i.name,
            quantity: i.quantity,
            unit: i.unit,
            qty_label: i.qty_label,
            kcal: i.kcal,
            protein_g: i.protein_g,
            carbs_g: i.carbs_g,
            fat_g: i.fat_g,
            diet_type: i.diet_type as IngredientLine["diet_type"],
          })),
        });
        n++;
      }
      return n;
    } catch (e) {
      this.s.plans.set(this.userId, snapshot); // all-or-nothing, like the SQL function
      throw e;
    }
  }

  async setStrictVeg(weekday: number, isStrictVeg: boolean) {
    const day = this.plan()?.meal_plan_days.find((d) => d.weekday === weekday);
    if (!day) return false;
    if (isStrictVeg && day.meal_plan_meals.some((m) => m.meal_plan_meal_ingredients.some((i) => i.diet_type !== "veg")))
      throw veg();
    day.is_strict_veg = isStrictVeg;
    return true;
  }

  async replace(payload: Json) {
    const p = payload as unknown as V1;
    const planId = crypto.randomUUID();
    const plan: PlanRow = {
      id: planId,
      name: p.name ?? "My meal plan",
      updated_at: new Date().toISOString(),
      meal_plan_days: [1, 2, 3, 4, 5, 6, 7].map((weekday) => {
        const d = p.days.find((x) => x.weekday === weekday);
        return {
          id: crypto.randomUUID(),
          weekday,
          is_strict_veg: d?.isStrictVeg ?? false,
          meal_plan_meals: (d?.meals ?? []).map((m) => {
            if (d?.isStrictVeg && m.ingredients.some((i) => (i.dietType ?? "veg") !== "veg")) throw veg();
            const id = crypto.randomUUID();
            return {
              id,
              slot: m.slot,
              title: m.title,
              note: m.note ?? null,
              meal_plan_meal_ingredients: m.ingredients.map((i, pos) =>
                this.line(
                  id,
                  {
                    food_item_id: null,
                    name: i.name,
                    quantity: i.quantity ?? null,
                    unit: i.unit ?? null,
                    qty_label: i.qtyLabel ?? null,
                    kcal: i.kcal,
                    protein_g: i.proteinG,
                    carbs_g: i.carbsG ?? null,
                    fat_g: i.fatG ?? null,
                    diet_type: (i.dietType ?? "veg") as IngredientLine["diet_type"],
                  },
                  pos,
                ),
              ),
            };
          }),
        };
      }),
    };
    this.s.plans.set(this.userId, plan);
    return planId;
  }

  async resetToDefault() {
    return this.replace(this.s.defaultPlan as Json);
  }
}
