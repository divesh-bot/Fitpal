"use client";

import { useState } from "react";
import { fmtInt } from "@/lib/format";
import type { DaySummary } from "@/types/api";
import type { useDayActions } from "./useDayActions";

const HABIT_LABELS: Record<string, string> = { creatine: "Creatine 5g", workout: "PPL (~40m)" };

/** Steps (±500 / typed) and daily habit toggles (creatine, workout, custom). */
export function StepsHabitsCard({
  day,
  actions,
  readOnly,
}: {
  day: DaySummary;
  actions: ReturnType<typeof useDayActions>;
  readOnly: boolean;
}) {
  const { count, target } = day.steps;
  // Local text for the input; committed on blur/Enter. Reset when the server value changes.
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(count);
  const pct = target > 0 ? Math.min(100, Math.round((count / target) * 100)) : 0;

  const commit = (value: number) => {
    setDraft(null);
    const v = Math.max(0, Math.min(200_000, Math.round(value)));
    if (v !== count) actions.steps.mutate(v);
  };

  return (
    <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Daily Steps</span>
          <span className="text-xs text-slate-500 tabular-nums">
            <span className="font-semibold text-slate-800">{fmtInt(count)}</span> / {fmtInt(target)}
          </span>
        </div>
        <div
          className="mb-3 h-2 w-full overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Steps progress"
        >
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={readOnly || actions.steps.isPending}
            onClick={() => commit(count - 500)}
            className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
          >
            -500
          </button>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={100}
            aria-label="Steps"
            disabled={readOnly}
            value={shown}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => draft !== null && commit(Number(draft) || 0)}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-center text-sm font-semibold tabular-nums focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 focus:outline-none disabled:bg-slate-50"
          />
          <button
            type="button"
            disabled={readOnly || actions.steps.isPending}
            onClick={() => commit(count + 500)}
            className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
          >
            +500
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-2">
        {day.habits.map((h) => (
          <button
            key={h.id}
            type="button"
            aria-pressed={h.done}
            disabled={readOnly || actions.habit.isPending}
            onClick={() => actions.habit.mutate({ habitId: h.id, completed: !h.done })}
            className={`flex items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-semibold transition-all disabled:opacity-60 ${
              h.done
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${h.done ? "bg-emerald-500" : "bg-slate-300"}`} aria-hidden="true" />
            <span className="truncate">{HABIT_LABELS[h.key] ?? h.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
