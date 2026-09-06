import React, { useState, useEffect, useCallback } from 'react';
import { Palette, Database, Keyboard, Info, Download, Upload, FolderOpen, Copy, Check, HardDrive, ShieldCheck, KeyRound, AlertTriangle, Sparkles, Eye, EyeOff, ExternalLink, CheckCircle2, AlertCircle, RefreshCw, Server, Cpu, Layers } from 'lucide-react';
import AppearancePanel from '../appearance/AppearancePanel';
import { useTheme } from '../appearance/ThemeManager';
import { getDbInfo, openDataFolder } from '@features/database/api';
import {
  getStoredApiKey,
  saveApiKey,
  getStoredModel,
  saveModel,
  AVAILABLE_MODELS,
  testGeminiApiKey,
  getAiProvider,
  saveAiProvider,
  getStored9RouterUrl,
  save9RouterUrl,
  getStored9RouterApiKey,
  save9RouterApiKey,
  getStored9RouterModel,
  save9RouterModel,
  fetch9RouterModels,
  test9RouterConnection,
  type Detected9RouterModel,
  type AiProvider,
} from '../ai/geminiService';
import type { DatabaseInfo } from '../../types';
import './SettingsView.css';

type SettingsTab = 'appearance' | 'database' | 'license' | 'ai' | 'hotkeys' | 'about';

