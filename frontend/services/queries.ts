"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { Targets } from "@/types/api";

/**
 * Query keys in one place, so screens can refresh exactly what changed after
 * a save (e.g. invalidate ["day", date] after logging food).
 */
export const qk = {
  day: (date: string) => ["day", date] as const,
  targets: (date: string) => ["targets", date] as const,
  targetsHistory: ["targets", "history"] as const,
  profile: ["profile"] as const,
  preferences: ["preferences"] as const,
  plan: ["plan"] as const,
  foods: (q: string) => ["foods", q] as const,
  recipes: (category?: string) => ["recipes", category ?? "all"] as const,
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
