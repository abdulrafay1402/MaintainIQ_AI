const STATUS_STYLES = {
  // Operational
  Operational: 'bg-emerald-50 text-emerald-700 ring-emerald-200/50 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20',
  
  // Issue states
  'Issue Reported': 'bg-amber-50 text-amber-700 ring-amber-200/50 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20',
  'Under Inspection': 'bg-sky-50 text-sky-700 ring-sky-200/50 dark:bg-sky-500/10 dark:text-sky-400 dark:ring-sky-500/20',
  'Under Maintenance': 'bg-orange-50 text-orange-700 ring-orange-200/50 dark:bg-orange-500/10 dark:text-orange-400 dark:ring-orange-500/20',
  'Out of Service': 'bg-rose-50 text-rose-700 ring-rose-200/50 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/20',
  Retired: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700',
  Faulty: 'bg-red-50 text-red-700 ring-red-200/50 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/20',
  
  Reported: 'bg-amber-50 text-amber-700 ring-amber-200/50 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20',
  Assigned: 'bg-sky-50 text-sky-700 ring-sky-200/50 dark:bg-sky-500/10 dark:text-sky-400 dark:ring-sky-500/20',
  'Inspection Started': 'bg-indigo-50 text-indigo-700 ring-indigo-200/50 dark:bg-indigo-500/10 dark:text-indigo-400 dark:ring-indigo-500/20',
  'Maintenance In Progress': 'bg-orange-50 text-orange-700 ring-orange-200/50 dark:bg-orange-500/10 dark:text-orange-400 dark:ring-orange-500/20',
  'Waiting for Parts': 'bg-yellow-50 text-yellow-700 ring-yellow-200/50 dark:bg-yellow-500/10 dark:text-yellow-400 dark:ring-yellow-500/20',
  
  Resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-200/50 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20',
  Verified: 'bg-teal-50 text-teal-700 ring-teal-200/50 dark:bg-teal-500/10 dark:text-teal-400 dark:ring-teal-500/20',
  Closed: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700',
  Reopened: 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200/50 dark:bg-fuchsia-500/10 dark:text-fuchsia-400 dark:ring-fuchsia-500/20',
  Rejected: 'bg-red-50 text-red-700 ring-red-200/50 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/20',
  Cancelled: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700',
  Pending: 'bg-amber-50 text-amber-700 ring-amber-200/50 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20',
  Accepted: 'bg-sky-50 text-sky-700 ring-sky-200/50 dark:bg-sky-500/10 dark:text-sky-400 dark:ring-sky-500/20',
  'In Progress': 'bg-orange-50 text-orange-700 ring-orange-200/50 dark:bg-orange-500/10 dark:text-orange-400 dark:ring-orange-500/20',

  // Asset conditions — a healthy asset must not render as a pulsing warning
  Good: 'bg-emerald-50 text-emerald-700 ring-emerald-200/50 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20',
  Fair: 'bg-amber-50 text-amber-700 ring-amber-200/50 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20',
  Poor: 'bg-rose-50 text-rose-700 ring-rose-200/50 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/20',
};

const DOT_COLORS = {
  Operational: 'bg-emerald-500',
  Verified: 'bg-teal-500',
  Resolved: 'bg-emerald-500',
  Retired: 'bg-slate-400',
  Closed: 'bg-slate-400',
  Cancelled: 'bg-slate-400',
  Good: 'bg-emerald-500',
  Fair: 'bg-amber-500',
  Poor: 'bg-rose-500',
};

export default function StatusBadge({ value }) {
  const style = STATUS_STYLES[value] || 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-450';
  const dotColor = DOT_COLORS[value] || 'bg-amber-500 animate-pulse';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${style}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
      {value}
    </span>
  );
}
