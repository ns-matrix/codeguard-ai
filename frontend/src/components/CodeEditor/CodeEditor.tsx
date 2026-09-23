import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { usePrefsStore } from '../../stores/prefsStore';

export interface EditorMarker {
  severity: 'error' | 'warning' | 'info';
  message: string;
  line: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
}

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  markers?: EditorMarker[];
  selectedLine?: number | null;
  selectedColumn?: number | null;
  selectedEndLine?: number | null;
  selectedEndColumn?: number | null;
  onValidateShortcut?: () => void;
  onFormatShortcut?: () => void;
}

const LANG_MAP: Record<string, string> = {
  python: 'python',
  javascript: 'javascript',
  typescript: 'typescript',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
  csharp: 'csharp',
  go: 'go',
  rust: 'rust',
  php: 'php',
  html: 'html',
  css: 'css',
  sql: 'sql',
  json: 'json',
  yaml: 'yaml',
  bash: 'shell',
  shell: 'shell',
  ruby: 'ruby',
  swift: 'swift',
  kotlin: 'kotlin',
  markdown: 'markdown',
};

const SEVERITY_MAP = {
  error: 8, // MarkerSeverity.Error
  warning: 4, // MarkerSeverity.Warning
  info: 2, // MarkerSeverity.Info
} as const;

export default function CodeEditor({
  value, onChange, language = 'python', markers, selectedLine,
  selectedColumn, selectedEndLine, selectedEndColumn,
  onValidateShortcut, onFormatShortcut,
}: CodeEditorProps) {
  const monacoLang = LANG_MAP[language] || 'plaintext';
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const decorRef = useRef<string[]>([]);
  const { editor: prefs } = usePrefsStore();

  const applyMarkers = useCallback((list?: EditorMarker[]) => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    const model = editor.getModel();
    if (!model) return;
    if (!list || list.length === 0) {
      monaco.editor.setModelMarkers(model, 'codeguard', []);
      return;
    }
    monaco.editor.setModelMarkers(
      model,
      'codeguard',
      list.map((m) => ({
        severity: SEVERITY_MAP[m.severity],
        message: m.message,
        startLineNumber: m.line,
        startColumn: m.column && m.column > 0 ? m.column : 1,
        endLineNumber: m.endLine ?? m.line,
        endColumn: m.endColumn && m.endColumn > 0 ? m.endColumn : (m.column && m.column > 0 ? m.column + 1 : model.getLineMaxColumn(m.line)),
      })),
    );
  }, []);

  const handleMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    applyMarkers(markers);

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onValidateShortcut?.();
    });
    editor.addCommand(
      monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
      () => {
        onFormatShortcut?.();
      },
    );
  }, [applyMarkers, markers, onValidateShortcut, onFormatShortcut]);

  useEffect(() => {
    applyMarkers(markers);
  }, [markers, applyMarkers]);

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    decorRef.current = editor.deltaDecorations(decorRef.current, []);
    if (selectedLine && selectedLine > 0) {
      const endLine = selectedEndLine && selectedEndLine >= selectedLine ? selectedEndLine : selectedLine;
      const hasRange = selectedColumn != null && selectedColumn > 0;
      const range = hasRange
        ? new monaco.Range(
            selectedLine, selectedColumn,
            endLine, selectedEndColumn && selectedEndColumn > 0 ? selectedEndColumn : 1000,
          )
        : new monaco.Range(selectedLine, 1, selectedLine, 1);
      decorRef.current = editor.deltaDecorations(decorRef.current, [
        {
          range,
          options: {
            isWholeLine: !hasRange,
            className: hasRange ? 'codeguard-issue-range' : 'codeguard-issue-line',
            glyphMarginClassName: 'codeguard-issue-glyph',
            overviewRuler: {
              color: '#f59e0b',
              position: monaco.editor.OverviewRulerLane.Right,
            },
          },
        },
      ]);
      editor.revealLineInCenter(selectedLine);
      editor.setPosition({ lineNumber: selectedLine, column: selectedColumn || 1 });
      if (hasRange) {
        editor.setSelection(range);
      }
      editor.focus();
    }
  }, [selectedLine, selectedColumn, selectedEndLine, selectedEndColumn]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.updateOptions({
      fontSize: prefs.fontSize,
      minimap: { enabled: prefs.minimap },
      lineNumbers: prefs.lineNumbers ? 'on' : 'off',
      wordWrap: prefs.wordWrap ? 'on' : 'off',
    });
  }, [prefs.fontSize, prefs.minimap, prefs.lineNumbers, prefs.wordWrap]);

  return (
    <div className="h-full rounded-lg overflow-hidden border border-line bg-[#0f172a]">
      <Editor
        height="100%"
        defaultLanguage={monacoLang}
        language={monacoLang}
        value={value}
        onChange={(v) => onChange(v || '')}
        onMount={handleMount}
        theme="vs-dark"
        options={{
          fontSize: prefs.fontSize,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          minimap: { enabled: prefs.minimap },
          lineNumbers: prefs.lineNumbers ? 'on' : 'off',
          scrollBeyondLastLine: false,
          wordWrap: prefs.wordWrap ? 'on' : 'off',
          padding: { top: 12 },
          bracketPairColorization: { enabled: true },
          automaticLayout: true,
          tabSize: 2,
          renderLineHighlight: 'line',
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          glyphMargin: true,
        }}
        beforeMount={(monaco) => {
          monaco.editor.defineTheme('codeguard-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [
              { token: 'comment', foreground: '6a737d', fontStyle: 'italic' },
              { token: 'keyword', foreground: 'c586c0' },
              { token: 'string', foreground: 'ce9178' },
              { token: 'number', foreground: 'b5cea8' },
            ],
            colors: {
              'editor.background': '#0f172a',
              'editor.foreground': '#e2e8f0',
              'editorLineNumber.foreground': '#475569',
              'editorCursor.foreground': '#3b82f6',
              'editor.lineHighlightBackground': '#1e293b80',
              'editor.selectionBackground': '#3b82f630',
            },
          });
          monaco.editor.setTheme('codeguard-dark');
        }}
      />
    </div>
  );
}
