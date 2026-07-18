import { useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';
import BackButton from '../../components/BackButton';
import Modal from '../../components/Modal';
import Pagination from '../../components/Pagination';
import SkeletonCards from '../../components/SkeletonCards';
import StatusBadge from '../../components/StatusBadge';
import StatusProgress from '../../components/StatusProgress';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import usePagination from '../../hooks/usePagination';
import exportCsv from '../../utils/exportCsv';
import { ISSUE_STATUSES, nextStatusOptions } from '../../utils/workflow';

export default function AdminComplaintsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedIssueId, setSelectedIssueId] = useState(null);
  const [technicianId, setTechnicianId] = useState('');
  const [status, setStatus] = useState('');
  const [note, setNote] = useState('');
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [technicianFilter, setTechnicianFilter] = useState('');
  const [sortOption, setSortOption] = useState('newest');
  const debouncedSearch = useDebouncedValue(searchFilter);

  const { data: issues = [], isError: issuesError, isLoading: issuesLoading } = useQuery({
    queryKey: ['issues', debouncedSearch, statusFilter, priorityFilter, categoryFilter, technicianFilter, sortOption],
    queryFn: async () => {
      const params = { sort: sortOption };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      if (categoryFilter) params.category = categoryFilter;
      if (technicianFilter) params.assignedTechnician = technicianFilter;
      return (await api.get('/issues', { params })).data.issues;
    },
    placeholderData: keepPreviousData,
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: async () => (await api.get('/users/technicians')).data.technicians
  });

  // Resolve the selected issue from the freshest list so the details panel
  // reflects mutations (assign, status change) without re-clicking the row.
  const selected = useMemo(
    () => issues.find((issue) => issue._id === selectedIssueId) || issues[0] || null,
    [issues, selectedIssueId]
  );

  const pagination = usePagination(issues, 6);

  const statusOptions = useMemo(() => nextStatusOptions(selected?.status), [selected?.status]);

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

  const invalidateAfterMutation = () => {
    queryClient.invalidateQueries({ queryKey: ['issues'] });
    queryClient.invalidateQueries({ queryKey: ['admin-notifications-issues'] });
    queryClient.invalidateQueries({ queryKey: ['asset-history'] });
  };

  const assignMutation = useMutation({
    mutationFn: async ({ id, technicianId: selectedTechnician }) => api.patch(`/issues/${id}/assign`, { technicianId: selectedTechnician }),
    onSuccess: (_data, variables) => {
      toast.success(variables.technicianId === 'unassigned' ? 'Complaint released to the shared pool' : 'Complaint assigned');
      invalidateAfterMutation();
    },
    onError: (error) => toast.error(error?.response?.data?.message || 'Assignment failed'),
  });

  const STATUS_ACTION_MESSAGES = {
    Assigned: 'Complaint assigned',
    'Inspection Started': 'Inspection started',
    'Maintenance In Progress': 'Repair work started',
    'Waiting for Parts': 'Marked as waiting for parts',
    Resolved: 'Complaint resolved',
    Verified: 'Work verified',
    Closed: 'Complaint closed',
    Reopened: 'Complaint reopened',
    Rejected: 'Complaint rejected',
    Cancelled: 'Complaint cancelled',
  };

  const statusMutation = useMutation({
    mutationFn: async ({ id, nextStatus, nextNote }) => api.patch(`/issues/${id}/status`, { status: nextStatus, note: nextNote }),
    onSuccess: (_data, variables) => {
      toast.success(STATUS_ACTION_MESSAGES[variables.nextStatus] || `Moved to "${variables.nextStatus}"`);
      invalidateAfterMutation();
      setStatus('');
      setNote('');
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
        <BackButton />
      </div>

      {/* Main Banner */}
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/70 p-6 shadow-soft backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-ink-500 font-display">Triage Queue</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white font-display">Assign & Verify Complaints</h1>
      </section>

      {/* Queue & Filters — clicking a complaint opens the details modal */}
      <div className="w-full">
          <section className="rounded-[2rem] border border-slate-200/80 bg-white/70 p-6 shadow-soft backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60 flex flex-col justify-between animate-fade-in">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white font-display">Complaint Queue</h2>
                <button
                  onClick={() => exportCsv('maintainiq-complaints.csv', issues.map((issue) => ({
                    Ticket: issue.issueNumber,
                    Title: issue.title,
                    Asset: issue.asset?.name || issue.assetCode,
                    Category: issue.category,
                    Priority: issue.priority,
                    Status: issue.status,
                    Reporter: issue.reporterName,
                    Technician: issue.assignedTechnician?.name || '',
                    'Cost Spent': issue.maintenanceCost || 0,
                    Reported: new Date(issue.createdAt).toLocaleDateString(),
                    Resolved: issue.resolvedAt ? new Date(issue.resolvedAt).toLocaleDateString() : '',
                  })))}
                  className="rounded-2xl border border-slate-200 hover:bg-slate-50 px-4 py-2 text-xs font-bold dark:border-slate-800 dark:hover:bg-slate-900 cursor-pointer"
                >
                  ⬇ Export CSV
                </button>
              </div>

              {issuesError ? (
                <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50/60 p-4 text-xs font-semibold text-rose-800 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-300">
                  ⚠ Could not reach the server — the queue below may be empty or stale. Make sure the backend is running, then refresh.
                </div>
              ) : null}

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
                  {ISSUE_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
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
                <select value={sortOption} onChange={(e) => setSortOption(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200 sm:col-span-2">
                  <option value="newest">Sort: Newest first</option>
                  <option value="oldest">Sort: Oldest first</option>
                  <option value="updated">Sort: Recently updated</option>
                  <option value="status">Sort: Status</option>
                </select>
              </div>

              {/* List */}
              {issuesLoading ? (
                <SkeletonCards count={4} columns="grid-cols-1" />
              ) : (
              <div className="space-y-3">
                {pagination.paged.map((issue) => (
                  <button
                    key={issue._id}
                    onClick={() => {
                      setSelectedIssueId(issue._id);
                      setTechnicianId(issue.assignedTechnician?._id || '');
                      setStatus('');
                      setNote('');
                      setDetailModalOpen(true);
                    }}
                    className={`w-full rounded-2xl border p-4 text-left transition-all ${
                      selected?._id === issue._id 
                        ? 'border-ink-900 bg-slate-50/80 shadow-soft dark:border-white dark:bg-slate-950/40' 
                        : 'border-slate-150 bg-white/40 hover:bg-slate-50/20 dark:border-slate-800 dark:bg-slate-900/10 dark:hover:bg-slate-950/20'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-855 dark:text-slate-200 text-sm truncate">{issue.title}</p>
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
                  <div className="py-12 text-center">
                    <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-ink-500/10 text-2xl">🎉</span>
                    <p className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-300">No complaints match the current filters</p>
                    <p className="mt-1 text-xs text-slate-400">Either the queue is clear or a filter is hiding results.</p>
                  </div>
                ) : null}
              </div>
              )}

              <Pagination {...pagination} />
            </div>
          </section>
      </div>

      {/* Complaint diagnostics & actions modal */}
      <Modal
        open={detailModalOpen && !!selected}
        onClose={() => setDetailModalOpen(false)}
        title={selected?.title}
        subtitle={selected ? `${selected.issueNumber} · ${selected.asset?.name || selected.assetCode}` : ''}
        wide
      >
        {selected ? (
              <div className="space-y-5">
                
                {/* Basic Details */}
                <div className="rounded-3xl border border-slate-100 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-950/20">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                    {selected.issueNumber} · reported by {selected.reporterName || 'Anonymous'}
                  </p>
                  <h3 className="text-lg font-bold text-slate-850 dark:text-white font-display mt-0.5">{selected.title}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed whitespace-pre-wrap">{selected.description}</p>
                  <div className="mt-4">
                    <StatusProgress status={selected.status} />
                  </div>
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
                    {selected.aiSuggestion.recurringPattern && (
                      <div className="rounded-xl bg-rose-50/50 p-3 border border-rose-100 text-[11px] text-rose-800 dark:bg-rose-950/20 dark:border-rose-900/20 dark:text-rose-400 leading-normal">
                        <strong>⚠ Recurring fault detected:</strong> {selected.aiSuggestion.recurringPattern}
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
                    disabled={assignMutation.isPending || !technicianId}
                    onClick={() => assignMutation.mutate({ id: selected._id, technicianId })}
                    className="w-full rounded-2xl bg-ink-900 hover:bg-ink-850 px-4 py-3 text-xs font-bold text-white dark:bg-white dark:text-ink-900 dark:hover:bg-slate-100 transition shadow cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {assignMutation.isPending ? 'Assigning...' : technicianId === 'unassigned' ? 'Release to Shared Pool' : !technicianId ? 'Select a technician first' : 'Assign to Technician'}
                  </button>
                </div>

                {/* Status Updates — only transitions the backend workflow allows */}
                <div className="space-y-3 rounded-3xl border border-slate-150/60 p-4 dark:border-slate-800 bg-white/40 dark:bg-slate-900/10">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Update status
                    </label>
                    <span className="text-[10px] text-slate-400 font-semibold">Current: {selected.status}</span>
                  </div>
                  {statusOptions.length > 0 ? (
                    <>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-250 outline-none mb-2"
                      >
                        <option value="">Select next status…</option>
                        {statusOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                      </select>
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={2}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-250 outline-none"
                        placeholder={status === 'Resolved' ? 'Resolution note (required)…' : 'Add an internal log comment...'}
                      />
                      <button
                        disabled={statusMutation.isPending || !status || (status === 'Resolved' && !note.trim())}
                        onClick={() => statusMutation.mutate({ id: selected._id, nextStatus: status, nextNote: note })}
                        className="w-full rounded-2xl border border-slate-200 hover:bg-slate-50 px-4 py-3 text-xs font-bold dark:border-slate-800 dark:hover:bg-slate-900 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {statusMutation.isPending ? 'Updating...' : !status ? 'Select a status to continue' : status === 'Resolved' && !note.trim() ? 'Resolution note required' : `Move to "${status}"`}
                      </button>
                    </>
                  ) : (
                    <p className="text-xs text-slate-400 italic">
                      This complaint is <strong>{selected.status}</strong> — no further transitions are allowed.
                    </p>
                  )}
                </div>

                {/* Complaint Status Progression Timeline */}
                {selected.timeline?.length > 0 && (
                  <div className="rounded-3xl border border-slate-150/60 p-4 dark:border-slate-800 bg-white/40 dark:bg-slate-900/10">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Status progression timeline</h3>
                    <div className="space-y-4 max-h-[220px] overflow-y-auto pr-1">
                      {selected.timeline.map((entry, index) => (
                        <div key={index} className="relative pl-6 pb-2 last:pb-0 border-l border-slate-200 dark:border-slate-800">
                          <span className={`absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white dark:ring-slate-900 -translate-x-[5.5px] ${index === selected.timeline.length - 1 ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-slate-600'}`} />
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {entry.toStatus}
                            {entry.fromStatus ? <span className="font-normal text-slate-400"> (from {entry.fromStatus})</span> : null}
                          </p>
                          {entry.note ? <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{entry.note}</p> : null}
                          <p className="text-[9px] text-slate-400/80 mt-0.5 font-medium">
                            {new Date(entry.createdAt).toLocaleString()}{entry.actorName ? ` · ${entry.actorName}` : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Maintenance cost summary */}
                {(selected.maintenanceCost > 0 || selected.partsUsed?.length > 0) && (
                  <div className="rounded-3xl border border-emerald-100 bg-emerald-50/30 p-4 dark:border-emerald-900/20 dark:bg-emerald-950/10 text-xs space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">💰 Maintenance Cost</p>
                    {selected.partsUsed?.map((part, i) => (
                      <div key={i} className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>{part.name} × {part.quantity}</span>
                        <span className="tabular-nums">{((part.quantity || 0) * (part.cost || 0)).toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="flex justify-between border-t border-emerald-200/50 dark:border-slate-800 pt-1.5 font-bold text-slate-800 dark:text-slate-200">
                      <span>Total spent on this complaint</span>
                      <span className="text-emerald-700 dark:text-emerald-400 tabular-nums">{(selected.maintenanceCost || 0).toLocaleString()}</span>
                    </div>
                  </div>
                )}

                {/* Technician's work evidence photos */}
                {selected.maintenanceEvidence?.length > 0 && (
                  <div className="rounded-3xl border border-emerald-100 bg-emerald-50/30 p-4 dark:border-emerald-900/20 dark:bg-emerald-950/10">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block mb-2">🔧 Maintenance Work Evidence</p>
                    <div className="flex flex-wrap gap-2">
                      {selected.maintenanceEvidence.map((url, index) => (
                        <a key={index} href={url} target="_blank" rel="noreferrer" className="relative group overflow-hidden rounded-xl border border-emerald-200/50 dark:border-slate-800">
                          <img src={url} alt={`Work evidence ${index + 1}`} className="h-16 w-16 object-cover transition-all group-hover:scale-105" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

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
        ) : null}
      </Modal>
    </div>
  );
}
