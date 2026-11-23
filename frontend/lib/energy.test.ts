import { describe, expect, it } from "vitest";
import { ageFromBirthYear, birthYearFromAge, bmr, energyTargets, perKgFromProtein, proteinFromPerKg } from "./energy";
import { macrosForAmount, sumMacros } from "./nutrition";
import { addDays, isoWeekday, startOfWeek, weekDates } from "./dates";

const owner = { sex: "male" as const, ageYears: 27, weightKg: 98, heightCm: 173 };

describe("energy (same formulas as the prototype)", () => {
  it("Mifflin–St Jeor BMR for 98 kg / 173 cm / 27 y male = 1,931", () => {
    // 980 + 1081.25 − 135 + 5 = 1931.25
    expect(bmr(owner)).toBe(1931);
  });

  it("female constant is −161", () => {
    expect(bmr({ ...owner, sex: "female" })).toBe(1765);
  });

  it("TDEE ×1.34 = 2,588; steady cut −350 → 2,240 kcal, −0.32 kg/week", () => {
    const t = energyTargets({ ...owner, activity: 1.34, offsetKcal: -350 });
    expect(t).toMatchObject({ bmr: 1931, tdee: 2588, recommendedKcal: 2240 });
    expect(t.weeklyKg).toBeCloseTo(-0.318, 3);
  });

  it("never recommends below 1,200 kcal", () => {
    expect(
      energyTargets({ ...owner, weightKg: 45, heightCm: 150, activity: 1.2, offsetKcal: -800 }).recommendedKcal,
    ).toBe(1200);
  });

  it("protein g/kg conversions", () => {
    expect(proteinFromPerKg(98, 1.63)).toBe(160);
    expect(perKgFromProtein(98, 160)).toBeCloseTo(1.633, 3);
    expect(perKgFromProtein(0, 160)).toBe(0);
  });

  it("age ↔ birth year", () => {
    const now = new Date(2026, 10, 23);
    expect(birthYearFromAge(27, now)).toBe(1999);
    expect(ageFromBirthYear(1999, now)).toBe(27);
  });
});

describe("nutrition preview (mirrors the backend)", () => {
  it("per 100 g, per 100 ml and per unit", () => {
    expect(macrosForAmount({ basis: "per_100g", per: { kcal: 140, proteinG: 18, carbsG: 3, fatG: 6 } }, 150)).toEqual({
      kcal: 210,
      proteinG: 27,
      carbsG: 4.5,
      fatG: 9,
    });
    expect(
      macrosForAmount({ basis: "per_100ml", per: { kcal: 65.1, proteinG: 5.56, carbsG: null, fatG: null } }, 450),
    ).toEqual({ kcal: 293, proteinG: 25, carbsG: null, fatG: null });
    expect(
      macrosForAmount({ basis: "per_unit", per: { kcal: 72, proteinG: 6.3, carbsG: 0.4, fatG: 4.8 } }, 2),
    ).toMatchObject({ kcal: 144, proteinG: 12.6 });
  });

  it("totals flag unknown carbs/fat instead of counting them as 0", () => {
    const t = sumMacros([
      { kcal: 156, proteinG: 5.2, carbsG: 26.8, fatG: 2.8 },
      { kcal: 293, proteinG: 25, carbsG: null, fatG: null },
    ]);
    expect(t).toMatchObject({ kcal: 449, proteinG: 30.2, carbsG: 26.8, carbsComplete: false });
  });
});

describe("dates (local calendar)", () => {
  it("weekday and week boundaries", () => {
    expect(isoWeekday("2026-11-23")).toBe(1); // Monday
    expect(isoWeekday("2026-11-29")).toBe(7); // Sunday
    expect(startOfWeek("2026-11-26")).toBe("2026-11-23");
    expect(weekDates("2026-11-29")).toEqual([
      "2026-11-23",
      "2026-11-24",
      "2026-11-25",
      "2026-11-26",
      "2026-11-27",
      "2026-11-28",
      "2026-11-29",
    ]);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});
