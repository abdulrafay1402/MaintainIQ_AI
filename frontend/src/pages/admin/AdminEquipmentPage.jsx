import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import toast from 'react-hot-toast';
import api from '../../api';
import StatusBadge from '../../components/StatusBadge';

export default function AdminEquipmentPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [qrValue, setQrValue] = useState('');
  const [editingAssetId, setEditingAssetId] = useState(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [technicianFilter, setTechnicianFilter] = useState('');
  const qrRef = useRef(null);

  const { register, handleSubmit, reset, setValue, formState: { isSubmitting, errors } } = useForm({
    defaultValues: { name: '', code: '', category: '', location: '', building: '', floor: '', roomNumber: '', condition: 'Good', status: 'Operational', serialNumber: '', assignedTechnician: '', purchaseDate: '', lastServiceDate: '', nextServiceDate: '', notes: '' },
  });

  const { data: assets = [] } = useQuery({
    queryKey: ['assets', search, categoryFilter, statusFilter, locationFilter, technicianFilter],
    queryFn: async () => {
      const params = {};
      if (search) params.search = search;
      if (categoryFilter) params.category = categoryFilter;
      if (statusFilter) params.status = statusFilter;
      if (locationFilter) params.location = locationFilter;
      if (technicianFilter) params.assignedTechnician = technicianFilter;
      const response = await api.get('/assets', { params });
      return response.data.assets;
    },
  });

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
      setSelectedAsset(data.asset);
      setQrValue(data.publicUrl);
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      reset();
    },
    onError: (error) => toast.error(error?.response?.data?.message || 'Failed to create equipment'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }) => (await api.patch(`/assets/${id}`, payload)).data,
    onSuccess: (data) => {
      toast.success('Equipment details updated');
      setSelectedAsset(data.asset);
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setEditingAssetId(null);
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

  const onSubmitForm = (values) => {
    const payload = { ...values };
    ['purchaseDate', 'lastServiceDate', 'nextServiceDate'].forEach((key) => {
      if (!payload[key]) delete payload[key];
    });
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
    setValue('lastServiceDate', asset.lastServiceDate ? asset.lastServiceDate.slice(0, 10) : '');
    setValue('nextServiceDate', asset.nextServiceDate ? asset.nextServiceDate.slice(0, 10) : '');
    setValue('notes', asset.notes || '');
  };

  const publicIdentifier = (asset) => asset?.publicId || asset?.code;

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-white transition cursor-pointer">
          <span>←</span> <span>Back</span>
        </button>
      </div>

      {/* Main Banner */}
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/70 p-6 shadow-soft backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-ink-500 font-display">Equipment module</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white font-display">Register Equipment & Generate QR</h1>
      </section>

      {/* Grid: Form & Preview */}
      <div className="grid gap-6 lg:grid-cols-2">
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
                  <input type="date" className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200" {...register('purchaseDate')} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Last Service</label>
                  <input type="date" className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200" {...register('lastServiceDate')} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Next Service Due</label>
                  <input type="date" className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200" {...register('nextServiceDate')} />
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
                
                {/* QR Canvas Display */}
                {qrValue ? (
                  <div className="flex justify-center p-4 bg-white dark:bg-slate-950 rounded-3xl border border-slate-150/60 dark:border-slate-800 max-w-[210px] mx-auto">
                    <div ref={qrRef} className="p-1 rounded-xl">
                      <QRCodeCanvas value={qrValue} size={160} includeMargin />
                    </div>
                  </div>
                ) : null}

                {/* Badges */}
                <div className="flex gap-2">
                  <StatusBadge value={selectedAsset.status} />
                  <StatusBadge value={selectedAsset.condition} />
                </div>

                {/* Details Table */}
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

                {/* Audit log timeline */}
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

                {/* Action Buttons Panel */}
                <div className="flex flex-wrap gap-2 pt-2">
                  <button onClick={copyLink} className="rounded-xl border border-slate-200 hover:bg-slate-50 px-3 py-2 text-xs font-semibold dark:border-slate-800 dark:hover:bg-slate-900 cursor-pointer">Copy Link</button>
                  <button onClick={downloadQr} className="rounded-xl border border-slate-200 hover:bg-slate-50 px-3 py-2 text-xs font-semibold dark:border-slate-800 dark:hover:bg-slate-900 cursor-pointer">Download QR</button>
                  <Link to={`/admin/equipment/${selectedAsset._id}/label`} className="rounded-xl border border-slate-200 hover:bg-slate-50 px-3 py-2 text-xs font-semibold dark:border-slate-800 dark:hover:bg-slate-900 text-center cursor-pointer">Print Label</Link>
                  <a className="rounded-xl border border-slate-200 hover:bg-slate-50 px-3 py-2 text-xs font-semibold dark:border-slate-800 dark:hover:bg-slate-900 text-center cursor-pointer" href={`/public/assets/${publicIdentifier(selectedAsset)}`} target="_blank" rel="noreferrer">Public Page</a>
                  <button onClick={() => startEdit(selectedAsset)} className="rounded-xl bg-ink-900 hover:bg-ink-850 px-4 py-2 text-xs font-bold text-white dark:bg-white dark:text-ink-900 dark:hover:bg-slate-100 cursor-pointer">Edit details</button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic py-10 text-center">Select an asset from the table below to configure its QR codes and view logs.</p>
            )}
          </div>
        </section>
      </div>

      {/* Equipment List Table Section */}
      <section className="rounded-[2rem] border border-slate-200/80 bg-white/70 p-6 shadow-soft backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display">Registered Inventory</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Browse, search, and filter assets</p>
          </div>
          <button onClick={openLabelSheet} className="rounded-2xl border border-slate-200 hover:bg-slate-50 px-4 py-2 text-xs font-bold dark:border-slate-800 dark:hover:bg-slate-900 cursor-pointer">
            Bulk QR label sheet ({filteredAssets.length})
          </button>
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
        
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <select value={conditionFilter} onChange={(e) => setConditionFilter(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200">
              <option value="">All conditions</option>
              {['Good', 'Fair', 'Poor'].map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            {(search || categoryFilter || statusFilter || conditionFilter || locationFilter || technicianFilter) ? (
              <button onClick={() => { setSearch(''); setCategoryFilter(''); setStatusFilter(''); setConditionFilter(''); setLocationFilter(''); setTechnicianFilter(''); }} className="text-xs font-bold text-ink-600 hover:text-ink-700 underline decoration-ink-300 underline-offset-4 dark:text-ink-300 cursor-pointer">Clear filters</button>
            ) : null}
          </div>
        </div>

        {/* Assets List Table */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-white/40 dark:border-slate-800 dark:bg-slate-900/10">
          <table className="min-w-full divide-y divide-slate-100 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 text-left text-slate-400 dark:bg-slate-950 dark:text-slate-500">
              <tr>
                <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">Name</th>
                <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">Code</th>
                <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">Location</th>
                <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
              {filteredAssets.map((asset) => (
                <tr 
                  key={asset._id} 
                  className={`cursor-pointer transition-colors ${selectedAsset?._id === asset._id ? 'bg-ink-50/30 dark:bg-slate-850/50' : 'hover:bg-slate-50/40 dark:hover:bg-slate-900/10'}`} 
                  onClick={() => { setSelectedAsset(asset); setQrValue(`${window.location.origin}/public/assets/${asset.publicId || asset.code}`); }}
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
      </section>
    </div>
  );
}
