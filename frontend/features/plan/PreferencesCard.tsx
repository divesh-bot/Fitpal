"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "@/services/api";
import { qk, usePreferences } from "@/services/queries";
import { Button } from "@/components/ui/Button";
import { ErrorState, LoadingBlock } from "@/components/ui/Feedback";
import { inputClass, TextAreaField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import type { Preferences } from "@/types/api";

/** Dietary rules enforced on recipes and the meal plan: excluded foods and whole eggs only. */
export function PreferencesCard() {
  const prefs = usePreferences();
  return (
    <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div>
        <h3 className="text-base font-semibold text-slate-900">Dietary Rules &amp; Preferences</h3>
        <p className="text-xs text-slate-500">Enforced whenever you save a recipe, edit the plan or import a plan.</p>
      </div>
      {prefs.isLoading ? (
        <LoadingBlock />
      ) : prefs.isError ? (
        <ErrorState message={errorMessage(prefs.error)} onRetry={() => prefs.refetch()} />
      ) : (
        <PreferencesForm key={JSON.stringify(prefs.data)} prefs={prefs.data!} />
      )}
    </div>
  );
}

function PreferencesForm({ prefs }: { prefs: Preferences }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [wholeEggs, setWholeEggs] = useState(prefs.wholeEggsOnly);
  const [excluded, setExcluded] = useState<string[]>(prefs.excludedFoods);
  const [newFood, setNewFood] = useState("");
  const [notes, setNotes] = useState(prefs.foodPreferences ?? "");
  const dirty =
    wholeEggs !== prefs.wholeEggsOnly ||
    notes !== (prefs.foodPreferences ?? "") ||
    excluded.join("|") !== prefs.excludedFoods.join("|");

  const save = useMutation({
    mutationFn: () =>
      api<Preferences>("PUT", "/preferences", {
        wholeEggsOnly: wholeEggs,
        excludedFoods: excluded,
        foodPreferences: notes.trim() || null,
      }),
    onSuccess: (p) => {
      qc.setQueryData(qk.preferences, p);
      qc.invalidateQueries({ queryKey: qk.allFoods }); // "excluded" flags on foods
      toast("Dietary rules saved");
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  const addFood = (e: FormEvent) => {
    e.preventDefault();
    const f = newFood.trim().toLowerCase();
    if (f && !excluded.includes(f) && excluded.length < 50) setExcluded([...excluded, f]);
    setNewFood("");
  };

  return (
    <div className="space-y-4">
      <label className="flex items-start gap-2.5 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={wholeEggs}
          onChange={(e) => setWholeEggs(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-emerald-600"
        />
        <span>
          <strong className="text-slate-900">Whole eggs only</strong>: refuse separated or liquid egg whites in recipes
          and the plan.
        </span>
      </label>

      <div>
        <p className="mb-1.5 text-xs font-semibold text-slate-600">Excluded foods</p>
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {excluded.length === 0 && <li className="text-xs text-slate-400 italic">None</li>}
          {excluded.map((f) => (
            <li
              key={f}
              className="inline-flex items-center gap-1 rounded-full bg-rose-50 py-0.5 pr-1 pl-2.5 text-xs font-semibold text-rose-700"
            >
              {f}
              <button
                type="button"
                aria-label={`Allow ${f} again`}
                onClick={() => setExcluded(excluded.filter((x) => x !== f))}
                className="rounded-full px-1 hover:bg-rose-100"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={addFood} className="flex gap-2">
          <input
            aria-label="Food to exclude"
            placeholder="e.g. mushroom"
            maxLength={60}
            value={newFood}
            onChange={(e) => setNewFood(e.target.value)}
            className={inputClass}
          />
          <Button type="submit" size="sm" variant="secondary" disabled={!newFood.trim()}>
            Exclude
          </Button>
        </form>
      </div>

      <TextAreaField
        label="Food preferences (notes)"
        rows={3}
        maxLength={2000}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <div className="flex justify-end">
        <Button size="sm" loading={save.isPending} disabled={!dirty} onClick={() => save.mutate()}>
          Save Rules
        </Button>
      </div>
    </div>
  );
}
