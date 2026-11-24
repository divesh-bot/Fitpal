"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "@/services/api";
import { qk, usePlan } from "@/services/queries";
import { ErrorState, LoadingBlock } from "@/components/ui/Feedback";
import { useToast } from "@/components/ui/Toast";
import { MealEditor } from "@/features/meal-plan/MealEditor";
import { SLOT_LABEL } from "@/features/today/MealCard";
import { fmt1, fmtInt } from "@/lib/format";
import type { MealSlot, Plan } from "@/types/api";

const SLOTS: MealSlot[] = ["post_workout", "breakfast", "lunch", "dinner"];

/** The whole 7-day plan at a glance; any meal can be edited, any day toggled strictly vegetarian. */
export function WeeklyPlanCard() {
  const plan = usePlan();
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState<number>(1);
  const [editing, setEditing] = useState<{ weekday: number; slot: MealSlot } | null>(null);

  const toggleVeg = useMutation({
    mutationFn: (v: { weekday: number; isStrictVeg: boolean }) =>
      api<Plan>("PATCH", `/meal-plans/active/days/${v.weekday}`, { isStrictVeg: v.isStrictVeg }),
    onSuccess: (p, v) => {
      qc.setQueryData(qk.plan, p);
      qc.invalidateQueries({ queryKey: qk.allDays });
      toast(
        `${p.days[v.weekday - 1]!.dayName} ${v.isStrictVeg ? "is now strictly vegetarian" : "is no longer strictly vegetarian"}`,
      );
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div>
        <h3 className="text-base font-semibold text-slate-900">Weekly Meal Plan</h3>
        <p className="text-xs text-slate-500">
          {plan.data ? `${plan.data.name}. ` : ""}Open a day to review or edit its meals.
        </p>
      </div>
      {plan.isLoading ? (
        <LoadingBlock label="Loading your plan…" />
      ) : plan.isError ? (
        <ErrorState message={errorMessage(plan.error)} onRetry={() => plan.refetch()} />
      ) : (
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">
          {plan.data!.days.map((d) => {
            const isOpen = open === d.weekday;
            return (
              <section key={d.weekday} aria-label={d.dayName}>
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? 0 : d.weekday)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <svg
                      className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-90" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="text-sm font-semibold text-slate-900">{d.dayName}</span>
                    {d.isStrictVeg && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                        Strictly Veg
                      </span>
                    )}
                    <span className="ml-auto text-xs text-slate-500 tabular-nums">
                      {fmtInt(d.plannedTotals.kcal)} kcal ·{" "}
                      <span className="text-teal-600">{fmt1(d.plannedTotals.proteinG)}g P</span>
                    </span>
                  </button>
                  <label className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-slate-600">
                    <input
                      type="checkbox"
                      checked={d.isStrictVeg}
                      disabled={toggleVeg.isPending}
                      onChange={(e) => toggleVeg.mutate({ weekday: d.weekday, isStrictVeg: e.target.checked })}
                      className="h-4 w-4 accent-emerald-600"
                    />
                    Strictly veg
                  </label>
                </div>
                {isOpen && (
                  <ul className="space-y-2 bg-slate-50/50 px-4 pb-4">
                    {SLOTS.map((slot) => {
                      const meal = d.meals.find((m) => m.slot === slot) ?? null;
                      const isEditing = editing?.weekday === d.weekday && editing.slot === slot;
                      return (
                        <li
                          key={slot}
                          className={`overflow-hidden rounded-xl border bg-white ${isEditing ? "border-emerald-500 ring-2 ring-emerald-500/15" : "border-slate-200/80"}`}
                        >
                          <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                                {SLOT_LABEL[slot]}
                              </p>
                              <p
                                className={`truncate text-sm font-semibold ${meal ? "text-slate-900" : "text-slate-400 italic"}`}
                              >
                                {meal?.title ?? "No meal planned"}
                              </p>
                              {meal && (
                                <p className="truncate text-[11px] text-slate-500">
                                  {meal.ingredients.map((i) => i.name).join(" · ")}
                                </p>
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-3">
                              {meal && (
                                <span className="text-right text-xs tabular-nums">
                                  <span className="block font-bold text-slate-900">{meal.totals.kcal} kcal</span>
                                  <span className="block font-semibold text-teal-600">
                                    {fmt1(meal.totals.proteinG)}g P
                                  </span>
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => setEditing(isEditing ? null : { weekday: d.weekday, slot })}
                                aria-label={`${isEditing ? "Close editor for" : meal ? "Edit" : "Add"} ${d.dayName} ${SLOT_LABEL[slot]}`}
                                className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${isEditing ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                              >
                                {isEditing ? "Close" : meal ? "Edit" : "Add"}
                              </button>
                            </div>
                          </div>
                          {isEditing && (
                            <MealEditor
                              weekday={d.weekday}
                              slot={slot}
                              meal={meal}
                              isStrictVeg={d.isStrictVeg}
                              onDone={() => setEditing(null)}
                            />
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
