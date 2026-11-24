"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type {
  DaySummary,
  Food,
  Habit,
  Plan,
  Preferences,
  Profile,
  Recipe,
  RecipeCategory,
  Targets,
  WeightProgress,
  Checkin,
  Workout,
  Progression,
} from "@/types/api";

/**
 * Query keys in one place, so screens can refresh exactly what changed after
 * a save (e.g. invalidate ["day"] after editing the plan).
 */
export const qk = {
  day: (date: string) => ["day", date] as const,
  allDays: ["day"] as const,
  targets: (date: string) => ["targets", date] as const,
  allTargets: ["targets"] as const,
  profile: ["profile"] as const,
  preferences: ["preferences"] as const,
  plan: ["plan"] as const,
  foods: (q: string) => ["foods", q] as const,
  allFoods: ["foods"] as const,
  recipes: (category?: RecipeCategory) => ["recipes", category ?? "all"] as const,
  allRecipes: ["recipes"] as const,
  checkins: (from: string, to: string) => ["checkins", from, to] as const,
  weight: (from: string, to: string) => ["weight", from, to] as const,
  habits: ["habits"] as const,
  workouts: ["workouts"] as const,
  progression: (exercise: string) => ["progression", exercise.toLowerCase()] as const,
  exercises: ["exercises"] as const,
  grocery: ["grocery"] as const,
};

export function useTargets(date: string) {
  return useQuery({
    queryKey: qk.targets(date),
    queryFn: ({ signal }) => api<Targets>("GET", `/targets?date=${date}`, undefined, signal),
  });
}

export function useDay(date: string) {
  return useQuery({
    queryKey: qk.day(date),
    queryFn: ({ signal }) => api<DaySummary>("GET", `/days/${date}`, undefined, signal),
  });
}

export function usePlan() {
  return useQuery({
    queryKey: qk.plan,
    queryFn: ({ signal }) => api<Plan>("GET", "/meal-plans/active", undefined, signal),
  });
}

export function useRecipes(category?: RecipeCategory) {
  return useQuery({
    queryKey: qk.recipes(category),
    queryFn: ({ signal }) =>
      api<Recipe[]>("GET", `/recipes${category ? `?category=${category}` : ""}`, undefined, signal),
  });
}

export function useFoods(q: string) {
  return useQuery({
    queryKey: qk.foods(q),
    queryFn: ({ signal }) =>
      api<Food[]>("GET", `/foods?limit=100${q ? `&q=${encodeURIComponent(q)}` : ""}`, undefined, signal),
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });
}

export function usePreferences() {
  return useQuery({
    queryKey: qk.preferences,
    queryFn: ({ signal }) => api<Preferences>("GET", "/preferences", undefined, signal),
  });
}

export function useHabits(includeInactive = false) {
  return useQuery({
    queryKey: [...qk.habits, includeInactive],
    queryFn: ({ signal }) =>
      api<Habit[]>("GET", `/habits${includeInactive ? "?includeInactive=true" : ""}`, undefined, signal),
  });
}

export function useProfile() {
  return useQuery({
    queryKey: qk.profile,
    queryFn: ({ signal }) => api<Profile>("GET", "/profile", undefined, signal),
  });
}

export function useWeightProgress(from: string, to: string) {
  return useQuery({
    queryKey: qk.weight(from, to),
    queryFn: ({ signal }) => api<WeightProgress>("GET", `/progress/weight?from=${from}&to=${to}`, undefined, signal),
  });
}

export function useCheckins(from: string, to: string) {
  return useQuery({
    queryKey: qk.checkins(from, to),
    queryFn: ({ signal }) => api<Checkin[]>("GET", `/checkins?from=${from}&to=${to}`, undefined, signal),
  });
}

export function useWorkouts(limit = 30) {
  return useQuery({
    queryKey: [...qk.workouts, limit],
    queryFn: ({ signal }) => api<Workout[]>("GET", `/workouts?limit=${limit}`, undefined, signal),
  });
}

export function useExerciseNames() {
  return useQuery({
    queryKey: qk.exercises,
    queryFn: ({ signal }) => api<string[]>("GET", "/workouts/exercises", undefined, signal),
  });
}

export function useProgression(exercise: string) {
  return useQuery({
    queryKey: qk.progression(exercise),
    queryFn: ({ signal }) =>
      api<Progression>("GET", `/workouts/progression?exercise=${encodeURIComponent(exercise)}`, undefined, signal),
    enabled: exercise.trim().length > 0,
  });
}

export function useTargetsHistory() {
  return useQuery({
    queryKey: [...qk.allTargets, "history"],
    queryFn: ({ signal }) => api<Targets[]>("GET", "/targets/history", undefined, signal),
  });
}
