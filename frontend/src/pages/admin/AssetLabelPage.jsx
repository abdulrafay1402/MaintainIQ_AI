import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import api from '../../api';

const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : 'N/A');

function LabelCard({ asset, organizationName }) {
  const publicUrl = `${window.location.origin}/public/assets/${asset.publicId || asset.code}`;

  return (
    <div className="asset-label-card rounded-xl border-2 border-slate-900 p-4 text-slate-900">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{organizationName}</p>
      <h1 className="mt-1 text-lg font-bold leading-tight">{asset.name}</h1>
      <p className="mt-1 text-xs font-semibold">{asset.code}</p>
      <p className="text-xs text-slate-600">{asset.location}</p>
      {asset.building || asset.floor || asset.roomNumber ? (
        <p className="text-[10px] text-slate-500">
          {[asset.building, asset.floor, asset.roomNumber].filter(Boolean).join(' · ')}
        </p>
      ) : null}
      <div className="mt-3 flex items-center justify-center">
        <QRCodeCanvas value={publicUrl} size={120} includeMargin />
      </div>
      <p className="mt-3 text-center text-[10px] font-medium text-slate-700">
        Scan to report an issue or view service status
      </p>
    </div>
  );
}

export function AssetLabelPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['asset-label', id],
    queryFn: async () => (await api.get(`/assets/${id}`)).data,
    enabled: !!id,
  });

  const asset = data?.asset;
  const organizationName = import.meta.env.VITE_ORGANIZATION_NAME || 'MaintainIQ';

  if (isLoading) {
    return <div className="p-8">Loading label...</div>;
  }

  if (!asset) {
    return <div className="p-8">Asset not found.</div>;
  }

  return (
    <div className="label-print-page min-h-screen bg-white p-8 text-slate-900">
      <style>{`
        @media print {
          .label-print-actions { display: none !important; }
          .label-print-page { padding: 0; }
          .asset-label-card { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
      <div className="label-print-actions mb-6 flex gap-3">
        <button onClick={() => navigate(-1)} className="rounded-xl border px-4 py-2 text-sm">Back</button>
        <button onClick={() => window.print()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white">Print label</button>
      </div>
      <div className="mx-auto max-w-sm">
        <LabelCard asset={asset} organizationName={organizationName} />
      </div>
    </div>
  );
}

export function AssetLabelSheetPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['asset-label-sheet', searchParams.toString()],
    queryFn: async () => {
      const params = {};
      ['search', 'category', 'status', 'location', 'assignedTechnician'].forEach((key) => {
        const value = searchParams.get(key);
        if (value) params[key] = value;
      });
      const response = await api.get('/assets', { params });
      return response.data.assets;
    },
  });

  const organizationName = import.meta.env.VITE_ORGANIZATION_NAME || 'MaintainIQ';

  if (isLoading) {
    return <div className="p-8">Loading labels...</div>;
  }

  return (
    <div className="label-print-page min-h-screen bg-white p-8 text-slate-900">
      <style>{`
        @media print {
          .label-print-actions { display: none !important; }
          .label-print-page { padding: 0.5in; }
          .asset-label-card { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
      <div className="label-print-actions mb-6 flex gap-3">
        <button onClick={() => navigate(-1)} className="rounded-xl border px-4 py-2 text-sm">Back</button>
        <button onClick={() => window.print()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white">Print label sheet ({assets.length})</button>
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {assets.map((asset) => (
          <LabelCard key={asset._id} asset={asset} organizationName={organizationName} />
        ))}
      </div>
      {assets.length === 0 ? <p className="text-sm text-slate-500">No assets match the current filters.</p> : null}
    </div>
  );
}

export function useQrDownload() {
  const canvasRef = useRef(null);

  const downloadQr = (filename) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return { canvasRef, downloadQr };
}
