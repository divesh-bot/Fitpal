"use client";

import { useState } from "react";
import { useExerciseNames, useProgression } from "@/services/queries";
import { errorMessage } from "@/services/api";
import { LineChart } from "@/components/charts/LineChart";
import { ErrorState, LoadingBlock } from "@/components/ui/Feedback";
import { inputClass } from "@/components/ui/Field";
import { formatShort } from "@/lib/dates";
import { fmt1, fmtInt } from "@/lib/format";

/** Per-exercise progression: top working set and estimated 1RM per session. */
export function ProgressionCard() {
  const names = useExerciseNames();
  const [picked, setPicked] = useState<string | null>(null);
  const exercise = picked ?? names.data?.[0] ?? "";
  const q = useProgression(exercise);
  const sessions = q.data?.sessions ?? [];

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Strength Progression</h3>
          <p className="text-xs text-slate-500">
            Top working set and estimated 1-rep max (Epley) per session. Warm-ups excluded.
          </p>
        </div>
        {names.data && names.data.length > 0 && (
          <div className="sm:w-64">
            <label htmlFor="prog-exercise" className="mb-1 block text-xs font-medium text-slate-600">
              Exercise
            </label>
            <select
              id="prog-exercise"
              value={exercise}
              onChange={(e) => setPicked(e.target.value)}
              className={inputClass}
            >
              {names.data.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {names.isLoading ? (
        <LoadingBlock />
      ) : names.isError ? (
        <ErrorState message={errorMessage(names.error)} onRetry={() => names.refetch()} />
      ) : names.data!.length === 0 ? (
        <p className="text-xs text-slate-400 italic">Log a workout with weights to see your progression here.</p>
      ) : q.isLoading ? (
        <LoadingBlock />
      ) : q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : (
        <>
          {sessions.some((s) => s.topSet) ? (
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
              <LineChart
                ariaLabel={`${exercise}: top set weight and estimated 1RM per session`}
                unit="kg"
                series={[
                  { key: "top", label: "Top set (kg)", color: "#475569", style: "dots" },
                  { key: "e1rm", label: "Estimated 1RM", color: "#059669", style: "line" },
                ]}
                points={sessions.map((s) => ({
                  date: s.date,
                  values: { top: s.topSet?.weightKg ?? null, e1rm: s.estimated1RmKg },
                }))}
              />
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No weighted sets for {exercise} yet (bodyweight only).</p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                  <th className="py-1.5 text-left">Date</th>
                  <th className="px-2 py-1.5 text-right">Sets</th>
                  <th className="px-2 py-1.5 text-right">Top set</th>
                  <th className="px-2 py-1.5 text-right">Est. 1RM</th>
                  <th className="py-1.5 pl-2 text-right">Volume</th>
                </tr>
              </thead>
              <tbody>
                {[...sessions].reverse().map((s) => (
                  <tr key={s.sessionId} className="border-t border-slate-100 tabular-nums">
                    <td className="py-2 text-slate-700">{formatShort(s.date)}</td>
                    <td className="px-2 py-2 text-right text-slate-600">{s.workingSets}</td>
                    <td className="px-2 py-2 text-right font-medium text-slate-800">
                      {s.topSet ? `${fmt1(s.topSet.weightKg)} kg × ${s.topSet.reps}` : "—"}
                    </td>
                    <td className="px-2 py-2 text-right font-semibold text-emerald-700">
                      {s.estimated1RmKg !== null ? `${fmt1(s.estimated1RmKg)} kg` : "—"}
                    </td>
                    <td className="py-2 pl-2 text-right text-slate-600">{fmtInt(s.volumeKg)} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
