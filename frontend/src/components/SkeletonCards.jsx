// Shimmering placeholder cards shown while a list query is loading —
// no more "empty flash" before data arrives.
export default function SkeletonCards({ count = 4, columns = 'md:grid-cols-2' }) {
  return (
    <div className={`grid gap-4 ${columns}`}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="animate-pulse rounded-3xl border-2 border-slate-200/60 bg-white/40 p-6 dark:border-slate-800 dark:bg-slate-900/20">
          <div className="flex items-start justify-between gap-2">
            <div className="h-3 w-20 rounded-full bg-slate-200/80 dark:bg-slate-800" />
            <div className="h-5 w-24 rounded-full bg-slate-200/80 dark:bg-slate-800" />
          </div>
          <div className="mt-3 h-5 w-3/4 rounded-full bg-slate-200/80 dark:bg-slate-800" />
          <div className="mt-2 h-3.5 w-1/2 rounded-full bg-slate-200/60 dark:bg-slate-800/70" />
          <div className="mt-5 flex items-center justify-between border-t border-slate-200/60 pt-3 dark:border-slate-800/60">
            <div className="h-3 w-24 rounded-full bg-slate-200/60 dark:bg-slate-800/70" />
            <div className="h-3 w-20 rounded-full bg-slate-200/60 dark:bg-slate-800/70" />
          </div>
        </div>
      ))}
    </div>
  );
}
