import type { Db } from "../config/supabase.js";
import type { Database } from "../types/database.types.js";
import { mapDbError, unwrap } from "../utils/dbErrors.js";
import { escapeLike } from "./foods.repository.js";

type Tables = Database["public"]["Tables"];
export type WorkoutSetRow = Tables["workout_sets"]["Row"];
export interface WorkoutExerciseRow {
  id: string;
  position: number;
  name: string;
  notes: string | null;
  workout_sets: WorkoutSetRow[];
}
export interface WorkoutRow {
  id: string;
  session_date: string;
  split: string;
  duration_min: number | null;
  notes: string | null;
  updated_at: string;
  workout_exercises: WorkoutExerciseRow[];
}
export interface ExerciseHistoryRow {
  id: string;
  name: string;
  workout_sessions: { id: string; session_date: string; split: string };
  workout_sets: WorkoutSetRow[];
}

/** Payload for save_my_workout (snake_case, as stored). */
export interface WorkoutSave {
  session_date: string;
  split: string;
  duration_min: number | null;
  notes: string | null;
  exercises: {
    name: string;
    notes: string | null;
    sets: { reps: number; weight_kg: number | null; rpe: number | null; is_warmup: boolean }[];
  }[];
}

export interface WorkoutsRepository {
  list(params: { from?: string | undefined; to?: string | undefined; limit: number }): Promise<WorkoutRow[]>;
  get(id: string): Promise<WorkoutRow | null>;
  save(id: string | null, workout: WorkoutSave): Promise<string>;
  delete(id: string): Promise<boolean>;
  exerciseHistory(name: string): Promise<ExerciseHistoryRow[]>;
  exerciseNames(): Promise<string[]>;
}

const SELECT =
  "id, session_date, split, duration_min, notes, updated_at, workout_exercises(id, position, name, notes, workout_sets(*))";

export class SupabaseWorkoutsRepository implements WorkoutsRepository {
  constructor(
    private readonly db: Db,
    private readonly userId: string,
  ) {}

  async list({ from, to, limit }: { from?: string | undefined; to?: string | undefined; limit: number }) {
    let q = this.db.from("workout_sessions").select(SELECT).eq("user_id", this.userId);
    if (from) q = q.gte("session_date", from);
    if (to) q = q.lte("session_date", to);
    const rows = unwrap(
      await q.order("session_date", { ascending: false }).order("created_at", { ascending: false }).limit(limit),
    );
    return rows as WorkoutRow[];
  }

  async get(id: string) {
    const res = await this.db
      .from("workout_sessions")
      .select(SELECT)
      .eq("user_id", this.userId)
      .eq("id", id)
      .maybeSingle();
    if (res.error) throw mapDbError(res.error);
    return res.data as WorkoutRow | null;
  }

  async save(id: string | null, workout: WorkoutSave) {
    return unwrap(await this.db.rpc("save_my_workout", { p_session_id: id, p_workout: workout as never }));
  }

  async delete(id: string) {
    const res = await this.db.from("workout_sessions").delete().eq("id", id).eq("user_id", this.userId).select("id");
    if (res.error) throw mapDbError(res.error);
    return (res.data?.length ?? 0) > 0;
  }

  async exerciseHistory(name: string) {
    const rows = unwrap(
      await this.db
        .from("workout_exercises")
        .select("id, name, workout_sessions!inner(id, session_date, split), workout_sets(*)")
        .eq("user_id", this.userId)
        .ilike("name", escapeLike(name)) // case-insensitive exact match
        .limit(500),
    );
    return rows as unknown as ExerciseHistoryRow[];
  }

  async exerciseNames() {
    const rows = unwrap(await this.db.from("workout_exercises").select("name").eq("user_id", this.userId).limit(5000));
    return rows.map((r) => r.name);
  }
}
