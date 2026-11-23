"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "@/services/api";
import { qk, useRecipes } from "@/services/queries";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { ErrorState, LoadingBlock } from "@/components/ui/Feedback";
import { fmt1 } from "@/lib/format";
import type { DaySummary, Recipe } from "@/types/api";
import type { useDayActions } from "./useDayActions";

type Kind = "sweet" | "salty";
const cat = (k: Kind) => (k === "sweet" ? "snack_sweet" : "snack_salty");

/** Pick 1 sweet and 1 salty snack per day (or None); edit the options. */
export function SnacksCard({
  day,
  actions,
  readOnly,
}: {
  day: DaySummary;
  actions: ReturnType<typeof useDayActions>;
  readOnly: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const sweet = useRecipes("snack_sweet");
  const salty = useRecipes("snack_salty");

  return (
    <div className="space-y-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Planned Craving Snacks</h3>
          <p className="text-xs text-slate-500">
            Pick 1 sweet (afternoon) and 1 salty (evening), or None. Keep salt moderate.
          </p>
        </div>
        <Button
          size="sm"
          variant={editing ? "primary" : "secondary"}
          onClick={() => setEditing((e) => !e)}
          className="self-start sm:self-auto"
        >
          {editing ? "Done Editing Snacks" : "Edit Snacks"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {(["sweet", "salty"] as const).map((kind) => {
          const q = kind === "sweet" ? sweet : salty;
          return (
            <div key={kind}>
              <p className="mb-2.5 text-xs font-semibold tracking-wider text-slate-400 uppercase">
                {kind === "sweet" ? "Afternoon Sweet Snack" : "Evening Salty Snack"}
              </p>
              {q.isError ? (
                <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
              ) : q.isLoading ? (
                <LoadingBlock label="Loading snack options…" />
              ) : editing ? (
                <SnackEditorList kind={kind} options={q.data ?? []} />
              ) : (
                <SnackChoices
                  kind={kind}
                  options={q.data ?? []}
                  selectedRecipeId={day.snacks[kind]?.recipeId ?? null}
                  disabled={readOnly || actions.snack.isPending}
                  onSelect={(recipeId) => actions.snack.mutate({ kind, recipeId })}
                />
              )}
            </div>
          );
        })}
      </div>

      {editing && <AddSnackForm />}
    </div>
  );
}

function SnackChoices({
  kind,
  options,
  selectedRecipeId,
  disabled,
  onSelect,
}: {
  kind: Kind;
  options: Recipe[];
  selectedRecipeId: string | null;
  disabled: boolean;
  onSelect: (id: string | null) => void;
}) {
  const all = [
    { id: null, name: "None", detail: `Skip ${kind} snack`, kcal: 0, proteinG: 0 },
    ...options.map((r) => ({
      id: r.id as string | null,
      name: r.name,
      detail: r.description ?? "",
      kcal: r.perServing.kcal,
      proteinG: r.perServing.proteinG,
    })),
  ];
  return (
    <div className="space-y-2" role="radiogroup" aria-label={`${kind} snack`}>
      {all.map((o) => {
        const active = o.id === selectedRecipeId;
        return (
          <button
            key={o.id ?? "none"}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => !active && onSelect(o.id)}
            className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-70 ${
              active
                ? "border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500/20"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <span className="min-w-0">
              <span className={`block text-sm font-semibold ${active ? "text-emerald-900" : "text-slate-800"}`}>
                {o.name}
              </span>
              <span className="mt-0.5 block truncate text-[11px] text-slate-500">{o.detail}</span>
            </span>
            <span className="shrink-0 text-right tabular-nums">
              {o.kcal > 0 ? (
                <>
                  <span className="block text-xs font-bold text-slate-800">~{o.kcal} kcal</span>
                  <span className="block text-[11px] font-medium text-teal-600">{fmt1(o.proteinG)}g P</span>
                </>
              ) : (
                <span className="text-xs text-slate-400">0 kcal</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function useSnackMutations() {
  const qc = useQueryClient();
  const toast = useToast();
  const refresh = () => qc.invalidateQueries({ queryKey: qk.allRecipes });
  const onError = (e: unknown) => toast(errorMessage(e), "error");
  const body = (kind: Kind, name: string, description: string, kcal: number, proteinG: number) => ({
    name,
    category: cat(kind),
    description: description || undefined,
    ingredients: [
      { name: `${name} (as planned)`, qtyLabel: "1 serving", quantity: 1, unit: "serving", kcal, proteinG },
    ],
  });
  return {
    create: useMutation({
      mutationFn: (v: { kind: Kind; name: string; description: string; kcal: number; proteinG: number }) =>
        api<Recipe>("POST", "/recipes", body(v.kind, v.name, v.description, v.kcal, v.proteinG)),
      onSuccess: (r) => (refresh(), toast(`Added "${r.name}"`)),
      onError,
    }),
    update: useMutation({
      mutationFn: (v: { id: string; kind: Kind; name: string; description: string; kcal: number; proteinG: number }) =>
        api<Recipe>("PUT", `/recipes/${v.id}`, body(v.kind, v.name, v.description, v.kcal, v.proteinG)),
      onSuccess: (r) => (refresh(), toast(`Updated "${r.name}"`)),
      onError,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api("DELETE", `/recipes/${id}`),
      onSuccess: () => (refresh(), toast("Snack option removed", "neutral")),
      onError,
    }),
  };
}

function SnackEditorList({ kind, options }: { kind: Kind; options: Recipe[] }) {
  const m = useSnackMutations();
  const confirm = useConfirm();
  if (options.length === 0) return <p className="text-xs text-slate-400 italic">No {kind} snacks configured.</p>;
  return (
    <div className="space-y-2">
      {options.map((r) =>
        r.ingredients.length === 1 ? (
          <SnackRowEditor key={`${r.id}-${r.updatedAt}`} recipe={r} kind={kind} m={m} confirm={confirm} />
        ) : (
          <div key={r.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-600">
            <span className="font-semibold text-slate-800">{r.name}</span> · {r.perServing.kcal} kcal. Built from{" "}
            {r.ingredients.length} ingredients; edit it in the Calculator.
          </div>
        ),
      )}
    </div>
  );
}

function SnackRowEditor({
  recipe,
  kind,
  m,
  confirm,
}: {
  recipe: Recipe;
  kind: Kind;
  m: ReturnType<typeof useSnackMutations>;
  confirm: ReturnType<typeof useConfirm>;
}) {
  const [name, setName] = useState(recipe.name);
  const [detail, setDetail] = useState(recipe.description ?? "");
  const [kcal, setKcal] = useState(String(recipe.perServing.kcal));
  const [protein, setProtein] = useState(String(recipe.perServing.proteinG));
  const changed =
    name !== recipe.name ||
    detail !== (recipe.description ?? "") ||
    Number(kcal) !== recipe.perServing.kcal ||
    Number(protein) !== recipe.perServing.proteinG;
  const cell = "rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px]";
  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
      <div className="flex items-center gap-2">
        <input
          aria-label="Snack name"
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
          className={`flex-1 ${cell} text-xs font-semibold`}
        />
        <button
          type="button"
          aria-label={`Delete ${recipe.name}`}
          onClick={async () =>
            (await confirm({
              title: "Delete this snack option?",
              body: `"${recipe.name}" will be removed from your options. Days you already logged keep their values.`,
              confirmLabel: "Delete",
            })) && m.remove.mutate(recipe.id)
          }
          className="p-1 text-slate-400 hover:text-rose-600"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="grid grid-cols-12 gap-1.5">
        <input
          aria-label="Ingredients / portion"
          value={detail}
          maxLength={500}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="Ingredients"
          className={`col-span-6 ${cell}`}
        />
        <input
          aria-label="kcal"
          type="number"
          min={0}
          value={kcal}
          onChange={(e) => setKcal(e.target.value)}
          className={`col-span-3 ${cell} text-right tabular-nums`}
        />
        <input
          aria-label="Protein grams"
          type="number"
          min={0}
          step={0.5}
          value={protein}
          onChange={(e) => setProtein(e.target.value)}
          className={`col-span-3 ${cell} text-right tabular-nums`}
        />
      </div>
      {changed && (
        <div className="flex justify-end">
          <Button
            size="xs"
            loading={m.update.isPending}
            disabled={!name.trim()}
            onClick={() =>
              m.update.mutate({
                id: recipe.id,
                kind,
                name: name.trim(),
                description: detail.trim(),
                kcal: Number(kcal) || 0,
                proteinG: Number(protein) || 0,
              })
            }
          >
            Save
          </Button>
        </div>
      )}
    </div>
  );
}

function AddSnackForm() {
  const m = useSnackMutations();
  const [kind, setKind] = useState<Kind>("sweet");
  const [name, setName] = useState("");
  const [detail, setDetail] = useState("");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const cell = "rounded-xl border border-slate-200 px-3 py-2 text-xs";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    m.create.mutate(
      { kind, name: name.trim(), description: detail.trim(), kcal: Number(kcal) || 0, proteinG: Number(protein) || 0 },
      { onSuccess: () => (setName(""), setDetail(""), setKcal(""), setProtein("")) },
    );
  };

  return (
    <form onSubmit={submit} className="space-y-3 border-t border-slate-100 pt-4">
      <p className="text-xs font-semibold text-slate-700">Add Custom Snack Option</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
        <select
          aria-label="Snack type"
          value={kind}
          onChange={(e) => setKind(e.target.value as Kind)}
          className={`sm:col-span-2 ${cell} bg-white font-medium`}
        >
          <option value="sweet">Sweet</option>
          <option value="salty">Salty</option>
        </select>
        <input
          aria-label="Snack name"
          placeholder="Snack name"
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`sm:col-span-3 ${cell}`}
        />
        <input
          aria-label="Ingredients / portion"
          placeholder="Ingredients / portion"
          maxLength={500}
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          className={`sm:col-span-3 ${cell}`}
        />
        <input
          aria-label="kcal"
          type="number"
          min={0}
          placeholder="kcal"
          required
          value={kcal}
          onChange={(e) => setKcal(e.target.value)}
          className={`sm:col-span-1 ${cell} tabular-nums`}
        />
        <input
          aria-label="Protein grams"
          type="number"
          min={0}
          step={0.5}
          placeholder="P (g)"
          required
          value={protein}
          onChange={(e) => setProtein(e.target.value)}
          className={`sm:col-span-1 ${cell} tabular-nums`}
        />
        <Button
          type="submit"
          size="sm"
          className="sm:col-span-2"
          loading={m.create.isPending}
          disabled={!name.trim() || kcal === ""}
        >
          Add Snack
        </Button>
      </div>
    </form>
  );
}
