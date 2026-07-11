export default function StatCard({ label, value, hint }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
    <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
    <div className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{value}</div>
    {hint ? <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{hint}</p> : null}
  </div>;
}
