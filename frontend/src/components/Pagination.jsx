// Pagination control bar: "Showing X–Y of Z", per-page selector, and windowed
// page number buttons. Pairs with the usePagination hook.
export default function Pagination({ page, setPage, perPage, setPerPage, totalPages, total, perPageOptions = [6, 12, 24, 48] }) {
  if (total === 0) return null;

  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  // Windowed page numbers: up to 5 around the current page.
  const windowStart = Math.max(1, Math.min(page - 2, totalPages - 4));
  const numbers = Array.from({ length: Math.min(5, totalPages) }, (_, i) => windowStart + i);

  const navButton = 'grid h-8 min-w-8 place-items-center rounded-xl border text-xs font-bold transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed';

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-400">
        <span>Showing <span className="font-bold text-slate-700 dark:text-slate-200">{from}–{to}</span> of <span className="font-bold text-slate-700 dark:text-slate-200">{total}</span></span>
        <select
          value={perPage}
          onChange={(e) => setPerPage(Number(e.target.value))}
          className="rounded-xl border border-slate-200 bg-white/60 px-2 py-1 text-xs font-bold text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300"
        >
          {perPageOptions.map((option) => <option key={option} value={option}>{option} / page</option>)}
        </select>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center gap-1.5">
          <button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className={`${navButton} border-slate-200 px-2.5 text-slate-600 hover:border-ink-500 hover:text-ink-600 dark:border-slate-800 dark:text-slate-300`}
          >
            ←
          </button>
          {numbers.map((number) => (
            <button
              key={number}
              onClick={() => setPage(number)}
              className={`${navButton} ${
                number === page
                  ? 'border-ink-500 bg-ink-500 text-white dark:text-slate-950'
                  : 'border-slate-200 text-slate-600 hover:border-ink-500 hover:text-ink-600 dark:border-slate-800 dark:text-slate-300'
              }`}
            >
              {number}
            </button>
          ))}
          <button
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
            className={`${navButton} border-slate-200 px-2.5 text-slate-600 hover:border-ink-500 hover:text-ink-600 dark:border-slate-800 dark:text-slate-300`}
          >
            →
          </button>
        </div>
      ) : null}
    </div>
  );
}
