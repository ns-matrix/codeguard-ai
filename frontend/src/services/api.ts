const API_BASE = '/api/v1';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = typeof err.detail === 'string'
      ? err.detail
      : Array.isArray(err.detail)
        ? err.detail.map((d: any) => d.msg || JSON.stringify(d)).join('; ')
        : res.statusText;
    throw new Error(detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

export interface Issue {
  id?: string;
  severity: string;
  category: string;
  line_number: number | null;
  line?: number | null;
  column?: number | null;
  endLine?: number | null;
  endColumn?: number | null;
  title: string;
  description: string | null;
  recommendation: string | null;
  confidence: number | null;
  evidence: string | null;
  source?: string | null;
}

export function issueLine(issue: Issue): number | null {
  return issue.line ?? issue.line_number;
}

export interface ValidationResult {
  validation_id: string;
  status: string;
  language: string;
  model: string;
  score: number | null;
  duration_ms?: number | null;
  total_issues: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info?: number;
  issues: Issue[];
  improvements: string[];
  corrected_code: string | null;
  syntax_valid: boolean;
  syntax_warnings: string[];
  syntax_parser?: string;
  detection_confidence?: number;
  detection_method?: string;
  code_hash?: string;
  timestamp?: number;
  ollama_available?: boolean;
  ollama_error?: string | null;
}

export interface FixResult {
  original_code: string;
  fixed_code: string;
  explanation: string[];
  diff?: string[];
  status?: 'ready' | 'no_change' | 'rejected' | 'unresolved' | 'failed' | 'offline';
  message?: string;
  syntax_valid?: boolean | null;
  issue_resolved?: boolean | null;
  target?: { title?: string; line?: number | null; column?: number | null } | null;
}

export interface FormatResult {
  original_code: string;
  formatted_code: string;
  diff: string[];
  formatter: string;
  available: boolean;
  message: string;
  language: string;
  syntax_valid?: boolean | null;
}

export interface ExplainResult {
  language: string;
  summary?: string;
  explanation?: string;
  key_concepts?: string[];
  dependencies?: string[];
  edge_cases?: string[];
}

export interface BugsResult {
  language: string;
  issues: Issue[];
}

export interface SecurityResult {
  language: string;
  issues: Issue[];
}

export interface OptimizeResult {
  language: string;
  issues: Issue[];
  improvements?: string[];
}

export interface TestsResult {
  language: string;
  test_code?: string;
  test_framework?: string;
  functions_tested?: string[];
  total_tests?: number;
}

export interface DocsResult {
  language: string;
  documented_code?: string;
  documentation?: string;
}

export interface OllamaModel {
  name: string;
  size: number | null;
  modified_at: string | null;
}

export interface OllamaStatus {
  connected: boolean;
  endpoint: string;
  models: OllamaModel[];
  error?: string | null;
  default_model?: string | null;
}

export interface AppConfig {
  app_name: string;
  app_version: string;
  default_model: string;
  max_code_length: number;
  llm_timeout: number;
  validation_timeout: number;
  debug: boolean;
  temperature?: number;
  num_predict?: number;
  score_penalties: Record<string, number>;
}

export interface DetectLanguageResponse {
  language: string;
  confidence: number;
  method: string;
}

export interface Project {
  id: string;
  name: string;
  created_at: string | null;
  validation_count: number;
}

export interface HistoryEntry {
  id: string;
  language: string;
  model: string;
  status: string;
  score: number | null;
  created_at: string | null;
  issues: Issue[];
  total_issues?: number;
  critical?: number;
  high?: number;
  medium?: number;
  low?: number;
  info?: number;
  duration_ms?: number | null;
  syntax_valid?: boolean | null;
  code?: string | null;
  code_hash?: string | null;
}

export interface SeriesPoint {
  date: string;
  count: number;
  avg_score: number | null;
}

export interface LanguageCount {
  language: string;
  count: number;
}

export interface SecurityCategoryCount {
  category: string;
  count: number;
}

export interface DashboardStats {
  days: number;
  total_validations: number;
  validations_today: number;
  issues_found: number;
  critical_issues: number;
  average_score: number | null;
  status_counts: { passed: number; warning: number; error: number };
  severity_counts: { critical: number; high: number; medium: number; low: number; info: number };
  series: SeriesPoint[];
  languages: LanguageCount[];
  security_categories: SecurityCategoryCount[];
  security_series?: { date: string; count: number }[];
  recent: HistoryEntry[];
  generated_at: string;
}

export const api = {
  detectLanguage: (code: string, filename?: string) =>
    request<DetectLanguageResponse>('/detect-language', {
      method: 'POST',
      body: JSON.stringify({ code, filename }),
    }),

  validate: (code: string, language?: string, model?: string, projectId?: string) =>
    request<ValidationResult>('/validate', {
      method: 'POST',
      body: JSON.stringify({ code, language: language || 'auto', model, project_id: projectId }),
    }),

  fix: (code: string, issues: Issue[], language: string, model?: string, target?: Issue | null) =>
    request<FixResult>('/fix', {
      method: 'POST',
      body: JSON.stringify({ code, issues, language, model, target }),
    }),

  format: (code: string, language?: string) =>
    request<FormatResult>('/format', {
      method: 'POST',
      body: JSON.stringify({ code, language: language || 'auto' }),
    }),

  explain: (code: string, language?: string, model?: string) =>
    request<ExplainResult>('/explain', {
      method: 'POST',
      body: JSON.stringify({ code, language: language || 'auto', model }),
    }),

  findBugs: (code: string, language?: string, model?: string) =>
    request<BugsResult>('/find-bugs', {
      method: 'POST',
      body: JSON.stringify({ code, language: language || 'auto', model }),
    }),

  securityScan: (code: string, language?: string, model?: string) =>
    request<SecurityResult>('/security-scan', {
      method: 'POST',
      body: JSON.stringify({ code, language: language || 'auto', model }),
    }),

  optimize: (code: string, language?: string, model?: string) =>
    request<OptimizeResult>('/optimize', {
      method: 'POST',
      body: JSON.stringify({ code, language: language || 'auto', model }),
    }),

  generateTests: (code: string, language?: string, model?: string) =>
    request<TestsResult>('/generate-tests', {
      method: 'POST',
      body: JSON.stringify({ code, language: language || 'auto', model }),
    }),

  document: (code: string, language?: string, model?: string) =>
    request<DocsResult>('/document', {
      method: 'POST',
      body: JSON.stringify({ code, language: language || 'auto', model }),
    }),

  getModels: () => request<OllamaStatus>('/models'),

  getConfig: () => request<AppConfig>('/config'),

  getStats: (days = 30) => request<DashboardStats>(`/stats?days=${days}`),

  getProjects: () => request<Project[]>('/projects'),
  createProject: (name: string) =>
    request<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  deleteProject: (id: string) =>
    request<void>(`/projects/${id}`, { method: 'DELETE' }),

  getHistory: (limit = 50) => request<HistoryEntry[]>(`/history?limit=${limit}`),
  getValidation: (id: string) => request<HistoryEntry>(`/history/${id}`),
};
