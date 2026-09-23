import { useEffect, useMemo, useRef, useState } from 'react';
import { useValidationStore } from '../stores/validationStore';
import CodeEditor, { EditorMarker } from '../components/CodeEditor/CodeEditor';
import ValidationPanel from '../components/ValidationPanel/ValidationPanel';
import LanguageSelector from '../components/LanguageSelector/LanguageSelector';
import ModelSelector from '../components/ModelSelector/ModelSelector';
import ScoreCard from '../components/ScoreCard/ScoreCard';
import PageHeader from '../components/ui/PageHeader';
import { toast } from '../stores/toastStore';
import { issueLine } from '../services/api';
import { Upload, RotateCcw, AlertTriangle, Sparkles, FileCode, PanelRight, PanelLeft } from 'lucide-react';

const ACCEPT = '.py,.js,.ts,.tsx,.jsx,.java,.c,.cpp,.cs,.go,.rs,.php,.html,.css,.scss,.sql,.json,.yaml,.yml,.sh,.bash,.rb,.kt,.swift,.md';

const SEV_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

export default function Validator() {
  const {
    code, setCode, language, setLanguage, result, detectedLanguage, detectionConfidence,
    detecting, detectLanguageNow, isStale, selectedIssueLine, selectedIssueRange,
    ollamaStatus, loadingAction, validate, formatCode, pendingAutoValidate,
    fixResult, formatResult, explainResult, bugsResult, securityResult, optimizeResult,
    testsResult, docsResult, error, setPendingUpload, clearAllResults,
  } = useValidationStore();

  const fileRef = useRef<HTMLInputElement>(null);
  const [pane, setPane] = useState<'editor' | 'results'>('editor');

  useEffect(() => {
    if (language !== 'auto' || !code.trim()) return;
    const t = setTimeout(() => {
      detectLanguageNow();
    }, 600);
    return () => clearTimeout(t);
  }, [code, language]);

  useEffect(() => {
    if (pendingAutoValidate && code.trim()) {
      validate();
    }
  }, [pendingAutoValidate]);

  const hasAnyResult = !!(
    result || fixResult || formatResult || explainResult || bugsResult ||
    securityResult || optimizeResult || testsResult || docsResult
  );

  const editorLanguage = result?.language || (language !== 'auto' ? language : detectedLanguage) || 'python';

  const markers: EditorMarker[] = useMemo(() => {
    if (!result?.issues?.length) return [];
    return [...result.issues]
      .sort((a, b) => (SEV_RANK[a.severity] ?? 9) - (SEV_RANK[b.severity] ?? 9))
      .map((issue) => {
        const line = issueLine(issue);
        if (!line || line < 1) return null;
        const sev = issue.severity === 'critical' || issue.severity === 'high'
          ? 'error'
          : issue.severity === 'medium'
            ? 'warning'
            : 'info';
        return {
          severity: sev,
          message: `[${issue.severity.toUpperCase()}] ${issue.title}`,
          line,
          column: issue.column && issue.column > 0 ? issue.column : undefined,
          endLine: issue.endLine ?? undefined,
          endColumn: issue.endColumn ?? undefined,
        } as EditorMarker;
      })
      .filter(Boolean) as EditorMarker[];
  }, [result]);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text === 'string') {
        setCode(text);
        toast.success(`Loaded ${file.name} (${text.length.toLocaleString()} chars).`);
        if (window.innerWidth < 1024) setPane('editor');
      }
    };
    reader.onerror = () => toast.error('Could not read that file.');
    reader.readAsText(file);
  };

  const onClear = () => {
    clearAllResults();
    setCode('');
    toast.info('Editor cleared.');
  };

  const onFormatShortcut = () => {
    formatCode();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inEditable =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!loadingAction) validate();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        toast.info('Session auto-saved locally — code is kept in this browser.');
        return;
      }
      if (e.shiftKey && e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        if (!inEditable && !loadingAction) formatCode();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [loadingAction, validate, formatCode]);

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="p-4 sm:p-5 pb-3 border-b border-line shrink-0 space-y-3">
        <PageHeader
          title="Validate"
          description="Analyze, fix, and format code with real Ollama models."
        />
        <div className="flex flex-wrap items-center gap-2">
          <LanguageSelector />
          <ModelSelector />
          {detecting ? (
            <span className="text-xs text-ink-mute animate-pulse">Detecting…</span>
          ) : detectedLanguage && language === 'auto' ? (
            <span className="text-xs text-ink-mute">
              Detected:{' '}
              <span className="text-ink font-medium capitalize">{detectedLanguage}</span>
              {detectionConfidence > 0 && (
                <span className="text-ink-mute"> ({Math.round(detectionConfidence * 100)}%)</span>
              )}
            </span>
          ) : null}

          <div className="flex-1" />

          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = '';
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
          >
            <Upload className="w-3.5 h-3.5" /> Upload
          </button>
          <button
            onClick={onClear}
            className="btn-ghost inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Clear
          </button>
          <button
            onClick={() => validate()}
            disabled={loadingAction !== null || !code.trim()}
            className="btn-primary inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium"
            title="Ctrl+Enter"
          >
            {loadingAction === 'validate' ? (
              <span className="w-3.5 h-3.5 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            Validate
            <kbd className="hidden md:inline text-[10px] opacity-70 font-mono">⌃↵</kbd>
          </button>
        </div>
      </div>

      {isStale && (
        <div className="flex items-center gap-2 px-4 sm:px-5 py-2 bg-amber-500/10 border-b border-amber-500/30 text-amber-400 text-xs animate-slide-in shrink-0">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>Code changed since last validation — results cleared. Validate again to refresh.</span>
        </div>
      )}

      {error && (
        <div className="mx-4 sm:mx-5 mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400 animate-slide-in shrink-0">
          {error}
        </div>
      )}

      <div className="lg:hidden flex border-b border-line shrink-0" role="tablist">
        <button
          role="tab"
          aria-selected={pane === 'editor'}
          onClick={() => setPane('editor')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
            pane === 'editor' ? 'accent-text border-b-2 accent-border' : 'text-ink-mute'
          }`}
        >
          <FileCode className="w-3.5 h-3.5" /> Code
        </button>
        <button
          role="tab"
          aria-selected={pane === 'results'}
          onClick={() => setPane('results')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
            pane === 'results' ? 'accent-text border-b-2 accent-border' : 'text-ink-mute'
          }`}
        >
          <PanelRight className="w-3.5 h-3.5" /> Results
          {result && result.total_issues > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300 text-[10px] tabular-nums">
              {result.total_issues}
            </span>
          )}
        </button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <div
          className={`min-h-0 flex-1 lg:w-1/2 lg:border-r border-line ${
            pane === 'editor' ? 'flex flex-col h-full' : 'hidden lg:flex lg:flex-col'
          }`}
          style={{ minHeight: pane === 'editor' ? undefined : 0 }}
        >
          <div className="flex-1 min-h-[320px] lg:min-h-0 p-3 sm:p-4">
            <CodeEditor
              value={code}
              onChange={setCode}
              language={editorLanguage}
              markers={markers}
              selectedLine={selectedIssueLine}
              selectedColumn={selectedIssueRange?.column ?? null}
              selectedEndLine={selectedIssueRange?.endLine ?? null}
              selectedEndColumn={selectedIssueRange?.endColumn ?? null}
              onValidateShortcut={() => validate()}
              onFormatShortcut={onFormatShortcut}
            />
          </div>
        </div>

        <div
          className={`min-h-0 flex-1 lg:w-1/2 flex flex-col ${
            pane === 'results' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          <div className="p-3 sm:p-4 border-b border-line">
            {result ? (
              <ScoreCard
                score={result.score}
                status={result.status}
                language={result.language}
                totalIssues={result.total_issues}
                critical={result.critical}
                high={result.high}
                medium={result.medium}
                low={result.low}
                durationMs={result.duration_ms}
              />
            ) : (
              <div className="card p-4 text-xs text-ink-mute text-center">
                Run a validation to see score, severity breakdown, and issues here.
                <span className="hidden md:inline"> Shortcuts: Ctrl+Enter validate · Shift+Alt+F format · Ctrl+S save session.</span>
              </div>
            )}
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <ValidationPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
