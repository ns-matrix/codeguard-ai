import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface EditorPrefs {
  fontSize: number;
  wordWrap: boolean;
  minimap: boolean;
  lineNumbers: boolean;
}

interface PrefsStore {
  accent: string;
  sidebarCollapsed: boolean;
  editor: EditorPrefs;
  setAccent: (color: string) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setEditor: (patch: Partial<EditorPrefs>) => void;
  reset: () => void;
}

const DEFAULT_EDITOR: EditorPrefs = {
  fontSize: 14,
  wordWrap: true,
  minimap: true,
  lineNumbers: true,
};

export const ACCENT_COLORS = [
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#06b6d4',
  '#22c55e',
  '#f59e0b',
];

export const usePrefsStore = create<PrefsStore>()(
  persist(
    (set) => ({
      accent: '#3b82f6',
      sidebarCollapsed: false,
      editor: { ...DEFAULT_EDITOR },
      setAccent: (accent) => {
        document.documentElement.style.setProperty('--cg-accent', accent);
        set({ accent });
      },
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setEditor: (patch) => set((s) => ({ editor: { ...s.editor, ...patch } })),
      reset: () => {
        document.documentElement.style.setProperty('--cg-accent', '#3b82f6');
        set({ accent: '#3b82f6', sidebarCollapsed: false, editor: { ...DEFAULT_EDITOR } });
      },
    }),
    {
      name: 'codeguard-prefs',
      onRehydrateStorage: () => (state) => {
        if (state?.accent) {
          document.documentElement.style.setProperty('--cg-accent', state.accent);
        }
      },
    }
  )
);
