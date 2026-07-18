import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../api';
import StatusBadge from '../../components/StatusBadge';
import StatusProgress from '../../components/StatusProgress';
import { useAuth } from '../../context/AuthContext';

const EXPERTISE_OPTIONS = ['Electronics / IT', 'Electrical', 'HVAC / Air Conditioning', 'Plumbing', 'Mechanical / Furniture', 'Safety & Security', 'Lab Equipment'];

const getInitials = (name = 'U') => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

export default function TechnicianTeamPage() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [reviewingId, setReviewingId] = useState(null);

  const supervisorCategories = auth.user?.supervisorCategories || [];
  const isSupervisor = supervisorCategories.length > 0;

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: async () => (await api.get('/users/technicians')).data.technicians,
  });

  const { data: teamData } = useQuery({
    queryKey: ['team-issues'],
    queryFn: async () => (await api.get('/issues/team')).data,
    enabled: isSupervisor,
    refetchInterval: 20000,
  });
  const teamIssues = teamData?.issues || [];

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, note }) => api.patch(`/issues/${id}/status`, { status, note }),
    onSuccess: (_data, variables) => {
      toast.success(variables.status === 'Reopened' ? 'Issue reopened and sent back to the team' : `Issue marked as ${variables.status}`);
      queryClient.invalidateQueries({ queryKey: ['team-issues'] });
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-issues'] });
      setReviewNote('');
      setReviewingId(null);
    },
    onError: (error) => toast.error(error?.response?.data?.message || 'Review action failed'),
  });

  // Group technicians by expertise — a technician with multiple tags appears
  // in every matching department group.
  const grouped = useMemo(() => {
    const groups = [];
    const categories = departmentFilter ? [departmentFilter] : EXPERTISE_OPTIONS;
    categories.forEach((category) => {
      const members = technicians.filter((tech) => tech.expertise?.includes(category));
      if (members.length > 0) groups.push({ category, members });
    });
    const generalists = technicians.filter((tech) => !tech.expertise?.length);
    if (!departmentFilter && generalists.length > 0) groups.push({ category: 'General Maintenance', members: generalists });
    return groups;
  }, [technicians, departmentFilter]);

  const awaitingReview = teamIssues.filter((issue) => issue.status === 'Resolved');
  const activeTeamWork = teamIssues.filter((issue) => !['Resolved', 'Verified', 'Closed', 'Rejected', 'Cancelled'].includes(issue.status));

  // Per-technician performance within the supervised departments.
  const performance = useMemo(() => {
    const byTech = {};
    teamIssues.forEach((issue) => {
      const tech = issue.assignedTechnician;
      if (!tech) return;
      if (!byTech[tech._id]) byTech[tech._id] = { name: tech.name, total: 0, done: 0, hours: 0, hoursCount: 0, cost: 0 };
      byTech[tech._id].total += 1;
      if (['Resolved', 'Verified', 'Closed'].includes(issue.status)) {
        byTech[tech._id].done += 1;
        byTech[tech._id].cost += issue.maintenanceCost || 0;
        if (issue.durationHours) {
          byTech[tech._id].hours += issue.durationHours;
          byTech[tech._id].hoursCount += 1;
        }
      }
    });
    return Object.values(byTech).sort((a, b) => b.done - a.done);
  }, [teamIssues]);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/70 p-6 shadow-soft backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-ink-500 font-display">Team Directory</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white font-display">
          {isSupervisor ? 'Team & Supervision' : 'Technical Team'}
        </h1>
        {isSupervisor ? (
          <p className="mt-2 text-xs font-semibold text-indigo-650 dark:text-indigo-400">⭐ You supervise: {supervisorCategories.join(', ')}</p>
        ) : null}
      </section>

      {/* Supervisor review queue */}
      {isSupervisor ? (
        <section className="rounded-[2rem] border border-indigo-200/60 bg-indigo-50/20 p-6 shadow-soft backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/60">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display">Review queue — completed maintenance</h2>
          <p className="text-xs text-slate-400 font-medium">Approve the resolution (Verify), close it, or reopen it back to the team.</p>
          <div className="mt-4 space-y-3">
            {awaitingReview.map((issue) => (
              <div key={issue._id} className="rounded-2xl border border-slate-100 bg-white/60 p-4 dark:border-slate-800 dark:bg-slate-950/20">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{issue.title}</p>
                    <p className="text-xs text-slate-400 font-semibold mt-0.5">
                      {issue.issueNumber} · {issue.asset?.name || issue.assetCode} · resolved by {issue.assignedTechnician?.name || '—'}
                    </p>
                  </div>
                  <StatusBadge value={issue.status} />
                </div>
                {issue.maintenanceNotes ? (
                  <p className="mt-2 rounded-xl bg-slate-50/70 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/50 p-2.5 text-[11px] text-slate-600 dark:text-slate-400">
                    <strong>Maintenance note:</strong> {issue.maintenanceNotes}
                  </p>
                ) : null}
                {reviewingId === issue._id ? (
                  <div className="mt-3 space-y-2">
                    <textarea
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      rows={2}
                      placeholder="Review note (required for reopen)…"
                      className="w-full rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-xs outline-none dark:border-slate-800 dark:bg-slate-950/60"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        disabled={reviewMutation.isPending}
                        onClick={() => reviewMutation.mutate({ id: issue._id, status: 'Verified', note: reviewNote || 'Work reviewed and verified by supervisor' })}
                        className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-bold text-white cursor-pointer"
                      >
                        ✓ Verify work
                      </button>
                      <button
                        disabled={reviewMutation.isPending || !reviewNote.trim()}
                        onClick={() => reviewMutation.mutate({ id: issue._id, status: 'Reopened', note: reviewNote })}
                        className="rounded-xl border border-rose-300 text-rose-600 hover:bg-rose-50 px-4 py-2 text-xs font-bold dark:border-rose-900/40 dark:hover:bg-rose-950/20 cursor-pointer disabled:opacity-40"
                      >
                        ↺ Reopen {!reviewNote.trim() ? '(note required)' : ''}
                      </button>
                      <button onClick={() => { setReviewingId(null); setReviewNote(''); }} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold dark:border-slate-800 cursor-pointer">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setReviewingId(issue._id)}
                    className="mt-3 rounded-xl bg-ink-900 px-4 py-2 text-xs font-bold text-white dark:bg-white dark:text-ink-900 cursor-pointer"
                  >
                    Review this work
                  </button>
                )}
              </div>
            ))}
            {awaitingReview.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-6">Nothing waiting for review. 🎉</p>
            ) : null}
          </div>

          {/* Active team work */}
          {activeTeamWork.length > 0 ? (
            <div className="mt-6 border-t border-slate-200/60 dark:border-slate-800 pt-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Team work in progress ({activeTeamWork.length})</h3>
              <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                {activeTeamWork.map((issue) => (
                  <div key={issue._id} className="rounded-2xl border border-slate-100 bg-white/50 p-3.5 dark:border-slate-800 dark:bg-slate-950/20">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{issue.title}</p>
                      <span className="text-[10px] font-semibold text-slate-400 shrink-0">{issue.assignedTechnician?.name || 'Unassigned'}</span>
                    </div>
                    <StatusProgress status={issue.status} compact />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Team performance */}
          {performance.length > 0 ? (
            <div className="mt-6 border-t border-slate-200/60 dark:border-slate-800 pt-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Team performance</h3>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {performance.map((tech) => (
                  <div key={tech.name} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white/50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/20 text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-indigo-50 text-indigo-650 dark:bg-slate-950 dark:text-indigo-400 font-bold text-[10px]">{getInitials(tech.name)}</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{tech.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-700 dark:text-emerald-400">{tech.done}/{tech.total} resolved</p>
                      <p className="text-[10px] text-slate-400">
                        {tech.hoursCount > 0 ? `avg ${(tech.hours / tech.hoursCount).toFixed(1)}h` : ''}
                        {tech.cost > 0 ? `${tech.hoursCount > 0 ? ' · ' : ''}spend ${tech.cost.toLocaleString()}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Technician directory grouped by department/expertise */}
      <section className="rounded-[2rem] border border-slate-200/80 bg-white/70 p-6 shadow-soft backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display">Technicians by department</h2>
          <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200">
            <option value="">All departments</option>
            {EXPERTISE_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>

        <div className="space-y-5">
          {grouped.map(({ category, members }) => (
            <div key={category}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">{category} ({members.length})</h3>
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {members.map((tech) => (
                  <div key={`${category}-${tech._id}`} className={`flex items-center gap-3 rounded-2xl border p-3.5 ${tech._id === auth.user?.id ? 'border-ink-300 bg-ink-50/20 dark:border-ink-600 dark:bg-slate-950/40' : 'border-slate-100 bg-white/50 dark:border-slate-800 dark:bg-slate-950/20'}`}>
                    <div className="h-9 w-9 rounded-full bg-indigo-50 text-indigo-650 dark:bg-slate-950 dark:text-indigo-400 font-bold flex items-center justify-center text-xs shrink-0">
                      {getInitials(tech.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        {tech.name} {tech._id === auth.user?.id ? '(you)' : ''}
                        {tech.supervisorCategories?.includes(category) ? <span className="ml-1 text-[9px] font-bold text-indigo-600 dark:text-indigo-400">⭐ Supervisor</span> : null}
                      </p>
                      <p className="text-[10px] text-slate-400 font-semibold truncate">{tech.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {grouped.length === 0 ? <p className="text-xs text-slate-400 italic text-center py-6">No technicians found for this department.</p> : null}
        </div>
      </section>
    </div>
  );
}
