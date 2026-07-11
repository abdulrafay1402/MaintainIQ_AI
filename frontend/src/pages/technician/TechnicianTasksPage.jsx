import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';
import StatusBadge from '../../components/StatusBadge';

const nextStatuses = ['Inspection Started', 'Maintenance In Progress', 'Waiting for Parts', 'Resolved', 'Verified', 'Closed', 'Reopened'];

export default function TechnicianTasksPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [status, setStatus] = useState('Inspection Started');
  const [note, setNote] = useState('');
  const [maintenanceNotes, setMaintenanceNotes] = useState('');
  const [cost, setCost] = useState('0');
  const [partsText, setPartsText] = useState('');
  const [inspectionFindings, setInspectionFindings] = useState('');
  const [workPerformed, setWorkPerformed] = useState('');
  const [durationHours, setDurationHours] = useState('1');
  const [finalCondition, setFinalCondition] = useState('Good');

  const [activeTab, setActiveTab] = useState('my-tasks');

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
    onSuccess: () => {
      toast.success('Task status updated');
      queryClient.invalidateQueries({ queryKey: ['assigned-issues'] });
      queryClient.invalidateQueries({ queryKey: ['shared-pool-issues'] });
      queryClient.invalidateQueries({ queryKey: ['issues'] });
    },
    onError: (error) => toast.error(error?.response?.data?.message || 'Could not update task'),
  });

  const maintenanceMutation = useMutation({
    mutationFn: async ({ id, payload }) => api.post(`/issues/${id}/maintenance`, payload),
    onSuccess: () => {
      toast.success('Maintenance saved');
      queryClient.invalidateQueries({ queryKey: ['assigned-issues'] });
      queryClient.invalidateQueries({ queryKey: ['shared-pool-issues'] });
      queryClient.invalidateQueries({ queryKey: ['issues'] });
    },
    onError: (error) => toast.error(error?.response?.data?.message || 'Could not save maintenance'),
  });

  const currentIssues = activeTab === 'my-tasks' ? assignedIssues : sharedPoolIssues;
  const selected = selectedIssue || currentIssues[0] || null;

  return <div className="space-y-6">
    <div className="flex items-center justify-between">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition cursor-pointer">
        <span>←</span> <span>Back</span>
      </button>
    </div>

    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-ink-500">Tasks</p>
      <h1 className="mt-2 text-3xl font-semibold">Process and complete assigned work</h1>
    </section>

    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <div className="flex gap-4 border-b border-slate-100 pb-3 dark:border-slate-800 mb-5">
          <button
            onClick={() => { setActiveTab('my-tasks'); setSelectedIssue(null); }}
            className={`pb-1 text-sm font-semibold border-b-2 transition cursor-pointer ${activeTab === 'my-tasks' ? 'border-ink-900 text-ink-900 dark:border-white dark:text-white' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            My Assigned Tasks ({assignedIssues.length})
          </button>
          <button
            onClick={() => { setActiveTab('shared-pool'); setSelectedIssue(null); }}
            className={`pb-1 text-sm font-semibold border-b-2 transition cursor-pointer ${activeTab === 'shared-pool' ? 'border-ink-900 text-ink-900 dark:border-white dark:text-white' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            Open Shared Pool ({sharedPoolIssues.length})
          </button>
        </div>

        <div className="space-y-3">
          {currentIssues.length > 0 ? currentIssues.map((issue) => (
            <button key={issue._id} onClick={() => { setSelectedIssue(issue); setStatus(issue.status); setNote(issue.maintenanceNotes || ''); }} className={`w-full rounded-2xl border p-4 text-left transition ${selected?._id === issue._id ? 'border-ink-900 bg-slate-50 dark:bg-slate-950' : 'border-slate-200 dark:border-slate-800'}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{issue.title}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{issue.issueNumber} · {issue.asset?.name || issue.assetCode} · {issue.category || 'General'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${issue.priority === 'Critical' ? 'bg-rose-100 text-rose-700' : issue.priority === 'High' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>{issue.priority}</span>
                  <StatusBadge value={issue.status} />
                </div>
              </div>
            </button>
          )) : (
            <p className="text-sm text-slate-500 text-center py-8">No tasks found in this section.</p>
          )}
        </div>
      </section>

      <section className="space-y-4 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
        {selected ? <>
          {/* Assigned Ticket Details (Read-Only) */}
          <div className="rounded-3xl border border-slate-200 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-950/20 space-y-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">📋 Ticket Reference (Read-Only)</span>
              <h3 className="text-xl font-bold mt-1 text-slate-900 dark:text-white">{selected.title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Issue Number: <span className="font-mono font-semibold">{selected.issueNumber}</span>
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-2xl bg-white p-3 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/40">
                <span className="text-slate-400 block mb-0.5">Equipment</span>
                <span className="font-semibold">{selected.asset?.name || selected.assetCode || 'N/A'}</span>
              </div>
              <div className="rounded-2xl bg-white p-3 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/40">
                <span className="text-slate-400 block mb-0.5">Location</span>
                <span className="font-semibold">{selected.asset?.location || 'N/A'}</span>
              </div>
              <div className="rounded-2xl bg-white p-3 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/40">
                <span className="text-slate-400 block mb-0.5">Category</span>
                <span className="font-semibold">{selected.category || 'N/A'}</span>
              </div>
              <div className="rounded-2xl bg-white p-3 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/40">
                <span className="text-slate-400 block mb-0.5">Priority</span>
                <span className="font-semibold">{selected.priority || 'N/A'}</span>
              </div>
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-350">Problem Description</span>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/40">
                {selected.description}
              </p>
            </div>

            {/* Admin Instructions & Activity logs */}
            {selected.timeline && selected.timeline.length > 0 && (
              <div className="mt-3">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-350">Admin Instructions / Updates</span>
                <div className="mt-2 space-y-2 max-h-[150px] overflow-y-auto bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/40">
                  {selected.timeline.filter(t => t.note).map((t, idx) => (
                    <div key={idx} className="text-xs border-b border-slate-100 dark:border-slate-850 pb-2 last:border-0 last:pb-0">
                      <p className="font-semibold text-ink-600 dark:text-ink-400">
                        {t.actorName || 'Admin'} ({t.toStatus}):
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 mt-0.5">{t.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Suggestion Triage details for Tech */}
            {selected.aiSuggestion && (
              <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-850">
                <span className="text-[10px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">✨ AI Triage Diagnosis Context</span>
                <p className="text-xs text-slate-500 mt-1">
                  Suggested Cause: {selected.aiSuggestion.possibleCauses?.join(', ') || 'N/A'}
                </p>
                {selected.aiSuggestion.warning && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 bg-amber-50 dark:bg-amber-950/20 p-2 rounded-xl">
                    ⚠️ {selected.aiSuggestion.warning}
                  </p>
                )}
              </div>
            )}
          </div>

          {activeTab === 'shared-pool' ? (
            <div className="space-y-4 rounded-3xl border border-dashed border-accent-300 bg-accent-50/20 p-5 dark:border-slate-800 dark:bg-slate-950/20">
              <h3 className="font-semibold text-accent-700 dark:text-accent-400">Unassigned shared task</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                This issue is currently shared with the maintenance team. Claiming this issue assigns it to your personal checklist and sets the status to Assigned.
              </p>
              <button
                onClick={() => claimMutation.mutate(selected._id)}
                disabled={claimMutation.isPending}
                className="w-full rounded-2xl bg-ink-900 px-4 py-3 text-white dark:bg-white dark:text-ink-900 font-medium hover:opacity-95 transition"
              >
                {claimMutation.isPending ? 'Claiming...' : 'Claim task & Start work'}
              </button>
            </div>
          ) : (
            <>
              {selected.status !== 'Resolved' && selected.status !== 'Verified' && selected.status !== 'Closed' ? (
                <>
                  <div className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                    <label className="grid gap-2 text-sm font-medium">
                      Task status
                      <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
                        {nextStatuses.map((item) => <option key={item} value={item}>{item}</option>)}
                      </select>
                    </label>
                    <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950" placeholder="Inspection / repair note" />
                    <button onClick={() => statusMutation.mutate({ id: selected._id, nextStatus: status, nextNote: note })} className="rounded-2xl bg-ink-900 px-4 py-3 text-white dark:bg-white dark:text-ink-900 font-medium">Update status</button>
                  </div>

                  <div className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                    <h3 className="font-semibold">Maintenance details & Resolution</h3>
                    <textarea value={inspectionFindings} onChange={(e) => setInspectionFindings(e.target.value)} rows={2} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950" placeholder="Inspection findings" />
                    <textarea value={workPerformed} onChange={(e) => setWorkPerformed(e.target.value)} rows={2} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950" placeholder="Work performed" />
                    <textarea value={maintenanceNotes} onChange={(e) => setMaintenanceNotes(e.target.value)} rows={2} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950" placeholder="General maintenance notes" />
                    <div className="grid gap-4 md:grid-cols-2">
                      <input value={durationHours} onChange={(e) => setDurationHours(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950" placeholder="Duration (hours)" />
                      <select value={finalCondition} onChange={(e) => setFinalCondition(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950 text-slate-700 dark:text-slate-200">
                        <option>Good</option>
                        <option>Fair</option>
                        <option>Poor</option>
                        <option>Retired</option>
                      </select>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <input value={cost} onChange={(e) => setCost(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950" placeholder="Parts & labour cost" />
                      <input value={partsText} onChange={(e) => setPartsText(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950" placeholder="Parts as name:qty:cost, ..." />
                    </div>
                    <button onClick={() => maintenanceMutation.mutate({ id: selected._id, payload: { notes: maintenanceNotes, cost: Number(cost), completedAt: new Date().toISOString(), startedAt: new Date().toISOString(), inspectionFindings, workPerformed, finalCondition, durationHours: Number(durationHours) || 1, partsUsed: partsText ? partsText.split(',').map((item) => { const [name = '', quantity = '1', partCost = '0'] = item.split(':').map((value) => value.trim()); return { name, quantity: Number(quantity) || 1, cost: Number(partCost) || 0 }; }).filter((part) => part.name) : [] } })} className="w-full rounded-2xl bg-ink-900 px-4 py-3 text-white dark:bg-white dark:text-ink-900 font-medium">Save maintenance & Resolve</button>
                  </div>
                </>
              ) : (
                <div className="rounded-3xl border border-slate-200 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-950/20 space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-green-100 text-green-700 text-xs">✓</span>
                    <span className="text-xs font-semibold text-green-700 dark:text-green-400">Resolution Logged</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    This task has been completed and marked as resolved.
                  </p>
                  {(selected.aiMaintenanceSummary || selected.aiPreventiveRecommendation) && (
                    <div className="space-y-3 rounded-2xl border border-violet-200 bg-violet-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/20 text-left">
                      <h3 className="font-semibold text-violet-700 dark:text-violet-400">✨ AI Maintenance Summary & Advice</h3>
                      {selected.aiMaintenanceSummary && (
                        <div className="text-xs">
                          <span className="text-slate-400 block font-medium">Summary of Repair</span>
                          <p className="mt-1 text-slate-700 dark:text-slate-350 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-850">{selected.aiMaintenanceSummary}</p>
                        </div>
                      )}
                      {selected.aiPreventiveRecommendation && (
                        <div className="text-xs border-t border-slate-100 dark:border-slate-800 pt-2 mt-2">
                          <span className="text-slate-400 block font-medium">Preventive Recommendation</span>
                          <p className="mt-1 text-slate-700 dark:text-slate-350 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-850">{selected.aiPreventiveRecommendation}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </> : <p className="text-slate-500 dark:text-slate-400">No task selected.</p>}
      </section>
    </div>
  </div>;
}
