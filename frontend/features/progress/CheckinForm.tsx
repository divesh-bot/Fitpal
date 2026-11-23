"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "@/services/api";
import { qk } from "@/services/queries";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { formatShort, todayISO } from "@/lib/dates";
import type { Checkin } from "@/types/api";

type Quality = "poor" | "fair" | "good" | "great";
interface Draft {
  weight: string;
  waist: string;
  steps: string;
  sleep: string;
  quality: Quality | "";
  hunger: number;
  energy: number;
  notes: string;
}
const blank: Draft = {
  weight: "",
  waist: "",
  steps: "",
  sleep: "7.5",
  quality: "good",
  hunger: 5,
  energy: 7,
  notes: "",
};
const fromCheckin = (c: Checkin): Draft => ({
  weight: c.weightKg?.toString() ?? "",
  waist: c.waistCm?.toString() ?? "",
  steps: c.steps?.toString() ?? "",
  sleep: c.sleepHours?.toString() ?? "",
  quality: c.sleepQuality ?? "",
  hunger: c.hunger ?? 5,
  energy: c.energy ?? 7,
  notes: c.notes ?? "",
});
const num = (s: string) => (s.trim() === "" ? null : Number(s));

/**
 * Daily check-in (one per date). Choosing a date that already has a check-in
 * loads it for editing; saving updates that same record.
 */
export function CheckinForm({ date, onDateChange }: { date: string; onDateChange: (d: string) => void }) {
  const today = todayISO();
  const existing = useQuery({
    queryKey: ["checkin", date],
    queryFn: ({ signal }) => api<Checkin | null>("GET", `/checkins/${date}`, undefined, signal),
  });
  if (existing.isLoading) return <p className="text-xs text-slate-400">Loading check-in…</p>;
  // Re-mount the form whenever the date or the stored record changes.
  return (
    <CheckinFormInner
      key={`${date}-${existing.data?.updatedAt ?? "new"}`}
      date={date}
      today={today}
      existing={existing.data ?? null}
      onDateChange={onDateChange}
      loadError={existing.isError ? errorMessage(existing.error) : null}
    />
  );
}

function CheckinFormInner({
  date,
  today,
  existing,
  onDateChange,
  loadError,
}: {
  date: string;
  today: string;
  existing: Checkin | null;
  onDateChange: (d: string) => void;
  loadError: string | null;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [d, setD] = useState<Draft>(existing ? fromCheckin(existing) : blank);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((s) => ({ ...s, [k]: v }));

  const save = useMutation({
    mutationFn: () =>
      api<Checkin>("PUT", `/checkins/${date}`, {
        weightKg: num(d.weight),
        waistCm: num(d.waist),
        steps: d.steps.trim() === "" ? null : Math.round(Number(d.steps)),
        sleepHours: num(d.sleep),
        sleepQuality: d.quality || null,
        hunger: d.hunger,
        energy: d.energy,
        notes: d.notes.trim() || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checkin", date] });
      qc.invalidateQueries({ queryKey: ["checkins"] });
      qc.invalidateQueries({ queryKey: ["weight"] });
      qc.invalidateQueries({ queryKey: qk.day(date) });
      toast(`Saved check-in for ${formatShort(date)}`);
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };
  const label = "mb-1 block text-xs font-medium text-slate-600";

  return (
    <form onSubmit={submit} className="space-y-4 border-t border-slate-100 pt-4" aria-label="Daily check-in">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-800">Daily Check-in</h4>
        {existing && (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
            Editing {formatShort(date)}
          </span>
        )}
      </div>
      {loadError && <p className="text-xs text-amber-700">Couldn&apos;t load the existing check-in: {loadError}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="ci-date" className={label}>
            Date
          </label>
          <input
            id="ci-date"
            type="date"
            required
            max={today}
            value={date}
            onChange={(e) => e.target.value && onDateChange(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="ci-weight" className={label}>
            Morning Weight (kg)
          </label>
          <input
            id="ci-weight"
            type="number"
            step={0.1}
            min={25}
            max={400}
            placeholder="98.0"
            value={d.weight}
            onChange={(e) => set("weight", e.target.value)}
            className={`${inputClass} tabular-nums`}
          />
        </div>
        <div>
          <label htmlFor="ci-waist" className={label}>
            Weekly Waist (cm, opt.)
          </label>
          <input
            id="ci-waist"
            type="number"
            step={0.5}
            min={30}
            max={250}
            placeholder="e.g. 96.0"
            value={d.waist}
            onChange={(e) => set("waist", e.target.value)}
            className={`${inputClass} tabular-nums`}
          />
        </div>
        <div>
          <label htmlFor="ci-steps" className={label}>
            Steps
          </label>
          <input
            id="ci-steps"
            type="number"
            step={100}
            min={0}
            max={200000}
            placeholder="5500"
            value={d.steps}
            onChange={(e) => set("steps", e.target.value)}
            className={`${inputClass} tabular-nums`}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="ci-sleep" className={label}>
            Sleep (hours)
          </label>
          <input
            id="ci-sleep"
            type="number"
            step={0.5}
            min={0}
            max={24}
            value={d.sleep}
            onChange={(e) => set("sleep", e.target.value)}
            className={`${inputClass} tabular-nums`}
          />
        </div>
        <div>
          <label htmlFor="ci-quality" className={label}>
            Sleep Quality
          </label>
          <select
            id="ci-quality"
            value={d.quality}
            onChange={(e) => set("quality", e.target.value as Quality | "")}
            className={inputClass}
          >
            <option value="">—</option>
            <option value="poor">Poor</option>
            <option value="fair">Fair</option>
            <option value="good">Good</option>
            <option value="great">Great</option>
          </select>
        </div>
        <Slider id="ci-hunger" label="Hunger (1–10)" value={d.hunger} onChange={(v) => set("hunger", v)} />
        <Slider id="ci-energy" label="Energy (1–10)" value={d.energy} onChange={(v) => set("energy", v)} />
      </div>

      <div>
        <label htmlFor="ci-notes" className={label}>
          Notes (optional)
        </label>
        <textarea
          id="ci-notes"
          rows={2}
          maxLength={2000}
          placeholder="e.g. slept late, salty dinner, felt strong in the gym"
          value={d.notes}
          onChange={(e) => set("notes", e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" loading={save.isPending}>
          {existing ? "Update Check-in" : "Save Daily Check-in"}
        </Button>
      </div>
    </form>
  );
}

function Slider({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-xs font-medium text-slate-600">
        <label htmlFor={id}>{label}</label>
        <span className="font-bold text-emerald-700 tabular-nums">{value}</span>
      </div>
      <input
        id={id}
        type="range"
        min={1}
        max={10}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}
