import { useState } from 'react';
import { ChevronRight, ChevronDown, Trash2, RefreshCw, FileX } from 'lucide-react';
import { TIMEFRAME_OPTIONS, type SymbolInfo, type Timeframe } from '@/types';
import { useSymbols } from '../useSymbols';
import { useDatasets } from '../useDatasets';
import { canDisplayTimeframe } from '@features/chart/timeframeAvailability';
import './DataManagementPanel.css';

function formatNumber(n: number): string {
  return n.toLocaleString('id-ID');
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDateTime(unixSeconds: number | null): string {
  if (unixSeconds === null) return '—';
  const d = new Date(unixSeconds * 1000);
  return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

/** Get all timeframes that can be displayed for this symbol (native + aggregated). */
function getAvailableTimeframes(symbol: SymbolInfo): { tf: Timeframe; isNative: boolean }[] {
  return TIMEFRAME_OPTIONS
    .filter((opt) => canDisplayTimeframe(symbol, opt.value))
    .map((opt) => ({
      tf: opt.value,
      isNative: symbol.timeframes.includes(opt.value),
    }));
}

interface SymbolRowProps {
  symbol: SymbolInfo;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  /** Callback when a specific dataset (file) is deleted. */
  onDatasetDeleted: () => void;
}

function SymbolRow({ symbol, expanded, onToggle, onDelete, onDatasetDeleted }: SymbolRowProps) {
  const { datasets, loading, removeDataset } = useDatasets(expanded ? symbol.id : null);
  const availableTFs = getAvailableTimeframes(symbol);

  const handleDeleteDataset = async (dataset: typeof datasets[0]) => {
    const confirmed = window.confirm(
      `Hapus dataset ini?\n\n` +
      `File: ${dataset.fileName}\n` +
      `Timeframe: ${dataset.timeframe}\n` +
      `Range: ${formatDateTime(dataset.firstTime)} → ${formatDateTime(dataset.lastTime)}\n` +
      `Candle baru: ${formatNumber(dataset.rowsInserted)}\n\n` +
      `Candle yang sudah ada dari import lain TIDAK akan dihapus.\n` +
      `Tindakan ini tidak bisa dibatalkan.`
    );
    if (!confirmed) return;
    await removeDataset(dataset.id);
    onDatasetDeleted();
  };

  return (
    <div className="data-mgmt__row">
      <button className="data-mgmt__row-header" onClick={onToggle}>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="data-mgmt__symbol-name">{symbol.name}</span>
        <span className="data-mgmt__badges">
          {availableTFs.map(({ tf, isNative }) => (
            <span
              key={tf}
              className={`data-mgmt__badge mono ${isNative ? '' : 'data-mgmt__badge--agg'}`}
              title={isNative ? 'Native data' : 'Aggregated from finer timeframe'}
            >
              {tf}
            </span>
          ))}
        </span>
        <span className="data-mgmt__meta mono">{formatNumber(symbol.candleCount)} candle</span>
        <span className="data-mgmt__meta mono">
          {formatDateTime(symbol.firstTime)} → {formatDateTime(symbol.lastTime)}
        </span>
        <span className="data-mgmt__meta data-mgmt__meta--dim mono">
          update: {symbol.lastUpdatedAt ? formatDateTime(symbol.lastUpdatedAt) : '—'}
        </span>
        <span
          role="button"
          tabIndex={0}
          className="data-mgmt__delete"
          title={`Hapus seluruh data ${symbol.name} (semua timeframe)`}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
              onDelete();
            }
          }}
        >
          <Trash2 size={13} />
        </span>
      </button>

      {expanded && (
        <div className="data-mgmt__datasets">
          {loading ? (
            <div className="data-mgmt__empty-small">Memuat riwayat import...</div>
          ) : datasets.length === 0 ? (
            <div className="data-mgmt__empty-small">
              Belum ada riwayat import tercatat untuk symbol ini.
            </div>
          ) : (
            <table className="data-mgmt__table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>TF</th>
                  <th>Diimpor</th>
                  <th>Valid</th>
                  <th>Duplikat</th>
                  <th>Baru</th>
                  <th>Est. Size</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {datasets.map((d) => (
                  <tr key={d.id}>
                    <td className="data-mgmt__file-name" title={d.filePath ?? undefined}>
                      {d.fileName}
                    </td>
                    <td className="mono">{d.timeframe}</td>
                    <td className="mono">{formatDateTime(d.importedAt)}</td>
                    <td className="mono">{formatNumber(d.rowsValid)}</td>
                    <td className="mono">{formatNumber(d.rowsDuplicate)}</td>
                    <td className="mono">{formatNumber(d.rowsInserted)}</td>
                    <td className="mono">{formatBytes(d.rowsInserted * 64)}</td>
                    <td>
                      <button
                        className="data-mgmt__delete-dataset"
                        title={`Hapus dataset ${d.fileName}`}
                        onClick={() => handleDeleteDataset(d)}
                      >
                        <FileX size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Day 3 — Data Management tab. Read-heavy view of what's actually in
 * the local SQLite database (symbols + per-file import history), with
 * a symbol-level delete action. All numbers come from real queries
 * (useSymbols/useDatasets → IPC → db.ts) — nothing here is hardcoded.
 *
 * Day 18: Shows all available timeframes (native + aggregated) with
 * visual distinction between native and aggregated timeframes.
 * Day 19: Safe delete with improved confirmation and per-dataset delete.
 */
export default function DataManagementPanel() {
  const { symbols, loading, refresh, remove } = useSymbols();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const handleDeleteSymbol = async (symbol: SymbolInfo) => {
    const availableTFs = getAvailableTimeframes(symbol);
    const nativeTFs = symbol.timeframes.join(', ');
    const aggTFs = availableTFs
      .filter((t) => !t.isNative)
      .map((t) => t.tf)
      .join(', ');

    const confirmed = window.confirm(
      `Hapus seluruh data untuk "${symbol.name}"?\n\n` +
      `Timeframe native: ${nativeTFs || '—'}\n` +
      `Timeframe aggregated: ${aggTFs || '—'}\n` +
      `Range: ${formatDateTime(symbol.firstTime)} → ${formatDateTime(symbol.lastTime)}\n` +
      `Total candle: ${formatNumber(symbol.candleCount)}\n\n` +
      `SEMUA candle dan riwayat import untuk symbol ini akan dihapus.\n` +
      `Timeframe aggregated (jika ada) juga akan hilang karena dihitung dari data native.\n\n` +
      `Tindakan ini tidak bisa dibatalkan.`
    );
    if (!confirmed) return;
    await remove(symbol.id);
    if (expandedId === symbol.id) setExpandedId(null);
  };

  return (
    <div className="data-mgmt">
      <div className="data-mgmt__toolbar">
        <span className="data-mgmt__count">
          {symbols.length} symbol &middot;{' '}
          {formatNumber(symbols.reduce((sum, s) => sum + s.candleCount, 0))} candle
        </span>
        <button className="data-mgmt__refresh" onClick={() => refresh()} title="Refresh">
          <RefreshCw size={13} className={loading ? 'data-mgmt__spin' : ''} />
          Refresh
        </button>
      </div>

      {symbols.length === 0 ? (
        <div className="data-mgmt__empty-small">
          Belum ada data. Gunakan tombol &quot;Import Data&quot; di Top Bar untuk mulai.
        </div>
      ) : (
        <div className="data-mgmt__list">
          {symbols.map((s) => (
            <SymbolRow
              key={s.id}
              symbol={s}
              expanded={expandedId === s.id}
              onToggle={() => setExpandedId(expandedId === s.id ? null : s.id)}
              onDelete={() => handleDeleteSymbol(s)}
              onDatasetDeleted={refresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}
