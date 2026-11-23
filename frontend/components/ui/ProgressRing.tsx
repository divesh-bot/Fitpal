const R = 42;
const CIRC = 2 * Math.PI * R; // 263.89, as in the prototype

/** The prototype's SVG progress ring (0–100%, clamped). */
export function ProgressRing({ pct, color, label }: { pct: number; color: string; label: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="relative h-24 w-24 shrink-0" role="img" aria-label={`${label}: ${pct}% of target`}>
      <svg className="h-24 w-24" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={R} stroke="#f1f5f9" strokeWidth="9" fill="none" />
        <circle
          className="progress-ring-circle"
          cx="50"
          cy="50"
          r={R}
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC - (clamped / 100) * CIRC}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-base font-bold text-slate-900 tabular-nums">{pct}%</span>
      </div>
    </div>
  );
}
