"use client";

import { useState } from "react";
import { MealEditor } from "@/features/meal-plan/MealEditor";
import { fmt1 } from "@/lib/format";
import type { DaySummary, FoodEntry, PlanMeal } from "@/types/api";

export const SLOT_LABEL = {
  post_workout: "Post-Workout",
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
} as const;

type PlanMealSummary = DaySummary["planMeals"][number];

/** One scheduled meal: tick to log it, expand for ingredients, or edit inline. */
export function MealCard({
  item,
  meal,
  entry,
  weekday,
  isStrictVeg,
  readOnly,
  pending,
  onToggle,
}: {
  item: PlanMealSummary;
  meal: PlanMeal | null;
  entry: FoodEntry | undefined;
  weekday: number;
  isStrictVeg: boolean;
  readOnly: boolean;
  pending: boolean;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const open = expanded || editing;
  const label = SLOT_LABEL[item.slot];
  const title = item.title ?? "No meal planned";
  // Logged values are a snapshot; flag it if the plan changed afterwards.
  const loggedDiffers = entry && entry.kcal !== item.kcal;

  return (
    <div
      role="group"
      aria-label={`${label}: ${title}`}
      className={`overflow-hidden rounded-2xl border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all ${
        editing
          ? "border-emerald-500 ring-2 ring-emerald-500/15"
          : item.eaten
            ? "border-emerald-300/80 bg-emerald-50/10"
            : "border-slate-200/80"
      }`}
    >
      <div className="flex items-center gap-3 p-4">
        <button
          type="button"
          onClick={onToggle}
          disabled={readOnly || pending || (!item.mealId && !item.eaten)}
          aria-pressed={item.eaten}
          aria-label={`${item.eaten ? "Untick" : "Tick"} ${label}: ${title}`}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
            item.eaten
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-slate-300 bg-white hover:border-emerald-500"
          }`}
        >
          {item.eaten && (
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        <button
          type="button"
          onClick={() => !editing && setExpanded((e) => !e)}
          className="min-w-0 flex-1 text-left"
          aria-expanded={open}
        >
          <span className="flex items-center gap-2">
            <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">{label}</span>
            {editing && (
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                Editing
              </span>
            )}
          </span>
          <span
            className={`line-clamp-2 block text-sm leading-snug font-semibold sm:truncate sm:text-base ${item.title ? "text-slate-900" : "text-slate-400 italic"}`}
          >
            {title}
          </span>
          {loggedDiffers && (
            <span className="block text-[11px] text-slate-400">Logged as {entry.kcal} kcal (before plan change)</span>
          )}
        </button>

        <div className="flex shrink-0 items-center gap-2.5">
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${editing ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"}`}
          >
            {editing ? "Close" : "Edit Meal"}
          </button>
          <button
            type="button"
            onClick={() => !editing && setExpanded((e) => !e)}
            className="flex items-center gap-2"
            aria-label={open ? "Hide ingredients" : "Show ingredients"}
          >
            <span className="text-right tabular-nums">
              <span className="block text-sm font-bold text-slate-900">
                {item.kcal} <span className="text-xs font-normal text-slate-400">kcal</span>
              </span>
              <span className="block text-xs font-semibold text-teal-600">{fmt1(item.proteinG)}g P</span>
            </span>
            <svg
              className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {editing ? (
        <MealEditor
          weekday={weekday}
          slot={item.slot}
          meal={meal}
          isStrictVeg={isStrictVeg}
          onDone={() => setEditing(false)}
        />
      ) : (
        open && (
          <div className="space-y-2.5 border-t border-slate-100 bg-slate-50/40 px-4 pt-1 pb-4">
            {meal?.note && (
              <p className="rounded-lg border border-amber-200/60 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {meal.note}
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                    <th className="py-1.5 text-left">Ingredient</th>
                    <th className="px-2 py-1.5 text-left">Qty</th>
                    <th className="px-2 py-1.5 text-right">kcal</th>
                    <th className="py-1.5 pl-2 text-right">Protein</th>
                  </tr>
                </thead>
                <tbody>
                  {meal && meal.ingredients.length > 0 ? (
                    meal.ingredients.map((i) => (
                      <tr key={i.id} className="border-t border-slate-100">
                        <td className="py-2 pr-2 text-slate-700">{i.name}</td>
                        <td className="px-2 py-2 whitespace-nowrap text-slate-500">{i.qtyLabel}</td>
                        <td className="px-2 py-2 text-right font-medium whitespace-nowrap text-slate-800 tabular-nums">
                          {i.kcal} kcal
                        </td>
                        <td className="py-2 pl-2 text-right font-medium whitespace-nowrap text-teal-700 tabular-nums">
                          {fmt1(i.proteinG)}g
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-3 text-center text-xs text-slate-400 italic">
                        No ingredients yet. Click &ldquo;Edit Meal&rdquo; to add foods.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  );
}
