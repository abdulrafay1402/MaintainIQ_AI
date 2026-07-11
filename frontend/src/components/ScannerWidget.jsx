import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export default function ScannerWidget({ onScan }) {
  const regionId = 'qr-reader';
  const scannerRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let scanner;

    const start = async () => {
      try {
        scanner = new Html5Qrcode(regionId);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          async (decodedText) => {
            await scanner.stop();
            onScan(decodedText);
          },
          () => {}
        );
      } catch (scanError) {
        setError(scanError.message || 'Unable to start scanner');
      }
    };

    start();

    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [onScan]);

  return <div className="space-y-3">
    <div id={regionId} className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950" />
    {error ? <p className="text-sm text-rose-600">{error}</p> : <p className="text-sm text-slate-500 dark:text-slate-400">Allow camera access and scan a QR code.</p>}
  </div>;
}
