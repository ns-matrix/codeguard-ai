import clsx from 'clsx';
import { ReactNode } from 'react';

export type BadgeTone = 'passed' | 'warning' | 'error' | 'critical' | 'high' | 'medium' | 'low' | 'info' | 'neutral';

const TONES: Record<BadgeTone, string> = {
  passed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  error: 'bg-red-500/10 text-red-400 border-red-500/30',
  critical: 'bg-red-500/10 text-red-400 border-red-500/30',
  high: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  low: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  info: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  neutral: 'bg-dark-800 text-ink-soft border-line',
};

export function statusTone(status: string): BadgeTone {
  if (status === 'passed') return 'passed';
  if (status === 'error') return 'error';
  if (status === 'warning') return 'warning';
  return 'neutral';
}

export function severityTone(severity: string): BadgeTone {
  const s = severity.toLowerCase();
  if (s === 'critical' || s === 'high' || s === 'medium' || s === 'low' || s === 'info') {
    return s as BadgeTone;
  }
  return 'info';
}

interface StatusBadgeProps {
  tone: BadgeTone;
  children: ReactNode;
  className?: string;
}

export default function StatusBadge({ tone, children, className }: StatusBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium capitalize',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
