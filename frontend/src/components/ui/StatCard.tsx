import { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  accent?: boolean;
  loading?: boolean;
}

export default function StatCard({ label, value, hint, icon, accent, loading }: StatCardProps) {
  return (
    <div className="card p-4 sm:p-5 flex flex-col gap-2 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-mute truncate">{label}</span>
        {icon && <span className={accent ? 'accent-text' : 'text-ink-mute'}>{icon}</span>}
      </div>
      {loading ? (
        <div className="skeleton h-8 w-20" />
      ) : (
        <div className="text-2xl font-semibold text-ink tabular-nums">{value}</div>
      )}
      {hint && <p className="text-xs text-ink-mute truncate">{hint}</p>}
    </div>
  );
}
