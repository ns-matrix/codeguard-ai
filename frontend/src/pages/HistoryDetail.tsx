import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useValidationStore } from '../stores/validationStore';
import PageHeader from '../components/ui/PageHeader';
import StatusBadge, { statusTone, severityTone } from '../components/ui/StatusBadge';
import ErrorState from '../components/ui/ErrorState';
import EmptyState from '../components/ui/EmptyState';
import IssueList from '../components/IssueList/IssueList';
import { Skeleton } from '../components/ui/Skeleton';
import { ArrowLeft, Clock, Code2, FileCode, Cpu, Gauge } from 'lucide-react';

export default function HistoryDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    historyDetail, historyDetailLoading, historyDetailError, loadValidation,
    openInValidator,
  } = useValidationStore();

  useEffect(() => {
    if (id) loadValidation(id);
  }, [id]);

  if (historyDetailLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (historyDetailError || !historyDetail) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
        <ErrorState
          title="Validation not found"
          message={historyDetailError || 'This validation record does not exist.'}
          onRetry={() => id && loadValidation(id)}
        >
          <button
            onClick={() => navigate('/history')}
            className="mt-3 text-xs accent-text hover:underline"
          >
            Back to history
          </button>
        </ErrorState>
      </div>
    );
  }

  const v = historyDetail;

  const meta = [
    { icon: FileCode, label: 'Language', value: v.language },
    { icon: Cpu, label: 'Model', value: v.model },
    { icon: Gauge, label: 'Score', value: v.score != null ? `${v.score}/100` : '—' },
    { icon: Code2, label: 'Issues', value: String(v.total_issues ?? v.issues?.length ?? 0) },
    { icon: Clock, label: 'Duration', value: v.duration_ms != null ? `${(v.duration_ms / 1000).toFixed(2)}s` : '—' },
    { icon: Clock, label: 'When', value: v.created_at ? new Date(v.created_at).toLocaleString() : '—' },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <button
          onClick={() => navigate('/history')}
          className="inline-flex items-center gap-1 text-xs text-ink-mute hover:text-ink transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to history
        </button>
        <PageHeader
          title="Validation report"
          description={`Record ${v.id}`}
          actions={
            v.code ? (
              <button
                onClick={() => {
                  openInValidator(v.code!, v.language, true);
                  navigate('/validate');
                }}
                className="btn-primary inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium"
              >
                <Code2 className="w-4 h-4" />
                Open in validator
              </button>
            ) : undefined
          }
        />
      </div>

      <div className="card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <StatusBadge tone={statusTone(v.status)}>{v.status}</StatusBadge>
          {v.syntax_valid != null && (
            <StatusBadge tone={v.syntax_valid ? 'passed' : 'error'}>
              syntax {v.syntax_valid ? 'valid' : 'invalid'}
            </StatusBadge>
          )}
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-3 sm:ml-auto">
          {meta.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-2 min-w-0">
              <Icon className="w-3.5 h-3.5 text-ink-mute shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wide text-ink-mute">{label}</div>
                <div className="text-sm text-ink truncate capitalize" title={value}>{value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {v.code && (
        <div className="card overflow-hidden">
          <div className="px-4 py-2 border-b border-line text-xs font-medium text-ink-mute">
            Submitted code
          </div>
          <pre className="p-4 text-xs code-font overflow-x-auto text-ink-soft max-h-72 whitespace-pre-wrap">
            {v.code}
          </pre>
        </div>
      )}

      <div className="card p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <h3 className="text-sm font-semibold text-ink">
            Issues ({v.issues?.length ?? 0})
          </h3>
          <div className="flex flex-wrap gap-1.5 ml-auto">
            {(['critical', 'high', 'medium', 'low', 'info'] as const).map((sev) => {
              const count = v[sev] ?? v.issues?.filter((i) => i.severity === sev).length ?? 0;
              if (!count) return null;
              return (
                <StatusBadge key={sev} tone={severityTone(sev)}>
                  {count} {sev}
                </StatusBadge>
              );
            })}
          </div>
        </div>
        {v.issues?.length ? (
          <IssueList issues={v.issues} showFilters={v.issues.length > 3} />
        ) : (
          <EmptyState icon={<FileCode className="w-8 h-8" />} title="No issues recorded for this run" />
        )}
      </div>
    </div>
  );
}
