"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "@/services/api";
import { qk, useProfile, useTargets, useWeightProgress } from "@/services/queries";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";
import { ErrorState, LoadingBlock } from "@/components/ui/Feedback";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { addDays, todayISO } from "@/lib/dates";
import { fmt1, fmtInt } from "@/lib/format";
import {
  ACTIVITY_LEVELS,
  ageFromBirthYear,
  birthYearFromAge,
  energyTargets,
  GOAL_PRESETS,
  perKgFromProtein,
  proteinFromPerKg,
} from "@/lib/energy";
import type { Profile, Targets } from "@/types/api";

/** Loads profile, current targets and recent weight, then renders the calculator. */
export function TdeePanel() {
  const today = todayISO();
  const profile = useProfile();
  const targets = useTargets(today);
  const weight = useWeightProgress(addDays(today, -60), today);

  if (profile.isLoading || targets.isLoading || weight.isLoading) return <LoadingBlock label="Loading your stats…" />;
  const err = profile.error ?? targets.error;
  if (err) return <ErrorState message={errorMessage(err)} onRetry={() => (profile.refetch(), targets.refetch())} />;

  const latestWeight =
    weight.data?.stats.latestAvg7 ?? weight.data?.stats.latestWeightKg ?? profile.data!.startingWeightKg;
  return <TdeeCalculator profile={profile.data!} targets={targets.data!} latestWeight={latestWeight} />;
}

