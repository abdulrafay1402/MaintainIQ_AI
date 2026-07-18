// SVG donut chart with a legend. Identity is never color-alone: every slice is
// listed in the legend with its label, count, and percentage. Colors are
// assigned from a fixed categorical order (or an explicit colorFor mapping).
const DEFAULT_PALETTE = ['#306D29', '#FB743E', '#497285', '#8b5cf6', '#e11d48', '#0ea5e9', '#f59e0b', '#64748b', '#14b8a6', '#d946ef'];

const polarToCartesian = (cx, cy, radius, angleDeg) => {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
};

const arcPath = (cx, cy, radius, startAngle, endAngle) => {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y}`;
};

export default function PieChart({ title, subtitle, rows, colorFor }) {
  const data = rows.filter((row) => row.count > 0);
  const total = data.reduce((sum, row) => sum + row.count, 0);

  const colorOf = (label, index) => (colorFor && colorFor(label)) || DEFAULT_PALETTE[index % DEFAULT_PALETTE.length];

  let cursor = 0;
  const slices = data.map((row, index) => {
    const startAngle = (cursor / total) * 360;
    cursor += row.count;
    const endAngle = (cursor / total) * 360;
    return { ...row, startAngle, endAngle: Math.min(endAngle, 359.999), color: colorOf(row.label, index) };
  });

  return (
    <section className="rounded-[2rem] border border-slate-200/80 bg-white/70 p-6 shadow-soft backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60">
      <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display">{title}</h2>
      {subtitle ? <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">{subtitle}</p> : null}

      {total === 0 ? (
        <p className="py-10 text-center text-xs text-slate-400 italic">No data yet.</p>
      ) : (
        <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row">
          <svg viewBox="0 0 120 120" className="h-36 w-36 shrink-0" role="img" aria-label={title}>
            {slices.length === 1 ? (
              <circle cx="60" cy="60" r="44" fill="none" stroke={slices[0].color} strokeWidth="22" />
            ) : (
              slices.map((slice) => (
                <path
                  key={slice.label}
                  d={arcPath(60, 60, 44, slice.startAngle, slice.endAngle)}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth="22"
                  className="transition-opacity hover:opacity-80"
                >
                  <title>{`${slice.label}: ${slice.count} (${Math.round((slice.count / total) * 100)}%)`}</title>
                </path>
              ))
            )}
            <text x="60" y="57" textAnchor="middle" className="fill-slate-800 dark:fill-slate-200" style={{ fontSize: '18px', fontWeight: 800 }}>{total}</text>
            <text x="60" y="72" textAnchor="middle" className="fill-slate-400" style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '0.1em' }}>TOTAL</text>
          </svg>

          <div className="w-full space-y-1.5">
            {slices.map((slice) => (
              <div key={slice.label} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-2 min-w-0 font-semibold text-slate-600 dark:text-slate-300">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: slice.color }} />
                  <span className="truncate">{slice.label}</span>
                </span>
                <span className="shrink-0 font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                  {slice.count} <span className="text-slate-400 font-semibold">({Math.round((slice.count / total) * 100)}%)</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
