import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  api, ValidationResult, OllamaStatus, Issue, HistoryEntry, DashboardStats, AppConfig,
  ExplainResult, BugsResult, SecurityResult, OptimizeResult,
  TestsResult, DocsResult, FixResult, FormatResult, DetectLanguageResponse,
} from '../services/api';
import { toast } from './toastStore';

type LoadingAction = 'validate' | 'fix' | 'explain' | 'bugs' | 'security' | 'optimize' | 'tests' | 'docs' | 'format' | null;

interface IssueRange {
  column: number | null;
  endLine: number | null;
  endColumn: number | null;
}

interface ValidationStore {
  code: string;
  language: string;
  model: string;
  loadingAction: LoadingAction;
  error: string | null;
  result: ValidationResult | null;
  ollamaStatus: OllamaStatus | null;
  config: AppConfig | null;
  detectedLanguage: string;
  detectionConfidence: number;
  detecting: boolean;
  codeHash: string;
  codeVersion: number;
  isStale: boolean;

  history: HistoryEntry[];
  historyLoading: boolean;
  historyDetail: HistoryEntry | null;
  historyDetailLoading: boolean;
  historyDetailError: string | null;

  stats: DashboardStats | null;
  statsLoading: boolean;
  statsDays: number;

  fixResult: FixResult | null;
  formatResult: FormatResult | null;
  explainResult: ExplainResult | null;
  bugsResult: BugsResult | null;
  securityResult: SecurityResult | null;
  optimizeResult: OptimizeResult | null;
  testsResult: TestsResult | null;
  docsResult: DocsResult | null;

  selectedIssueLine: number | null;
  selectedIssueRange: IssueRange | null;
  selectedIssue: Issue | null;

  pendingUpload: boolean;
  pendingAutoValidate: boolean;
  sidebarOpen: boolean;

  setCode: (code: string) => void;
  setLanguage: (lang: string) => void;
  setModel: (model: string) => void;
  setSelectedIssueLine: (line: number | null) => void;
  setSelectedIssue: (issue: Issue | null) => void;
  setSidebarOpen: (open: boolean) => void;
  setPendingUpload: (v: boolean) => void;
  detectLanguageNow: () => Promise<void>;
  validate: () => Promise<void>;
  fixCode: () => Promise<void>;
  applyFix: (fixedCode: string) => Promise<void>;
  rejectFix: () => void;
  formatCode: () => Promise<void>;
  applyFormat: () => Promise<void>;
  cancelFormat: () => void;
  explainCode: () => Promise<void>;
  findBugs: () => Promise<void>;
  securityScan: () => Promise<void>;
  optimizeCode: () => Promise<void>;
  generateTests: () => Promise<void>;
  documentCode: () => Promise<void>;
  loadModels: () => Promise<void>;
  loadConfig: () => Promise<void>;
  loadHistory: () => Promise<void>;
  loadValidation: (id: string) => Promise<void>;
  loadStats: (days?: number) => Promise<void>;
  openInValidator: (code: string, language?: string, autoValidate?: boolean) => void;
  clearResult: () => void;
  clearAllResults: () => void;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}

function hashFor(code: string, language: string): string {
  return simpleHash(code + '|' + language);
}

const SAMPLE_CODE = `def calculate_total(items):
    total = 0
    for item in items:
        total += item["price"]
    return total
`;

function clearAnalysis(set: (partial: Partial<ValidationStore>) => void) {
  set({
    result: null,
    fixResult: null,
    formatResult: null,
    explainResult: null,
    bugsResult: null,
    securityResult: null,
    optimizeResult: null,
    testsResult: null,
    docsResult: null,
    selectedIssueLine: null,
    selectedIssueRange: null,
    selectedIssue: null,
  });
}

