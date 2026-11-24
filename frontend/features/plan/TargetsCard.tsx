"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "@/services/api";
import { qk, useTargets, useTargetsHistory } from "@/services/queries";
import { Button } from "@/components/ui/Button";
import { ErrorState, LoadingBlock } from "@/components/ui/Feedback";
import { Field } from "@/components/ui/Field";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { formatLong, todayISO } from "@/lib/dates";
import { fmt1, fmtInt } from "@/lib/format";
import type { Targets } from "@/types/api";

/** Active targets, changing them from a date onwards, and the history of versions. */
export function TargetsCard() {
  const today = todayISO();
  const current = useTargets(today);
  const history = useTargetsHistory();
  const [editing, setEditing] = useState(false);
  const t = current.data;

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900">Active Targets</h3>
        {t && !editing && (
          <Button size="xs" variant="secondary" onClick={() => setEditing(true)}>
            Change
          </Button>
        )}
      </div>
      {current.isLoading ? (
        <LoadingBlock />
      ) : current.isError ? (
        <ErrorState message={errorMessage(current.error)} onRetry={() => current.refetch()} />
      ) : editing ? (
        <TargetsForm current={t!} onDone={() => setEditing(false)} />
      ) : (
        <dl className="divide-y divide-slate-100 text-sm">
          <div className="flex justify-between gap-4 py-2.5">
            <dt className="text-slate-500">Active Daily Target</dt>
            <dd className="text-right font-bold text-emerald-700 tabular-nums">
              {fmtInt(t!.caloriesKcal)} kcal/day • {fmt1(t!.proteinG)} g protein
            </dd>
          </div>
          <div className="flex justify-between gap-4 py-2.5">
            <dt className="text-slate-500">Steps • Creatine</dt>
            <dd className="text-right font-medium text-slate-900 tabular-nums">
              {fmtInt(t!.steps)}/day • {fmt1(t!.creatineG)} g
            </dd>
          </div>
          <div className="flex justify-between gap-4 py-2.5">
            <dt className="text-slate-500">Baseline BMR / TDEE</dt>
            <dd className="text-right font-medium text-slate-900 tabular-nums">
              {t!.bmrKcal && t!.tdeeKcal ? `~${fmtInt(t!.bmrKcal)} kcal / ~${fmtInt(t!.tdeeKcal)} kcal` : "Not set"}
            </dd>
          </div>
          <div className="flex justify-between gap-4 py-2.5">
            <dt className="text-slate-500">Target Loss Pace</dt>
            <dd className="text-right font-medium text-slate-900 tabular-nums">~0.3–0.6 kg / week</dd>
          </div>
        </dl>
      )}

      <details className="text-xs">
        <summary className="cursor-pointer font-semibold text-slate-600 select-none hover:text-slate-900">
          Target history
        </summary>
        {history.isLoading ? (
          <LoadingBlock />
        ) : history.isError ? (
          <ErrorState message={errorMessage(history.error)} onRetry={() => history.refetch()} />
        ) : (
          <ul className="mt-2 space-y-1.5">
            {history.data!.map((h) => (
              <li key={h.id} className="flex justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 tabular-nums">
                <span className="text-slate-600">
                  {h.effectiveFrom === "1970-01-01" ? "Initial" : `From ${formatLong(h.effectiveFrom)}`}
                </span>
                <span className="font-semibold text-slate-800">
                  {fmtInt(h.caloriesKcal)} kcal · {fmt1(h.proteinG)} g P · {fmtInt(h.steps)} steps
                </span>
              </li>
            ))}
          </ul>
        )}
      </details>
    </div>
  );
}

function TargetsForm({ current, onDone }: { current: Targets; onDone: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [from, setFrom] = useState(todayISO());
  const [v, setV] = useState({
    kcal: String(current.caloriesKcal),
    protein: String(current.proteinG),
    steps: String(current.steps),
    creatine: String(current.creatineG),
  });
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((s) => ({ ...s, [k]: e.target.value }));

  const save = useMutation({
    mutationFn: () =>
      api<Targets>("PUT", `/targets/${from}`, {
        caloriesKcal: Math.round(Number(v.kcal)),
        proteinG: Number(v.protein),
        steps: Math.round(Number(v.steps)),
        creatineG: Number(v.creatine),
        bmrKcal: current.bmrKcal,
        tdeeKcal: current.tdeeKcal,
        note: "Set in Plan & Rules",
      }),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: qk.allTargets });
      qc.invalidateQueries({ queryKey: qk.allDays });
      toast(
        `Targets set to ${fmtInt(t.caloriesKcal)} kcal & ${fmt1(t.proteinG)} g protein from ${formatLong(t.effectiveFrom)}`,
      );
      onDone();
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await confirm({
      title: "Change your targets?",
      body: `From ${formatLong(from)}: ${fmtInt(Number(v.kcal))} kcal, ${v.protein} g protein, ${fmtInt(Number(v.steps))} steps. Days before that keep their old targets.`,
      confirmLabel: "Save targets",
      destructive: false,
    });
    if (ok) save.mutate();
  };

  return (
    <form onSubmit={submit} className="space-y-3" aria-label="Change targets">
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Calories (kcal/day)"
          type="number"
          required
          min={800}
          max={6000}
          value={v.kcal}
          onChange={set("kcal")}
        />
        <Field
          label="Protein (g/day)"
          type="number"
          required
          min={0}
          max={500}
          value={v.protein}
          onChange={set("protein")}
        />
        <Field
          label="Steps (per day)"
          type="number"
          required
          min={0}
          max={100000}
          step={500}
          value={v.steps}
          onChange={set("steps")}
        />
        <Field
          label="Creatine (g/day)"
          type="number"
          required
          min={0}
          max={20}
          step={0.5}
          value={v.creatine}
          onChange={set("creatine")}
        />
      </div>
      <Field
        label="Effective from"
        type="date"
        required
        value={from}
        onChange={(e) => e.target.value && setFrom(e.target.value)}
        hint="Earlier days keep the targets they had."
      />
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button size="sm" type="submit" loading={save.isPending}>
          Save Targets
        </Button>
      </div>
    </form>
  );
}
