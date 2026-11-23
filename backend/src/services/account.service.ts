import type { AccountRepository, PreferencesRow, ProfileRow, TargetsRow } from "../repositories/account.repository.js";
import type { PreferencesUpdate, ProfileUpdate, TargetsInput } from "../validators/account.validators.js";
import { AppError } from "../utils/AppError.js";

// ---------- API shapes (camelCase, what the frontend receives) ----------

export interface ProfileDto {
  displayName: string | null;
  email: string | null;
  sex: "male" | "female" | null;
  birthYear: number | null;
  heightCm: number | null;
  startingWeightKg: number | null;
  activityMultiplier: number;
  activityDescription: string | null;
  goal: "fat_loss" | "maintenance" | "muscle_gain";
  trainingNotes: string | null;
  timezone: string;
  updatedAt: string;
}

export interface TargetsDto {
  id: string;
  effectiveFrom: string;
  caloriesKcal: number;
  proteinG: number;
  steps: number;
  creatineG: number;
  bmrKcal: number | null;
  tdeeKcal: number | null;
  note: string | null;
}

export interface PreferencesDto {
  wholeEggsOnly: boolean;
  excludedFoods: string[];
  foodPreferences: string | null;
  uiSettings: Record<string, unknown>;
}

// ---------- mappers ----------

export const toProfileDto = (r: ProfileRow, email?: string): ProfileDto => ({
  displayName: r.display_name,
  email: email ?? null,
  sex: r.sex as ProfileDto["sex"],
  birthYear: r.birth_year,
  heightCm: r.height_cm,
  startingWeightKg: r.starting_weight_kg,
  activityMultiplier: r.activity_multiplier,
  activityDescription: r.activity_description,
  goal: r.goal as ProfileDto["goal"],
  trainingNotes: r.training_notes,
  timezone: r.timezone,
  updatedAt: r.updated_at,
});

export const toTargetsDto = (r: TargetsRow): TargetsDto => ({
  id: r.id,
  effectiveFrom: r.effective_from,
  caloriesKcal: r.calories_kcal,
  proteinG: r.protein_g,
  steps: r.steps,
  creatineG: r.creatine_g,
  bmrKcal: r.bmr_kcal,
  tdeeKcal: r.tdee_kcal,
  note: r.note,
});

export const toPreferencesDto = (r: PreferencesRow): PreferencesDto => ({
  wholeEggsOnly: r.whole_eggs_only,
  excludedFoods: r.excluded_foods,
  foodPreferences: r.food_preferences,
  uiSettings: (r.ui_settings ?? {}) as Record<string, unknown>,
});

// ---------- use cases ----------

export async function getProfile(repo: AccountRepository, email?: string) {
  return toProfileDto(await repo.getProfile(), email);
}

export async function updateProfile(repo: AccountRepository, input: ProfileUpdate, email?: string) {
  const row = await repo.updateProfile({
    display_name: input.displayName,
    sex: input.sex,
    birth_year: input.birthYear,
    height_cm: input.heightCm,
    starting_weight_kg: input.startingWeightKg,
    activity_multiplier: input.activityMultiplier,
    activity_description: input.activityDescription,
    goal: input.goal,
    training_notes: input.trainingNotes,
    timezone: input.timezone,
  });
  return toProfileDto(row, email);
}

/**
 * Targets in effect on a date. Targets are versioned: changing them on
 * 2026-12-01 must not alter how 2026-11-20 is evaluated.
 */
export async function getTargetsOn(repo: AccountRepository, date: string): Promise<TargetsDto> {
  const row = (await repo.getTargetsOn(date)) ?? (await repo.getEarliestTargets());
  if (!row) throw AppError.notFound("No nutrition targets have been set yet.");
  return toTargetsDto(row);
}

export async function listTargets(repo: AccountRepository) {
  return (await repo.listTargets()).map(toTargetsDto);
}

/** Sets targets from `effectiveFrom` onwards (replaces a version on the same date). */
export async function setTargets(repo: AccountRepository, effectiveFrom: string, input: TargetsInput) {
  const row = await repo.upsertTargets(effectiveFrom, {
    calories_kcal: input.caloriesKcal,
    protein_g: input.proteinG,
    steps: input.steps,
    creatine_g: input.creatineG,
    bmr_kcal: input.bmrKcal ?? null,
    tdee_kcal: input.tdeeKcal ?? null,
    note: input.note ?? null,
  });
  return toTargetsDto(row);
}

export async function getPreferences(repo: AccountRepository) {
  return toPreferencesDto(await repo.getPreferences());
}

export async function updatePreferences(repo: AccountRepository, input: PreferencesUpdate) {
  const row = await repo.updatePreferences({
    whole_eggs_only: input.wholeEggsOnly,
    excluded_foods: input.excludedFoods,
    food_preferences: input.foodPreferences,
    ui_settings: input.uiSettings,
  });
  return toPreferencesDto(row);
}
