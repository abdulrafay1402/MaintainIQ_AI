const STATUS_STYLES = {
  Operational: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  'Issue Reported': 'bg-amber-50 text-amber-700 ring-amber-200',
  'Under Inspection': 'bg-sky-50 text-sky-700 ring-sky-200',
  'Under Maintenance': 'bg-orange-50 text-orange-700 ring-orange-200',
  'Out of Service': 'bg-rose-50 text-rose-700 ring-rose-200',
  Retired: 'bg-slate-100 text-slate-700 ring-slate-200',
  Faulty: 'bg-red-50 text-red-700 ring-red-200',
  Reported: 'bg-amber-50 text-amber-700 ring-amber-200',
  Assigned: 'bg-sky-50 text-sky-700 ring-sky-200',
  'Inspection Started': 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  'Maintenance In Progress': 'bg-orange-50 text-orange-700 ring-orange-200',
  'Waiting for Parts': 'bg-yellow-50 text-yellow-700 ring-yellow-200',
  Resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Verified: 'bg-teal-50 text-teal-700 ring-teal-200',
  Closed: 'bg-slate-100 text-slate-700 ring-slate-200',
  Reopened: 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200',
  Rejected: 'bg-red-50 text-red-700 ring-red-200',
  Cancelled: 'bg-slate-100 text-slate-700 ring-slate-200',
  Pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  Accepted: 'bg-sky-50 text-sky-700 ring-sky-200',
  'In Progress': 'bg-orange-50 text-orange-700 ring-orange-200',
};

export default function StatusBadge({ value }) {
  const style = STATUS_STYLES[value] || 'bg-slate-100 text-slate-700 ring-slate-200';
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${style}`}>{value}</span>;
}
