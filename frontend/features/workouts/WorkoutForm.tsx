"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "@/services/api";
import { qk, useExerciseNames, useHabits, useProgression } from "@/services/queries";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { formatShort, todayISO } from "@/lib/dates";
import { fmt1 } from "@/lib/format";
import type { Habit, Workout, WorkoutSplit } from "@/types/api";

interface SetDraft {
  key: string;
  reps: string;
  weight: string;
  warmup: boolean;
}
interface ExerciseDraft {
  key: string;
  name: string;
  sets: SetDraft[];
}
const k = () => crypto.randomUUID();
const newSet = (reps = "10", weight = ""): SetDraft => ({ key: k(), reps, weight, warmup: false });
const newExercise = (): ExerciseDraft => ({ key: k(), name: "", sets: [newSet(), newSet(), newSet()] });

export const SPLITS: { value: WorkoutSplit; label: string }[] = [
  { value: "push", label: "Push" },
  { value: "pull", label: "Pull" },
  { value: "legs", label: "Legs" },
  { value: "rest", label: "Rest / Active Recovery" },
  { value: "other", label: "Other" },
];

function fromWorkout(w: Workout): ExerciseDraft[] {
  return w.exercises.map((e) => ({
    key: k(),
    name: e.name,
    sets: e.sets.map((s) => ({
      key: k(),
      reps: String(s.reps),
      weight: s.weightKg === null ? "" : String(s.weightKg),
      warmup: s.isWarmup,
    })),
  }));
}

