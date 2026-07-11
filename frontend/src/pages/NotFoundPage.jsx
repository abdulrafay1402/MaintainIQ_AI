export default function NotFoundPage() {
  return <div className="grid min-h-screen place-items-center bg-hero-grid px-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <section className="w-full max-w-xl rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-soft dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-ink-500">MaintainIQ</p>
      <h1 className="mt-3 text-3xl font-semibold">Page not found</h1>
      <p className="mt-2 text-slate-500 dark:text-slate-400">The route you opened does not exist.</p>
    </section>
  </div>;
}
