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

  return (
    <div className="space-y-6">
      {/* Banner */}
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/70 p-6 shadow-soft backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-ink-500 font-display">QR Scanner</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white font-display">Scan Equipment Code</h1>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-normal font-semibold">Enable your device camera to scan code labels and view active equipment details.</p>
      </section>

      {/* Camera box */}
      <section className="rounded-[2rem] border border-slate-200/80 bg-white/70 p-6 shadow-soft backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display mb-4">Camera scanner viewfinder</h2>
        <div className="max-w-[450px] mx-auto rounded-3xl overflow-hidden border border-slate-100 dark:border-slate-800 shadow-soft">
          <ScannerWidget onScan={handleScan} />
        </div>
      </section>

      {/* Manual input */}
      <section className="rounded-[2rem] border border-slate-200/80 bg-white/70 p-6 shadow-soft backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/60">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display">Enter equipment code manually</h2>
        <p className="text-xs text-slate-450 dark:text-slate-500 font-semibold mt-1">If your camera viewfinder is disabled or unavailable, type the asset code (e.g. AST-PROJ-001) manually.</p>
        
        <form onSubmit={handleManualSubmit} className="mt-5 flex flex-col sm:flex-row gap-3">
          <input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="e.g. AST-PROJ-001"
            className="flex-1 rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 text-sm outline-none focus:border-ink-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200"
            required
          />
          <button
            type="submit"
            className="rounded-2xl bg-ink-900 hover:bg-ink-850 px-6 py-3.5 text-sm font-bold text-white transition-all shadow dark:bg-white dark:text-ink-900 dark:hover:bg-slate-100 cursor-pointer"
          >
            Retrieve Asset details
          </button>
        </form>
      </section>
    </div>
  );
}
