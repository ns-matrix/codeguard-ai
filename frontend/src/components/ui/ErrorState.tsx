import { AlertTriangle, RefreshCw } from 'lucide-react';
import { ReactNode } from 'react';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  children?: ReactNode;
}

export default function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Try again',
  children,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-4">
      <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-3">
        <AlertTriangle className="w-5 h-5 text-red-400" />
      </div>
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="mt-1 text-xs text-ink-mute max-w-md break-words">{message}</p>
      {children}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {retryLabel}
        </button>
      )}
    </div>
  );
}
