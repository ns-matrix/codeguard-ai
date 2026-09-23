import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useValidationStore } from '../stores/validationStore';
import PageHeader from '../components/ui/PageHeader';
import StatusBadge, { statusTone, severityTone } from '../components/ui/StatusBadge';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import { ListSkeleton } from '../components/ui/Skeleton';
import { Clock, Search, FileCode, ChevronRight } from 'lucide-react';

const STATUS_FILTERS = ['all', 'passed', 'warning', 'error'] as const;

export default function History() {
  const navigate = useNavigate();
  const { history, historyLoading, loadHistory } = useValidationStore();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('all');
  const [langFilter, setLangFilter] = useState('all');

  useEffect(() => {
    loadHistory();
  }, []);

  const languages = useMemo(
    () => [...new Set(history.map((h) => h.language))].sort(),
    [history],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return history.filter((h) => {
      if (statusFilter !== 'all' && h.status !== statusFilter) return false;
      if (langFilter !== 'all' && h.language !== langFilter) return false;
      if (q) {
        const hay = `${h.language} ${h.model} ${h.status} ${h.id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [history, query, statusFilter, langFilter]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-5">
      <PageHeader title="Validation history" description="Every run stored with its issues, score, and code." />

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-mute pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search language, model, id…"
            className="w-full rounded-lg border border-line bg-dark-900 pl-9 pr-3 py-2 text-sm text-ink placeholder:text-ink-mute focus:outline-none focus:border-[var(--cg-accent)]"
            aria-label="Search history"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                statusFilter === s
                  ? 'accent-bg-soft accent-border accent-text'
                  : 'border-line text-ink-mute hover:text-ink hover:bg-dark-800'
              }`}
            >
              {s === 'all' ? 'All' : s}
            </button>
          ))}
          {languages.length > 1 && (
            <select
              value={langFilter}
              onChange={(e) => setLangFilter(e.target.value)}
              className="rounded-lg border border-line bg-dark-900 px-3 py-2 text-xs text-ink-soft focus:outline-none"
              aria-label="Filter by language"
            >
              <option value="all">All languages</option>
              {languages.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {historyLoading && history.length === 0 ? (
        <ListSkeleton rows={6} />
      ) : history.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Clock className="w-10 h-10" />}
            title="No validations yet"
            description="Validate some code and it will show up here."
            action={
              <button
                onClick={() => navigate('/validate')}
                className="btn-primary rounded-lg px-4 py-2 text-sm font-medium"
              >
                Go to validator
              </button>
            }
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Search className="w-10 h-10" />}
            title="No matching validations"
            description="Try a different search or filter."
          />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((h) => (
            <button
              key={h.id}
              onClick={() => navigate(`/history/${h.id}`)}
              className="card w-full p-3.5 sm:p-4 flex items-center gap-3 text-left hover:border-[var(--cg-accent)]/50 transition-colors group"
            >
              <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
                <StatusBadge tone={statusTone(h.status)}>{h.status}</StatusBadge>
                <span className="text-xs px-1.5 py-0.5 rounded bg-dark-800 text-ink-soft capitalize">
                  {h.language}
                </span>
                <span className="text-xs text-ink-mute truncate hidden sm:inline">{h.model}</span>
                <div className="flex gap-1">
                  {(['critical', 'high', 'medium'] as const).map((sev) => {
                    const count = h[sev] ?? 0;
                    if (!count) return null;
                    return (
                      <StatusBadge key={sev} tone={severityTone(sev)}>
                        {count} {sev}
                      </StatusBadge>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                <span className="text-sm tabular-nums text-ink-soft">
                  {h.score != null ? `${h.score}/100` : '—'}
                </span>
                <span className="text-xs tabular-nums text-ink-mute hidden sm:inline">
                  {h.total_issues ?? h.issues?.length ?? 0} issues
                </span>
                <span className="text-xs text-ink-mute hidden md:inline">
                  {h.created_at ? new Date(h.created_at).toLocaleString() : ''}
                </span>
                <FileCode className="w-4 h-4 text-ink-mute group-hover:accent-text transition-colors" />
                <ChevronRight className="w-4 h-4 text-ink-mute group-hover:text-ink transition-colors" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
