"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { FoodPicker } from "@/features/food/FoodPicker";
import { macrosForAmount } from "@/lib/nutrition";
import { fmt1, maybe } from "@/lib/format";
import { formatShort } from "@/lib/dates";
import type { DaySummary, EntrySlot, Food } from "@/types/api";
import type { useDayActions } from "./useDayActions";

const SLOTS: { value: EntrySlot; label: string }[] = [
  { value: "other", label: "Other / extra" },
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
  { value: "post_workout", label: "Post-workout" },
];
const slotLabel = (s: EntrySlot) => SLOTS.find((x) => x.value === s)?.label ?? s;

/** Log extra food: from the food list (by amount) or quick manual entry; lists the day's extra foods. */
export function LogFoodCard({
  day,
  actions,
  readOnly,
}: {
  day: DaySummary;
  actions: ReturnType<typeof useDayActions>;
  readOnly: boolean;
}) {
  const [mode, setMode] = useState<"list" | "manual">("list");
  const confirm = useConfirm();
  const extras = day.entries.filter((e) => e.source !== "plan_meal" && e.source !== "snack");

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="mb-1 text-base font-semibold text-slate-900">Log Extra Food</h3>
          <p className="text-xs text-slate-500">
            Log any extra food or beverage for{" "}
            <span className="font-medium text-slate-700">{formatShort(day.date)}</span>.
          </p>
        </div>
        <div
          className="inline-flex self-start rounded-xl border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold"
          role="tablist"
        >
          {(["list", "manual"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`rounded-lg px-3 py-1.5 ${mode === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
            >
              {m === "list" ? "From food list" : "Quick add"}
            </button>
          ))}
        </div>
      </div>

      {readOnly ? (
        <p className="mb-4 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
          You can view future days, but food can only be logged for today or earlier.
        </p>
      ) : mode === "list" ? (
        <FromListForm actions={actions} />
      ) : (
        <ManualForm actions={actions} />
      )}

      <div className="space-y-2">
        {extras.length === 0 ? (
          <p className="py-1 text-xs text-slate-400 italic">No extra foods logged for {formatShort(day.date)}.</p>
        ) : (
          extras.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">{e.name}</p>
                <p className="text-[11px] text-slate-500">
                  {slotLabel(e.mealSlot)}
                  {e.qtyLabel ? ` · ${e.qtyLabel}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-xs font-semibold text-slate-700 tabular-nums">{e.kcal} kcal</span>
                <span className="text-xs font-semibold text-teal-600 tabular-nums">{maybe(e.proteinG)}g P</span>
                <button
                  type="button"
                  aria-label={`Remove ${e.name}`}
                  disabled={readOnly || actions.deleteEntry.isPending}
                  onClick={async () =>
                    (await confirm({
                      title: "Remove this food?",
                      body: `"${e.name}" (${e.kcal} kcal) will be removed from ${formatShort(day.date)}.`,
                      confirmLabel: "Remove",
                    })) && actions.deleteEntry.mutate(e.id)
                  }
                  className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-50"
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
          ))
        )}
      </div>
    </div>
  );
}

function SlotSelect({ value, onChange }: { value: EntrySlot; onChange: (s: EntrySlot) => void }) {
  return (
    <select
      aria-label="Meal"
      value={value}
      onChange={(e) => onChange(e.target.value as EntrySlot)}
      className={inputClass}
    >
      {SLOTS.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  );
}

function FromListForm({ actions }: { actions: ReturnType<typeof useDayActions> }) {
  const [food, setFood] = useState<Food | null>(null);
  const [amount, setAmount] = useState("");
  const [slot, setSlot] = useState<EntrySlot>("other");
  const amt = Number(amount);
  const preview = food && amt > 0 ? macrosForAmount(food, amt) : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!food || !(amt > 0)) return;
    actions.logFood.mutate(
      { source: "food_item", mealSlot: slot, foodItemId: food.id, amount: amt },
      { onSuccess: () => (setFood(null), setAmount("")) },
    );
  };

  return (
    <form onSubmit={submit} className="mb-4 space-y-2.5">
      <FoodPicker
        selectedId={food?.id}
        onPick={(f) => (setFood(f), setAmount(String(f.defaultAmount)))}
        height="max-h-44"
      />
      {food && (
        <div className="grid grid-cols-1 items-end gap-2.5 sm:grid-cols-12">
          <div className="sm:col-span-4">
            <p className="mb-1 text-xs font-semibold text-slate-600">{food.name}</p>
            {food.isExcluded && <p className="text-[11px] text-rose-600">This is on your excluded foods list.</p>}
          </div>
          <div className="flex items-center gap-1.5 sm:col-span-3">
            <input
              aria-label="Amount"
              type="number"
              min={0}
              step={food.basis === "per_unit" ? 1 : 5}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`${inputClass} tabular-nums`}
            />
            <span className="text-xs text-slate-500">{food.unitLabel}</span>
          </div>
          <div className="sm:col-span-3">
            <SlotSelect value={slot} onChange={setSlot} />
          </div>
          <Button type="submit" className="sm:col-span-2" loading={actions.logFood.isPending} disabled={!preview}>
            Add
          </Button>
          {preview && (
            <p className="text-xs text-slate-500 tabular-nums sm:col-span-12">
              {preview.kcal} kcal · {fmt1(preview.proteinG)}g protein · {maybe(preview.carbsG)}g carbs ·{" "}
              {maybe(preview.fatG)}g fat
            </p>
          )}
        </div>
      )}
    </form>
  );
}

function ManualForm({ actions }: { actions: ReturnType<typeof useDayActions> }) {
  const [name, setName] = useState("");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [slot, setSlot] = useState<EntrySlot>("other");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    actions.logFood.mutate(
      { source: "manual", mealSlot: slot, name: name.trim(), kcal: Number(kcal) || 0, proteinG: Number(protein) || 0 },
      { onSuccess: () => (setName(""), setKcal(""), setProtein("")) },
    );
  };

  return (
    <form onSubmit={submit} className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-12">
      <input
        aria-label="Food name"
        placeholder="e.g., Extra Greek yogurt 50g"
        required
        maxLength={160}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={`sm:col-span-4 ${inputClass}`}
      />
      <input
        aria-label="kcal"
        type="number"
        min={0}
        placeholder="kcal"
        required
        value={kcal}
        onChange={(e) => setKcal(e.target.value)}
        className={`sm:col-span-2 ${inputClass} tabular-nums`}
      />
      <input
        aria-label="Protein grams"
        type="number"
        min={0}
        step={0.5}
        placeholder="Protein (g)"
        value={protein}
        onChange={(e) => setProtein(e.target.value)}
        className={`sm:col-span-2 ${inputClass} tabular-nums`}
      />
      <div className="sm:col-span-2">
        <SlotSelect value={slot} onChange={setSlot} />
      </div>
      <Button
        type="submit"
        className="sm:col-span-2"
        loading={actions.logFood.isPending}
        disabled={!name.trim() || kcal === ""}
      >
        Add
      </Button>
    </form>
  );
}
