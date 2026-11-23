import type { Db } from "../config/supabase.js";
import type { Database } from "../types/database.types.js";
import { mapDbError, unwrap } from "../utils/dbErrors.js";

type Tables = Database["public"]["Tables"];
export type FoodEntryRow = Tables["food_entries"]["Row"];
export type FoodEntryInsert = Omit<Tables["food_entries"]["Insert"], "id" | "user_id" | "created_at" | "updated_at">;
export type FoodEntryPatch = Partial<
  Pick<
    FoodEntryRow,
    "meal_slot" | "name" | "quantity" | "unit" | "qty_label" | "kcal" | "protein_g" | "carbs_g" | "fat_g"
  >
>;

export interface SnackSnapshot {
  recipe_id: string;
  name: string;
  qty_label: string;
  kcal: number;
  protein_g: number;
  carbs_g: number | null;
  fat_g: number | null;
}

export interface FoodEntriesRepository {
  list(from: string, to: string): Promise<FoodEntryRow[]>;
  get(id: string): Promise<FoodEntryRow | null>;
  findByClientRequestId(clientRequestId: string): Promise<FoodEntryRow | null>;
  findPlanMeal(date: string, slot: string): Promise<FoodEntryRow | null>;
  insert(row: FoodEntryInsert): Promise<FoodEntryRow>;
  update(id: string, patch: FoodEntryPatch): Promise<FoodEntryRow | null>;
  delete(id: string): Promise<boolean>;
  deletePlanMeal(date: string, slot: string): Promise<boolean>;
  /** Replaces (or clears, with null) the day's sweet/salty snack atomically. */
  setSnack(date: string, kind: "sweet" | "salty", snapshot: SnackSnapshot | null): Promise<void>;
  /** Clears ticked plan meals, snacks, habit ticks and steps for the date. */
  resetDay(date: string): Promise<void>;
}

export class SupabaseFoodEntriesRepository implements FoodEntriesRepository {
  constructor(
    private readonly db: Db,
    private readonly userId: string,
  ) {}

  private base() {
    return this.db.from("food_entries").select("*").eq("user_id", this.userId);
  }

  async list(from: string, to: string) {
    return unwrap(
      await this.base()
        .gte("entry_date", from)
        .lte("entry_date", to)
        .order("entry_date")
        .order("created_at")
        .limit(2000),
    );
  }

  private async one(q: ReturnType<SupabaseFoodEntriesRepository["base"]>) {
    const res = await q.maybeSingle();
    if (res.error) throw mapDbError(res.error);
    return res.data;
  }

  get(id: string) {
    return this.one(this.base().eq("id", id));
  }
  findByClientRequestId(clientRequestId: string) {
    return this.one(this.base().eq("client_request_id", clientRequestId));
  }
  findPlanMeal(date: string, slot: string) {
    return this.one(this.base().eq("entry_date", date).eq("meal_slot", slot).eq("source", "plan_meal"));
  }

  async insert(row: FoodEntryInsert) {
    return unwrap(
      await this.db
        .from("food_entries")
        .insert({ ...row, user_id: this.userId })
        .select("*")
        .single(),
    );
  }

  async update(id: string, patch: FoodEntryPatch) {
    const res = await this.db
      .from("food_entries")
      .update(patch)
      .eq("id", id)
      .eq("user_id", this.userId)
      .select("*")
      .maybeSingle();
    if (res.error) throw mapDbError(res.error);
    return res.data;
  }

  async delete(id: string) {
    const res = await this.db.from("food_entries").delete().eq("id", id).eq("user_id", this.userId).select("id");
    if (res.error) throw mapDbError(res.error);
    return (res.data?.length ?? 0) > 0;
  }

  async deletePlanMeal(date: string, slot: string) {
    const res = await this.db
      .from("food_entries")
      .delete()
      .eq("user_id", this.userId)
      .eq("entry_date", date)
      .eq("meal_slot", slot)
      .eq("source", "plan_meal")
      .select("id");
    if (res.error) throw mapDbError(res.error);
    return (res.data?.length ?? 0) > 0;
  }

  async setSnack(date: string, kind: "sweet" | "salty", snapshot: SnackSnapshot | null) {
    const res = await this.db.rpc("set_my_snack", { p_date: date, p_kind: kind, p_entry: snapshot as never });
    if (res.error) throw mapDbError(res.error);
  }

  async resetDay(date: string) {
    const res = await this.db.rpc("reset_my_day", { p_date: date });
    if (res.error) throw mapDbError(res.error);
  }
}
