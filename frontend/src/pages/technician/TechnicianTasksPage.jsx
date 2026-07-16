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

      {/* Title block */}
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/70 p-6 shadow-soft backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-ink-500 font-display">Work orders</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white font-display">Technical tasks</h1>
      </section>

      {/* Grid: queue and forms */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Side: queue tabs */}
        <section className="rounded-[2rem] border border-slate-200/80 bg-white/70 p-6 shadow-soft backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60 flex flex-col justify-between">
          <div>
            <div className="flex gap-4 border-b border-slate-100 pb-3 dark:border-slate-800 mb-5">
              <button
                onClick={() => { setActiveTab('my-tasks'); setSelectedIssue(null); }}
                className={`pb-2 text-sm font-bold border-b-2 transition-all cursor-pointer ${activeTab === 'my-tasks' ? 'border-ink-900 text-slate-900 dark:border-white dark:text-white' : 'border-transparent text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-350'}`}
              >
                My Assigned Tasks ({assignedIssues.length})
              </button>
              <button
                onClick={() => { setActiveTab('shared-pool'); setSelectedIssue(null); }}
                className={`pb-2 text-sm font-bold border-b-2 transition-all cursor-pointer ${activeTab === 'shared-pool' ? 'border-ink-900 text-slate-900 dark:border-white dark:text-white' : 'border-transparent text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-350'}`}
              >
                Open Shared Pool ({sharedPoolIssues.length})
              </button>
            </div>

            <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
              {currentIssues.length > 0 ? currentIssues.map((issue) => (
                <button 
                  key={issue._id} 
                  onClick={() => { 
                    setSelectedIssue(issue); 
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
          </div>
        </section>

        {/* Right Side: details and updates */}
        <section className="rounded-[2rem] border border-slate-200/80 bg-white/70 p-6 shadow-soft backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60 flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white font-display mb-4">Task Console</h2>
            
            {selected ? (
              <div className="space-y-5">
                
                {/* Details card */}
                <div className="rounded-3xl border border-slate-100 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-950/20 space-y-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">📋 Ticket Reference (Read-Only)</span>
                    <h3 className="text-lg font-bold mt-1 text-slate-900 dark:text-white font-display">{selected.title}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Issue Number: <span className="font-mono font-semibold">{selected.issueNumber}</span>
                    </p>
                  </div>
                  
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
                    <span className="text-[10px] font-bold uppercase tracking-wider text-violet-650 dark:text-violet-400 block mb-1">✨ AI Triage Diagnostics Context</span>
                    <p className="text-xs text-slate-500 dark:text-slate-450 mt-1 leading-normal font-semibold">
                      Suggested Cause: <span className="underline">{selected.aiSuggestion.possibleCauses?.join(', ') || 'N/A'}</span>
                    </p>
                    {selected.aiSuggestion.warning && (
                      <p className="text-[10px] text-amber-700 mt-1.5 bg-amber-50/50 dark:bg-amber-950/20 p-2.5 rounded-xl border border-amber-100/50 dark:border-amber-900/10 font-semibold">
                        ⚠️ {selected.aiSuggestion.warning}
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
                    {selected.status !== 'Resolved' && selected.status !== 'Verified' && selected.status !== 'Closed' ? (
                      <div className="space-y-4">
                        
                        {/* Quick Update */}
                        <div className="space-y-3 rounded-3xl border border-slate-150/60 p-4 dark:border-slate-800 bg-white/40 dark:bg-slate-900/10 text-sm">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Status Transition
                          </label>
                          <select 
                            value={status} 
                            onChange={(e) => setStatus(e.target.value)} 
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950/60 outline-none mb-1 text-slate-700 dark:text-slate-200"
                          >
                            {nextStatuses.map((item) => <option key={item} value={item}>{item}</option>)}
                          </select>
                          <textarea 
                            value={note} 
                            onChange={(e) => setNote(e.target.value)} 
                            rows={2} 
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950/60 outline-none" 
                            placeholder="State transition remarks..." 
                          />
                          <button 
                            disabled={statusMutation.isPending}
                            onClick={() => statusMutation.mutate({ id: selected._id, nextStatus: status, nextNote: note })} 
                            className="w-full rounded-2xl bg-ink-900 hover:bg-ink-850 px-4 py-2.5 text-xs font-bold text-white dark:bg-white dark:text-ink-900 dark:hover:bg-slate-100 transition shadow cursor-pointer"
                          >
                            {statusMutation.isPending ? 'Updating...' : 'Update Status'}
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
                              <input value={durationHours} onChange={(e) => setDurationHours(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 outline-none dark:border-slate-800 dark:bg-slate-950/60" placeholder="1" />
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
                          
                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Total Cost (Parts & Labor)</label>
                              <input value={cost} onChange={(e) => setCost(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 outline-none dark:border-slate-800 dark:bg-slate-950/60" placeholder="0" />
                            </div>
                            <div>
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Parts Text Mapping</label>
                              <input value={partsText} onChange={(e) => setPartsText(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 outline-none dark:border-slate-800 dark:bg-slate-950/60" placeholder="Format: name:qty:cost, ..." />
                            </div>
                          </div>
                          
                          <button 
                            disabled={maintenanceMutation.isPending}
                            onClick={() => maintenanceMutation.mutate({ 
                              id: selected._id, 
                              payload: { 
                                notes: maintenanceNotes, 
                                cost: Number(cost), 
                                completedAt: new Date().toISOString(), 
                                startedAt: new Date().toISOString(), 
                                inspectionFindings, 
                                workPerformed, 
                                finalCondition, 
                                durationHours: Number(durationHours) || 1, 
                                partsUsed: partsText ? partsText.split(',').map((item) => { 
                                  const [name = '', quantity = '1', partCost = '0'] = item.split(':').map((value) => value.trim()); 
                                  return { name, quantity: Number(quantity) || 1, cost: Number(partCost) || 0 }; 
                                }).filter((part) => part.name) : [] 
                              } 
                            })} 
                            className="w-full rounded-2xl bg-ink-900 hover:bg-ink-850 px-4 py-3 text-xs font-bold text-white transition-all shadow dark:bg-white dark:text-ink-900 dark:hover:bg-slate-100 cursor-pointer mt-1"
                          >
                            {maintenanceMutation.isPending ? 'Saving logs...' : 'Save details & Resolve task'}
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
            ) : (
              <p className="text-xs text-slate-400 italic py-10 text-center">Select a task from the active queue to update its status or log maintenance repairs.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
