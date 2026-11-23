"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "@/services/api";
import { qk, useRecipes } from "@/services/queries";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { ErrorState, LoadingBlock } from "@/components/ui/Feedback";
import { FoodPicker } from "@/features/food/FoodPicker";
import { basisLabel, macrosForAmount, newRequestId, sumMacros } from "@/lib/nutrition";
import { todayISO, WEEKDAY_LONG } from "@/lib/dates";
import { fmt1, maybe } from "@/lib/format";
import type { Food, FoodEntry, Plan, Recipe } from "@/types/api";
import {
  foodRow,
  manualRow,
  rowFromIngredient,
  rowMacros,
  rowName,
  rowQty,
  toIngredientInput,
  type BuilderRow,
} from "./builderRows";

type Target = "recipe" | "post_workout" | "breakfast" | "lunch" | "dinner" | "snack_sweet" | "snack_salty";
const TARGETS: { value: Target; label: string }[] = [
  { value: "recipe", label: "My saved recipes" },
  { value: "lunch", label: "Plan: Lunch" },
  { value: "dinner", label: "Plan: Dinner" },
  { value: "breakfast", label: "Plan: Breakfast" },
  { value: "post_workout", label: "Plan: Post-Workout" },
  { value: "snack_sweet", label: "Sweet snack option" },
  { value: "snack_salty", label: "Salty snack option" },
];
const isPlanSlot = (t: Target): t is "post_workout" | "breakfast" | "lunch" | "dinner" =>
  ["post_workout", "breakfast", "lunch", "dinner"].includes(t);

