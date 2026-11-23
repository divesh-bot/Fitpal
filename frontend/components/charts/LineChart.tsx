"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

/**
 * Small, dependency-free time-series line chart (SVG), following the dataviz
 * rules: ONE y-axis, a legend for ≥ 2 series, recessive grid, 2px lines,
 * ≥ 8px markers with a surface ring, crosshair + tooltip on hover/keyboard,
 * and a data table for screen readers. Colours validated with the dataviz
 * checker: emerald #059669 (emphasis) vs slate-600 #475569 (context).
 */

export interface Series {
  key: string;
  label: string;
  color: string;
  /** "line" = emphasised 2px line; "dots" = markers joined by a faint line. */
  style: "line" | "dots";
}
export interface Point {
  date: string; // YYYY-MM-DD
  values: Record<string, number | null>;
}

const W = 680;
const H = 220;
const PAD = { l: 44, r: 16, t: 14, b: 28 };
const innerW = W - PAD.l - PAD.r;
const innerH = H - PAD.t - PAD.b;

const shortDate = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${Number(d)}/${Number(m)}`;
};

export function LineChart({
  series,
  points,
  unit,
  ariaLabel,
  format = (v) => v.toFixed(1),
}: {
  series: Series[];
  points: Point[];
  unit: string;
  ariaLabel: string;
  format?: (v: number) => string;
}) {
  const id = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<number | null>(null);

  const { min, max, ticks } = useMemo(() => {
    const vals = points.flatMap((p) => series.map((s) => p.values[s.key])).filter((v): v is number => v !== null);
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    if (!Number.isFinite(lo)) return { min: 0, max: 1, ticks: [] as number[] };
    if (hi - lo < 1.2) {
      lo -= 0.6;
      hi += 0.6;
    } else {
      const m = (hi - lo) * 0.15;
      lo -= m;
      hi += m;
    }
    return { min: lo, max: hi, ticks: [0, 1, 2, 3].map((i) => lo + ((hi - lo) * i) / 3) };
  }, [points, series]);

  if (points.length === 0) return null;

  const x = (i: number) => (points.length === 1 ? PAD.l + innerW / 2 : PAD.l + (i / (points.length - 1)) * innerW);
  const y = (v: number) => PAD.t + innerH - ((v - min) / (max - min)) * innerH;
  const path = (key: string) =>
    points
      .map((p, i) => ({ v: p.values[key], i }))
      .filter((d): d is { v: number; i: number } => d.v !== null)
      .map((d, n) => `${n === 0 ? "M" : "L"} ${x(d.i).toFixed(1)} ${y(d.v).toFixed(1)}`)
      .join(" ");
  const step = Math.max(1, Math.ceil(points.length / 6));

  const onPointer = (e: PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const vx = ((e.clientX - rect.left) / rect.width) * W;
    const i = points.length === 1 ? 0 : Math.round(((vx - PAD.l) / innerW) * (points.length - 1));
    setActive(Math.max(0, Math.min(points.length - 1, i)));
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === "ArrowRight") setActive((a) => Math.min(points.length - 1, (a ?? -1) + 1));
    else if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? points.length) - 1));
    else if (e.key === "Escape") setActive(null);
    else return;
    e.preventDefault();
  };

  const ap = active !== null ? points[active] : null;
  const tipLeft = active !== null ? (x(active) / W) * 100 : 0;

  return (
    <figure className="space-y-2">
      <div className="flex flex-wrap items-center justify-end gap-4 px-2 text-xs text-slate-500" aria-hidden="true">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            {s.style === "dots" ? (
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            ) : (
              <span className="h-0.5 w-3 rounded-full" style={{ background: s.color }} />
            )}
            {s.label}
          </span>
        ))}
      </div>

      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="h-56 w-full touch-none overflow-visible outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
          preserveAspectRatio="none"
          role="img"
          aria-label={ariaLabel}
          aria-describedby={`${id}-table`}
          tabIndex={0}
          onPointerMove={onPointer}
          onPointerDown={onPointer}
          onPointerLeave={() => setActive(null)}
          onKeyDown={onKey}
          onBlur={() => setActive(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.l}
                x2={W - PAD.r}
                y1={y(t)}
                y2={y(t)}
                stroke="#e2e8f0"
                strokeDasharray="3 3"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" fontSize={10} fill="#64748b">
                {format(t)}
              </text>
            </g>
          ))}
          {points.map((p, i) =>
            i % step === 0 || i === points.length - 1 ? (
              <text key={p.date} x={x(i)} y={H - 8} textAnchor="middle" fontSize={10} fill="#64748b">
                {shortDate(p.date)}
              </text>
            ) : null,
          )}

          {series.map((s) =>
            points.length > 1 ? (
              <path
                key={s.key}
                d={path(s.key)}
                fill="none"
                stroke={s.style === "dots" ? "#cbd5e1" : s.color}
                strokeWidth={s.style === "dots" ? 1.5 : 2}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ) : null,
          )}
          {series
            .filter((s) => s.style === "dots")
            .map((s) =>
              points.map((p, i) =>
                p.values[s.key] === null ? null : (
                  <circle
                    key={`${s.key}-${p.date}`}
                    cx={x(i)}
                    cy={y(p.values[s.key]!)}
                    r={4}
                    fill={s.color}
                    stroke="#ffffff"
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                  />
                ),
              ),
            )}

          {active !== null && (
            <g pointerEvents="none">
              <line
                x1={x(active)}
                x2={x(active)}
                y1={PAD.t}
                y2={PAD.t + innerH}
                stroke="#94a3b8"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              {series.map((s) => {
                const v = points[active]!.values[s.key];
                return v === null ? null : (
                  <circle
                    key={s.key}
                    cx={x(active)}
                    cy={y(v)}
                    r={5}
                    fill={s.color}
                    stroke="#ffffff"
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </g>
          )}
        </svg>

        {ap && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] shadow-md"
            style={{ left: `clamp(70px, ${tipLeft}%, calc(100% - 70px))` }}
          >
            <p className="font-semibold text-slate-900">{ap.date}</p>
            {series.map((s) => (
              <p key={s.key} className="flex items-center gap-1.5 text-slate-600 tabular-nums">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                {s.label}:{" "}
                <span className="font-semibold text-slate-900">
                  {ap.values[s.key] === null ? "—" : `${format(ap.values[s.key]!)} ${unit}`}
                </span>
              </p>
            ))}
          </div>
        )}
      </div>

      <table id={`${id}-table`} className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            {series.map((s) => (
              <th key={s.key} scope="col">
                {s.label} ({unit})
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.date}>
              <th scope="row">{p.date}</th>
              {series.map((s) => (
                <td key={s.key}>{p.values[s.key] === null ? "—" : format(p.values[s.key]!)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
