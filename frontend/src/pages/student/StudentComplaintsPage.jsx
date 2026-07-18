import { useQuery } from '@tanstack/react-query';
import api from '../../api';
import StatusBadge from '../../components/StatusBadge';
import StatusProgress from '../../components/StatusProgress';

export default function StudentComplaintsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['student', 'complaints'],
    queryFn: async () => (await api.get('/issues/my')).data.issues,
  });

  const complaints = data || [];

  return (
    <div className="space-y-6">
      {/* Banner */}
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/70 p-6 shadow-soft backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-ink-500 font-display">Status tracker</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white font-display">My Complaints & Timeline</h1>
      </section>

      {/* Complaints List */}
      <div className="space-y-4 text-sm">
        {isLoading ? (
          <div className="rounded-2xl bg-white p-6 shadow-soft text-center dark:bg-slate-900 text-slate-400 italic">
            Loading active complaints registry...
          </div>
        ) : complaints.map((issue) => (
          <article 
            key={issue._id} 
            className="rounded-[2rem] border border-slate-200/80 bg-white/75 p-6 shadow-soft backdrop-blur-md dark:border-slate-800/85 dark:bg-slate-900/60 space-y-4"
          >
            {/* Header info */}
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800/60 pb-3">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">{issue.issueNumber}</p>
                <h2 className="text-lg font-bold text-slate-850 dark:text-white font-display mt-0.5">{issue.title}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">
                  Equipment: <span className="font-mono text-ink-600 dark:text-ink-350">{issue.asset?.name || issue.assetCode}</span>
                </p>
              </div>
              <StatusBadge value={issue.status} />
            </div>

            {/* Live lifecycle progress */}
            <div className="px-1 pt-1">
              <StatusProgress status={issue.status} />
            </div>

            {/* Description */}
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Issue Description</span>
              <p className="text-xs text-slate-650 dark:text-slate-350 bg-slate-50/50 dark:bg-slate-950/30 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/40 leading-relaxed leading-normal">{issue.description}</p>
            </div>

            {/* Latest notes */}
            {issue.maintenanceNotes && (
              <div className="rounded-2xl bg-amber-50/50 p-4 border border-amber-100/50 text-xs text-amber-900 dark:bg-amber-950/20 dark:border-amber-900/10 dark:text-amber-300 leading-normal">
                <strong>Latest maintenance note:</strong> {issue.maintenanceNotes}
              </div>
            )}

            {/* Evidence attachments */}
            {issue.evidence?.length > 0 && (
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Evidence Attachment</span>
                <div className="flex flex-wrap gap-2">
                  {issue.evidence.map((url, index) => (
                    <a key={index} href={url} target="_blank" rel="noreferrer" className="relative group overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                      <img src={url} alt={`Evidence ${index + 1}`} className="h-14 w-14 object-cover transition-all group-hover:scale-105" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Status Timeline */}
            {issue.timeline?.length > 0 && (
              <div className="border-t border-slate-100 pt-4 dark:border-slate-800/80">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-3">Status progression timeline</span>
                <div className="space-y-4 max-h-[170px] overflow-y-auto pr-1">
                  {issue.timeline.map((entry, index) => (
                    <div key={index} className="relative pl-6 pb-2 last:pb-0 border-l border-slate-200 dark:border-slate-850 text-xs">
                      <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-slate-900 ring-4 ring-white dark:bg-white dark:ring-slate-900 -translate-x-[5.5px]" />
                      <p className="font-bold text-slate-850 dark:text-slate-200">
                        {entry.toStatus}
                        {entry.fromStatus ? <span className="font-normal text-slate-450"> (from {entry.fromStatus})</span> : null}
                      </p>
                      <p className="text-[10px] text-slate-400/80 mt-0.5 font-medium">
                        {new Date(entry.createdAt).toLocaleString()} {entry.actorName ? `· Updated by ${entry.actorName}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </article>
        ))}
        {!isLoading && complaints.length === 0 && (
          <p className="text-center text-sm text-slate-400 italic py-10">No reported complaints logged under your account.</p>
        )}
      </div>
    </div>
  );
}
