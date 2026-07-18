import { useQuery } from '@tanstack/react-query';
import api from '../../api';
import BarList from '../../components/BarList';
import PieChart from '../../components/PieChart';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';

const STATUS_COLORS = {
  Assigned: '#0ea5e9',
  'Inspection Started': '#6366f1',
  'Maintenance In Progress': '#f97316',
  'Waiting for Parts': '#eab308',
  Resolved: '#10b981',
  Verified: '#14b8a6',
  Closed: '#94a3b8',
  Reopened: '#d946ef',
};

const STATUS_DOTS = {
  Assigned: 'bg-sky-500',
  'Inspection Started': 'bg-indigo-500',
  'Maintenance In Progress': 'bg-orange-500',
  'Waiting for Parts': 'bg-yellow-500',
  Resolved: 'bg-emerald-500',
  Verified: 'bg-teal-500',
  Closed: 'bg-slate-400',
  Reopened: 'bg-fuchsia-500',
};

export default function TechnicianDashboardPage() {
  const auth = useAuth();
  const { data: tasks = [] } = useQuery({
    queryKey: ['assigned-issues'],
    queryFn: async () => (await api.get('/issues/assigned')).data.issues
  });

  const completedTasks = tasks.filter((issue) => ['Resolved', 'Verified', 'Closed'].includes(issue.status));
  const completed = completedTasks.length;
  const pending = tasks.length - completed;

  const statusRows = Object.entries(
    tasks.reduce((acc, issue) => {
      acc[issue.status] = (acc[issue.status] || 0) + 1;
      return acc;
    }, {})
  ).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);

  const categoryRows = Object.entries(
    tasks.reduce((acc, issue) => {
      const key = issue.category || 'General';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  ).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);

  const repairDurations = completedTasks
    .map((issue) => Number(issue.durationHours))
    .filter((hours) => Number.isFinite(hours) && hours > 0);
  const averageRepairTime = repairDurations.length
    ? `${(repairDurations.reduce((sum, hours) => sum + hours, 0) / repairDurations.length).toFixed(1)} h`
    : 'N/A';

  return (
    <div className="space-y-6">
      {/* Banner */}
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/70 p-8 shadow-soft backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60">
        <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-ink-500/5 blur-[50px] pointer-events-none" />
        
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-ink-500 font-display">Technical Command</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white font-display">
          My Repairs & Work orders
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-xl leading-relaxed font-semibold">
          Review issues assigned to your queue, track diagnostics suggestions, and log your maintenance actions from inspections up to repair completion.
        </p>
      </section>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Assigned tasks" value={tasks.length} hint="Total tasks in your queue" />
        <StatCard label="Pending repairs" value={pending} hint="Awaiting field inspection or fix" />
        <StatCard label="Completed work" value={completed} hint="Resolved and verified orders" />
        <StatCard label="Avg Repair Time" value={averageRepairTime} hint="Average speed of resolved tasks" />
      </div>

      {auth.user?.supervisorCategories?.length ? (
        <section className="rounded-2xl border border-indigo-200/60 bg-indigo-50/30 p-4 text-xs font-semibold text-indigo-800 dark:border-indigo-900/30 dark:bg-indigo-950/20 dark:text-indigo-300">
          ⭐ You supervise <strong>{auth.user.supervisorCategories.join(', ')}</strong> — team assignments and completed work notifications appear in your bell, and the review queue lives in the <a href="/technician/team" className="underline font-bold">Team</a> tab.
        </section>
      ) : null}

      {/* Analytics */}
      <div className="grid gap-6 lg:grid-cols-2">
        <BarList
          title="My tasks by status"
          subtitle="Where your work orders currently stand"
          rows={statusRows}
          dotFor={(label) => STATUS_DOTS[label]}
        />
        <BarList
          title="My tasks by category"
          subtitle="The departments your work falls under"
          rows={categoryRows}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PieChart
          title="My workload distribution"
          subtitle="Share of tasks per lifecycle stage"
          rows={statusRows}
          colorFor={(label) => STATUS_COLORS[label]}
        />
        <PieChart
          title="My repair spend by category"
          subtitle={`Total maintenance value handled: ${completedTasks.reduce((sum, issue) => sum + (issue.maintenanceCost || 0), 0).toLocaleString()}`}
          rows={Object.entries(completedTasks.reduce((acc, issue) => {
            const key = issue.category || 'General';
            acc[key] = (acc[key] || 0) + (issue.maintenanceCost || 0);
            return acc;
          }, {})).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count)}
        />
      </div>

      {/* Recent Repairs Cards */}
      <section className="rounded-[2rem] border border-slate-200/80 bg-white/70 p-6 shadow-soft backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display">Active assigned queue</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Browse recent active work orders</p>
          </div>
        </div>
        
        <div className="mt-5 space-y-3">
          {tasks.slice(0, 5).map((issue) => (
            <div 
              key={issue._id} 
              className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white/50 p-4 transition-all hover:bg-slate-50/50 hover:translate-x-1 dark:border-slate-800 dark:bg-slate-950/20 dark:hover:bg-slate-900/30"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 dark:bg-slate-950/60 text-sm">
                  <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </span>
                <div>
                  <p className="font-bold text-sm text-slate-850 dark:text-slate-200">{issue.title}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-semibold">
                    {issue.issueNumber} · <span className="font-mono text-ink-600 dark:text-ink-350">{issue.asset?.name || issue.assetCode}</span>
                  </p>
                </div>
              </div>
              <StatusBadge value={issue.status} />
            </div>
          ))}
          {tasks.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400 italic">No tasks currently assigned to you.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
