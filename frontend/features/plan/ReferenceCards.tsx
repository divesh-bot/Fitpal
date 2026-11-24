"use client";

import { usePlan, usePreferences, useTargets } from "@/services/queries";
import { todayISO } from "@/lib/dates";
import { fmt1 } from "@/lib/format";
import { LoadingBlock } from "@/components/ui/Feedback";

/** Bullet dot used in the rules list (amber; green for the vegetarian rule). */
function Dot({ green }: { green?: boolean }) {
  return (
    <span
      className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${green ? "bg-emerald-500" : "bg-amber-500"}`}
      aria-hidden="true"
    />
  );
}

/**
 * The prototype's reference cards (rules, supplements, review protocol), with
 * the parts that are now settings shown from your real data.
 */
export function ReferenceCards() {
  const prefs = usePreferences();
  const plan = usePlan();
  const targets = useTargets(todayISO());
  const vegDays = plan.data?.days.filter((d) => d.isStrictVeg).map((d) => d.dayName) ?? [];
  const excluded = prefs.data?.excludedFoods ?? [];
  const creatine = targets.data?.creatineG ?? 5;
  const protein = targets.data?.proteinG ?? 160;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <div className="space-y-4 rounded-2xl border border-amber-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">Core Nutrition Rules</h3>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">Important</span>
        </div>
        {/* Wait for your settings: never show a rule state that might be wrong. */}
        {!prefs.data || !plan.data ? (
          <LoadingBlock label="Loading your rules…" />
        ) : (
          <ul className="space-y-3 text-sm text-slate-700">
            {prefs.data?.wholeEggsOnly !== false && (
              <li className="flex items-start gap-2.5">
                <Dot />
                <span>
                  <strong className="text-slate-900">Whole eggs only:</strong> No liquid or separated egg whites. If
                  more protein is needed, increase low-fat paneer, Greek yogurt, soya chunks, or dal. Count the full
                  egg.
                </span>
              </li>
            )}
            {excluded.length > 0 && (
              <li className="flex items-start gap-2.5">
                <Dot />
                <span>
                  <strong className="text-slate-900">No {excluded.join(", ")}:</strong> Strictly excluded from all
                  meals.
                </span>
              </li>
            )}
            <li className="flex items-start gap-2.5">
              <Dot green />
              <span>
                <strong className="text-slate-900">
                  {vegDays.length ? `${vegDays.join(", ")} strictly vegetarian:` : "Strictly vegetarian days:"}
                </strong>{" "}
                {vegDays.length
                  ? `No eggs or chicken on ${vegDays.length === 1 ? `${vegDays[0]}s` : "these days"}.`
                  : "None set. Mark days in the weekly plan above."}
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <Dot />
              <span>
                <strong className="text-slate-900">Measure oil &amp; coffee additions:</strong> Track cooking oil
                (typically 3–5g/meal) and coffee toned milk (100 ml) + sugar (5 g).
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <Dot />
              <span>
                <strong className="text-slate-900">Verify pack labels:</strong> Greek yogurt, paneer, soya, and milk
                vary by brand. Add your exact brand as a custom food in the Calculator, or edit any ingredient in the
                plan.
              </span>
            </li>
          </ul>
        )}
      </div>

      <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <h3 className="text-base font-semibold text-slate-900">Supplements &amp; Protein Milk</h3>
        <div className="space-y-3 text-sm">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-semibold text-slate-900">Creatine Monohydrate</span>
              <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                {fmt1(creatine)} g daily
              </span>
            </div>
            <p className="text-xs leading-relaxed text-slate-600">
              Timing is flexible; take on rest days too. No loading phase needed. Scale weight may temporarily rise due
              to water stored in muscle.
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-semibold text-slate-900">Country Delight Protein Milk</span>
              <span className="rounded-md bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700 tabular-nums">
                450 ml • 293 kcal • 25g P
              </span>
            </div>
            <p className="text-xs leading-relaxed text-slate-600">
              Have after morning workout. Always count its 293 kcal in your daily total.
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-semibold text-slate-900">BCAA (Intra-workout)</span>
              <span className="rounded-md bg-slate-200/70 px-2 py-0.5 text-xs font-medium text-slate-500">
                Optional
              </span>
            </div>
            <p className="text-xs leading-relaxed text-slate-600">
              Offers little extra benefit if total daily protein (~{fmt1(protein)}g) is met with complete protein
              sources. Consider whether you need to continue.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] lg:col-span-2">
        <h3 className="text-base font-semibold text-slate-900">Review &amp; Accuracy Protocol</h3>
        <ol className="space-y-3 text-sm text-slate-700">
          {[
            <>
              Weigh in every morning after using the washroom and before food or drink. Compare{" "}
              <strong>7-day averages</strong>, not single readings.
            </>,
            <>Measure waist once weekly under similar conditions and record gym performance.</>,
            <>
              Review after <strong>2–3 weeks</strong> of consistent tracking before adjusting calories. Check cooking
              oil, portions, labels, and adherence first.
            </>,
            <>
              Historical personal-best lifts (170 / 200 / 100 kg) are not current training targets. Rebuild technique
              and work capacity gradually.
            </>,
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="font-bold text-emerald-600">{i + 1}.</span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
        <p className="border-t border-slate-100 pt-2 text-[11px] text-slate-400">
          General nutrition guidance, not a medical diet. Discuss persistent unusual salt cravings with dizziness or
          weakness with a clinician.
        </p>
      </div>
    </div>
  );
}
