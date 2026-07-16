import { useQuery } from '@tanstack/react-query';
import api from '../../api';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';

export default function AdminDashboardPage() {
  const { data: assets = [] } = useQuery({ 
    queryKey: ['assets'], 
    queryFn: async () => (await api.get('/assets')).data.assets 
  });
  
  const { data: issues = [] } = useQuery({ 
    queryKey: ['issues'], 
    queryFn: async () => (await api.get('/issues')).data.issues 
  });

  const openIssues = issues.filter((issue) => !['Resolved', 'Verified', 'Closed'].includes(issue.status));
  const faultyAssets = assets.filter((asset) => ['Issue Reported', 'Under Inspection', 'Under Maintenance', 'Out of Service', 'Faulty'].includes(asset.status));

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
        <StatCard label="Total Equipment" value={assets.length} hint="Assets in database inventory" />
        <StatCard label="Active Equipment" value={assets.filter((asset) => asset.status === 'Operational').length} hint="Currently in active service" />
        <StatCard label="Faulty Equipment" value={faultyAssets.length} hint="Reported faults or under repair" />
        <StatCard label="Pending Complaints" value={openIssues.length} hint="Active triages & tasks" />
      </div>

      {/* Recent Activity Section */}
      <section className="rounded-[2rem] border border-slate-200/80 bg-white/70 p-6 shadow-soft backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display">Recent complaints</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">The 5 most recently filed maintenance issues</p>
          </div>
        </div>
        
        <div className="mt-5 space-y-3">
          {issues.slice(0, 5).map((issue) => (
            <div 
              key={issue._id} 
              className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white/50 p-4 transition-all hover:bg-slate-50/50 hover:translate-x-1 dark:border-slate-800 dark:bg-slate-950/20 dark:hover:bg-slate-900/30"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 dark:bg-slate-950/60 text-sm">
                  📋
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
          {issues.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No issues reported yet.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
