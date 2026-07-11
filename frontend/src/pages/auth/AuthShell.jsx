export default function AuthShell({ eyebrow, title, description, children, asideTitle, asideBody }) {
  return <div className="min-h-screen bg-hero-grid px-4 py-10 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-8 lg:grid-cols-2">
      <section className="hidden rounded-[2rem] border border-slate-200 bg-white/80 p-10 shadow-soft backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 lg:block">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-500">MaintainIQ</p>
        <h1 className="mt-4 text-5xl font-semibold leading-tight">{asideTitle}</h1>
        <p className="mt-6 max-w-xl text-lg text-slate-600 dark:text-slate-300">{asideBody}</p>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-ink-500">{eyebrow}</p>
        <h2 className="mt-2 text-3xl font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{description}</p>
        <div className="mt-8">{children}</div>
      </section>
    </div>
  </div>;
}
