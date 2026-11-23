"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/Card";
import { CheckinForm } from "@/features/progress/CheckinForm";
import { CheckinHistory } from "@/features/progress/CheckinHistory";
import { WeightCard } from "@/features/progress/WeightCard";
import { ProgressionCard } from "@/features/workouts/ProgressionCard";
import { WorkoutForm } from "@/features/workouts/WorkoutForm";
import { WorkoutHistory } from "@/features/workouts/WorkoutHistory";
import { todayISO } from "@/lib/dates";
import type { Workout } from "@/types/api";

export default function ProgressPage() {
  const [checkinDate, setCheckinDate] = useState(todayISO);
  const [editingWorkout, setEditingWorkout] = useState<Workout | null>(null);

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Log & Progress"
        subtitle="Track morning weigh-ins (7-day averages), daily biofeedback, and PPL working weights."
      />

      <div id="checkin-section">
        <WeightCard>
          <CheckinForm date={checkinDate} onDateChange={setCheckinDate} />
        </WeightCard>
      </div>

      <div
        id="workout-section"
        className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
      >
        <div>
          <h3 className="text-base font-semibold text-slate-900">PPL Workout Logger</h3>
          <p className="text-xs text-slate-500">Morning gym, 4–5 days/week, ~40 minutes.</p>
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3">
          <svg
            className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <p className="text-xs leading-relaxed text-amber-900">
            <span className="font-semibold">Rebuild gradually</span> — historical PBs (
            <span className="font-medium">Squat 170 kg, Deadlift 200 kg, Bench 100 kg</span>) are not current working
            weights. Prioritize technique and steady progression.
          </p>
        </div>
        <WorkoutForm
          key={editingWorkout?.id ?? "new"}
          editing={editingWorkout}
          onDone={() => setEditingWorkout(null)}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <CheckinHistory onEdit={(d) => (setCheckinDate(d), scrollTo("checkin-section"))} />
        <WorkoutHistory onEdit={(w) => (setEditingWorkout(w), scrollTo("workout-section"))} />
      </div>

      <ProgressionCard />
    </div>
  );
}
