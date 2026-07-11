import { useQuery } from '@tanstack/react-query';
import api from '../../api';
import StatusBadge from '../../components/StatusBadge';

export default function StudentComplaintsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['student', 'complaints'],
    queryFn: async () => (await api.get('/issues/my')).data.issues,
  });

  const complaints = data || [];

  return <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
    <div className="mb-6">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-ink-500">Complaints</p>
      <h1 className="mt-2 text-3xl font-semibold">My complaint timeline</h1>
    </div>

    <div className="space-y-4">
      {isLoading ? <p>Loading complaints...</p> : complaints.map((issue) => <article key={issue._id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{issue.title}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{issue.issueNumber} · {issue.asset?.name || issue.assetCode}</p>
          </div>
          <StatusBadge value={issue.status} />
        </div>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{issue.description}</p>
        {issue.maintenanceNotes ? <p className="mt-2 text-sm text-slate-500 dark:text-slate-400"><strong>Latest note:</strong> {issue.maintenanceNotes}</p> : null}
        {issue.evidence?.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {issue.evidence.map((url, index) => (
              <a key={index} href={url} target="_blank" rel="noreferrer">
                <img src={url} alt={`Evidence ${index + 1}`} className="h-14 w-14 rounded-lg border border-slate-200 object-cover dark:border-slate-800" />
              </a>
            ))}
          </div>
        ) : null}
        {issue.timeline?.length > 0 ? (
          <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Status timeline</p>
            <div className="mt-2 space-y-1.5">
              {issue.timeline.map((entry, index) => (
                <p key={index} className="text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-medium text-slate-700 dark:text-slate-300">{entry.toStatus}</span>
                  {entry.fromStatus ? <span> (from {entry.fromStatus})</span> : null}
                  {' · '}{new Date(entry.createdAt).toLocaleString()}
                </p>
              ))}
            </div>
          </div>
        ) : null}
      </article>)}
    </div>
  </section>;
}
