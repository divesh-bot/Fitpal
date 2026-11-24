"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "@/services/api";
import { qk, useProfile } from "@/services/queries";
import { Button } from "@/components/ui/Button";
import { ErrorState, LoadingBlock } from "@/components/ui/Feedback";
import { Field, SelectField, TextAreaField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { ACTIVITY_LEVELS, ageFromBirthYear } from "@/lib/energy";
import { fmt1 } from "@/lib/format";
import type { Profile } from "@/types/api";

const GOALS = { fat_loss: "Fat Loss + Muscle", maintenance: "Maintenance", muscle_gain: "Muscle Gain" } as const;

export function ProfileCard() {
  const profile = useProfile();
  const [editing, setEditing] = useState(false);

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900">Profile</h3>
        <div className="flex items-center gap-2">
          {profile.data && (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              {GOALS[profile.data.goal]}
            </span>
          )}
          {profile.data && !editing && (
            <Button size="xs" variant="secondary" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
        </div>
      </div>
      {profile.isLoading ? (
        <LoadingBlock />
      ) : profile.isError ? (
        <ErrorState message={errorMessage(profile.error)} onRetry={() => profile.refetch()} />
      ) : editing ? (
        <ProfileForm profile={profile.data!} onDone={() => setEditing(false)} />
      ) : (
        <ProfileSummary p={profile.data!} />
      )}
    </div>
  );
}

function ProfileSummary({ p }: { p: Profile }) {
  const parts = [
    p.birthYear ? `~${ageFromBirthYear(p.birthYear)} yrs` : null,
    p.sex ? (p.sex === "male" ? "Male" : "Female") : null,
    p.startingWeightKg ? `${fmt1(p.startingWeightKg)} kg (start)` : null,
    p.heightCm ? `${fmt1(p.heightCm)} cm` : null,
  ].filter(Boolean);
  const row = (label: string, value: string | null) => (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`text-right font-medium ${value ? "text-slate-900" : "text-slate-400 italic"}`}>
        {value ?? "Not set"}
      </dd>
    </div>
  );
  return (
    <dl className="divide-y divide-slate-100 text-sm">
      {row("Name", p.displayName)}
      {row("Email", p.email)}
      {row("Profile", parts.length ? parts.join(" • ") : null)}
      {row(
        "Activity",
        p.activityDescription
          ? `${p.activityDescription} (${p.activityMultiplier}×)`
          : `${p.activityMultiplier}× multiplier`,
      )}
      {row("Training", p.trainingNotes)}
    </dl>
  );
}

function ProfileForm({ profile, onDone }: { profile: Profile; onDone: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [v, setV] = useState({
    displayName: profile.displayName ?? "",
    sex: profile.sex ?? "",
    birthYear: profile.birthYear?.toString() ?? "",
    heightCm: profile.heightCm?.toString() ?? "",
    startingWeightKg: profile.startingWeightKg?.toString() ?? "",
    activityMultiplier: String(profile.activityMultiplier),
    activityDescription: profile.activityDescription ?? "",
    goal: profile.goal,
    trainingNotes: profile.trainingNotes ?? "",
  });
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((s) => ({ ...s, [k]: e.target.value }));
  const num = (s: string) => (s.trim() === "" ? null : Number(s));
  const activityOptions = ACTIVITY_LEVELS.some((a) => String(a.value) === v.activityMultiplier)
    ? ACTIVITY_LEVELS
    : [...ACTIVITY_LEVELS, { value: Number(v.activityMultiplier), label: `Custom — ${v.activityMultiplier}×` }];

  const save = useMutation({
    mutationFn: () =>
      api<Profile>("PUT", "/profile", {
        displayName: v.displayName.trim() || null,
        sex: v.sex || null,
        birthYear: num(v.birthYear),
        heightCm: num(v.heightCm),
        startingWeightKg: num(v.startingWeightKg),
        activityMultiplier: Number(v.activityMultiplier),
        activityDescription: v.activityDescription.trim() || null,
        goal: v.goal,
        trainingNotes: v.trainingNotes.trim() || null,
      }),
    onSuccess: (p) => {
      qc.setQueryData(qk.profile, p);
      toast("Profile saved");
      onDone();
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };
  return (
    <form onSubmit={submit} className="space-y-3" aria-label="Edit profile">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Name" maxLength={80} value={v.displayName} onChange={set("displayName")} />
        <SelectField label="Sex" value={v.sex} onChange={set("sex")}>
          <option value="">Not set</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </SelectField>
        <Field
          label="Birth year"
          type="number"
          min={1900}
          max={new Date().getFullYear() - 10}
          value={v.birthYear}
          onChange={set("birthYear")}
          hint={v.birthYear ? `About ${ageFromBirthYear(Number(v.birthYear))} years old` : "Used for BMR"}
        />
        <Field
          label="Height (cm)"
          type="number"
          min={100}
          max={250}
          step={0.5}
          value={v.heightCm}
          onChange={set("heightCm")}
        />
        <Field
          label="Starting weight (kg)"
          type="number"
          min={25}
          max={400}
          step={0.1}
          value={v.startingWeightKg}
          onChange={set("startingWeightKg")}
          hint="Your weigh-ins track changes over time"
        />
        <SelectField label="Goal" value={v.goal} onChange={set("goal")}>
          <option value="fat_loss">Fat loss + muscle</option>
          <option value="maintenance">Maintenance</option>
          <option value="muscle_gain">Muscle gain</option>
        </SelectField>
      </div>
      <SelectField label="Activity level" value={v.activityMultiplier} onChange={set("activityMultiplier")}>
        {activityOptions.map((a) => (
          <option key={a.value} value={String(a.value)}>
            {a.label}
          </option>
        ))}
      </SelectField>
      <Field
        label="Activity description"
        maxLength={200}
        placeholder="e.g. Desk job (4,000–6,000 steps/day)"
        value={v.activityDescription}
        onChange={set("activityDescription")}
      />
      <TextAreaField
        label="Training notes"
        rows={2}
        maxLength={2000}
        placeholder="e.g. Morning gym, 4–5 days/wk (~40 min PPL)"
        value={v.trainingNotes}
        onChange={set("trainingNotes")}
      />
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button size="sm" type="submit" loading={save.isPending}>
          Save Profile
        </Button>
      </div>
    </form>
  );
}
