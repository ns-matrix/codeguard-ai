import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useValidationStore } from '../stores/validationStore';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import StatusBadge, { statusTone } from '../components/ui/StatusBadge';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import { StatCardSkeleton, ChartSkeleton, ListSkeleton } from '../components/ui/Skeleton';
import ChartCard from '../components/charts/ChartCard';
import LineChart from '../components/charts/LineChart';
import BarList from '../components/charts/BarList';
import { ArrowRight, Shield, Zap, Cpu, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';

const RANGES = [
  { days: 7, label: '7d' },
  { days: 30, label: '30d' },
  { days: 90, label: '90d' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const {
    stats, statsLoading, statsDays, loadStats,
    ollamaStatus, history, loadHistory,
  } = useValidationStore();

  useEffect(() => {
    loadStats(statsDays);
    loadHistory();
  }, []);

  const setRange = (days: number) => {
    loadStats(days);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Dashboard"
        description="LLM-powered code validation & review — real Ollama analysis, deterministic scoring."
        actions={
          <button
            onClick={() => navigate('/validate')}
            className="btn-primary inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium"
          >
            Start validating
            <ArrowRight className="w-4 h-4" />
          </button>
        }
      />

      {!ollamaStatus?.connected && ollamaStatus !== null && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <Zap className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
          <div className="text-sm text-red-300">
            <span className="font-semibold">Ollama is offline.</span>{' '}
            AI analysis will not work. Start it with{' '}
            <code className="px-1 py-0.5 rounded bg-dark-900 text-red-200 text-xs">ollama serve</code>
            {' '}and ensure a model is pulled (e.g.{' '}
            <code className="px-1 py-0.5 rounded bg-dark-900 text-red-200 text-xs">ollama pull deepseek-r1:7b-fast</code>).
            {ollamaStatus.error && <span className="block mt-1 text-xs text-red-400/80">{ollamaStatus.error}</span>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statsLoading && !stats ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              label="Validations"
              value={stats?.total_validations ?? 0}
              hint={`${stats?.validations_today ?? 0} today`}
              icon={<Shield className="w-4 h-4" />}
              accent
            />
            <StatCard
              label="Issues found"
              value={stats?.issues_found ?? 0}
              hint={`${stats?.critical_issues ?? 0} critical`}
              icon={<AlertTriangle className="w-4 h-4" />}
            />
            <StatCard
              label="Avg score"
              value={stats?.average_score != null ? `${stats.average_score}` : '—'}
              hint={`Last ${statsDays} days`}
              icon={<CheckCircle2 className="w-4 h-4" />}
            />
            <StatCard
              label="Ollama models"
              value={ollamaStatus?.models?.length ?? 0}
              hint={ollamaStatus?.connected ? 'Connected' : 'Offline'}
              icon={<Cpu className="w-4 h-4" />}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <ChartCard
          title="Validation activity"
          subtitle={`Count and avg score over the last ${statsDays} days`}
          className="xl:col-span-2"
          action={
            <div className="flex rounded-lg border border-line overflow-hidden text-xs">
              {RANGES.map(({ days, label }) => (
                <button
                  key={days}
                  onClick={() => setRange(days)}
                  className={`px-2.5 py-1 transition-colors ${
                    statsDays === days ? 'accent-bg text-white' : 'text-ink-mute hover:text-ink hover:bg-dark-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          }
        >
          {statsLoading && !stats ? (
            <ChartSkeleton />
          ) : (
            <LineChart data={stats?.series ?? []} emptyLabel="No validations in this range yet" />
          )}
        </ChartCard>

        <ChartCard title="Severity breakdown" subtitle={`Issues in the last ${statsDays} days`}>
          {statsLoading && !stats ? (
            <ChartSkeleton />
          ) : (
            <BarList
              items={(['critical', 'high', 'medium', 'low', 'info'] as const)
                .map((sev) => ({ label: sev, count: stats?.severity_counts?.[sev] ?? 0 }))}
              emptyLabel="No issues recorded yet"
            />
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <ChartCard title="Languages" subtitle={`Validated in the last ${statsDays} days`}>
          {statsLoading && !stats ? (
            <ChartSkeleton />
          ) : (
            <BarList
              items={(stats?.languages ?? []).map((l) => ({ label: l.language, count: l.count }))}
              emptyLabel="No languages validated yet"
            />
          )}
        </ChartCard>

        <ChartCard title="Security categories" subtitle={`Findings in the last ${statsDays} days`}>
          {statsLoading && !stats ? (
            <ChartSkeleton />
          ) : (
            <BarList
              items={(stats?.security_categories ?? []).map((s) => ({ label: s.category, count: s.count }))}
              emptyLabel="No security findings yet"
            />
          )}
        </ChartCard>

        <ChartCard title="Status mix" subtitle="All-time validation outcomes">
          {statsLoading && !stats ? (
            <ChartSkeleton />
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {([
                { key: 'passed', label: 'Passed', icon: CheckCircle2, cls: 'text-emerald-400' },
                { key: 'warning', label: 'Warning', icon: AlertTriangle, cls: 'text-amber-400' },
                { key: 'error', label: 'Error', icon: Zap, cls: 'text-red-400' },
              ] as const).map(({ key, label, icon: Icon, cls }) => (
                <div key={key} className="rounded-lg border border-line bg-dark-900 p-3 text-center">
                  <Icon className={`w-4 h-4 mx-auto mb-1.5 ${cls}`} />
                  <div className="text-lg font-semibold text-ink tabular-nums">
                    {stats?.status_counts?.[key] ?? 0}
                  </div>
                  <div className="text-[11px] text-ink-mute">{label}</div>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </div>

      <ChartCard
        title="Recent validations"
        subtitle="Click a row to open the full report"
        action={
          history.length > 0 ? (
            <button
              onClick={() => navigate('/history')}
              className="text-xs accent-text hover:underline"
            >
              View all
            </button>
          ) : undefined
        }
      >
        {statsLoading && !stats && history.length === 0 ? (
          <ListSkeleton rows={4} />
        ) : (stats?.recent?.length ?? 0) === 0 && history.length === 0 ? (
          <EmptyState
            icon={<Clock className="w-10 h-10" />}
            title="No validations yet"
            description="Paste some code into the validator to see results here."
            action={
              <button
                onClick={() => navigate('/validate')}
                className="btn-primary rounded-lg px-4 py-2 text-sm font-medium"
              >
                Open validator
              </button>
            }
          />
        ) : (
          <div className="divide-y divide-line -mx-1">
            {(stats?.recent?.length ? stats.recent : history.slice(0, 8)).map((h) => (
              <button
                key={h.id}
                onClick={() => navigate(`/history/${h.id}`)}
                className="w-full flex flex-wrap items-center gap-2 sm:gap-3 px-1 py-2.5 text-left hover:bg-dark-800/60 rounded-lg transition-colors"
              >
                <StatusBadge tone={statusTone(h.status)}>{h.status}</StatusBadge>
                <span className="text-xs px-1.5 py-0.5 rounded bg-dark-800 text-ink-soft capitalize">
                  {h.language}
                </span>
                <span className="text-xs text-ink-mute truncate flex-1 min-w-0">
                  {h.model}
                </span>
                <span className="text-xs tabular-nums text-ink-soft">
                  {h.score != null ? `${h.score}/100` : '—'}
                </span>
                <span className="text-xs tabular-nums text-ink-mute">
                  {h.total_issues ?? h.issues?.length ?? 0} issues
                </span>
                <span className="hidden sm:block text-xs text-ink-mute">
                  {h.created_at ? new Date(h.created_at).toLocaleString() : ''}
                </span>
              </button>
            ))}
          </div>
        )}
      </ChartCard>
    </div>
  );
}
