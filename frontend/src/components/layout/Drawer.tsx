import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  side?: 'left' | 'right';
  label?: string;
}

export default function Drawer({ open, onClose, children, side = 'left', label = 'Navigation' }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] lg:hidden" role="dialog" aria-modal="true" aria-label={label}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`absolute top-0 h-full w-[min(280px,85vw)] bg-shell flex flex-col animate-slide-in ${
          side === 'left' ? 'left-0 border-r border-line' : 'right-0 border-l border-line'
        }`}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 btn-ghost rounded-md p-1.5 z-10"
          aria-label="Close menu"
        >
          <X className="w-4 h-4" />
        </button>
        {children}
      </div>
    </div>
  );
}
