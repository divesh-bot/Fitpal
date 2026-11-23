/**
 * Shapes of the FitPal API responses (see docs/API_DOCUMENTATION.md).
 * Kept in the frontend so the two apps stay independently buildable.
 */

export type DietType = "veg" | "egg" | "non_veg";
export type MealSlot = "post_workout" | "breakfast" | "lunch" | "dinner";
export type EntrySlot = MealSlot | "snack" | "other";
export type FoodBasis = "per_100g" | "per_100ml" | "per_unit";

export interface Macros {
  kcal: number;
  proteinG: number;
  carbsG: number | null;
  fatG: number | null;
}
export interface Totals extends Macros {
  carbsComplete: boolean;
  fatComplete: boolean;
}

export interface Profile {
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

export interface Targets {
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

export interface Preferences {
  wholeEggsOnly: boolean;
  excludedFoods: string[];
  foodPreferences: string | null;
  uiSettings: Record<string, unknown>;
}

export interface Food {
  id: string;
  name: string;
  brand: string | null;
  basis: FoodBasis;
  unitLabel: string;
  defaultAmount: number;
  per: Macros;
  dietType: DietType;
  notes: string | null;
  isShared: boolean;
  isExcluded: boolean;
}

export interface Ingredient extends Macros {
  id: string;
  position: number;
  foodItemId: string | null;
  name: string;
  quantity: number | null;
  unit: string | null;
  qtyLabel: string | null;
  dietType: DietType;
}

/** Ingredient as sent to the API: food-linked or manual. */
export type IngredientInput =
  | { foodItemId: string; amount: number; name?: string; qtyLabel?: string }
  | {
      name: string;
      qtyLabel?: string;
      quantity?: number | null;
      unit?: string | null;
      kcal: number;
      proteinG: number;
      carbsG?: number | null;
      fatG?: number | null;
      dietType?: DietType;
    };

export type RecipeCategory = "meal" | "snack_sweet" | "snack_salty";
export interface Recipe {
  id: string;
  name: string;
  category: RecipeCategory;
  description: string | null;
  servings: number;
  ingredients: Ingredient[];
  totals: Totals;
  perServing: Macros;
  dietType: DietType;
  updatedAt: string;
}

export interface PlanMeal {
  id: string;
  slot: MealSlot;
  title: string;
  note: string | null;
  ingredients: Ingredient[];
  totals: Totals;
  dietType: DietType;
}
export interface PlanDay {
  weekday: number;
  dayName: string;
  isStrictVeg: boolean;
  meals: PlanMeal[];
  plannedTotals: Totals;
}
export interface Plan {
  id: string;
  name: string;
  updatedAt: string;
  days: PlanDay[];
}

export interface FoodEntry {
  id: string;
  date: string;
  mealSlot: EntrySlot;
  source: "manual" | "food_item" | "recipe" | "plan_meal" | "snack";
  name: string;
  quantity: number | null;
  unit: string | null;
  qtyLabel: string | null;
  kcal: number;
  proteinG: number;
  carbsG: number | null;
  fatG: number | null;
  foodItemId: string | null;
  recipeId: string | null;
  planMealId: string | null;
  snackKind: "sweet" | "salty" | null;
  createdAt: string;
}

export interface Checkin {
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

export interface DaySummary {
  date: string;
  weekday: number;
  dayName: string;
  isStrictVegDay: boolean;
  target: Targets;
  consumed: Totals;
  planned: Totals | null;
  remaining: { kcal: number; proteinG: number };
  progress: { kcalPct: number; proteinPct: number };
  planMeals: {
    slot: MealSlot;
    mealId: string | null;
    title: string | null;
    kcal: number;
    proteinG: number;
    eaten: boolean;
    entryId: string | null;
  }[];
  snacks: { sweet: FoodEntry | null; salty: FoodEntry | null };
  entries: FoodEntry[];
  steps: { count: number; target: number };
  habits: { id: string; key: string; name: string; done: boolean }[];
  checkin: Checkin | null;
  workouts: { id: string; split: string; durationMin: number | null; exercises: number }[];
}

export interface WeightProgress {
  from: string;
  to: string;
  points: { date: string; weightKg: number; avg7: number }[];
  stats: {
    entries: number;
    latestDate: string | null;
    latestWeightKg: number | null;
    latestAvg7: number | null;
    weeklyChangeKg: number | null;
    averageWeeklyRateKg: number | null;
  };
  waist: { date: string; waistCm: number }[];
}

export interface Habit {
  id: string;
  key: string;
  name: string;
  description: string | null;
  position: number;
  isActive: boolean;
  isSystem: boolean;
}

export type WorkoutSplit = "push" | "pull" | "legs" | "rest" | "other";
export interface WorkoutSet {
  setNumber: number;
  reps: number;
  weightKg: number | null;
  rpe: number | null;
  isWarmup: boolean;
}
export interface ExerciseStats {
  workingSets: number;
  totalReps: number;
  volumeKg: number;
  topSet: { weightKg: number; reps: number } | null;
  estimated1RmKg: number | null;
}
export interface Workout {
  id: string;
  date: string;
  split: WorkoutSplit;
  durationMin: number | null;
  notes: string | null;
  updatedAt: string;
  exercises: { id: string; name: string; notes: string | null; sets: WorkoutSet[]; stats: ExerciseStats }[];
  totals: { workingSets: number; volumeKg: number };
}
export interface Progression {
  exercise: string;
  sessions: ({ date: string; sessionId: string; split: string } & ExerciseStats)[];
  bestEstimated1RmKg: number | null;
}

export interface GroceryItem {
  id: string;
  name: string;
  quantityLabel: string | null;
  isPurchased: boolean;
  source: "generated" | "custom" | "template";
  position: number;
}
export interface GroceryList {
  id: string;
  name: string;
  generatedAt: string | null;
  items: GroceryItem[];
  purchased: number;
  total: number;
}
