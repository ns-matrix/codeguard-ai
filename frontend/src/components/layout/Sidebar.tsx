import { NavLink, useLocation } from 'react-router-dom';
import { Shield, Code2, History, Settings, Activity, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useEffect } from 'react';
import { useValidationStore } from '../../stores/validationStore';
import { usePrefsStore } from '../../stores/prefsStore';

export const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: Shield },
  { path: '/validate', label: 'Validate', icon: Code2 },
  { path: '/history', label: 'History', icon: History },
  { path: '/settings', label: 'Settings', icon: Settings },
];

interface SidebarProps {
  collapsed?: boolean;
  onNavigate?: () => void;
  showCollapseToggle?: boolean;
}

export default function Sidebar({ collapsed = false, onNavigate, showCollapseToggle = false }: SidebarProps) {
  const location = useLocation();
  const { ollamaStatus, loadModels } = useValidationStore();
  const { sidebarCollapsed, setSidebarCollapsed } = usePrefsStore();

  useEffect(() => {
    loadModels();
  }, []);

  const isCollapsed = collapsed || sidebarCollapsed;

  return (
    <aside
      className={`h-full flex flex-col bg-shell border-r border-line transition-[width] duration-200 ${
        isCollapsed ? 'w-[68px]' : 'w-60'
      }`}
    >
      <div className={`h-14 flex items-center border-b border-line shrink-0 ${isCollapsed ? 'justify-center px-2' : 'px-4 gap-2'}`}>
        <Shield className="w-6 h-6 accent-text shrink-0" />
        {!isCollapsed && (
          <span className="font-semibold text-[15px] text-ink tracking-tight truncate">CodeGuard AI</span>
        )}
      </div>

      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
          const active = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
          return (
            <NavLink
              key={path}
              to={path}
              onClick={onNavigate}
              title={isCollapsed ? label : undefined}
              className={`flex items-center gap-3 rounded-lg text-sm font-medium transition-colors ${
                isCollapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2'
              } ${
                active
                  ? 'accent-bg-soft accent-text'
                  : 'text-ink-soft hover:text-ink hover:bg-dark-800'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span className="truncate">{label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {showCollapseToggle && (
        <div className="p-2 border-t border-line">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-xs text-ink-mute hover:text-ink hover:bg-dark-800 transition-colors ${
              isCollapsed ? 'justify-center px-2' : ''
            }`}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            {!isCollapsed && <span>Collapse</span>}
          </button>
        </div>
      )}

      <div className={`p-3 border-t border-line shrink-0 ${isCollapsed ? 'flex justify-center' : ''}`}>
        <div className={`flex items-center gap-2 text-xs text-ink-mute ${isCollapsed ? 'justify-center' : ''}`}>
          <Activity
            className={`w-3 h-3 shrink-0 ${ollamaStatus?.connected ? 'text-emerald-400 animate-pulse-dot' : 'text-red-400'}`}
          />
          {!isCollapsed && <span>Ollama {ollamaStatus?.connected ? 'Connected' : 'Offline'}</span>}
        </div>
      </div>
    </aside>
  );
}