export function BuilderPanel() {
  const qc = useQueryClient();
  const toast = useToast();
  const [selected, setSelected] = useState<Food | null>(null);
  const [amount, setAmount] = useState("");
  const [rows, setRows] = useState<BuilderRow[]>([]);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);

  const preview = selected ? macrosForAmount(selected, Number(amount) || 0) : null;
  const totals = sumMacros(rows.map(rowMacros));

  const pick = (f: Food) => {
    setSelected(f);
    setAmount(String(f.defaultAmount));
  };
  const addSelected = () => {
    if (!selected || !(Number(amount) > 0)) return;
    setRows((rs) => [...rs, foodRow(selected, Number(amount))]);
  };
  const clear = () => {
    setRows([]);
    setEditingRecipe(null);
  };
  const loadRecipe = (r: Recipe) => {
    setRows(r.ingredients.map(rowFromIngredient));
    setEditingRecipe(r);
    toast(`Loaded "${r.name}" into the builder`, "neutral");
  };

  // Log the builder's totals straight to today's food log.
  const logToday = useMutation({
    mutationFn: (name: string) =>
      api<FoodEntry>("POST", "/food-entries", {
        source: "manual",
        date: todayISO(),
        mealSlot: "other",
        name,
        qtyLabel: `${rows.length} ingredient${rows.length === 1 ? "" : "s"}`,
        kcal: totals.kcal,
        proteinG: totals.proteinG,
        carbsG: totals.carbsComplete ? totals.carbsG : null,
        fatG: totals.fatComplete ? totals.fatG : null,
        clientRequestId: newRequestId(),
      }),
    onSuccess: (e) => {
      qc.invalidateQueries({ queryKey: qk.allDays });
      toast(`Logged "${e.name}" (${e.kcal} kcal) to today`);
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Lookup */}
        <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] lg:col-span-5">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Indian &amp; Fitness Food Lookup</h3>
            <p className="text-xs text-slate-500">40+ staples pre-loaded. Search, set amount, and add to builder.</p>
          </div>
          <FoodPicker selectedId={selected?.id} onPick={pick} height="max-h-52" />

          <div className="space-y-3 rounded-xl border border-emerald-200/70 bg-emerald-50/60 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold tracking-wider text-emerald-700 uppercase">Selected Food</p>
                <p className="text-sm font-bold text-slate-900">{selected?.name ?? "—"}</p>
              </div>
              {selected && (
                <span className="rounded-md border border-emerald-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  {basisLabel(selected)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                aria-label="Amount"
                type="number"
                min={0}
                step={selected?.basis === "per_unit" ? 1 : 5}
                value={amount}
                disabled={!selected}
                onChange={(e) => setAmount(e.target.value)}
                className="w-24 rounded-xl border border-emerald-300 bg-white px-3 py-2 text-sm font-bold tabular-nums focus:ring-2 focus:ring-emerald-500/30 focus:outline-none disabled:opacity-60"
              />
              <span className="text-xs font-medium text-slate-600">
                {selected ? (selected.basis === "per_unit" ? `${selected.unitLabel}(s)` : selected.unitLabel) : ""}
              </span>
              <Button size="sm" className="ml-auto" disabled={!selected || !(Number(amount) > 0)} onClick={addSelected}>
                + Add to Builder
              </Button>
            </div>
            <MacroGrid macros={preview} />
          </div>

          <ManualIngredientForm onAdd={(r) => setRows((rs) => [...rs, r])} />
        </div>

        {/* Builder */}
        <div className="flex flex-col justify-between gap-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] lg:col-span-7">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Meal Builder</h3>
                <p className="text-xs text-slate-500">
                  {editingRecipe ? (
                    <>
                      Editing saved recipe <strong>{editingRecipe.name}</strong>
                    </>
                  ) : (
                    "Combine foods, tweak amounts, and save into your plan, recipes or snacks."
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={clear}
                disabled={rows.length === 0 && !editingRecipe}
                className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
              >
                Clear
              </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-100">
              <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
                {rows.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    Add foods from the left panel to build a meal and calculate exact calories &amp; macros.
                  </div>
                ) : (
                  rows.map((r) => {
                    const m = rowMacros(r);
                    return (
                      <div
                        key={r.key}
                        className="flex items-center justify-between gap-2 bg-white px-3.5 py-2.5 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-slate-800">{rowName(r)}</p>
                          <div className="mt-0.5 flex items-center gap-2">
                            {r.kind === "food" ? (
                              <>
                                <input
                                  aria-label={`Amount of ${r.food.name}`}
                                  type="number"
                                  min={0}
                                  step={r.food.basis === "per_unit" ? 1 : 5}
                                  value={r.amount}
                                  onChange={(e) =>
                                    setRows((rs) =>
                                      rs.map((x) =>
                                        x.key === r.key && x.kind === "food"
                                          ? { ...x, amount: Math.max(0, Number(e.target.value) || 0) }
                                          : x,
                                      ),
                                    )
                                  }
                                  className="w-16 rounded border border-slate-200 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums"
                                />
                                <span className="text-[11px] text-slate-500">{r.food.unitLabel}</span>
                              </>
                            ) : (
                              <span className="text-[11px] text-slate-500">{rowQty(r)}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-3 tabular-nums">
                          <span className="font-bold text-slate-900">{m.kcal} kcal</span>
                          <span className="font-semibold text-teal-600">{fmt1(m.proteinG)}g P</span>
                          <button
                            type="button"
                            aria-label={`Remove ${rowName(r)}`}
                            onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
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
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div
              className="grid grid-cols-4 gap-2.5 rounded-xl bg-slate-900 p-3.5 text-center text-white tabular-nums"
              aria-label="Builder totals"
            >
              <Total label="Total kcal" value={String(totals.kcal)} />
              <Total label="Protein" value={`${fmt1(totals.proteinG)}g`} accent />
              <Total
                label="Carbs"
                value={totals.carbsG === null ? "—" : `${fmt1(totals.carbsG)}g${totals.carbsComplete ? "" : "+"}`}
              />
              <Total
                label="Fat"
                value={totals.fatG === null ? "—" : `${fmt1(totals.fatG)}g${totals.fatComplete ? "" : "+"}`}
              />
            </div>
            {rows.length > 0 && (!totals.carbsComplete || !totals.fatComplete) && (
              <p className="text-[11px] text-slate-400">
                &ldquo;+&rdquo; / &ldquo;—&rdquo;: some ingredients have no carb or fat values, so those totals are
                incomplete.
              </p>
            )}
          </div>

          <SaveForm
            rows={rows}
            editingRecipe={editingRecipe}
            onSaved={clear}
            logToday={(name) => logToday.mutate(name)}
            logging={logToday.isPending}
          />
        </div>
      </div>

      <MyRecipes onLoad={loadRecipe} />
    </div>
  );
}

function Total({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-[10px] tracking-wider text-slate-400 uppercase">{label}</p>
      <p className={`mt-0.5 text-lg font-bold ${accent ? "text-emerald-400" : ""}`}>{value}</p>
    </div>
  );
}

function MacroGrid({
  macros,
}: {
  macros: { kcal: number; proteinG: number; carbsG: number | null; fatG: number | null } | null;
}) {
  const cell = (label: string, value: string, cls = "text-slate-700") => (
    <div className="rounded-lg bg-white/80 px-1 py-1.5">
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className={`text-xs font-bold ${cls}`}>{value}</p>
    </div>
  );
  return (
    <div className="grid grid-cols-4 gap-2 border-t border-emerald-200/60 pt-2 text-center tabular-nums">
      {cell("Calories", macros ? String(macros.kcal) : "0", "text-slate-900")}
      {cell("Protein", macros ? `${fmt1(macros.proteinG)}g` : "0g", "text-teal-700")}
      {cell("Carbs", macros ? `${maybe(macros.carbsG)}g` : "0g")}
      {cell("Fat", macros ? `${maybe(macros.fatG)}g` : "0g")}
    </div>
  );
}

function ManualIngredientForm({ onAdd }: { onAdd: (r: BuilderRow) => void }) {
  const [v, setV] = useState({ name: "", qty: "", kcal: "", p: "", c: "", f: "" });
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((s) => ({ ...s, [k]: e.target.value }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onAdd(
      manualRow(v.name.trim(), v.qty.trim(), {
        kcal: Number(v.kcal) || 0,
        proteinG: Number(v.p) || 0,
        carbsG: v.c === "" ? null : Number(v.c),
        fatG: v.f === "" ? null : Number(v.f),
      }),
    );
    setV({ name: "", qty: "", kcal: "", p: "", c: "", f: "" });
  };
  const cell = "rounded-lg border border-slate-200 px-3 py-1.5 text-xs";
  return (
    <details className="pt-1">
      <summary className="cursor-pointer text-xs font-semibold text-slate-600 select-none hover:text-slate-900">
        + Add custom manual ingredient
      </summary>
      <form onSubmit={submit} className="mt-3 grid grid-cols-2 gap-2">
        <input
          aria-label="Ingredient name"
          placeholder="Ingredient name"
          required
          maxLength={120}
          value={v.name}
          onChange={set("name")}
          className={`col-span-2 ${cell}`}
        />
        <input
          aria-label="Quantity"
          placeholder="Qty (e.g., 1 bowl)"
          maxLength={40}
          value={v.qty}
          onChange={set("qty")}
          className={cell}
        />
        <input
          aria-label="kcal"
          type="number"
          min={0}
          placeholder="kcal"
          required
          value={v.kcal}
          onChange={set("kcal")}
          className={`${cell} tabular-nums`}
        />
        <input
          aria-label="Protein (g)"
          type="number"
          min={0}
          step={0.5}
          placeholder="Protein (g)"
          required
          value={v.p}
          onChange={set("p")}
          className={`${cell} tabular-nums`}
        />
        <input
          aria-label="Carbs (g, optional)"
          type="number"
          min={0}
          step={0.5}
          placeholder="Carbs (g, opt)"
          value={v.c}
          onChange={set("c")}
          className={`${cell} tabular-nums`}
        />
        <input
          aria-label="Fat (g, optional)"
          type="number"
          min={0}
          step={0.5}
          placeholder="Fat (g, opt)"
          value={v.f}
          onChange={set("f")}
          className={`${cell} tabular-nums`}
        />
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
        >
          Add
        </button>
      </form>
    </details>
  );
}

function SaveForm({
  rows,
  editingRecipe,
  onSaved,
  logToday,
  logging,
}: {
  rows: BuilderRow[];
  editingRecipe: Recipe | null;
  onSaved: () => void;
  logToday: (name: string) => void;
  logging: boolean;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState("");
  const [target, setTarget] = useState<Target>("recipe");
  const [day, setDay] = useState("1");
  const effectiveName = name.trim() || editingRecipe?.name || "";

  const save = useMutation({
    mutationFn: async () => {
      const ingredients = rows.map(toIngredientInput);
      if (isPlanSlot(target)) {
        const firstDay = day === "ALL" ? 1 : Number(day);
        const plan = await api<Plan>("PUT", `/meal-plans/active/days/${firstDay}/meals/${target}`, {
          title: effectiveName,
          ingredients,
        });
        if (day !== "ALL")
          return {
            message: `Saved "${effectiveName}" to ${WEEKDAY_LONG[firstDay - 1]} ${target.replace("_", "-")}`,
            plan,
          };
        try {
          const r = await api<{ plan: Plan }>("POST", `/meal-plans/active/days/1/meals/${target}/copy`, {
            toWeekdays: [2, 3, 4, 5, 6, 7],
          });
          return { message: `Saved "${effectiveName}" to ${target.replace("_", "-")} for all 7 days`, plan: r.plan };
        } catch (e) {
          // Monday was saved; tell the user exactly what happened.
          throw new Error(`Saved to Monday only. Couldn't copy to every day: ${errorMessage(e)}`, { cause: e });
        }
      }
      const category = target === "recipe" ? (editingRecipe?.category ?? "meal") : target;
      const body = { name: effectiveName, category, ingredients };
      const recipe =
        editingRecipe && target === "recipe"
          ? await api<Recipe>("PUT", `/recipes/${editingRecipe.id}`, body)
          : await api<Recipe>("POST", "/recipes", body);
      return {
        message: editingRecipe && target === "recipe" ? `Updated "${recipe.name}"` : `Saved "${recipe.name}"`,
        plan: null,
      };
    },
    onSuccess: ({ message, plan }) => {
      if (plan) qc.setQueryData(qk.plan, plan);
      qc.invalidateQueries({ queryKey: qk.allDays });
      qc.invalidateQueries({ queryKey: qk.allRecipes });
      if (isPlanSlot(target)) qc.invalidateQueries({ queryKey: qk.plan });
      toast(message);
      setName("");
      onSaved();
    },
    onError: (e) => {
      qc.invalidateQueries({ queryKey: qk.plan });
      toast(errorMessage(e), "error");
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (rows.length === 0) return toast("Add at least one food to the Meal Builder first", "warning");
    save.mutate();
  };

  return (
    <form onSubmit={submit} className="space-y-3 border-t border-slate-100 pt-4">
      <h4 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Save or Log This Meal</h4>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-12">
        <input
          aria-label="Meal name"
          placeholder={editingRecipe?.name ?? "Meal name (e.g., Paneer Bhurji Bowl)"}
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`sm:col-span-5 ${inputClass}`}
        />
        <select
          aria-label="Save to"
          value={target}
          onChange={(e) => setTarget(e.target.value as Target)}
          className={`sm:col-span-4 ${inputClass}`}
        >
          {TARGETS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.value === "recipe" && editingRecipe ? "Update saved recipe" : t.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Day"
          value={day}
          onChange={(e) => setDay(e.target.value)}
          disabled={!isPlanSlot(target)}
          className={`sm:col-span-3 ${inputClass}`}
        >
          {WEEKDAY_LONG.map((d, i) => (
            <option key={d} value={i + 1}>
              {d}
            </option>
          ))}
          <option value="ALL">All 7 Days</option>
        </select>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-slate-400">
          {isPlanSlot(target)
            ? "Replaces that meal in your weekly plan."
            : target === "recipe"
              ? "Keeps it in My Recipes for later."
              : "Adds a new snack option on the Today screen."}
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            disabled={rows.length === 0 || !effectiveName}
            loading={logging}
            onClick={() => logToday(effectiveName)}
          >
            Log to Today
          </Button>
          <Button type="submit" loading={save.isPending} disabled={rows.length === 0 || !effectiveName}>
            Save
          </Button>
        </div>
      </div>
    </form>
  );
}

function MyRecipes({ onLoad }: { onLoad: (r: Recipe) => void }) {
  const recipes = useRecipes("meal");
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  const log = useMutation({
    mutationFn: (r: Recipe) =>
      api<FoodEntry>("POST", "/food-entries", {
        source: "recipe",
        date: todayISO(),
        mealSlot: "other",
        recipeId: r.id,
        servings: 1,
        clientRequestId: newRequestId(),
      }),
    onSuccess: (e) => {
      qc.invalidateQueries({ queryKey: qk.allDays });
      toast(`Logged "${e.name}" (${e.kcal} kcal) to today`);
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api("DELETE", `/recipes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.allRecipes });
      toast("Recipe deleted", "neutral");
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <h3 className="text-base font-semibold text-slate-900">My Recipes</h3>
      <p className="mb-4 text-xs text-slate-500">
        Saved meals you can log in one tap or load into the builder to change.
      </p>
      {recipes.isLoading ? (
        <LoadingBlock label="Loading recipes…" />
      ) : recipes.isError ? (
        <ErrorState message={errorMessage(recipes.error)} onRetry={() => recipes.refetch()} />
      ) : recipes.data!.length === 0 ? (
        <p className="text-xs text-slate-400 italic">
          No saved recipes yet. Build a meal above and save it to &ldquo;My saved recipes&rdquo;.
        </p>
      ) : (
        <ul className="space-y-2">
          {recipes.data!.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{r.name}</p>
                <p className="text-[11px] text-slate-500 tabular-nums">
                  {r.ingredients.length} ingredients · {r.perServing.kcal} kcal · {fmt1(r.perServing.proteinG)}g P
                  {r.servings !== 1 ? ` per serving (${r.servings} servings)` : ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Button
                  size="xs"
                  variant="soft"
                  loading={log.isPending && log.variables?.id === r.id}
                  onClick={() => log.mutate(r)}
                >
                  Log today
                </Button>
                <Button size="xs" variant="secondary" onClick={() => onLoad(r)}>
                  Edit
                </Button>
                <Button
                  size="xs"
                  variant="danger"
                  onClick={async () =>
                    (await confirm({
                      title: "Delete this recipe?",
                      body: `"${r.name}" will be deleted. Food you already logged from it keeps its values.`,
                      confirmLabel: "Delete",
                    })) && remove.mutate(r.id)
                  }
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
