"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { LogoMark } from "./Logo";
import { useAuth } from "@/features/auth/AuthProvider";
import { useTargets } from "@/services/queries";
import { todayISO } from "@/lib/dates";
import { fmtInt } from "@/lib/format";

/** Icons copied from the prototype's navigation (Heroicons outline paths). */
const NAV = [
  {
    href: "/today/",
    label: "Today",
    short: "Today",
    d: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  },
  {
    href: "/calculator/",
    label: "Calculator",
    short: "Calc",
    d: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z",
  },
  {
    href: "/progress/",
    label: "Log & Progress",
    short: "Progress",
    d: "M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z",
  },
  {
    href: "/grocery/",
    label: "Grocery List",
    short: "Grocery",
    d: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
  },
  {
    href: "/plan/",
    label: "Plan & Rules",
    short: "Plan",
    d: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  },
] as const;

const Icon = ({ d, className }: { d: string; className: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { state, signOut } = useAuth();
  const targets = useTargets(todayISO());
  const active = (href: string) => pathname === href || pathname === href.slice(0, -1) || pathname.startsWith(href);
  const current = NAV.find((n) => active(n.href));
  const email = state.status === "signedIn" ? state.session.user.email : null;
  const t = targets.data;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="z-30 hidden border-r border-slate-200/80 bg-white md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col">
        <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-6">
          <LogoMark />
          <div>
            <p className="text-base leading-tight font-bold tracking-tight text-slate-900">FitPal</p>
            <p className="text-xs text-slate-500">Fat Loss + Muscle Plan</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-5" aria-label="Main">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active(n.href) ? "page" : undefined}
              className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition-colors ${
                active(n.href)
                  ? "bg-emerald-50 font-semibold text-emerald-700"
                  : "font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Icon d={n.d} className="h-5 w-5" />
              <span>{n.label}</span>
            </Link>
          ))}
        </nav>
        <div className="m-3 rounded-xl border border-slate-200/70 bg-slate-50 p-4">
          <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold text-slate-700">Daily Targets</span>
            <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-700">PPL</span>
          </div>
          {t ? (
            <div className="flex items-center justify-between text-xs text-slate-600 tabular-nums">
              <span>{fmtInt(t.caloriesKcal)} kcal</span>
              <span className="text-slate-300">&bull;</span>
              <span>{t.proteinG}g P</span>
              <span className="text-slate-300">&bull;</span>
              <span>{Math.round(t.steps / 1000)}k steps</span>
            </div>
          ) : (
            <p className="text-xs text-slate-400">{targets.isError ? "Couldn't load targets" : "Loading…"}</p>
          )}
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-200/70 pt-3">
            <span className="truncate text-[11px] text-slate-500" title={email ?? undefined}>
              {email}
            </span>
            <button
              type="button"
              onClick={signOut}
              className="shrink-0 text-[11px] font-semibold text-slate-600 hover:text-rose-700"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center gap-2.5">
          <LogoMark size="sm" />
          <div>
            <p className="text-sm leading-tight font-bold text-slate-900">FitPal</p>
            <p className="text-[11px] text-slate-500 tabular-nums">
              {t ? `${fmtInt(t.caloriesKcal)} kcal • ${t.proteinG}g Protein` : " "}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
            {current?.label ?? "FitPal"}
          </span>
          <button
            type="button"
            onClick={signOut}
            className="rounded-full px-2 py-1 text-xs font-semibold text-slate-500 hover:text-rose-700"
            aria-label="Sign out"
          >
            Sign out
          </button>
        </div>
      </header>

      <main id="main" className="flex-1 pb-24 md:pb-12 md:pl-64">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 md:py-8 lg:px-8">{children}</div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 gap-0.5 border-t border-slate-200/80 bg-white/95 px-1.5 py-1.5 backdrop-blur md:hidden"
        aria-label="Main"
      >
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active(n.href) ? "page" : undefined}
            className={`flex flex-col items-center justify-center rounded-xl py-1.5 text-[10px] transition-colors ${
              active(n.href)
                ? "bg-emerald-50/70 font-semibold text-emerald-700"
                : "font-medium text-slate-500 hover:text-slate-800"
            }`}
          >
            <Icon d={n.d} className="mb-0.5 h-5 w-5" />
            <span>{n.short}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
