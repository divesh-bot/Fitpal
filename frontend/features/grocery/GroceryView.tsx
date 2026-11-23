"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "@/services/api";
import { qk } from "@/services/queries";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/Card";
import { inputClass } from "@/components/ui/Field";
import { ErrorState, LoadingBlock } from "@/components/ui/Feedback";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { formatLong } from "@/lib/dates";
import type { GroceryItem, GroceryList } from "@/types/api";

export function GroceryView() {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const list = useQuery({
    queryKey: qk.grocery,
    queryFn: ({ signal }) => api<GroceryList>("GET", "/grocery-lists/current", undefined, signal),
  });
  const setList = (l: GroceryList) => qc.setQueryData(qk.grocery, l);
  const refresh = () => qc.invalidateQueries({ queryKey: qk.grocery });
  const onError = (e: unknown) => toast(errorMessage(e), "error");

  const generate = useMutation({
    mutationFn: () => api<GroceryList>("POST", "/grocery-lists/generate", {}),
    onSuccess: (l) => (setList(l), toast(`Generated ${l.total} items from your meal plan`)),
    onError,
  });
  const uncheckAll = useMutation({
    mutationFn: () => api<GroceryList>("POST", "/grocery-lists/current/uncheck-all", {}),
    onSuccess: (l) => (setList(l), toast("All grocery items unchecked", "neutral")),
    onError,
  });
  const add = useMutation({
    mutationFn: (v: { name: string; quantityLabel: string }) =>
      api<GroceryList>("POST", "/grocery-lists/current/items", v),
    onSuccess: (l, v) => (setList(l), toast(`Added "${v.name}"`)),
    onError,
  });
  const update = useMutation({
    mutationFn: (v: { id: string; patch: Partial<Pick<GroceryItem, "name" | "quantityLabel" | "isPurchased">> }) =>
      api<GroceryItem>("PUT", `/grocery-items/${v.id}`, v.patch),
    onSuccess: refresh,
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api("DELETE", `/grocery-items/${id}`),
    onSuccess: () => (refresh(), toast("Item removed", "neutral")),
    onError,
  });

  const l = list.data;
  const pct = l && l.total ? Math.round((l.purchased / l.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Weekly Grocery List"
        subtitle="All essentials for your 7-day Indian nutrition plan."
        actions={
          <>
            <Button
              size="sm"
              variant="dark"
              loading={generate.isPending}
              disabled={!l}
              onClick={async () =>
                (await confirm({
                  title: "Generate a new list from your meal plan?",
                  body: "Adds up a week of ingredients from your current plan. This replaces the current list; items you added yourself that aren't bought yet are kept.",
                  confirmLabel: "Generate",
                  destructive: false,
                })) && generate.mutate()
              }
            >
              Generate from Plan
            </Button>
            <Button
              size="sm"
              variant="secondary"
              loading={uncheckAll.isPending}
              disabled={!l || l.purchased === 0}
              onClick={() => uncheckAll.mutate()}
            >
              Uncheck All
            </Button>
          </>
        }
      />

      {list.isLoading ? (
        <LoadingBlock label="Loading your grocery list…" />
      ) : list.isError ? (
        <ErrorState message={errorMessage(list.error)} onRetry={() => list.refetch()} />
      ) : (
        <>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-800">Shopping Progress</span>
              <span className="text-sm font-bold text-emerald-700 tabular-nums">
                {l!.purchased} / {l!.total} bought
              </span>
            </div>
            <div
              className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-label="Shopping progress"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              {l!.name}
              {l!.generatedAt
                ? ` · generated ${formatLong(l!.generatedAt.slice(0, 10))}. Amounts are as eaten (e.g. rice is cooked weight), so adjust what you buy.`
                : ""}
            </p>
          </div>

          <AddItemForm pending={add.isPending} onAdd={(v, reset) => add.mutate(v, { onSuccess: reset })} />

          {l!.items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
              Your list is empty. Use <strong>Generate from Plan</strong> or add items above.
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {l!.items.map((item) => (
                <GroceryRow
                  key={`${item.id}-${item.name}-${item.quantityLabel}`}
                  item={item}
                  busy={update.isPending || remove.isPending}
                  onToggle={() => update.mutate({ id: item.id, patch: { isPurchased: !item.isPurchased } })}
                  onSave={(patch) => update.mutate({ id: item.id, patch })}
                  onDelete={async () =>
                    (await confirm({
                      title: "Remove this item?",
                      body: `"${item.name}" will be removed from your list.`,
                      confirmLabel: "Remove",
                    })) && remove.mutate(item.id)
                  }
                />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function AddItemForm({
  pending,
  onAdd,
}: {
  pending: boolean;
  onAdd: (v: { name: string; quantityLabel: string }, reset: () => void) => void;
}) {
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onAdd({ name: name.trim(), quantityLabel: qty.trim() || "As needed" }, () => (setName(""), setQty("")));
  };
  return (
    <form
      onSubmit={submit}
      className="grid grid-cols-1 gap-2.5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] sm:grid-cols-12"
      aria-label="Add grocery item"
    >
      <input
        aria-label="Item name"
        placeholder="Add extra item (e.g., Green chillies, Coriander)"
        required
        maxLength={120}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={`sm:col-span-6 ${inputClass}`}
      />
      <input
        aria-label="Quantity"
        placeholder="Quantity (e.g., 100 g)"
        maxLength={60}
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        className={`sm:col-span-4 ${inputClass}`}
      />
      <Button type="submit" className="sm:col-span-2" loading={pending} disabled={!name.trim()}>
        Add Item
      </Button>
    </form>
  );
}

function GroceryRow({
  item,
  busy,
  onToggle,
  onSave,
  onDelete,
}: {
  item: GroceryItem;
  busy: boolean;
  onToggle: () => void;
  onSave: (p: { name: string; quantityLabel: string | null }) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [qty, setQty] = useState(item.quantityLabel ?? "");

  if (editing) {
    return (
      <li className="space-y-2 rounded-2xl border border-emerald-300 bg-white p-3.5">
        <input
          aria-label="Item name"
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
        <input
          aria-label="Quantity"
          value={qty}
          maxLength={60}
          onChange={(e) => setQty(e.target.value)}
          className={inputClass}
        />
        <div className="flex justify-end gap-2">
          <Button
            size="xs"
            variant="secondary"
            onClick={() => (setEditing(false), setName(item.name), setQty(item.quantityLabel ?? ""))}
          >
            Cancel
          </Button>
          <Button
            size="xs"
            disabled={!name.trim()}
            onClick={() => (onSave({ name: name.trim(), quantityLabel: qty.trim() || null }), setEditing(false))}
          >
            Save
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li
      className={`flex items-center justify-between gap-3 rounded-2xl border p-3.5 transition-all ${item.isPurchased ? "border-slate-200/70 bg-slate-50" : "border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)]"}`}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={item.isPurchased}
        disabled={busy}
        onClick={onToggle}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${item.isPurchased ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white"}`}
          aria-hidden="true"
        >
          {item.isPurchased && (
            <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </span>
        <span className="min-w-0">
          <span
            className={`block truncate text-sm font-medium ${item.isPurchased ? "text-slate-400 line-through" : "text-slate-900"}`}
          >
            {item.name}
          </span>
          {item.quantityLabel && <span className="block text-xs text-slate-500">{item.quantityLabel}</span>}
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          aria-label={`Edit ${item.name}`}
          onClick={() => setEditing(true)}
          className="rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          Edit
        </button>
        <button
          type="button"
          aria-label={`Remove ${item.name}`}
          onClick={onDelete}
          className="p-1 text-slate-300 transition-colors hover:text-rose-600"
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
    </li>
  );
}
