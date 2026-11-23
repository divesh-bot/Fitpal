/**
 * Weight-trend calculations (pure functions).
 *
 * 7-day rolling average for date D = mean of all weigh-ins dated D-6 … D
 * (a calendar window). NOTE: the HTML prototype averaged the last 7 *entries*,
 * which stretches over more than a week when days are skipped. With a daily
 * weigh-in both are identical.
 */

export interface WeighIn {
  date: string; // YYYY-MM-DD
  weightKg: number;
}

const DAY_MS = 86_400_000;
export const toEpochDay = (date: string) => Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
export const fromEpochDay = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);
export const addDays = (date: string, n: number) => fromEpochDay(toEpochDay(date) + n);
/** ISO weekday: 1 = Monday … 7 = Sunday. Pure date maths, independent of server time zone. */
export const isoWeekday = (date: string) => ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Mean of weigh-ins within [date-6, date], or null if there are none. */
export function rollingAverage(sorted: readonly WeighIn[], date: string): number | null {
  const end = toEpochDay(date);
  const inWindow = sorted.filter((w) => {
    const d = toEpochDay(w.date);
    return d <= end && d > end - 7;
  });
  if (inWindow.length === 0) return null;
  return r2(inWindow.reduce((a, w) => a + w.weightKg, 0) / inWindow.length);
}

export interface WeightTrend {
  points: { date: string; weightKg: number; avg7: number }[];
  stats: {
    entries: number;
    latestDate: string | null;
    latestWeightKg: number | null;
    latestAvg7: number | null;
    /** 7-day average now minus the 7-day average one week earlier (null if not enough data). */
    weeklyChangeKg: number | null;
    /** Average weekly rate across the period (prototype formula), null with < 2 entries. */
    averageWeeklyRateKg: number | null;
  };
}

/**
 * @param all weigh-ins including up to 13 days BEFORE `from`, so the averages
 *            at the start of the range and the week-over-week change are complete.
 */
export function weightTrend(all: readonly WeighIn[], from: string, to: string): WeightTrend {
  const sorted = [...all].sort((a, b) => a.date.localeCompare(b.date));
  const inRange = sorted.filter((w) => w.date >= from && w.date <= to);
  const points = inRange.map((w) => ({ date: w.date, weightKg: w.weightKg, avg7: rollingAverage(sorted, w.date)! }));

  const latest = inRange.at(-1) ?? null;
  const latestAvg7 = latest ? rollingAverage(sorted, latest.date) : null;
  const prevAvg7 = latest ? rollingAverage(sorted, addDays(latest.date, -7)) : null;

  let averageWeeklyRateKg: number | null = null;
  if (points.length >= 2) {
    const first = points[0]!;
    const last = points.at(-1)!;
    const days = Math.max(1, toEpochDay(last.date) - toEpochDay(first.date));
    averageWeeklyRateKg = r2(((last.avg7 - first.avg7) / days) * 7);
  }

  return {
    points,
    stats: {
      entries: inRange.length,
      latestDate: latest?.date ?? null,
      latestWeightKg: latest?.weightKg ?? null,
      latestAvg7,
      weeklyChangeKg: latestAvg7 !== null && prevAvg7 !== null ? r2(latestAvg7 - prevAvg7) : null,
      averageWeeklyRateKg,
    },
  };
}
