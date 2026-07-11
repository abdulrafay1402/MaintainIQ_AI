import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';
import StatusBadge from '../../components/StatusBadge';

const workflowStatuses = ['Reported', 'Assigned', 'Inspection Started', 'Maintenance In Progress', 'Waiting for Parts', 'Resolved', 'Verified', 'Closed', 'Reopened', 'Rejected', 'Cancelled'];

export default function AdminComplaintsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [technicianId, setTechnicianId] = useState('');
  const [status, setStatus] = useState('Inspection Started');
  const [note, setNote] = useState('');

  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [technicianFilter, setTechnicianFilter] = useState('');

  const { data: issues = [] } = useQuery({
    queryKey: ['issues', searchFilter, statusFilter, priorityFilter, categoryFilter, technicianFilter],
    queryFn: async () => {
      const params = {};
      if (searchFilter) params.search = searchFilter;
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      if (categoryFilter) params.category = categoryFilter;
      if (technicianFilter) params.assignedTechnician = technicianFilter;
      return (await api.get('/issues', { params })).data.issues;
    },
  });
  const { data: technicians = [] } = useQuery({ queryKey: ['technicians'], queryFn: async () => (await api.get('/users/technicians')).data.technicians });

  const selected = useMemo(() => selectedIssue || issues[0] || null, [selectedIssue, issues]);

  const issueId = selected?._id;
  const { data: recommendations = [] } = useQuery({
    queryKey: ['technician-recommendations', issueId],
    queryFn: async () => {
      if (!issueId) return [];
      const response = await api.get(`/issues/${issueId}/recommendations`);
      return response.data.recommendations;
    },
    enabled: !!issueId,
  });

  const sortedTechnicians = useMemo(() => {
    return [...technicians].sort((a, b) => {
      const recA = recommendations.find(r => r.technician._id === a._id);
      const recB = recommendations.find(r => r.technician._id === b._id);
      const scoreA = recA?.matchScore || 0;
      const scoreB = recB?.matchScore || 0;
      return scoreB - scoreA;
    });
  }, [technicians, recommendations]);

  const assetId = selected?.asset?._id;
  const { data: history = [] } = useQuery({
    queryKey: ['asset-history', assetId],
    queryFn: async () => {
      if (!assetId) return [];
      const response = await api.get(`/history/asset/${assetId}`);
      return response.data.history;
    },
    enabled: !!assetId,
  });

  const assignMutation = useMutation({
    mutationFn: async ({ id, technicianId: selectedTechnician }) => api.patch(`/issues/${id}/assign`, { technicianId: selectedTechnician }),
    onSuccess: () => {
      toast.success('Complaint assigned');
      queryClient.invalidateQueries({ queryKey: ['issues'] });
    },
    onError: (error) => toast.error(error?.response?.data?.message || 'Assignment failed'),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, nextStatus, nextNote }) => api.patch(`/issues/${id}/status`, { status: nextStatus, note: nextNote }),
    onSuccess: () => {
      toast.success('Complaint updated');
      queryClient.invalidateQueries({ queryKey: ['issues'] });
    },
    onError: (error) => toast.error(error?.response?.data?.message || 'Status update failed'),
  });

  return <div className="space-y-6">
    <div className="flex items-center justify-between">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition cursor-pointer">
        <span>←</span> <span>Back</span>
      </button>
    </div>

    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-ink-500">Complaints</p>
      <h1 className="mt-2 text-3xl font-semibold">Assign, update, verify</h1>
    </section>

    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-semibold">Complaint queue</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <input value={searchFilter} onChange={(e) => setSearchFilter(e.target.value)} placeholder="Search title, number, asset code..." className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-950 sm:col-span-2" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
            <option value="">All statuses</option>
            {workflowStatuses.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
            <option value="">All priorities</option>
            {['Low', 'Medium', 'High', 'Critical'].map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
            <option value="">All categories</option>
            {['Electronics / IT', 'Electrical', 'HVAC / Air Conditioning', 'Plumbing', 'Mechanical / Furniture', 'Safety & Security', 'Lab Equipment'].map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={technicianFilter} onChange={(e) => setTechnicianFilter(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
            <option value="">All technicians</option>
            <option value="unassigned">Unassigned</option>
            {technicians.map((tech) => <option key={tech._id} value={tech._id}>{tech.name}</option>)}
          </select>
        </div>
        <div className="mt-4 space-y-3">
          {issues.map((issue) => <button key={issue._id} onClick={() => { setSelectedIssue(issue); setTechnicianId(issue.assignedTechnician?._id || ''); setStatus(issue.status); setNote(issue.maintenanceNotes || ''); }} className={`w-full rounded-2xl border p-4 text-left transition ${selected?._id === issue._id ? 'border-ink-900 bg-slate-50 dark:bg-slate-950' : 'border-slate-200 dark:border-slate-800'}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">{issue.title}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{issue.issueNumber} · {issue.asset?.name || issue.assetCode}</p>
              </div>
              <StatusBadge value={issue.status} />
            </div>
          </button>)}
          {issues.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">No complaints match the current filters.</p> : null}
        </div>
      </section>

      <section className="space-y-4 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
        {selected ? <>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Selected complaint</p>
            <h2 className="text-2xl font-semibold">{selected.title}</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Reported by {selected.reporterName}</p>
          </div>

          {selected.evidence?.length > 0 && (
            <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Evidence photos</p>
              <div className="mt-2 flex flex-wrap gap-3">
                {selected.evidence.map((url, index) => (
                  <a key={index} href={url} target="_blank" rel="noreferrer">
                    <img src={url} alt={`Evidence ${index + 1}`} className="h-20 w-20 rounded-xl border border-slate-200 object-cover dark:border-slate-800" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {selected.aiSuggestion && (
            <div className="rounded-3xl border border-violet-200 bg-violet-50/50 p-5 dark:border-slate-800 dark:bg-slate-950/30 space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-600 dark:text-ink-300">✨ AI Triage Diagnosis</span>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Suggested Title: {selected.aiSuggestion.title || 'N/A'}
              </p>
              <div className="flex gap-2">
                <span className="text-[10px] bg-white border border-slate-100 rounded px-1.5 py-0.5 text-slate-600 dark:bg-slate-900 dark:border-slate-850 dark:text-slate-400">Category: {selected.aiSuggestion.category || 'N/A'}</span>
                <span className="text-[10px] bg-white border border-slate-100 rounded px-1.5 py-0.5 text-slate-600 dark:bg-slate-900 dark:border-slate-850 dark:text-slate-400">Priority: {selected.aiSuggestion.priority || 'N/A'}</span>
              </div>
              {selected.aiSuggestion.possibleCauses?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-350">Possible Causes:</p>
                  <ul className="list-disc pl-4 text-xs text-slate-500 mt-1 space-y-0.5">
                    {selected.aiSuggestion.possibleCauses.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
              )}
              {selected.aiSuggestion.initialChecks?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-350">Initial Diagnostics / Checks:</p>
                  <ul className="list-disc pl-4 text-xs text-slate-500 mt-1 space-y-0.5">
                    {selected.aiSuggestion.initialChecks.map((ch, i) => <li key={i}>{ch}</li>)}
                  </ul>
                </div>
              )}
              {selected.aiSuggestion.warning && (
                <div className="rounded-2xl bg-amber-50 p-3 border border-amber-100 text-xs text-amber-700 dark:bg-amber-950/20 dark:border-amber-900/30 dark:text-amber-400">
                  ⚠️ {selected.aiSuggestion.warning}
                </div>
              )}
            </div>
          )}

          <div className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
            <label className="grid gap-2 text-sm font-medium">
              Assign technician
              <select value={technicianId} onChange={(e) => setTechnicianId(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950 text-slate-700 dark:text-slate-200">
                <option value="">Select technician</option>
                <option value="unassigned">Release to Shared Pool (Share with all technicians)</option>
                {sortedTechnicians.map((tech) => {
                  const rec = recommendations.find(r => r.technician._id === tech._id);
                  return (
                    <option key={tech._id} value={tech._id}>
                      {tech.name} {rec?.isExpert ? '⭐ AI Recommendation' : ''} ({tech.expertise && tech.expertise.length > 0 ? tech.expertise.join(', ') : 'General'})
                    </option>
                  );
                })}
              </select>
            </label>
            <button disabled={assignMutation.isPending} onClick={() => assignMutation.mutate({ id: selected._id, technicianId })} className="w-full rounded-2xl bg-ink-900 px-4 py-3 text-white dark:bg-white dark:text-ink-900 font-medium">
              {technicianId === 'unassigned' ? 'Release to Shared Pool' : 'Assign complaint'}
            </button>
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
            <label className="grid gap-2 text-sm font-medium">
              Update status
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
                {workflowStatuses.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950" placeholder="Add an internal note" />
            <button onClick={() => statusMutation.mutate({ id: selected._id, nextStatus: status, nextNote: note })} className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">Save status</button>
          </div>

          {(selected.aiMaintenanceSummary || selected.aiPreventiveRecommendation) && (
            <div className="space-y-3 rounded-3xl border border-violet-200 bg-violet-50/50 p-5 dark:border-slate-800 dark:bg-slate-950/20 text-left">
              <h3 className="font-semibold text-violet-700 dark:text-violet-400">✨ AI Post-Maintenance Summary & Advice</h3>
              {selected.aiMaintenanceSummary && (
                <div className="text-xs">
                  <span className="text-slate-400 block font-medium">Summary of Repair</span>
                  <p className="mt-1 text-slate-700 dark:text-slate-350 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-850">{selected.aiMaintenanceSummary}</p>
                </div>
              )}
              {selected.aiPreventiveRecommendation && (
                <div className="text-xs border-t border-slate-100 dark:border-slate-800 pt-2 mt-2">
                  <span className="text-slate-400 block font-medium">AI Preventive Maintenance Tip</span>
                  <p className="mt-1 text-slate-700 dark:text-slate-350 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-850">{selected.aiPreventiveRecommendation}</p>
                </div>
              )}
            </div>
          )}

          <div className="mt-6 border-t border-slate-200 pt-6 dark:border-slate-800">
            <h3 className="text-lg font-semibold font-sans">Asset Service History</h3>
            {history.length > 0 ? (
              <div className="mt-4 space-y-4 max-h-[300px] overflow-y-auto pr-2">
                {history.map((log) => (
                  <div key={log._id} className="relative pl-6 pb-2 last:pb-0 border-l border-slate-200 dark:border-slate-800">
                    <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-ink-900 ring-4 ring-white dark:bg-white dark:ring-slate-900 -translate-x-[4.5px]" />
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{log.action}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{log.details}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {new Date(log.createdAt).toLocaleString()} · {log.actorName || log.actor?.name || 'System'}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">No logs or history recorded for this asset yet.</p>
            )}
          </div>
        </> : <p className="text-slate-500 dark:text-slate-400">Select a complaint to manage it.</p>}
      </section>
    </div>
  </div>;
}
