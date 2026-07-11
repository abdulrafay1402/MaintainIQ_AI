import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ScannerWidget from '../../components/ScannerWidget';

export default function StudentScanPage() {
  const navigate = useNavigate();
  const [manualCode, setManualCode] = useState('');

  const handleScan = (text) => {
    const code = text.split('/').filter(Boolean).pop();
    if (code) {
      navigate(`/public/assets/${code}`);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualCode.trim()) {
      navigate(`/public/assets/${manualCode.trim().toUpperCase()}`);
    }
  };

  return <div className="space-y-6">
    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-ink-500">QR scanner</p>
      <h1 className="mt-2 text-3xl font-semibold">Scan equipment QR code</h1>
      <p className="mt-2 text-slate-500 dark:text-slate-400">Use your camera to open the safe public asset page.</p>
    </section>

    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
      <ScannerWidget onScan={handleScan} />
    </section>

    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-xl font-semibold">Or enter asset code manually</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">If your camera is unavailable, type the equipment code (e.g. AST-PROJ-999) to open the page.</p>
      <form onSubmit={handleManualSubmit} className="mt-4 flex gap-3">
        <input
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          placeholder="Enter asset code (e.g., AST-PROJ-999)..."
          className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-ink-500 dark:border-slate-800 dark:bg-slate-950"
          required
        />
        <button
          type="submit"
          className="rounded-2xl bg-ink-900 px-6 py-3 font-medium text-white transition hover:opacity-95 dark:bg-white dark:text-ink-900"
        >
          Open Asset
        </button>
      </form>
    </section>
  </div>;
}
