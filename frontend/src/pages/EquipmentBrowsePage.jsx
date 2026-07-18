import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../api';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import SkeletonCards from '../components/SkeletonCards';
import StatusBadge from '../components/StatusBadge';
import StatusProgress from '../components/StatusProgress';
import useDebouncedValue from '../hooks/useDebouncedValue';
import usePagination from '../hooks/usePagination';

const CATEGORIES = ['Electronics / IT', 'Electrical', 'HVAC / Air Conditioning', 'Plumbing', 'Mechanical / Furniture', 'Safety & Security', 'Lab Equipment'];

// Read-only equipment browser for every logged-in role: browse the inventory
// in cards (or list), click an asset to see its details, full history timeline,
// and complaint timeline.
export default function EquipmentBrowsePage() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortOption, setSortOption] = useState('newest');
  const [viewMode, setViewMode] = useState('cards');
  const [selectedId, setSelectedId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(search);

  const { data: assets = [], isError, isLoading } = useQuery({
    queryKey: ['assets', 'browse', debouncedSearch, categoryFilter, statusFilter, sortOption],
    queryFn: async () => {
      const params = { sort: sortOption };
      if (debouncedSearch) params.search = debouncedSearch;
      if (categoryFilter) params.category = categoryFilter;
      if (statusFilter) params.status = statusFilter;
      return (await api.get('/assets', { params })).data.assets;
    },
    placeholderData: keepPreviousData,
  });

  const selected = useMemo(() => assets.find((asset) => asset._id === selectedId) || null, [assets, selectedId]);

  const pagination = usePagination(assets, 6);

  const openAsset = (id) => {
    setSelectedId(id);
    setModalOpen(true);
  };

  const { data: history = [] } = useQuery({
    queryKey: ['asset-history', selectedId],
    queryFn: async () => (await api.get(`/history/asset/${selectedId}`)).data.history,
    enabled: !!selectedId,
  });

  const { data: publicInfo } = useQuery({
    queryKey: ['public-asset-activity', selected?.publicId || selected?.code],
    queryFn: async () => (await api.get(`/assets/public/${selected.publicId || selected.code}`)).data,
    enabled: !!selected,
  });
  const recentIssues = publicInfo?.recentIssues || [];

  const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : 'N/A');

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/70 p-6 shadow-soft backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-ink-500 font-display">Inventory Explorer</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white font-display">Browse Equipment</h1>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 font-semibold">Click any equipment to view its details, service history, and complaint timeline.</p>
      </section>

      {isError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 text-xs font-semibold text-rose-800 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-300">
          ⚠ Could not reach the server — try refreshing.
        </div>
      ) : null}

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, code..." className="rounded-2xl border border-slate-200 bg-white/60 px-4 py-2 text-sm dark:border-slate-800 dark:bg-slate-950/60 min-w-[220px]" />
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded-2xl border border-slate-200 bg-white/60 px-3 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200">
          <option value="">All categories</option>
          {CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-2xl border border-slate-200 bg-white/60 px-3 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200">
          <option value="">All statuses</option>
          {['Operational', 'Issue Reported', 'Under Inspection', 'Under Maintenance', 'Out of Service', 'Retired'].map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={sortOption} onChange={(e) => setSortOption(e.target.value)} className="rounded-2xl border border-slate-200 bg-white/60 px-3 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200">
          <option value="newest">Newest first</option>
          <option value="name">Name A–Z</option>
          <option value="code">Code</option>
          <option value="status">Status</option>
        </select>
        <div className="ml-auto flex rounded-xl bg-slate-100/80 p-0.5 border border-slate-200/50 dark:bg-slate-950/40 dark:border-slate-800/80">
          {[['cards', 'Cards'], ['list', 'List']].map(([mode, label]) => (
            <button key={mode} type="button" onClick={() => setViewMode(mode)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${viewMode === mode ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white' : 'text-slate-400'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        {/* Asset grid/list — click opens the detail modal */}
        <div>
          {isLoading ? (
            <SkeletonCards count={6} columns="md:grid-cols-2 xl:grid-cols-3" />
          ) : viewMode === 'cards' ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {pagination.paged.map((asset) => (
                <button
                  key={asset._id}
                  type="button"
                  onClick={() => openAsset(asset._id)}
                  className={`text-left rounded-3xl border-2 p-6 transition-all cursor-pointer ${
                    selected?._id === asset._id
                      ? 'border-ink-500 bg-white/85 shadow-soft dark:border-ink-500 dark:bg-slate-900/70'
                      : 'border-slate-200 bg-white/60 hover:border-ink-400 hover:bg-white/80 dark:border-slate-800 dark:bg-slate-900/30 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">{asset.code}</p>
                    <StatusBadge value={asset.status} />
                  </div>
                  <h3 className="mt-2 text-lg font-extrabold text-slate-800 dark:text-slate-200 leading-snug font-display">{asset.name}</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">{asset.category}</p>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-800/60 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <span>📍 {asset.location}</span>
                    <StatusBadge value={asset.condition} />
                  </div>
                </button>
              ))}
              {assets.length === 0 ? <p className="col-span-full py-10 text-center text-xs text-slate-400 italic">No equipment matches the current filters.</p> : null}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white/40 dark:border-slate-800 dark:bg-slate-900/10">
              <table className="min-w-[560px] w-full divide-y divide-slate-100 text-sm dark:divide-slate-800">
                <thead className="bg-slate-50 text-left text-slate-400 dark:bg-slate-950 dark:text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">Name</th>
                    <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">Code</th>
                    <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">Location</th>
                    <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {pagination.paged.map((asset) => (
                    <tr key={asset._id} onClick={() => openAsset(asset._id)} className={`cursor-pointer transition-colors ${selected?._id === asset._id ? 'bg-ink-50/30 dark:bg-slate-800/50' : 'hover:bg-slate-50/40 dark:hover:bg-slate-900/10'}`}>
                      <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200">{asset.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{asset.code}</td>
                      <td className="px-4 py-3 text-slate-500">{asset.location}</td>
                      <td className="px-4 py-3"><StatusBadge value={asset.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination {...pagination} />
        </div>
      </div>

      {/* Equipment detail modal: info, complaint timeline, service history */}
      <Modal
        open={modalOpen && !!selected}
        onClose={() => setModalOpen(false)}
        title={selected?.name}
        subtitle={selected ? `${selected.code} · ${selected.category}` : ''}
        wide
      >
          {selected ? (
            <div className="space-y-4">
              <div>
                <div className="flex flex-wrap gap-1.5">
                  <StatusBadge value={selected.status} />
                  <StatusBadge value={selected.condition} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs bg-slate-50/50 dark:bg-slate-950/20 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                <div><span className="text-slate-400 block text-[9px] font-bold uppercase tracking-wider">Category</span><span className="font-semibold text-slate-800 dark:text-slate-200">{selected.category}</span></div>
                <div><span className="text-slate-400 block text-[9px] font-bold uppercase tracking-wider">Location</span><span className="font-semibold text-slate-800 dark:text-slate-200">{selected.location}</span></div>
                <div><span className="text-slate-400 block text-[9px] font-bold uppercase tracking-wider">Last Service</span><span className="font-semibold text-slate-800 dark:text-slate-200">{formatDate(selected.lastServiceDate)}</span></div>
                <div><span className="text-slate-400 block text-[9px] font-bold uppercase tracking-wider">Next Service</span><span className="font-semibold text-slate-800 dark:text-slate-200">{formatDate(selected.nextServiceDate)}</span></div>
                <div><span className="text-slate-400 block text-[9px] font-bold uppercase tracking-wider">Purchase Cost</span><span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">{selected.purchaseCost != null ? Number(selected.purchaseCost).toLocaleString() : '—'}</span></div>
                <div><span className="text-slate-400 block text-[9px] font-bold uppercase tracking-wider">Maintenance Spent</span><span className="font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">{(selected.maintenanceSpend || 0).toLocaleString()}</span></div>
              </div>

              <Link
                to={`/public/assets/${selected.publicId || selected.code}`}
                target="_blank"
                className="block w-full rounded-2xl bg-ink-900 hover:bg-ink-850 px-4 py-2.5 text-center text-xs font-bold text-white dark:bg-white dark:text-ink-900"
              >
                Open public page / Report issue
              </Link>

              {/* Complaint timeline for this equipment */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">Complaints on this equipment</h3>
                <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
                  {recentIssues.map((issue) => (
                    <div key={issue.issueNumber} className="rounded-2xl border border-slate-100 bg-white/50 p-3 dark:border-slate-800 dark:bg-slate-950/20">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{issue.title}</p>
                        <StatusBadge value={issue.status} />
                      </div>
                      <StatusProgress status={issue.status} compact />
                      <p className="mt-1.5 text-[9px] text-slate-400 font-semibold">{issue.issueNumber} · {new Date(issue.createdAt).toLocaleDateString()}</p>
                    </div>
                  ))}
                  {recentIssues.length === 0 ? <p className="text-[11px] text-slate-400 italic py-2">No complaints reported yet.</p> : null}
                </div>
              </div>

              {/* Full history timeline */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">Service & activity history</h3>
                <div className="space-y-3.5 max-h-[240px] overflow-y-auto pr-1">
                  {history.map((log) => (
                    <div key={log._id} className="relative pl-5 pb-1 border-l border-slate-200 dark:border-slate-800">
                      <span className="absolute left-0 top-1 h-2 w-2 rounded-full bg-ink-500 ring-4 ring-white dark:ring-slate-900 -translate-x-[4.5px]" />
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{log.action}</p>
                      {log.details ? <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{log.details}</p> : null}
                      <p className="text-[9px] text-slate-400/80 mt-0.5 font-medium">{new Date(log.createdAt).toLocaleString()} · {log.actorName || 'System'}</p>
                    </div>
                  ))}
                  {history.length === 0 ? <p className="text-[11px] text-slate-400 italic py-2">No history entries yet.</p> : null}
                </div>
              </div>
            </div>
          ) : null}
      </Modal>
    </div>
  );
}
