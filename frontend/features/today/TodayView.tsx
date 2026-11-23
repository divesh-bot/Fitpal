"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "@/services/api";
import { qk, useDay, usePlan } from "@/services/queries";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/Card";
import { ErrorState, LoadingBlock } from "@/components/ui/Feedback";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { formatShort, isFuture, todayISO, WEEKDAY_LONG } from "@/lib/dates";
import type { Plan } from "@/types/api";
import { DaySelector } from "./DaySelector";
import { LogFoodCard } from "./LogFoodCard";
import { MealCard } from "./MealCard";
import { SnacksCard } from "./SnacksCard";
import { StepsHabitsCard } from "./StepsHabitsCard";
import { SummaryCard } from "./SummaryCard";
import { useDayActions } from "./useDayActions";

export function TodayView() {
  const [date, setDate] = useState(todayISO);
  const day = useDay(date);
  const plan = usePlan();
  const actions = useDayActions(date);
  const confirm = useConfirm();
  const toast = useToast();
  const qc = useQueryClient();
  const readOnly = isFuture(date);

  const weekday = day.data?.weekday;
  const planDay = plan.data?.days.find((d) => d.weekday === weekday);
  const isVeg = day.data?.isStrictVegDay ?? false;
  const vegWeekdays = new Set(plan.data?.days.filter((d) => d.isStrictVeg).map((d) => d.weekday) ?? []);

  const toggleVeg = useMutation({
    mutationFn: () => api<Plan>("PATCH", `/meal-plans/active/days/${weekday}`, { isStrictVeg: !isVeg }),
    onSuccess: (p) => {
      qc.setQueryData(qk.plan, p);
      qc.invalidateQueries({ queryKey: qk.allDays });
      toast(
        `${WEEKDAY_LONG[weekday! - 1]} ${!isVeg ? "marked strictly vegetarian" : "is no longer strictly vegetarian"}`,
      );
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Nutrition"
        subtitle="Whole eggs only • No tofu • Edit any meal or snack in your weekly plan"
        actions={
          <>
            <button
              type="button"
              disabled={!weekday || toggleVeg.isPending}
              onClick={() => toggleVeg.mutate()}
              aria-pressed={isVeg}
              className={`rounded-lg border px-3 py-1.5 text-xs transition-colors disabled:opacity-60 ${
                isVeg
                  ? "border-emerald-200 bg-emerald-50 font-semibold text-emerald-800"
                  : "border-slate-200 bg-white font-medium text-slate-600 hover:bg-slate-50"
              }`}
            >
              {isVeg ? "Strictly Veg: ON" : "Mark Veg Day"}
            </button>
            <Button
              size="sm"
              variant="secondary"
              disabled={readOnly || !day.data}
              loading={actions.reset.isPending}
              onClick={async () => {
                if (
                  await confirm({
                    title: `Reset checkmarks for ${formatShort(date)}?`,
                    body: "Unticks planned meals, clears the chosen snacks, habit ticks and steps for this date. Foods you logged yourself and your weight are kept.",
                    confirmLabel: "Reset",
                  })
                )
                  actions.reset.mutate();
              }}
            >
              Reset Checkmarks
            </Button>
          </>
        }
      />

      <DaySelector date={date} onChange={setDate} vegWeekdays={vegWeekdays} />

      {isVeg && weekday && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span
              className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white"
              aria-hidden="true"
            >
              V
            </span>
            <div>
              <p className="text-sm font-semibold text-emerald-900">
                {WEEKDAY_LONG[weekday - 1]} — Strictly Vegetarian
              </p>
              <p className="text-xs text-emerald-700">
                No eggs or chicken today. High-protein dal, soya chunks, and low-fat paneer recommended.
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
            Strictly Veg
          </span>
        </div>
      )}

      {readOnly && (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-500">
          You&apos;re looking ahead to {formatShort(date)}. You can view and edit the plan, but logging is only possible
          for today or earlier.
        </p>
      )}

      {day.isLoading ? (
        <LoadingBlock label="Loading your day…" />
      ) : day.isError ? (
        <ErrorState message={errorMessage(day.error)} onRetry={() => day.refetch()} />
      ) : day.data ? (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <SummaryCard day={day.data} />
            <StepsHabitsCard
              key={`${date}-${day.data.steps.count}`}
              day={day.data}
              actions={actions}
              readOnly={readOnly}
            />
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold tracking-wider text-slate-500 uppercase">Scheduled Meals</h3>
              <span className="text-xs text-slate-400">
                Tick a meal when eaten • Tap to view ingredients • &ldquo;Edit Meal&rdquo; changes every{" "}
                {WEEKDAY_LONG[day.data.weekday - 1]}
              </span>
            </div>
            {plan.isError && (
              <ErrorState
                message={`Couldn't load your meal plan: ${errorMessage(plan.error)}`}
                onRetry={() => plan.refetch()}
              />
            )}
            <div className="space-y-3">
              {day.data.planMeals.map((item) => (
                <MealCard
                  key={`${date}-${item.slot}`}
                  item={item}
                  meal={planDay?.meals.find((m) => m.slot === item.slot) ?? null}
                  entry={day.data!.entries.find((e) => e.id === item.entryId)}
                  weekday={day.data!.weekday}
                  isStrictVeg={isVeg}
                  readOnly={readOnly}
                  pending={actions.planMeal.isPending}
                  onToggle={() => actions.planMeal.mutate({ slot: item.slot, eaten: !item.eaten })}
                />
              ))}
            </div>
          </div>

          <SnacksCard day={day.data} actions={actions} readOnly={readOnly} />
          <LogFoodCard day={day.data} actions={actions} readOnly={readOnly} />
        </>
      ) : null}
    </div>
  );
}
