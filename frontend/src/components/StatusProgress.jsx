// Visual lifecycle progress bar for a complaint. The main path is
// Reported → Assigned → Inspection → Maintenance → Resolved → Verified → Closed.
// "Waiting for Parts" is the Maintenance stage (with a badge), "Reopened" drops
// the progress back to the Assigned stage, and Rejected/Cancelled render as a
// terminated bar.
const STAGES = [
  { key: 'Reported', label: 'Reported' },
  { key: 'Assigned', label: 'Assigned' },
  { key: 'Inspection Started', label: 'Inspection' },
  { key: 'Maintenance In Progress', label: 'Maintenance' },
  { key: 'Resolved', label: 'Resolved' },
  { key: 'Verified', label: 'Verified' },
  { key: 'Closed', label: 'Closed' },
];

const STAGE_INDEX = {
  Reported: 0,
  Assigned: 1,
  'Inspection Started': 2,
  'Maintenance In Progress': 3,
  'Waiting for Parts': 3,
  Resolved: 4,
  Verified: 5,
  Closed: 6,
  Reopened: 1,
};

export default function StatusProgress({ status, compact = false }) {
  if (status === 'Rejected' || status === 'Cancelled') {
    return (
      <div className="w-full">
        <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
          <div className="h-full w-full bg-slate-400/60 dark:bg-slate-600" />
        </div>
        <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {status} — workflow terminated
        </p>
      </div>
    );
  }

  const currentIndex = STAGE_INDEX[status] ?? 0;
  const percent = (currentIndex / (STAGES.length - 1)) * 100;
  const isReopened = status === 'Reopened';
  const isWaitingParts = status === 'Waiting for Parts';

  return (
    <div className="w-full">
      <div className="relative">
        {/* Track + fill */}
        <div className="absolute left-0 right-0 top-[5px] h-1.5 rounded-full bg-slate-200 dark:bg-slate-800" />
        <div
          className={`absolute left-0 top-[5px] h-1.5 rounded-full transition-all duration-700 ${isReopened ? 'bg-fuchsia-500' : 'bg-emerald-500'}`}
          style={{ width: `${percent}%` }}
        />
        {/* Stage dots */}
        <div className="relative flex justify-between">
          {STAGES.map((stage, index) => {
            const reached = index <= currentIndex;
            const isCurrent = index === currentIndex;
            return (
              <div key={stage.key} className="flex flex-col items-center" style={{ width: `${100 / STAGES.length}%` }}>
                <span
                  className={`grid h-4 w-4 place-items-center rounded-full ring-2 transition-all duration-500 ${
                    isCurrent
                      ? `${isReopened ? 'bg-fuchsia-500 ring-fuchsia-200 dark:ring-fuchsia-900' : 'bg-emerald-500 ring-emerald-200 dark:ring-emerald-900'} scale-110`
                      : reached
                        ? 'bg-emerald-500 ring-transparent'
                        : 'bg-slate-300 ring-transparent dark:bg-slate-700'
                  }`}
                >
                  {reached && !isCurrent ? (
                    <svg className="h-2.5 w-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : null}
                </span>
                {!compact ? (
                  <span
                    className={`mt-1.5 hidden min-[420px]:block text-center text-[9px] font-bold uppercase tracking-wide leading-tight ${
                      isCurrent
                        ? isReopened ? 'text-fuchsia-600 dark:text-fuchsia-400' : 'text-emerald-600 dark:text-emerald-400'
                        : reached
                          ? 'text-slate-500 dark:text-slate-400'
                          : 'text-slate-300 dark:text-slate-600'
                    }`}
                  >
                    {stage.label}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* On very small screens the per-dot labels are hidden — show the current stage instead */}
      {!compact ? (
        <p className={`mt-2 min-[420px]:hidden text-[10px] font-bold uppercase tracking-wider ${isReopened ? 'text-fuchsia-600 dark:text-fuchsia-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
          Stage: {status}
        </p>
      ) : null}

      {(isReopened || isWaitingParts) ? (
        <p className={`mt-2 text-[10px] font-bold uppercase tracking-wider ${isReopened ? 'text-fuchsia-600 dark:text-fuchsia-400' : 'text-amber-600 dark:text-amber-400'}`}>
          {isReopened ? '↺ Reopened — back in the work queue' : '⏳ Waiting for parts to continue maintenance'}
        </p>
      ) : null}
    </div>
  );
}
