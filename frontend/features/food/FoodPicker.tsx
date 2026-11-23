"use client";

import { useDeferredValue, useState } from "react";
import { useFoods } from "@/services/queries";
import { errorMessage } from "@/services/api";
import { basisLabel } from "@/lib/nutrition";
import { inputClass } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Feedback";
import type { Food } from "@/types/api";

/** Searchable food list (shared + the user's own foods), as in the prototype's lookup. */
export function FoodPicker({
  selectedId,
  onPick,
  height = "max-h-60",
}: {
  selectedId?: string | null;
  onPick: (f: Food) => void;
  height?: string;
}) {
  const [q, setQ] = useState("");
  const deferred = useDeferredValue(q.trim());
  const foods = useFoods(deferred);

  return (
    <div className="space-y-2">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search foods (e.g., paneer, soya, oats)…"
        aria-label="Search foods"
        maxLength={60}
        className={inputClass}
      />
      <div
        className={`${height} overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50`}
        role="listbox"
        aria-label="Foods"
      >
        {foods.isLoading && (
          <p className="flex items-center justify-center gap-2 p-3 text-xs text-slate-400">
            <Spinner className="h-3 w-3" /> Loading foods…
          </p>
        )}
        {foods.isError && <p className="p-3 text-center text-xs text-amber-700">{errorMessage(foods.error)}</p>}
        {foods.data?.length === 0 && (
          <p className="p-3 text-center text-xs text-slate-400 italic">No foods match &ldquo;{deferred}&rdquo;.</p>
        )}
        {foods.data?.map((f) => {
          const active = f.id === selectedId;
          return (
            <button
              key={f.id}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => onPick(f)}
              className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs transition-colors ${
                active ? "bg-emerald-50 font-semibold text-emerald-900" : "text-slate-700 hover:bg-white"
              }`}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate">{f.name}</span>
                {!f.isShared && (
                  <span className="shrink-0 rounded bg-slate-200 px-1 text-[9px] font-semibold text-slate-600">
                    MINE
                  </span>
                )}
                {f.dietType !== "veg" && (
                  <span className="shrink-0 rounded bg-amber-100 px-1 text-[9px] font-semibold text-amber-800">
                    {f.dietType === "egg" ? "EGG" : "NON-VEG"}
                  </span>
                )}
                {f.isExcluded && (
                  <span className="shrink-0 rounded bg-rose-100 px-1 text-[9px] font-semibold text-rose-700">
                    EXCLUDED
                  </span>
                )}
              </span>
              <span className="shrink-0 text-[11px] text-slate-400 tabular-nums">
                {Math.round(f.per.kcal)} kcal / {basisLabel(f).replace("per ", "")}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
