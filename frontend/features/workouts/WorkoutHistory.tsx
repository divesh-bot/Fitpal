"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "@/services/api";
import { qk, useWorkouts } from "@/services/queries";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { ErrorState, LoadingBlock } from "@/components/ui/Feedback";
import { formatShort } from "@/lib/dates";
import { fmt1, fmtInt } from "@/lib/format";
import type { Workout } from "@/types/api";

const SPLIT_LABEL: Record<string, string> = { push: "Push", pull: "Pull", legs: "Legs", rest: "Rest", other: "Other" };

export function WorkoutHistory({ onEdit }: { onEdit: (w: Workout) => void }) {
  const q = useWorkouts(30);
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  const remove = useMutation({
    mutationFn: (w: Workout) => api("DELETE", `/workouts/${w.id}`),
    onSuccess: (_d, w) => {
      qc.invalidateQueries({ queryKey: qk.workouts });
      qc.invalidateQueries({ queryKey: ["progression"] });
      qc.invalidateQueries({ queryKey: qk.exercises });
      qc.invalidateQueries({ queryKey: qk.day(w.date) });
      toast("Workout deleted", "neutral");
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <h3 className="mb-3 text-base font-semibold text-slate-900">Recent Workouts</h3>
      {q.isLoading ? (
        <LoadingBlock />
      ) : q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : q.data!.length === 0 ? (
        <p className="text-xs text-slate-400 italic">No workouts logged yet.</p>
      ) : (
        <ul className="max-h-80 space-y-2.5 overflow-y-auto pr-1">
          {q.data!.map((w) => (
            <li
              key={w.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3"
            >
              <button
                type="button"
                onClick={() => onEdit(w)}
                className="min-w-0 space-y-1.5 text-left"
                aria-label={`Edit ${SPLIT_LABEL[w.split]} workout from ${formatShort(w.date)}`}
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 tabular-nums">{formatShort(w.date)}</span>
                  <span className="rounded-md bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white">
                    {SPLIT_LABEL[w.split]}
                  </span>
                  {w.durationMin !== null && (
                    <span className="text-[11px] text-slate-500 tabular-nums">{w.durationMin} min</span>
                  )}
                  {w.totals.volumeKg > 0 && (
                    <span className="text-[11px] text-slate-500 tabular-nums">
                      · {fmtInt(w.totals.volumeKg)} kg volume
                    </span>
                  )}
                </span>
                <span className="block space-y-0.5">
                  {w.exercises.length === 0 ? (
                    <span className="block text-xs text-slate-400">No exercises recorded</span>
                  ) : (
                    w.exercises.map((e) => (
                      <span key={e.id} className="block text-xs text-slate-600 tabular-nums">
                        <span className="font-medium text-slate-800">{e.name}</span> — {e.stats.workingSets} set
                        {e.stats.workingSets === 1 ? "" : "s"}
                        {e.stats.topSet
                          ? `, top ${fmt1(e.stats.topSet.weightKg)} kg × ${e.stats.topSet.reps}`
                          : ` × ${e.stats.totalReps} reps total`}
                      </span>
                    ))
                  )}
                </span>
              </button>
              <button
                type="button"
                aria-label={`Delete ${SPLIT_LABEL[w.split]} workout from ${formatShort(w.date)}`}
                disabled={remove.isPending}
                onClick={async () =>
                  (await confirm({
                    title: "Delete this workout?",
                    body: `The ${SPLIT_LABEL[w.split]} session on ${formatShort(w.date)} and all its sets will be removed.`,
                    confirmLabel: "Delete",
                  })) && remove.mutate(w)
                }
                className="shrink-0 p-1 text-slate-400 hover:text-rose-600"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
