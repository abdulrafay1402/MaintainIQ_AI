// Single-measure horizontal bar list: identity comes from the row label
// (never color alone), magnitude from bar length, value labeled at row end.
export default function BarList({ title, subtitle, rows, dotFor }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <section className="rounded-[2rem] border border-slate-200/80 bg-white/70 p-6 shadow-soft backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60">
      <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display">{title}</h2>
      {subtitle ? <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">{subtitle}</p> : null}
      <div className="mt-5 space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="group" title={`${row.label}: ${row.count}`}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-1.5 font-semibold text-slate-600 dark:text-slate-300">
                {dotFor ? <span className={`h-2 w-2 rounded-full ${dotFor(row.label) || 'bg-ink-500'}`} /> : null}
                {row.label}
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">{row.count}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-950/60 overflow-hidden">
              <div
                className="h-full rounded-full bg-ink-500 dark:bg-ink-400 transition-all duration-500 group-hover:opacity-80"
                style={{ width: `${Math.max(3, Math.round((row.count / max) * 100))}%` }}
              />
            </div>
          </div>
        ))}
        {rows.length === 0 ? <p className="py-6 text-center text-xs text-slate-400 italic">No data yet.</p> : null}
      </div>
    </section>
  );
}
