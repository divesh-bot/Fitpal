/**
 * BMR / TDEE / target maths — the same formulas as the HTML prototype.
 *
 * BMR: Mifflin–St Jeor = 10·kg + 6.25·cm − 5·age + (male ? 5 : −161)
 * TDEE = BMR × activity multiplier
 * Recommended kcal = TDEE + offset, rounded to the nearest 10, never below 1,200
 * Weekly pace ≈ offset × 7 / 7,700 kcal per kg of body weight
 */

export interface EnergyInput {
  sex: "male" | "female";
  ageYears: number;
  weightKg: number;
  heightCm: number;
  activity: number;
  offsetKcal: number;
}

export const ACTIVITY_LEVELS = [
  { value: 1.2, label: "Sedentary (Desk job, little exercise) — 1.2×" },
  { value: 1.34, label: "Desk Job + 4–5x Morning Gym (~40m PPL) — 1.34× (Plan Default)" },
  { value: 1.375, label: "Lightly Active (Light exercise 1–3 days/wk) — 1.375×" },
  { value: 1.55, label: "Moderately Active (Moderate exercise 3–5 days/wk) — 1.55×" },
  { value: 1.725, label: "Very Active (Hard exercise 6–7 days/wk) — 1.725×" },
] as const;

export const GOAL_PRESETS = [
  { offset: -500, label: "Fat Loss (-500)" },
  { offset: -350, label: "Steady Cut (-350)" },
  { offset: -250, label: "Recomp (-250)" },
  { offset: 0, label: "Maintain (0)" },
  { offset: 250, label: "Lean Bulk (+250)" },
] as const;

export const KCAL_PER_KG = 7700;
export const MIN_KCAL = 1200;

export function bmr({
  sex,
  ageYears,
  weightKg,
  heightCm,
}: Pick<EnergyInput, "sex" | "ageYears" | "weightKg" | "heightCm">): number {
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * ageYears + (sex === "male" ? 5 : -161));
}

export function energyTargets(input: EnergyInput) {
  const b = bmr(input);
  const tdee = Math.round(b * input.activity);
  const recommendedKcal = Math.max(MIN_KCAL, Math.round((tdee + input.offsetKcal) / 10) * 10);
  const weeklyKg = (input.offsetKcal * 7) / KCAL_PER_KG;
  return { bmr: b, tdee, recommendedKcal, weeklyKg };
}

/** Protein grams from g/kg (rounded), and the reverse. */
export const proteinFromPerKg = (weightKg: number, perKg: number) => Math.round(weightKg * perKg);
export const perKgFromProtein = (weightKg: number, grams: number) => (weightKg > 0 ? grams / weightKg : 0);

/** Approximate age from birth year (accurate to ±1 year — enough for BMR). */
export const ageFromBirthYear = (birthYear: number, now = new Date()) => now.getFullYear() - birthYear;
export const birthYearFromAge = (age: number, now = new Date()) => now.getFullYear() - age;
