/**
 * Workout calculations (pure). Warm-up sets are excluded from volume, top set
 * and estimated 1RM. Estimated 1RM uses the Epley formula, weight × (1 + reps/30),
 * and is only an estimate — the app never treats historical PBs as current targets.
 */

export interface SetInput {
  reps: number;
  weightKg: number | null;
  isWarmup: boolean;
}

const round = (n: number, step: number) => Math.round(n / step) * step;

export function epley1Rm(weightKg: number, reps: number): number | null {
  if (reps < 1 || weightKg <= 0) return null;
  if (reps === 1) return weightKg;
  return round(weightKg * (1 + reps / 30), 0.5);
}

export function exerciseStats(sets: readonly SetInput[]) {
  const working = sets.filter((s) => !s.isWarmup);
  const weighted = working.filter((s): s is SetInput & { weightKg: number } => s.weightKg !== null && s.weightKg > 0);
  const top = weighted.reduce<(SetInput & { weightKg: number }) | null>(
    (best, s) =>
      !best || s.weightKg > best.weightKg || (s.weightKg === best.weightKg && s.reps > best.reps) ? s : best,
    null,
  );
  const e1rms = weighted.map((s) => epley1Rm(s.weightKg, s.reps)).filter((v): v is number => v !== null);
  return {
    workingSets: working.length,
    totalReps: working.reduce((a, s) => a + s.reps, 0),
    volumeKg: round(
      weighted.reduce((a, s) => a + s.weightKg * s.reps, 0),
      0.1,
    ),
    topSet: top ? { weightKg: top.weightKg, reps: top.reps } : null,
    estimated1RmKg: e1rms.length ? Math.max(...e1rms) : null,
  };
}
