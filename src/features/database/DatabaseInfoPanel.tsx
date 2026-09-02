import { useState } from 'react';
import {
  Database,
  HardDrive,
  Activity,
  Trash2,
  Search,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  FileText,
  FolderOpen,
  Copy,
  Check,
  KeyRound,
} from 'lucide-react';
import type { DatasetStatsInfo, SymbolDetailStats, ImportLogRecord } from '@/types';
import { useDatabaseInfo } from '@features/database';
import { listDatasetStats, listSymbolStats, listImportLogs, openDataFolder } from '@features/database/api';
import './DatabaseInfoPanel.css';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatNumber(n: number): string {
  return n.toLocaleString('id-ID');
}

function formatDateTime(unixSeconds: number | null): string {
  if (unixSeconds === null) return '—';
  const d = new Date(unixSeconds * 1000);
  return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

function formatDateTimeShort(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  return d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'SUCCESS'
      ? 'db-info__badge--ok'
      : status === 'FAILED'
        ? 'db-info__badge--fail'
        : 'db-info__badge--partial';
  return <span className={`db-info__badge ${cls}`}>{status}</span>;
}

// ─── Section: Database Info ───────────────────────────────────────

function InfoSection({
  info,
  stats,
  health,
}: {
  info: ReturnType<typeof useDatabaseInfo>['info'];
  stats: ReturnType<typeof useDatabaseInfo>['stats'];
  health: ReturnType<typeof useDatabaseInfo>['health'];
}) {
  const [copied, setCopied] = useState(false);

  if (!info || !stats) return <div className="db-info__loading">Memuat info database...</div>;

  const handleCopy = () => {
    if (info.dbPath) {
      navigator.clipboard.writeText(info.dbPath);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenFolder = () => {
    openDataFolder().catch((err) => console.error('[DatabaseInfo] Failed to open folder:', err));
  };

  return (
    <div className="db-info__section">
      <div className="db-info__grid">
        <div className="db-info__card" style={{ gridColumn: 'span 2' }}>
          <div className="db-info__card-icon">
            <Database size={14} />
          </div>
          <div className="db-info__card-body" style={{ width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <div className="db-info__card-label">Database Path (SQLite)</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={handleCopy}
                  title="Salin path ke clipboard"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    fontSize: '11px',
                    background: '#1e2430',
                    border: '1px solid #242934',
                    borderRadius: '4px',
                    color: '#cbd5e1',
                    cursor: 'pointer',
                  }}
                >
                  {copied ? <Check size={11} style={{ color: '#22c55e' }} /> : <Copy size={11} />}
                  <span>{copied ? 'Tersalin' : 'Salin'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenFolder}
                  title="Buka folder di File Explorer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    fontSize: '11px',
                    background: '#0284c7',
                    border: '1px solid #0284c7',
                    borderRadius: '4px',
                    color: '#ffffff',
                    cursor: 'pointer',
                  }}
                >
                  <FolderOpen size={11} />
                  <span>Buka Folder</span>
                </button>
              </div>
            </div>
            <div className="db-info__card-value mono" title={info.dbPath} style={{ marginTop: '4px' }}>
              {info.dbPath}
            </div>
          </div>
        </div>

        <div className="db-info__card">
          <div className="db-info__card-icon">
            <Activity size={14} />
          </div>
          <div className="db-info__card-body">
            <div className="db-info__card-label">SQLite Version</div>
            <div className="db-info__card-value mono">{info.sqliteVersion}</div>
          </div>
        </div>

        <div className="db-info__card">
          <div className="db-info__card-icon">
            <HardDrive size={14} />
          </div>
          <div className="db-info__card-body">
            <div className="db-info__card-label">Database Size</div>
            <div className="db-info__card-value mono">{formatBytes(info.dbSizeBytes)}</div>
          </div>
        </div>

        <div className="db-info__card">
          <div className="db-info__card-icon">
            <FileText size={14} />
          </div>
          <div className="db-info__card-body">
            <div className="db-info__card-label">Total Tables</div>
            <div className="db-info__card-value mono">{info.totalTables}</div>
          </div>
        </div>

        <div className="db-info__card">
          <div className="db-info__card-icon">
            <Database size={14} />
          </div>
          <div className="db-info__card-body">
            <div className="db-info__card-label">Total Symbols</div>
            <div className="db-info__card-value mono">{formatNumber(info.totalSymbols)}</div>
          </div>
        </div>

        <div className="db-info__card">
          <div className="db-info__card-icon">
            <FileText size={14} />
          </div>
          <div className="db-info__card-body">
            <div className="db-info__card-label">Total Datasets</div>
            <div className="db-info__card-value mono">{formatNumber(info.totalDatasets)}</div>
          </div>
        </div>

        <div className="db-info__card">
          <div className="db-info__card-icon">
            <Activity size={14} />
          </div>
          <div className="db-info__card-body">
            <div className="db-info__card-label">Total Candles</div>
            <div className="db-info__card-value mono">{formatNumber(info.totalCandles)}</div>
          </div>
        </div>

        <div className="db-info__card">
          <div className="db-info__card-icon">
            <Activity size={14} />
          </div>
          <div className="db-info__card-body">
            <div className="db-info__card-label">Data Range</div>
            <div className="db-info__card-value mono">
              {formatDateTime(stats.earliestData)} → {formatDateTime(stats.latestData)}
            </div>
          </div>
        </div>
      </div>

      {health && (
        <div className={`db-info__health ${health.healthy ? 'db-info__health--ok' : 'db-info__health--warn'}`}>
          <div className="db-info__health-header">
            {health.healthy ? <CheckCircle size={13} /> : <AlertTriangle size={13} />}
            <span>{health.message}</span>
          </div>
          <div className="db-info__health-details">
            {health.details.map((d, i) => (
              <div key={i} className="db-info__health-detail">
                {d}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section: Cleanup ─────────────────────────────────────────────

function CleanupSection({
  onVacuum,
  onAnalyze,
  refreshing,
}: {
  onVacuum: () => Promise<boolean>;
  onAnalyze: () => Promise<boolean>;
  refreshing: boolean;
}) {
  const [vacuuming, setVacuuming] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [lastVacuum, setLastVacuum] = useState<string | null>(null);
  const [lastAnalyze, setLastAnalyze] = useState<string | null>(null);

  const handleVacuum = async () => {
    setVacuuming(true);
    try {
      const ok = await onVacuum();
      if (ok) setLastVacuum(new Date().toLocaleTimeString());
    } finally {
      setVacuuming(false);
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const ok = await onAnalyze();
      if (ok) setLastAnalyze(new Date().toLocaleTimeString());
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="db-info__section">
      <div className="db-info__cleanup">
        <div className="db-info__cleanup-item">
          <div className="db-info__cleanup-info">
            <div className="db-info__cleanup-title">Vacuum Database</div>
            <div className="db-info__cleanup-desc">
              Reclaims unused space and defragments the database file.
            </div>
            {lastVacuum && (
              <div className="db-info__cleanup-last mono">Last run: {lastVacuum}</div>
            )}
          </div>
          <button
            className="db-info__action-btn"
            onClick={handleVacuum}
            disabled={vacuuming || refreshing}
          >
            <Trash2 size={12} />
            {vacuuming ? 'Running...' : 'Vacuum'}
          </button>
        </div>

        <div className="db-info__cleanup-item">
          <div className="db-info__cleanup-info">
            <div className="db-info__cleanup-title">Analyze Database</div>
            <div className="db-info__cleanup-desc">
              Updates query planner statistics for better performance.
            </div>
            {lastAnalyze && (
              <div className="db-info__cleanup-last mono">Last run: {lastAnalyze}</div>
            )}
          </div>
          <button
            className="db-info__action-btn"
            onClick={handleAnalyze}
            disabled={analyzing || refreshing}
          >
            <Search size={12} />
            {analyzing ? 'Running...' : 'Analyze'}
          </button>
        </div>

        <div className="db-info__cleanup-item">
          <div className="db-info__cleanup-info">
            <div className="db-info__cleanup-title">Reset / Ganti Lisensi</div>
            <div className="db-info__cleanup-desc">
              Menghapus aktivasi lisensi lokal agar dapat memasukkan serial key / kode aktivasi baru.
            </div>
          </div>
          <button
            className="db-info__action-btn"
            style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
            onClick={() => {
              if (window.confirm('Apakah Anda yakin ingin menghapus lisensi yang aktif di perangkat ini?')) {
                if ((window as any).forexReplay?.deactivateLicense) {
                  (window as any).forexReplay.deactivateLicense().then(() => {
                    window.location.reload();
                  });
                }
              }
            }}
          >
            <KeyRound size={12} />
            Reset Lisensi
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Section: Dataset Statistics ──────────────────────────────────

function DatasetStatsSection({
  datasets,
  loading,
}: {
  datasets: DatasetStatsInfo[];
  loading: boolean;
}) {
  const [expanded, setExpanded] = useState(true);

  if (loading) return <div className="db-info__loading">Memuat statistik dataset...</div>;
  if (datasets.length === 0)
    return <div className="db-info__empty">Belum ada dataset.</div>;

  return (
    <div className="db-info__section">
      <button className="db-info__section-header" onClick={() => setExpanded(!expanded)}>
        {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        Dataset Statistics ({datasets.length})
      </button>
      {expanded && (
        <div className="db-info__table-wrap">
          <table className="db-info__table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>TF</th>
                <th>File</th>
                <th>Imported</th>
                <th>Candles</th>
                <th>Range</th>
                <th>Est. Size</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {datasets.map((d) => (
                <tr key={d.datasetId}>
                  <td className="db-info__file-name">{d.symbolName}</td>
                  <td className="mono">{d.timeframe}</td>
                  <td className="db-info__file-name" title={d.fileName}>
                    {d.fileName}
                  </td>
                  <td className="mono">{formatDateTimeShort(d.importedAt)}</td>
                  <td className="mono">{formatNumber(d.candleCount)}</td>
                  <td className="mono">
                    {formatDateTime(d.firstTime)} → {formatDateTime(d.lastTime)}
                  </td>
                  <td className="mono">{formatBytes(d.estimatedSizeBytes)}</td>
                  <td>
                    <StatusBadge status={d.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Section: Symbol Statistics ───────────────────────────────────

function SymbolStatsSection({
  symbols,
  loading,
  onRefresh,
}: {
  symbols: SymbolDetailStats[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [generatingFor, setGeneratingFor] = useState<number | null>(null);

  const handleGenerateCustom = async (symbolId: number, symbolName: string) => {
    const tf = window.prompt(`Generate custom timeframe for ${symbolName} (e.g. 7M, 2H, 3D):`);
    if (!tf) return;
    setGeneratingFor(symbolId);
    try {
      await window.forexReplay.generateCustomTimeframe(symbolId, tf);
      alert(`Successfully generated custom timeframe ${tf} for ${symbolName}!`);
      onRefresh();
    } catch (e: any) {
      alert(`Error generating custom timeframe: ${e.message || e}`);
    } finally {
      setGeneratingFor(null);
    }
  };

  if (loading) return <div className="db-info__loading">Memuat statistik symbol...</div>;
  if (symbols.length === 0)
    return <div className="db-info__empty">Belum ada symbol.</div>;

  return (
    <div className="db-info__section">
      <button className="db-info__section-header" onClick={() => setExpanded(!expanded)}>
        {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        Symbol Statistics ({symbols.length})
      </button>
      {expanded && (
        <div className="db-info__symbol-list">
          {symbols.map((s) => (
            <div key={s.symbolId} className="db-info__symbol-card">
              <div className="db-info__symbol-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span className="db-info__symbol-name">{s.symbolName}</span>
                  <span className="db-info__symbol-candle mono" style={{ marginLeft: '12px', fontSize: '0.8em', color: '#94a3b8' }}>
                    {formatNumber(s.totalCandles)} candles
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleGenerateCustom(s.symbolId, s.symbolName)}
                  disabled={generatingFor === s.symbolId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    fontSize: '11px',
                    background: '#0284c7',
                    border: '1px solid #0284c7',
                    borderRadius: '4px',
                    color: '#ffffff',
                    cursor: generatingFor === s.symbolId ? 'not-allowed' : 'pointer',
                    opacity: generatingFor === s.symbolId ? 0.7 : 1,
                  }}
                >
                  <Activity size={11} />
                  <span>{generatingFor === s.symbolId ? 'Generating...' : '+ Custom TF'}</span>
                </button>
              </div>
              <div className="db-info__symbol-details">
                <div className="db-info__symbol-row">
                  <span className="db-info__symbol-label">Native Timeframe:</span>
                  <div className="db-info__symbol-badges">
                    {s.nativeTimeframes.map((tf) => (
                      <span key={tf} className="db-info__badge db-info__badge--native mono">
                        {tf}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="db-info__symbol-row">
                  <span className="db-info__symbol-label">Available:</span>
                  <div className="db-info__symbol-badges">
                    {s.availableTimeframes.map((tf) => (
                      <span
                        key={tf}
                        className={`db-info__badge mono ${
                          s.nativeTimeframes.includes(tf)
                            ? 'db-info__badge--native'
                            : 'db-info__badge--agg'
                        }`}
                      >
                        {tf}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="db-info__symbol-row">
                  <span className="db-info__symbol-label">Data Range:</span>
                  <span className="mono db-info__symbol-value">
                    {formatDateTime(s.firstTime)} → {formatDateTime(s.lastTime)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Section: Import History ──────────────────────────────────────

function ImportHistorySection({
  logs,
  loading,
}: {
  logs: ImportLogRecord[];
  loading: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  if (loading) return <div className="db-info__loading">Memuat riwayat import...</div>;
  if (logs.length === 0)
    return <div className="db-info__empty">Belum ada riwayat import.</div>;

  return (
    <div className="db-info__section">
      <button className="db-info__section-header" onClick={() => setExpanded(!expanded)}>
        {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        Import History ({logs.length})
      </button>
      {expanded && (
        <div className="db-info__table-wrap">
          <table className="db-info__table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Symbol</th>
                <th>TF</th>
                <th>File</th>
                <th>Valid</th>
                <th>Inserted</th>
                <th>Dup</th>
                <th>Skipped</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="mono">{formatDateTimeShort(l.importedAt)}</td>
                  <td>{l.symbol}</td>
                  <td className="mono">{l.timeframe || '—'}</td>
                  <td className="db-info__file-name" title={l.fileName}>
                    {l.fileName}
                  </td>
                  <td className="mono">{formatNumber(l.rowsValid)}</td>
                  <td className="mono">{formatNumber(l.rowsInserted)}</td>
                  <td className="mono">{formatNumber(l.rowsDuplicate)}</td>
                  <td className="mono">{formatNumber(l.rowsSkipped)}</td>
                  <td>
                    <StatusBadge status={l.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────

export default function DatabaseInfoPanel() {
  const { stats, info, health, loading, refreshing, refresh, runVacuum, runAnalyze } =
    useDatabaseInfo();
  const [datasets, setDatasets] = useState<DatasetStatsInfo[]>([]);
  const [symbols, setSymbols] = useState<SymbolDetailStats[]>([]);
  const [importLogs, setImportLogs] = useState<ImportLogRecord[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const refreshAll = async () => {
    setDetailLoading(true);
    try {
      const [ds, sy, il] = await Promise.all([listDatasetStats(), listSymbolStats(), listImportLogs()]);
      setDatasets(ds);
      setSymbols(sy);
      setImportLogs(il);
    } finally {
      setDetailLoading(false);
    }
  };

  // Load detail data on mount and expose a combined refresh
  const combinedRefresh = async () => {
    await refresh();
    await refreshAll();
  };

  // Load once on mount
  const [initialLoaded, setInitialLoaded] = useState(false);
  if (!initialLoaded && !loading) {
    setInitialLoaded(true);
    refreshAll();
  }

  if (loading) {
    return (
      <div className="db-info">
        <div className="db-info__loading">Memuat informasi database...</div>
      </div>
    );
  }

  return (
    <div className="db-info">
      <div className="db-info__toolbar">
        <span className="db-info__title">
          <Database size={13} />
          Database Information
        </span>
        <button
          className="db-info__refresh"
          onClick={combinedRefresh}
          disabled={refreshing || detailLoading}
          title="Refresh"
        >
          <RefreshCw
            size={12}
            className={refreshing || detailLoading ? 'db-info__spin' : ''}
          />
          Refresh
        </button>
      </div>

      <div className="db-info__content">
        <InfoSection info={info} stats={stats} health={health} />
        <CleanupSection onVacuum={runVacuum} onAnalyze={runAnalyze} refreshing={refreshing} />
        <DatasetStatsSection datasets={datasets} loading={detailLoading} />
        <SymbolStatsSection symbols={symbols} loading={detailLoading} onRefresh={refreshAll} />
        <ImportHistorySection logs={importLogs} loading={detailLoading} />
      </div>
    </div>
  );
}
