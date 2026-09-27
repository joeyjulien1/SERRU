'use client';

import { useEffect, useRef, useState } from 'react';
import { formatMoney } from '@/lib/format';

type Point = { date: string; cents: number; orders: number };

const HEIGHT = 220;
const M = { top: 12, right: 8, bottom: 26, left: 52 };

function niceStep(max: number, ticks = 4): number {
  if (max <= 0) return 1;
  const raw = max / ticks;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}

function compactMoney(cents: number, currency: string): string {
  const v = cents / 100;
  if (v >= 1000) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(v);
  }
  return formatMoney(cents, currency);
}

const dayLabel = (iso: string) =>
  new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** Bar path with a 4px rounded data-end and a square base. */
function barPath(x: number, y: number, w: number, base: number): string {
  const h = base - y;
  if (h <= 0) return '';
  const r = Math.min(4, w / 2, h);
  return `M${x},${base}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${base}Z`;
}

export function RevenueChart({ data, currency }: { data: Point[]; currency: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const max = Math.max(0, ...data.map((d) => d.cents));
  const step = niceStep(max);
  const top = Math.max(step, Math.ceil(max / step) * step);
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const innerW = Math.max(0, width - M.left - M.right);
  const innerH = HEIGHT - M.top - M.bottom;
  const band = data.length ? innerW / data.length : 0;
  const barW = Math.max(2, Math.min(24, band - 2)); // 2px surface gap between neighbours
  const base = M.top + innerH;
  const y = (v: number) => M.top + innerH - (v / top) * innerH;
  const labelEvery = width < 480 ? 10 : 5;
  const current = active !== null ? data[active] : null;

  return (
    <div>
      <div className="adm-chart-wrap" ref={wrap} onMouseLeave={() => setActive(null)}>
        {width > 0 && (
          <svg className="adm-chart" width={width} height={HEIGHT} role="img" aria-label={`Daily revenue for the last ${data.length} days`}>
            {ticks.map((t) => (
              <g key={t}>
                <line className="grid" x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} />
                <text className="axis-text" x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end">
                  {compactMoney(t, currency)}
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              const cx = M.left + band * i + band / 2;
              return (
                <g key={d.date}>
                  <path className="bar" data-active={active === i} d={barPath(cx - barW / 2, y(d.cents), barW, base)} />
                  {/* Full-height hit target, wider than the bar */}
                  <rect
                    x={M.left + band * i}
                    y={M.top}
                    width={band}
                    height={innerH}
                    fill="transparent"
                    tabIndex={0}
                    aria-label={`${dayLabel(d.date)}: ${formatMoney(d.cents, currency)}, ${d.orders} orders`}
                    onMouseEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                    onTouchStart={() => setActive(i)}
                  />
                  {(i % labelEvery === 0 || i === data.length - 1) && (
                    <text className="axis-text" x={cx} y={HEIGHT - 6} textAnchor="middle">
                      {dayLabel(d.date)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}
        {current && active !== null && (
          <div
            className="adm-tooltip"
            style={{
              left: Math.min(Math.max(M.left + band * active + band / 2, 70), width - 70),
              top: Math.min(y(current.cents), base - 4),
            }}
          >
            <span className="muted">{dayLabel(current.date)}</span>
            <strong>{formatMoney(current.cents, currency)}</strong>
            <span className="muted">
              {current.orders} {current.orders === 1 ? 'order' : 'orders'}
            </span>
          </div>
        )}
      </div>
      <details style={{ marginTop: 10 }}>
        <summary className="adm-help" style={{ cursor: 'pointer' }}>
          View as table
        </summary>
        <div className="adm-table-wrap" style={{ maxHeight: 260, marginTop: 8 }}>
          <table className="adm-table">
            <thead>
              <tr>
                <th>Date</th>
                <th className="num">Orders</th>
                <th className="num">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((d) => (
                <tr key={d.date}>
                  <td>{dayLabel(d.date)}</td>
                  <td className="num">{d.orders}</td>
                  <td className="num">{formatMoney(d.cents, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