export const useValidationStore = create<ValidationStore>()(
  persist(
    (set, get) => ({
      code: SAMPLE_CODE,
      language: 'auto',
      model: 'deepseek-r1:7b-fast',
      loadingAction: null,
      error: null,
      result: null,
      ollamaStatus: null,
      config: null,
      detectedLanguage: '',
      detectionConfidence: 0,
      detecting: false,
      codeHash: '',
      codeVersion: 0,
      isStale: false,

      history: [],
      historyLoading: false,
      historyDetail: null,
      historyDetailLoading: false,
      historyDetailError: null,

      stats: null,
      statsLoading: false,
      statsDays: 30,

      fixResult: null,
      formatResult: null,
      explainResult: null,
      bugsResult: null,
      securityResult: null,
      optimizeResult: null,
      testsResult: null,
      docsResult: null,

      selectedIssueLine: null,
      selectedIssueRange: null,
      selectedIssue: null,

      pendingUpload: false,
      pendingAutoValidate: false,
      sidebarOpen: false,

      setCode: (code) => {
        const { result, fixResult, formatResult, language, codeVersion } = get();
        const hasResults = result !== null || fixResult !== null || formatResult !== null;
        const newHash = hashFor(code, language);
        const changed = newHash !== get().codeHash;
        set({
          code,
          codeVersion: codeVersion + 1,
          isStale: hasResults && changed,
          ...(hasResults && changed ? {
            result: null,
            fixResult: null,
            formatResult: null,
            explainResult: null,
            bugsResult: null,
            securityResult: null,
            optimizeResult: null,
            testsResult: null,
            docsResult: null,
            selectedIssueLine: null,
            selectedIssueRange: null,
            selectedIssue: null,
          } : {}),
        });
      },
      setLanguage: (lang) => {
        set({ language: lang });
        if (lang !== 'auto') {
          set({ detectedLanguage: lang, detectionConfidence: 1 });
        }
      },
      setModel: (model) => set({ model }),
      setSelectedIssueLine: (line) => set({ selectedIssueLine: line }),
      setSelectedIssue: (issue) => {
        if (!issue) {
          set({ selectedIssue: null, selectedIssueLine: null, selectedIssueRange: null });
          return;
        }
        const line = issue.line ?? issue.line_number;
        set({
          selectedIssue: issue,
          selectedIssueLine: line,
          selectedIssueRange: {
            column: issue.column ?? null,
            endLine: issue.endLine ?? null,
            endColumn: issue.endColumn ?? null,
          },
        });
      },
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      setPendingUpload: (pendingUpload) => set({ pendingUpload }),

      detectLanguageNow: async () => {
        const { code, language } = get();
        if (!code.trim() || language !== 'auto') return;
        set({ detecting: true });
        try {
          const res: DetectLanguageResponse = await api.detectLanguage(code);
          if (get().code !== code) return;
          set({
            detectedLanguage: res.language,
            detectionConfidence: res.confidence,
            detecting: false,
          });
        } catch {
          if (get().code === code) set({ detecting: false });
        }
      },

      validate: async () => {
        const { code, language, model, codeVersion, loadingAction } = get();
        if (loadingAction) return;
        if (!code.trim()) {
          set({ error: 'No code to validate. Paste or upload code first.' });
          toast.warning('No code to validate. Paste or upload code first.');
          return;
        }
        const requestVersion = codeVersion;
        const requestCode = code;
        const requestLang = language;
        set({ loadingAction: 'validate', error: null });
        try {
          const lang = (!requestLang || requestLang === 'auto') ? undefined : requestLang;
          const result = await api.validate(requestCode, lang, model);
          if (get().codeVersion !== requestVersion || get().code !== requestCode) {
            return;
          }
          set({
            result,
            detectedLanguage: result.language,
            detectionConfidence: result.detection_confidence || 0,
            codeHash: result.code_hash || hashFor(requestCode, requestLang),
            isStale: false,
            loadingAction: null,
            fixResult: null,
            formatResult: null,
            explainResult: null,
            bugsResult: null,
            securityResult: null,
            optimizeResult: null,
            testsResult: null,
            docsResult: null,
            selectedIssue: null,
            selectedIssueLine: null,
            selectedIssueRange: null,
            pendingAutoValidate: false,
          });
          toast.success(
            `Validation complete — ${result.status === 'passed' ? 'all clear' : `${result.total_issues} issue${result.total_issues === 1 ? '' : 's'}`}, score ${result.score ?? '-'}/100`
          );
          void get().loadStats(get().statsDays);
          void get().loadHistory();
        } catch (err: any) {
          if (get().codeVersion !== requestVersion) return;
          const message = err.message || 'Validation failed';
          set({ loadingAction: null, error: message });
          toast.error(message);
        }
      },

      fixCode: async () => {
        const { code, result, model, selectedIssue, loadingAction } = get();
        if (loadingAction) return;
        if (!code.trim()) {
          set({ error: 'No code to fix' });
          toast.warning('No code to fix.');
          return;
        }
        if (get().ollamaStatus && !get().ollamaStatus!.connected) {
          const msg = 'Ollama is unavailable. Start Ollama and try again.';
          set({ error: msg });
          toast.error(msg);
          return;
        }
        set({ loadingAction: 'fix', error: null });
        try {
          const lang = result?.language || get().language || 'auto';
          const issues = result?.issues || [];
          const fixed = await api.fix(code, issues, lang, model, selectedIssue);
          set({ fixResult: fixed, loadingAction: null });
          if (fixed.status === 'ready') {
            toast.success('Proposed fix ready — review the diff, then apply.');
          } else {
            toast.warning(fixed.message || 'No safe fix could be generated.');
          }
        } catch (err: any) {
          set({ loadingAction: null, error: err.message || 'Fix failed' });
          toast.error(err.message || 'Fix failed');
        }
      },

      applyFix: async (fixedCode: string) => {
        const { language, codeVersion, code, fixResult, selectedIssue } = get();
        const originalCode = code;
        const focusTitle = fixResult?.target?.title || selectedIssue?.title || null;
        const focusLine = fixResult?.target?.line ?? (selectedIssue ? (selectedIssue.line ?? selectedIssue.line_number) : null);
        set({
          code: fixedCode,
          codeVersion: codeVersion + 1,
          codeHash: hashFor(fixedCode, language),
          fixResult: null,
          selectedIssue: null,
          selectedIssueLine: null,
          selectedIssueRange: null,
          isStale: false,
        });
        await get().validate();
        const after = get().result;
        if (after && after.syntax_valid === false) {
          set({
            code: originalCode,
            codeVersion: get().codeVersion + 1,
            codeHash: hashFor(originalCode, language),
            result: null,
            error: 'Fix was rejected because the resulting code failed validation.',
            isStale: false,
          });
          toast.error('Fix rejected — the result failed validation. Original code restored.');
          return;
        }
        if (after && focusTitle) {
          const stillThere = after.issues.some((i) => {
            const line = i.line ?? i.line_number;
            const sameLine = focusLine == null || line == null || line === focusLine;
            const similar = i.title.toLowerCase().includes(focusTitle.toLowerCase().slice(0, 24))
              || focusTitle.toLowerCase().includes(i.title.toLowerCase().slice(0, 24));
            return sameLine && similar;
          });
          if (stillThere) {
            toast.warning('Fix applied, but validation still reports this issue.');
          } else {
            toast.success('Fix applied and revalidated — issue resolved.');
          }
        } else {
          toast.success('Fix applied and revalidated.');
        }
      },

      rejectFix: () => {
        set({ fixResult: null });
        toast.info('Fix rejected — code unchanged.');
      },

      formatCode: async () => {
        const { code, language, loadingAction } = get();
        if (loadingAction) return;
        if (!code.trim()) {
          set({ error: 'No code to format' });
          toast.warning('No code to format.');
          return;
        }
        set({ loadingAction: 'format', error: null });
        try {
          const lang = (!language || language === 'auto') ? undefined : language;
          const formatted = await api.format(code, lang);
          set({ formatResult: formatted, loadingAction: null });
          if (formatted.available && formatted.formatted_code !== code) {
            toast.success(`Formatted with ${formatted.formatter} — review the preview.`);
          } else {
            toast.info(formatted.message);
          }
        } catch (err: any) {
          set({ loadingAction: null, error: err.message || 'Format failed' });
          toast.error(err.message || 'Format failed');
        }
      },

      applyFormat: async () => {
        const { formatResult, language, codeVersion } = get();
        if (!formatResult?.available) return;
        set({
          code: formatResult.formatted_code,
          codeVersion: codeVersion + 1,
          codeHash: hashFor(formatResult.formatted_code, language),
          formatResult: null,
          isStale: false,
        });
        toast.success('Formatting applied.');
        await get().validate();
      },

      cancelFormat: () => {
        set({ formatResult: null });
        toast.info('Formatting cancelled — code unchanged.');
      },

      explainCode: async () => {
        const { code, language, model, loadingAction } = get();
        if (loadingAction) return;
        if (!code.trim()) {
          set({ error: 'No code to explain' });
          return;
        }
        set({ loadingAction: 'explain', error: null });
        try {
          const lang = (!language || language === 'auto') ? undefined : language;
          const result = await api.explain(code, lang, model);
          set({ explainResult: result, loadingAction: null });
        } catch (err: any) {
          set({ loadingAction: null, error: err.message || 'Explain failed' });
          toast.error(err.message || 'Explain failed');
        }
      },

      findBugs: async () => {
        const { code, language, model, loadingAction } = get();
        if (loadingAction) return;
        if (!code.trim()) {
          set({ error: 'No code to analyze' });
          return;
        }
        set({ loadingAction: 'bugs', error: null });
        try {
          const lang = (!language || language === 'auto') ? undefined : language;
          const result = await api.findBugs(code, lang, model);
          set({ bugsResult: result, loadingAction: null });
        } catch (err: any) {
          set({ loadingAction: null, error: err.message || 'Bug analysis failed' });
          toast.error(err.message || 'Bug analysis failed');
        }
      },

      securityScan: async () => {
        const { code, language, model, loadingAction } = get();
        if (loadingAction) return;
        if (!code.trim()) {
          set({ error: 'No code to scan' });
          return;
        }
        set({ loadingAction: 'security', error: null });
        try {
          const lang = (!language || language === 'auto') ? undefined : language;
          const result = await api.securityScan(code, lang, model);
          set({ securityResult: result, loadingAction: null });
        } catch (err: any) {
          set({ loadingAction: null, error: err.message || 'Security scan failed' });
          toast.error(err.message || 'Security scan failed');
        }
      },

      optimizeCode: async () => {
        const { code, language, model, loadingAction } = get();
        if (loadingAction) return;
        if (!code.trim()) {
          set({ error: 'No code to optimize' });
          return;
        }
        set({ loadingAction: 'optimize', error: null });
        try {
          const lang = (!language || language === 'auto') ? undefined : language;
          const result = await api.optimize(code, lang, model);
          set({ optimizeResult: result, loadingAction: null });
        } catch (err: any) {
          set({ loadingAction: null, error: err.message || 'Optimization failed' });
          toast.error(err.message || 'Optimization failed');
        }
      },

      generateTests: async () => {
        const { code, language, model, loadingAction } = get();
        if (loadingAction) return;
        if (!code.trim()) {
          set({ error: 'No code to generate tests for' });
          return;
        }
        set({ loadingAction: 'tests', error: null });
        try {
          const lang = (!language || language === 'auto') ? undefined : language;
          const result = await api.generateTests(code, lang, model);
          set({ testsResult: result, loadingAction: null });
        } catch (err: any) {
          set({ loadingAction: null, error: err.message || 'Test generation failed' });
          toast.error(err.message || 'Test generation failed');
        }
      },

      documentCode: async () => {
        const { code, language, model, loadingAction } = get();
        if (loadingAction) return;
        if (!code.trim()) {
          set({ error: 'No code to document' });
          return;
        }
        set({ loadingAction: 'docs', error: null });
        try {
          const lang = (!language || language === 'auto') ? undefined : language;
          const result = await api.document(code, lang, model);
          set({ docsResult: result, loadingAction: null });
        } catch (err: any) {
          set({ loadingAction: null, error: err.message || 'Documentation failed' });
          toast.error(err.message || 'Documentation failed');
        }
      },

      loadModels: async () => {
        const previous = get().ollamaStatus?.connected;
        try {
          const status = await api.getModels();
          set({ ollamaStatus: status });
          if (previous === false && status.connected) {
            toast.success('Ollama connected.');
          }
          const current = get().model;
          const names = status.models.map((m) => m.name);
          if (status.connected && names.length > 0 && !names.includes(current)) {
            set({ model: names[0] });
            toast.info(`Selected model "${current}" is not installed — switched to ${names[0]}.`);
          }
        } catch {
          set({ ollamaStatus: { connected: false, endpoint: '', models: [], error: 'Failed to reach backend' } });
          if (previous === true) {
            toast.error('Ollama disconnected.');
          }
        }
      },

      loadConfig: async () => {
        try {
          const config = await api.getConfig();
          set({ config });
        } catch {
          /* config is optional — page shows fallbacks */
        }
      },

      loadHistory: async () => {
        if (get().historyLoading) return;
        set({ historyLoading: true });
        try {
          const history = await api.getHistory();
          set({ history, historyLoading: false });
        } catch {
          set({ historyLoading: false });
        }
      },

      loadValidation: async (id: string) => {
        set({ historyDetailLoading: true, historyDetailError: null, historyDetail: null });
        try {
          const detail = await api.getValidation(id);
          set({ historyDetail: detail, historyDetailLoading: false });
        } catch (err: any) {
          set({
            historyDetailLoading: false,
            historyDetailError: err.message || 'Validation not found',
          });
        }
      },

      loadStats: async (days?: number) => {
        const d = days ?? get().statsDays;
        if (get().statsLoading) return;
        set({ statsLoading: true, statsDays: d });
        try {
          const stats = await api.getStats(d);
          set({ stats, statsLoading: false });
        } catch {
          set({ statsLoading: false });
        }
      },

      openInValidator: (code: string, language?: string, autoValidate?: boolean) => {
        const { codeVersion } = get();
        clearAnalysis(set);
        set({
          code,
          language: language || 'auto',
          codeVersion: codeVersion + 1,
          codeHash: hashFor(code, language || 'auto'),
          isStale: false,
          error: null,
          pendingAutoValidate: !!autoValidate,
          detectedLanguage: language && language !== 'auto' ? language : '',
          detectionConfidence: language && language !== 'auto' ? 1 : 0,
        });
      },

      clearResult: () => set({ result: null }),
      clearAllResults: () => {
        clearAnalysis(set);
        set({ error: null, isStale: false });
      },
    }),
    {
      name: 'codeguard-session',
      partialize: (s) => ({ model: s.model, language: s.language }) as any,
    }
  )
);
