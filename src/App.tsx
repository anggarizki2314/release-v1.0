import { useEffect, useState } from 'react';
import AppShell from './components/layout/AppShell';
import ErrorBoundary from './components/common/ErrorBoundary';
import LicenseGateModal from './features/license/LicenseGateModal';

export default function App() {
  const [isLicensed, setIsLicensed] = useState<boolean | null>(null);
  const [hwid, setHwid] = useState<string>('');

  useEffect(() => {
    const handleErr = (e: ErrorEvent) => {
      console.error('[FORENSIC STEP 7] UNCAUGHT WINDOW ERROR:', e.error || e.message, e);
    };
    const handleRejection = (e: PromiseRejectionEvent) => {
      console.error('[FORENSIC STEP 7] UNHANDLED PROMISE REJECTION:', e.reason, e);
    };
    window.addEventListener('error', handleErr);
    window.addEventListener('unhandledrejection', handleRejection);

    // License Verification Check
    if ((window as any).forexReplay?.checkLicense) {
      (window as any).forexReplay
        .checkLicense()
        .then((res: any) => {
          if (res?.hwid) setHwid(res.hwid);
          setIsLicensed(!!res?.isLicensed);
        })
        .catch(() => {
          setIsLicensed(false);
        });
    } else {
      // In browser/dev standalone fallback
      setIsLicensed(true);
    }

    return () => {
      window.removeEventListener('error', handleErr);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return (
    <ErrorBoundary>
      {isLicensed === false && (
        <LicenseGateModal
          initialHwid={hwid}
          onActivated={() => setIsLicensed(true)}
        />
      )}
      <AppShell />
    </ErrorBoundary>
  );
}

