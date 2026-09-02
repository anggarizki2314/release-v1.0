import React, { useState, useEffect } from 'react';
import { Palette, Database, Keyboard, Info, Download, Upload, FolderOpen, Copy, Check, HardDrive, ShieldCheck, KeyRound, AlertTriangle } from 'lucide-react';
import AppearancePanel from '../appearance/AppearancePanel';
import { useTheme } from '../appearance/ThemeManager';
import { getDbInfo, openDataFolder } from '@features/database/api';
import type { DatabaseInfo } from '../../types';
import './SettingsView.css';

type SettingsTab = 'appearance' | 'database' | 'license' | 'hotkeys' | 'about';

export const SettingsView: React.FC = () => {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');
  const [dbInfo, setDbInfo] = useState<DatabaseInfo | null>(null);
  const [copiedPath, setCopiedPath] = useState(false);
  const [copiedHwid, setCopiedHwid] = useState(false);
  const [appVersion, setAppVersion] = useState<string>('3.2.7');
  const [licenseInfo, setLicenseInfo] = useState<{
    isLicensed: boolean;
    hwid?: string;
    serialKey?: string;
    activatedAt?: string;
    expiresAt?: string | null;
    plan?: string;
    planName?: string;
    message?: string;
  } | null>(null);

  useEffect(() => {
    getDbInfo().then(setDbInfo).catch((err) => console.error('[Settings] Failed to fetch db info:', err));
    window.forexReplay?.getVersion?.().then(setAppVersion).catch(() => {});
    window.forexReplay?.checkLicense?.().then(setLicenseInfo).catch(() => {});
  }, [activeTab]);

  const handleCopyPath = () => {
    if (dbInfo?.dbPath) {
      navigator.clipboard.writeText(dbInfo.dbPath);
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 2000);
    }
  };

  const handleCopyHwid = () => {
    if (licenseInfo?.hwid) {
      navigator.clipboard.writeText(licenseInfo.hwid);
      setCopiedHwid(true);
      setTimeout(() => setCopiedHwid(false), 2000);
    }
  };

  const handleOpenDataFolder = () => {
    openDataFolder().catch((err) => console.error('[Settings] Failed to open data folder:', err));
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div
      className="settings-view"
      style={{
        backgroundColor: theme.app.background,
        color: theme.text.primary,
      }}
    >
      <header className="settings-view__header">
        <h1 className="settings-view__title" style={{ color: theme.text.primary }}>
          APPLICATION SETTINGS
        </h1>
        <p className="settings-view__sub" style={{ color: theme.text.secondary }}>
          Theme customization, license management, database, hotkeys, and app information.
        </p>

        {/* Sub-tabs */}
        <div className="settings-tabs">
          <button
            className={`settings-tab ${activeTab === 'appearance' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('appearance')}
            style={{
              color: activeTab === 'appearance' ? theme.app.accent : theme.text.secondary,
              borderBottomColor: activeTab === 'appearance' ? theme.app.accent : 'transparent',
            }}
          >
            <Palette size={14} />
            <span>Appearance</span>
          </button>

          <button
            className={`settings-tab ${activeTab === 'database' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('database')}
            style={{
              color: activeTab === 'database' ? theme.app.accent : theme.text.secondary,
              borderBottomColor: activeTab === 'database' ? theme.app.accent : 'transparent',
            }}
          >
            <Database size={14} />
            <span>Database</span>
          </button>

          <button
            className={`settings-tab ${activeTab === 'license' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('license')}
            style={{
              color: activeTab === 'license' ? theme.app.accent : theme.text.secondary,
              borderBottomColor: activeTab === 'license' ? theme.app.accent : 'transparent',
            }}
          >
            <KeyRound size={14} />
            <span>Lisensi & Aktivasi</span>
          </button>

          <button
            className={`settings-tab ${activeTab === 'hotkeys' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('hotkeys')}
            style={{
              color: activeTab === 'hotkeys' ? theme.app.accent : theme.text.secondary,
              borderBottomColor: activeTab === 'hotkeys' ? theme.app.accent : 'transparent',
            }}
          >
            <Keyboard size={14} />
            <span>Hotkeys</span>
          </button>

          <button
            className={`settings-tab ${activeTab === 'about' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('about')}
            style={{
              color: activeTab === 'about' ? theme.app.accent : theme.text.secondary,
              borderBottomColor: activeTab === 'about' ? theme.app.accent : 'transparent',
            }}
          >
            <Info size={14} />
            <span>About</span>
          </button>
        </div>
      </header>

      {/* Tab Panels */}
      <div className="settings-view__body">
        {activeTab === 'appearance' && (
          <AppearancePanel isEmbedded={true} />
        )}

        {activeTab === 'database' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Storage Location Card */}
            <div
              className="settings-card"
              style={{
                backgroundColor: theme.app.sidebar,
                borderColor: theme.app.border,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.35rem' }}>
                <HardDrive size={18} style={{ color: theme.app.accent }} />
                <h3 style={{ color: theme.text.primary, margin: 0 }}>Lokasi Penyimpanan Data & Database</h3>
              </div>
              <p style={{ color: theme.text.secondary, fontSize: '0.8125rem', margin: '0 0 1rem 0' }}>
                Semua data candle pair yang di-download dan di-import tersimpan di database lokal SQLite berikut:
              </p>

              <div
                style={{
                  padding: '0.75rem 1rem',
                  background: theme.app.background,
                  border: `1px solid ${theme.app.border}`,
                  borderRadius: '6px',
                  marginBottom: '1rem',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '0.8125rem',
                  color: theme.text.primary,
                  wordBreak: 'break-all',
                  userSelect: 'all',
                }}
              >
                {dbInfo?.dbPath || 'Memuat path database...'}
              </div>

              {dbInfo && (
                <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.775rem', color: theme.text.secondary, marginBottom: '1rem' }}>
                  <div>Ukuran Database: <strong style={{ color: theme.text.primary }}>{formatBytes(dbInfo.dbSizeBytes)}</strong></div>
                  <div>Total Pair: <strong style={{ color: theme.text.primary }}>{dbInfo.totalSymbols}</strong></div>
                  <div>Total Bar: <strong style={{ color: theme.text.primary }}>{dbInfo.totalCandles.toLocaleString('id-ID')}</strong></div>
                </div>
              )}

              <div className="settings-btn-row">
                <button
                  className="settings-btn"
                  onClick={handleOpenDataFolder}
                  style={{
                    backgroundColor: theme.app.accent,
                    color: '#ffffff',
                  }}
                >
                  <FolderOpen size={14} /> Open Folder
                </button>

                <button
                  className="settings-btn"
                  onClick={handleCopyPath}
                  style={{
                    backgroundColor: theme.app.hover,
                    color: theme.text.primary,
                    borderColor: theme.app.border,
                  }}
                >
                  {copiedPath ? <Check size={14} style={{ color: '#22c55e' }} /> : <Copy size={14} />}
                  <span>{copiedPath ? 'Path Tersalin!' : 'Salin Path Database'}</span>
                </button>
              </div>
            </div>

            {/* Backup & Restore Card */}
            <div
              className="settings-card"
              style={{
                backgroundColor: theme.app.sidebar,
                borderColor: theme.app.border,
              }}
            >
              <h3 style={{ color: theme.text.primary }}>Database Backup & Restore</h3>
              <p style={{ color: theme.text.secondary, fontSize: '0.8125rem' }}>
                Create a standalone backup file of all sessions, candles, and trade journal data.
              </p>

              <div className="settings-btn-row">
                <button
                  className="settings-btn"
                  style={{
                    backgroundColor: theme.app.accent,
                    color: '#ffffff',
                  }}
                >
                  <Download size={14} /> Backup Database (.sqlite)
                </button>

                <button
                  className="settings-btn"
                  style={{
                    backgroundColor: theme.app.hover,
                    color: theme.text.primary,
                    borderColor: theme.app.border,
                  }}
                >
                  <Upload size={14} /> Restore Database
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'license' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div
              className="settings-card"
              style={{
                backgroundColor: theme.app.sidebar,
                borderColor: theme.app.border,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.35rem' }}>
                <ShieldCheck size={18} style={{ color: '#22c55e' }} />
                <h3 style={{ color: theme.text.primary, margin: 0 }}>Status Lisensi & Aktivasi Perangkat</h3>
              </div>
              <p style={{ color: theme.text.secondary, fontSize: '0.8125rem', margin: '0 0 1rem 0' }}>
                Informasi lisensi dan identitas perangkat (Hardware ID) yang terhubung ke TradePro.
              </p>

              {/* Status Box */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem',
                  padding: '1rem',
                  background: theme.app.background,
                  border: `1px solid ${theme.app.border}`,
                  borderRadius: '8px',
                  marginBottom: '1rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                  <span style={{ color: theme.text.secondary }}>Status Aktivasi:</span>
                  <span style={{ color: licenseInfo?.isLicensed ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                    {licenseInfo?.isLicensed ? `✓ ${licenseInfo.message || 'Lisensi Aktif'}` : '✗ Belum Teraktivasi'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                  <span style={{ color: theme.text.secondary }}>Tipe Paket:</span>
                  <strong style={{ color: theme.text.primary }}>
                    {licenseInfo?.planName || licenseInfo?.plan || 'Pro Lifetime'}
                  </strong>
                </div>

                {licenseInfo?.expiresAt && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                    <span style={{ color: theme.text.secondary }}>Kedaluwarsa Pada:</span>
                    <strong style={{ color: '#f59e0b' }}>
                      {new Date(licenseInfo.expiresAt).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </strong>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', paddingTop: '0.5rem', borderTop: `1px solid ${theme.app.border}` }}>
                  <span style={{ color: theme.text.secondary }}>Hardware ID (HWID):</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <code style={{ color: theme.app.accent, fontWeight: 600 }}>{licenseInfo?.hwid || 'Memuat...'}</code>
                    <button
                      type="button"
                      onClick={handleCopyHwid}
                      title="Salin HWID"
                      style={{
                        padding: '2px 8px',
                        fontSize: '11px',
                        background: theme.app.hover,
                        border: `1px solid ${theme.app.border}`,
                        borderRadius: '4px',
                        color: theme.text.primary,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      {copiedHwid ? <Check size={11} style={{ color: '#22c55e' }} /> : <Copy size={11} />}
                      <span>{copiedHwid ? 'Tersalin' : 'Salin'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Danger Zone: Reset / Deactivate License */}
              <div style={{ paddingTop: '0.75rem', borderTop: `1px solid ${theme.app.border}` }}>
                <div style={{ marginBottom: '0.75rem' }}>
                  <strong style={{ color: '#ef4444', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={14} /> Ganti / Hapus Lisensi
                  </strong>
                  <p style={{ color: theme.text.secondary, fontSize: '0.775rem', margin: '4px 0 0 0' }}>
                    Hapus lisensi aktif dari komputer ini jika Anda ingin memasukkan Serial Key / Kode Aktivasi yang baru.
                  </p>
                </div>

                <button
                  type="button"
                  className="settings-btn"
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    color: '#ef4444',
                    borderColor: 'rgba(239, 68, 68, 0.4)',
                    fontWeight: 600,
                  }}
                  onClick={async () => {
                    if (window.confirm('Apakah Anda yakin ingin menghapus lisensi yang aktif di perangkat ini? Aplikasi akan memuat ulang untuk aktivasi baru.')) {
                      if (window.forexReplay?.deactivateLicense) {
                        await window.forexReplay.deactivateLicense();
                        window.location.reload();
                      }
                    }
                  }}
                >
                  <KeyRound size={14} />
                  <span>Hapus Lisensi dari Komputer Ini</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'hotkeys' && (
          <div
            className="settings-card"
            style={{
              backgroundColor: theme.app.sidebar,
              borderColor: theme.app.border,
            }}
          >
            <h3 style={{ color: theme.text.primary }}>Keyboard Hotkeys</h3>
            <div className="hotkey-list">
              <div className="hotkey-row">
                <span style={{ color: theme.text.secondary }}>Play / Pause Replay</span>
                <kbd style={{ backgroundColor: theme.app.background, color: theme.text.primary }}>Space</kbd>
              </div>
              <div className="hotkey-row">
                <span style={{ color: theme.text.secondary }}>Step Next Candle</span>
                <kbd style={{ backgroundColor: theme.app.background, color: theme.text.primary }}>Right Arrow</kbd>
              </div>
              <div className="hotkey-row">
                <span style={{ color: theme.text.secondary }}>Step Previous Candle</span>
                <kbd style={{ backgroundColor: theme.app.background, color: theme.text.primary }}>Left Arrow</kbd>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'about' && (
          <div
            className="settings-card"
            style={{
              backgroundColor: theme.app.sidebar,
              borderColor: theme.app.border,
            }}
          >
            <h3 style={{ color: theme.text.primary }}>TradePro Desktop</h3>
            <p style={{ color: theme.text.secondary, fontSize: '0.85rem', lineHeight: '1.7' }}>
              <strong>Version:</strong> {appVersion} (Enterprise Replay Engine)<br />
              <strong>Developer & Publisher:</strong> Angga Rizki (@ngooy_)<br />
              <strong>Runtime:</strong> Electron + TypeScript + Vite + Lightweight Charts<br />
              <strong>Database:</strong> SQLite3 WAL Mode (Local Offline Storage)<br />
              <strong>Copyright:</strong> &copy; 2026 Angga Rizki. All rights reserved.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
