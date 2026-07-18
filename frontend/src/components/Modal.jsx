import { useEffect } from 'react';

// Themed modal: glass panel over a blurred backdrop. Closes on Escape,
// backdrop click, or the ✕ button; locks body scroll while open.
export default function Modal({ open, onClose, title, subtitle, children, wide = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center p-3 sm:p-6">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`relative w-full ${wide ? 'max-w-4xl' : 'max-w-2xl'} max-h-[92vh] overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/95 shadow-premium backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95 animate-fade-in`}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/90 px-6 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
          <div className="min-w-0">
            {title ? <h2 className="truncate text-lg font-bold text-slate-900 dark:text-white font-display">{title}</h2> : null}
            {subtitle ? <p className="mt-0.5 truncate text-xs font-semibold text-slate-400">{subtitle}</p> : null}
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-500 transition-all hover:border-rose-300 hover:text-rose-500 dark:border-slate-800 dark:text-slate-400 cursor-pointer"
            aria-label="Close"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="max-h-[calc(92vh-73px)] overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
