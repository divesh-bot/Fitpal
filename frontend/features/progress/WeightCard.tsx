"use client";

import { useState } from "react";
import { useWeightProgress } from "@/services/queries";
import { errorMessage } from "@/services/api";
import { LineChart } from "@/components/charts/LineChart";
import { ErrorState, LoadingBlock } from "@/components/ui/Feedback";
import { addDays, todayISO } from "@/lib/dates";
import { fmt1 } from "@/lib/format";

const RANGES = [
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 365, label: "1 year" },
] as const;

/** Pace label so the meaning never relies on colour alone (target 0.3–0.6 kg/week loss). */
function pace(kg: number | null) {
  if (kg === null) return { text: "Need 2 weeks of weigh-ins", cls: "text-slate-400" };
  const sign = kg > 0 ? "+" : "";
  const value = `${sign}${kg.toFixed(2)} kg/wk`;
  if (kg <= -0.3 && kg >= -0.65) return { text: value, note: "On target pace", cls: "text-emerald-700" };
  if (kg < -0.65) return { text: value, note: "Faster than target", cls: "text-amber-600" };
  if (kg > 0.1) return { text: value, note: "Gaining", cls: "text-amber-600" };
  return { text: value, note: "Slower than target", cls: "text-slate-900" };
}

export function WeightCard({ children }: { children?: React.ReactNode }) {
  const [days, setDays] = useState<number>(30);
  const to = todayISO();
  const from = addDays(to, -(days - 1));
  const q = useWeightProgress(from, to);

  const s = q.data?.stats;
  const p = pace(s ? (s.weeklyChangeKg ?? null) : null);
  const waist = q.data?.waist ?? [];
  const waistChange = waist.length >= 2 ? waist.at(-1)!.waistCm - waist[0]!.waistCm : null;

  return (
    <div className="space-y-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Morning Weight &amp; 7-Day Rolling Average</h3>
          <p className="text-xs text-slate-500">
            Weigh in after washroom, before food/drink. Target pace: 0.3–0.6 kg/week.
          </p>
        </div>
        <div
          className="inline-flex self-start rounded-xl border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold"
          role="group"
          aria-label="Chart range"
        >
          {RANGES.map((r) => (
            <button
              key={r.days}
              type="button"
              aria-pressed={days === r.days}
              onClick={() => setDays(r.days)}
              className={`rounded-lg px-3 py-1.5 ${days === r.days ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile
              label="Latest Weigh-in"
              value={s?.latestWeightKg != null ? `${fmt1(s.latestWeightKg)} kg` : "—"}
              sub={s?.latestDate ?? undefined}
            />
            <Tile
              label="7-Day Average"
              value={s?.latestAvg7 != null ? `${s.latestAvg7.toFixed(2)} kg` : "—"}
              highlight
            />
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5">
              <p className="text-xs text-slate-500">Change vs last week</p>
              <p className={`mt-0.5 tabular-nums ${p.note ? "text-xl font-bold" : "text-sm font-semibold"} ${p.cls}`}>
                {p.text}
              </p>
              {p.note && <p className="text-[11px] text-slate-500">{p.note}</p>}
            </div>
            <Tile
              label="Waist"
              value={waist.length ? `${fmt1(waist.at(-1)!.waistCm)} cm` : "—"}
              sub={
                waistChange !== null
                  ? `${waistChange > 0 ? "+" : ""}${fmt1(waistChange)} cm in ${days} days`
                  : "Measure weekly"
              }
            />
          </div>

          <div className="w-full overflow-hidden rounded-xl border border-slate-100 bg-slate-50/50 p-3">
            {q.isLoading ? (
              <LoadingBlock label="Loading weigh-ins…" />
            ) : q.data!.points.length === 0 ? (
              <div className="flex h-56 flex-col items-center justify-center px-4 text-center">
                <p className="text-sm font-medium text-slate-500">No weigh-ins in the last {days} days</p>
                <p className="mt-1 text-xs text-slate-400">Log your morning weight below to start your trend.</p>
              </div>
            ) : (
              <LineChart
                ariaLabel={`Morning weight and 7-day average, last ${days} days`}
                unit="kg"
                series={[
                  { key: "weight", label: "Daily Weight", color: "#475569", style: "dots" },
                  { key: "avg7", label: "7-Day Average", color: "#059669", style: "line" },
                ]}
                points={q.data!.points.map((pt) => ({ date: pt.date, values: { weight: pt.weightKg, avg7: pt.avg7 } }))}
              />
            )}
          </div>
        </>
      )}

      {children}
    </div>
  );
}

function Tile({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-3.5 ${highlight ? "border-emerald-100 bg-emerald-50/70" : "border-slate-100 bg-slate-50"}`}
    >
      <p className={`text-xs ${highlight ? "text-emerald-700" : "text-slate-500"}`}>{label}</p>
      <p className={`mt-0.5 text-xl font-bold tabular-nums ${highlight ? "text-emerald-900" : "text-slate-900"}`}>
        {value}
      </p>
      {sub && <p className="text-[11px] text-slate-400 tabular-nums">{sub}</p>}
    </div>
  );
}
