import { useQuery } from '@tanstack/react-query';
import api from '../../api';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';

export default function AdminDashboardPage() {
  const { data: assets = [] } = useQuery({ queryKey: ['assets'], queryFn: async () => (await api.get('/assets')).data.assets });
  const { data: issues = [] } = useQuery({ queryKey: ['issues'], queryFn: async () => (await api.get('/issues')).data.issues });
  const openIssues = issues.filter((issue) => !['Resolved', 'Verified', 'Closed'].includes(issue.status));
  const faultyAssets = assets.filter((asset) => ['Issue Reported', 'Under Inspection', 'Under Maintenance', 'Out of Service', 'Faulty'].includes(asset.status));

  return <div className="space-y-6">
    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-ink-500">Admin dashboard</p>
      <h1 className="mt-2 text-3xl font-semibold">Manage equipment, complaints, and technicians</h1>
      <p className="mt-2 text-slate-500 dark:text-slate-400">Everything is tracked through QR-linked assets and immutable history.</p>
    </section>

    <div className="grid gap-4 md:grid-cols-4">
      <StatCard label="Total equipment" value={assets.length} />
      <StatCard label="Active equipment" value={assets.filter((asset) => asset.status === 'Operational').length} />
      <StatCard label="Faulty equipment" value={faultyAssets.length} />
      <StatCard label="Pending requests" value={openIssues.length} />
    </div>

    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-xl font-semibold">Recent complaints</h2>
      <div className="mt-5 space-y-3">
        {issues.slice(0, 5).map((issue) => <div key={issue._id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
          <div>
            <p className="font-medium">{issue.title}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{issue.issueNumber} · {issue.asset?.name || issue.assetCode}</p>
          </div>
          <StatusBadge value={issue.status} />
        </div>)}
      </div>
    </section>
  </div>;
}
