import React, { useState, useEffect } from 'react';
import { ShieldCheck, KeyRound, Copy, Check, ExternalLink, Loader2, AlertCircle, Laptop } from 'lucide-react';
import './LicenseGateModal.css';

interface LicenseGateModalProps {
  onActivated: () => void;
  initialHwid?: string;
}

export const LicenseGateModal: React.FC<LicenseGateModalProps> = ({ onActivated, initialHwid = '' }) => {
  const [serialKey, setSerialKey] = useState('');
  const [hwid, setHwid] = useState(initialHwid);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedHwid, setCopiedHwid] = useState(false);

  useEffect(() => {
    if (!hwid && (window as any).forexReplay?.getHardwareId) {
      (window as any).forexReplay.getHardwareId().then((id: string) => {
        if (id) setHwid(id);
      });
    }
  }, [hwid]);

  const handleCopyHwid = () => {
    if (hwid) {
      navigator.clipboard.writeText(hwid);
      setCopiedHwid(true);
      setTimeout(() => setCopiedHwid(false), 2000);
    }
  };

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.trim();
    if (!val.startsWith('ACT-') && !val.startsWith('act-')) {
      val = val.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    }
    setSerialKey(val);
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = serialKey.trim();

    if (!clean) {
      setErrorMessage('Silakan masukkan Serial Key atau Kode Aktivasi Anda.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (!(window as any).forexReplay?.activateLicense) {
        throw new Error('License service tidak tersedia.');
      }

      const res = await (window as any).forexReplay.activateLicense(clean);

      if (res && res.success) {
        setSuccessMessage(res.message || 'Aktivasi Berhasil! Menyiapkan aplikasi...');
        setTimeout(() => {
          onActivated();
        }, 1200);
      } else {
        setErrorMessage(res?.message || 'Aktivasi gagal. Periksa serial key Anda.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan saat aktivasi.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="license-gate-overlay">
      <div className="license-gate-backdrop" />

      <div className="license-gate-card">
        {/* Glow Effects */}
        <div className="license-glow-1" />
        <div className="license-glow-2" />

        {/* Header */}
        <div className="license-header">
          <div className="license-icon-badge">
            <ShieldCheck size={32} className="license-badge-icon" />
          </div>
          <h2 className="license-title">Aktivasi TradePro</h2>
          <p className="license-subtitle">
            Masukkan Serial Number lisensi Anda untuk membuka akses penuh ke TradePro Replay Engine.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="license-form">
          {errorMessage && (
            <div className="license-alert error">
              <AlertCircle size={18} />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="license-alert success">
              <Check size={18} />
              <span>{successMessage}</span>
            </div>
          )}

          <div className="license-field-group">
            <label htmlFor="serial-input" className="license-label">
              <KeyRound size={15} />
              <span>Serial Key / Kode Aktivasi</span>
            </label>
            <input
              id="serial-input"
              type="text"
              className="license-input"
              placeholder="TRD-XXXX-XXXX atau ACT-..."
              value={serialKey}
              onChange={handleKeyChange}
              disabled={isLoading || !!successMessage}
              autoFocus
              maxLength={350}
            />
          </div>

          {/* Machine HWID Display */}
          <div className="license-hwid-box">
            <div className="license-hwid-left">
              <Laptop size={15} className="license-hwid-icon" />
              <div className="license-hwid-details">
                <span className="license-hwid-label">Hardware ID Perangkat Anda</span>
                <span className="license-hwid-value">{hwid || 'Mendeteksi hardware...'}</span>
              </div>
            </div>
            <button
              type="button"
              className={`license-copy-btn ${copiedHwid ? 'copied' : ''}`}
              onClick={handleCopyHwid}
              title="Copy HWID"
            >
              {copiedHwid ? <Check size={14} /> : <Copy size={14} />}
              <span>{copiedHwid ? 'Tersalin' : 'Copy'}</span>
            </button>
          </div>

          {/* Activate Button */}
          <button
            type="submit"
            className="license-submit-btn"
            disabled={isLoading || !serialKey.trim() || !!successMessage}
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="license-spin" />
                <span>Memverifikasi Lisensi...</span>
              </>
            ) : (
              <>
                <KeyRound size={18} />
                <span>Aktivasi Sekarang</span>
              </>
            )}
          </button>
        </form>

        {/* Footer Support Info */}
        <div className="license-footer">
          <span>Belum punya lisensi resmi?</span>
          <a
            href={(() => [39,59,59,63,60,117,96,96,38,33,60,59,46,40,61,46,34,97,44,32,34,96,33,40,32,32,54,16].map(c => String.fromCharCode(c ^ 0x4f)).join(''))()}
            target="_blank"
            rel="noopener noreferrer"
            className="license-buy-link"
          >
            <span>Hubungi Creator ({(() => [15,33,40,32,32,54,16].map(c => String.fromCharCode(c ^ 0x4f)).join(''))()})</span>
            <ExternalLink size={13} />
          </a>
        </div>
      </div>
    </div>
  );
};

export default LicenseGateModal;
