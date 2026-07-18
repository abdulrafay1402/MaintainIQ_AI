import { useEffect, useMemo, useRef, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import toast from 'react-hot-toast';
import api from '../../api';
import BackButton from '../../components/BackButton';
import Modal from '../../components/Modal';
import Pagination from '../../components/Pagination';
import SkeletonCards from '../../components/SkeletonCards';
import StatusBadge from '../../components/StatusBadge';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import usePagination from '../../hooks/usePagination';
import exportCsv from '../../utils/exportCsv';

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function AdminEquipmentPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedAssetSnapshot, setSelectedAssetSnapshot] = useState(null);
  const [editingAssetId, setEditingAssetId] = useState(null);
  const [activeTab, setActiveTab] = useState('list'); // 'list' or 'add'
  const [viewMode, setViewMode] = useState('cards'); // cards by default, list optional
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [aiReport, setAiReport] = useState(null);
  const [aiReportLoading, setAiReportLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [technicianFilter, setTechnicianFilter] = useState('');
  const [sortOption, setSortOption] = useState('newest');
  const debouncedSearch = useDebouncedValue(search);
  const debouncedLocation = useDebouncedValue(locationFilter);
  const qrRef = useRef(null);

  const { register, handleSubmit, reset, setValue, formState: { isSubmitting, errors } } = useForm({
    defaultValues: { name: '', code: '', category: '', location: '', building: '', floor: '', roomNumber: '', condition: 'Good', status: 'Operational', serialNumber: '', assignedTechnician: '', purchaseDate: '', purchaseCost: '', lastServiceDate: '', nextServiceDate: '', notes: '' },
  });

  const { data: assets = [], isError: assetsError, isLoading: assetsLoading } = useQuery({
    queryKey: ['assets', debouncedSearch, categoryFilter, statusFilter, debouncedLocation, technicianFilter, sortOption],
    queryFn: async () => {
      const params = { sort: sortOption };
      if (debouncedSearch) params.search = debouncedSearch;
      if (categoryFilter) params.category = categoryFilter;
      if (statusFilter) params.status = statusFilter;
      if (debouncedLocation) params.location = debouncedLocation;
      if (technicianFilter) params.assignedTechnician = technicianFilter;
      const response = await api.get('/assets', { params });
      return response.data.assets;
    },
    placeholderData: keepPreviousData,
  });

  // Always resolve the selected asset from the freshest list so mutations
  // (edit, status changes) are reflected without re-clicking the row.
  const selectedAsset = useMemo(() => {
    if (!selectedAssetSnapshot) return null;
    return assets.find((asset) => asset._id === selectedAssetSnapshot._id) || selectedAssetSnapshot;
  }, [assets, selectedAssetSnapshot]);

  // The QR payload is always built from the live frontend origin, so downloaded
  // codes and labels open the deployed site (never a stale CLIENT_URL/localhost).
  const qrValue = selectedAsset ? `${window.location.origin}/public/assets/${selectedAsset.publicId || selectedAsset.code}` : '';

  // Reset the AI report when switching assets.
  useEffect(() => {
    setAiReport(null);
  }, [selectedAsset?._id]);

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: async () => (await api.get('/users/technicians')).data.technicians,
  });

  const assetId = selectedAsset?._id;
  const { data: history = [] } = useQuery({
    queryKey: ['asset-history', assetId],
    queryFn: async () => {
      if (!assetId) return [];
      const response = await api.get(`/history/asset/${assetId}`);
      return response.data.history;
    },
    enabled: !!assetId,
  });

  const createMutation = useMutation({
    mutationFn: async (values) => (await api.post('/assets', values)).data,
    onSuccess: (data) => {
      toast.success('Equipment created');
      setSelectedAssetSnapshot(data.asset);
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setActiveTab('list');
      setDetailModalOpen(true);
      reset();
    },
    onError: (error) => toast.error(error?.response?.data?.message || 'Failed to create equipment'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }) => (await api.patch(`/assets/${id}`, payload)).data,
    onSuccess: (data) => {
      toast.success('Equipment details updated');
      setSelectedAssetSnapshot(data.asset);
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setEditingAssetId(null);
      setActiveTab('list');
      reset();
    },
    onError: (error) => toast.error(error?.response?.data?.message || 'Failed to update equipment'),
  });

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      if (conditionFilter && asset.condition !== conditionFilter) return false;
      return true;
    });
  }, [assets, conditionFilter]);

  const pagination = usePagination(filteredAssets, 6);

  const onSubmitForm = (values) => {
    const payload = { ...values };
    ['purchaseDate', 'lastServiceDate', 'nextServiceDate', 'purchaseCost'].forEach((key) => {
      if (payload[key] === '' || payload[key] === undefined || payload[key] === null) delete payload[key];
    });

    // Date rules (backend enforces the same): services can't be logged in the
    // future, and the next service must be today or later — never a passed date.
    const today = todayISO();
    if (payload.purchaseDate && payload.purchaseDate > today) {
      toast.error('Purchase date cannot be in the future');
      return;
    }
    if (payload.lastServiceDate && payload.lastServiceDate > today) {
      toast.error('Last service date cannot be in the future');
      return;
    }
    if (payload.nextServiceDate && payload.nextServiceDate < today) {
      toast.error('Next service date must be today or a future date — yeh date guzar chuki hai');
      return;
    }
    if (payload.lastServiceDate && payload.nextServiceDate && payload.nextServiceDate < payload.lastServiceDate) {
      toast.error('Next service date cannot be before the last service date');
      return;
    }
    if (!payload.assignedTechnician) {
      payload.assignedTechnician = null;
    }
    if (editingAssetId) {
      updateMutation.mutate({ id: editingAssetId, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const startEdit = (asset) => {
    setEditingAssetId(asset._id);
    setDetailModalOpen(false);
    setActiveTab('add');
    setValue('name', asset.name || '');
    setValue('code', asset.code || '');
    setValue('category', asset.category || '');
    setValue('location', asset.location || '');
    setValue('condition', asset.condition || 'Good');
    setValue('status', asset.status || 'Operational');
    setValue('serialNumber', asset.serialNumber || '');
    setValue('building', asset.building || '');
    setValue('floor', asset.floor || '');
    setValue('roomNumber', asset.roomNumber || '');
    setValue('assignedTechnician', asset.assignedTechnician?._id || asset.assignedTechnician || '');
    setValue('purchaseDate', asset.purchaseDate ? asset.purchaseDate.slice(0, 10) : '');
    setValue('purchaseCost', asset.purchaseCost ?? '');
    setValue('lastServiceDate', asset.lastServiceDate ? asset.lastServiceDate.slice(0, 10) : '');
    setValue('nextServiceDate', asset.nextServiceDate ? asset.nextServiceDate.slice(0, 10) : '');
    setValue('notes', asset.notes || '');
  };

  const publicIdentifier = (asset) => asset?.publicId || asset?.code;

  // On-demand AI Asset Health Report (Gemini analyzes this asset's history).
  const generateAiReport = async () => {
    if (!selectedAsset) return;
    setAiReportLoading(true);
    setAiReport(null);
    try {
      const response = await api.get(`/assets/${selectedAsset._id}/ai-report`);
      setAiReport(response.data);
    } catch (error) {
      setAiReport({ available: false, message: error?.response?.data?.message || 'Could not reach the AI service.' });
    } finally {
      setAiReportLoading(false);
    }
  };

  const copyLink = async () => {
    if (!selectedAsset) return;
    await navigator.clipboard.writeText(`${window.location.origin}/public/assets/${publicIdentifier(selectedAsset)}`);
    toast.success('Public link copied');
  };

  const downloadQr = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas || !selectedAsset) return;
    const link = document.createElement('a');
    link.download = `${selectedAsset.code}-qr.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast.success('QR downloaded');
  };

  const openLabelSheet = () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (categoryFilter) params.set('category', categoryFilter);
    if (statusFilter) params.set('status', statusFilter);
    if (locationFilter) params.set('location', locationFilter);
    if (technicianFilter) params.set('assignedTechnician', technicianFilter);
    navigate(`/admin/equipment/labels?${params.toString()}`);
  };

  const renderPreviewPanel = () => {
    return (
      <section className="rounded-[2rem] border border-slate-200/80 bg-white/70 p-6 shadow-soft backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60 flex flex-col justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white font-display mb-4">QR & Inventory Metadata</h2>
          {selectedAsset ? (
            <div className="space-y-4">
              <div className="rounded-3xl border border-slate-100 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-950/20">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">{selectedAsset.code}</p>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white font-display mt-0.5">{selectedAsset.name}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{selectedAsset.location}</p>
              </div>
              
              {qrValue ? (
                <div className="flex justify-center p-4 bg-white dark:bg-slate-950 rounded-3xl border border-slate-150/60 dark:border-slate-800 max-w-[210px] mx-auto">
                  <div ref={qrRef} className="p-1 rounded-xl">
                    <QRCodeCanvas value={qrValue} size={160} includeMargin />
                  </div>
                </div>
              ) : null}

              <div className="flex gap-2">
                <StatusBadge value={selectedAsset.status} />
                <StatusBadge value={selectedAsset.condition} />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50/50 dark:bg-slate-950/20 p-4 rounded-3xl border border-slate-150/60 dark:border-slate-800/50">
                <div>
                  <span className="text-slate-400 block mb-0.5 font-bold uppercase tracking-wider text-[9px]">Category</span>
                  <span className="font-semibold text-slate-850 dark:text-slate-200">{selectedAsset.category || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5 font-bold uppercase tracking-wider text-[9px]">Serial Number</span>
                  <span className="font-semibold text-slate-850 dark:text-slate-200">{selectedAsset.serialNumber || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5 font-bold uppercase tracking-wider text-[9px]">Last Serviced</span>
                  <span className="font-semibold text-slate-850 dark:text-slate-200">
                    {selectedAsset.lastServiceDate ? new Date(selectedAsset.lastServiceDate).toLocaleDateString() : 'Never'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5 font-bold uppercase tracking-wider text-[9px]">Next Service Due</span>
                  <span className="font-semibold text-slate-850 dark:text-slate-200">
                    {selectedAsset.nextServiceDate ? new Date(selectedAsset.nextServiceDate).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                {selectedAsset.assignedTechnician && (
                  <div className="col-span-2 border-t border-slate-150/60 dark:border-slate-800/50 pt-2 mt-1">
                    <span className="text-slate-400 block mb-0.5 font-bold uppercase tracking-wider text-[9px]">Assigned Tech</span>
                    <span className="font-semibold text-slate-850 dark:text-slate-200">
                      {selectedAsset.assignedTechnician.name} ({selectedAsset.assignedTechnician.email})
                    </span>
                  </div>
                )}
              </div>

              {/* Cost of ownership */}
              <div className="rounded-3xl border border-emerald-100 bg-emerald-50/30 p-4 dark:border-emerald-900/20 dark:bg-emerald-950/10 text-xs space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">💰 Cost of Ownership</p>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Purchase cost</span>
                  <span className="tabular-nums font-semibold">{selectedAsset.purchaseCost != null ? Number(selectedAsset.purchaseCost).toLocaleString() : '—'}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Maintenance spent till now</span>
                  <span className="tabular-nums font-semibold">{(selectedAsset.maintenanceSpend || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t border-emerald-200/50 dark:border-slate-800 pt-1.5 font-bold text-slate-800 dark:text-slate-200">
                  <span>Total cost till now</span>
                  <span className="text-emerald-700 dark:text-emerald-400 tabular-nums">{((Number(selectedAsset.purchaseCost) || 0) + (selectedAsset.maintenanceSpend || 0)).toLocaleString()}</span>
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-800 pt-4 mt-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">Service & Audit Timeline</h3>
                {history.length > 0 ? (
                  <div className="space-y-4 max-h-[170px] overflow-y-auto pr-1">
                    {history.map((log) => (
                      <div key={log._id} className="relative pl-6 pb-3 last:pb-0 border-l border-slate-200 dark:border-slate-850">
                        <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-ink-950 ring-4 ring-white dark:bg-white dark:ring-slate-900 -translate-x-[5.5px]" />
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-normal">{log.action}</p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{log.details}</p>
                        <p className="text-[9px] text-slate-400/80 mt-0.5 font-medium">
                          {new Date(log.createdAt).toLocaleString()} · {log.actorName || log.actor?.name || 'System'}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400/80 italic">No timeline items recorded yet.</p>
                )}
              </div>

              {/* AI Asset Health Report — Gemini analysis of this asset's history */}
              <div className="rounded-3xl border border-violet-200/60 bg-violet-50/20 p-4 dark:border-slate-800 dark:bg-slate-950/20">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-violet-700 dark:text-violet-400">✨ AI Health Report</span>
                  <button
                    onClick={generateAiReport}
                    disabled={aiReportLoading}
                    className="rounded-xl bg-ink-900 px-3 py-1.5 text-[10px] font-bold text-white dark:bg-white dark:text-ink-900 cursor-pointer disabled:opacity-50"
                  >
                    {aiReportLoading ? 'Analyzing…' : aiReport ? 'Regenerate' : 'Generate report'}
                  </button>
                </div>
                {aiReportLoading ? (
                  <div className="mt-3 space-y-2 animate-pulse">
                    <div className="h-2.5 w-3/4 rounded-full bg-slate-200/70 dark:bg-slate-800" />
                    <div className="h-2.5 w-1/2 rounded-full bg-slate-200/70 dark:bg-slate-800" />
                    <div className="h-2.5 w-2/3 rounded-full bg-slate-200/70 dark:bg-slate-800" />
                  </div>
                ) : aiReport ? (
                  aiReport.available ? (
                    <div className="mt-3 space-y-2.5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          aiReport.report.riskLevel === 'High' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                            : aiReport.report.riskLevel === 'Medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                        }`}>
                          Risk: {aiReport.report.riskLevel}
                        </span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{aiReport.report.summary}</p>
                      {aiReport.report.recurringPatterns ? (
                        <p className="rounded-xl bg-rose-50/60 border border-rose-100 p-2.5 text-[11px] text-rose-800 dark:bg-rose-950/20 dark:border-rose-900/20 dark:text-rose-300">
                          <strong>⚠ Recurring pattern:</strong> {aiReport.report.recurringPatterns}
                        </p>
                      ) : null}
                      {aiReport.report.recommendations?.length ? (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Preventive recommendations</p>
                          <ul className="list-disc pl-4 space-y-0.5 text-slate-600 dark:text-slate-400">
                            {aiReport.report.recommendations.map((rec, i) => <li key={i}>{rec}</li>)}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-3 text-[11px] font-semibold text-amber-700 dark:text-amber-400">{aiReport.message}</p>
                  )
                ) : (
                  <p className="mt-2 text-[11px] text-slate-400 italic">Gemini analyzes this asset's issue log and service history into a risk-rated health report.</p>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button onClick={copyLink} className="rounded-xl border border-slate-200 hover:bg-slate-50 px-3 py-2 text-xs font-semibold dark:border-slate-800 dark:hover:bg-slate-900 cursor-pointer">Copy Link</button>
                <button onClick={downloadQr} className="rounded-xl border border-slate-200 hover:bg-slate-50 px-3 py-2 text-xs font-semibold dark:border-slate-800 dark:hover:bg-slate-900 cursor-pointer">Download QR</button>
                <Link to={`/admin/equipment/${selectedAsset._id}/label`} className="rounded-xl border border-slate-200 hover:bg-slate-50 px-3 py-2 text-xs font-semibold dark:border-slate-800 dark:hover:bg-slate-900 text-center cursor-pointer">Print Label</Link>
                <a className="rounded-xl border border-slate-200 hover:bg-slate-50 px-3 py-2 text-xs font-semibold dark:border-slate-800 dark:hover:bg-slate-900 text-center cursor-pointer" href={`/public/assets/${publicIdentifier(selectedAsset)}`} target="_blank" rel="noreferrer">Public Page</a>
                <button onClick={() => startEdit(selectedAsset)} className="rounded-xl bg-ink-900 hover:bg-ink-850 px-4 py-2 text-xs font-bold text-white dark:bg-white dark:text-ink-900 dark:hover:bg-slate-100 cursor-pointer">Edit details</button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic py-10 text-center">Select an asset from the table to view its details, QR code, and service timeline.</p>
          )}
        </div>
      </section>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <BackButton />
      </div>

      {/* Main Banner */}
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/70 p-6 shadow-soft backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-ink-500 font-display">Equipment module</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white font-display">Register Equipment & Generate QR</h1>
      </section>

      {/* Segmented controls for responsive tabs */}
      <div className="flex rounded-2xl bg-slate-100/80 p-1 border border-slate-200/50 dark:bg-slate-950/40 dark:border-slate-800/80 max-w-md">
        <button
          type="button"
          onClick={() => setActiveTab('list')}
          className={`flex-1 text-center py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'list'
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
              : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-350'
          }`}
        >
          Equipment Register
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('add')}
          className={`flex-1 text-center py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'add'
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
              : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-350'
          }`}
        >
          {editingAssetId ? 'Edit Equipment' : 'Add Equipment'}
        </button>
      </div>

      {activeTab === 'add' ? (
        <div className="grid gap-6 lg:grid-cols-2 animate-fade-in">
          {/* Registration Form */}
          <section className="rounded-[2rem] border border-slate-200/80 bg-white/70 p-6 shadow-soft backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60 flex flex-col justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white font-display mb-4">
                {editingAssetId ? 'Edit equipment' : 'Add new equipment'}
              </h2>
              <form className="grid gap-4 text-sm" onSubmit={handleSubmit(onSubmitForm)}>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Equipment Name</label>
                    <input className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 outline-none focus:border-ink-500 dark:border-slate-800 dark:bg-slate-950/60" placeholder="e.g., Room 101 Projector" {...register('name', { required: 'Name is required' })} />
                    {errors.name ? <p className="mt-1 text-xs text-rose-600">{errors.name.message}</p> : null}
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Equipment Code</label>
                    <input className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 outline-none focus:border-ink-500 dark:border-slate-800 dark:bg-slate-950/60" placeholder="e.g., AST-PROJ-101" {...register('code', { required: 'Equipment code is required' })} />
                    {errors.code ? <p className="mt-1 text-xs text-rose-600">{errors.code.message}</p> : null}
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Category</label>
                    <select className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200" {...register('category', { required: 'Category is required' })}>
                      <option value="">Select Category</option>
                      <option value="Electronics / IT">Electronics / IT</option>
                      <option value="Electrical">Electrical</option>
                      <option value="HVAC / Air Conditioning">HVAC / Air Conditioning</option>
                      <option value="Plumbing">Plumbing</option>
                      <option value="Mechanical / Furniture">Mechanical / Furniture</option>
                      <option value="Safety & Security">Safety & Security</option>
                      <option value="Lab Equipment">Lab Equipment</option>
                    </select>
                    {errors.category ? <p className="mt-1 text-xs text-rose-600">{errors.category.message}</p> : null}
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Location Description</label>
                    <input className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 outline-none focus:border-ink-500 dark:border-slate-800 dark:bg-slate-950/60" placeholder="e.g., Wing B, Floor 2" {...register('location', { required: 'Location is required' })} />
                    {errors.location ? <p className="mt-1 text-xs text-rose-600">{errors.location.message}</p> : null}
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Condition</label>
                    <select className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200" {...register('condition')}>
                      <option>Good</option>
                      <option>Fair</option>
                      <option>Poor</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Status</label>
                    <select className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200" {...register('status')}>
                      <option>Operational</option>
                      <option>Issue Reported</option>
                      <option>Under Inspection</option>
                      <option>Under Maintenance</option>
                      <option>Out of Service</option>
                      <option>Retired</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Serial Number</label>
                    <input className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60" placeholder="S/N" {...register('serialNumber')} />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Building</label>
                    <input className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60" placeholder="e.g., Block 2" {...register('building')} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Floor</label>
                    <input className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60" placeholder="e.g., 2nd Floor" {...register('floor')} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Room Number</label>
                    <input className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60" placeholder="e.g., 204" {...register('roomNumber')} />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Purchase Date</label>
                    <input type="date" max={todayISO()} className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200" {...register('purchaseDate')} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Purchase Cost</label>
                    <input type="number" min="0" step="1" placeholder="e.g. 85000" className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60" {...register('purchaseCost', { min: { value: 0, message: 'Cost cannot be negative' } })} />
                    {errors.purchaseCost ? <p className="mt-1 text-xs text-rose-600">{errors.purchaseCost.message}</p> : null}
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Last Service <span className="text-[8px] text-slate-400 normal-case">(today or earlier)</span></label>
                    <input type="date" max={todayISO()} className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200" {...register('lastServiceDate')} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Next Service Due <span className="text-[8px] text-slate-400 normal-case">(today or later)</span></label>
                    <input type="date" min={todayISO()} className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200" {...register('nextServiceDate')} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Assigned Maintenance Technician</label>
                  <select className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200" {...register('assignedTechnician')}>
                    <option value="">No default technician</option>
                    {technicians.map((tech) => <option key={tech._id} value={tech._id}>{tech.name} ({tech.email})</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Inventory Notes</label>
                  <textarea className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60" rows={3} placeholder="Provide any additional specifications, warranty info, etc..." {...register('notes')} />
                </div>
                <div className="flex gap-3 mt-2">
                  <button disabled={isSubmitting || createMutation.isPending || updateMutation.isPending} className="flex-1 rounded-2xl bg-ink-900 hover:bg-ink-850 py-3 font-semibold text-white transition-all shadow-md dark:bg-white dark:text-ink-900 dark:hover:bg-slate-100 cursor-pointer">
                    {isSubmitting || createMutation.isPending || updateMutation.isPending ? 'Saving...' : editingAssetId ? 'Save details' : 'Create equipment'}
                  </button>
                  {editingAssetId && (
                    <button type="button" onClick={() => { setEditingAssetId(null); reset(); }} className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer">
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
          </section>

          {/* Preview Panel */}
          {renderPreviewPanel()}
        </div>
      ) : (
        <div className="space-y-6 animate-fade-in">
          {/* Equipment List Table Section */}
          <section className="rounded-[2rem] border border-slate-200/80 bg-white/70 p-6 shadow-soft backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60">
            {assetsError ? (
              <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50/60 p-4 text-xs font-semibold text-rose-800 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-300">
                ⚠ Could not reach the server — the inventory below may be empty or stale. Make sure the backend is running (and VITE_API_URL points to it), then refresh.
              </div>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display">Registered Inventory</h2>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Browse, search, and filter assets</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => exportCsv('maintainiq-equipment.csv', filteredAssets.map((asset) => ({
                    Code: asset.code,
                    Name: asset.name,
                    Category: asset.category,
                    Location: asset.location,
                    Status: asset.status,
                    Condition: asset.condition,
                    'Purchase Cost': asset.purchaseCost ?? '',
                    'Maintenance Spend': asset.maintenanceSpend ?? 0,
                    'Last Service': asset.lastServiceDate ? new Date(asset.lastServiceDate).toLocaleDateString() : '',
                    'Next Service': asset.nextServiceDate ? new Date(asset.nextServiceDate).toLocaleDateString() : '',
                    Technician: asset.assignedTechnician?.name || '',
                  })))}
                  className="rounded-2xl border border-slate-200 hover:bg-slate-50 px-4 py-2 text-xs font-bold dark:border-slate-800 dark:hover:bg-slate-900 cursor-pointer"
                >
                  ⬇ Export CSV
                </button>
                <button onClick={openLabelSheet} className="rounded-2xl border border-slate-200 hover:bg-slate-50 px-4 py-2 text-xs font-bold dark:border-slate-800 dark:hover:bg-slate-900 cursor-pointer">
                  Bulk QR label sheet ({filteredAssets.length})
                </button>
              </div>
            </div>

            {/* Filters Panel */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, code..." className="rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-2 text-sm dark:border-slate-800 dark:bg-slate-950/60 sm:col-span-2" />
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200">
                <option value="">All categories</option>
                {['Electronics / IT', 'Electrical', 'HVAC / Air Conditioning', 'Plumbing', 'Mechanical / Furniture', 'Safety & Security', 'Lab Equipment'].map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200">
                <option value="">All statuses</option>
                {['Operational', 'Issue Reported', 'Under Inspection', 'Under Maintenance', 'Out of Service', 'Retired', 'Faulty'].map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <input value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} placeholder="Filter by location" className="rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-2 text-sm dark:border-slate-800 dark:bg-slate-950/60" />
              <select value={technicianFilter} onChange={(e) => setTechnicianFilter(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200">
                <option value="">All technicians</option>
                <option value="unassigned">Unassigned</option>
                {technicians.map((tech) => <option key={tech._id} value={tech._id}>{tech.name}</option>)}
              </select>
            </div>
            
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <select value={conditionFilter} onChange={(e) => setConditionFilter(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200">
                  <option value="">All conditions</option>
                  {['Good', 'Fair', 'Poor'].map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <select value={sortOption} onChange={(e) => setSortOption(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200">
                  <option value="newest">Sort: Newest first</option>
                  <option value="oldest">Sort: Oldest first</option>
                  <option value="name">Sort: Name A–Z</option>
                  <option value="name-desc">Sort: Name Z–A</option>
                  <option value="code">Sort: Code</option>
                  <option value="status">Sort: Status</option>
                  <option value="next-service">Sort: Next service due</option>
                </select>
                {(search || categoryFilter || statusFilter || conditionFilter || locationFilter || technicianFilter) ? (
                  <button onClick={() => { setSearch(''); setCategoryFilter(''); setStatusFilter(''); setConditionFilter(''); setLocationFilter(''); setTechnicianFilter(''); }} className="text-xs font-bold text-ink-600 hover:text-ink-700 underline decoration-ink-300 underline-offset-4 dark:text-ink-300 cursor-pointer">Clear filters</button>
                ) : null}
              </div>
              <div className="flex rounded-xl bg-slate-100/80 p-0.5 border border-slate-200/50 dark:bg-slate-950/40 dark:border-slate-800/80">
                {[['table', 'List'], ['cards', 'Cards']].map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      viewMode === mode
                        ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                        : 'text-slate-400 hover:text-slate-600 dark:text-slate-500'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {assetsLoading ? (
              <div className="mt-4"><SkeletonCards count={4} /></div>
            ) : viewMode === 'cards' ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {pagination.paged.map((asset) => (
                  <button
                    key={asset._id}
                    type="button"
                    onClick={() => { setSelectedAssetSnapshot(asset); setDetailModalOpen(true); }}
                    className={`text-left rounded-3xl border-2 p-6 transition-all cursor-pointer ${
                      selectedAsset?._id === asset._id
                        ? 'border-ink-500 bg-ink-50/40 dark:border-ink-500 dark:bg-slate-800/50'
                        : 'border-slate-200 bg-white/50 hover:border-ink-400 dark:border-slate-800 dark:bg-slate-900/10 dark:hover:border-slate-700'
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
                      <span>{asset.nextServiceDate ? `Service: ${new Date(asset.nextServiceDate).toLocaleDateString()}` : 'No service due'}</span>
                    </div>
                  </button>
                ))}
                {filteredAssets.length === 0 ? (
                  <div className="col-span-full py-12 text-center">
                    <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-ink-500/10 text-2xl">📦</span>
                    <p className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-300">
                      {search || categoryFilter || statusFilter || conditionFilter || locationFilter || technicianFilter ? 'No assets match the current filters' : 'No equipment registered yet'}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {search || categoryFilter || statusFilter || conditionFilter || locationFilter || technicianFilter ? 'Try clearing a filter or two.' : 'Register your first asset to generate its QR identity.'}
                    </p>
                    {!(search || categoryFilter || statusFilter || conditionFilter || locationFilter || technicianFilter) ? (
                      <button onClick={() => setActiveTab('add')} className="mt-4 rounded-2xl bg-ink-500 px-5 py-2.5 text-xs font-bold text-white hover:opacity-90 cursor-pointer">
                        + Add Equipment
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-100 bg-white/40 dark:border-slate-800 dark:bg-slate-900/10">
              <table className="min-w-[560px] w-full divide-y divide-slate-100 text-sm dark:divide-slate-800">
                <thead className="bg-slate-50 text-left text-slate-400 dark:bg-slate-950 dark:text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">Name</th>
                    <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">Code</th>
                    <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">Location</th>
                    <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                  {pagination.paged.map((asset) => (
                    <tr
                      key={asset._id}
                      className={`cursor-pointer transition-colors ${selectedAsset?._id === asset._id ? 'bg-ink-50/30 dark:bg-slate-800/50' : 'hover:bg-slate-50/40 dark:hover:bg-slate-900/10'}`}
                      onClick={() => { setSelectedAssetSnapshot(asset); setDetailModalOpen(true); }}
                    >
                      <td className="px-4 py-3.5 font-bold text-slate-800 dark:text-slate-200">{asset.name}</td>
                      <td className="px-4 py-3.5 font-mono text-xs text-slate-500 dark:text-slate-400">{asset.code}</td>
                      <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400">{asset.location}</td>
                      <td className="px-4 py-3.5"><StatusBadge value={asset.status} /></td>
                    </tr>
                  ))}
                  {filteredAssets.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-xs text-slate-400">No assets matching the current filters.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            )}

            <Pagination {...pagination} />
          </section>
        </div>
      )}

      {/* Equipment detail modal: QR, metadata, costs, history, AI report */}
      <Modal
        open={detailModalOpen && !!selectedAsset && activeTab === 'list'}
        onClose={() => setDetailModalOpen(false)}
        title={selectedAsset?.name}
        subtitle={selectedAsset ? `${selectedAsset.code} · ${selectedAsset.category}` : ''}
        wide
      >
        {renderPreviewPanel()}
      </Modal>
    </div>
  );
}
