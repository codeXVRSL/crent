'use client';
import { useEffect, useId, useRef, useState } from 'react';

export type TrendPoint = { week: string; value: number };

const H = 200, PAD = { top: 16, right: 56, bottom: 28, left: 44 };

const compact = (n: number, money: boolean) => {
  const v = money ? n / 100 : n;
  const s = Math.abs(v) >= 1000 ? `${Number((v / 1000).toFixed(1))}K` : `${Number(v.toFixed(money && v < 100 ? 2 : 0))}`;
  return money ? `$${s}` : s;
};
const full = (n: number, money: boolean) =>
  money ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n / 100) : n.toLocaleString('en-US');
const weekLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** Clean y-axis maximum: 1, 2, 2.5 or 5 times a power of ten, at or above the data max. */
function niceMax(max: number) {
  if (max <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(max));
  return ([1, 2, 2.5, 5, 10].find((m) => m * p >= max) ?? 10) * p;
}

/**
 * One series over time: 2px line with a 10% area wash, an end dot with a surface ring and its value,
 * hairline grid, a crosshair + tooltip on hover (and arrow keys), and a table view. Color is the
 * validated --chart-1 token; text stays in text tokens.
 */
export function TrendChart({ title, subtitle, points, money = false }: { title: string; subtitle: string; points: TrendPoint[]; money?: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(560);
  const [hover, setHover] = useState<number | null>(null);
  const id = useId();
  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el); return () => ro.disconnect();
  }, []);

  const max = niceMax(Math.max(...points.map((p) => p.value), 0));
  const iw = w - PAD.left - PAD.right, ih = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length <= 1 ? iw : (i / (points.length - 1)) * iw);
  const y = (v: number) => PAD.top + ih - (v / max) * ih;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  const last = points.length - 1;
  const total = points.reduce((a, p) => a + p.value, 0);
  const active = hover ?? null;

  const pick = (clientX: number) => {
    const r = wrap.current?.querySelector('svg')?.getBoundingClientRect(); if (!r) return;
    const rel = ((clientX - r.left) / r.width) * w - PAD.left;
    setHover(Math.max(0, Math.min(last, Math.round((rel / iw) * last))));
  };

  return (
    <figure className="grid gap-2" aria-labelledby={`${id}-t`}>
      <figcaption className="grid gap-0.5">
        <span id={`${id}-t`} className="text-sm font-semibold">{title}</span>
        <span className="text-xs text-muted">{subtitle} · {full(total, money)} in total</span>
      </figcaption>
      <div ref={wrap} className="relative">
        <svg width={w} height={H} role="img" tabIndex={0} className="block max-w-full rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          aria-label={`${title}. Use the left and right arrow keys to read each week.`}
          onPointerMove={(e) => pick(e.clientX)} onPointerLeave={() => setHover(null)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') { e.preventDefault(); setHover((h) => Math.min(last, (h ?? -1) + 1)); }
            if (e.key === 'ArrowLeft') { e.preventDefault(); setHover((h) => Math.max(0, (h ?? last + 1) - 1)); }
            if (e.key === 'Escape') setHover(null);
          }}
          onBlur={() => setHover(null)}>
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line x1={PAD.left} x2={w - PAD.right} y1={y(max * f)} y2={y(max * f)} stroke="var(--line-strong)" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(max * f) + 4} textAnchor="end" className="fill-muted text-[11px]">{compact(max * f, money)}</text>
            </g>
          ))}
          {points.map((p, i) => (i % 3 === 0 || i === last) && (
            <text key={p.week} x={x(i)} y={H - 8} textAnchor={i === last ? 'end' : 'middle'} className="fill-muted text-[11px]">{weekLabel(p.week)}</text>
          ))}
          <path d={area} fill="var(--chart-1)" fillOpacity={0.1} />
          <path d={line} fill="none" stroke="var(--chart-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {active != null && <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + ih} stroke="var(--line-strong)" strokeWidth={1} />}
          {[active ?? last].map((i) => (
            <circle key={i} cx={x(i)} cy={y(points[i].value)} r={4} fill="var(--chart-1)" stroke="var(--surface)" strokeWidth={2} />
          ))}
          {active == null && (
            <text x={x(last) + 8} y={y(points[last].value) + 4} className="fill-ink text-[12px] font-medium">{compact(points[last].value, money)}</text>
          )}
        </svg>
        {active != null && (
          <div role="status" className="pointer-events-none absolute top-1 rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-xs shadow-md"
            style={{ left: Math.min(Math.max(x(active) - 60, 0), w - 140) }}>
            <span className="text-muted">Week of {weekLabel(points[active].week)}</span><br />
            <span className="num font-semibold">{full(points[active].value, money)}</span>
          </div>
        )}
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer text-muted hover:text-ink">Show as table</summary>
        <table className="mt-2 w-full max-w-sm text-left">
          <thead><tr><th className="label py-1">Week of</th><th className="label py-1 text-right">{money ? 'Amount' : 'Count'}</th></tr></thead>
          <tbody>{points.map((p) => <tr key={p.week} className="border-t border-line"><td className="py-1">{weekLabel(p.week)}</td><td className="num py-1 text-right">{full(p.value, money)}</td></tr>)}</tbody>
        </table>
      </details>
    </figure>
  );
}
