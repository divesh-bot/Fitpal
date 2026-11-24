"use client";

import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "@/services/api";
import { qk } from "@/services/queries";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { todayISO } from "@/lib/dates";
import type { Plan } from "@/types/api";

const MAX_FILE_BYTES = 180 * 1024; // the API accepts request bodies up to 200 KB

/** Export / import (FitPal v1 or prototype v2 files) / reset the weekly plan. */
export function WeekManagementCard() {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);

  const onPlanChanged = (plan: Plan) => {
    qc.setQueryData(qk.plan, plan);
    qc.invalidateQueries({ queryKey: qk.allDays });
    qc.invalidateQueries({ queryKey: qk.allRecipes }); // snack options may have changed
  };

  const exportPlan = useMutation({
    mutationFn: () => api<object>("GET", "/meal-plans/active/export"),
    onSuccess: (file) => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `fitpal-plan-${todayISO()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast("Plan exported as JSON");
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  const importPlan = useMutation({
    mutationFn: (payload: unknown) => api<Plan>("POST", "/meal-plans/active/import", payload),
    onSuccess: (plan) => (onPlanChanged(plan), toast(`Imported "${plan.name}"`)),
    onError: (e) => toast(errorMessage(e), "error"),
  });

  const resetPlan = useMutation({
    mutationFn: () => api<Plan>("POST", "/meal-plans/active/reset", {}),
    onSuccess: (plan) => (onPlanChanged(plan), toast("Restored the default 7-day nutrition plan", "neutral")),
    onError: (e) => toast(errorMessage(e), "error"),
  });

  async function onFile(file: File | undefined) {
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) return toast("That file is too large to be a FitPal plan.", "error");
    let payload: { version?: unknown };
    try {
      payload = JSON.parse(await file.text());
    } catch {
      return toast("Could not read that file — it isn't valid JSON.", "error");
    }
    if (payload?.version !== 1 && payload?.version !== 2) {
      return toast("Unrecognised file. Use a FitPal plan export or the original prototype's export.", "error");
    }
    const ok = await confirm({
      title: "Replace your meal plan with this file?",
      body: `Your current 7-day plan${payload.version === 2 ? " and snack options" : ""} will be replaced by "${file.name}". Food you already logged keeps its values. Tip: export your current plan first.`,
      confirmLabel: "Import",
    });
    if (ok) importPlan.mutate(payload);
  }

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div>
        <h3 className="text-base font-semibold text-slate-900">Week Management &amp; Backups</h3>
        <p className="text-xs text-slate-500">
          Save your plan as a JSON file, import a saved plan (FitPal or the original prototype&apos;s export), or
          restore the original 7-day plan.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <Button variant="dark" size="sm" loading={exportPlan.isPending} onClick={() => exportPlan.mutate()}>
          Export Plan (JSON)
        </Button>
        <label
          className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 ${importPlan.isPending ? "pointer-events-none opacity-60" : ""}`}
        >
          {importPlan.isPending ? "Importing…" : "Import Plan (JSON)"}
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>
        <Button
          variant="danger"
          size="sm"
          className="sm:ml-auto"
          loading={resetPlan.isPending}
          onClick={async () =>
            (await confirm({
              title: "Reset meals to the default plan?",
              body: "This restores all 7 days of meals, the snack options and the strictly-vegetarian Tuesday to the original plan. Your logged food, weight, workouts and targets are kept.",
              confirmLabel: "Reset Plan",
            })) && resetPlan.mutate()
          }
        >
          Reset Meals to Default Plan
        </Button>
      </div>
    </div>
  );
}
