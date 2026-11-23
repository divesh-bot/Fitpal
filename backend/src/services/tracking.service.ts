import type {
  CheckinRow,
  CheckinsRepository,
  HabitLogRow,
  HabitRow,
  HabitsRepository,
} from "../repositories/tracking.repository.js";
import { AppError } from "../utils/AppError.js";
import type { CheckinInput } from "../validators/tracking.validators.js";
import { addDays, weightTrend } from "./progressMath.js";

// ---------- check-ins ----------

export interface CheckinDto {
  date: string;
  weightKg: number | null;
  waistCm: number | null;
  steps: number | null;
  sleepHours: number | null;
  sleepQuality: "poor" | "fair" | "good" | "great" | null;
  hunger: number | null;
  energy: number | null;
  notes: string | null;
  updatedAt: string;
}

export const toCheckinDto = (r: CheckinRow): CheckinDto => ({
  date: r.checkin_date,
  weightKg: r.weight_kg,
  waistCm: r.waist_cm,
  steps: r.steps,
  sleepHours: r.sleep_hours,
  sleepQuality: r.sleep_quality as CheckinDto["sleepQuality"],
  hunger: r.hunger,
  energy: r.energy,
  notes: r.notes,
  updatedAt: r.updated_at,
});

export async function listCheckins(repo: CheckinsRepository, from: string, to: string) {
  return (await repo.list(from, to)).map(toCheckinDto);
}

export async function getCheckin(repo: CheckinsRepository, date: string) {
  const row = await repo.get(date);
  return row ? toCheckinDto(row) : null;
}

/** Saves the fields provided for a date (others are left unchanged). One check-in per date. */
export async function saveCheckin(repo: CheckinsRepository, date: string, input: CheckinInput) {
  const row = await repo.upsert(date, {
    weight_kg: input.weightKg,
    waist_cm: input.waistCm,
    steps: input.steps,
    sleep_hours: input.sleepHours,
    sleep_quality: input.sleepQuality,
    hunger: input.hunger,
    energy: input.energy,
    notes: input.notes,
  });
  return toCheckinDto(row);
}

export async function deleteCheckin(repo: CheckinsRepository, date: string) {
  if (!(await repo.delete(date))) throw AppError.notFound("No check-in for that date.");
}

export async function weightProgress(repo: CheckinsRepository, from: string, to: string) {
  // Load two extra weeks so early averages and the week-over-week change are complete.
  const rows = await repo.list(addDays(from, -13), to);
  const weighIns = rows
    .filter((r) => r.weight_kg !== null)
    .map((r) => ({ date: r.checkin_date, weightKg: r.weight_kg! }));
  const trend = weightTrend(weighIns, from, to);
  const waist = rows
    .filter((r) => r.waist_cm !== null && r.checkin_date >= from)
    .map((r) => ({ date: r.checkin_date, waistCm: r.waist_cm! }));
  return { from, to, ...trend, waist };
}

// ---------- habits ----------

/** Habits created at sign-up that other features rely on. They can be hidden but not deleted. */
export const SYSTEM_HABITS = new Set(["creatine", "workout"]);

export interface HabitDto {
  id: string;
  key: string;
  name: string;
  description: string | null;
  position: number;
  isActive: boolean;
  isSystem: boolean;
}

export const toHabitDto = (h: HabitRow): HabitDto => ({
  id: h.id,
  key: h.key,
  name: h.name,
  description: h.description,
  position: h.position,
  isActive: h.is_active,
  isSystem: SYSTEM_HABITS.has(h.key),
});

export async function listHabits(repo: HabitsRepository, includeInactive: boolean) {
  return (await repo.list(includeInactive)).map(toHabitDto);
}

const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30) || "habit";

export async function createHabit(
  repo: HabitsRepository,
  input: { name: string; description?: string | null | undefined },
) {
  const existing = await repo.list(true);
  if (existing.length >= 30) throw AppError.badRequest("You can have at most 30 habits.");
  const keys = new Set(existing.map((h) => h.key));
  const base = slugify(input.name);
  let key = base;
  for (let i = 2; keys.has(key); i++) key = `${base}_${i}`;
  const position = Math.min(100, Math.max(0, ...existing.map((h) => h.position)) + 1);
  return toHabitDto(await repo.create({ key, name: input.name, description: input.description ?? null, position }));
}

export async function updateHabit(
  repo: HabitsRepository,
  id: string,
  input: {
    name?: string | undefined;
    description?: string | null | undefined;
    position?: number | undefined;
    isActive?: boolean | undefined;
  },
) {
  const row = await repo.update(id, {
    name: input.name,
    description: input.description,
    position: input.position,
    is_active: input.isActive,
  });
  if (!row) throw AppError.notFound("Habit not found.");
  return toHabitDto(row);
}

export async function deleteHabit(repo: HabitsRepository, id: string) {
  const habit = await repo.get(id);
  if (!habit) throw AppError.notFound("Habit not found.");
  if (SYSTEM_HABITS.has(habit.key)) {
    throw AppError.forbidden(
      `"${habit.name}" is a built-in habit. You can hide it (isActive: false) but not delete it.`,
    );
  }
  await repo.delete(id);
}

export interface HabitLogDto {
  habitId: string;
  date: string;
  completed: boolean;
}
export const toHabitLogDto = (l: HabitLogRow): HabitLogDto => ({
  habitId: l.habit_id,
  date: l.log_date,
  completed: l.completed,
});

export async function habitLogs(repo: HabitsRepository, from: string, to: string) {
  return (await repo.logs(from, to)).map(toHabitLogDto);
}

export async function setHabitLog(repo: HabitsRepository, habitId: string, date: string, completed: boolean) {
  if (!(await repo.get(habitId))) throw AppError.notFound("Habit not found.");
  await repo.setLog(habitId, date, completed);
  return { habitId, date, completed };
}

/** Sets a system habit (e.g. creatine) by key; silently skipped if the user deleted/never had it. */
export async function setHabitByKey(repo: HabitsRepository, key: string, date: string, completed: boolean) {
  const habit = await repo.getByKey(key);
  if (habit) await repo.setLog(habit.id, date, completed);
}
