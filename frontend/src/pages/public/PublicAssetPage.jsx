import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';
import StatusBadge from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';

export default function PublicAssetPage() {
  const { code } = useParams();
  const auth = useAuth();
  const currentUser = auth?.user;

  const [suggestion, setSuggestion] = useState(null);
  const [evidenceFiles, setEvidenceFiles] = useState([]);
  const { register, handleSubmit, watch, reset, setValue, formState: { isSubmitting } } = useForm({
    defaultValues: {
      title: '',
      description: '',
      priority: 'Medium',
      category: '',
      reporterName: currentUser?.name || '',
      reporterEmail: currentUser?.email || '',
      studentId: currentUser?.studentId || '',
    },
  });

  useEffect(() => {
    if (currentUser) {
      setValue('reporterName', currentUser.name || '');
      setValue('reporterEmail', currentUser.email || '');
      setValue('studentId', currentUser.studentId || '');
    }
  }, [currentUser, setValue]);

  const description = watch('description');

  const assetQuery = useQuery({
    queryKey: ['public-asset', code],
    queryFn: async () => (await api.get(`/assets/public/${code}`)).data,
  });

  const triageMutation = useMutation({
    mutationFn: async (payload) => (await api.post('/issues/triage', payload)).data.suggestion,
    onSuccess: (data) => {
      setSuggestion(data);
      setValue('title', data.title || '');
      setValue('category', data.category || '');
      setValue('priority', data.priority || 'Medium');
      toast.success('AI triage generated');
    },
    onError: () => toast.error('Could not generate triage right now'),
  });

  const reportMutation = useMutation({
    mutationFn: async (payload) => {
      const formData = new FormData();
      Object.entries(payload).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        formData.append(key, typeof value === 'object' ? JSON.stringify(value) : value);
      });
      evidenceFiles.forEach((file) => formData.append('evidence', file));
      return (await api.post(`/issues/public/${code}/report`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
    },
    onSuccess: (data) => {
      toast.success(`Issue submitted: ${data.issue.issueNumber}`);
      reset();
      setSuggestion(null);
      setEvidenceFiles([]);
      assetQuery.refetch();
    },
    onError: (error) => toast.error(error?.response?.data?.message || 'Failed to submit issue'),
  });

  const asset = assetQuery.data?.asset;
  const issues = assetQuery.data?.recentIssues || [];
  const isRetired = asset?.status === 'Retired';

  const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : 'N/A');

  const handleEvidenceChange = (e) => {
    const files = Array.from(e.target.files || []).slice(0, 5);
    const valid = files.filter((file) => file.type.startsWith('image/') && file.size <= 5 * 1024 * 1024);
    if (valid.length < files.length) {
      toast.error('Only images up to 5MB are allowed');
    }
    setEvidenceFiles(valid);
  };

  const handleGenerateTriage = async () => {
    if (!description || !description.trim()) {
      toast.error('Write the complaint first');
      return;
    }

    triageMutation.mutate({
      assetCode: code,
      complaint: description,
    });
  };

  const onSubmit = (values) => {
    reportMutation.mutate({
      ...values,
      aiSuggestion: suggestion ? { ...suggestion, reviewedByUser: true } : undefined,
    });
  };

  const publicUrl = useMemo(() => `${window.location.origin}/public/assets/${code}`, [code]);

  if (assetQuery.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-hero-grid text-sm">
        <div className="rounded-2xl bg-white/70 px-6 py-4 shadow-premium backdrop-blur dark:bg-slate-900/60 text-slate-400 italic">
          Retrieving asset inventory data...
        </div>
      </div>
    );
  }

  if (assetQuery.isError || !asset) {
    return (
      <div className="grid min-h-screen place-items-center bg-hero-grid p-4 text-slate-900 dark:text-slate-100">
        <div className="rounded-[2.5rem] border border-rose-200 bg-white/70 px-8 py-8 text-center shadow-premium backdrop-blur-xl dark:border-rose-950/40 dark:bg-slate-900/60 max-w-md w-full">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-450">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="mt-4 text-xl font-bold tracking-tight font-display">Unregistered Equipment</h2>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-normal font-semibold">
            The barcode identifier <span className="font-mono font-bold text-slate-800 dark:text-slate-200">"{code}"</span> does not match any registered asset in our database.
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="mt-6 w-full rounded-2xl bg-ink-900 hover:bg-ink-850 px-4 py-3 text-xs font-bold text-white transition-all shadow dark:bg-white dark:text-ink-900 dark:hover:bg-slate-100 cursor-pointer"
          >
            Go back to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hero-grid px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-300">
      <div className="mx-auto max-w-6xl space-y-6">
        
        {/* Scanned Equipment Header */}
        <section className="relative overflow-hidden rounded-[2.5rem] border border-slate-200/80 bg-white/70 p-6 shadow-premium backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60">
          <div className="absolute top-0 right-0 h-32 w-32 rounded-full bg-ink-500/5 blur-[40px] pointer-events-none" />
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-ink-500 font-display">Scanned Asset Portal</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-850 dark:text-white font-display">{asset.name}</h1>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 font-semibold font-mono">
            {asset.code} · {asset.category} · {asset.location}
          </p>
          
          <div className="mt-4 flex flex-wrap gap-2">
            <StatusBadge value={asset.status} />
            <StatusBadge value={asset.condition} />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl bg-slate-50/50 p-4 text-xs dark:bg-slate-950/40 border border-slate-150/40 dark:border-slate-800 sm:max-w-md">
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Last Service Date</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">{formatDate(asset.lastServiceDate)}</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Next Service Due</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">{formatDate(asset.nextServiceDate)}</span>
            </div>
          </div>
          <p className="mt-4 text-[10px] text-slate-400 font-semibold truncate font-mono">URL Reference: {publicUrl}</p>
        </section>

        {isRetired ? (
          <section className="rounded-2xl border border-amber-300 bg-amber-50/50 p-5 text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300 leading-normal text-xs font-semibold">
            Warning: This equipment has been retired from active service. Records remain viewable, but new complaints cannot be filed against it.
          </section>
        ) : null}

        {/* Split Grid: Form vs AI diagnostics */}
        <div className="grid gap-6 lg:grid-cols-2">
          
          {/* Issue Report Form */}
          <section className="rounded-[2.5rem] border border-slate-200/80 bg-white/70 p-6 shadow-premium backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60 flex flex-col justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white font-display mb-4">Report Fault</h2>
              {isRetired ? (
                <p className="text-xs text-slate-400 italic">Fault reporting is disabled because the equipment is retired.</p>
              ) : (
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-xs">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5 ml-1">Describe Fault details</label>
                    <textarea 
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 outline-none focus:border-ink-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200" 
                      rows={4} 
                      placeholder="Describe what is broken, loose cables, flickering screens, etc..." 
                      {...register('description', { required: true })} 
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1 ml-1">Fault Title</label>
                      <input className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 outline-none dark:border-slate-800 dark:bg-slate-950/60" placeholder="e.g. HDMI cable flickering" {...register('title')} />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1 ml-1">Category</label>
                      <select className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 outline-none dark:border-slate-800 dark:bg-slate-950/60 text-slate-700 dark:text-slate-200" {...register('category', { required: 'Category is required' })}>
                        <option value="">Select Category</option>
                        <option value="Electronics / IT">Electronics / IT</option>
                        <option value="Electrical">Electrical</option>
                        <option value="HVAC / Air Conditioning">HVAC / Air Conditioning</option>
                        <option value="Plumbing">Plumbing</option>
                        <option value="Mechanical / Furniture">Mechanical / Furniture</option>
                        <option value="Safety & Security">Safety & Security</option>
                        <option value="Lab Equipment">Lab Equipment</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1 ml-1">Priority</label>
                      <select className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 outline-none dark:border-slate-800 dark:bg-slate-950/60" {...register('priority')}>
                        <option>Low</option>
                        <option>Medium</option>
                        <option>High</option>
                        <option>Critical</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1 ml-1">Your Name</label>
                      <input className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 outline-none dark:border-slate-800 dark:bg-slate-950/60" placeholder="Reporter name" {...register('reporterName', { required: true })} />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1 ml-1">Student / Member ID</label>
                      <input className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 outline-none dark:border-slate-800 dark:bg-slate-950/60" placeholder="Optional ID" {...register('studentId')} />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1 ml-1">Email address</label>
                      <input className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 outline-none dark:border-slate-800 dark:bg-slate-950/60" placeholder="Optional contact email" {...register('reporterEmail')} />
                    </div>
                  </div>

                  <div>
                    <label className="grid gap-1.5 text-xs font-bold text-slate-405 dark:text-slate-500 uppercase tracking-wider">
                      Attach Evidence Photo (optional, up to 5 files, 5MB each)
                      <input 
                        type="file" 
                        accept="image/jpeg,image/png,image/webp,image/gif" 
                        multiple 
                        onChange={handleEvidenceChange} 
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-xs outline-none dark:border-slate-800 dark:bg-slate-950/60 file:mr-3 file:rounded-xl file:border-0 file:bg-ink-900 file:px-3 file:py-1.5 file:text-[10px] file:font-bold file:text-white dark:file:bg-white dark:file:text-ink-900 cursor-pointer" 
                      />
                    </label>
                    {evidenceFiles.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {evidenceFiles.map((file, index) => (
                          <div key={`${file.name}-${index}`} className="relative border border-slate-200/50 dark:border-slate-800 rounded-xl overflow-hidden shrink-0">
                            <img src={URL.createObjectURL(file)} alt={file.name} className="h-16 w-16 object-cover" />
                            <button type="button" onClick={() => setEvidenceFiles(evidenceFiles.filter((_, i) => i !== index))} className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-rose-600 text-[10px] text-white">✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button 
                      type="button" 
                      onClick={handleGenerateTriage} 
                      className="rounded-2xl border border-slate-200 hover:bg-slate-50 px-4 py-3 font-semibold dark:border-slate-800 dark:hover:bg-slate-900 transition-all cursor-pointer"
                    >
                      🔮 Ask AI Diagnostics Triage
                    </button>
                    
                    <button 
                      disabled={isSubmitting || reportMutation.isPending} 
                      type="submit" 
                      className="flex-1 rounded-2xl bg-ink-900 hover:bg-ink-850 px-4 py-3 font-bold text-white transition-all shadow dark:bg-white dark:text-ink-900 dark:hover:bg-slate-100 cursor-pointer"
                    >
                      {reportMutation.isPending ? 'Submitting Fault...' : 'Submit Fault Report'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </section>

          {/* Right Side: AI Assistant Drawer */}
          <section className="rounded-[2.5rem] border border-slate-200/80 bg-white/70 p-6 shadow-premium backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60 flex flex-col justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white font-display mb-4">AI Smart Triage Assistant</h2>
              {suggestion ? (
                <div className="space-y-4 rounded-3xl border border-violet-200 bg-violet-50/20 p-5 dark:border-slate-850 dark:bg-slate-950/20 text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-ink-600 dark:text-ink-300">✨ Automated triage diagnostics</span>
                  
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Diagnostic Fault Title</label>
                    <input value={suggestion.title || ''} onChange={(e) => setSuggestion({ ...suggestion, title: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-xs outline-none dark:border-slate-800 dark:bg-slate-950/40" />
                  </div>
                  
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Suggested Category</label>
                      <input value={suggestion.category || ''} onChange={(e) => setSuggestion({ ...suggestion, category: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-xs outline-none dark:border-slate-800 dark:bg-slate-950/40" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Suggested Priority</label>
                      <input value={suggestion.priority || ''} onChange={(e) => setSuggestion({ ...suggestion, priority: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-xs outline-none dark:border-slate-800 dark:bg-slate-950/40" />
                    </div>
                  </div>

                  {suggestion.possibleCauses?.length > 0 && (
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Possible Causes</label>
                      <textarea value={(suggestion.possibleCauses || []).join(', ')} onChange={(e) => setSuggestion({ ...suggestion, possibleCauses: e.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} rows={2} className="w-full rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-xs outline-none dark:border-slate-800 dark:bg-slate-950/40" />
                    </div>
                  )}

                  {suggestion.initialChecks?.length > 0 && (
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Recommended checks</label>
                      <textarea value={(suggestion.initialChecks || []).join(', ')} onChange={(e) => setSuggestion({ ...suggestion, initialChecks: e.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} rows={2} className="w-full rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-xs outline-none dark:border-slate-800 dark:bg-slate-950/40" />
                    </div>
                  )}

                  {suggestion.warning && (
                    <div className="rounded-xl bg-amber-50/50 border border-amber-100 p-3 text-[11px] text-amber-800 dark:bg-amber-950/20 dark:border-amber-900/10 dark:text-amber-300 leading-normal">
                      <strong>Triage Alert:</strong> {suggestion.warning}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-450 italic py-10 text-center bg-slate-50/50 dark:bg-slate-950/10 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
                  Submit a description of the fault and click "Ask AI Diagnostics Triage" to auto-complete category filters and diagnose probable issues.
                </p>
              )}
            </div>
          </section>
        </div>

        {/* Recent issues */}
        <section className="rounded-[2.5rem] border border-slate-200/80 bg-white/70 p-6 shadow-premium backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display mb-4">Equipment Activity Logs</h2>
          <div className="space-y-3">
            {issues.map((issue) => (
              <div key={issue.issueNumber} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white/50 p-4 dark:border-slate-800 dark:bg-slate-950/20">
                <div>
                  <p className="font-bold text-sm text-slate-800 dark:text-slate-250 leading-normal">{issue.title}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold mt-0.5">
                    {issue.issueNumber} · {issue.category}
                  </p>
                </div>
                <StatusBadge value={issue.status} />
              </div>
            ))}
            {issues.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-6">No complaints logged for this asset yet.</p>
            ) : null}
          </div>
        </section>

      </div>
    </div>
  );
}
