import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, ArrowLeft, Zap, ChevronRight } from 'lucide-react';
import { useValidationStore } from '../../stores/validationStore';

function titleFor(pathname: string): string {
  if (pathname === '/') return 'Dashboard';
  if (pathname.startsWith('/validate')) return 'Validate';
  if (pathname.startsWith('/history')) return 'History';
  if (pathname.startsWith('/settings')) return 'Settings';
  return 'CodeGuard AI';
}

interface TopHeaderProps {
  onMenuOpen: () => void;
}

export default function TopHeader({ onMenuOpen }: TopHeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { ollamaStatus } = useValidationStore();

  const isDetail = location.pathname.startsWith('/history/');
  const title = titleFor(location.pathname);
  const connected = !!ollamaStatus?.connected;

  return (
    <header className="h-14 shrink-0 flex items-center gap-2 px-3 sm:px-4 bg-shell/80 backdrop-blur border-b border-line sticky top-0 z-40">
      <button
        onClick={onMenuOpen}
        className="lg:hidden btn-ghost rounded-lg p-2"
        aria-label="Open navigation menu"
      >
        <Menu className="w-4.5 h-4.5 w-5 h-5" />
      </button>

      <div className="flex items-center gap-1.5 min-w-0 text-sm">
        {isDetail ? (
          <button
            onClick={() => navigate('/history')}
            className="flex items-center gap-1 text-ink-soft hover:text-ink transition-colors min-w-0"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span className="truncate">{title}</span>
            <ChevronRight className="w-3.5 h-3.5 shrink-0 text-ink-mute" />
            <span className="text-ink font-medium truncate">Detail</span>
          </button>
        ) : (
          <span className="font-medium text-ink truncate">{title}</span>
        )}
      </div>

      <div className="flex-1" />

      <div
        className={`hidden sm:flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
          connected
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
            : 'border-red-500/30 bg-red-500/10 text-red-400'
        }`}
        title={ollamaStatus?.error || ollamaStatus?.endpoint || ''}
      >
        <Zap className="w-3 h-3" />
        <span>{connected ? 'Ollama online' : 'Ollama offline'}</span>
      </div>
    </header>
  );
}
