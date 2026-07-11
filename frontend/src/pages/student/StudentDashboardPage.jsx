import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../../api';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';

export default function StudentDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['student', 'complaints'],
    queryFn: async () => (await api.get('/issues/my')).data.issues,
  });

  const complaints = data || [];
  const pending = complaints.filter((issue) => ['Reported', 'Assigned', 'Inspection Started', 'Maintenance In Progress', 'Waiting for Parts'].includes(issue.status)).length;
  const completed = complaints.filter((issue) => ['Resolved', 'Verified', 'Closed'].includes(issue.status)).length;

  return <div className="space-y-6">
    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-ink-500">Student dashboard</p>
      <h1 className="mt-2 text-3xl font-semibold">Track your equipment complaints</h1>
      <p className="mt-2 text-slate-500 dark:text-slate-400">Scan a QR code, report issues, and monitor every status change.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link to="/student/scan" className="rounded-2xl bg-ink-900 px-4 py-3 text-white dark:bg-white dark:text-ink-900">Scan QR</Link>
        <Link to="/student/complaints" className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">My complaints</Link>
      </div>
    </section>

    <div className="grid gap-4 md:grid-cols-3">
      <StatCard label="Total complaints" value={complaints.length} hint="All complaints created by you" />
      <StatCard label="Pending complaints" value={pending} hint="Waiting for admin or technician action" />
      <StatCard label="Completed complaints" value={completed} hint="Resolved, verified, or closed" />
    </div>

    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Complaint history</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Latest complaints and status updates.</p>
        </div>
      </div>
      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
          <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-950 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Issue</th>
              <th className="px-4 py-3 font-medium">Asset</th>
              <th className="px-4 py-3 font-medium">Priority</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
            {isLoading ? <tr><td className="px-4 py-4" colSpan={4}>Loading...</td></tr> : complaints.map((issue) => <tr key={issue._id}>
              <td className="px-4 py-4 font-medium">{issue.issueNumber}<div className="text-xs text-slate-500">{issue.title}</div></td>
              <td className="px-4 py-4">{issue.asset?.name || issue.assetCode}</td>
              <td className="px-4 py-4">{issue.priority}</td>
              <td className="px-4 py-4"><StatusBadge value={issue.status} /></td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </section>
  </div>;
}
