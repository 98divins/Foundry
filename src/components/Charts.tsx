import { useWidth } from '../hooks';
import { niceTicks } from '../utils';
import { locale, t } from '../i18n';

export interface Point {
  x: number;
  y: number;
}

const H = 190;
const PAD = { top: 14, right: 14, bottom: 26, left: 44 };

export function LineChart({
  points,
  format,
  scatter = [],
  emptyText = t('Log this exercise in at least two workouts to see the trend.'),
}: {
  points: Point[];
  format: (v: number) => string;
  /** Raw readings drawn as faint dots behind the line (e.g. daily scale weight). */
  scatter?: Point[];
  emptyText?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  if (points.length < 2) {
    return (
      <div className="chart-empty muted">
        {emptyText}
      </div>
    );
  }
  const w = Math.max(width, 200);
  const ys = [...points, ...scatter].map((p) => p.y);
  const ticks = niceTicks(Math.min(...ys), Math.max(...ys), 4);
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const xMin = points[0].x;
  const xMax = points[points.length - 1].x;
  const sx = (x: number) => PAD.left + ((x - xMin) / (xMax - xMin || 1)) * (w - PAD.left - PAD.right);
  const sy = (y: number) => PAD.top + (1 - (y - yMin) / (yMax - yMin || 1)) * (H - PAD.top - PAD.bottom);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join('');
  const area = `${line}L${sx(xMax).toFixed(1)},${sy(yMin)}L${sx(xMin).toFixed(1)},${sy(yMin)}Z`;
  const last = points[points.length - 1];
  const fmtD = (t: number) => new Date(t).toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
  const xLabels = points.length > 2 ? [xMin, (xMin + xMax) / 2, xMax] : [xMin, xMax];

  return (
    <div ref={ref} className="chart">
      {width > 0 && (
        <svg width={w} height={H} role="img" aria-label={t('Progress chart')}>
          <defs>
            <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--accent)" stopOpacity="0.32" />
              <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={w - PAD.right} y1={sy(t)} y2={sy(t)} stroke="var(--line)" strokeDasharray="2 4" />
              <text x={PAD.left - 8} y={sy(t) + 4} textAnchor="end" className="chart-label">
                {format(t)}
              </text>
            </g>
          ))}
          {xLabels.map((x, i) => (
            <text
              key={i}
              x={sx(x)}
              y={H - 6}
              textAnchor={i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle'}
              className="chart-label"
            >
              {fmtD(x)}
            </text>
          ))}
          <path d={area} fill="url(#fill)" />
          {scatter.map((p, i) => (
            <circle key={'s' + i} cx={sx(p.x)} cy={sy(p.y)} r="3" fill="var(--muted)" opacity="0.55" />
          ))}
          <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" />
          {points.length <= 40 && !scatter.length &&
            points.map((p, i) => <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="2.5" fill="var(--accent)" />)}
          <circle cx={sx(last.x)} cy={sy(last.y)} r="5.5" fill="var(--bg)" stroke="var(--accent)" strokeWidth="3" />
        </svg>
      )}
    </div>
  );
}

export function BarChart({ bars, highlightLast = true }: { bars: { label: string; value: number }[]; highlightLast?: boolean }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const h = 140;
  const top = 18;
  const bottom = 22;
  const max = Math.max(1, ...bars.map((b) => b.value));
  const w = Math.max(width, 200);
  const slot = w / bars.length;
  const bw = Math.min(26, slot * 0.62);
  return (
    <div ref={ref} className="chart">
      {width > 0 && (
        <svg width={w} height={h} role="img" aria-label={t('Workouts per week')}>
          <line x1={0} x2={w} y1={h - bottom} y2={h - bottom} stroke="var(--line)" />
          {bars.map((b, i) => {
            const bh = (b.value / max) * (h - top - bottom);
            const x = i * slot + (slot - bw) / 2;
            const on = highlightLast && i === bars.length - 1;
            return (
              <g key={i}>
                <rect
                  x={x}
                  y={h - bottom - bh}
                  width={bw}
                  height={Math.max(bh, b.value ? 2 : 0)}
                  rx="3"
                  fill={on ? 'var(--accent)' : 'var(--bar)'}
                />
                {b.value > 0 && (
                  <text x={x + bw / 2} y={h - bottom - bh - 5} textAnchor="middle" className="chart-label strong">
                    {b.value}
                  </text>
                )}
                {((bars.length - 1 - i) % 2 === 0 || bars.length <= 8) && (
                  <text x={x + bw / 2} y={h - 6} textAnchor="middle" className="chart-label">
                    {b.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

/** Tiny trend line for list rows: no axes, last point emphasised. */
export function Sparkline({ values, width = 96, height = 32 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return <svg width={width} height={height} aria-hidden="true" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = 4;
  const x = (i: number) => pad + (i / (values.length - 1)) * (width - 2 * pad);
  const y = (v: number) => pad + (1 - (v - min) / (max - min || 1)) * (height - 2 * pad);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const last = values.length - 1;
  return (
    <svg width={width} height={height} aria-hidden="true" className="sparkline">
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last)} cy={y(values[last])} r="3" fill="var(--accent)" />
    </svg>
  );
}

/** Radar (spider) chart: one axis per label, current period filled, previous period outlined. */
export function RadarChart({ labels, current, previous }: { labels: string[]; current: number[]; previous?: number[] }) {
  const W = 340;
  const H = 250;
  const cx = W / 2;
  const cy = H / 2;
  const r = 84;
  const max = Math.max(1, ...current, ...(previous ?? []));
  const at = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / labels.length;
    return [cx + Math.cos(a) * r * (v / max), cy + Math.sin(a) * r * (v / max)] as const;
  };
  const poly = (vals: number[]) => vals.map((v, i) => at(i, v).join(',')).join(' ');
  return (
    <svg className="radar" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={labels.map((l, i) => `${l} ${current[i]}`).join(', ')}>
      {[0.25, 0.5, 0.75, 1].map((k) => (
        <polygon key={k} className="radar-grid" points={poly(labels.map(() => max * k))} />
      ))}
      {labels.map((_, i) => {
        const [x, y] = at(i, max);
        return <line key={i} className="radar-grid" x1={cx} y1={cy} x2={x} y2={y} />;
      })}
      {previous && <polygon className="radar-prev" points={poly(previous)} />}
      <polygon className="radar-cur" points={poly(current)} />
      {labels.map((l, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / labels.length;
        const x = cx + Math.cos(a) * (r + 14);
        const y = cy + Math.sin(a) * (r + 16);
        return (
          <text key={l} className="radar-label" x={x} y={y} textAnchor={Math.abs(Math.cos(a)) < 0.2 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end'} dominantBaseline="middle">
            {l}
          </text>
        );
      })}
    </svg>
  );
}
