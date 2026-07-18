import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';
import BackButton from '../../components/BackButton';
import Modal from '../../components/Modal';
import Pagination from '../../components/Pagination';
import StatusBadge from '../../components/StatusBadge';
import StatusProgress from '../../components/StatusProgress';
import usePagination from '../../hooks/usePagination';
import { nextStatusOptions } from '../../utils/workflow';

const todayISO = () => new Date().toISOString().slice(0, 10);
const tomorrowISO = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const emptyPart = () => ({ name: '', quantity: '1', cost: '0' });

// Toast messages describe the actual action performed, not a generic "updated".
const STATUS_ACTION_MESSAGES = {
  'Inspection Started': 'Inspection started — work-start date recorded',
  'Maintenance In Progress': 'Repair work started',
  'Waiting for Parts': 'Marked as waiting for parts',
  Resolved: 'Issue resolved',
  Reopened: 'Issue reopened',
  Rejected: 'Issue rejected',
  Cancelled: 'Issue cancelled',
  Verified: 'Work verified',
  Closed: 'Issue closed',
  Assigned: 'Issue assigned',
};

export default function TechnicianTasksPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedIssueId, setSelectedIssueId] = useState(null);
  const [status, setStatus] = useState('');
  const [note, setNote] = useState('');
  const [maintenanceNotes, setMaintenanceNotes] = useState('');
  const [laborCost, setLaborCost] = useState('0');
  const [parts, setParts] = useState([]);
  const [maintenanceFiles, setMaintenanceFiles] = useState([]);
  const [inspectionFindings, setInspectionFindings] = useState('');
  const [workPerformed, setWorkPerformed] = useState('');
  const [durationHours, setDurationHours] = useState('1');
  const [finalCondition, setFinalCondition] = useState('Good');
  const [startedAt, setStartedAt] = useState(todayISO());
  const [completedAt, setCompletedAt] = useState(todayISO());
  const [nextServiceDate, setNextServiceDate] = useState('');

  const [activeTab, setActiveTab] = useState('my-tasks');
  const [consoleOpen, setConsoleOpen] = useState(false);

  // Parts subtotal and grand total are always derived from the line items,
  // so what the technician sees is exactly what gets stored.
  const partsSubtotal = useMemo(
    () => parts.reduce((sum, part) => sum + (Number(part.quantity) || 0) * (Number(part.cost) || 0), 0),
    [parts]
  );
  const grandTotal = partsSubtotal + (Number(laborCost) || 0);

  const updatePart = (index, field, value) => {
    // Numeric part fields are clamped at zero — negative costs/quantities can
    // never even be typed in.
    const clean = (field === 'quantity' || field === 'cost') && value !== '' && Number(value) < 0 ? '0' : value;
    setParts((current) => current.map((part, i) => (i === index ? { ...part, [field]: clean } : part)));
  };

  const handleLaborCost = (value) => {
    setLaborCost(value !== '' && Number(value) < 0 ? '0' : value);
  };

  const handleMaintenanceFiles = (e) => {
    const files = Array.from(e.target.files || []).slice(0, 5);
    const valid = files.filter((file) => file.type.startsWith('image/') && file.size <= 5 * 1024 * 1024);
    if (valid.length < files.length) toast.error('Only images up to 5MB are allowed');
    setMaintenanceFiles(valid);
  };

  // Client-side date rules (the backend enforces the same ones):
  // completion today-or-earlier, start before completion, next service after today.
  const handleResolveSubmit = () => {
    if (!completedAt) return toast.error('Completion date is required');
    if (completedAt > todayISO()) return toast.error('Completion date cannot be in the future');
    if (startedAt && startedAt > completedAt) return toast.error('Start date cannot be after the completion date');
    if (nextServiceDate && nextServiceDate <= todayISO()) return toast.error('Next service date must be after today');

    maintenanceMutation.mutate({
      id: selected._id,
      payload: {
        notes: maintenanceNotes,
        cost: grandTotal,
        startedAt: startedAt ? new Date(startedAt).toISOString() : undefined,
        completedAt: new Date(completedAt).toISOString(),
        nextServiceDate: nextServiceDate ? new Date(nextServiceDate).toISOString() : undefined,
        inspectionFindings,
        workPerformed,
        finalCondition,
        durationHours: Number(durationHours) || 1,
        partsUsed: parts
          .filter((part) => part.name.trim())
          .map((part) => ({ name: part.name.trim(), quantity: Number(part.quantity) || 1, cost: Number(part.cost) || 0 })),
      },
      files: maintenanceFiles,
    });
  };

  const { data: assignedIssues = [] } = useQuery({
    queryKey: ['assigned-issues'],
    queryFn: async () => (await api.get('/issues/assigned')).data.issues,
  });

  const { data: sharedPoolIssues = [] } = useQuery({
    queryKey: ['shared-pool-issues'],
    queryFn: async () => (await api.get('/issues?unassigned=true')).data.issues,
  });

  const claimMutation = useMutation({
    mutationFn: async (id) => api.patch(`/issues/${id}/claim`),
    onSuccess: () => {
      toast.success('Issue claimed successfully!');
      queryClient.invalidateQueries({ queryKey: ['assigned-issues'] });
      queryClient.invalidateQueries({ queryKey: ['shared-pool-issues'] });
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      setActiveTab('my-tasks');
    },
    onError: (error) => toast.error(error?.response?.data?.message || 'Could not claim issue'),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, nextStatus, nextNote }) => api.patch(`/issues/${id}/status`, { status: nextStatus, note: nextNote }),
    onSuccess: (_data, variables) => {
      toast.success(STATUS_ACTION_MESSAGES[variables.nextStatus] || `Moved to "${variables.nextStatus}"`);
      queryClient.invalidateQueries({ queryKey: ['assigned-issues'] });
      queryClient.invalidateQueries({ queryKey: ['shared-pool-issues'] });
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      setStatus('');
      setNote('');
    },
    onError: (error) => toast.error(error?.response?.data?.message || 'Could not update task'),
  });

  const maintenanceMutation = useMutation({
    // multipart/form-data so evidence photos of the completed work travel with the record
    mutationFn: async ({ id, payload, files }) => {
      const formData = new FormData();
      Object.entries(payload).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        formData.append(key, typeof value === 'object' ? JSON.stringify(value) : value);
      });
      files.forEach((file) => formData.append('evidence', file));
      return api.post(`/issues/${id}/maintenance`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => {
      toast.success('Maintenance saved & task resolved');
      queryClient.invalidateQueries({ queryKey: ['assigned-issues'] });
      queryClient.invalidateQueries({ queryKey: ['shared-pool-issues'] });
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      setParts([]);
      setMaintenanceFiles([]);
      setMaintenanceNotes('');
      setLaborCost('0');
      setInspectionFindings('');
      setWorkPerformed('');
    },
    onError: (error) => toast.error(error?.response?.data?.message || 'Could not save maintenance'),
  });

  const currentIssues = activeTab === 'my-tasks' ? assignedIssues : sharedPoolIssues;
  // Resolve the selected issue from the freshest list so mutations
  // (status updates, resolution) are reflected without re-clicking.
  const selected = useMemo(
    () => currentIssues.find((issue) => issue._id === selectedIssueId) || currentIssues[0] || null,
    [currentIssues, selectedIssueId]
  );

  // "Resolved" is intentionally excluded from the quick dropdown — resolution
  // only happens through the maintenance form below (notes/parts/cost required).
  const statusOptions = useMemo(
    () => nextStatusOptions(selected?.status).filter((status) => status !== 'Resolved'),
    [selected?.status]
  );

  const pagination = usePagination(currentIssues, 6);

  // Work-start date auto-fills from the moment the technician moved the issue
  // to "Inspection Started" (falls back to today for older issues).
  useEffect(() => {
    if (selected?.inspectionStartedAt) {
      setStartedAt(new Date(selected.inspectionStartedAt).toISOString().slice(0, 10));
    } else {
      setStartedAt(todayISO());
    }
  }, [selected?._id, selected?.inspectionStartedAt]);

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

      {/* Title block */}
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/70 p-6 shadow-soft backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-ink-500 font-display">Work orders</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white font-display">Technical tasks</h1>
      </section>

      {/* Queue — clicking a task opens the console modal */}
      <div>
        <section className="rounded-[2rem] border border-slate-200/80 bg-white/70 p-6 shadow-soft backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60 flex flex-col justify-between">
          <div>
            <div className="flex gap-4 border-b border-slate-100 pb-3 dark:border-slate-800 mb-5">
              <button
                onClick={() => { setActiveTab('my-tasks'); setSelectedIssueId(null); setStatus(''); }}
                className={`pb-2 text-sm font-bold border-b-2 transition-all cursor-pointer ${activeTab === 'my-tasks' ? 'border-ink-900 text-slate-900 dark:border-white dark:text-white' : 'border-transparent text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-350'}`}
              >
                My Assigned Tasks ({assignedIssues.length})
              </button>
              <button
                onClick={() => { setActiveTab('shared-pool'); setSelectedIssueId(null); setStatus(''); }}
                className={`pb-2 text-sm font-bold border-b-2 transition-all cursor-pointer ${activeTab === 'shared-pool' ? 'border-ink-900 text-slate-900 dark:border-white dark:text-white' : 'border-transparent text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-350'}`}
              >
                Open Shared Pool ({sharedPoolIssues.length})
              </button>
            </div>

            <div className="space-y-3">
              {currentIssues.length > 0 ? pagination.paged.map((issue) => (
                <button
                  key={issue._id}
                  onClick={() => {
                    setSelectedIssueId(issue._id);
                    setStatus('');
                    setNote('');
                    setConsoleOpen(true);
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
                      <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold mt-1 truncate">
                        {issue.issueNumber} · <span className="font-mono text-ink-600 dark:text-ink-350">{issue.asset?.name || issue.assetCode}</span> · {issue.category || 'General'}
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
              )) : (
                <p className="text-xs text-slate-400 italic text-center py-10">No tasks found in this section.</p>
              )}
            </div>

            <Pagination {...pagination} />
          </div>
        </section>
      </div>

      {/* Task console modal: details, status transitions, maintenance logger */}
      <Modal
        open={consoleOpen && !!selected}
        onClose={() => setConsoleOpen(false)}
        title={selected?.title}
        subtitle={selected ? `${selected.issueNumber} · ${selected.asset?.name || selected.assetCode}` : ''}
        wide
      >
        {selected ? (
              <div className="space-y-5">
                
                {/* Details card */}
                <div className="rounded-3xl border border-slate-100 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-950/20 space-y-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ticket Reference (Read-Only)</span>
                    <h3 className="text-lg font-bold mt-1 text-slate-900 dark:text-white font-display">{selected.title}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Issue Number: <span className="font-mono font-semibold">{selected.issueNumber}</span>
                    </p>
                  </div>

                  <StatusProgress status={selected.status} />

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-2xl bg-white p-3 dark:bg-slate-900 border border-slate-100/50 dark:border-slate-800/40">
                      <span className="text-slate-400 block mb-0.5 font-bold uppercase tracking-wider text-[9px]">Equipment</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-250">{selected.asset?.name || selected.assetCode || 'N/A'}</span>
                    </div>
                    <div className="rounded-2xl bg-white p-3 dark:bg-slate-900 border border-slate-100/50 dark:border-slate-800/40">
                      <span className="text-slate-400 block mb-0.5 font-bold uppercase tracking-wider text-[9px]">Location</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-250">{selected.asset?.location || 'N/A'}</span>
                    </div>
                    <div className="rounded-2xl bg-white p-3 dark:bg-slate-900 border border-slate-100/50 dark:border-slate-800/40">
                      <span className="text-slate-400 block mb-0.5 font-bold uppercase tracking-wider text-[9px]">Category</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-250">{selected.category || 'N/A'}</span>
                    </div>
                    <div className="rounded-2xl bg-white p-3 dark:bg-slate-900 border border-slate-100/50 dark:border-slate-800/40">
                      <span className="text-slate-400 block mb-0.5 font-bold uppercase tracking-wider text-[9px]">Priority</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-250">{selected.priority || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Problem Description */}
                <div>
                  <span className="text-xs font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider block mb-1">Problem Description</span>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed bg-white/40 dark:bg-slate-900/10 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800/40">
                    {selected.description}
                  </p>
                </div>

                {/* Evidence photos */}
                {selected.evidence?.length > 0 && (
                  <div>
                    <span className="text-xs font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider block mb-1.5">Evidence Photos</span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selected.evidence.map((url, index) => (
                        <a key={index} href={url} target="_blank" rel="noreferrer" className="relative group overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                          <img src={url} alt={`Evidence ${index + 1}`} className="h-16 w-16 object-cover transition-all group-hover:scale-105" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Admin instructions updates timeline */}
                {selected.timeline && selected.timeline.length > 0 && (
                  <div>
                    <span className="text-xs font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider block mb-1.5">Instructions & Updates</span>
                    <div className="space-y-2 max-h-[140px] overflow-y-auto bg-white/40 dark:bg-slate-900/10 p-3 rounded-2xl border border-slate-150/40 dark:border-slate-800/40">
                      {selected.timeline.filter(t => t.note).map((t, idx) => (
                        <div key={idx} className="text-xs border-b border-slate-100 dark:border-slate-850 pb-2 last:border-0 last:pb-0">
                          <p className="font-bold text-ink-600 dark:text-ink-400">
                            {t.actorName || 'Admin'} ({t.toStatus}):
                          </p>
                          <p className="text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{t.note}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI suggestion triage match context */}
                {selected.aiSuggestion && (
                  <div className="border-t border-slate-150 pt-3 dark:border-slate-850">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-violet-650 dark:text-violet-400 block mb-1">AI Triage Diagnostics Context</span>
                    <p className="text-xs text-slate-500 dark:text-slate-450 mt-1 leading-normal font-semibold">
                      Suggested Cause: <span className="underline">{selected.aiSuggestion.possibleCauses?.join(', ') || 'N/A'}</span>
                    </p>
                    {selected.aiSuggestion.warning && (
                      <p className="text-[10px] text-amber-700 mt-1.5 bg-amber-50/50 dark:bg-amber-950/20 p-2.5 rounded-xl border border-amber-100/50 dark:border-amber-900/10 font-semibold">
                        Warning: {selected.aiSuggestion.warning}
                      </p>
                    )}
                  </div>
                )}

                {/* Actions forms */}
                {activeTab === 'shared-pool' ? (
                  <div className="space-y-4 rounded-3xl border border-dashed border-accent-300 bg-accent-50/10 p-5 dark:border-slate-800 dark:bg-slate-950/20">
                    <h3 className="font-bold text-accent-700 dark:text-accent-400 text-sm">Claim Unassigned Task</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                      Claiming this issue assigns it to your personal technical work orders list and flags the status as Assigned.
                    </p>
                    <button
                      onClick={() => claimMutation.mutate(selected._id)}
                      disabled={claimMutation.isPending}
                      className="w-full rounded-2xl bg-ink-900 hover:bg-ink-850 px-4 py-3 text-xs font-bold text-white transition-all shadow dark:bg-white dark:text-ink-900 dark:hover:bg-slate-100 cursor-pointer"
                    >
                      {claimMutation.isPending ? 'Claiming Task...' : 'Claim Task & Begin Inspection'}
                    </button>
                  </div>
                ) : (
                  <>
                    {!['Resolved', 'Verified', 'Closed', 'Rejected', 'Cancelled'].includes(selected.status) ? (
                      <div className="space-y-4">

                        {/* Quick Update — only transitions the backend workflow allows */}
                        <div className="space-y-3 rounded-3xl border border-slate-150/60 p-4 dark:border-slate-800 bg-white/40 dark:bg-slate-900/10 text-sm">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                              Status Transition
                            </label>
                            <span className="text-[10px] text-slate-400 font-semibold">Current: {selected.status}</span>
                          </div>
                          <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950/60 outline-none mb-1 text-slate-700 dark:text-slate-200"
                          >
                            <option value="">Select next status…</option>
                            {statusOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                          </select>
                          <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            rows={2}
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950/60 outline-none"
                            placeholder={status === 'Resolved' ? 'Resolution note (required)…' : 'State transition remarks...'}
                          />
                          <button
                            disabled={statusMutation.isPending || !status || (status === 'Resolved' && !note.trim())}
                            onClick={() => statusMutation.mutate({ id: selected._id, nextStatus: status, nextNote: note })}
                            className="w-full rounded-2xl bg-ink-900 hover:bg-ink-850 px-4 py-2.5 text-xs font-bold text-white dark:bg-white dark:text-ink-900 dark:hover:bg-slate-100 transition shadow cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {statusMutation.isPending ? 'Updating...' : !status ? 'Select a status to continue' : `Move to "${status}"`}
                          </button>
                        </div>

                        {/* Completion Details form */}
                        <div className="space-y-3 rounded-3xl border border-slate-150/60 p-4 dark:border-slate-800 bg-white/40 dark:bg-slate-900/10 text-sm">
                          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Resolution & Maintenance Logger</h3>
                          
                          <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Inspection Findings</label>
                            <textarea value={inspectionFindings} onChange={(e) => setInspectionFindings(e.target.value)} rows={2} className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 outline-none dark:border-slate-800 dark:bg-slate-950/60" placeholder="Describe fault diagnostics findings..." />
                          </div>
                          
                          <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Work Performed</label>
                            <textarea value={workPerformed} onChange={(e) => setWorkPerformed(e.target.value)} rows={2} className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 outline-none dark:border-slate-800 dark:bg-slate-950/60" placeholder="Describe mechanical / technical steps taken..." />
                          </div>
                          
                          <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Internal Technical Notes</label>
                            <textarea value={maintenanceNotes} onChange={(e) => setMaintenanceNotes(e.target.value)} rows={2} className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 outline-none dark:border-slate-800 dark:bg-slate-950/60" placeholder="Any follow-up tips or specifications..." />
                          </div>
                          
                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Duration (Hours)</label>
                              <input type="number" min="0.25" step="0.25" value={durationHours} onChange={(e) => setDurationHours(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 outline-none dark:border-slate-800 dark:bg-slate-950/60" placeholder="1" />
                            </div>
                            <div>
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Final Condition</label>
                              <select value={finalCondition} onChange={(e) => setFinalCondition(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 outline-none dark:border-slate-800 dark:bg-slate-950/60 text-slate-700 dark:text-slate-200">
                                <option>Good</option>
                                <option>Fair</option>
                                <option>Poor</option>
                                <option>Retired</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid gap-3 md:grid-cols-3">
                            <div>
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Work Started <span className="text-[8px] text-emerald-600">(auto from inspection)</span></label>
                              <input type="date" max={todayISO()} value={startedAt} onChange={(e) => setStartedAt(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 outline-none dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200" />
                            </div>
                            <div>
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Work Completed <span className="text-[8px] text-slate-400">(today or earlier)</span></label>
                              <input type="date" max={todayISO()} value={completedAt} onChange={(e) => setCompletedAt(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 outline-none dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200" />
                            </div>
                            <div>
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Next Service Due <span className="text-[8px] text-slate-400">(after today)</span></label>
                              <input type="date" min={tomorrowISO()} value={nextServiceDate} onChange={(e) => setNextServiceDate(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 outline-none dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200" />
                            </div>
                          </div>

                          {/* Parts used — structured line items with auto-calculated totals */}
                          <div className="rounded-2xl border border-slate-150/60 bg-slate-50/40 p-3.5 dark:border-slate-800 dark:bg-slate-950/30 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Parts Used</label>
                              <button
                                type="button"
                                onClick={() => setParts([...parts, emptyPart()])}
                                className="rounded-lg border border-slate-200 px-2.5 py-1 text-[10px] font-bold hover:bg-white dark:border-slate-800 dark:hover:bg-slate-900 cursor-pointer"
                              >
                                + Add part
                              </button>
                            </div>

                            {parts.length > 0 ? (
                              <div className="space-y-2 overflow-x-auto">
                                <div className="min-w-[380px] grid grid-cols-[1fr_64px_80px_70px_28px] gap-2 text-[9px] font-bold uppercase tracking-wider text-slate-400 px-1">
                                  <span>Part name</span><span>Qty</span><span>Unit cost</span><span className="text-right">Total</span><span />
                                </div>
                                {parts.map((part, index) => {
                                  const lineTotal = (Number(part.quantity) || 0) * (Number(part.cost) || 0);
                                  return (
                                    <div key={index} className="min-w-[380px] grid grid-cols-[1fr_64px_80px_70px_28px] gap-2 items-center">
                                      <input value={part.name} onChange={(e) => updatePart(index, 'name', e.target.value)} placeholder="e.g. HDMI cable 2m" className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-xs outline-none dark:border-slate-800 dark:bg-slate-950/60" />
                                      <input type="number" min="1" step="1" value={part.quantity} onChange={(e) => updatePart(index, 'quantity', e.target.value)} className="rounded-xl border border-slate-200 bg-white/70 px-2 py-2 text-xs outline-none dark:border-slate-800 dark:bg-slate-950/60" />
                                      <input type="number" min="0" step="1" value={part.cost} onChange={(e) => updatePart(index, 'cost', e.target.value)} className="rounded-xl border border-slate-200 bg-white/70 px-2 py-2 text-xs outline-none dark:border-slate-800 dark:bg-slate-950/60" />
                                      <span className="text-right text-xs font-bold text-slate-700 dark:text-slate-300 tabular-nums">{lineTotal.toLocaleString()}</span>
                                      <button type="button" onClick={() => setParts(parts.filter((_, i) => i !== index))} className="grid h-6 w-6 place-items-center rounded-lg bg-rose-50 text-rose-600 text-[10px] font-bold hover:bg-rose-100 dark:bg-rose-950/30 cursor-pointer">✕</button>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-[11px] text-slate-400 italic">No parts added — click "+ Add part" if any part was replaced.</p>
                            )}

                            <div className="border-t border-slate-200/60 dark:border-slate-800 pt-2.5 space-y-1.5 text-xs">
                              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                                <span className="font-semibold">Parts subtotal</span>
                                <span className="font-bold tabular-nums">{partsSubtotal.toLocaleString()}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-semibold text-slate-500 dark:text-slate-400">Labor / other cost</span>
                                <input type="number" min="0" step="1" value={laborCost} onChange={(e) => handleLaborCost(e.target.value)} className="w-24 rounded-xl border border-slate-200 bg-white/70 px-2 py-1.5 text-right text-xs outline-none dark:border-slate-800 dark:bg-slate-950/60" />
                              </div>
                              <div className="flex items-center justify-between text-sm border-t border-slate-200/60 dark:border-slate-800 pt-1.5">
                                <span className="font-bold text-slate-800 dark:text-slate-200">Total Cost</span>
                                <span className="font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums">{grandTotal.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>

                          {/* Evidence photos of the completed work */}
                          <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Work Evidence Photos (optional, up to 5)</label>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/gif"
                              multiple
                              onChange={handleMaintenanceFiles}
                              className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-xs outline-none dark:border-slate-800 dark:bg-slate-950/60 file:mr-3 file:rounded-xl file:border-0 file:bg-ink-900 file:px-3 file:py-1.5 file:text-[10px] file:font-bold file:text-white dark:file:bg-white dark:file:text-ink-900 cursor-pointer"
                            />
                            {maintenanceFiles.length > 0 ? (
                              <p className="mt-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">{maintenanceFiles.length} photo{maintenanceFiles.length > 1 ? 's' : ''} attached: {maintenanceFiles.map((f) => f.name).join(', ')}</p>
                            ) : null}
                          </div>

                          <button
                            disabled={maintenanceMutation.isPending || !maintenanceNotes.trim() || parts.some((part) => !part.name.trim())}
                            onClick={handleResolveSubmit}
                            className="w-full rounded-2xl bg-ink-900 hover:bg-ink-850 px-4 py-3 text-xs font-bold text-white transition-all shadow dark:bg-white dark:text-ink-900 dark:hover:bg-slate-100 cursor-pointer mt-1 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {maintenanceMutation.isPending ? 'Saving logs...' : !maintenanceNotes.trim() ? 'Technical notes required to resolve' : parts.some((part) => !part.name.trim()) ? 'Fill or remove empty part rows' : `Save details & Resolve (Total: ${grandTotal.toLocaleString()})`}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-3xl border border-slate-150/60 bg-emerald-50/20 p-5 dark:border-slate-800 dark:bg-slate-950/20 space-y-4">
                        <div className="flex items-center gap-2">
                          <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-100 text-emerald-700 text-xs">✓</span>
                          <span className="text-xs font-bold text-emerald-750 dark:text-emerald-450">Resolution Logged</span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                          This task has been successfully completed and resolved.
                        </p>

                        {/* Cost summary of the completed work */}
                        <div className="rounded-2xl border border-slate-150/60 bg-white/60 p-3.5 dark:border-slate-800 dark:bg-slate-950/30 text-xs space-y-1.5">
                          {selected.partsUsed?.length ? (
                            <>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Parts used</p>
                              {selected.partsUsed.map((part, i) => (
                                <div key={i} className="flex justify-between text-slate-600 dark:text-slate-400">
                                  <span>{part.name} × {part.quantity}</span>
                                  <span className="tabular-nums">{((part.quantity || 0) * (part.cost || 0)).toLocaleString()}</span>
                                </div>
                              ))}
                            </>
                          ) : null}
                          <div className="flex justify-between border-t border-slate-200/60 dark:border-slate-800 pt-1.5 font-bold text-slate-800 dark:text-slate-200">
                            <span>Total spent on this complaint</span>
                            <span className="text-emerald-700 dark:text-emerald-400 tabular-nums">{(selected.maintenanceCost || 0).toLocaleString()}</span>
                          </div>
                        </div>
                        
                        {(selected.aiMaintenanceSummary || selected.aiPreventiveRecommendation) && (
                          <div className="space-y-3 rounded-2xl border border-violet-200 bg-violet-50/20 p-4 dark:border-slate-800 dark:bg-slate-950/20 text-left">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-violet-750 dark:text-violet-400 flex items-center gap-1">✨ AI Maintenance Diagnosis Advice</h3>
                            {selected.aiMaintenanceSummary && (
                              <div className="text-xs">
                                <span className="text-slate-400 block font-bold uppercase tracking-wider text-[9px]">Summary of Repair</span>
                                <p className="mt-1 text-slate-700 dark:text-slate-350 bg-white/60 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 leading-normal">{selected.aiMaintenanceSummary}</p>
                              </div>
                            )}
                            {selected.aiPreventiveRecommendation && (
                              <div className="text-xs border-t border-slate-100 dark:border-slate-800/50 pt-2 mt-2">
                                <span className="text-slate-400 block font-bold uppercase tracking-wider text-[9px]">Preventive Recommendation</span>
                                <p className="mt-1 text-slate-700 dark:text-slate-350 bg-white/60 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 leading-normal">{selected.aiPreventiveRecommendation}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
        ) : null}
      </Modal>
    </div>
  );
}
