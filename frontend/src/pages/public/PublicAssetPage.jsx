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
    if (!description.trim()) {
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
    return <div className="grid min-h-screen place-items-center bg-hero-grid"><div className="rounded-2xl bg-white px-6 py-4 shadow-soft dark:bg-slate-900">Loading asset...</div></div>;
  }

  if (assetQuery.isError || !asset) {
    return (
      <div className="grid min-h-screen place-items-center bg-hero-grid p-4">
        <div className="rounded-[2rem] border border-rose-200 bg-white px-8 py-8 text-center shadow-soft dark:border-rose-950/40 dark:bg-slate-900 max-w-md w-full">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
            ⚠️
          </div>
          <h2 className="mt-4 text-xl font-semibold text-slate-900 dark:text-white">This asset isn't registered</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            The equipment code <span className="font-mono font-bold text-slate-800 dark:text-slate-200">"{code}"</span> was not found in our database inventory.
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="mt-5 w-full rounded-2xl bg-ink-900 px-4 py-3 text-sm font-medium text-white transition hover:opacity-95 dark:bg-white dark:text-ink-900"
          >
            Go back to dashboard
          </button>
        </div>
      </div>
    );
  }

  return <div className="min-h-screen bg-hero-grid px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-ink-500">Public asset page</p>
        <h1 className="mt-2 text-3xl font-semibold">{asset.name}</h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400">{asset.code} · {asset.category} · {asset.location}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <StatusBadge value={asset.status} />
          <StatusBadge value={asset.condition} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-4 text-sm dark:bg-slate-950 sm:max-w-md">
          <div>
            <span className="block text-xs text-slate-400">Last service</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{formatDate(asset.lastServiceDate)}</span>
          </div>
          <div>
            <span className="block text-xs text-slate-400">Next service due</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{formatDate(asset.nextServiceDate)}</span>
          </div>
        </div>
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Public URL: {publicUrl}</p>
      </section>

      {isRetired ? (
        <section className="rounded-[2rem] border border-amber-300 bg-amber-50 p-6 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <h2 className="text-lg font-semibold">⚠️ This asset has been retired</h2>
          <p className="mt-1 text-sm">It is no longer in active service. Its record and history remain readable, but new issues cannot be reported against it. Contact the maintenance office if you believe this is a mistake.</p>
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xl font-semibold">Report issue</h2>
          {isRetired ? <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Reporting is disabled because this asset is retired.</p> : null}
          {!isRetired ? <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4">
            <textarea className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950" rows={4} placeholder="Describe the fault" {...register('description', { required: true })} />
            <div className="grid gap-4 md:grid-cols-2">
              <input className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950" placeholder="Suggested / manual title" {...register('title')} />
              <select className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950 text-slate-700 dark:text-slate-200" {...register('category', { required: 'Category is required' })}>
                <option value="">Select Category</option>
                <option value="Electronics / IT">Electronics / IT</option>
                <option value="Electrical">Electrical</option>
                <option value="HVAC / Air Conditioning">HVAC / Air Conditioning</option>
                <option value="Plumbing">Plumbing</option>
                <option value="Mechanical / Furniture">Mechanical / Furniture</option>
                <option value="Safety & Security">Safety & Security</option>
                <option value="Lab Equipment">Lab Equipment</option>
              </select>
              <select className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950" {...register('priority')}>
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
                <option>Critical</option>
              </select>
              <input className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950" placeholder="Your name" {...register('reporterName', { required: true })} />
              <input className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950" placeholder="Student ID (optional)" {...register('studentId')} />
              <input className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950 md:col-span-2" placeholder="Email (optional)" {...register('reporterEmail')} />
            </div>
            <div>
              <label className="grid gap-2 text-sm font-medium">
                Evidence photos (optional, up to 5 images, 5MB each)
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={handleEvidenceChange} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-ink-900 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white dark:border-slate-800 dark:bg-slate-950 dark:file:bg-white dark:file:text-ink-900" />
              </label>
              {evidenceFiles.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-3">
                  {evidenceFiles.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="relative">
                      <img src={URL.createObjectURL(file)} alt={file.name} className="h-20 w-20 rounded-xl border border-slate-200 object-cover dark:border-slate-800" />
                      <button type="button" onClick={() => setEvidenceFiles(evidenceFiles.filter((_, i) => i !== index))} className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-rose-600 text-xs text-white">✕</button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={handleGenerateTriage} className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">Generate AI triage</button>
              <button disabled={isSubmitting || reportMutation.isPending} type="submit" className="rounded-2xl bg-ink-900 px-4 py-3 text-white dark:bg-white dark:text-ink-900">{reportMutation.isPending ? 'Submitting...' : 'Submit issue'}</button>
            </div>
          </form> : null}
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xl font-semibold">AI suggestion</h2>
          {suggestion ? <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
            <input value={suggestion.title || ''} onChange={(e) => setSuggestion({ ...suggestion, title: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950" />
            <input value={suggestion.category || ''} onChange={(e) => setSuggestion({ ...suggestion, category: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950" />
            <input value={suggestion.priority || ''} onChange={(e) => setSuggestion({ ...suggestion, priority: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950" />
            <textarea value={(suggestion.possibleCauses || []).join(', ')} onChange={(e) => setSuggestion({ ...suggestion, possibleCauses: e.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} rows={2} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950" />
            <textarea value={(suggestion.initialChecks || []).join(', ')} onChange={(e) => setSuggestion({ ...suggestion, initialChecks: e.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} rows={2} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950" />
            {suggestion.warning && (
              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 dark:bg-amber-950/30 dark:border-amber-900/50 dark:text-amber-300">
                <strong>Safety / Recurring Warning:</strong> {suggestion.warning}
              </div>
            )}
          </div> : <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Generate AI triage from the issue description.</p>}
        </section>
      </div>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-semibold">Recent issues</h2>
        <div className="mt-4 space-y-3">
          {issues.map((issue) => <div key={issue.issueNumber} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
            <div>
              <p className="font-medium">{issue.title}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{issue.issueNumber} · {issue.category}</p>
            </div>
            <StatusBadge value={issue.status} />
          </div>)}
        </div>
      </section>
    </div>
  </div>;
}
