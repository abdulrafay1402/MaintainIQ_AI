import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export default function ScannerWidget({ onScan }) {
  const regionId = 'qr-reader';
  const [error, setError] = useState('');

  // The latest onScan lives in a ref so the effect never depends on the
  // callback's identity — otherwise every parent re-render (e.g. typing in the
  // manual-code input) would tear down and restart the camera.
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    const scanner = new Html5Qrcode(regionId);

    const startPromise = scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        async (decodedText) => {
          try {
            await scanner.stop();
          } catch {
            // Already stopped — safe to ignore.
          }
          onScanRef.current(decodedText);
        },
        () => {}
      )
      .catch((scanError) => {
        setError(scanError?.message || 'Unable to start scanner');
      });

    return () => {
      // Wait for start() to settle before stopping, so a StrictMode
      // double-mount can't leave an orphaned camera stream running.
      startPromise.then(() => {
        if (scanner.isScanning) {
          scanner.stop().catch(() => {});
        }
      });
    };
  }, []);

  return <div className="space-y-3">
    <div id={regionId} className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950" />
    {error ? <p className="text-sm text-rose-600">{error}</p> : <p className="text-sm text-slate-500 dark:text-slate-400">Allow camera access and scan a QR code.</p>}
  </div>;
}