function TdeeCalculator({
  profile,
  targets,
  latestWeight,
}: {
  profile: Profile;
  targets: Targets;
  latestWeight: number | null;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  const [sex, setSex] = useState<"male" | "female">(profile.sex ?? "male");
  const [age, setAge] = useState(profile.birthYear ? String(ageFromBirthYear(profile.birthYear)) : "");
  const [weight, setWeight] = useState(latestWeight ? String(latestWeight) : "");
  const [height, setHeight] = useState(profile.heightCm ? String(profile.heightCm) : "");
  const [activity, setActivity] = useState(profile.activityMultiplier);
  const [offset, setOffset] = useState(-350);
  const [protein, setProtein] = useState(String(targets.proteinG));
  const [saveProfile, setSaveProfile] = useState(!profile.birthYear || !profile.heightCm || !profile.sex);

  const w = Number(weight);
  const ready =
    Number(age) >= 15 && Number(age) <= 90 && w >= 35 && w <= 250 && Number(height) >= 120 && Number(height) <= 230;
  const out = ready
    ? energyTargets({ sex, ageYears: Number(age), weightKg: w, heightCm: Number(height), activity, offsetKcal: offset })
    : null;
  const proteinG = Math.round(Number(protein) || 0);
  const perKg = ready ? perKgFromProtein(w, proteinG) : 0;
  const activityOptions = ACTIVITY_LEVELS.some((a) => a.value === activity)
    ? ACTIVITY_LEVELS
    : [...ACTIVITY_LEVELS, { value: activity, label: `Custom — ${activity}×` }];

  const apply = useMutation({
    mutationFn: async () => {
      if (!out) throw new Error("Fill in age, weight and height first.");
      if (saveProfile) {
        await api("PUT", "/profile", {
          sex,
          birthYear: birthYearFromAge(Number(age)),
          heightCm: Number(height),
          activityMultiplier: activity,
          // Only fills an empty starting weight; never overwrites it (weigh-ins track changes).
          ...(profile.startingWeightKg === null ? { startingWeightKg: w } : {}),
        });
      }
      return api<Targets>("PUT", `/targets/${todayISO()}`, {
        caloriesKcal: out.recommendedKcal,
        proteinG: proteinG,
        steps: targets.steps,
        creatineG: targets.creatineG,
        bmrKcal: out.bmr,
        tdeeKcal: out.tdee,
        note: `From calculator: ${offset >= 0 ? "+" : ""}${offset} kcal/day`,
      });
    },
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: qk.allTargets });
      qc.invalidateQueries({ queryKey: qk.allDays });
      if (saveProfile) qc.invalidateQueries({ queryKey: qk.profile });
      toast(`Daily targets updated: ${fmtInt(t.caloriesKcal)} kcal & ${fmt1(t.proteinG)}g protein (from today)`);
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  const onApply = async () => {
    if (!out) return;
    const ok = await confirm({
      title: "Update your daily targets?",
      body: `${fmtInt(targets.caloriesKcal)} → ${fmtInt(out.recommendedKcal)} kcal and ${fmt1(targets.proteinG)} → ${proteinG} g protein, starting today. Earlier days keep the targets they had.`,
      confirmLabel: "Apply",
      destructive: false,
    });
    if (ok) apply.mutate();
  };

  const label = "mb-1 block text-xs font-medium text-slate-600";
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <div className="space-y-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] lg:col-span-7">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Mifflin–St Jeor Inputs</h3>
          <p className="text-xs text-slate-500">
            Pre-filled from your profile and latest 7-day average weight. Update as your weight changes.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label htmlFor="tdee-sex" className={label}>
              Sex
            </label>
            <select
              id="tdee-sex"
              value={sex}
              onChange={(e) => setSex(e.target.value as "male" | "female")}
              className={inputClass}
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div>
            <label htmlFor="tdee-age" className={label}>
              Age (yrs)
            </label>
            <input
              id="tdee-age"
              type="number"
              min={15}
              max={90}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className={`${inputClass} tabular-nums`}
            />
          </div>
          <div>
            <label htmlFor="tdee-weight" className={label}>
              Weight (kg)
            </label>
            <input
              id="tdee-weight"
              type="number"
              step={0.5}
              min={35}
              max={250}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className={`${inputClass} tabular-nums`}
            />
          </div>
          <div>
            <label htmlFor="tdee-height" className={label}>
              Height (cm)
            </label>
            <input
              id="tdee-height"
              type="number"
              min={120}
              max={230}
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              className={`${inputClass} tabular-nums`}
            />
          </div>
        </div>
        {!ready && <p className="text-xs text-amber-700">Enter your age, weight and height to calculate.</p>}

        <div>
          <label htmlFor="tdee-activity" className={label}>
            Activity Level
          </label>
          <select
            id="tdee-activity"
            value={activity}
            onChange={(e) => setActivity(Number(e.target.value))}
            className={inputClass}
          >
            {activityOptions.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2.5">
          <p className="block text-xs font-medium text-slate-600">Goal Deficit / Surplus</p>
          <div className="flex flex-wrap gap-1.5">
            {GOAL_PRESETS.map((g) => (
              <button
                key={g.offset}
                type="button"
                aria-pressed={offset === g.offset}
                onClick={() => setOffset(g.offset)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${offset === g.offset ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
              >
                {g.label}
              </button>
            ))}
          </div>
          <div className="pt-1">
            <div className="mb-1 flex justify-between text-xs text-slate-500">
              <label htmlFor="tdee-offset">Custom Adjustment</label>
              <span className="font-bold text-emerald-700 tabular-nums">
                {offset > 0 ? "+" : ""}
                {offset} kcal/day
              </span>
            </div>
            <input
              id="tdee-offset"
              type="range"
              min={-800}
              max={500}
              step={25}
              value={offset}
              onChange={(e) => setOffset(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        <div className="space-y-2 border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between">
            <label htmlFor="tdee-perkg" className="text-xs font-medium text-slate-600">
              Protein Target (g per kg body weight)
            </label>
            <span className="text-xs font-bold text-teal-700 tabular-nums">{perKg.toFixed(2)} g/kg</span>
          </div>
          <input
            id="tdee-perkg"
            type="range"
            min={1.2}
            max={2.4}
            step={0.05}
            disabled={!ready}
            value={Math.min(2.4, Math.max(1.2, perKg))}
            onChange={(e) => setProtein(String(proteinFromPerKg(w, Number(e.target.value))))}
            className="w-full"
          />
          <div className="flex items-center justify-between gap-3 pt-1">
            <label htmlFor="tdee-protein" className="text-xs text-slate-500">
              Or enter exact daily protein (g):
            </label>
            <input
              id="tdee-protein"
              type="number"
              min={60}
              max={300}
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
              className="w-24 rounded-lg border border-slate-200 px-3 py-1.5 text-right text-sm font-bold tabular-nums"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-between gap-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] lg:col-span-5">
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-slate-900">Calculated Targets</h3>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="BMR" value={out ? fmtInt(out.bmr) : "—"} />
            <Stat label="Estimated TDEE" value={out ? fmtInt(out.tdee) : "—"} />
          </div>
          <div className="space-y-3 rounded-2xl border border-emerald-200/80 bg-emerald-50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider text-emerald-800 uppercase">Recommended Daily</span>
              <span className="rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-xs font-bold text-emerald-700 tabular-nums">
                {out ? `${out.weeklyKg > 0 ? "+" : ""}${out.weeklyKg.toFixed(2)} kg/wk` : "—"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 tabular-nums">
              <div>
                <p className="text-xs text-emerald-700">Calories</p>
                <p className="text-2xl font-bold text-emerald-950">{out ? fmtInt(out.recommendedKcal) : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-teal-700">Protein</p>
                <p className="text-2xl font-bold text-teal-900">{proteinG}g</p>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Current targets:{" "}
            <strong className="tabular-nums">
              {fmtInt(targets.caloriesKcal)} kcal · {fmt1(targets.proteinG)} g protein
            </strong>
            {targets.bmrKcal && targets.tdeeKcal
              ? ` (saved BMR ${fmtInt(targets.bmrKcal)} / TDEE ${fmtInt(targets.tdeeKcal)})`
              : ""}
            .
          </p>
          <p className="text-xs leading-relaxed text-slate-500">
            Estimates are a starting point. Track consistently for 2–3 weeks and compare 7-day average weigh-ins before
            adjusting further.
          </p>
        </div>
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={saveProfile}
              onChange={(e) => setSaveProfile(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-emerald-600"
            />
            Also save sex, age, height and activity to my profile (and weight as your starting weight, if not set)
          </label>
          <Button className="w-full py-3" disabled={!out || proteinG < 60} loading={apply.isPending} onClick={onApply}>
            Apply to Daily Targets
          </Button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 text-xl font-bold text-slate-900 tabular-nums">{value}</p>
      <p className="text-[11px] text-slate-400">kcal / day</p>
    </div>
  );
}
