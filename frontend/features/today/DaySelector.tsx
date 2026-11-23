"use client";

import { addDays, formatShort, fromISODate, todayISO, WEEKDAY_SHORT, weekDates } from "@/lib/dates";

/**
 * Mon–Sun selector like the prototype, but for REAL dates: each week has its
 * own log. A green dot marks strictly-vegetarian days in the plan.
 */
export function DaySelector({
  date,
  onChange,
  vegWeekdays,
}: {
  date: string;
  onChange: (date: string) => void;
  vegWeekdays: ReadonlySet<number>;
}) {
  const days = weekDates(date);
  const today = todayISO();
  const weekLabel = `${formatShort(days[0]!)} – ${formatShort(days[6]!)}`;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-2 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="mb-1.5 flex items-center justify-between px-1">
        <button
          type="button"
          onClick={() => onChange(addDays(date, -7))}
          className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          aria-label="Previous week"
        >
          ‹ Prev
        </button>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="tabular-nums">{weekLabel}</span>
          {date !== today && (
            <button
              type="button"
              onClick={() => onChange(today)}
              className="rounded-md bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              Today
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => onChange(addDays(date, 7))}
          className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          aria-label="Next week"
        >
          Next ›
        </button>
      </div>
      <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto" role="tablist" aria-label="Day of week">
        {days.map((d, i) => {
          const selected = d === date;
          const veg = vegWeekdays.has(i + 1);
          return (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-label={`${fromISODate(d).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}${veg ? ", strictly vegetarian" : ""}${d === today ? ", today" : ""}`}
              onClick={() => onChange(d)}
              className={`flex min-w-[66px] flex-1 flex-col items-center justify-center rounded-xl px-3 py-1.5 text-xs font-semibold transition-all sm:text-sm ${
                selected
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <span className="flex items-center">
                {WEEKDAY_SHORT[i]}
                {veg && (
                  <span
                    className={`ml-1 inline-block h-1.5 w-1.5 rounded-full ${selected ? "bg-emerald-400" : "bg-emerald-500"}`}
                    aria-hidden="true"
                  />
                )}
              </span>
              <span
                className={`text-[10px] font-medium tabular-nums ${selected ? "text-slate-300" : d === today ? "text-emerald-600" : "text-slate-400"}`}
              >
                {fromISODate(d).getDate()}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
