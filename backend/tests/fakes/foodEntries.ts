import type {
  FoodEntriesRepository,
  FoodEntryInsert,
  FoodEntryPatch,
  FoodEntryRow,
  SnackSnapshot,
} from "../../src/repositories/foodEntries.repository.js";
import { AppError } from "../../src/utils/AppError.js";
import type { FakeStore } from "./accountRepository.js";

const defined = <T extends object>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

/** Mirrors food_entries + its unique indexes, set_my_snack and reset_my_day. */
export class FakeFoodEntriesRepository implements FoodEntriesRepository {
  constructor(
    private s: FakeStore,
    private userId: string,
  ) {}
  private own() {
    return this.s.foodEntries.filter((e) => e.user_id === this.userId);
  }
  async list(from: string, to: string) {
    return this.own().filter((e) => e.entry_date >= from && e.entry_date <= to);
  }
  async get(id: string) {
    return this.own().find((e) => e.id === id) ?? null;
  }
  async findByClientRequestId(id: string) {
    return this.own().find((e) => e.client_request_id === id) ?? null;
  }
  async findPlanMeal(date: string, slot: string) {
    return this.own().find((e) => e.entry_date === date && e.meal_slot === slot && e.source === "plan_meal") ?? null;
  }
  async insert(row: FoodEntryInsert) {
    const mine = this.own();
    const dup =
      (row.client_request_id && mine.some((e) => e.client_request_id === row.client_request_id)) ||
      (row.source === "plan_meal" &&
        mine.some((e) => e.source === "plan_meal" && e.entry_date === row.entry_date && e.meal_slot === row.meal_slot));
    if (dup) throw AppError.conflict("This record already exists.");
    const now = new Date().toISOString();
    const full: FoodEntryRow = {
      id: crypto.randomUUID(),
      user_id: this.userId,
      meal_slot: "other",
      food_item_id: null,
      recipe_id: null,
      plan_meal_id: null,
      snack_kind: null,
      quantity: null,
      unit: null,
      qty_label: null,
      carbs_g: null,
      fat_g: null,
      client_request_id: null,
      created_at: now,
      updated_at: now,
      ...(defined(row) as FoodEntryInsert),
    } as FoodEntryRow;
    this.s.foodEntries.push(full);
    return { ...full };
  }
  async update(id: string, patch: FoodEntryPatch) {
    const row = this.own().find((e) => e.id === id);
    if (!row) return null;
    Object.assign(row, defined(patch), { updated_at: new Date().toISOString() });
    return { ...row };
  }
  async delete(id: string) {
    const before = this.s.foodEntries.length;
    this.s.foodEntries = this.s.foodEntries.filter((e) => !(e.id === id && e.user_id === this.userId));
    return this.s.foodEntries.length < before;
  }
  async deletePlanMeal(date: string, slot: string) {
    const before = this.s.foodEntries.length;
    this.s.foodEntries = this.s.foodEntries.filter(
      (e) => !(e.user_id === this.userId && e.entry_date === date && e.meal_slot === slot && e.source === "plan_meal"),
    );
    return this.s.foodEntries.length < before;
  }
  async setSnack(date: string, kind: "sweet" | "salty", snap: SnackSnapshot | null) {
    this.s.foodEntries = this.s.foodEntries.filter(
      (e) => !(e.user_id === this.userId && e.entry_date === date && e.snack_kind === kind),
    );
    if (snap) {
      await this.insert({ entry_date: date, meal_slot: "snack", source: "snack", snack_kind: kind, ...snap });
    }
  }
  async resetDay(date: string) {
    this.s.foodEntries = this.s.foodEntries.filter(
      (e) =>
        !(e.user_id === this.userId && e.entry_date === date && (e.source === "plan_meal" || e.source === "snack")),
    );
    this.s.habitLogs = this.s.habitLogs.filter((l) => !(l.user_id === this.userId && l.log_date === date));
    for (const c of this.s.checkins) if (c.user_id === this.userId && c.checkin_date === date) c.steps = null;
  }
}
