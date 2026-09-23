import { useValidationStore } from '../../stores/validationStore';
import IssueList from '../IssueList/IssueList';
import DiffViewer from '../DiffViewer/DiffViewer';
import { issueLine } from '../../services/api';
import { FileCode, Shield, Bug, Zap, Wrench, BookOpen, TestTube, Sparkles, CheckCircle, Copy, Paintbrush } from 'lucide-react';
import { useState } from 'react';

const ACTION_LABELS: Record<string, string> = {
  validate: 'Analyzing code...',
  fix: 'Fixing...',
  format: 'Formatting...',
  explain: 'Explaining...',
  bugs: 'Finding bugs...',
  security: 'Scanning...',
  optimize: 'Optimizing...',
  tests: 'Generating tests...',
  docs: 'Documenting...',
};

export default function ValidationPanel() {
  const {
    loadingAction, result, fixResult, formatResult, explainResult, bugsResult,
    securityResult, optimizeResult, testsResult, docsResult, error,
    validate, fixCode, formatCode, applyFormat, cancelFormat,
    explainCode, findBugs, securityScan,
    optimizeCode, generateTests, documentCode,
    applyFix, rejectFix, setSelectedIssue, selectedIssue,
  } = useValidationStore();

  const [copiedTests, setCopiedTests] = useState(false);

  const handleAction = async (action: string) => {
    switch (action) {
      case 'validate': await validate(); break;
      case 'fix': await fixCode(); break;
      case 'format': await formatCode(); break;
      case 'explain': await explainCode(); break;
      case 'bugs': await findBugs(); break;
      case 'security': await securityScan(); break;
      case 'optimize': await optimizeCode(); break;
      case 'tests': await generateTests(); break;
      case 'document': await documentCode(); break;
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTests(true);
    setTimeout(() => setCopiedTests(false), 2000);
  };

  const actions = [
    { id: 'validate', label: 'Validate', icon: Sparkles, color: 'text-blue-400 hover:bg-blue-500/10' },
    { id: 'fix', label: 'Fix Code', icon: Wrench, color: 'text-emerald-400 hover:bg-emerald-500/10' },
    { id: 'format', label: 'Format', icon: Paintbrush, color: 'text-teal-400 hover:bg-teal-500/10' },
    { id: 'explain', label: 'Explain', icon: BookOpen, color: 'text-purple-400 hover:bg-purple-500/10' },
    { id: 'bugs', label: 'Find Bugs', icon: Bug, color: 'text-orange-400 hover:bg-orange-500/10' },
    { id: 'security', label: 'Security', icon: Shield, color: 'text-red-400 hover:bg-red-500/10' },
    { id: 'optimize', label: 'Optimize', icon: Zap, color: 'text-amber-400 hover:bg-amber-500/10' },
    { id: 'tests', label: 'Tests', icon: TestTube, color: 'text-cyan-400 hover:bg-cyan-500/10' },
    { id: 'document', label: 'Docs', icon: FileCode, color: 'text-pink-400 hover:bg-pink-500/10' },
  ];

  const fixReady = fixResult?.status === 'ready' || (!fixResult?.status && !!fixResult?.fixed_code);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 p-2 border-b border-dark-700 overflow-x-auto">
        {actions.map(({ id, label, icon: Icon, color }) => (
          <button
            key={id}
            onClick={() => handleAction(id)}
            disabled={loadingAction !== null}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap border
              ${loadingAction === id ? 'accent-bg-soft accent-text accent-border' : `${color} border-transparent`}
              ${loadingAction !== null && loadingAction !== id ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            {loadingAction === id ? (
              <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Icon className="w-3.5 h-3.5" />
            )}
            {loadingAction === id ? ACTION_LABELS[id] : label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mx-4 mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400 animate-slide-in">
          {error}
        </div>
      )}

      {result && result.ollama_available === false && (
        <div className="mx-4 mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400 animate-slide-in">
          <span className="font-medium">OLLAMA OFFLINE</span>
          <span className="text-red-400/80"> — {result.ollama_error || 'Unable to connect to the configured Ollama server.'}</span>
        </div>
      )}

      {loadingAction && (
        <div className="flex-1 flex items-center justify-center text-dark-400">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">{ACTION_LABELS[loadingAction]}</span>
          </div>
        </div>
      )}

      {!loadingAction && fixResult && (
        <div className="flex-1 overflow-auto p-4 space-y-4 animate-slide-in">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-medium text-green-400 uppercase">Proposed Fix</h4>
            <div className="flex gap-2">
              <button
                onClick={() => applyFix(fixResult.fixed_code)}
                disabled={!fixReady}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors ${
                  fixReady ? 'bg-green-600 hover:bg-green-500' : 'bg-dark-700 text-dark-500 cursor-not-allowed'
                }`}
              >
                <CheckCircle className="w-3.5 h-3.5" /> Apply Fix
              </button>
              <button
                onClick={rejectFix}
                className="px-3 py-1.5 bg-dark-700 hover:bg-dark-600 rounded-lg text-xs font-medium text-dark-300 transition-colors"
              >
                Reject
              </button>
            </div>
          </div>

          {fixResult.message && (
            <div className={`text-sm p-3 rounded-lg border ${
              fixReady
                ? 'text-dark-300 bg-dark-800 border-dark-700'
                : 'text-yellow-300 bg-yellow-500/10 border-yellow-500/30'
            }`}>
              {fixResult.message}
            </div>
          )}

          {(fixResult.target?.title || selectedIssue) && (
            <div className="p-3 bg-dark-900 border border-dark-700 rounded-lg space-y-1.5 text-sm">
              <div>
                <span className="text-dark-400 text-xs uppercase">Issue</span>
                <p className="text-dark-200 font-medium">{fixResult.target?.title || selectedIssue?.title}</p>
              </div>
              {(fixResult.target?.line || selectedIssue) && (
                <div>
                  <span className="text-dark-400 text-xs uppercase">Location</span>
                  <p className="text-dark-200">
                    Line {fixResult.target?.line ?? issueLine(selectedIssue!) ?? '?'}
                    {((fixResult.target?.column ?? selectedIssue?.column) || 0) > 0 &&
                      `, Column ${fixResult.target?.column ?? selectedIssue?.column}`}
                  </p>
                </div>
              )}
              {selectedIssue?.description && (
                <div>
                  <span className="text-dark-400 text-xs uppercase">Problem</span>
                  <p className="text-dark-200">{selectedIssue.description}</p>
                </div>
              )}
              {selectedIssue?.recommendation && (
                <div>
                  <span className="text-dark-400 text-xs uppercase">Why this change</span>
                  <p className="text-dark-200">{selectedIssue.recommendation}</p>
                </div>
              )}
            </div>
          )}

          {fixResult.explanation && fixResult.explanation.length > 0 && (
            <div className="space-y-1">
              <h5 className="text-xs font-medium text-dark-400 uppercase">What changed</h5>
              {fixResult.explanation.map((change, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-dark-300">
                  <span className="text-green-400 mt-0.5">•</span> {change}
                </div>
              ))}
            </div>
          )}
          <div className="space-y-2">
            <h5 className="text-xs font-medium text-dark-400 uppercase">Before / After</h5>
            <DiffViewer
              original={fixResult.original_code}
              modified={fixResult.fixed_code}
              diffLines={fixResult.diff}
              mode="unified"
            />
          </div>
        </div>
      )}

      {!loadingAction && !fixResult && formatResult && (
        <div className="flex-1 overflow-auto p-4 space-y-4 animate-slide-in">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-medium text-teal-400 uppercase">
              Formatting Preview {formatResult.formatter !== 'none' && `(${formatResult.formatter})`}
            </h4>
            <div className="flex gap-2">
              <button
                onClick={applyFormat}
                disabled={!formatResult.available}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors ${
                  formatResult.available ? 'bg-teal-600 hover:bg-teal-500' : 'bg-dark-700 text-dark-500 cursor-not-allowed'
                }`}
              >
                <CheckCircle className="w-3.5 h-3.5" /> Apply Format
              </button>
              <button
                onClick={cancelFormat}
                className="px-3 py-1.5 bg-dark-700 hover:bg-dark-600 rounded-lg text-xs font-medium text-dark-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
          <div className={`text-sm p-3 rounded-lg border ${
            formatResult.available
              ? 'text-dark-300 bg-dark-800 border-dark-700'
              : 'text-yellow-300 bg-yellow-500/10 border-yellow-500/30'
          }`}>
            {formatResult.message}
          </div>
          {formatResult.available && (
            <>
              <DiffViewer
                original={formatResult.original_code}
                modified={formatResult.formatted_code}
                mode="split"
              />
              <p className="text-xs text-dark-500">Formatting only — program logic unchanged.</p>
            </>
          )}
        </div>
      )}

      {!loadingAction && !fixResult && !formatResult && explainResult && (
        <div className="flex-1 overflow-auto p-4 space-y-4 animate-slide-in">
          <h4 className="text-xs font-medium text-purple-400 uppercase">Explanation</h4>
          {explainResult.summary && (
            <div className="p-3 bg-purple-500/5 border border-purple-500/20 rounded-lg text-sm text-dark-200">
              {explainResult.summary}
            </div>
          )}
          {explainResult.explanation && (
            <div className="text-sm text-dark-300 whitespace-pre-wrap leading-relaxed">
              {explainResult.explanation}
            </div>
          )}
          {explainResult.key_concepts && explainResult.key_concepts.length > 0 && (
            <div className="space-y-1">
              <h5 className="text-xs font-medium text-dark-400 uppercase">Key Concepts</h5>
              {explainResult.key_concepts.map((c, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-dark-300">
                  <span className="text-purple-400 mt-0.5">•</span> {c}
                </div>
              ))}
            </div>
          )}
          {explainResult.edge_cases && explainResult.edge_cases.length > 0 && (
            <div className="space-y-1">
              <h5 className="text-xs font-medium text-dark-400 uppercase">Edge Cases</h5>
              {explainResult.edge_cases.map((e, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-dark-300">
                  <span className="text-yellow-400 mt-0.5">•</span> {e}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!loadingAction && !fixResult && !formatResult && !explainResult && bugsResult && (
        <div className="flex-1 overflow-auto p-4 space-y-4 animate-slide-in">
          <h4 className="text-xs font-medium text-orange-400 uppercase">
            Bugs Found ({bugsResult.issues?.length || 0})
          </h4>
          <IssueList issues={bugsResult.issues || []} onLineClick={setSelectedIssue} />
        </div>
      )}

      {!loadingAction && !fixResult && !formatResult && !explainResult && !bugsResult && securityResult && (
        <div className="flex-1 overflow-auto p-4 space-y-4 animate-slide-in">
          <h4 className="text-xs font-medium text-red-400 uppercase">
            Security Issues ({securityResult.issues?.length || 0})
          </h4>
          <IssueList issues={securityResult.issues || []} onLineClick={setSelectedIssue} />
        </div>
      )}

      {!loadingAction && !fixResult && !formatResult && !explainResult && !bugsResult && !securityResult && optimizeResult && (
        <div className="flex-1 overflow-auto p-4 space-y-4 animate-slide-in">
          <h4 className="text-xs font-medium text-yellow-400 uppercase">
            Performance Issues ({optimizeResult.issues?.length || 0})
          </h4>
          <IssueList issues={optimizeResult.issues || []} onLineClick={setSelectedIssue} />
          {optimizeResult.improvements && optimizeResult.improvements.length > 0 && (
            <div className="space-y-1">
              <h5 className="text-xs font-medium text-dark-400 uppercase">Improvements</h5>
              {optimizeResult.improvements.map((imp, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-dark-300">
                  <span className="text-yellow-400 mt-0.5">•</span> {imp}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!loadingAction && !fixResult && !formatResult && !explainResult && !bugsResult && !securityResult && !optimizeResult && testsResult && (
        <div className="flex-1 overflow-auto p-4 space-y-4 animate-slide-in">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-medium text-cyan-400 uppercase">
              Tests ({testsResult.total_tests || 0})
            </h4>
            {testsResult.test_code && (
              <button
                onClick={() => copyToClipboard(testsResult.test_code!)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-700 hover:bg-dark-600 rounded-lg text-xs font-medium text-dark-300 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" /> {copiedTests ? 'Copied!' : 'Copy Tests'}
              </button>
            )}
          </div>
          {testsResult.test_framework && (
            <div className="text-xs text-dark-400">Framework: {testsResult.test_framework}</div>
          )}
          {testsResult.functions_tested && testsResult.functions_tested.length > 0 && (
            <div className="text-xs text-dark-400">
              Functions: {testsResult.functions_tested.join(', ')}
            </div>
          )}
          {testsResult.test_code && (
            <pre className="bg-dark-950 border border-dark-700 rounded-lg p-3 text-sm code-font overflow-x-auto text-dark-200 whitespace-pre-wrap">
              {testsResult.test_code}
            </pre>
          )}
        </div>
      )}

      {!loadingAction && !fixResult && !formatResult && !explainResult && !bugsResult && !securityResult && !optimizeResult && !testsResult && docsResult && (
        <div className="flex-1 overflow-auto p-4 space-y-4 animate-slide-in">
          <h4 className="text-xs font-medium text-pink-400 uppercase">Documentation</h4>
          {docsResult.documentation && (
            <div className="text-sm text-dark-300 whitespace-pre-wrap leading-relaxed">
              {docsResult.documentation}
            </div>
          )}
          {docsResult.documented_code && (
            <div className="space-y-2">
              <h5 className="text-xs font-medium text-dark-400 uppercase">Documented Code</h5>
              <pre className="bg-dark-950 border border-dark-700 rounded-lg p-3 text-sm code-font overflow-x-auto text-dark-200 whitespace-pre-wrap">
                {docsResult.documented_code}
              </pre>
            </div>
          )}
        </div>
      )}

      {!loadingAction && !fixResult && !formatResult && !explainResult && !bugsResult && !securityResult && !optimizeResult && !testsResult && !docsResult && result && (
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {selectedIssue && (
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300 animate-slide-in">
              Selected: <span className="font-medium">{selectedIssue.title}</span>
              {' '}— Fix Code will target this issue.
            </div>
          )}
          {result.improvements && result.improvements.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-dark-400 uppercase">Improvements</h4>
              {result.improvements.map((imp, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-dark-300">
                  <span className="text-blue-400 mt-0.5">•</span> {imp}
                </div>
              ))}
            </div>
          )}
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-dark-400 uppercase">
              Issues ({result.issues.length})
            </h4>
            <IssueList
              issues={result.issues}
              onLineClick={setSelectedIssue}
              selectedIssueId={selectedIssue?.id || null}
            />
          </div>
          {result.syntax_warnings && result.syntax_warnings.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-dark-400 uppercase">Syntax Warnings</h4>
              {result.syntax_warnings.map((w, i) => (
                <div key={i} className="text-sm text-yellow-400/80 bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-2">
                  {w}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!loadingAction && !result && !fixResult && !formatResult && !explainResult && !bugsResult && !securityResult && !optimizeResult && !testsResult && !docsResult && (
        <div className="flex-1 flex items-center justify-center text-dark-500">
          <div className="text-center">
            <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Click any action to analyze your code</p>
          </div>
        </div>
      )}
    </div>
  );
}
