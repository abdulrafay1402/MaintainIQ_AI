export default function StatCard({ label, value, hint }) {
  // Determine gradient based on label keywords
  let accentGradient = 'from-ink-500 to-indigo-500';
  if (label.toLowerCase().includes('fault') || label.toLowerCase().includes('critical') || label.toLowerCase().includes('pending')) {
    accentGradient = 'from-rose-500 to-amber-500';
  } else if (label.toLowerCase().includes('active') || label.toLowerCase().includes('complete') || label.toLowerCase().includes('operational')) {
    accentGradient = 'from-emerald-500 to-teal-500';
  }

  return (
    <div className="relative overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white/70 p-6 shadow-soft backdrop-blur-md transition-all hover:-translate-y-1 hover:shadow-premium dark:border-slate-800/80 dark:bg-slate-900/60">
      {/* Top accent line */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${accentGradient}`} />
      
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">{label}</p>
      
      <div className="mt-3 text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
        {value}
      </div>
      
      {hint ? (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
