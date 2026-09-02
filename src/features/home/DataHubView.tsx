import React, { useState, useEffect, useCallback } from 'react';
import { Download, Upload, Database, CheckCircle2, FileSpreadsheet, FolderUp, Trash2, Loader2, FileUp, Check, Circle, RefreshCw, Info, HelpCircle, FolderOpen, Copy, HardDrive } from 'lucide-react';
import { useTheme } from '../appearance/ThemeManager';
import { useImportData, useSymbols } from '@features/data';
import { getDbInfo, openDataFolder } from '@features/database/api';
import { getCurrenciesForSymbol, downloadEconomicNews, getEconomicNewsStats } from '@features/news';
import type { Timeframe, DatabaseInfo } from '../../types';
import './DataHubView.css';

const ORDERED_TIMEFRAMES: Timeframe[] = [
  'M1',
  'M3',
  'M5',
  'M15',
  'M30',
  'H1',
  'H4',
  'H7',
  'D1',
  'W1',
  'Monthly',
];

const calculateDateSpan = (firstTime: number | null, lastTime: number | null): string => {
  if (!firstTime || !lastTime || lastTime <= firstTime) return '';
  const startDate = new Date(firstTime * 1000);
  const endDate = new Date(lastTime * 1000);

  let years = endDate.getUTCFullYear() - startDate.getUTCFullYear();
  let months = endDate.getUTCMonth() - startDate.getUTCMonth();
  let days = endDate.getUTCDate() - startDate.getUTCDate();

  if (days < 0) {
    months -= 1;
    const prevMonthDays = new Date(endDate.getUTCFullYear(), endDate.getUTCMonth(), 0).getUTCDate();
    days += prevMonthDays;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const parts: string[] = [];
  if (years > 0) parts.push(`${years}Y`);
  if (months > 0) parts.push(`${months}M`);
  if (days > 0) parts.push(`${days}D`);
  return parts.length > 0 ? `(${parts.join(' ')})` : '';
};

export const DataHubView: React.FC = () => {
  const { theme } = useTheme();

  // Existing Master Dataset from SQLite via useSymbols hook
  const { symbols, loading: symbolsLoading, refresh: refreshSymbols, remove: removeSymbol, removeTimeframe } = useSymbols();

  // Existing CSV Import Engine via useImportData hook (calls native file dialog & parses to SQLite)
  const { state: importState, runImportFiles, runImportFolder } = useImportData(refreshSymbols);

  // Dukascopy Downloader state
  const [dukaPair, setDukaPair] = useState('XAUUSD');
  const [dukaTf, setDukaTf] = useState('M1');
  const [dukaStart, setDukaStart] = useState('2024-01-01');
  const [dukaEnd, setDukaEnd] = useState('2024-01-31');
  const [activePopover, setActivePopover] = useState<{ symbolId: number; tf: string } | null>(null);
  
  // Confirmations
  const [confirmDeletePair, setConfirmDeletePair] = useState<{ id: number; name: string } | null>(null);
  const [confirmDeleteTf, setConfirmDeleteTf] = useState<{ symbolId: number; name: string; tf: string } | null>(null);

  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadWithNews, setDownloadWithNews] = useState(true);

  const [dukaProgress, setDukaProgress] = useState<{
    percent: number;
    message: string;
    rowsInserted?: number;
  } | null>(null);

  const [derivedProgress, setDerivedProgress] = useState<{
    symbolId: number;
    timeframe: string;
    index: number;
    total: number;
    percent: number;
    status: 'generating' | 'completed' | 'error';
    message: string;
  } | null>(null);

  const [isBackfilling, setIsBackfilling] = useState<number | null>(null);
  const [validatedResults, setValidatedResults] = useState<Record<string | number, any>>(() => {
    try {
      const saved = localStorage.getItem('forex_replay_validated_results');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [isValidatingGaps, setIsValidatingGaps] = useState<number | null>(null);
  const [auditReport, setAuditReport] = useState<any | null>(null);
  const [isRecoveringGaps, setIsRecoveringGaps] = useState<number | null>(null);
  const [confirmingSymbol, setConfirmingSymbol] = useState<any | null>(null);

  const [dbInfo, setDbInfo] = useState<DatabaseInfo | null>(null);
  const [copiedPath, setCopiedPath] = useState(false);

  const fetchDbInfo = () => {
    getDbInfo().then(setDbInfo).catch((err) => console.error('[DataHub] Failed to fetch db info:', err));
  };

  useEffect(() => {
    fetchDbInfo();
  }, [symbolsLoading, importState.status]);

  const handleCopyPath = () => {
    if (dbInfo?.dbPath) {
      navigator.clipboard.writeText(dbInfo.dbPath);
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 2000);
    }
  };

  const handleOpenDataFolder = () => {
    openDataFolder().catch((err) => console.error('[DataHub] Failed to open data folder:', err));
  };

  // Sync validatedResults to localStorage whenever updated
  useEffect(() => {
    try {
      localStorage.setItem('forex_replay_validated_results', JSON.stringify(validatedResults));
    } catch (err) {
      console.error('[DataHub] Failed to save validatedResults to localStorage:', err);
    }
  }, [validatedResults]);

  useEffect(() => {
    if (window.forexReplay?.onDukascopyProgress) {
      const unsubDuka = window.forexReplay.onDukascopyProgress((p) => {
        setDukaProgress({
          percent: p.percent,
          message: p.message,
          rowsInserted: p.rowsInserted,
        });
      });
      return unsubDuka;
    }
  }, []);

  // Click outside to close popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (activePopover && !(e.target as Element).closest('.data-tf-chip-wrapper')) {
        setActivePopover(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activePopover]);

  useEffect(() => {
    if ((window.forexReplay as any)?.onDerivedProgress) {
      const unsubDerived = (window.forexReplay as any).onDerivedProgress((p: any) => {
        console.log('[DataHubView] Derived progress event received:', p);
        if (p?.status === 'completed' || p?.status === 'error') {
          setDerivedProgress(null);
          refreshSymbols();
        } else {
          setDerivedProgress(p as any);
        }
      });
      return unsubDerived;
    }
  }, [refreshSymbols]);

  const handleValidateSourceAvailability = async (sym: any) => {
    console.log('[DataHub][Validate] button clicked for symbol:', sym.name, '(id:', sym.id, ')');

    // Duplicate click protection: guard if already validating this symbol
    if (isValidatingGaps === sym.id) {
      console.warn('[DataHub][Validate] Validation already running for symbol:', sym.id);
      return;
    }

    setIsValidatingGaps(sym.id);
    console.log('[DataHub][Validate] starting validation against Dukascopy source for:', sym.name);

    try {
      if (!(window.forexReplay as any)?.validateSymbolAvailability) {
        throw new Error('Validation service is not available on the IPC bridge.');
      }

      const valRes = await (window.forexReplay as any).validateSymbolAvailability({
        symbolId: sym.id,
        symbol: sym.name,
        timeframe: 'M1',
      });

      console.log('[DataHub][Validate] validation completed for', sym.name, ':', valRes);
      setValidatedResults((prev) => ({
        ...prev,
        [sym.id]: valRes,
        [sym.name]: valRes,
      }));
    } catch (err: any) {
      console.error('[DataHub][Validate] error validating', sym.name, ':', err);
      const errRes = {
        symbolId: sym.id,
        symbol: sym.name,
        status: 'SOURCE_UNAVAILABLE',
        sqliteRange: { fromTime: sym.firstTime ?? 0, toTime: sym.lastTime ?? 0 },
        confirmedMissingRanges: [],
        expectedRangesChecked: 0,
        confirmedMissingRangesCount: 0,
        source: 'DUKASCOPY',
        validatedAt: Math.floor(Date.now() / 1000),
        error: err?.message || 'Dukascopy validation failed',
      };
      setValidatedResults((prev) => ({
        ...prev,
        [sym.id]: errRes,
        [sym.name]: errRes,
      }));
    } finally {
      setIsValidatingGaps(null);
    }
  };

  const handleRecoverMissingData = async (symId: number, symbolName: string, confirmedGaps: any[]) => {
    setIsRecoveringGaps(symId);
    try {
      if ((window.forexReplay as any)?.downloadMissingRanges) {
        const audit = await (window.forexReplay as any).downloadMissingRanges({
          symbolId: symId,
          symbol: symbolName,
          timeframe: 'M1',
          gaps: confirmedGaps,
        });
        setAuditReport(audit);

        // Revalidate after recovery
        if ((window.forexReplay as any)?.validateSymbolAvailability) {
          const freshVal = await (window.forexReplay as any).validateSymbolAvailability({
            symbolId: symId,
            symbol: symbolName,
            timeframe: 'M1',
          });
          setValidatedResults((prev) => ({ ...prev, [symId]: freshVal }));
        } else {
          setValidatedResults((prev) => {
            const next = { ...prev };
            delete next[symId];
            return next;
          });
        }
        await refreshSymbols();
      }
    } catch (err) {
      alert(`Gap recovery error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsRecoveringGaps(null);
    }
  };

  const handleBackfill = async (symbolId: number, force = false) => {
    const symId = Number(symbolId);
    console.log('[DataHubView] Generate/Sync Timeframes clicked for symbolId:', symId, 'force:', force);
    setIsBackfilling(symId);
    try {
      if ((window.forexReplay as any)?.backfillMissingDerivedTimeframes) {
        console.log('[DataHubView] Invoking window.forexReplay.backfillMissingDerivedTimeframes:', symId, { force });
        const res = await (window.forexReplay as any).backfillMissingDerivedTimeframes(symId, { force });
        console.log('[DataHubView] Backfill IPC result:', res);
        await refreshSymbols();
      } else {
        alert('IPC Bridge error: window.forexReplay.backfillMissingDerivedTimeframes is not available. Please run within the Electron desktop application.');
      }
    } catch (err) {
      console.error('[DataHubView] Backfill error:', err);
      alert(`Backfill error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsBackfilling(null);
    }
  };

  const [isGeneratingCustom, setIsGeneratingCustom] = useState<number | null>(null);
  const [customTfPrompt, setCustomTfPrompt] = useState<{ symbolId: number; symbolName: string } | null>(null);
  const [customTfInput, setCustomTfInput] = useState('');
  const [customTfUnit, setCustomTfUnit] = useState('M');

  const executeCustomTfGeneration = async () => {
    if (!customTfPrompt || !customTfInput.trim()) return;
    const num = parseInt(customTfInput.trim(), 10);
    if (!num || num <= 0) {
      alert("Please enter a valid number for the timeframe.");
      return;
    }
    const { symbolId, symbolName } = customTfPrompt;
    const tf = `${customTfUnit}${num}`;
    
    setCustomTfPrompt(null);
    setCustomTfInput('');
    setCustomTfUnit('M');
    setIsGeneratingCustom(symbolId);
    
    try {
      await (window.forexReplay as any).generateCustomTimeframe(symbolId, tf);
      alert(`Successfully generated custom timeframe ${tf} for ${symbolName}!`);
      refreshSymbols();
    } catch (e: any) {
      alert(`Error generating custom timeframe: ${e.message || e}`);
    } finally {
      setIsGeneratingCustom(null);
    }
  };

  const handleGenerateCustom = (symbolId: number, symbolName: string) => {
    setCustomTfPrompt({ symbolId, symbolName });
  };

  const [newsStats, setNewsStats] = useState<any>(null);
  const [isSyncingNews, setIsSyncingNews] = useState<string | null>(null);

  const fetchNewsStats = useCallback(async () => {
    try {
      const stats = await getEconomicNewsStats();
      setNewsStats(stats);
    } catch (e) {}
  }, []);

  useEffect(() => {
    fetchNewsStats();
  }, [fetchNewsStats]);

  const handleSyncNewsOnly = async (symbolName: string, firstTime: number | null, lastTime: number | null) => {
    setIsSyncingNews(symbolName);
    try {
      const currencies = getCurrenciesForSymbol(symbolName);
      const startStr = firstTime ? new Date(firstTime * 1000).toISOString().split('T')[0] : '2024-01-01';
      const endStr = lastTime ? new Date(lastTime * 1000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

      const res = await downloadEconomicNews(startStr, endStr, currencies);
      await fetchNewsStats();
      alert(`Berhasil menyinkronkan ${res.totalInserted} peristiwa berita ekonomi untuk ${symbolName} (${currencies.join(', ')})!`);
    } catch (err: any) {
      alert(`Sync News error: ${err?.message || String(err)}`);
    } finally {
      setIsSyncingNews(null);
    }
  };

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsDownloading(true);
    setDukaProgress({ percent: 0, message: 'Menyiapkan downloader Dukascopy...' });

    try {
      if (window.forexReplay?.downloadDukascopy) {
        const res = await window.forexReplay.downloadDukascopy({
          symbol: dukaPair,
          startDate: dukaStart,
          endDate: dukaEnd,
          timeframe: dukaTf,
        });

        // Smart All-in-One: sync Economic News alongside candles if checkbox is checked
        if (downloadWithNews) {
          try {
            const currencies = getCurrenciesForSymbol(dukaPair);
            await downloadEconomicNews(dukaStart, dukaEnd, currencies);
            await fetchNewsStats();
          } catch (newsErr) {
            console.warn('[DataHub] Economic news sync notice:', newsErr);
          }
        }

        await refreshSymbols();
        alert(`Dukascopy Download Selesai! Berhasil menyimpan ${res.rowsInserted.toLocaleString()} candle untuk ${res.symbol}${downloadWithNews ? ' + kalender berita ekonomi' : ''}.`);
      } else {
        // Fallback for browser testing
        setTimeout(async () => {
          await refreshSymbols();
          setIsDownloading(false);
          setDukaProgress(null);
          alert(`Simulated Dukascopy Download for ${dukaPair} (${dukaStart} to ${dukaEnd}) completed!`);
        }, 1500);
        return;
      }
    } catch (err) {
      alert(`Download error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (unixSec: number | null) => {
    if (!unixSec) return 'N/A';
    return new Date(unixSec * 1000).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const isImporting = importState.status === 'importing';

  return (
    <div
      className="data-hub"
      style={{
        backgroundColor: theme.app.background,
        color: theme.text.primary,
      }}
    >
      <header className="data-hub__header">
        <h1 className="data-hub__title" style={{ color: theme.text.primary }}>
          DATA HUB & MASTER DATABASE
        </h1>
        <p className="data-hub__sub" style={{ color: theme.text.secondary }}>
          Download historical tick data directly via Dukascopy, import CSV bar files, and manage master database.
        </p>
      </header>

      {/* Import Status Alert Banner if active */}
      {isImporting && (
        <div className="data-status-alert data-status-alert--info">
          <Loader2 size={16} className="data-spin" />
          <span>Importing CSV file(s) into SQLite Master Database... Please wait.</span>
        </div>
      )}

      {/* Audit Log Box if active */}
      {auditReport && (
        <div
          className="data-status-alert"
          style={{
            backgroundColor: auditReport.status === 'COMPLETE' ? '#22c55e15' : '#f59e0b15',
            borderColor: auditReport.status === 'COMPLETE' ? '#22c55e44' : '#f59e0b44',
            color: theme.text.primary,
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, width: '100%', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {auditReport.status === 'COMPLETE' ? (
                <CheckCircle2 size={18} style={{ color: '#22c55e' }} />
              ) : (
                <Circle size={18} style={{ color: '#f59e0b' }} />
              )}
              <span>
                Download Audit Result — {auditReport.symbol} ({auditReport.status})
              </span>
            </div>
            <button
              onClick={() => setAuditReport(null)}
              style={{ fontSize: '0.75rem', color: theme.text.secondary, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Dismiss
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', fontSize: '0.775rem', width: '100%' }}>
            <div>Downloaded Rows: <strong>{auditReport.downloadedRows?.toLocaleString() ?? 0}</strong></div>
            <div>Inserted New Rows: <strong>{auditReport.insertedNewRows?.toLocaleString() ?? 0}</strong></div>
            <div>Existing Rows Skipped: <strong>{auditReport.existingRowsSkipped?.toLocaleString() ?? 0}</strong></div>
            <div>Database Duplicates: <strong style={{ color: '#22c55e' }}>{auditReport.databaseDuplicates ?? 0}</strong></div>
          </div>
        </div>
      )}

      {importState.status === 'done' && (
        <div className="data-status-alert data-status-alert--success">
          <CheckCircle2 size={16} />
          <span>CSV Data imported successfully! Master Datasets updated.</span>
        </div>
      )}

      {importState.status === 'error' && (
        <div className="data-status-alert data-status-alert--error">
          <span>Import error: {importState.message}</span>
        </div>
      )}

      {/* Top Split: Dukascopy Downloader (Left) & CSV Importer (Right) */}
      <div className="data-hub__split">
        {/* Left Card: Dukascopy Downloader */}
        <div
          className="data-card"
          style={{
            backgroundColor: theme.app.sidebar,
            borderColor: theme.app.border,
          }}
        >
          <div className="data-card__title-wrap">
            <Download size={18} style={{ color: theme.app.accent }} />
            <h3 style={{ color: theme.text.primary }}>Download Pair</h3>
          </div>

          <form onSubmit={handleDownload} className="data-card__form">
            <div className="data-form-row">
              <div className="data-form-field">
                <label style={{ color: theme.text.secondary }}>Trading Pair</label>
                <select
                  value={dukaPair}
                  onChange={(e) => setDukaPair(e.target.value)}
                  disabled={isDownloading}
                  style={{
                    backgroundColor: theme.app.background,
                    color: theme.text.primary,
                    borderColor: theme.app.border,
                  }}
                >
                  <optgroup label="✨ Precious Metals & Commodities">
                    <option value="XAUUSD">XAUUSD (Gold / US Dollar)</option>
                    <option value="XAGUSD">XAGUSD (Silver / US Dollar)</option>
                    <option value="USOUSD">USOUSD (WTI Crude Oil)</option>
                  </optgroup>

                  <optgroup label="💱 Major Forex Pairs">
                    <option value="EURUSD">EURUSD (Euro / US Dollar)</option>
                    <option value="GBPUSD">GBPUSD (British Pound / US Dollar)</option>
                    <option value="USDJPY">USDJPY (US Dollar / Japanese Yen)</option>
                    <option value="AUDUSD">AUDUSD (Australian Dollar / US Dollar)</option>
                    <option value="USDCAD">USDCAD (US Dollar / Canadian Dollar)</option>
                    <option value="USDCHF">USDCHF (US Dollar / Swiss Franc)</option>
                    <option value="NZDUSD">NZDUSD (New Zealand Dollar / US Dollar)</option>
                  </optgroup>

                  <optgroup label="🔀 Forex Crosses">
                    <option value="GBPJPY">GBPJPY (British Pound / Japanese Yen)</option>
                    <option value="EURJPY">EURJPY (Euro / Japanese Yen)</option>
                    <option value="EURGBP">EURGBP (Euro / British Pound)</option>
                    <option value="AUDJPY">AUDJPY (Australian Dollar / Japanese Yen)</option>
                    <option value="CADJPY">CADJPY (Canadian Dollar / Japanese Yen)</option>
                    <option value="CHFJPY">CHFJPY (Swiss Franc / Japanese Yen)</option>
                    <option value="EURAUD">EURAUD (Euro / Australian Dollar)</option>
                    <option value="GBPAUD">GBPAUD (British Pound / Australian Dollar)</option>
                  </optgroup>

                  <optgroup label="📊 Global Equity Indices">
                    <option value="NAS100">NAS100 (Nasdaq 100 Index)</option>
                    <option value="US30">US30 (Dow Jones Industrial)</option>
                    <option value="SPX500">SPX500 (S&P 500 Index)</option>
                    <option value="GER30">GER30 (DAX Germany 40)</option>
                  </optgroup>

                  <optgroup label="₿ Cryptocurrency">
                    <option value="BTCUSD">BTCUSD (Bitcoin / US Dollar)</option>
                    <option value="ETHUSD">ETHUSD (Ethereum / US Dollar)</option>
                  </optgroup>
                </select>
              </div>

              <div className="data-form-field">
                <label style={{ color: theme.text.secondary }}>Timeframe</label>
                <select
                  value={dukaTf}
                  onChange={(e) => setDukaTf(e.target.value)}
                  disabled={isDownloading}
                  style={{
                    backgroundColor: theme.app.background,
                    color: theme.text.primary,
                    borderColor: theme.app.border,
                  }}
                >
                  <option value="M1">M1 (1 Minute Ticks)</option>
                  <option value="M5">M5 (5 Minutes)</option>
                  <option value="H1">H1 (1 Hour)</option>
                </select>
              </div>
            </div>

            <div className="data-form-row">
              <div className="data-form-field">
                <label style={{ color: theme.text.secondary }}>Start Date</label>
                <input
                  type="date"
                  value={dukaStart}
                  onChange={(e) => setDukaStart(e.target.value)}
                  disabled={isDownloading}
                  style={{
                    backgroundColor: theme.app.background,
                    color: theme.text.primary,
                    borderColor: theme.app.border,
                  }}
                  required
                />
              </div>

              <div className="data-form-field">
                <label style={{ color: theme.text.secondary }}>End Date</label>
                <input
                  type="date"
                  value={dukaEnd}
                  onChange={(e) => setDukaEnd(e.target.value)}
                  disabled={isDownloading}
                  style={{
                    backgroundColor: theme.app.background,
                    color: theme.text.primary,
                    borderColor: theme.app.border,
                  }}
                  required
                />
              </div>
            </div>

            {/* Download Calendar Checkbox */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.8rem',
                color: theme.text.secondary,
                cursor: 'pointer',
                userSelect: 'none',
                padding: '0.4rem 0',
              }}
            >
              <input
                type="checkbox"
                checked={downloadWithNews}
                onChange={(e) => setDownloadWithNews(e.target.checked)}
                disabled={isDownloading}
                style={{ accentColor: theme.app.accent, width: 14, height: 14 }}
              />
              <span>Sinkronkan kalender berita ekonomi</span>
              {downloadWithNews && (
                <span style={{ fontSize: '0.7rem', color: theme.text.muted }}>
                  (NFP, CPI, FOMC, ECB, BOE, dll.)
                </span>
              )}
            </label>

            {/* Live Progress Bar UI */}
            {dukaProgress && (
              <div className="duka-progress-box">
                <div className="duka-progress-info">
                  <span>{dukaProgress.message}</span>
                  <span className="duka-progress-percent">{dukaProgress.percent}%</span>
                </div>
                <div className="duka-progress-bar-track">
                  <div
                    className="duka-progress-bar-fill"
                    style={{
                      width: `${dukaProgress.percent}%`,
                      backgroundColor: theme.app.accent,
                    }}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              className="data-btn-primary"
              disabled={isDownloading}
              style={{
                backgroundColor: theme.app.accent,
                color: '#ffffff',
              }}
            >
              {isDownloading ? <Loader2 size={15} className="data-spin" /> : <Download size={15} />}
              <span>{isDownloading ? 'Downloading Data...' : 'START DOWNLOAD'}</span>
            </button>
          </form>
        </div>

        {/* Right Card: Native CSV Importer Backend */}
        <div
          className="data-card"
          style={{
            backgroundColor: theme.app.sidebar,
            borderColor: theme.app.border,
          }}
        >
          <div className="data-card__title-wrap">
            <Upload size={18} style={{ color: theme.app.accent }} />
            <h3 style={{ color: theme.text.primary }}>Import Custom CSV Files</h3>
          </div>

          <div
            className="data-dropzone"
            style={{
              backgroundColor: theme.app.background,
              borderColor: theme.app.border,
            }}
          >
            <FileSpreadsheet size={32} style={{ color: theme.text.muted }} />
            <span style={{ color: theme.text.primary, fontWeight: 700 }}>
              Import Local CSV Candle Files
            </span>
            <span style={{ color: theme.text.secondary, fontSize: '0.775rem' }}>
              Supported: MT4/MT5, TradingView, Dukascopy CSV formats
            </span>

            <div className="data-import-actions">
              <button
                className="data-btn-primary"
                onClick={runImportFiles}
                disabled={isImporting}
                style={{
                  backgroundColor: theme.app.accent,
                  color: '#ffffff',
                }}
              >
                <FileUp size={15} />
                <span>{isImporting ? 'Importing...' : 'Browse CSV Files'}</span>
              </button>

              <button
                className="data-btn-secondary"
                onClick={runImportFolder}
                disabled={isImporting}
                style={{
                  backgroundColor: theme.app.hover,
                  borderColor: theme.app.border,
                  color: theme.text.primary,
                }}
              >
                <FolderUp size={15} />
                <span>Import Folder</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Master Database Dataset Table */}
      <div
        className="data-dataset-card"
        style={{
          backgroundColor: theme.app.sidebar,
          borderColor: theme.app.border,
        }}
      >
        <div className="data-card__title-wrap" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <Database size={18} style={{ color: theme.app.accent }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <h3 style={{ color: theme.text.primary, margin: 0 }}>Available Master Pair</h3>
                {dbInfo && (
                  <span className="data-hub__storage-badge">
                    {formatBytes(dbInfo.dbSizeBytes)} • {dbInfo.totalSymbols} Pair
                  </span>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <button
              type="button"
              className="data-hub__storage-btn data-hub__storage-btn--primary"
              onClick={handleOpenDataFolder}
              title={dbInfo?.dbPath ? `Buka folder database: ${dbInfo.dbPath}` : 'Buka folder tempat file forex-replay.db tersimpan di File Explorer'}
            >
              <FolderOpen size={13} />
              <span>Open Folder</span>
            </button>
            <button
              className="data-refresh-btn"
              onClick={refreshSymbols}
              disabled={symbolsLoading}
              style={{ color: theme.app.accent, display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <RefreshCw size={13} className={symbolsLoading ? 'data-spin' : ''} />
              <span>Refresh List</span>
            </button>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr style={{ borderColor: theme.app.border }}>
              <th style={{ color: theme.text.secondary }}>Symbol</th>
              <th style={{ color: theme.text.secondary }}>Master</th>
              <th style={{ color: theme.text.secondary }}>Available Timeframes</th>
              <th style={{ color: theme.text.secondary }}>Dataset Range (UTC)</th>
              <th style={{ color: theme.text.secondary }}>Data Integrity</th>
              <th style={{ color: theme.text.secondary }}>Candles Count</th>
              <th style={{ color: theme.text.secondary }}>Status</th>
              <th style={{ color: theme.text.secondary }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {symbols.length === 0 ? (
              <tr style={{ borderColor: theme.app.border }}>
                <td colSpan={8} style={{ textAlign: 'center', color: theme.text.secondary, padding: '2rem' }}>
                  {symbolsLoading ? 'Loading Master Datasets...' : 'No symbols found in SQLite Database. Click "Browse CSV Files" or "START DOWNLOAD" to ingest candles.'}
                </td>
              </tr>
            ) : (
              symbols.map((sym) => {
                const availableSet = new Set(sym.timeframes);
                const isDownloadingThis = isDownloading && dukaPair.toUpperCase() === sym.name.toUpperCase();
                const isProcessingThis = isDownloadingThis && dukaProgress?.percent !== undefined && dukaProgress.percent > 90 && dukaProgress.percent < 100;
                const isGeneratingThis = isProcessingThis || (derivedProgress?.symbolId === sym.id && derivedProgress.status === 'generating') || isBackfilling === sym.id;

                let availableCount = 0;
                let missingCount = 0;
                let generatingCount = 0;

                const customTfs = sym.timeframes.filter(tf => !ORDERED_TIMEFRAMES.includes(tf as Timeframe));
                const allTfsForSym = [...ORDERED_TIMEFRAMES, ...customTfs];

                const tfToMinutes = (tf: string) => {
                  if (tf === 'Monthly' || tf === '1MN') return 43200;
                  const match = tf.match(/^([MHDW]?)(\d+)([MHDW]?)$/i);
                  if (!match) return 0;
                  const unit = (match[1] || match[3] || 'M').toUpperCase();
                  const val = parseInt(match[2], 10);
                  if (unit === 'H') return val * 60;
                  if (unit === 'D') return val * 1440;
                  if (unit === 'W') return val * 10080;
                  return val; // M
                };

                allTfsForSym.sort((a, b) => tfToMinutes(a) - tfToMinutes(b));

                const tfStates = allTfsForSym.map((tf) => {
                  if (availableSet.has(tf)) {
                    availableCount++;
                    return { tf, state: 'AVAILABLE' as const };
                  } else if (isGeneratingThis && (derivedProgress ? derivedProgress.timeframe === tf : isBackfilling === sym.id)) {
                    generatingCount++;
                    return { tf, state: 'GENERATING' as const };
                  } else {
                    missingCount++;
                    return { tf, state: 'MISSING' as const };
                  }
                });

                const rowsOfTfs: typeof tfStates[] = [];
                for (let i = 0; i < tfStates.length; i += 7) {
                  rowsOfTfs.push(tfStates.slice(i, i + 7));
                }

                const renderChipItem = ({ tf, state }: { tf: Timeframe; state: 'AVAILABLE' | 'GENERATING' | 'MISSING' }) => {
                  const stat = (sym as any).timeframeStats?.[tf];
                  const isHovered = activePopover?.symbolId === sym.id && activePopover?.tf === tf;
                  const isMasterTf = tf === 'M1';

                  let chipElement;
                  if (state === 'AVAILABLE') {
                    chipElement = (
                      <span className="data-tf-chip available">
                        <Check size={11} /> {tf}
                      </span>
                    );
                  } else if (state === 'GENERATING') {
                    chipElement = (
                      <span className="data-tf-chip generating">
                        <Loader2 size={11} className="data-spin" /> {tf}
                      </span>
                    );
                  } else {
                    chipElement = (
                      <span className="data-tf-chip missing">
                        <Circle size={8} /> {tf}
                      </span>
                    );
                  }

                  return (
                    <div
                      key={tf}
                      className="data-tf-chip-wrapper"
                      onClick={() => setActivePopover(isHovered ? null : { symbolId: sym.id, tf })}
                      style={{ cursor: 'pointer' }}
                    >
                      {chipElement}
                      {isHovered && (
                        <div className="data-tf-popover">
                          <div className="data-tf-popover-title">
                            <span>{tf} Dataset Detail</span>
                            <span className={isMasterTf ? 'data-master-tag' : 'data-tf-chip available'} style={{ fontSize: '0.6rem' }}>
                              {isMasterTf ? 'Master SSoT' : 'Derived'}
                            </span>
                          </div>
                          <div className="data-tf-popover-body">
                            <div className="data-tf-popover-row">
                              <span className="data-tf-popover-label">Status:</span>
                              <span className="data-tf-popover-value" style={{ color: state === 'AVAILABLE' ? '#4ade80' : state === 'GENERATING' ? '#fbbf24' : '#64748b' }}>
                                {state}
                              </span>
                            </div>
                            <div className="data-tf-popover-row">
                              <span className="data-tf-popover-label">Candles:</span>
                              <span className="data-tf-popover-value">
                                {stat ? stat.candleCount.toLocaleString('en-US') : (state === 'AVAILABLE' ? 'Stored' : '0')} Bars
                              </span>
                            </div>
                            <div className="data-tf-popover-row">
                              <span className="data-tf-popover-label">Date Range:</span>
                              <span className="data-tf-popover-value" style={{ fontSize: '0.65rem' }}>
                                {stat?.firstTime ? `${formatDate(stat.firstTime)} – ${formatDate(stat.lastTime)}` : (state === 'AVAILABLE' ? 'Full Session' : 'N/A')}
                              </span>
                            </div>
                            <div className="data-tf-popover-row">
                              <span className="data-tf-popover-label">Storage:</span>
                              <span className="data-tf-popover-value">SQLite</span>
                            </div>
                            <div className="data-tf-popover-row">
                              <span className="data-tf-popover-label">Source:</span>
                              <span className="data-tf-popover-value" style={{ fontSize: '0.65rem' }}>
                                {isMasterTf ? 'Dukascopy / CSV' : 'Derived from M1'}
                              </span>
                            </div>
                          </div>
                          
                          {/* Hapus Timeframe Button */}
                          {tf !== 'M1' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteTf({ symbolId: sym.id, name: sym.name, tf });
                                setActivePopover(null);
                              }}
                              style={{
                                marginTop: '0.75rem',
                                width: '100%',
                                padding: '0.4rem',
                                backgroundColor: `${theme.candle.bear.body}22`,
                                color: theme.candle.bear.body,
                                border: `1px solid ${theme.candle.bear.body}55`,
                                borderRadius: '4px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.35rem',
                                fontSize: '0.75rem',
                              }}
                              title={`Delete ${tf} data for ${sym.name}`}
                            >
                              <Trash2 size={12} /> Delete Timeframe
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                };

                const dateSpan = calculateDateSpan(sym.firstTime, sym.lastTime);

                return (
                  <tr key={sym.id} style={{ borderColor: theme.app.border }}>
                    <td style={{ color: theme.text.primary, fontWeight: 700, fontSize: '0.95rem' }}>
                      {sym.name}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <span className="data-tf-chip available" style={{ fontWeight: 800 }}>
                          <Check size={11} /> M1
                        </span>
                        <span className="data-master-tag">MASTER</span>
                      </div>
                    </td>
                    <td>
                      <div className="data-tf-chip-grid">
                        {rowsOfTfs.map((row, idx) => (
                          <div key={idx} className="data-tf-chips-row">
                            {row.map((item) => renderChipItem(item))}
                          </div>
                        ))}
                        <div className="data-tf-summary-bar">
                          <span className="data-tf-summary-item available">
                            <CheckCircle2 size={12} /> {availableCount} Available
                          </span>
                          <span className="data-tf-summary-item missing">
                            <Circle size={10} /> {missingCount} Missing
                          </span>
                          {generatingCount > 0 && (
                            <span className="data-tf-summary-item generating">
                              <Loader2 size={12} className="data-spin" /> {generatingCount} Generating
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td style={{ color: theme.text.secondary }}>
                      <div style={{ fontSize: '0.675rem', color: theme.text.muted, marginBottom: '0.1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        DATASET RANGE
                      </div>
                      <div style={{ fontWeight: 600, color: theme.text.primary }}>
                        {formatDate(sym.firstTime)} – {formatDate(sym.lastTime)}
                      </div>
                      {dateSpan && (
                        <div style={{ fontSize: '0.725rem', color: theme.text.secondary, marginTop: '0.15rem' }}>
                          {dateSpan}
                        </div>
                      )}
                    </td>

                    <td>
                      {(() => {
                        const valRes = validatedResults[sym.id] || validatedResults[sym.name];
                        const isValidating = isValidatingGaps === sym.id;
                        const isRecovering = isRecoveringGaps === sym.id;

                        if (isValidating) {
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.35rem' }}>
                              <span
                                className="data-status-badge"
                                style={{
                                  backgroundColor: '#3b82f622',
                                  color: '#3b82f6',
                                  fontSize: '0.725rem',
                                  fontWeight: 700,
                                }}
                              >
                                ⏳ Validating against Dukascopy...
                              </span>
                              <button
                                className="data-btn-secondary"
                                disabled
                                style={{
                                  padding: '0.25rem 0.5rem',
                                  fontSize: '0.675rem',
                                  opacity: 0.6,
                                  cursor: 'not-allowed',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                }}
                              >
                                <Loader2 size={12} className="data-spin" />
                                Validating...
                              </button>
                            </div>
                          );
                        }

                        if (isRecovering) {
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.35rem' }}>
                              <span
                                className="data-status-badge"
                                style={{
                                  backgroundColor: '#ef444422',
                                  color: '#ef4444',
                                  fontSize: '0.725rem',
                                  fontWeight: 700,
                                }}
                              >
                                ⏳ Downloading missing ranges...
                              </span>
                              <button
                                className="data-btn-secondary"
                                disabled
                                style={{
                                  padding: '0.25rem 0.5rem',
                                  fontSize: '0.675rem',
                                  opacity: 0.6,
                                  cursor: 'not-allowed',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                }}
                              >
                                <Loader2 size={12} className="data-spin" />
                                Downloading...
                              </button>
                            </div>
                          );
                        }

                        if (valRes) {
                          if (valRes.status === 'COMPLETE' || valRes.confirmedMissingRangesCount === 0) {
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
                                <span
                                  className="data-status-badge"
                                  style={{
                                    backgroundColor: theme.candle.bull.body + '22',
                                    color: theme.candle.bull.body,
                                    fontSize: '0.725rem',
                                    fontWeight: 700,
                                  }}
                                >
                                  <CheckCircle2 size={12} /> COMPLETE
                                </span>
                                <span style={{ fontSize: '0.675rem', color: theme.text.secondary }}>
                                  Source: Dukascopy ✓
                                </span>
                                <button
                                  className="data-btn-secondary"
                                  onClick={() => handleValidateSourceAvailability(sym)}
                                  style={{
                                    padding: '0.25rem 0.55rem',
                                    fontSize: '0.675rem',
                                    backgroundColor: '#3b82f622',
                                    color: '#60a5fa',
                                    borderColor: '#3b82f666',
                                    cursor: 'pointer',
                                    marginTop: '0.2rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    fontWeight: 600,
                                  }}
                                >
                                  <RefreshCw size={12} />
                                  Validate Again
                                </button>
                              </div>
                            );
                          }

                          if (valRes.status === 'MISSING_DATA' || valRes.status === 'ACTUAL_MISSING_DATA' || (valRes.confirmedMissingRanges && valRes.confirmedMissingRanges.length > 0)) {
                            const ranges = valRes.confirmedMissingRanges || valRes.missingRanges || [];
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.35rem' }}>
                                <span
                                  className="data-status-badge"
                                  style={{
                                    backgroundColor: '#ef444422',
                                    color: '#ef4444',
                                    fontSize: '0.725rem',
                                    fontWeight: 700,
                                  }}
                                >
                                  ⚠ MISSING DATA CONFIRMED ({ranges.length} Range{ranges.length > 1 ? 's' : ''})
                                </span>
                                <div style={{ fontSize: '0.675rem', color: theme.text.secondary, maxWidth: '200px' }}>
                                  {ranges.slice(0, 2).map((g: any, i: number) => (
                                    <div key={i} style={{ color: '#f87171', fontWeight: 600 }}>
                                      {g.formattedFrom.split(' ')[0]} → {g.formattedTo.split(' ')[0]}
                                    </div>
                                  ))}
                                  {ranges.length > 2 && <div>+{ranges.length - 2} more missing range(s)</div>}
                                </div>
                                <button
                                  className="data-btn-secondary"
                                  onClick={() => setConfirmingSymbol({ sym, ranges })}
                                  style={{
                                    padding: '0.25rem 0.5rem',
                                    fontSize: '0.675rem',
                                    backgroundColor: '#ef444422',
                                    color: '#ef4444',
                                    borderColor: '#ef444466',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                  }}
                                >
                                  <Download size={12} />
                                  Download Missing Data
                                </button>
                              </div>
                            );
                          }

                          if (valRes.status === 'SOURCE_UNAVAILABLE') {
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.35rem' }}>
                                <span
                                  className="data-status-badge"
                                  style={{
                                    backgroundColor: '#f59e0b22',
                                    color: '#f59e0b',
                                    fontSize: '0.725rem',
                                    fontWeight: 700,
                                  }}
                                >
                                  ⚠ SOURCE UNAVAILABLE
                                </span>
                                <span style={{ fontSize: '0.675rem', color: theme.text.secondary, maxWidth: '180px' }}>
                                  Dukascopy validation could not be completed.
                                </span>
                                <button
                                  className="data-btn-secondary"
                                  onClick={() => handleValidateSourceAvailability(sym)}
                                  style={{
                                    padding: '0.25rem 0.5rem',
                                    fontSize: '0.675rem',
                                    backgroundColor: '#f59e0b22',
                                    color: '#f59e0b',
                                    borderColor: '#f59e0b66',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                  }}
                                >
                                  <RefreshCw size={12} />
                                  Retry Validation
                                </button>
                              </div>
                            );
                          }
                        }

                        // Default State before validation
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.35rem' }}>
                            <span
                              className="data-status-badge"
                              style={{
                                backgroundColor: '#f59e0b22',
                                color: '#f59e0b',
                                fontSize: '0.725rem',
                                fontWeight: 700,
                              }}
                            >
                              Not Validated
                            </span>
                            <button
                              className="data-btn-secondary"
                              onClick={() => handleValidateSourceAvailability(sym)}
                              style={{
                                padding: '0.25rem 0.5rem',
                                fontSize: '0.675rem',
                                backgroundColor: '#f59e0b22',
                                color: '#f59e0b',
                                borderColor: '#f59e0b66',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                              }}
                            >
                              <RefreshCw size={12} />
                              Validate Against Dukascopy
                            </button>
                          </div>
                        );
                      })()}
                    </td>
                    <td style={{ color: theme.text.primary, fontWeight: 700 }}>
                      <div>{sym.candleCount.toLocaleString('en-US')}</div>
                      <div style={{ fontSize: '0.725rem', color: theme.text.secondary, fontWeight: 500 }}>Bars</div>
                    </td>
                    <td>
                      {missingCount === 0 ? (
                        <>
                          <span
                            className="data-status-badge"
                            style={{
                              backgroundColor: theme.candle.bull.body + '22',
                              color: theme.candle.bull.body,
                            }}
                          >
                            <CheckCircle2 size={12} /> READY
                          </span>
                          <div style={{ fontSize: '0.7rem', color: theme.text.secondary, marginTop: '0.2rem', textAlign: 'center' }}>
                            11 Available / 0 Missing
                          </div>
                        </>
                      ) : isGeneratingThis ? (
                        <>
                          <span
                            className="data-status-badge"
                            style={{
                              backgroundColor: '#fbbf2422',
                              color: '#fbbf24',
                            }}
                          >
                            <Loader2 size={12} className="data-spin" /> GENERATING
                          </span>
                          <div style={{ fontSize: '0.7rem', color: theme.text.secondary, marginTop: '0.2rem', textAlign: 'center' }}>
                            {derivedProgress?.symbolId === sym.id ? derivedProgress.message : 'Generating...'}
                          </div>
                        </>
                      ) : (
                        <>
                          <span
                            className="data-status-badge"
                            style={{
                              backgroundColor: '#64748b22',
                              color: '#94a3b8',
                            }}
                          >
                            <Circle size={12} /> INCOMPLETE
                          </span>
                          <div style={{ fontSize: '0.7rem', color: theme.text.secondary, marginTop: '0.2rem', textAlign: 'center' }}>
                            {availableCount} Available / {missingCount} Missing
                          </div>
                        </>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }}>
                        <button
                          className="data-btn-secondary"
                          onClick={() => handleBackfill(sym.id, missingCount === 0)}
                          disabled={isGeneratingThis}
                          title={
                            missingCount > 0
                              ? `Generate ${missingCount} Missing Timeframe(s) (M3..Monthly)`
                              : 'Re-aggregate and sync all timeframes (M3..Monthly) with newly imported M1 candles'
                          }
                          style={{
                            padding: '0.35rem 0.65rem',
                            fontSize: '0.725rem',
                            backgroundColor: missingCount > 0 ? theme.app.accent + '22' : '#3b82f618',
                            color: missingCount > 0 ? theme.app.accent : '#60a5fa',
                            borderColor: missingCount > 0 ? theme.app.accent + '44' : '#3b82f644',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.35rem',
                            whiteSpace: 'nowrap',
                            cursor: isGeneratingThis ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {isBackfilling === sym.id ? (
                            <Loader2 size={12} className="data-spin" />
                          ) : (
                            <RefreshCw size={12} />
                          )}
                          <span>
                            {isBackfilling === sym.id
                              ? 'Syncing...'
                              : missingCount > 0
                              ? `Generate Missing (${missingCount})`
                              : 'Sync Timeframes'}
                          </span>
                        </button>
                        <button
                          className="data-btn-secondary"
                          onClick={() => handleSyncNewsOnly(sym.name, sym.firstTime, sym.lastTime)}
                          disabled={isSyncingNews === sym.name}
                          title={`Sync Economic News Calendar for ${sym.name}`}
                          style={{
                            padding: '0.35rem 0.65rem',
                            fontSize: '0.725rem',
                            backgroundColor: '#10b98118',
                            color: '#34d399',
                            borderColor: '#10b98144',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.35rem',
                            whiteSpace: 'nowrap',
                            cursor: isSyncingNews === sym.name ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {isSyncingNews === sym.name ? (
                            <Loader2 size={12} className="data-spin" />
                          ) : (
                            <span style={{ fontSize: '11px' }}>🗞️</span>
                          )}
                          <span>
                            {isSyncingNews === sym.name ? 'Syncing News...' : 'Sync News'}
                          </span>
                        </button>
                        <button
                          className="data-btn-secondary"
                          onClick={() => handleGenerateCustom(sym.id, sym.name)}
                          disabled={isGeneratingCustom === sym.id}
                          title={`Generate Custom Timeframe for ${sym.name}`}
                          style={{
                            padding: '0.35rem 0.65rem',
                            fontSize: '0.725rem',
                            backgroundColor: '#8b5cf618',
                            color: '#a78bfa',
                            borderColor: '#8b5cf644',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.35rem',
                            whiteSpace: 'nowrap',
                            cursor: isGeneratingCustom === sym.id ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {isGeneratingCustom === sym.id ? (
                            <Loader2 size={12} className="data-spin" />
                          ) : (
                            <span style={{ fontSize: '11px', fontWeight: 'bold' }}>+</span>
                          )}
                          <span>
                            {isGeneratingCustom === sym.id ? 'Generating...' : 'Custom TF'}
                          </span>
                        </button>
                        <button
                          className="data-delete-btn"
                          onClick={() => setConfirmDeletePair({ id: sym.id, name: sym.name })}
                          title="Delete Master Symbol Dataset"
                          style={{ 
                            color: theme.candle.bear.body, 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            padding: '0.35rem', 
                            marginTop: '0.25rem', 
                            border: `1px solid ${theme.candle.bear.body}44`,
                            borderRadius: '4px',
                            backgroundColor: `${theme.candle.bear.body}11`
                          }}
                        >
                          <Trash2 size={14} /> <span style={{ marginLeft: '0.35rem', fontSize: '0.7rem' }}>Delete Pair</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {confirmingSymbol && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              backgroundColor: theme.app.sidebar,
              border: `1px solid ${theme.app.border}`,
              borderRadius: '8px',
              padding: '1.5rem',
              maxWidth: '480px',
              width: '90%',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
            }}
          >
            <h3 style={{ margin: 0, color: theme.text.primary, fontSize: '1.1rem', fontWeight: 700 }}>
              Dukascopy Validation Result
            </h3>
            <div style={{ fontSize: '0.9rem', color: theme.app.accent, fontWeight: 600 }}>
              {confirmingSymbol.sym.name}
            </div>

            <div style={{ fontSize: '0.8rem', color: theme.candle.bull.body, fontWeight: 600 }}>
              ✓ Source validation completed
            </div>

            <div style={{ fontSize: '0.825rem', color: theme.text.primary, fontWeight: 600 }}>
              Confirmed missing data: {confirmingSymbol.ranges.length} range(s)
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '160px', overflowY: 'auto' }}>
              {confirmingSymbol.ranges.map((r: any, idx: number) => (
                <div
                  key={idx}
                  style={{
                    fontSize: '0.75rem',
                    color: '#f87171',
                    backgroundColor: '#ef444411',
                    padding: '0.4rem 0.6rem',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                  }}
                >
                  {r.formattedFrom} → {r.formattedTo}
                </div>
              ))}
            </div>

            <div style={{ fontSize: '0.725rem', color: theme.text.muted }}>
              Source: Dukascopy ✓ | Confidence: CONFIRMED
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                className="data-btn-secondary"
                onClick={() => setConfirmingSymbol(null)}
                style={{
                  padding: '0.4rem 0.85rem',
                  fontSize: '0.8rem',
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  color: '#94a3b8',
                  borderColor: 'rgba(255,255,255,0.15)',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                className="data-btn-primary"
                onClick={() => {
                  const targetSym = confirmingSymbol.sym;
                  const targetRanges = confirmingSymbol.ranges;
                  setConfirmingSymbol(null);
                  handleRecoverMissingData(targetSym.id, targetSym.name, targetRanges);
                }}
                style={{
                  padding: '0.4rem 0.85rem',
                  fontSize: '0.8rem',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  borderColor: '#ef4444',
                }}
              >
                Download Missing Data
              </button>
            </div>
          </div>
        </div>
      )}

      {customTfPrompt && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              backgroundColor: theme.app.sidebar,
              border: `1px solid ${theme.app.border}`,
              borderRadius: '8px',
              padding: '1.5rem',
              maxWidth: '400px',
              width: '90%',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
            }}
          >
            <h3 style={{ margin: 0, color: theme.text.primary, fontSize: '1.1rem', fontWeight: 700 }}>
              Generate Custom Timeframe
            </h3>
            <div style={{ fontSize: '0.85rem', color: theme.text.secondary }}>
              Select a unit and enter the value for <span style={{ color: theme.app.accent, fontWeight: 700 }}>{customTfPrompt.symbolName}</span>.
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              {[
                { label: 'Minutes', val: 'M' },
                { label: 'Hours', val: 'H' },
                { label: 'Days', val: 'D' },
                { label: 'Weeks', val: 'W' },
              ].map((unit) => (
                <button
                  key={unit.val}
                  onClick={() => setCustomTfUnit(unit.val)}
                  style={{
                    flex: 1,
                    padding: '0.45rem',
                    fontSize: '0.75rem',
                    borderRadius: '4px',
                    backgroundColor: customTfUnit === unit.val ? '#8b5cf6' : 'rgba(255,255,255,0.05)',
                    color: customTfUnit === unit.val ? '#fff' : theme.text.secondary,
                    border: `1px solid ${customTfUnit === unit.val ? '#8b5cf6' : 'rgba(255,255,255,0.1)'}`,
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {unit.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="number"
                min="1"
                autoFocus
                placeholder="Enter value (e.g. 7)"
                value={customTfInput}
                onChange={(e) => setCustomTfInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') executeCustomTfGeneration();
                  if (e.key === 'Escape') setCustomTfPrompt(null);
                }}
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(0,0,0,0.2)',
                  border: `1px solid ${theme.app.border}`,
                  color: theme.text.primary,
                  padding: '0.65rem',
                  borderRadius: '6px',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
              <div style={{
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: `1px solid ${theme.app.border}`,
                color: theme.text.primary,
                padding: '0.65rem 1rem',
                borderRadius: '6px',
                fontSize: '0.9rem',
                fontWeight: 'bold'
              }}>
                {customTfUnit}
              </div>
            </div>

            <div style={{ fontSize: '0.75rem', color: theme.text.muted }}>
              Resulting timeframe: <span style={{ fontWeight: 'bold', color: theme.text.primary }}>{customTfInput || '?'}{customTfUnit}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                className="data-btn-secondary"
                onClick={() => setCustomTfPrompt(null)}
                style={{
                  padding: '0.4rem 0.85rem',
                  fontSize: '0.8rem',
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  color: '#94a3b8',
                  borderColor: 'rgba(255,255,255,0.15)',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                className="data-btn-primary"
                onClick={executeCustomTfGeneration}
                disabled={!customTfInput.trim()}
                style={{
                  padding: '0.4rem 0.85rem',
                  fontSize: '0.8rem',
                  backgroundColor: customTfInput.trim() ? '#8b5cf6' : '#8b5cf666',
                  color: '#ffffff',
                  borderColor: customTfInput.trim() ? '#8b5cf6' : 'transparent',
                  cursor: customTfInput.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Generate
              </button>
            </div>
          </div>
        </div>
      )}
      {/* CONFIRM DELETE PAIR MODAL */}
      {confirmDeletePair && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              backgroundColor: theme.app.sidebar, border: `1px solid ${theme.app.border}`,
              borderRadius: '8px', padding: '1.5rem', maxWidth: '420px', width: '90%',
              display: 'flex', flexDirection: 'column', gap: '1rem',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
            }}
          >
            <h3 style={{ margin: 0, color: theme.text.primary, fontSize: '1.1rem', fontWeight: 700 }}>
              Delete Pair Data?
            </h3>
            <p style={{ margin: 0, color: theme.text.secondary, fontSize: '0.85rem', lineHeight: '1.4' }}>
              Are you sure you want to delete <strong style={{ color: theme.text.primary }}>{confirmDeletePair.name}</strong>? 
              This will remove all associated timeframes, candles, and imported datasets permanently.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                className="data-btn-secondary"
                onClick={() => setConfirmDeletePair(null)}
                style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await removeSymbol(confirmDeletePair.id);
                  setConfirmDeletePair(null);
                }}
                style={{
                  padding: '0.4rem 0.85rem', fontSize: '0.8rem', cursor: 'pointer',
                  backgroundColor: theme.candle.bear.body, color: '#fff',
                  border: 'none', borderRadius: '4px', fontWeight: 600
                }}
              >
                Delete Pair
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE TIMEFRAME MODAL */}
      {confirmDeleteTf && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              backgroundColor: theme.app.sidebar, border: `1px solid ${theme.app.border}`,
              borderRadius: '8px', padding: '1.5rem', maxWidth: '420px', width: '90%',
              display: 'flex', flexDirection: 'column', gap: '1rem',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
            }}
          >
            <h3 style={{ margin: 0, color: theme.text.primary, fontSize: '1.1rem', fontWeight: 700 }}>
              Delete Timeframe?
            </h3>
            <p style={{ margin: 0, color: theme.text.secondary, fontSize: '0.85rem', lineHeight: '1.4' }}>
              Are you sure you want to delete the <strong style={{ color: theme.text.primary }}>{confirmDeleteTf.tf}</strong> timeframe for <strong style={{ color: theme.text.primary }}>{confirmDeleteTf.name}</strong>?
              This will free up storage space, but you will need to re-generate it if you need it again.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                className="data-btn-secondary"
                onClick={() => setConfirmDeleteTf(null)}
                style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await removeTimeframe(confirmDeleteTf.symbolId, confirmDeleteTf.tf);
                  setConfirmDeleteTf(null);
                }}
                style={{
                  padding: '0.4rem 0.85rem', fontSize: '0.8rem', cursor: 'pointer',
                  backgroundColor: theme.candle.bear.body, color: '#fff',
                  border: 'none', borderRadius: '4px', fontWeight: 600
                }}
              >
                Delete Timeframe
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default DataHubView;
