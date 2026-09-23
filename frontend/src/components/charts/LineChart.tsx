import { SeriesPoint } from '../../services/api';

interface LineChartProps {
  data: SeriesPoint[];
  height?: number;
  emptyLabel?: string;
}

export default function LineChart({ data, height = 160, emptyLabel = 'No data yet' }: LineChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-xs text-ink-mute" style={{ height }}>
        {emptyLabel}
      </div>
    );
  }

  const width = 560;
  const pad = { top: 10, right: 8, bottom: 22, left: 28 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const counts = data.map((d) => d.count);
  const maxCount = Math.max(...counts, 1);
  const scores = data.map((d) => d.avg_score).filter((s): s is number => s != null);
  const minScore = scores.length ? Math.min(...scores, 0) : 0;
  const maxScore = scores.length ? Math.max(...scores, 100) : 100;
  const scoreSpan = Math.max(maxScore - minScore, 1);

  const x = (i: number) =>
    pad.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const yCount = (v: number) => pad.top + innerH - (v / maxCount) * innerH;
  const yScore = (v: number) => pad.top + innerH - ((v - minScore) / scoreSpan) * innerH;

  const countPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${yCount(d.count)}`).join(' ');
  const scorePoints = data
    .map((d, i) => (d.avg_score != null ? `${x(i)},${yScore(d.avg_score)}` : null))
    .filter(Boolean) as string[];
  const scorePath = scorePoints.length > 1 ? scorePoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p}`).join(' ') : '';

  const areaPath =
    data.length > 1
      ? `${countPath} L${x(data.length - 1)},${pad.top + innerH} L${x(0)},${pad.top + innerH} Z`
      : '';

  const ticks = [0, Math.ceil(maxCount / 2), maxCount];
  const labelEvery = Math.max(1, Math.ceil(data.length / 6));

  return (
    <div className="w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height }}
        preserveAspectRatio="none"
        role="img"
        aria-label="Validations and average score over time"
      >
        <defs>
          <linearGradient id="cgArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--cg-accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--cg-accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={yCount(t)}
              y2={yCount(t)}
              stroke="#25304A"
              strokeDasharray="3 4"
            />
            <text x={4} y={yCount(t) + 3} fill="#64748B" fontSize="9">
              {t}
            </text>
          </g>
        ))}

        {areaPath && <path d={areaPath} fill="url(#cgArea)" />}
        <path d={countPath} fill="none" stroke="var(--cg-accent)" strokeWidth="2" strokeLinejoin="round" />
        {data.map((d, i) => (
          <circle
            key={`dot-${d.date}`}
            cx={x(i)}
            cy={yCount(d.count)}
            r={data.length <= 14 ? 2.5 : 1.5}
            fill="var(--cg-accent)"
          />
        ))}
        {scorePath && (
          <path
            d={scorePath}
            fill="none"
            stroke="#22c55e"
            strokeWidth="1.5"
            strokeDasharray="4 3"
            strokeLinejoin="round"
          />
        )}

        {data.map((d, i) =>
          i % labelEvery === 0 ? (
            <text key={d.date} x={x(i)} y={height - 6} fill="#64748B" fontSize="9" textAnchor="middle">
              {d.date.slice(5)}
            </text>
          ) : null,
        )}
      </svg>

      <div className="flex items-center gap-4 mt-1 text-[10px] text-ink-mute">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 rounded" style={{ background: 'var(--cg-accent)' }} />
          Validations
        </span>
        {scores.length > 1 && (
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-0.5 rounded bg-emerald-500" />
            Avg score
          </span>
        )}
      </div>
    </div>
  );
}
