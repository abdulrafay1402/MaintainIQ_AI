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
  
  const { data: technicians = [] } = useQuery({ 
    queryKey: ['technicians'], 
    queryFn: async () => (await api.get('/users/technicians')).data.technicians 
  });

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

  const getPriorityStyle = (priority) => {
    switch (priority) {
      case 'Critical': return 'bg-rose-500 text-white dark:bg-rose-600';
      case 'High': return 'bg-amber-500 text-white dark:bg-amber-600';
      case 'Medium': return 'bg-sky-500 text-white dark:bg-sky-600';
      default: return 'bg-slate-500 text-white dark:bg-slate-600';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-white transition cursor-pointer">
          <span>←</span> <span>Back</span>
        </button>
      </div>

      {/* Main Banner */}
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/70 p-6 shadow-soft backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-ink-500 font-display">Triage Queue</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white font-display">Assign & Verify Complaints</h1>
      </section>

      {/* Split Pane: Queue List vs details */}
      <div className="grid gap-6 lg:grid-cols-2">
        
        {/* Left Side: Queue & Filters */}
        <section className="rounded-[2rem] border border-slate-200/80 bg-white/70 p-6 shadow-soft backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60 flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white font-display mb-4">Complaint Queue</h2>
            
            {/* Filters panel */}
            <div className="grid gap-3 sm:grid-cols-2 mb-5">
              <input 
                value={searchFilter} 
                onChange={(e) => setSearchFilter(e.target.value)} 
                placeholder="Search complaint text, number..." 
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm outline-none focus:border-ink-500 dark:border-slate-800 dark:bg-slate-950/60 sm:col-span-2" 
              />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200">
                <option value="">All Statuses</option>
                {workflowStatuses.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200">
                <option value="">All Priorities</option>
                {['Low', 'Medium', 'High', 'Critical'].map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200">
                <option value="">All Categories</option>
                {['Electronics / IT', 'Electrical', 'HVAC / Air Conditioning', 'Plumbing', 'Mechanical / Furniture', 'Safety & Security', 'Lab Equipment'].map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select value={technicianFilter} onChange={(e) => setTechnicianFilter(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200">
                <option value="">All Technicians</option>
                <option value="unassigned">Unassigned</option>
                {technicians.map((tech) => <option key={tech._id} value={tech._id}>{tech.name}</option>)}
              </select>
            </div>

            {/* List */}
            <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
              {issues.map((issue) => (
                <button 
                  key={issue._id} 
                  onClick={() => { 
                    setSelectedIssue(issue); 
                    setTechnicianId(issue.assignedTechnician?._id || ''); 
                    setStatus(issue.status); 
                    setNote(issue.maintenanceNotes || ''); 
                  }} 
                  className={`w-full rounded-2xl border p-4 text-left transition-all ${
                    selected?._id === issue._id 
                      ? 'border-ink-900 bg-slate-50/80 shadow-soft dark:border-white dark:bg-slate-950/40' 
                      : 'border-slate-150 bg-white/40 hover:bg-slate-50/20 dark:border-slate-800 dark:bg-slate-900/10 dark:hover:bg-slate-950/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 dark:text-slate-200 text-sm truncate">{issue.title}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold mt-1">
                        {issue.issueNumber} · <span className="font-mono text-ink-600 dark:text-ink-350">{issue.asset?.name || issue.assetCode}</span>
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <StatusBadge value={issue.status} />
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${getPriorityStyle(issue.priority)}`}>
                        {issue.priority}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
              {issues.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400 italic">No complaints match the current filters.</p>
              ) : null}
            </div>
          </div>
        </section>

        {/* Right Side: Diagnostics & Admin Actions */}
        <section className="rounded-[2rem] border border-slate-200/80 bg-white/70 p-6 shadow-soft backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60 flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white font-display mb-4">Complaint Diagnostics</h2>
            
            {selected ? (
              <div className="space-y-5">
                
                {/* Basic Details */}
                <div className="rounded-3xl border border-slate-100 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-950/20">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                    {selected.issueNumber} · reported by {selected.reporterName || 'Anonymous'}
                  </p>
                  <h3 className="text-lg font-bold text-slate-850 dark:text-white font-display mt-0.5">{selected.title}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed whitespace-pre-wrap">{selected.description}</p>
                </div>

                {/* Evidence Photos */}
                {selected.evidence?.length > 0 && (
                  <div className="rounded-3xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/20">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">Evidence Attachment</p>
                    <div className="flex flex-wrap gap-2">
                      {selected.evidence.map((url, index) => (
                        <a key={index} href={url} target="_blank" rel="noreferrer" className="relative group overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                          <img src={url} alt={`Evidence ${index + 1}`} className="h-16 w-16 object-cover transition-all group-hover:scale-105" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Triage Diagnosis Drawer */}
                {selected.aiSuggestion && (
                  <div className="rounded-[1.5rem] border border-violet-200 bg-violet-50/30 p-5 dark:border-slate-850 dark:bg-slate-950/20 space-y-3.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-ink-600 dark:text-ink-300 flex items-center gap-1.5">
                      ✨ AI Triage Diagnosis
                    </span>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Suggested Fault Type: <span className="underline">{selected.aiSuggestion.title || 'N/A'}</span>
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-[10px] bg-white border border-slate-100/50 rounded-lg px-2.5 py-0.5 text-slate-600 font-semibold dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400">Category: {selected.aiSuggestion.category || 'N/A'}</span>
                      <span className="text-[10px] bg-white border border-slate-100/50 rounded-lg px-2.5 py-0.5 text-slate-600 font-semibold dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400">Priority: {selected.aiSuggestion.priority || 'N/A'}</span>
                    </div>
                    {selected.aiSuggestion.possibleCauses?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Possible Causes</p>
                        <ul className="list-disc pl-4 text-xs text-slate-500 dark:text-slate-400 mt-1 space-y-0.5">
                          {selected.aiSuggestion.possibleCauses.map((c, i) => <li key={i}>{c}</li>)}
                        </ul>
                      </div>
                    )}
                    {selected.aiSuggestion.initialChecks?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Initial Checks / Actions</p>
                        <ul className="list-disc pl-4 text-xs text-slate-500 dark:text-slate-400 mt-1 space-y-0.5">
                          {selected.aiSuggestion.initialChecks.map((ch, i) => <li key={i}>{ch}</li>)}
                        </ul>
                      </div>
                    )}
                    {selected.aiSuggestion.warning && (
                      <div className="rounded-xl bg-amber-50/50 p-3 border border-amber-100 text-[11px] text-amber-800 dark:bg-amber-950/20 dark:border-amber-900/20 dark:text-amber-400 leading-normal">
                        <strong>Safety Warning:</strong> {selected.aiSuggestion.warning}
                      </div>
                    )}
                  </div>
                )}

                {/* Technician Assignment */}
                <div className="space-y-3 rounded-3xl border border-slate-150/60 p-4 dark:border-slate-800 bg-white/40 dark:bg-slate-900/10">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Assign Technician
                  </label>
                  <select 
                    value={technicianId} 
                    onChange={(e) => setTechnicianId(e.target.value)} 
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-250 outline-none"
                  >
                    <option value="">Select technician</option>
                    <option value="unassigned">Release to Shared Pool (Open to all technicians)</option>
                    {sortedTechnicians.map((tech) => {
                      const rec = recommendations.find(r => r.technician._id === tech._id);
                      return (
                        <option key={tech._id} value={tech._id}>
                          {tech.name} {rec?.isExpert ? '⭐ [Highly Recommended]' : ''} ({tech.expertise && tech.expertise.length > 0 ? tech.expertise.join(', ') : 'General'})
                        </option>
                      );
                    })}
                  </select>
                  <button 
                    disabled={assignMutation.isPending} 
                    onClick={() => assignMutation.mutate({ id: selected._id, technicianId })} 
                    className="w-full rounded-2xl bg-ink-900 hover:bg-ink-850 px-4 py-3 text-xs font-bold text-white dark:bg-white dark:text-ink-900 dark:hover:bg-slate-100 transition shadow cursor-pointer"
                  >
                    {assignMutation.isPending ? 'Assigning...' : technicianId === 'unassigned' ? 'Release to Shared Pool' : 'Assign to Technician'}
                  </button>
                </div>

                {/* Status Updates */}
                <div className="space-y-3 rounded-3xl border border-slate-150/60 p-4 dark:border-slate-800 bg-white/40 dark:bg-slate-900/10">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Update status
                  </label>
                  <select 
                    value={status} 
                    onChange={(e) => setStatus(e.target.value)} 
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-250 outline-none mb-2"
                  >
                    {workflowStatuses.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                  <textarea 
                    value={note} 
                    onChange={(e) => setNote(e.target.value)} 
                    rows={2} 
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-250 outline-none" 
                    placeholder="Add an internal log comment..." 
                  />
                  <button 
                    disabled={statusMutation.isPending}
                    onClick={() => statusMutation.mutate({ id: selected._id, nextStatus: status, nextNote: note })} 
                    className="w-full rounded-2xl border border-slate-200 hover:bg-slate-50 px-4 py-3 text-xs font-bold dark:border-slate-800 dark:hover:bg-slate-900 cursor-pointer"
                  >
                    {statusMutation.isPending ? 'Updating...' : 'Save status update'}
                  </button>
                </div>

                {/* Post-Maintenance AI Summary */}
                {(selected.aiMaintenanceSummary || selected.aiPreventiveRecommendation) && (
                  <div className="space-y-3 rounded-[1.5rem] border border-violet-200 bg-violet-50/30 p-5 dark:border-slate-850 dark:bg-slate-950/20 text-left">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-violet-700 dark:text-violet-400 flex items-center gap-1">✨ AI Post-Repair Diagnostic Advice</h3>
                    {selected.aiMaintenanceSummary && (
                      <div className="text-xs mt-2">
                        <span className="text-slate-400 block font-bold uppercase tracking-wider text-[9px]">Summary of Repair Work</span>
                        <p className="mt-1 text-slate-700 dark:text-slate-300 bg-white/60 dark:bg-slate-950/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 leading-normal">{selected.aiMaintenanceSummary}</p>
                      </div>
                    )}
                    {selected.aiPreventiveRecommendation && (
                      <div className="text-xs border-t border-slate-100 dark:border-slate-800/50 pt-2 mt-2">
                        <span className="text-slate-400 block font-bold uppercase tracking-wider text-[9px]">AI Preventive Tips</span>
                        <p className="mt-1 text-slate-700 dark:text-slate-300 bg-white/60 dark:bg-slate-950/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 leading-normal">{selected.aiPreventiveRecommendation}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* History Timeline */}
                <div className="mt-6 border-t border-slate-200 pt-6 dark:border-slate-800">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">Asset Service logs</h3>
                  {history.length > 0 ? (
                    <div className="space-y-4 max-h-[170px] overflow-y-auto pr-1">
                      {history.map((log) => (
                        <div key={log._id} className="relative pl-6 pb-2 last:pb-0 border-l border-slate-200 dark:border-slate-855">
                          <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-ink-950 ring-4 ring-white dark:bg-white dark:ring-slate-900 -translate-x-[5.5px]" />
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-normal">{log.action}</p>
                          <p className="text-[11px] text-slate-450 mt-0.5">{log.details}</p>
                          <p className="text-[9px] text-slate-400/80 mt-0.5 font-medium">
                            {new Date(log.createdAt).toLocaleString()} · {log.actorName || log.actor?.name || 'System'}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No timeline entries found for this asset.</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic py-10 text-center">Select an active complaint from the queue to review diagnoses and assign work.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
