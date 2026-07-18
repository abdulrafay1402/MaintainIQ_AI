import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../../api';
import PieChart from '../../components/PieChart';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';

const STATUS_COLORS = {
  Reported: '#f59e0b',
  Assigned: '#0ea5e9',
  'Inspection Started': '#6366f1',
  'Maintenance In Progress': '#f97316',
  'Waiting for Parts': '#eab308',
  Resolved: '#10b981',
  Verified: '#14b8a6',
  Closed: '#94a3b8',
  Reopened: '#d946ef',
  Rejected: '#f43f5e',
  Cancelled: '#64748b',
};

const getInitials = (name = 'U') => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

const STATUS_DOTS = {
  Reported: 'bg-amber-500',
  Assigned: 'bg-sky-500',
  'Inspection Started': 'bg-indigo-500',
  'Maintenance In Progress': 'bg-orange-500',
  'Waiting for Parts': 'bg-yellow-500',
  Resolved: 'bg-emerald-500',
  Verified: 'bg-teal-500',
  Closed: 'bg-slate-400',
  Reopened: 'bg-fuchsia-500',
  Rejected: 'bg-rose-500',
  Cancelled: 'bg-slate-400',
};

// Single-measure horizontal bar list: identity comes from the row label
// (never color alone), magnitude from bar length, value labeled at row end.
function BarList({ title, subtitle, rows, dotFor }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <section className="rounded-[2rem] border border-slate-200/80 bg-white/70 p-6 shadow-soft backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60">
      <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display">{title}</h2>
      <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">{subtitle}</p>
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

export default function AdminDashboardPage() {
  const { data: dashboard } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: async () => (await api.get('/dashboard/admin')).data,
  });

  const { data: assets = [] } = useQuery({
    queryKey: ['assets'],
    queryFn: async () => (await api.get('/assets')).data.assets,
  });

  const { data: allIssues = [] } = useQuery({
    queryKey: ['issues'],
    queryFn: async () => (await api.get('/issues')).data.issues,
  });

  // Per-technician performance: totals, resolved, avg repair time, and cost handled.
  const technicianPerformance = Object.values(
    allIssues.reduce((acc, issue) => {
      const tech = issue.assignedTechnician;
      if (!tech) return acc;
      if (!acc[tech._id]) acc[tech._id] = { name: tech.name, total: 0, done: 0, hours: 0, hoursCount: 0, cost: 0 };
      acc[tech._id].total += 1;
      if (['Resolved', 'Verified', 'Closed'].includes(issue.status)) {
        acc[tech._id].done += 1;
        acc[tech._id].cost += issue.maintenanceCost || 0;
        if (issue.durationHours) {
          acc[tech._id].hours += issue.durationHours;
          acc[tech._id].hoursCount += 1;
        }
      }
      return acc;
    }, {})
  ).sort((a, b) => b.done - a.done);

  const totalMaintenanceSpend = allIssues.reduce((sum, issue) => sum + (issue.maintenanceCost || 0), 0);

  const stats = dashboard?.stats || {};
  const recentIssues = dashboard?.recentIssues || [];

  const statusRows = (dashboard?.statusDistribution || [])
    .map((entry) => ({ label: entry._id, count: entry.count }))
    .sort((a, b) => b.count - a.count);

  const categoryRows = (dashboard?.categoryDistribution || [])
    .map((entry) => ({ label: entry._id || 'Uncategorized', count: entry.count }));

  const dueSoon = assets
    .filter((asset) => {
      if (!asset.nextServiceDate || asset.status === 'Retired') return false;
      const dueIn = (new Date(asset.nextServiceDate) - Date.now()) / (24 * 60 * 60 * 1000);
      return dueIn <= 14;
    })
    .sort((a, b) => new Date(a.nextServiceDate) - new Date(b.nextServiceDate))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Dashboard Banner */}
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/70 p-8 shadow-soft backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60">
        <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-ink-500/5 blur-[50px] pointer-events-none" />

        <p className="text-xs font-bold uppercase tracking-[0.25em] text-ink-500">Admin Command Center</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white font-display">
          Manage Equipment & Complaints
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-xl leading-relaxed font-medium">
          Monitor your asset inventory, track active maintenance tasks, and oversee team assignments in real-time through QR workflows.
        </p>
      </section>

      {/* Stats Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Equipment" value={stats.totalEquipment ?? assets.length} hint="Active assets in inventory" />
        <StatCard label="Operational" value={stats.activeEquipment ?? 0} hint="Currently in active service" />
        <StatCard label="Faulty / In Repair" value={(stats.faultyEquipment ?? 0) + (stats.outOfService ?? 0)} hint="Reported faults or out of service" />
        <StatCard label="Resolved This Month" value={stats.resolvedThisMonth ?? 0} hint="Completed maintenance jobs" />
      </div>

      {/* Analytics: real operational distributions */}
      <div className="grid gap-6 lg:grid-cols-2">
        <BarList
          title="Complaints by status"
          subtitle="Live pipeline of every maintenance issue"
          rows={statusRows}
          dotFor={(label) => STATUS_DOTS[label]}
        />
        <BarList
          title="Complaints by category"
          subtitle="Where faults are happening the most"
          rows={categoryRows}
        />
      </div>

      {/* Pie analytics */}
      <div className="grid gap-6 lg:grid-cols-2">
        <PieChart
          title="Status distribution"
          subtitle="Share of complaints at each lifecycle stage"
          rows={statusRows}
          colorFor={(label) => STATUS_COLORS[label]}
        />
        <PieChart
          title="Category distribution"
          subtitle="Which departments generate the most complaints"
          rows={categoryRows}
        />
      </div>

      {/* Technician performance report */}
      <section className="rounded-[2rem] border border-slate-200/80 bg-white/70 p-6 shadow-soft backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display">Technician performance</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Workload, completion, average repair time, and maintenance spend per technician</p>
          </div>
          <span className="rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 tabular-nums">
            Total maintenance spend: {totalMaintenanceSpend.toLocaleString()}
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {technicianPerformance.map((tech) => (
            <div key={tech.name} className="rounded-2xl border border-slate-100 bg-white/50 p-4 dark:border-slate-800 dark:bg-slate-950/20">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-indigo-50 text-indigo-650 dark:bg-slate-950 dark:text-indigo-400 font-bold text-xs shrink-0">{getInitials(tech.name)}</span>
                <p className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate">{tech.name}</p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-xl bg-slate-50/70 dark:bg-slate-950/40 p-2"><span className="block text-slate-400 font-bold uppercase tracking-wider text-[8px]">Assigned</span><span className="font-bold text-slate-800 dark:text-slate-200">{tech.total}</span></div>
                <div className="rounded-xl bg-slate-50/70 dark:bg-slate-950/40 p-2"><span className="block text-slate-400 font-bold uppercase tracking-wider text-[8px]">Resolved</span><span className="font-bold text-emerald-700 dark:text-emerald-400">{tech.done}</span></div>
                <div className="rounded-xl bg-slate-50/70 dark:bg-slate-950/40 p-2"><span className="block text-slate-400 font-bold uppercase tracking-wider text-[8px]">Avg repair</span><span className="font-bold text-slate-800 dark:text-slate-200">{tech.hoursCount ? `${(tech.hours / tech.hoursCount).toFixed(1)} h` : '—'}</span></div>
                <div className="rounded-xl bg-slate-50/70 dark:bg-slate-950/40 p-2"><span className="block text-slate-400 font-bold uppercase tracking-wider text-[8px]">Spend handled</span><span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">{tech.cost.toLocaleString()}</span></div>
              </div>
            </div>
          ))}
          {technicianPerformance.length === 0 ? (
            <p className="col-span-full py-6 text-center text-xs text-slate-400 italic">No technician assignments yet.</p>
          ) : null}
        </div>
      </section>

      {/* Service due soon — preventive maintenance radar */}
      <section className="rounded-[2rem] border border-slate-200/80 bg-white/70 p-6 shadow-soft backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display">Service due soon</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Assets whose next service date is within 14 days (or overdue)</p>
          </div>
          <Link to="/admin/equipment" className="text-xs font-bold text-ink-600 dark:text-ink-300 underline decoration-ink-300 underline-offset-4">Open equipment</Link>
        </div>
        <div className="mt-4 space-y-2.5">
          {dueSoon.map((asset) => {
            const overdue = new Date(asset.nextServiceDate) < new Date();
            return (
              <div key={asset._id} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white/50 p-3.5 dark:border-slate-800 dark:bg-slate-950/20">
                <div className="min-w-0">
                  <p className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate">{asset.name}</p>
                  <p className="text-xs text-slate-400 font-semibold mt-0.5 font-mono">{asset.code} · {asset.location}</p>
                </div>
                <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${overdue ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'}`}>
                  {overdue ? 'Overdue' : new Date(asset.nextServiceDate).toLocaleDateString()}
                </span>
              </div>
            );
          })}
          {dueSoon.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400 italic">No assets due for service in the next 14 days.</p>
          ) : null}
        </div>
      </section>

      {/* Recent Activity Section */}
      <section className="rounded-[2rem] border border-slate-200/80 bg-white/70 p-6 shadow-soft backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display">Recent complaints</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">The most recently filed maintenance issues</p>
          </div>
          <Link to="/admin/complaints" className="text-xs font-bold text-ink-600 dark:text-ink-300 underline decoration-ink-300 underline-offset-4">Open queue</Link>
        </div>

        <div className="mt-5 space-y-3">
          {recentIssues.slice(0, 5).map((issue) => (
            <div
              key={issue._id}
              className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white/50 p-4 transition-all hover:bg-slate-50/50 hover:translate-x-1 dark:border-slate-800 dark:bg-slate-950/20 dark:hover:bg-slate-900/30"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 dark:bg-slate-950/60 text-sm">
                  <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </span>
                <div>
                  <p className="font-bold text-sm text-slate-800 dark:text-slate-200 leading-normal">{issue.title}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold mt-0.5">
                    {issue.issueNumber} · <span className="font-mono text-ink-600 dark:text-ink-300">{issue.asset?.name || issue.assetCode}</span>
                  </p>
                </div>
              </div>
              <StatusBadge value={issue.status} />
            </div>
          ))}
          {recentIssues.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No issues reported yet.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
