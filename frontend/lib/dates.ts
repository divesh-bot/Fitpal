/**
 * Calendar-date helpers. Dates are plain "YYYY-MM-DD" strings in the user's
 * LOCAL time zone — "today" in Mumbai is not the server's UTC date.
 */

const pad = (n: number) => String(n).padStart(2, "0");

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const todayISO = () => toISODate(new Date());

/** Parses "YYYY-MM-DD" as a local date (noon avoids DST edge cases). */
export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, m! - 1, d!, 12);
}

export function addDays(iso: string, n: number): string {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export const isoWeekday = (iso: string) => ((fromISODate(iso).getDay() + 6) % 7) + 1;

/** Monday of the week containing the date. */
export const startOfWeek = (iso: string) => addDays(iso, 1 - isoWeekday(iso));

export const weekDates = (iso: string) => Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(iso), i));

export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const WEEKDAY_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

/** "Mon, 23 Nov" */
export function formatShort(iso: string): string {
  return fromISODate(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

/** "23 Nov 2026" */
export function formatLong(iso: string): string {
  return fromISODate(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export const isFuture = (iso: string) => iso > todayISO();
