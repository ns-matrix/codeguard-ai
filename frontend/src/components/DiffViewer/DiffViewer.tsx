interface DiffViewerProps {
  original: string;
  modified: string;
  diffLines?: string[];
  mode?: 'unified' | 'split';
}

function UnifiedDiff({ lines }: { lines: string[] }) {
  if (!lines || lines.length === 0) {
    return (
      <div className="px-4 py-3 text-xs text-dark-500">
        No differences — the two versions are identical.
      </div>
    );
  }
  return (
    <div className="max-h-80 overflow-auto py-1">
      {lines.map((ln, i) => {
        const kind = ln.startsWith('+') && !ln.startsWith('+++')
          ? 'add'
          : ln.startsWith('-') && !ln.startsWith('---')
            ? 'del'
            : ln.startsWith('@@')
              ? 'hunk'
              : 'ctx';
        const cls =
          kind === 'add'
            ? 'bg-green-500/10 text-green-300'
            : kind === 'del'
              ? 'bg-red-500/10 text-red-300'
              : kind === 'hunk'
                ? 'text-blue-400'
                : 'text-dark-500';
        return (
          <div key={i} className={`px-4 py-0.5 text-xs font-mono whitespace-pre-wrap break-all ${cls}`}>
            {ln || ' '}
          </div>
        );
      })}
    </div>
  );
}

export default function DiffViewer({ original, modified, diffLines, mode = 'unified' }: DiffViewerProps) {
  if (mode === 'unified') {
    return (
      <div className="bg-dark-900 rounded-xl border border-dark-700 overflow-hidden">
        <div className="px-4 py-2 text-xs font-medium text-dark-400 border-b border-dark-700">
          Changes <span className="text-dark-600">(- removed / + added)</span>
        </div>
        <UnifiedDiff lines={diffLines || []} />
      </div>
    );
  }

  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');
  const maxLen = Math.max(originalLines.length, modifiedLines.length);

  return (
    <div className="bg-dark-900 rounded-xl border border-dark-700 overflow-hidden">
      <div className="grid grid-cols-2 text-xs font-medium text-dark-400 border-b border-dark-700">
        <div className="px-4 py-2 border-r border-dark-700">Original</div>
        <div className="px-4 py-2">Formatted</div>
      </div>
      <div className="max-h-80 overflow-auto">
        {Array.from({ length: maxLen }).map((_, i) => {
          const orig = originalLines[i] || '';
          const fixed = modifiedLines[i] || '';
          const isChanged = orig !== fixed;

          return (
            <div key={i} className={`grid grid-cols-2 text-xs font-mono ${isChanged ? 'bg-green-500/5' : ''}`}>
              <div className={`px-4 py-0.5 border-r border-dark-700 ${isChanged ? 'bg-red-500/5 text-red-400/70' : 'text-dark-400'}`}>
                <span className="inline-block w-8 text-right mr-3 text-dark-600 select-none">{i + 1}</span>
                <span>{orig || ' '}</span>
              </div>
              <div className={`px-4 py-0.5 ${isChanged ? 'bg-green-500/5 text-green-400' : 'text-dark-400'}`}>
                <span className="inline-block w-8 text-right mr-3 text-dark-600 select-none">{i + 1}</span>
                <span>{fixed || ' '}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
