import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useValidationStore } from '../stores/validationStore';
import { usePrefsStore, ACCENT_COLORS } from '../stores/prefsStore';
import PageHeader from '../components/ui/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';
import { Skeleton } from '../components/ui/Skeleton';
import { toast } from '../stores/toastStore';
import {
  Server, Cpu, Palette, Monitor, Info, RefreshCw, Check,
} from 'lucide-react';

type Section = 'ollama' | 'models' | 'appearance' | 'editor' | 'about';

const SECTIONS: { id: Section; label: string; icon: typeof Server }[] = [
  { id: 'ollama', label: 'Ollama', icon: Server },
  { id: 'models', label: 'Models', icon: Cpu },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'editor', label: 'Editor', icon: Monitor },
  { id: 'about', label: 'About', icon: Info },
];

export default function Settings() {
  const [params, setParams] = useSearchParams();
  const sectionParam = (params.get('section') || 'ollama') as Section;
  const section = SECTIONS.some((s) => s.id === sectionParam) ? sectionParam : 'ollama';

  const { ollamaStatus, loadModels, config, loadConfig, model, setModel } = useValidationStore();
  const { accent, setAccent, editor, setEditor, reset, sidebarCollapsed, setSidebarCollapsed } = usePrefsStore();
  const [refreshing, setRefreshing] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);

  useEffect(() => {
    loadModels();
    loadConfig().finally(() => setLoadingConfig(false));
  }, []);

  const setSection = (id: Section) => {
    setParams({ section: id }, { replace: true });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadModels();
    setRefreshing(false);
    toast.success('Ollama status refreshed.');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-5">
      <PageHeader
        title="Settings"
        description="Connection, models, appearance, and editor preferences."
        actions={
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh status
          </button>
        }
      />

      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1" role="tablist">
        {SECTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={section === id}
            onClick={() => setSection(id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border whitespace-nowrap transition-colors ${
              section === id
                ? 'accent-bg-soft accent-border accent-text'
                : 'border-line text-ink-mute hover:text-ink hover:bg-dark-800'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {section === 'ollama' && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 accent-text" />
            <h2 className="text-sm font-semibold text-ink">Ollama connection</h2>
          </div>
          <div className="space-y-3 text-sm">
            <Row label="Status">
              {ollamaStatus ? (
                <StatusBadge tone={ollamaStatus.connected ? 'passed' : 'error'}>
                  {ollamaStatus.connected ? 'Connected' : 'Offline'}
                </StatusBadge>
              ) : (
                <Skeleton className="h-5 w-20" />
              )}
            </Row>
            <Row label="Endpoint">
              <span className="code-font text-xs text-ink-soft break-all">
                {ollamaStatus?.endpoint || '—'}
              </span>
            </Row>
            <Row label="Default model">
              <span className="code-font text-xs text-ink-soft">
                {loadingConfig ? <Skeleton className="h-4 w-36 inline-block" /> : config?.default_model || '—'}
              </span>
            </Row>
            <Row label="Active model">
              <span className="code-font text-xs accent-text">{model}</span>
            </Row>
            {ollamaStatus?.error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300 break-words">
                {ollamaStatus.error}
              </div>
            )}
          </div>
        </div>
      )}

      {section === 'models' && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 accent-text" />
            <h2 className="text-sm font-semibold text-ink">Available models</h2>
          </div>
          {!ollamaStatus ? (
            <Skeleton className="h-24 w-full" />
          ) : ollamaStatus.models.length > 0 ? (
            <div className="space-y-2">
              {ollamaStatus.models.map((m) => (
                <button
                  key={m.name}
                  onClick={() => {
                    setModel(m.name);
                    toast.success(`Active model set to ${m.name}.`);
                  }}
                  className={`w-full flex items-center justify-between gap-3 p-3 rounded-lg border transition-colors text-left ${
                    model === m.name
                      ? 'accent-border accent-bg-soft'
                      : 'border-line hover:bg-dark-800'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${model === m.name ? 'accent-bg' : 'bg-emerald-500'}`} />
                    <span className="text-sm font-medium text-ink truncate">{m.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {m.size != null && (
                      <span className="text-xs text-ink-mute">{(m.size / 1e9).toFixed(1)} GB</span>
                    )}
                    {model === m.name && <Check className="w-4 h-4 accent-text" />}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-mute text-center py-6">
              No models found. Make sure Ollama is running and pull one, e.g.{' '}
              <code className="code-font text-xs accent-text">ollama pull deepseek-r1:7b-fast</code>.
            </p>
          )}
        </div>
      )}

      {section === 'appearance' && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 accent-text" />
            <h2 className="text-sm font-semibold text-ink">Accent color</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            {ACCENT_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setAccent(c);
                  toast.success('Accent color updated.');
                }}
                className={`w-9 h-9 rounded-full border-2 transition-transform hover:scale-110 ${
                  accent === c ? 'border-white scale-110' : 'border-transparent'
                }`}
                style={{ background: c }}
                aria-label={`Set accent color ${c}`}
                aria-pressed={accent === c}
              />
            ))}
          </div>
          <div className="space-y-3 pt-2 border-t border-line">
            <Row label="Sidebar">
              <label className="flex items-center gap-2 text-xs text-ink-soft cursor-pointer">
                <input
                  type="checkbox"
                  checked={sidebarCollapsed}
                  onChange={(e) => setSidebarCollapsed(e.target.checked)}
                  className="accent-[var(--cg-accent)]"
                />
                Collapsed by default (desktop)
              </label>
            </Row>
            <div className="pt-1">
              <button
                onClick={() => {
                  reset();
                  toast.info('Preferences reset to defaults.');
                }}
                className="btn-secondary rounded-lg px-3 py-1.5 text-xs font-medium"
              >
                Reset preferences
              </button>
            </div>
          </div>
        </div>
      )}

      {section === 'editor' && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 accent-text" />
            <h2 className="text-sm font-semibold text-ink">Editor</h2>
          </div>
          <div className="space-y-3 text-sm">
            <Row label="Font size">
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={11}
                  max={20}
                  value={editor.fontSize}
                  onChange={(e) => setEditor({ fontSize: Number(e.target.value) })}
                  className="w-32 accent-[var(--cg-accent)]"
                />
                <span className="tabular-nums text-ink-soft text-xs w-8">{editor.fontSize}px</span>
              </div>
            </Row>
            <Toggle
              label="Word wrap"
              checked={editor.wordWrap}
              onChange={(v) => setEditor({ wordWrap: v })}
            />
            <Toggle
              label="Minimap"
              checked={editor.minimap}
              onChange={(v) => setEditor({ minimap: v })}
            />
            <Toggle
              label="Line numbers"
              checked={editor.lineNumbers}
              onChange={(v) => setEditor({ lineNumbers: v })}
            />
          </div>
        </div>
      )}

      {section === 'about' && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 accent-text" />
            <h2 className="text-sm font-semibold text-ink">About & configuration</h2>
          </div>
          <div className="space-y-3 text-sm">
            <Row label="App">
              <span className="text-ink-soft">
                {loadingConfig ? <Skeleton className="h-4 w-40 inline-block" /> : `${config?.app_name || 'CodeGuard AI'} ${config?.app_version ? `v${config.app_version}` : ''}`}
              </span>
            </Row>
            <Row label="LLM timeout">
              <span className="text-ink-soft tabular-nums">
                {loadingConfig ? '—' : config ? `${config.llm_timeout}s` : '—'}
              </span>
            </Row>
            <Row label="Validation timeout">
              <span className="text-ink-soft tabular-nums">
                {loadingConfig ? '—' : config ? `${config.validation_timeout}s` : '—'}
              </span>
            </Row>
            <Row label="Max code length">
              <span className="text-ink-soft tabular-nums">
                {loadingConfig ? '—' : config ? `${config.max_code_length.toLocaleString()} chars` : '—'}
              </span>
            </Row>
            <Row label="Temperature">
              <span className="text-ink-soft tabular-nums">
                {loadingConfig ? '—' : config?.temperature != null ? String(config.temperature) : '—'}
              </span>
            </Row>
            <Row label="Debug">
              <span className="text-ink-soft">{loadingConfig ? '—' : config ? String(config.debug) : '—'}</span>
            </Row>
            {config?.score_penalties && (
              <div className="pt-2 border-t border-line">
                <div className="text-xs uppercase tracking-wide text-ink-mute mb-2">Score penalties</div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(config.score_penalties).map(([sev, pts]) => (
                    <StatusBadge key={sev} tone={sev as any}>
                      {sev}: −{pts}
                    </StatusBadge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-ink-mute">{label}</span>
      <span className="text-right min-w-0">{children}</span>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-ink-mute">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors ${checked ? 'accent-bg' : 'bg-dark-700'}`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}
