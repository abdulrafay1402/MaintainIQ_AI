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

  return <div className="space-y-6">
    <div className="flex items-center justify-between">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition cursor-pointer">
        <span>←</span> <span>Back</span>
      </button>
    </div>

    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-ink-500">Equipment module</p>
      <h1 className="mt-2 text-3xl font-semibold">Register equipment and generate QR</h1>
    </section>

    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-semibold">{editingAssetId ? 'Edit equipment' : 'Add equipment'}</h2>
        <form className="mt-5 grid gap-4" onSubmit={handleSubmit(onSubmitForm)}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <input className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-ink-500 dark:border-slate-800 dark:bg-slate-950" placeholder="Equipment name" {...register('name', { required: 'Name is required' })} />
              {errors.name ? <p className="mt-1 text-xs text-rose-600">{errors.name.message}</p> : null}
            </div>
            <div>
              <input className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-ink-500 dark:border-slate-800 dark:bg-slate-950" placeholder="Equipment code (e.g., AST-PROJ-999)" {...register('code', { required: 'Equipment code is required' })} />
              {errors.code ? <p className="mt-1 text-xs text-rose-600">{errors.code.message}</p> : null}
            </div>
            <div>
              <select className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-ink-500 dark:border-slate-800 dark:bg-slate-950 text-slate-700 dark:text-slate-200" {...register('category', { required: 'Category is required' })}>
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
              <input className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-ink-500 dark:border-slate-800 dark:bg-slate-950" placeholder="Location" {...register('location', { required: 'Location is required' })} />
              {errors.location ? <p className="mt-1 text-xs text-rose-600">{errors.location.message}</p> : null}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <select className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950" {...register('condition')}>
              <option>Good</option>
              <option>Fair</option>
              <option>Poor</option>
            </select>
            <select className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950" {...register('status')}>
              <option>Operational</option>
              <option>Issue Reported</option>
              <option>Under Inspection</option>
              <option>Under Maintenance</option>
              <option>Out of Service</option>
              <option>Retired</option>
            </select>
            <input className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950" placeholder="Serial number" {...register('serialNumber')} />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <input className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950" placeholder="Building (optional)" {...register('building')} />
            <input className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950" placeholder="Floor (optional)" {...register('floor')} />
            <input className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950" placeholder="Room number (optional)" {...register('roomNumber')} />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="grid gap-1 text-xs font-medium text-slate-500">Purchase date
              <input type="date" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200" {...register('purchaseDate')} />
            </label>
            <label className="grid gap-1 text-xs font-medium text-slate-500">Last service date
              <input type="date" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200" {...register('lastServiceDate')} />
            </label>
            <label className="grid gap-1 text-xs font-medium text-slate-500">Next service date
              <input type="date" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200" {...register('nextServiceDate')} />
            </label>
          </div>
          <label className="grid gap-1 text-xs font-medium text-slate-500">Assigned technician (optional)
            <select className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200" {...register('assignedTechnician')}>
              <option value="">No default technician</option>
              {technicians.map((tech) => <option key={tech._id} value={tech._id}>{tech.name} ({tech.email})</option>)}
            </select>
          </label>
          <textarea className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950" rows={4} placeholder="Notes" {...register('notes')} />
          <div className="flex gap-3">
            <button disabled={isSubmitting || createMutation.isPending || updateMutation.isPending} className="flex-1 rounded-2xl bg-ink-900 px-4 py-3 font-medium text-white dark:bg-white dark:text-ink-900">
              {isSubmitting || createMutation.isPending || updateMutation.isPending ? 'Saving...' : editingAssetId ? 'Save details' : 'Create equipment'}
            </button>
            {editingAssetId && (
              <button type="button" onClick={() => { setEditingAssetId(null); reset(); }} className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-semibold">QR preview & Metadata</h2>
        {selectedAsset ? <div className="mt-5 space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950">
            <p className="text-sm text-slate-500">{selectedAsset.code}</p>
            <h3 className="text-2xl font-semibold">{selectedAsset.name}</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{selectedAsset.location}</p>
          </div>
          {qrValue ? <div ref={qrRef} className="rounded-3xl border border-slate-200 p-5 dark:border-slate-800">
            <QRCodeCanvas value={qrValue} size={180} includeMargin />
          </div> : null}
          <div className="flex flex-wrap gap-3">
            <button onClick={copyLink} className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">Copy public link</button>
            <button onClick={downloadQr} className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">Download QR</button>
            <Link to={`/admin/equipment/${selectedAsset._id}/label`} className="rounded-2xl border border-slate-200 px-4 py-3 text-center dark:border-slate-800">Print label</Link>
            <a className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800 text-center" href={`/public/assets/${publicIdentifier(selectedAsset)}`} target="_blank" rel="noreferrer">Open public page</a>
            <button onClick={() => startEdit(selectedAsset)} className="rounded-2xl bg-ink-900 text-white px-4 py-3 dark:bg-white dark:text-ink-900 font-medium">Edit details</button>
          </div>
          <div className="flex items-center justify-between">
            <StatusBadge value={selectedAsset.status} />
            <StatusBadge value={selectedAsset.condition} />
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-950 p-4 rounded-3xl border border-slate-200 dark:border-slate-800">
            <div>
              <span className="text-slate-400 block mb-0.5">Category</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedAsset.category || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Serial Number</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedAsset.serialNumber || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Last Serviced</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedAsset.lastServiceDate ? new Date(selectedAsset.lastServiceDate).toLocaleDateString() : 'Never'}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Next Service Due</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedAsset.nextServiceDate ? new Date(selectedAsset.nextServiceDate).toLocaleDateString() : 'N/A'}</span>
            </div>
            {selectedAsset.assignedTechnician && (
              <div className="col-span-2 border-t border-slate-200 dark:border-slate-800 pt-2 mt-1">
                <span className="text-slate-400 block mb-0.5">Assigned Technician</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedAsset.assignedTechnician.name} ({selectedAsset.assignedTechnician.email})</span>
              </div>
            )}
          </div>

          <div className="mt-6 border-t border-slate-200 pt-6 dark:border-slate-800">
            <h3 className="text-lg font-semibold">Service History & Audit Logs</h3>
            {history.length > 0 ? (
              <div className="mt-4 space-y-4 max-h-[250px] overflow-y-auto pr-2">
                {history.map((log) => (
                  <div key={log._id} className="relative pl-6 pb-2 last:pb-0 border-l border-slate-200 dark:border-slate-800">
                    <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-ink-900 ring-4 ring-white dark:bg-white dark:ring-slate-900 -translate-x-[4.5px]" />
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{log.action}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{log.details}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {new Date(log.createdAt).toLocaleString()} · {log.actorName || log.actor?.name || 'System'}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">No logs or history recorded for this asset yet.</p>
            )}
          </div>
        </div> : <p className="mt-4 text-slate-500 dark:text-slate-400">Select a registered asset to preview its QR code and audit logs.</p>}
      </section>
    </div>

    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Equipment list</h2>
        <button onClick={openLabelSheet} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium dark:border-slate-800">Bulk QR label sheet ({filteredAssets.length})</button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, code, category..." className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-950 md:col-span-3 xl:col-span-2" />
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
          <option value="">All categories</option>
          {['Electronics / IT', 'Electrical', 'HVAC / Air Conditioning', 'Plumbing', 'Mechanical / Furniture', 'Safety & Security', 'Lab Equipment'].map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
          <option value="">All statuses</option>
          {['Operational', 'Issue Reported', 'Under Inspection', 'Under Maintenance', 'Out of Service', 'Retired', 'Faulty'].map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <input value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} placeholder="Filter by location" className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-800 dark:bg-slate-950" />
        <select value={technicianFilter} onChange={(e) => setTechnicianFilter(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
          <option value="">All technicians</option>
          <option value="unassigned">Unassigned</option>
          {technicians.map((tech) => <option key={tech._id} value={tech._id}>{tech.name}</option>)}
        </select>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <select value={conditionFilter} onChange={(e) => setConditionFilter(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
          <option value="">All conditions</option>
          {['Good', 'Fair', 'Poor'].map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        {(search || categoryFilter || statusFilter || conditionFilter || locationFilter || technicianFilter) ? (
          <button onClick={() => { setSearch(''); setCategoryFilter(''); setStatusFilter(''); setConditionFilter(''); setLocationFilter(''); setTechnicianFilter(''); }} className="text-xs font-medium text-slate-500 underline underline-offset-4">Clear filters</button>
        ) : null}
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
          <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-950 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {filteredAssets.map((asset) => <tr key={asset._id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-950" onClick={() => { setSelectedAsset(asset); setQrValue(`${window.location.origin}/public/assets/${asset.publicId || asset.code}`); }}>
              <td className="px-4 py-3 font-medium">{asset.name}</td>
              <td className="px-4 py-3">{asset.code}</td>
              <td className="px-4 py-3">{asset.location}</td>
              <td className="px-4 py-3"><StatusBadge value={asset.status} /></td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </section>
  </div>;
}
