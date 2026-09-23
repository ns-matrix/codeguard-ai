import { CheckCircle2, Info, AlertTriangle, XCircle, X } from 'lucide-react';
import { useToastStore, ToastType } from '../../stores/toastStore';

const CONFIG: Record<ToastType, { icon: typeof Info; cls: string }> = {
  success: { icon: CheckCircle2, cls: 'border-emerald-500/40 text-emerald-300' },
  error: { icon: XCircle, cls: 'border-red-500/40 text-red-300' },
  warning: { icon: AlertTriangle, cls: 'border-amber-500/40 text-amber-300' },
  info: { icon: Info, cls: 'border-blue-500/40 text-blue-300' },
};

export default function Toaster() {
  const { toasts, dismiss } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-3 right-3 z-[100] flex flex-col gap-2 w-[min(360px,calc(100vw-1.5rem))]"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const { icon: Icon, cls } = CONFIG[t.type];
        return (
          <div
            key={t.id}
            className={`animate-toast-in flex items-start gap-2 rounded-lg border bg-dark-800/95 backdrop-blur px-3 py-2.5 shadow-lg ${cls}`}
          >
            <Icon className="w-4 h-4 mt-0.5 shrink-0" />
            <p className="flex-1 text-xs leading-relaxed text-ink">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="text-ink-mute hover:text-ink transition-colors shrink-0"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
