import { useNavigate } from 'react-router-dom';

// Themed back button used at the top of every inner page — pill shaped,
// glassy, with the arrow nudging left on hover.
export default function BackButton() {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(-1)}
      className="group inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/60 px-4 py-2 text-xs font-bold text-slate-600 shadow-soft backdrop-blur transition-all hover:border-ink-500 hover:text-ink-600 hover:shadow-[0_6px_20px_rgba(45,212,191,0.15)] dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:border-ink-500 dark:hover:text-ink-500 cursor-pointer"
      aria-label="Go back"
    >
      <svg className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
      </svg>
      Back
    </button>
  );
}
