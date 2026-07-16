import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-hero-grid px-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <section className="w-full max-w-md rounded-[2.5rem] border border-slate-200 bg-white/60 p-10 text-center shadow-premium backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/60">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-ink-600 dark:text-ink-400">MaintainIQ</p>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight font-display">404</h1>
        <h2 className="mt-2 text-xl font-bold">Page Not Found</h2>
        <p className="mt-3 text-sm text-[#475569] dark:text-[#94a3b8] leading-relaxed">
          The page you are looking for doesn't exist or has been moved to a new address.
        </p>
        <div className="mt-8">
          <Link
            to="/"
            className="inline-block rounded-2xl bg-ink-900 hover:bg-ink-850 px-6 py-3 text-sm font-bold text-white transition-all shadow-md active:scale-[0.98] dark:bg-white dark:text-ink-900 dark:hover:bg-slate-100"
          >
            Back to Dashboard
          </Link>
        </div>
      </section>
    </div>
  );
}
