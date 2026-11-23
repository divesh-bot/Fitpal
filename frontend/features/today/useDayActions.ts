"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "@/services/api";
import { qk } from "@/services/queries";
import { useToast } from "@/components/ui/Toast";
import { newRequestId } from "@/lib/nutrition";
import type { DaySummary, EntrySlot, FoodEntry, MealSlot } from "@/types/api";

/**
 * All Today-screen writes. Each updates the screen only AFTER the API confirms
 * (no optimistic success messages), and reports failures as a toast.
 */
export function useDayActions(date: string) {
  const qc = useQueryClient();
  const toast = useToast();

  const setDay = (summary: DaySummary) => qc.setQueryData(qk.day(date), summary);
  const refreshDay = () => qc.invalidateQueries({ queryKey: qk.day(date) });
  const onError = (err: unknown) => toast(errorMessage(err), "error");

  const planMeal = useMutation({
    mutationFn: ({ slot, eaten }: { slot: MealSlot; eaten: boolean }) =>
      api<DaySummary>("PUT", `/days/${date}/plan-meals/${slot}`, { eaten }),
    onSuccess: setDay,
    onError,
  });

  const snack = useMutation({
    mutationFn: ({ kind, recipeId }: { kind: "sweet" | "salty"; recipeId: string | null }) =>
      api<DaySummary>("PUT", `/days/${date}/snacks/${kind}`, { recipeId }),
    onSuccess: setDay,
    onError,
  });

  const reset = useMutation({
    mutationFn: () => api<DaySummary>("POST", `/days/${date}/reset`, {}),
    onSuccess: (d) => {
      setDay(d);
      toast("Daily checkmarks reset", "neutral");
    },
    onError,
  });

  const steps = useMutation({
    mutationFn: (count: number) => api("PUT", `/checkins/${date}`, { steps: count }),
    onSuccess: refreshDay,
    onError,
  });

  const habit = useMutation({
    mutationFn: ({ habitId, completed }: { habitId: string; completed: boolean }) =>
      api("PUT", `/habit-logs/${habitId}/${date}`, { completed }),
    onSuccess: refreshDay,
    onError,
  });

  const logFood = useMutation({
    mutationFn: (
      body:
        | { source: "manual"; mealSlot: EntrySlot; name: string; kcal: number; proteinG: number; qtyLabel?: string }
        | { source: "food_item"; mealSlot: EntrySlot; foodItemId: string; amount: number }
        | { source: "recipe"; mealSlot: EntrySlot; recipeId: string; servings: number },
    ) => api<FoodEntry>("POST", "/food-entries", { ...body, date, clientRequestId: newRequestId() }),
    onSuccess: (entry) => {
      refreshDay();
      toast(`Logged "${entry.name}" (${entry.kcal} kcal)`);
    },
    onError,
  });

  const deleteEntry = useMutation({
    mutationFn: (id: string) => api("DELETE", `/food-entries/${id}`),
    onSuccess: () => {
      refreshDay();
      toast("Removed", "neutral");
    },
    onError,
  });

  return { planMeal, snack, reset, steps, habit, logFood, deleteEntry };
}