/** Logs (or edits) a PPL session with per-set reps and weights. */
export function WorkoutForm({ editing, onDone }: { editing: Workout | null; onDone: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const habits = useHabits();
  const names = useExerciseNames();
  const [date, setDate] = useState(editing?.date ?? todayISO());
  const [split, setSplit] = useState<WorkoutSplit>(editing?.split ?? "push");
  const [duration, setDuration] = useState(editing?.durationMin?.toString() ?? "40");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [exercises, setExercises] = useState<ExerciseDraft[]>(editing ? fromWorkout(editing) : [newExercise()]);

  const updateEx = (key: string, fn: (e: ExerciseDraft) => ExerciseDraft) =>
    setExercises((xs) => xs.map((x) => (x.key === key ? fn(x) : x)));

  const filled = exercises.filter((e) => e.name.trim());
  const invalid =
    filled.some((e) => e.sets.some((s) => s.reps === "" || Number(s.reps) < 0)) ||
    (split !== "rest" && filled.length === 0);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        date,
        split,
        durationMin: duration.trim() === "" ? null : Math.round(Number(duration)),
        notes: notes.trim() || null,
        exercises: filled.map((e) => ({
          name: e.name.trim(),
          sets: e.sets.map((s) => ({
            reps: Math.round(Number(s.reps)),
            weightKg: s.weight.trim() === "" ? null : Number(s.weight),
            isWarmup: s.warmup,
          })),
        })),
      };
      const saved = editing
        ? await api<Workout>("PUT", `/workouts/${editing.id}`, body)
        : await api<Workout>("POST", "/workouts", body);
      // Logging a training session also ticks the day's "Workout done" habit.
      // Wait for the habit list if it has not loaded yet (a fast submit must not skip the tick).
      const habitList: Habit[] =
        habits.data ??
        (await qc.fetchQuery({ queryKey: [...qk.habits, false], queryFn: () => api<Habit[]>("GET", "/habits") })) ??
        [];
      const workoutHabit = habitList.find((h) => h.key === "workout");
      let ticked = false;
      if (split !== "rest" && workoutHabit) {
        try {
          await api("PUT", `/habit-logs/${workoutHabit.id}/${date}`, { completed: true });
          ticked = true;
        } catch {
          /* the workout itself is saved; the habit tick is a convenience */
        }
      }
      return { saved, ticked };
    },
    onSuccess: ({ saved, ticked }) => {
      qc.invalidateQueries({ queryKey: qk.workouts });
      qc.invalidateQueries({ queryKey: qk.exercises });
      qc.invalidateQueries({ queryKey: ["progression"] });
      qc.invalidateQueries({ queryKey: qk.day(saved.date) });
      toast(
        `${editing ? "Updated" : "Logged"} ${saved.split} workout for ${formatShort(saved.date)}${ticked ? " · Workout ticked on Today" : ""}`,
      );
      if (!editing) {
        setExercises([newExercise()]);
        setNotes("");
      }
      onDone();
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!invalid) save.mutate();
  };
  const label = "mb-1 block text-xs font-medium text-slate-600";

  return (
    <form onSubmit={submit} className="space-y-4" aria-label="Workout logger">
      {editing && (
        <p className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          Editing the {editing.split} workout from {formatShort(editing.date)}
          <button type="button" onClick={onDone} className="font-semibold underline">
            Cancel editing
          </button>
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="wo-date" className={label}>
            Date
          </label>
          <input
            id="wo-date"
            type="date"
            required
            max={todayISO()}
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="wo-split" className={label}>
            Split
          </label>
          <select
            id="wo-split"
            value={split}
            onChange={(e) => setSplit(e.target.value as WorkoutSplit)}
            className={inputClass}
          >
            {SPLITS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="wo-duration" className={label}>
            Duration (min)
          </label>
          <input
            id="wo-duration"
            type="number"
            min={0}
            max={600}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className={`${inputClass} tabular-nums`}
          />
        </div>
      </div>

      <datalist id="exercise-names">
        {names.data?.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Exercises (Working Weights)</p>
          <Button
            size="xs"
            variant="soft"
            onClick={() => setExercises((xs) => [...xs, newExercise()])}
            disabled={exercises.length >= 30}
          >
            + Add Exercise
          </Button>
        </div>
        {exercises.map((ex, i) => (
          <ExerciseEditor
            key={ex.key}
            index={i}
            ex={ex}
            onChange={(fn) => updateEx(ex.key, fn)}
            onRemove={() =>
              setExercises((xs) => (xs.length > 1 ? xs.filter((x) => x.key !== ex.key) : [newExercise()]))
            }
          />
        ))}
      </div>

      <div>
        <label htmlFor="wo-notes" className={label}>
          Notes (optional)
        </label>
        <textarea
          id="wo-notes"
          rows={2}
          maxLength={2000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={inputClass}
          placeholder="e.g. shoulder felt tight, focus on form"
        />
      </div>

      <div className="flex items-center justify-end gap-3">
        {invalid && (
          <p className="text-xs text-slate-400">
            {split !== "rest" && filled.length === 0 ? "Add at least one exercise name." : "Every set needs reps."}
          </p>
        )}
        <Button type="submit" variant="dark" loading={save.isPending} disabled={invalid}>
          {editing ? "Update Workout" : "Save Workout"}
        </Button>
      </div>
    </form>
  );
}

function ExerciseEditor({
  index,
  ex,
  onChange,
  onRemove,
}: {
  index: number;
  ex: ExerciseDraft;
  onChange: (fn: (e: ExerciseDraft) => ExerciseDraft) => void;
  onRemove: () => void;
}) {
  const last = useProgression(ex.name.trim().length >= 3 ? ex.name.trim() : "");
  const prev = last.data?.sessions.at(-1);
  const cell = "w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs tabular-nums";

  return (
    <fieldset className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <legend className="sr-only">Exercise {index + 1}</legend>
      <div className="flex items-center gap-2">
        <input
          aria-label={`Exercise ${index + 1} name`}
          list="exercise-names"
          placeholder="Exercise (e.g., Incline DB Press)"
          maxLength={120}
          value={ex.name}
          onChange={(e) => onChange((x) => ({ ...x, name: e.target.value }))}
          className={`${inputClass} font-semibold`}
        />
        <button
          type="button"
          aria-label={`Remove exercise ${index + 1}`}
          onClick={onRemove}
          className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
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
      {prev && (
        <p className="text-[11px] text-slate-500">
          Last time ({prev.date}): {prev.workingSets} working sets
          {prev.topSet ? `, top set ${fmt1(prev.topSet.weightKg)} kg × ${prev.topSet.reps}` : ""}
        </p>
      )}
      <div className="grid grid-cols-12 gap-1.5 px-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
        <span className="col-span-2">Set</span>
        <span className="col-span-3">Reps</span>
        <span className="col-span-3">kg</span>
        <span className="col-span-3">Warm-up</span>
      </div>
      {ex.sets.map((s, si) => (
        <div key={s.key} className="grid grid-cols-12 items-center gap-1.5">
          <span className="col-span-2 pl-1 text-xs font-semibold text-slate-500 tabular-nums">{si + 1}</span>
          <input
            aria-label={`Exercise ${index + 1} set ${si + 1} reps`}
            type="number"
            min={0}
            max={1000}
            value={s.reps}
            onChange={(e) =>
              onChange((x) => ({
                ...x,
                sets: x.sets.map((y) => (y.key === s.key ? { ...y, reps: e.target.value } : y)),
              }))
            }
            className={`col-span-3 ${cell}`}
          />
          <input
            aria-label={`Exercise ${index + 1} set ${si + 1} weight kg`}
            type="number"
            min={0}
            max={1000}
            step={2.5}
            placeholder="BW"
            value={s.weight}
            onChange={(e) =>
              onChange((x) => ({
                ...x,
                sets: x.sets.map((y) => (y.key === s.key ? { ...y, weight: e.target.value } : y)),
              }))
            }
            className={`col-span-3 ${cell}`}
          />
          <label className="col-span-3 flex items-center gap-1.5 text-[11px] text-slate-600">
            <input
              type="checkbox"
              checked={s.warmup}
              onChange={(e) =>
                onChange((x) => ({
                  ...x,
                  sets: x.sets.map((y) => (y.key === s.key ? { ...y, warmup: e.target.checked } : y)),
                }))
              }
              className="h-3.5 w-3.5 accent-emerald-600"
            />
            Warm-up
          </label>
          <button
            type="button"
            aria-label={`Remove set ${si + 1}`}
            disabled={ex.sets.length === 1}
            onClick={() => onChange((x) => ({ ...x, sets: x.sets.filter((y) => y.key !== s.key) }))}
            className="col-span-1 flex justify-center p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        disabled={ex.sets.length >= 20}
        onClick={() =>
          onChange((x) => ({
            ...x,
            sets: [...x.sets, newSet(x.sets.at(-1)?.reps ?? "10", x.sets.at(-1)?.weight ?? "")],
          }))
        }
        className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 disabled:opacity-40"
      >
        + Add set (copies the last one)
      </button>
    </fieldset>
  );
}
