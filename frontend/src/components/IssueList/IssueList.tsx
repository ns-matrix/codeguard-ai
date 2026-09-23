import { Issue, issueLine } from '../../services/api';
import { AlertTriangle, Shield, AlertCircle, Info, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; border: string; icon: any }> = {
  critical: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', icon: AlertTriangle },
  high: { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', icon: AlertCircle },
  medium: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', icon: AlertTriangle },
  low: { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30', icon: Info },
  info: { color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/30', icon: Info },
};

function locationLabel(issue: Issue): string | null {
  const line = issueLine(issue);
  if (!line) return null;
  if (issue.column && issue.column > 0) {
    return `Line ${line}, Column ${issue.column}`;
  }
  return `Line ${line}`;
}

interface IssueItemProps {
  issue: Issue;
  selected?: boolean;
  onLineClick?: (issue: Issue) => void;
}

function IssueItem({ issue, selected, onLineClick }: IssueItemProps) {
  const [expanded, setExpanded] = useState(false);
  const config = SEVERITY_CONFIG[issue.severity] || SEVERITY_CONFIG.low;
  const Icon = config.icon;
  const line = issueLine(issue);

  return (
    <div className={`rounded-lg border ${config.border} ${config.bg} animate-slide-in ${selected ? 'ring-1 ring-amber-400/60' : ''}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 text-left"
      >
        <Icon className={`w-4 h-4 shrink-0 ${config.color}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-medium uppercase ${config.color}`}>
              {issue.severity}
            </span>
            {line ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(true);
                  onLineClick?.(issue);
                }}
                className="text-xs text-dark-500 hover:text-blue-400 transition-colors cursor-pointer underline underline-offset-2"
              >
                {locationLabel(issue)}
              </button>
            ) : null}
            <span className="text-xs text-dark-500 px-1.5 py-0.5 bg-dark-800 rounded">
              {issue.category}
            </span>
            {issue.source && (
              <span className="text-xs text-dark-600">
                {issue.source}
              </span>
            )}
          </div>
          <p className="text-sm font-medium mt-1 truncate">{issue.title}</p>
        </div>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-dark-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-dark-400" />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 text-sm border-t border-dark-700/50 pt-2">
          {issue.description && (
            <div>
              <span className="text-dark-400 text-xs">Description</span>
              <p className="text-dark-200">{issue.description}</p>
            </div>
          )}
          {issue.evidence && (
            <div>
              <span className="text-dark-400 text-xs">Evidence</span>
              <pre className="text-xs bg-dark-900 p-2 rounded mt-1 code-font overflow-x-auto">
                {issue.evidence}
              </pre>
            </div>
          )}
          {issue.recommendation && (
            <div>
              <span className="text-dark-400 text-xs">Recommendation</span>
              <p className="text-dark-200">{issue.recommendation}</p>
            </div>
          )}
          {issue.confidence !== null && issue.confidence !== undefined && (
            <div className="flex items-center gap-2">
              <span className="text-dark-400 text-xs">Confidence</span>
              <div className="flex-1 h-1.5 bg-dark-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${Math.round((issue.confidence || 0) * 100)}%` }}
                />
              </div>
              <span className="text-xs text-dark-400">{Math.round((issue.confidence || 0) * 100)}%</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface IssueListProps {
  issues: Issue[];
  onLineClick?: (issue: Issue) => void;
  selectedIssueId?: string | null;
  showFilters?: boolean;
}

export default function IssueList({ issues, onLineClick, selectedIssueId, showFilters = true }: IssueListProps) {
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  if (issues.length === 0) {
    return (
      <div className="text-center py-8 text-dark-400">
        <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No issues found</p>
      </div>
    );
  }

  const categories = [...new Set(issues.map(i => i.category))];
  const severities = ['critical', 'high', 'medium', 'low', 'info'];

  const filtered = issues.filter(i => {
    if (severityFilter !== 'all' && i.severity !== severityFilter) return false;
    if (categoryFilter !== 'all' && i.category !== categoryFilter) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    return (order[a.severity as keyof typeof order] ?? 4) - (order[b.severity as keyof typeof order] ?? 4);
  });

  return (
    <div className="space-y-3">
      {showFilters && (
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-1">
            <button
              onClick={() => setSeverityFilter('all')}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                severityFilter === 'all' ? 'bg-dark-600 text-dark-200' : 'text-dark-500 hover:text-dark-300'
              }`}
            >
              All ({issues.length})
            </button>
            {severities.map(sev => {
              const count = issues.filter(i => i.severity === sev).length;
              if (count === 0) return null;
              return (
                <button
                  key={sev}
                  onClick={() => setSeverityFilter(sev)}
                  className={`px-2 py-1 rounded text-xs transition-colors ${
                    severityFilter === sev ? 'bg-dark-600 text-dark-200' : 'text-dark-500 hover:text-dark-300'
                  }`}
                >
                  {sev} ({count})
                </button>
              );
            })}
          </div>
          {categories.length > 1 && (
            <div className="flex gap-1">
              <button
                onClick={() => setCategoryFilter('all')}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  categoryFilter === 'all' ? 'bg-dark-600 text-dark-200' : 'text-dark-500 hover:text-dark-300'
                }`}
              >
                All cats
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2 py-1 rounded text-xs transition-colors ${
                    categoryFilter === cat ? 'bg-dark-600 text-dark-200' : 'text-dark-500 hover:text-dark-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="space-y-2">
        {sorted.map((issue, i) => (
          <IssueItem
            key={issue.id || i}
            issue={issue}
            selected={!!selectedIssueId && issue.id === selectedIssueId}
            onLineClick={onLineClick}
          />
        ))}
      </div>
    </div>
  );
}
