import { BackendStatus } from "@/components/BackendStatus";

/**
 * Phase 1 foundation page. Replaced by the real dashboard in Phase 4.
 * It renders the brand shell and performs a live health check against the
 * backend so we can verify the frontend → backend connection.
 */
export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 px-4 py-12">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">FitPal</h1>
          <p className="text-sm text-slate-500">Fat Loss + Muscle Plan</p>
        </div>
      </div>

      <section className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <h2 className="text-base font-semibold text-slate-900">Project foundation</h2>
        <p className="text-sm text-slate-600">
          The application screens are being built in phases. This page checks that the frontend can reach the backend
          API.
        </p>
        <BackendStatus />
      </section>
    </main>
  );
}
