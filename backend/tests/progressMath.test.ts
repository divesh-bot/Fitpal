import { describe, expect, it } from "vitest";
import { addDays, isoWeekday, rollingAverage, weightTrend, type WeighIn } from "../src/services/progressMath.js";

const series = (start: string, weights: number[]): WeighIn[] =>
  weights.map((w, i) => ({ date: addDays(start, i), weightKg: w }));

describe("dates", () => {
  it("isoWeekday: 2026-11-23 is a Monday, 2026-11-24 a Tuesday, 2026-11-29 a Sunday", () => {
    expect(isoWeekday("2026-11-23")).toBe(1);
    expect(isoWeekday("2026-11-24")).toBe(2);
    expect(isoWeekday("2026-11-29")).toBe(7);
  });
  it("addDays crosses month and year boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("rollingAverage (calendar 7-day window)", () => {
  const data = series("2026-11-01", [98.4, 98.2, 98.5, 98.0, 97.8, 98.1, 97.6, 97.5, 97.7, 97.3]);

  it("averages the 7 days ending on the date", () => {
    // 11-04 … 11-10: 98.0 97.8 98.1 97.6 97.5 97.7 97.3 → 97.714…
    expect(rollingAverage(data, "2026-11-10")).toBe(97.71);
  });

  it("uses fewer points at the start of the history", () => {
    expect(rollingAverage(data, "2026-11-02")).toBe(98.3);
  });

  it("ignores weigh-ins older than 7 days when days are skipped", () => {
    const sparse: WeighIn[] = [
      { date: "2026-11-01", weightKg: 100 },
      { date: "2026-11-10", weightKg: 98 },
    ];
    expect(rollingAverage(sparse, "2026-11-10")).toBe(98); // the prototype would have given 99
  });

  it("returns null with no weigh-ins in the window", () => {
    expect(rollingAverage(data, "2026-12-31")).toBeNull();
  });
});

describe("weightTrend", () => {
  it("builds points, latest stats and week-over-week change", () => {
    const data = series(
      "2026-11-01",
      [98.4, 98.2, 98.5, 98.0, 97.8, 98.1, 97.6, 97.5, 97.7, 97.3, 97.4, 97.2, 97.0, 97.1],
    );
    const t = weightTrend(data, "2026-11-08", "2026-11-14");
    expect(t.points).toHaveLength(7);
    expect(t.stats).toMatchObject({ entries: 7, latestDate: "2026-11-14", latestWeightKg: 97.1 });
    // avg(11-08…11-14) = 97.31 ; avg(11-01…11-07) = 98.09 → change -0.78
    expect(t.stats.latestAvg7).toBe(97.31);
    expect(t.stats.weeklyChangeKg).toBe(-0.78);
    expect(t.stats.averageWeeklyRateKg).toBeLessThan(0);
  });

  it("handles an empty range", () => {
    expect(weightTrend([], "2026-11-01", "2026-11-30").stats).toMatchObject({
      entries: 0,
      latestWeightKg: null,
      weeklyChangeKg: null,
      averageWeeklyRateKg: null,
    });
  });

  it("needs two entries for a rate", () => {
    const t = weightTrend([{ date: "2026-11-05", weightKg: 98 }], "2026-11-01", "2026-11-30");
    expect(t.stats.averageWeeklyRateKg).toBeNull();
    expect(t.points[0]).toEqual({ date: "2026-11-05", weightKg: 98, avg7: 98 });
  });
});
