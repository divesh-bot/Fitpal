"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "@/services/api";
import { qk } from "@/services/queries";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { FoodPicker } from "@/features/food/FoodPicker";
import { macrosForAmount, sumMacros } from "@/lib/nutrition";
import { WEEKDAY_LONG } from "@/lib/dates";
import { fmt1 } from "@/lib/format";
import type { DietType, Food, Ingredient, IngredientInput, MealSlot, Plan, PlanMeal } from "@/types/api";

/**
 * Editor rows:
 *  - "values": explicit values (existing lines or manual rows). Unchanged
 *    existing lines are sent back EXACTLY as stored, keeping their food link.
 *  - "food": added from the food list; the server recalculates from the food.
 */
type Row =
  | {
      key: string;
      kind: "values";
      linkedFoodItemId: string | null;
      name: string;
      qtyLabel: string;
      quantity: number | null;
      unit: string | null;
      kcal: string;
      proteinG: string;
      carbsG: number | null;
      fatG: number | null;
      dietType: DietType;
    }
  | { key: string; kind: "food"; food: Food; amount: string; name: string };

const key = () => crypto.randomUUID();

const fromIngredient = (i: Ingredient): Row => ({
  key: key(),
  kind: "values",
  linkedFoodItemId: i.foodItemId,
  name: i.name,
  qtyLabel: i.qtyLabel ?? "",
  quantity: i.quantity,
  unit: i.unit,
  kcal: String(i.kcal),
  proteinG: String(i.proteinG),
  carbsG: i.carbsG,
  fatG: i.fatG,
  dietType: i.dietType,
});

function rowMacros(r: Row) {
  if (r.kind === "food") return macrosForAmount(r.food, Number(r.amount) || 0);
  return { kcal: Number(r.kcal) || 0, proteinG: Number(r.proteinG) || 0, carbsG: r.carbsG, fatG: r.fatG };
}

function toInput(r: Row): IngredientInput {
  if (r.kind === "food") return { foodItemId: r.food.id, amount: Number(r.amount), name: r.name.trim() || r.food.name };
  return {
    ...(r.linkedFoodItemId ? { linkedFoodItemId: r.linkedFoodItemId } : {}),
    name: r.name.trim(),
    qtyLabel: r.qtyLabel.trim() || undefined,
    quantity: r.quantity,
    unit: r.unit,
    kcal: Number(r.kcal) || 0,
    proteinG: Number(r.proteinG) || 0,
    carbsG: r.carbsG,
    fatG: r.fatG,
    dietType: r.dietType,
  };
}

const looksNonVeg = (r: Row) =>
  r.kind === "food"
    ? r.food.dietType !== "veg"
    : r.dietType !== "veg" || /\b(chicken|mutton|fish|prawns?|eggs?|omelet(te)?)\b/i.test(r.name);

