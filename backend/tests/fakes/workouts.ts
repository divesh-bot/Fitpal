import type { WorkoutRow, WorkoutSave, WorkoutsRepository } from "../../src/repositories/workouts.repository.js";
import { AppError } from "../../src/utils/AppError.js";
import type { FakeStore } from "./accountRepository.js";

/** Mirrors save_my_workout (atomic replace) and the session/exercise/set tables. */
export class FakeWorkoutsRepository implements WorkoutsRepository {
  constructor(
    private s: FakeStore,
    private userId: string,
  ) {}
  private own() {
    return this.s.workouts.filter((w) => w.user_id === this.userId);
  }
  async list({ from, to, limit }: { from?: string | undefined; to?: string | undefined; limit: number }) {
    return structuredClone(
      this.own()
        .filter((w) => (!from || w.session_date >= from) && (!to || w.session_date <= to))
        .sort((a, b) => b.session_date.localeCompare(a.session_date))
        .slice(0, limit),
    );
  }
  async get(id: string) {
    const w = this.own().find((x) => x.id === id);
    return w ? structuredClone(w) : null;
  }
  async save(id: string | null, p: WorkoutSave) {
    if (p.exercises.some((e) => e.sets.some((s) => s.reps < 0))) throw AppError.validation([]);
    let row = id ? this.own().find((w) => w.id === id) : undefined;
    if (id && !row) throw AppError.notFound("Workout not found");
    const now = new Date().toISOString();
    const userId = this.userId;
    const built: WorkoutRow & { user_id: string } = {
      id: row?.id ?? crypto.randomUUID(),
      user_id: userId,
      session_date: p.session_date,
      split: p.split,
      duration_min: p.duration_min,
      notes: p.notes,
      updated_at: now,
      workout_exercises: p.exercises.map((e, position) => {
        const exId = crypto.randomUUID();
        return {
          id: exId,
          position,
          name: e.name,
          notes: e.notes,
          workout_sets: e.sets.map((s, i) => ({
            id: crypto.randomUUID(),
            exercise_id: exId,
            user_id: userId,
            set_number: i + 1,
            reps: s.reps,
            weight_kg: s.weight_kg,
            rpe: s.rpe,
            is_warmup: s.is_warmup,
            created_at: now,
            updated_at: now,
          })),
        };
      }),
    };
    if (row) Object.assign(row, built);
    else this.s.workouts.push((row = built));
    return row.id;
  }
  async delete(id: string) {
    const before = this.s.workouts.length;
    this.s.workouts = this.s.workouts.filter((w) => !(w.id === id && w.user_id === this.userId));
    return this.s.workouts.length < before;
  }
  async exerciseHistory(name: string) {
    return this.own().flatMap((w) =>
      w.workout_exercises
        .filter((e) => e.name.toLowerCase() === name.toLowerCase())
        .map((e) => ({
          id: e.id,
          name: e.name,
          workout_sessions: { id: w.id, session_date: w.session_date, split: w.split },
          workout_sets: e.workout_sets,
        })),
    );
  }
  async exerciseNames() {
    return this.own().flatMap((w) => w.workout_exercises.map((e) => e.name));
  }
}