export const SettingsView: React.FC = () => {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');
  const [dbInfo, setDbInfo] = useState<DatabaseInfo | null>(null);
  const [copiedPath, setCopiedPath] = useState(false);
  const [copiedHwid, setCopiedHwid] = useState(false);
  const [appVersion, setAppVersion] = useState<string>('3.2.8');

  // AI Provider & Settings
  const [aiProvider, setAiProvider] = useState<AiProvider>(() => getAiProvider());

  // Gemini AI Coach Settings
  const [geminiKey, setGeminiKey] = useState<string>(() => getStoredApiKey());
  const [showGeminiKey, setShowGeminiKey] = useState<boolean>(false);
  const [geminiModel, setGeminiModel] = useState<string>(() => getStoredModel());
  const [testingGemini, setTestingGemini] = useState<boolean>(false);
  const [geminiTestStatus, setGeminiTestStatus] = useState<{ success: boolean; message: string } | null>(null);

  // 9Router Settings
  const [nineRouterUrl, setNineRouterUrl] = useState<string>(() => getStored9RouterUrl());
  const [nineRouterKey, setNineRouterKey] = useState<string>(() => getStored9RouterApiKey());
  const [nineRouterModel, setNineRouterModel] = useState<string>(() => getStored9RouterModel());
  const [detectedCombos, setDetectedCombos] = useState<Detected9RouterModel[]>([]);
  const [detectingCombos, setDetectingCombos] = useState<boolean>(false);
  const [showNineRouterKey, setShowNineRouterKey] = useState<boolean>(false);
  const [testingNineRouter, setTestingNineRouter] = useState<boolean>(false);
  const [nineRouterTestStatus, setNineRouterTestStatus] = useState<{ success: boolean; message: string } | null>(null);

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

  const handleAutoDetectCombos = useCallback(async (urlToUse?: string) => {
    setDetectingCombos(true);
    try {
      const list = await fetch9RouterModels(urlToUse || nineRouterUrl);
      if (list.length > 0) {
        // Combos first, then single models
        const sorted = [
          ...list.filter((m) => m.isCombo),
          ...list.filter((m) => !m.isCombo),
        ];
        setDetectedCombos(sorted);

        // Auto-select best combo if current selection does not exist in 9Router
        const currentSaved = getStored9RouterModel();
        const exists = sorted.some((m) => m.id === currentSaved);
        if (!exists) {
          const best =
            sorted.find((m) => m.id === 'opencode2')?.id ||
            sorted.find((m) => m.isCombo)?.id ||
            sorted[0]?.id;
          if (best) {
            setNineRouterModel(best);
            save9RouterModel(best);
          }
        }
      }
    } finally {
      setDetectingCombos(false);
    }
  }, [nineRouterUrl]);

  useEffect(() => {
    if (activeTab === 'ai' && aiProvider === '9router') {
      handleAutoDetectCombos();
    }
  }, [activeTab, aiProvider, handleAutoDetectCombos]);

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

  const handleSelectProvider = (provider: AiProvider) => {
    setAiProvider(provider);
    saveAiProvider(provider);
  };

  const handleSaveGeminiKey = (newKey: string) => {
    setGeminiKey(newKey);
    saveApiKey(newKey);
    setGeminiTestStatus(null);
  };

  const handleSelectModel = (model: string) => {
    setGeminiModel(model);
    saveModel(model);
    setGeminiTestStatus(null);
  };

  const handleTestGemini = async () => {
    if (!geminiKey.trim()) {
      setGeminiTestStatus({ success: false, message: 'Harap masukkan API Key terlebih dahulu.' });
      return;
    }
    setTestingGemini(true);
    setGeminiTestStatus(null);
    const res = await testGeminiApiKey(geminiKey, geminiModel);
    setGeminiTestStatus(res);
    setTestingGemini(false);
  };

  const handleSave9RouterUrl = (val: string) => {
    setNineRouterUrl(val);
    save9RouterUrl(val);
    setNineRouterTestStatus(null);
  };

  const handleSave9RouterKey = (val: string) => {
    setNineRouterKey(val);
    save9RouterApiKey(val);
    setNineRouterTestStatus(null);
  };

  const handleSelect9RouterModel = (val: string) => {
    setNineRouterModel(val);
    save9RouterModel(val);
    setNineRouterTestStatus(null);
  };

  const handleTest9Router = async () => {
    if (!nineRouterKey.trim()) {
      setNineRouterTestStatus({
        success: false,
        message: 'API Key 9Router belum diisi. Buka dasbor http://localhost:20128 untuk menyalin API Key.',
      });
      return;
    }
    setTestingNineRouter(true);
    setNineRouterTestStatus(null);
    handleAutoDetectCombos();
    const res = await test9RouterConnection(nineRouterUrl, nineRouterKey, nineRouterModel);
    setNineRouterTestStatus(res);
    setTestingNineRouter(false);
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
          Theme customization, license management, database, AI Coach, hotkeys, and app information.
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
            className={`settings-tab ${activeTab === 'ai' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('ai')}
            style={{
              color: activeTab === 'ai' ? theme.app.accent : theme.text.secondary,
              borderBottomColor: activeTab === 'ai' ? theme.app.accent : 'transparent',
            }}
          >
            <Sparkles size={14} />
            <span>AI Coach</span>
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

        {activeTab === 'ai' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Provider Selector Switcher Card */}
            <div
              className="settings-card"
              style={{
                backgroundColor: theme.app.sidebar,
                borderColor: theme.app.border,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.25rem' }}>
                <Layers size={18} style={{ color: '#a78bfa' }} />
                <h3 style={{ color: theme.text.primary, margin: 0 }}>Pilih Provider AI Trade Coach</h3>
              </div>
              <p style={{ color: theme.text.secondary, fontSize: '0.8125rem', margin: '0 0 0.85rem 0', lineHeight: 1.6 }}>
                Pilih mesin kecerdasan buatan yang digunakan untuk review trade, analisis screenshot chart, dan audit psikologi sesi trading Anda:
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                {/* Google Gemini Card */}
                <div
                  onClick={() => handleSelectProvider('gemini')}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '8px',
                    border: `1.5px solid ${aiProvider === 'gemini' ? '#8b5cf6' : theme.app.border}`,
                    background: aiProvider === 'gemini' ? 'rgba(139, 92, 246, 0.12)' : theme.app.background,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Sparkles size={16} style={{ color: '#a78bfa' }} />
                      <strong style={{ fontSize: '0.9rem', color: aiProvider === 'gemini' ? '#ffffff' : theme.text.primary }}>
                        Google Gemini (Cloud)
                      </strong>
                    </div>
                    {aiProvider === 'gemini' && (
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: '#8b5cf6', color: '#fff' }}>
                        AKTIF
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.775rem', color: theme.text.secondary, lineHeight: 1.5 }}>
                    Koneksi langsung ke Google AI Studio. 1.500 kali review gratis per hari, cepat, dan mendukung analisis multimodal visual chart.
                  </p>
                </div>

                {/* 9Router Card */}
                <div
                  onClick={() => handleSelectProvider('9router')}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '8px',
                    border: `1.5px solid ${aiProvider === '9router' ? '#06b6d4' : theme.app.border}`,
                    background: aiProvider === '9router' ? 'rgba(6, 182, 212, 0.12)' : theme.app.background,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Server size={16} style={{ color: '#22d3ee' }} />
                      <strong style={{ fontSize: '0.9rem', color: aiProvider === '9router' ? '#ffffff' : theme.text.primary }}>
                        9Router (Open-source Gateway)
                      </strong>
                    </div>
                    {aiProvider === '9router' && (
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: '#06b6d4', color: '#fff' }}>
                        AKTIF
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.775rem', color: theme.text.secondary, lineHeight: 1.5 }}>
                    OpenAI-compatible gateway lokal/server. Bebas batas limit, auto-fallback, kompresi token RTK, dan akses 40+ model AI (Claude, DeepSeek, GPT-4o).
                  </p>
                </div>
              </div>
            </div>

            {/* Provider = Google Gemini */}
            {aiProvider === 'gemini' && (
              <>
                <div
                  className="settings-card"
                  style={{
                    backgroundColor: theme.app.sidebar,
                    borderColor: theme.app.border,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.35rem' }}>
                    <Sparkles size={18} style={{ color: '#a78bfa' }} />
                    <h3 style={{ color: theme.text.primary, margin: 0 }}>Konfigurasi Google Gemini AI</h3>
                  </div>
                  <p style={{ color: theme.text.secondary, fontSize: '0.8125rem', margin: '0 0 1rem 0', lineHeight: 1.6 }}>
                    Masukkan Google Gemini API Key Anda. TradePro menghubungkan aplikasi secara langsung ke REST API v1beta resmi Google.
                  </p>

                  {/* API Key Input */}
                  <div className="settings-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '600px' }}>
                      <label className="settings-label" htmlFor="gemini-key">
                        Google Gemini API Key
                      </label>
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          color: '#38bdf8',
                          fontSize: '0.75rem',
                          textDecoration: 'none',
                          fontWeight: 600,
                        }}
                      >
                        <span>Dapatkan API Key Gratis di Google AI Studio</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', maxWidth: '600px' }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <input
                          id="gemini-key"
                          type={showGeminiKey ? 'text' : 'password'}
                          className="settings-input"
                          style={{ width: '100%', maxWidth: 'none', paddingRight: '36px', fontFamily: 'monospace' }}
                          placeholder="Masukkan API Key Gemini (AIzaSy...)"
                          value={geminiKey}
                          onChange={(e) => handleSaveGeminiKey(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setShowGeminiKey(!showGeminiKey)}
                          style={{
                            position: 'absolute',
                            right: '8px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'transparent',
                            border: 'none',
                            color: theme.text.secondary,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          title={showGeminiKey ? 'Sembunyikan Key' : 'Tampilkan Key'}
                        >
                          {showGeminiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>

                      <button
                        type="button"
                        className="settings-btn"
                        onClick={handleTestGemini}
                        disabled={testingGemini || !geminiKey.trim()}
                        style={{ flexShrink: 0 }}
                      >
                        {testingGemini ? <RefreshCw size={14} className="spin" /> : <CheckCircle2 size={14} />}
                        <span>{testingGemini ? 'Menguji...' : 'Test Koneksi'}</span>
                      </button>
                    </div>

                    {geminiTestStatus && (
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginTop: '6px',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          maxWidth: '600px',
                          backgroundColor: geminiTestStatus.success ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: geminiTestStatus.success ? '#4ade80' : '#f87171',
                          border: `1px solid ${geminiTestStatus.success ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                        }}
                      >
                        {geminiTestStatus.success ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                        <span>{geminiTestStatus.message}</span>
                      </div>
                    )}
                  </div>

                  {/* Model Selector */}
                  <div className="settings-group" style={{ marginTop: '0.75rem' }}>
                    <label className="settings-label">Pilihan Model Gemini AI</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '600px' }}>
                      {AVAILABLE_MODELS.map((m) => {
                        const isSelected = geminiModel === m.id;
                        return (
                          <div
                            key={m.id}
                            onClick={() => handleSelectModel(m.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '10px',
                              padding: '10px 14px',
                              borderRadius: '8px',
                              background: isSelected ? 'rgba(139, 92, 246, 0.12)' : theme.app.background,
                              border: `1px solid ${isSelected ? '#8b5cf6' : theme.app.border}`,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <input
                              type="radio"
                              name="gemini-model"
                              checked={isSelected}
                              onChange={() => handleSelectModel(m.id)}
                              style={{ marginTop: '3px', cursor: 'pointer', accentColor: '#8b5cf6' }}
                            />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: isSelected ? '#ffffff' : theme.text.primary }}>
                                {m.name}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: theme.text.secondary }}>
                                {m.desc}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Privacy & Security Card */}
                <div
                  className="settings-card"
                  style={{
                    backgroundColor: theme.app.sidebar,
                    borderColor: theme.app.border,
                  }}
                >
                  <h3 style={{ color: theme.text.primary, margin: '0 0 0.35rem 0', fontSize: '0.95rem' }}>
                    Keamanan & Kuota Gratis Google
                  </h3>
                  <p style={{ color: theme.text.secondary, fontSize: '0.8125rem', lineHeight: '1.6', margin: 0 }}>
                    • <strong>Penyimpanan Lokal:</strong> API Key Anda tersimpan aman di perangkat lokal dan tidak pernah dikirim ke server pihak ketiga manapun.<br />
                    • <strong>Koneksi Langsung:</strong> Permintaan review chart dikirim langsung dari desktop Anda ke Google Cloud REST API.<br />
                    • <strong>Kuota Resmi:</strong> Gemini Flash memberikan hingga <strong>1.500 permintaan review per hari secara cuma-cuma</strong>.
                  </p>
                </div>
              </>
            )}

            {/* Provider = 9Router */}
            {aiProvider === '9router' && (
              <>
                <div
                  className="settings-card"
                  style={{
                    backgroundColor: theme.app.sidebar,
                    borderColor: theme.app.border,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.35rem' }}>
                    <Server size={18} style={{ color: '#22d3ee' }} />
                    <h3 style={{ color: theme.text.primary, margin: 0 }}>Konfigurasi 9Router Gateway</h3>
                  </div>
                  <p style={{ color: theme.text.secondary, fontSize: '0.8125rem', margin: '0 0 1rem 0', lineHeight: 1.6 }}>
                    9Router adalah gateway router AI open-source berkinerja tinggi. Model routing dan multi-provider fallback ditangani otomatis menggunakan profil <code>opencode2</code> (OpenCode) tanpa perlu konfigurasi model manual.
                  </p>

                  {/* 9Router Base URL Input */}
                  <div className="settings-group">
                    <label className="settings-label" htmlFor="9router-url">
                      9Router Base URL
                    </label>
                    <input
                      id="9router-url"
                      type="text"
                      className="settings-input"
                      style={{ width: '100%', maxWidth: '600px', fontFamily: 'monospace' }}
                      placeholder="http://localhost:20128/v1"
                      value={nineRouterUrl}
                      onChange={(e) => handleSave9RouterUrl(e.target.value)}
                    />
                    <span style={{ fontSize: '0.75rem', color: theme.text.secondary }}>
                      Default port 9Router adalah <code>http://localhost:20128/v1</code>. Endpoint <code>/chat/completions</code> akan ditambahkan otomatis.
                    </span>
                  </div>

                  {/* API Key + Test Connection Button */}
                  <div className="settings-group" style={{ marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '600px' }}>
                      <label className="settings-label" htmlFor="9router-key">
                        9Router API Key
                      </label>
                      <a
                        href="http://localhost:20128"
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          color: '#22d3ee',
                          fontSize: '0.75rem',
                          textDecoration: 'none',
                          fontWeight: 600,
                        }}
                      >
                        <span>Buka Dasbor 9Router (http://localhost:20128)</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', maxWidth: '600px' }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <input
                          id="9router-key"
                          type={showNineRouterKey ? 'text' : 'password'}
                          className="settings-input"
                          style={{ width: '100%', maxWidth: 'none', paddingRight: '36px', fontFamily: 'monospace' }}
                          placeholder="Masukkan API Key dari dasbor 9Router..."
                          value={nineRouterKey}
                          onChange={(e) => handleSave9RouterKey(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNineRouterKey(!showNineRouterKey)}
                          style={{
                            position: 'absolute',
                            right: '8px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'transparent',
                            border: 'none',
                            color: theme.text.secondary,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          title={showNineRouterKey ? 'Sembunyikan' : 'Lihat'}
                        >
                          {showNineRouterKey ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>

                      <button
                        type="button"
                        className="settings-btn"
                        onClick={handleTest9Router}
                        disabled={testingNineRouter}
                        style={{ flexShrink: 0, backgroundColor: '#0891b2', borderColor: '#0e7490' }}
                      >
                        {testingNineRouter ? <RefreshCw size={14} className="spin" /> : <CheckCircle2 size={14} />}
                        <span>{testingNineRouter ? 'Menguji...' : 'Test Koneksi'}</span>
                      </button>
                    </div>

                    {nineRouterTestStatus && (
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginTop: '8px',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          maxWidth: '600px',
                          backgroundColor: nineRouterTestStatus.success ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: nineRouterTestStatus.success ? '#4ade80' : '#f87171',
                          border: `1px solid ${nineRouterTestStatus.success ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                        }}
                      >
                        {nineRouterTestStatus.success ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                        <span>{nineRouterTestStatus.message}</span>
                      </div>
                    )}
                  </div>

                  {/* Model / Combo Selection with Auto-Detect */}
                  <div className="settings-group" style={{ marginTop: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '600px' }}>
                      <label className="settings-label" htmlFor="9router-model">
                        Profil Combo / Model 9Router
                      </label>
                      <button
                        type="button"
                        onClick={() => handleAutoDetectCombos()}
                        disabled={detectingCombos}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#22d3ee',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontWeight: 600,
                        }}
                        title="Pindai ulang daftar combo di 9Router"
                      >
                        <RefreshCw size={12} className={detectingCombos ? 'spin' : ''} />
                        <span>{detectingCombos ? 'Memindai...' : 'Deteksi Otomatis'}</span>
                      </button>
                    </div>

                    {detectedCombos.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '600px' }}>
                        {/* Quick Combo Buttons */}
                        {detectedCombos.some((c) => c.isCombo) && (
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {detectedCombos.filter((c) => c.isCombo).map((combo) => {
                              const isSelected = nineRouterModel === combo.id;
                              return (
                                <button
                                  key={combo.id}
                                  type="button"
                                  onClick={() => handleSelect9RouterModel(combo.id)}
                                  style={{
                                    padding: '6px 14px',
                                    fontSize: '0.85rem',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    border: `1.5px solid ${isSelected ? '#06b6d4' : theme.app.border}`,
                                    background: isSelected ? 'rgba(6, 182, 212, 0.2)' : theme.app.background,
                                    color: isSelected ? '#22d3ee' : theme.text.primary,
                                    fontWeight: isSelected ? 700 : 500,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    transition: 'all 0.15s ease',
                                  }}
                                  title={`Pilih combo ${combo.id}`}
                                >
                                  <span>⚡ {combo.id}</span>
                                  {isSelected && (
                                    <span
                                      style={{
                                        fontSize: '9.5px',
                                        background: '#06b6d4',
                                        color: '#000',
                                        borderRadius: '4px',
                                        padding: '1px 5px',
                                        fontWeight: 800,
                                        letterSpacing: '0.5px',
                                      }}
                                    >
                                      AKTIF
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        <select
                          id="9router-model"
                          className="settings-input"
                          style={{ width: '100%', cursor: 'pointer' }}
                          value={nineRouterModel}
                          onChange={(e) => handleSelect9RouterModel(e.target.value)}
                        >
                          {detectedCombos.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.isCombo ? `⚡ [Combo] ${item.id}` : `🤖 [Model] ${item.id}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <input
                        id="9router-model"
                        type="text"
                        className="settings-input"
                        style={{ width: '100%', maxWidth: '600px', fontFamily: 'monospace' }}
                        placeholder="opencode2 (atau nama combo Anda di 9Router)"
                        value={nineRouterModel}
                        onChange={(e) => handleSelect9RouterModel(e.target.value)}
                      />
                    )}
                    <span style={{ fontSize: '0.75rem', color: theme.text.secondary }}>
                      {detectedCombos.length > 0
                        ? `Terdeteksi ${detectedCombos.filter((c) => c.isCombo).length} combo aktif di 9Router Anda. TradePro otomatis mendeteksi combo milik Anda.`
                        : 'TradePro otomatis mendeteksi combo Anda saat 9Router aktif. Anda juga dapat memilih atau mengetik manual.'}
                    </span>
                  </div>
                </div>

                {/* 9Router Guide & Tips Card */}
                <div
                  className="settings-card"
                  style={{
                    backgroundColor: theme.app.sidebar,
                    borderColor: theme.app.border,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.35rem' }}>
                    <Cpu size={18} style={{ color: '#22d3ee' }} />
                    <h3 style={{ color: theme.text.primary, margin: 0, fontSize: '0.95rem' }}>
                      Kelebihan Menggunakan 9Router
                    </h3>
                  </div>
                  <p style={{ color: theme.text.secondary, fontSize: '0.8125rem', lineHeight: '1.6', margin: 0 }}>
                    • <strong>Otomatis Tanpa Pilih Model:</strong> 9Router mengelola model terbaik dan kuota secara mandiri di balik layar.<br />
                    • <strong>Auto-fallback:</strong> Jika satu model AI sibuk, 9Router otomatis mengalihkan permintaan ke model cadangan tanpa kegagalan review.<br />
                    • <strong>Token Compression:</strong> Menggunakan RTK token compression bawaan 9Router untuk memangkas konsumsi token hingga 40%.
                  </p>
                </div>
              </>
            )}
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
