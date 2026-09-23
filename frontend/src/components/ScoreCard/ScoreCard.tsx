import { CheckCircle, AlertTriangle, XCircle, Shield, Timer } from 'lucide-react';

interface ScoreCardProps {
  score: number | null;
  status: string;
  language: string;
  totalIssues: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  durationMs?: number | null;
}

export default function ScoreCard({
  score, status, language, totalIssues, critical, high, medium, low, durationMs,
}: ScoreCardProps) {
  const getScoreColor = (s: number) => {
    if (s >= 90) return 'text-emerald-400';
    if (s >= 70) return 'text-amber-400';
    if (s >= 50) return 'text-orange-400';
    return 'text-red-400';
  };

  const getScoreRing = (s: number) => {
    const color = s >= 90 ? '#22c55e' : s >= 70 ? '#eab308' : s >= 50 ? '#f97316' : '#ef4444';
    const circumference = 2 * Math.PI * 45;
    const offset = circumference - (s / 100) * circumference;
    return { color, circumference, offset };
  };

  const ring = getScoreRing(score ?? 0);
  const Icon = status === 'passed' ? CheckCircle : status === 'error' ? XCircle : AlertTriangle;

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-start gap-4 sm:gap-5">
        <div className="relative shrink-0">
          <svg width="84" height="84" className="-rotate-90">
            <circle cx="42" cy="42" r="37" fill="none" stroke="#1e293b" strokeWidth="7" />
            <circle
              cx="42"
              cy="42"
              r="37"
              fill="none"
              stroke={ring.color}
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={ring.circumference}
              strokeDashoffset={ring.offset}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-xl font-bold ${getScoreColor(score ?? 0)}`}>
              {score ?? '—'}
            </span>
          </div>
        </div>

        <div className="flex-1 space-y-2 min-w-0">
          <div className="flex items-center gap-2">
            <Icon className={`w-4 h-4 shrink-0 ${
              status === 'passed' ? 'text-emerald-400' :
              status === 'error' ? 'text-red-400' : 'text-amber-400'
            }`} />
            <span className="text-sm font-medium capitalize text-ink">
              {status === 'passed' ? 'All clear' : status}
            </span>
            <span className="text-xs text-ink-mute capitalize truncate">· {language}</span>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-mute">
            <span>
              Issues <span className="text-ink-soft tabular-nums">{totalIssues}</span>
            </span>
            {durationMs != null && (
              <span className="inline-flex items-center gap-1">
                <Timer className="w-3 h-3" />
                <span className="tabular-nums">{(durationMs / 1000).toFixed(2)}s</span>
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            {critical > 0 && (
              <span className="flex items-center gap-1 text-red-400">
                <XCircle className="w-3 h-3" /> {critical} critical
              </span>
            )}
            {high > 0 && (
              <span className="flex items-center gap-1 text-orange-400">
                <AlertTriangle className="w-3 h-3" /> {high} high
              </span>
            )}
            {medium > 0 && (
              <span className="flex items-center gap-1 text-amber-400">
                <AlertTriangle className="w-3 h-3" /> {medium} med
              </span>
            )}
            {low > 0 && (
              <span className="flex items-center gap-1 text-blue-400">
                <Shield className="w-3 h-3" /> {low} low
              </span>
            )}
            {totalIssues === 0 && (
              <span className="text-emerald-400">No issues detected</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
