import { useQuery } from '@tanstack/react-query';
import api from '../../api';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';

export default function TechnicianDashboardPage() {
  const { data: tasks = [] } = useQuery({ queryKey: ['assigned-issues'], queryFn: async () => (await api.get('/issues/assigned')).data.issues });
  const completedTasks = tasks.filter((issue) => ['Resolved', 'Verified', 'Closed'].includes(issue.status));
  const completed = completedTasks.length;
  const pending = tasks.length - completed;

  const repairDurations = completedTasks
    .map((issue) => Number(issue.durationHours))
    .filter((hours) => Number.isFinite(hours) && hours > 0);
  const averageRepairTime = repairDurations.length
    ? `${(repairDurations.reduce((sum, hours) => sum + hours, 0) / repairDurations.length).toFixed(1)} h`
    : 'N/A';

  return <div className="space-y-6">
    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-ink-500">Technician dashboard</p>
      <h1 className="mt-2 text-3xl font-semibold">Assigned repairs and maintenance workflow</h1>
    </section>

    <div className="grid gap-4 md:grid-cols-4">
      <StatCard label="Assigned tasks" value={tasks.length} />
      <StatCard label="Pending tasks" value={pending} />
      <StatCard label="Completed tasks" value={completed} />
      <StatCard label="Average repair time" value={averageRepairTime} hint="Average duration of your completed repairs" />
    </div>

    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-xl font-semibold">Recent repairs</h2>
      <div className="mt-4 space-y-3">
        {tasks.slice(0, 5).map((issue) => <div key={issue._id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
          <div>
            <p className="font-medium">{issue.title}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{issue.asset?.name || issue.assetCode}</p>
          </div>
          <StatusBadge value={issue.status} />
        </div>)}
      </div>
    </section>
  </div>;
}