export function MealEditor({
  weekday,
  slot,
  meal,
  isStrictVeg,
  onDone,
}: {
  weekday: number;
  slot: MealSlot;
  meal: PlanMeal | null;
  isStrictVeg: boolean;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [title, setTitle] = useState(meal?.title ?? "New Meal");
  const [rows, setRows] = useState<Row[]>(() => (meal?.ingredients ?? []).map(fromIngredient));
  const [dirty, setDirty] = useState(meal === null);
  const [picked, setPicked] = useState<Food | null>(null);
  const [pickAmount, setPickAmount] = useState("");
  const [copyTarget, setCopyTarget] = useState(weekday === 7 ? "6" : String(weekday + 1));

  const update = (
    k: string,
    patch: Partial<Extract<Row, { kind: "values" }>> & Partial<Extract<Row, { kind: "food" }>>,
  ) => {
    setDirty(true);
    setRows((rs) =>
      rs.map((r) => {
        if (r.key !== k) return r;
        // Editing kcal/protein by hand makes carbs/fat unknown rather than silently stale.
        if (r.kind === "values" && (patch.kcal !== undefined || patch.proteinG !== undefined)) {
          return { ...r, ...patch, carbsG: null, fatG: null } as Row;
        }
        return { ...r, ...patch } as Row;
      }),
    );
  };

  const onSaved = (plan: Plan) => {
    qc.setQueryData(qk.plan, plan);
    qc.invalidateQueries({ queryKey: qk.allDays });
  };

  const save = useMutation({
    mutationFn: () =>
      api<Plan>("PUT", `/meal-plans/active/days/${weekday}/meals/${slot}`, {
        title: title.trim(),
        ingredients: rows.map(toInput),
      }),
    onSuccess: (plan) => {
      onSaved(plan);
      toast(`Saved "${title.trim()}" for every ${WEEKDAY_LONG[weekday - 1]}`);
      onDone();
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  const copy = useMutation({
    mutationFn: () =>
      api<{ copied: number; plan: Plan }>("POST", `/meal-plans/active/days/${weekday}/meals/${slot}/copy`, {
        toWeekdays: copyTarget === "ALL" ? [1, 2, 3, 4, 5, 6, 7] : [Number(copyTarget)],
      }),
    onSuccess: (r) => {
      onSaved(r.plan);
      toast(
        copyTarget === "ALL"
          ? `Copied "${title}" to all 7 days`
          : `Copied "${title}" to ${WEEKDAY_LONG[Number(copyTarget) - 1]}`,
      );
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  const clear = useMutation({
    mutationFn: () => api<Plan>("DELETE", `/meal-plans/active/days/${weekday}/meals/${slot}`),
    onSuccess: (plan) => {
      onSaved(plan);
      toast("Meal cleared", "neutral");
      onDone();
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  const addPicked = () => {
    if (!picked) return;
    const amount = Number(pickAmount) || picked.defaultAmount;
    setRows((rs) => [...rs, { key: key(), kind: "food", food: picked, amount: String(amount), name: picked.name }]);
    setDirty(true);
    toast(`Added ${picked.name} (${macrosForAmount(picked, amount).kcal} kcal) — save to keep it`, "neutral");
  };

  const totals = sumMacros(rows.map(rowMacros));
  const invalid = !title.trim() || rows.some((r) => !r.name.trim() || (r.kind === "food" && !(Number(r.amount) > 0)));
  const vegWarning = isStrictVeg && rows.some(looksNonVeg);
  const busy = save.isPending || copy.isPending || clear.isPending;

  return (
    <div className="space-y-4 border-t border-emerald-100 bg-slate-50/70 px-4 pt-3 pb-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label htmlFor={`title-${weekday}-${slot}`} className="shrink-0 text-xs font-semibold text-slate-600">
          Meal Name:
        </label>
        <input
          id={`title-${weekday}-${slot}`}
          value={title}
          maxLength={120}
          onChange={(e) => (setTitle(e.target.value), setDirty(true))}
          className={`${inputClass} font-semibold`}
        />
      </div>

      {vegWarning && (
        <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {WEEKDAY_LONG[weekday - 1]} is strictly vegetarian, so egg or non-veg items can&apos;t be saved here.
        </p>
      )}

      <div className="space-y-2">
        <div className="hidden grid-cols-12 gap-1.5 px-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase sm:grid">
          <span className="col-span-5">Ingredient</span>
          <span className="col-span-2">Qty</span>
          <span className="col-span-2 text-right">kcal</span>
          <span className="col-span-2 text-right">Protein (g)</span>
          <span className="col-span-1" />
        </div>
        {rows.length === 0 && <p className="py-1 text-xs text-slate-400 italic">No ingredients. Add one below.</p>}
        {rows.map((r) => {
          const m = rowMacros(r);
          const cell = "rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs";
          return (
            <div key={r.key} className="grid grid-cols-12 items-center gap-1.5">
              <input
                aria-label="Ingredient name"
                value={r.name}
                onChange={(e) => update(r.key, { name: e.target.value })}
                className={`col-span-12 sm:col-span-5 ${cell}`}
              />
              {r.kind === "food" ? (
                <div className="col-span-4 flex items-center gap-1 sm:col-span-2">
                  <input
                    aria-label="Amount"
                    type="number"
                    min={0}
                    step={r.food.basis === "per_unit" ? 1 : 5}
                    value={r.amount}
                    onChange={(e) => update(r.key, { amount: e.target.value })}
                    className={`w-full ${cell} tabular-nums`}
                  />
                  <span className="text-[11px] text-slate-500">{r.food.unitLabel}</span>
                </div>
              ) : (
                <input
                  aria-label="Quantity"
                  value={r.qtyLabel}
                  maxLength={40}
                  onChange={(e) => update(r.key, { qtyLabel: e.target.value })}
                  className={`col-span-4 sm:col-span-2 ${cell}`}
                />
              )}
              {r.kind === "food" ? (
                <>
                  <span
                    className="col-span-3 text-right text-xs font-medium text-slate-700 tabular-nums sm:col-span-2"
                    title="Calculated from the food list"
                  >
                    {m.kcal}
                  </span>
                  <span className="col-span-3 text-right text-xs font-medium text-teal-700 tabular-nums sm:col-span-2">
                    {fmt1(m.proteinG)}
                  </span>
                </>
              ) : (
                <>
                  <input
                    aria-label="kcal"
                    type="number"
                    min={0}
                    value={r.kcal}
                    onChange={(e) => update(r.key, { kcal: e.target.value })}
                    className={`col-span-3 sm:col-span-2 ${cell} text-right tabular-nums`}
                  />
                  <input
                    aria-label="Protein grams"
                    type="number"
                    min={0}
                    step={0.5}
                    value={r.proteinG}
                    onChange={(e) => update(r.key, { proteinG: e.target.value })}
                    className={`col-span-3 sm:col-span-2 ${cell} text-right tabular-nums`}
                  />
                </>
              )}
              <button
                type="button"
                aria-label={`Remove ${r.name}`}
                onClick={() => (setRows((rs) => rs.filter((x) => x.key !== r.key)), setDirty(true))}
                className="col-span-2 flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 sm:col-span-1"
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
          );
        })}
        <p className="px-1 text-right text-xs font-semibold text-slate-700 tabular-nums">
          Total: {totals.kcal} kcal · <span className="text-teal-700">{fmt1(totals.proteinG)}g P</span>
        </p>
      </div>

      <div className="space-y-2 rounded-xl border border-slate-200/80 bg-white p-3">
        <p className="text-[11px] font-semibold text-slate-600">
          + Quick-Add from Food Database (auto-calculates kcal &amp; protein)
        </p>
        <FoodPicker
          selectedId={picked?.id}
          onPick={(f) => (setPicked(f), setPickAmount(String(f.defaultAmount)))}
          height="max-h-40"
        />
        {picked && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">{picked.name}</span>
            <input
              aria-label="Amount to add"
              type="number"
              min={0}
              value={pickAmount}
              onChange={(e) => setPickAmount(e.target.value)}
              className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-xs tabular-nums"
            />
            <span className="text-xs text-slate-500">
              {picked.unitLabel} → {macrosForAmount(picked, Number(pickAmount) || 0).kcal} kcal ·{" "}
              {fmt1(macrosForAmount(picked, Number(pickAmount) || 0).proteinG)}g P
            </span>
            <Button size="sm" onClick={addPicked} disabled={!(Number(pickAmount) > 0)}>
              + Add Food
            </Button>
          </div>
        )}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => (
              setRows((rs) => [
                ...rs,
                {
                  key: key(),
                  kind: "values",
                  linkedFoodItemId: null,
                  name: "New ingredient",
                  qtyLabel: "100 g",
                  quantity: null,
                  unit: null,
                  kcal: "0",
                  proteinG: "0",
                  carbsG: null,
                  fatG: null,
                  dietType: "veg",
                },
              ]),
              setDirty(true)
            )}
            className="text-xs font-semibold text-slate-600 hover:text-emerald-700"
          >
            + Add Blank Manual Row
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70 pt-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <select
            aria-label="Copy to day"
            value={copyTarget}
            onChange={(e) => setCopyTarget(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
          >
            {WEEKDAY_LONG.map((d, i) =>
              i + 1 === weekday ? null : (
                <option key={d} value={i + 1}>
                  {d}
                </option>
              ),
            )}
            <option value="ALL">All 7 Days</option>
          </select>
          <Button
            size="sm"
            variant="dark"
            onClick={() => copy.mutate()}
            loading={copy.isPending}
            disabled={busy || dirty || !meal}
            title={dirty ? "Save your changes first" : undefined}
          >
            Copy Meal
          </Button>
          {dirty && meal && <span className="text-[11px] text-slate-400">Save first to copy</span>}
        </div>
        <div className="flex items-center gap-2">
          {meal && (
            <Button
              size="sm"
              variant="danger"
              disabled={busy}
              loading={clear.isPending}
              onClick={async () => {
                if (
                  await confirm({
                    title: "Clear this meal?",
                    body: `Removes "${meal.title}" from every ${WEEKDAY_LONG[weekday - 1]} in your plan. Food you already logged is kept.`,
                    confirmLabel: "Clear meal",
                  })
                )
                  clear.mutate();
              }}
            >
              Clear Meal
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={onDone} disabled={busy}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => save.mutate()} loading={save.isPending} disabled={busy || invalid || !dirty}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
