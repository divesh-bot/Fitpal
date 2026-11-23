/** Honest placeholder for screens still being built (no fake data or dead buttons). */
export function NotBuiltYet() {
  return (
    <div
      role="status"
      className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500"
    >
      This screen is being built in Phase 4 and isn&apos;t available yet. The backend for it is ready.
    </div>
  );
}
