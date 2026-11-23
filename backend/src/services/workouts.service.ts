import type { WorkoutRow, WorkoutsRepository } from "../repositories/workouts.repository.js";
import { AppError } from "../utils/AppError.js";
import type { WorkoutSaveInput } from "../validators/workouts.validators.js";
import { exerciseStats } from "./workoutMath.js";

export interface WorkoutDto {
  id: string;
  date: string;
  split: "push" | "pull" | "legs" | "rest" | "other";
  durationMin: number | null;
  notes: string | null;
  updatedAt: string;
  exercises: {
    id: string;
    name: string;
    notes: string | null;
    sets: { setNumber: number; reps: number; weightKg: number | null; rpe: number | null; isWarmup: boolean }[];
    stats: ReturnType<typeof exerciseStats>;
  }[];
  totals: { workingSets: number; volumeKg: number };
}

export function toWorkoutDto(w: WorkoutRow): WorkoutDto {
  const exercises = [...w.workout_exercises]
    .sort((a, b) => a.position - b.position)
    .map((e) => {
      const sets = [...e.workout_sets]
        .sort((a, b) => a.set_number - b.set_number)
        .map((s) => ({
          setNumber: s.set_number,
          reps: s.reps,
          weightKg: s.weight_kg,
          rpe: s.rpe,
          isWarmup: s.is_warmup,
        }));
      return { id: e.id, name: e.name, notes: e.notes, sets, stats: exerciseStats(sets) };
    });
  return {
    id: w.id,
    date: w.session_date,
    split: w.split as WorkoutDto["split"],
    durationMin: w.duration_min,
    notes: w.notes,
    updatedAt: w.updated_at,
    exercises,
    totals: {
      workingSets: exercises.reduce((a, e) => a + e.stats.workingSets, 0),
      volumeKg: Math.round(exercises.reduce((a, e) => a + e.stats.volumeKg, 0) * 10) / 10,
    },
  };
}

export async function listWorkouts(
  repo: WorkoutsRepository,
  params: { from?: string | undefined; to?: string | undefined; limit: number },
) {
  return (await repo.list(params)).map(toWorkoutDto);
}

export async function getWorkout(repo: WorkoutsRepository, id: string) {
  const row = await repo.get(id);
  if (!row) throw AppError.notFound("Workout not found.");
  return toWorkoutDto(row);
}

export async function saveWorkout(repo: WorkoutsRepository, id: string | null, input: WorkoutSaveInput) {
  if (input.split !== "rest" && input.exercises.length === 0) {
    throw AppError.validation([{ path: "exercises", message: "Add at least one exercise (or choose Rest)." }]);
  }
  const savedId = await repo.save(id, {
    session_date: input.date,
    split: input.split,
    duration_min: input.durationMin ?? null,
    notes: input.notes ?? null,
    exercises: input.exercises.map((e) => ({
      name: e.name,
      notes: e.notes ?? null,
      sets: e.sets.map((s) => ({
        reps: s.reps,
        weight_kg: s.weightKg ?? null,
        rpe: s.rpe ?? null,
        is_warmup: s.isWarmup,
      })),
    })),
  });
  return getWorkout(repo, savedId);
}

export async function deleteWorkout(repo: WorkoutsRepository, id: string) {
  if (!(await repo.delete(id))) throw AppError.notFound("Workout not found.");
}

/** Distinct exercise names (for autocomplete), most-used first. */
export async function exerciseNames(repo: WorkoutsRepository) {
  const counts = new Map<string, { name: string; n: number }>();
  for (const name of await repo.exerciseNames()) {
    const key = name.trim().toLowerCase();
    const cur = counts.get(key);
    counts.set(key, { name: cur?.name ?? name.trim(), n: (cur?.n ?? 0) + 1 });
  }
  return [...counts.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)).map((c) => c.name);
}

/** Per-session progression for one exercise (oldest first). */
export async function progression(repo: WorkoutsRepository, exercise: string) {
  const rows = await repo.exerciseHistory(exercise);
  const sessions = rows
    .map((r) => {
      const stats = exerciseStats(
        r.workout_sets.map((s) => ({ reps: s.reps, weightKg: s.weight_kg, isWarmup: s.is_warmup })),
      );
      return {
        date: r.workout_sessions.session_date,
        sessionId: r.workout_sessions.id,
        split: r.workout_sessions.split,
        ...stats,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const best = sessions.reduce<number | null>(
    (m, s) => (s.estimated1RmKg !== null && (m === null || s.estimated1RmKg > m) ? s.estimated1RmKg : m),
    null,
  );
  return { exercise: rows[0]?.name ?? exercise, sessions, bestEstimated1RmKg: best };
}
