"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "@/services/api";
import { qk, useHabits } from "@/services/queries";
import { Button } from "@/components/ui/Button";
import { ErrorState, LoadingBlock } from "@/components/ui/Feedback";
import { inputClass } from "@/components/ui/Field";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import type { Habit } from "@/types/api";

/** Daily habits shown on Today: built-in creatine/workout plus your own. */
export function HabitsCard() {
  const habits = useHabits(true);
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [name, setName] = useState("");
  const refresh = () => {
    qc.invalidateQueries({ queryKey: qk.habits });
    qc.invalidateQueries({ queryKey: qk.allDays });
  };
  const onError = (e: unknown) => toast(errorMessage(e), "error");

  const create = useMutation({
    mutationFn: (n: string) => api<Habit>("POST", "/habits", { name: n }),
    onSuccess: (h) => (refresh(), setName(""), toast(`Added habit "${h.name}"`)),
    onError,
  });
  const update = useMutation({
    mutationFn: (v: { id: string; name?: string; isActive?: boolean }) =>
      api<Habit>("PUT", `/habits/${v.id}`, { name: v.name, isActive: v.isActive }),
    onSuccess: refresh,
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api("DELETE", `/habits/${id}`),
    onSuccess: () => (refresh(), toast("Habit deleted", "neutral")),
    onError,
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) create.mutate(name.trim());
  };

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div>
        <h3 className="text-base font-semibold text-slate-900">Daily Habits</h3>
        <p className="text-xs text-slate-500">
          Shown as toggles on the Today screen. Built-in habits can be hidden but not deleted.
        </p>
      </div>
      {habits.isLoading ? (
        <LoadingBlock />
      ) : habits.isError ? (
        <ErrorState message={errorMessage(habits.error)} onRetry={() => habits.refetch()} />
      ) : (
        <ul className="space-y-2">
          {habits.data!.map((h) => (
            <HabitRow
              key={`${h.id}-${h.name}`}
              habit={h}
              busy={update.isPending || remove.isPending}
              onRename={(n) => update.mutate({ id: h.id, name: n }, { onSuccess: () => toast(`Renamed to "${n}"`) })}
              onToggle={() =>
                update.mutate(
                  { id: h.id, isActive: !h.isActive },
                  {
                    onSuccess: () =>
                      toast(h.isActive ? `"${h.name}" hidden from Today` : `"${h.name}" shown on Today`, "neutral"),
                  },
                )
              }
              onDelete={async () =>
                (await confirm({
                  title: "Delete this habit?",
                  body: `"${h.name}" and its history of ticks will be deleted.`,
                  confirmLabel: "Delete",
                })) && remove.mutate(h.id)
              }
            />
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="flex gap-2" aria-label="Add habit">
        <input
          aria-label="New habit name"
          placeholder="e.g. Drink 3 L water"
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
        <Button type="submit" size="sm" loading={create.isPending} disabled={!name.trim()}>
          Add Habit
        </Button>
      </form>
    </div>
  );
}

function HabitRow({
  habit,
  busy,
  onRename,
  onToggle,
  onDelete,
}: {
  habit: Habit;
  busy: boolean;
  onRename: (n: string) => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(habit.name);
  const changed = name.trim() !== habit.name && name.trim().length > 0;
  return (
    <li
      className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 ${habit.isActive ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50"}`}
    >
      <input
        aria-label={`Habit name: ${habit.name}`}
        value={name}
        maxLength={80}
        onChange={(e) => setName(e.target.value)}
        className={`min-w-0 flex-1 rounded-lg border border-transparent px-2 py-1 text-sm font-medium hover:border-slate-200 focus:border-emerald-500 focus:outline-none ${habit.isActive ? "text-slate-900" : "text-slate-400"}`}
      />
      {habit.isSystem && (
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">BUILT-IN</span>
      )}
      {changed && (
        <Button size="xs" onClick={() => onRename(name.trim())} disabled={busy}>
          Save
        </Button>
      )}
      <Button size="xs" variant="ghost" onClick={onToggle} disabled={busy}>
        {habit.isActive ? "Hide" : "Show"}
      </Button>
      {!habit.isSystem && (
        <Button size="xs" variant="danger" onClick={onDelete} disabled={busy}>
          Delete
        </Button>
      )}
    </li>
  );
}
