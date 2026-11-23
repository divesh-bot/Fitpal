"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/Card";
import { BuilderPanel } from "@/features/calculator/BuilderPanel";
import { TdeePanel } from "@/features/calculator/TdeePanel";

export default function CalculatorPage() {
  const [tab, setTab] = useState<"builder" | "tdee">("builder");
  const tabClass = (active: boolean) =>
    `flex-1 rounded-xl px-4 py-2 text-xs transition-all sm:flex-none sm:text-sm ${active ? "bg-slate-900 font-semibold text-white" : "font-medium text-slate-600 hover:text-slate-900"}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calorie & Macro Calculator"
        subtitle="Build new Indian meals from the food database or recalculate your BMR & TDEE."
      />
      <div
        className="inline-flex w-full rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] sm:w-auto"
        role="tablist"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "builder"}
          onClick={() => setTab("builder")}
          className={tabClass(tab === "builder")}
        >
          Food &amp; Meal Builder
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "tdee"}
          onClick={() => setTab("tdee")}
          className={tabClass(tab === "tdee")}
        >
          BMR &amp; TDEE Targets
        </button>
      </div>
      {tab === "builder" ? <BuilderPanel /> : <TdeePanel />}
    </div>
  );
}
