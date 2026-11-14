import { useWidth } from '../hooks';
import { niceTicks } from '../utils';

export interface Point {
  x: number;
  y: number;
}

const H = 190;
const PAD = { top: 14, right: 14, bottom: 26, left: 44 };

export function LineChart({ points, format }: { points: Point[]; format: (v: number) => string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  if (points.length < 2) {
    return (
      <div className="chart-empty muted">
        Log this exercise in at least two workouts to see the trend.
      </div>
    );
  }
  const w = Math.max(width, 200);
  const ys = points.map((p) => p.y);
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
  const fmtD = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const xLabels = points.length > 2 ? [xMin, (xMin + xMax) / 2, xMax] : [xMin, xMax];

  return (
    <div ref={ref} className="chart">
      {width > 0 && (
        <svg width={w} height={H} role="img" aria-label="Progress chart">
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
          <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" />
          {points.length <= 40 &&
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
        <svg width={w} height={h} role="img" aria-label="Workouts per week">
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
