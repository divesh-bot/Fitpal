"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "@/services/api";
import { useCheckins } from "@/services/queries";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { ErrorState, LoadingBlock } from "@/components/ui/Feedback";
import { addDays, formatShort, todayISO } from "@/lib/dates";
import { fmt1, fmtInt } from "@/lib/format";

const QUALITY = { poor: "Poor", fair: "Fair", good: "Good", great: "Great" } as const;

/** Last 60 days of check-ins, newest first. Click to edit; delete with confirmation. */
export function CheckinHistory({ onEdit }: { onEdit: (date: string) => void }) {
  const to = todayISO();
  const q = useCheckins(addDays(to, -59), to);
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  const remove = useMutation({
    mutationFn: (date: string) => api("DELETE", `/checkins/${date}`),
    onSuccess: (_d, date) => {
      ["checkins", "weight", "checkin"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      qc.invalidateQueries({ queryKey: ["day", date] });
      toast(`Deleted check-in for ${formatShort(date)}`, "neutral");
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <h3 className="mb-3 text-base font-semibold text-slate-900">Recent Check-ins</h3>
      {q.isLoading ? (
        <LoadingBlock />
      ) : q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : q.data!.length === 0 ? (
        <p className="text-xs text-slate-400 italic">No check-ins saved yet.</p>
      ) : (
        <ul className="max-h-80 space-y-2.5 overflow-y-auto pr-1">
          {[...q.data!].reverse().map((c) => (
            <li
              key={c.date}
              className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3"
            >
              <button
                type="button"
                onClick={() => onEdit(c.date)}
                className="min-w-0 space-y-1 text-left"
                aria-label={`Edit check-in for ${formatShort(c.date)}`}
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 tabular-nums">{formatShort(c.date)}</span>
                  {c.weightKg !== null && (
                    <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 tabular-nums">
                      {fmt1(c.weightKg)} kg
                    </span>
                  )}
                  {c.waistCm !== null && (
                    <span className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-600 tabular-nums">
                      Waist {fmt1(c.waistCm)} cm
                    </span>
                  )}
                </span>
                <span className="block text-[11px] text-slate-500 tabular-nums">
                  Sleep: {c.sleepHours ?? "—"}h ({c.sleepQuality ? QUALITY[c.sleepQuality] : "—"}) • Steps:{" "}
                  {c.steps !== null ? fmtInt(c.steps) : "—"} • Hunger: {c.hunger ?? "—"}/10 • Energy: {c.energy ?? "—"}
                  /10
                </span>
                {c.notes && <span className="block truncate text-[11px] text-slate-400 italic">{c.notes}</span>}
              </button>
              <button
                type="button"
                aria-label={`Delete check-in for ${formatShort(c.date)}`}
                disabled={remove.isPending}
                onClick={async () =>
                  (await confirm({
                    title: "Delete this check-in?",
                    body: `Removes weight, waist, steps, sleep and notes for ${formatShort(c.date)}.`,
                    confirmLabel: "Delete",
                  })) && remove.mutate(c.date)
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
