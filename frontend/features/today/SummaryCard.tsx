import { ProgressRing } from "@/components/ui/ProgressRing";
import { fmt1, fmtInt } from "@/lib/format";
import type { DaySummary } from "@/types/api";

/** Calories + protein rings: consumed vs target, with the planned total underneath. */
export function SummaryCard({ day }: { day: DaySummary }) {
  const { target, consumed, remaining, progress, planned } = day;
  const over = consumed.kcal > target.caloriesKcal + 100;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] lg:col-span-2">
      <div className="grid grid-cols-1 items-center gap-6 sm:grid-cols-2">
        <div className="flex items-center gap-4">
          <ProgressRing pct={progress.kcalPct} color={over ? "#d97706" : "#059669"} label="Calories" />
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Calories</p>
            <div className="mt-0.5 flex items-baseline gap-1 tabular-nums">
              <span className="text-2xl font-bold text-slate-900">{fmtInt(consumed.kcal)}</span>
              <span className="text-sm text-slate-400">/ {fmtInt(target.caloriesKcal)}</span>
            </div>
            <p
              className={`mt-1 text-xs font-medium tabular-nums ${remaining.kcal >= 0 ? "text-emerald-600" : "text-amber-600"}`}
            >
              {remaining.kcal >= 0 ? `${fmtInt(remaining.kcal)} kcal left` : `${fmtInt(-remaining.kcal)} kcal over`}
            </p>
            <p className="mt-1 text-[11px] text-slate-400 tabular-nums">
              {planned ? `Planned meals: ${fmtInt(planned.kcal)} kcal` : "No meal plan"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:border-l sm:border-slate-100 sm:pl-6">
          <ProgressRing pct={progress.proteinPct} color="#0d9488" label="Protein" />
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Protein</p>
            <div className="mt-0.5 flex items-baseline gap-1 tabular-nums">
              <span className="text-2xl font-bold text-slate-900">{fmt1(consumed.proteinG)}g</span>
              <span className="text-sm text-slate-400">/ {fmt1(target.proteinG)}g</span>
            </div>
            <p className="mt-1 text-xs font-medium text-teal-600 tabular-nums">
              {remaining.proteinG > 0
                ? `${fmt1(remaining.proteinG)}g remaining`
                : `Target hit (+${fmt1(-remaining.proteinG)}g)`}
            </p>
            <p className="mt-1 text-[11px] text-slate-400 tabular-nums">
              {planned ? `Planned meals: ${fmt1(planned.proteinG)}g P` : " "}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
