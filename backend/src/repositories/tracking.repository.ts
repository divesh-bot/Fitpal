import type { Db } from "../config/supabase.js";
import type { Database } from "../types/database.types.js";
import { mapDbError, unwrap } from "../utils/dbErrors.js";

type Tables = Database["public"]["Tables"];
export type CheckinRow = Tables["daily_checkins"]["Row"];
export type CheckinPatch = Omit<
  Tables["daily_checkins"]["Update"],
  "id" | "user_id" | "checkin_date" | "created_at" | "updated_at"
>;
export type HabitRow = Tables["habits"]["Row"];
export type HabitLogRow = Tables["habit_logs"]["Row"];

/** Daily check-ins (weight, waist, steps, sleep, hunger, energy, notes). */
export interface CheckinsRepository {
  list(from: string, to: string): Promise<CheckinRow[]>;
  get(date: string): Promise<CheckinRow | null>;
  /** Insert or update the date's check-in; only provided fields change. */
  upsert(date: string, patch: CheckinPatch): Promise<CheckinRow>;
  delete(date: string): Promise<boolean>;
}

export interface HabitsRepository {
  list(includeInactive: boolean): Promise<HabitRow[]>;
  get(id: string): Promise<HabitRow | null>;
  getByKey(key: string): Promise<HabitRow | null>;
  create(values: { key: string; name: string; description: string | null; position: number }): Promise<HabitRow>;
  update(
    id: string,
    values: Partial<Pick<HabitRow, "name" | "description" | "position" | "is_active">>,
  ): Promise<HabitRow | null>;
  delete(id: string): Promise<boolean>;
  logs(from: string, to: string): Promise<HabitLogRow[]>;
  /** Marks a habit done (completed=true) or not done (row removed) for a date. */
  setLog(habitId: string, date: string, completed: boolean): Promise<void>;
}

export class SupabaseCheckinsRepository implements CheckinsRepository {
  constructor(
    private readonly db: Db,
    private readonly userId: string,
  ) {}

  async list(from: string, to: string) {
    return unwrap(
      await this.db
        .from("daily_checkins")
        .select("*")
        .eq("user_id", this.userId)
        .gte("checkin_date", from)
        .lte("checkin_date", to)
        .order("checkin_date", { ascending: true })
        .limit(1000),
    );
  }

  async get(date: string) {
    const res = await this.db
      .from("daily_checkins")
      .select("*")
      .eq("user_id", this.userId)
      .eq("checkin_date", date)
      .maybeSingle();
    if (res.error) throw mapDbError(res.error);
    return res.data;
  }

  async upsert(date: string, patch: CheckinPatch) {
    return unwrap(
      await this.db
        .from("daily_checkins")
        .upsert({ ...patch, user_id: this.userId, checkin_date: date }, { onConflict: "user_id,checkin_date" })
        .select("*")
        .single(),
    );
  }

  async delete(date: string) {
    const res = await this.db
      .from("daily_checkins")
      .delete()
      .eq("user_id", this.userId)
      .eq("checkin_date", date)
      .select("id");
    if (res.error) throw mapDbError(res.error);
    return (res.data?.length ?? 0) > 0;
  }
}

export class SupabaseHabitsRepository implements HabitsRepository {
  constructor(
    private readonly db: Db,
    private readonly userId: string,
  ) {}

  async list(includeInactive: boolean) {
    let q = this.db.from("habits").select("*").eq("user_id", this.userId);
    if (!includeInactive) q = q.eq("is_active", true);
    return unwrap(await q.order("position").order("created_at"));
  }

  private async one(column: "id" | "key", value: string) {
    const res = await this.db.from("habits").select("*").eq("user_id", this.userId).eq(column, value).maybeSingle();
    if (res.error) throw mapDbError(res.error);
    return res.data;
  }
  get(id: string) {
    return this.one("id", id);
  }
  getByKey(key: string) {
    return this.one("key", key);
  }

  async create(values: { key: string; name: string; description: string | null; position: number }) {
    return unwrap(
      await this.db
        .from("habits")
        .insert({ ...values, user_id: this.userId })
        .select("*")
        .single(),
    );
  }

  async update(id: string, values: Partial<Pick<HabitRow, "name" | "description" | "position" | "is_active">>) {
    const res = await this.db
      .from("habits")
      .update(values)
      .eq("id", id)
      .eq("user_id", this.userId)
      .select("*")
      .maybeSingle();
    if (res.error) throw mapDbError(res.error);
    return res.data;
  }

  async delete(id: string) {
    const res = await this.db.from("habits").delete().eq("id", id).eq("user_id", this.userId).select("id");
    if (res.error) throw mapDbError(res.error);
    return (res.data?.length ?? 0) > 0;
  }

  async logs(from: string, to: string) {
    return unwrap(
      await this.db
        .from("habit_logs")
        .select("*")
        .eq("user_id", this.userId)
        .gte("log_date", from)
        .lte("log_date", to)
        .order("log_date")
        .limit(5000),
    );
  }

  async setLog(habitId: string, date: string, completed: boolean) {
    if (completed) {
      const res = await this.db
        .from("habit_logs")
        .upsert(
          { habit_id: habitId, user_id: this.userId, log_date: date, completed: true },
          { onConflict: "habit_id,log_date" },
        );
      if (res.error) throw mapDbError(res.error);
    } else {
      const res = await this.db
        .from("habit_logs")
        .delete()
        .eq("user_id", this.userId)
        .eq("habit_id", habitId)
        .eq("log_date", date);
      if (res.error) throw mapDbError(res.error);
    }
  }
}
