// MaintainIQ signature loader: a QR frame being "scanned" by a laser line
// while its pixels blink in — ties the loading moment to the product's core idea.
export default function Loader({ label = 'Loading' }) {
  return (
    <div className="grid min-h-screen place-items-center bg-hero-grid text-slate-900 dark:text-slate-100">
      <div className="flex flex-col items-center gap-6">
        <div className="qr-loader">
          <div className="qr-dots" aria-hidden="true">
            {Array.from({ length: 16 }, (_, i) => <span key={i} />)}
          </div>
        </div>
        <div className="text-center">
          <p className="loader-word text-sm font-extrabold uppercase text-slate-800 dark:text-white font-display">MaintainIQ</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.3em] text-ink-500">{label}…</p>
        </div>
      </div>
    </div>
  );
}
