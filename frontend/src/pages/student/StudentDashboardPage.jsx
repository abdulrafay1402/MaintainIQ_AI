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

  return (
    <div className="space-y-6">
      {/* Banner & Quick Actions */}
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/70 p-8 shadow-soft backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60">
        <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-ink-500/5 blur-[50px] pointer-events-none" />
        
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-ink-500 font-display">Student Portal</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white font-display">
          Equipment Fault Reporter
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-xl leading-relaxed font-semibold">
          Report faulty equipment instantly by scanning their labels or search your filed issues and follow the technical resolution lifecycle.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link 
            to="/student/scan" 
            className="rounded-2xl bg-ink-900 hover:bg-ink-850 px-5 py-3 text-sm font-bold text-white shadow dark:bg-white dark:text-ink-900 dark:hover:bg-slate-100 cursor-pointer"
          >
            🔍 Scan Asset QR Code
          </Link>
          <Link 
            to="/student/complaints" 
            className="rounded-2xl border border-slate-200 bg-white/50 px-5 py-3 text-sm font-bold hover:bg-slate-50/50 dark:border-slate-800 dark:bg-slate-950/20 dark:hover:bg-slate-900/30 cursor-pointer"
          >
            📋 View My Complaints
          </Link>
        </div>
      </section>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Complaints" value={complaints.length} hint="Total issues logged by you" />
        <StatCard label="Pending Resolution" value={pending} hint="Awaiting field fix or triage" />
        <StatCard label="Resolved Tickets" value={completed} hint="Resolved or closed issues" />
      </div>

      {/* Complaints History Section */}
      <section className="rounded-[2rem] border border-slate-200/80 bg-white/70 p-6 shadow-soft backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display">Active work logs</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Follow status transitions of your reported issues</p>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-white/40 dark:border-slate-800 dark:bg-slate-900/10">
          <table className="min-w-full divide-y divide-slate-100 text-sm dark:divide-slate-850">
            <thead className="bg-slate-50 text-left text-slate-400 dark:bg-slate-950 dark:text-slate-500">
              <tr>
                <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">Issue Reference</th>
                <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">Equipment ID</th>
                <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">Priority</th>
                <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">Current Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
              {isLoading ? (
                <tr>
                  <td className="px-4 py-6 text-center text-xs text-slate-450" colSpan={4}>Loading work logs...</td>
                </tr>
              ) : complaints.map((issue) => (
                <tr key={issue._id} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/10">
                  <td className="px-4 py-3.5">
                    <p className="font-bold text-slate-800 dark:text-slate-200">{issue.issueNumber}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{issue.title}</p>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-xs text-slate-500 dark:text-slate-400 font-bold">
                    {issue.asset?.name || issue.assetCode}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      issue.priority === 'Critical' 
                        ? 'bg-rose-500 text-white' 
                        : issue.priority === 'High' 
                          ? 'bg-amber-500 text-white' 
                          : 'bg-sky-500 text-white'
                    }`}>
                      {issue.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3.5"><StatusBadge value={issue.status} /></td>
                </tr>
              ))}
              {!isLoading && complaints.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-xs text-slate-400 italic">No complaints logged under your account yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
