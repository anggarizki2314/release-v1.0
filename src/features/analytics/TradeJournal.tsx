import React, { useState, useMemo } from 'react';
import { BookOpen, Search, ArrowUpDown } from 'lucide-react';
import type { HistoryState } from '../trading2/store/TradingStoreTypes';
import { formatSignedCurrency } from '@/utils/formatters';
import './TradeJournal.css';

interface TradeJournalProps {
  trades: HistoryState[];
}

export const TradeJournal: React.FC<TradeJournalProps> = ({ trades }) => {
  const [search, setSearch] = useState('');
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [viewImageUrl, setViewImageUrl] = useState<string | null>(null);

  const filteredTrades = useMemo(() => {
    return trades.filter((t) => {
      if (directionFilter !== 'ALL' && t.direction !== directionFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const sym = (t.symbol || '').toLowerCase();
        const comment = (t.comment || '').toLowerCase();
        return sym.includes(q) || comment.includes(q);
      }
      return true;
    });
  }, [trades, search, directionFilter]);

  const formatDateTime = (timestampMs: number) => {
    if (!timestampMs) return '-';
    const d = new Date(timestampMs);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const calculateDuration = (openedAt: number, closedAt: number) => {
    if (!openedAt || !closedAt) return '-';
    const diffSec = Math.max(0, Math.floor((closedAt - openedAt) / 1000));
    if (diffSec < 60) return `${diffSec}s`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m`;
    const diffHour = Math.floor(diffMin / 60);
    const remMin = diffMin % 60;
    return `${diffHour}h ${remMin}m`;
  };

  return (
    <div className="trade-journal">
      <div className="trade-journal__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BookOpen size={18} className="trade-journal__icon" />
          <h3 className="trade-journal__title">Session Trade Journal Logs ({trades.length} Closed Trades)</h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Direction Filter */}
          <select
            style={{
              background: '#040812',
              border: '1px solid #142036',
              color: '#cbd5e1',
              fontSize: '11px',
              padding: '4px 8px',
              borderRadius: '6px',
            }}
            value={directionFilter}
            onChange={(e) => setDirectionFilter(e.target.value as any)}
          >
            <option value="ALL">All Types</option>
            <option value="BUY">BUY Only</option>
            <option value="SELL">SELL Only</option>
          </select>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search symbol / comment..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                background: '#040812',
                border: '1px solid #142036',
                color: '#cbd5e1',
                fontSize: '11px',
                padding: '4px 8px',
                borderRadius: '6px',
                width: '160px',
              }}
            />
          </div>
        </div>
      </div>

      <div className="trade-journal__table-wrap">
        {filteredTrades.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
            Belum ada trade yang ditutup pada session ini.
          </div>
        ) : (
          <table className="trade-journal__table">
            <thead>
              <tr>
                <th>Symbol / Type</th>
                <th>Entry Time / Price</th>
                <th>Exit Time / Price</th>
                <th>Lot Size</th>
                <th>Net Realized PnL</th>
                <th>Duration</th>
                <th>Screenshots</th>
                <th>Close Reason / Comment</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrades.map((trd) => {
                const netProfit = Number(trd.profit || 0) - Number(trd.commission || 0) + Number(trd.swap || 0);
                const isWin = netProfit >= 0;

                return (
                  <tr key={trd.tradeId}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 700, color: '#f8fafc' }}>{trd.symbol}</span>
                        <span
                          className={`journal-badge ${
                            trd.direction === 'BUY' ? 'journal-badge--buy' : 'journal-badge--sell'
                          }`}
                        >
                          {trd.direction}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="journal-cell-stacked">
                        <span className="journal-time">{formatDateTime(trd.openedAt)}</span>
                        <span className="journal-price">@{trd.entryPrice.toFixed(5)}</span>
                      </div>
                    </td>
                    <td>
                      <div className="journal-cell-stacked">
                        <span className="journal-time">{formatDateTime(trd.closedAt)}</span>
                        <span className="journal-price">@{trd.exitPrice.toFixed(5)}</span>
                      </div>
                    </td>
                    <td>{trd.volume.toFixed(2)} Lot</td>
                    <td>
                      <div className="journal-cell-stacked">
                        <span className={isWin ? 'journal-pnl--pos' : 'journal-pnl--neg'} style={{ fontWeight: 700 }}>
                          {formatSignedCurrency(netProfit)}
                        </span>
                        {trd.commission > 0 && (
                          <span className="journal-pnl-sub">Comm: -${trd.commission.toFixed(2)}</span>
                        )}
                      </div>
                    </td>
                    <td>{calculateDuration(trd.openedAt, trd.closedAt)}</td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                        {trd.screenshots && trd.screenshots.length > 0 ? (
                          trd.screenshots.map((ss) => (
                            <button
                              key={ss.id}
                              className="te2-btn-modify"
                              style={{ padding: '2px 6px', fontSize: '10px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}
                              onClick={() => setViewImageUrl(ss.dataUrl)}
                              title={`Lihat Screenshot ${ss.timeframe}`}
                            >
                              {ss.timeframe} 📷
                            </button>
                          ))
                        ) : (
                          <span style={{ color: '#475569', fontSize: '11px' }}>-</span>
                        )}
                      </div>
                    </td>
                    <td className="journal-cell-comment">{trd.comment || 'MANUAL_CLOSE'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {viewImageUrl && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)', zIndex: 99999,
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            padding: '20px'
          }}
          onClick={() => setViewImageUrl(null)}
        >
          <img
            src={viewImageUrl}
            alt="Screenshot Preview"
            style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: '8px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            style={{
              position: 'absolute', top: '20px', right: '30px', background: 'transparent',
              border: 'none', color: '#fff', fontSize: '24px', cursor: 'pointer'
            }}
            onClick={() => setViewImageUrl(null)}
          >
            &times;
          </button>
        </div>
      )}
    </div>
  );
};
