import React, { useState, useMemo } from 'react';
import { BookOpen, Search, FileText, Edit3, Sparkles } from 'lucide-react';
import type { HistoryState } from '../trading2/store/TradingStoreTypes';
import { tradingEngine } from '../trading2/TradingEngineService';
import { loadTradingState, loadTradingStateSync, saveTradingState } from '../backtest/sessionRepository';
import { AICoachModal } from './AICoachModal';
import { formatSignedCurrency } from '@/utils/formatters';
import './TradeJournal.css';

interface TradeJournalProps {
  trades: HistoryState[];
  sessionId?: string;
}

export function getTradeCloseReason(t: HistoryState): 'SL' | 'TP' | 'MANUAL' {
  if (t.closeReason) {
    if (t.closeReason === 'SL' || t.closeReason.includes('SL')) return 'SL';
    if (t.closeReason === 'TP' || t.closeReason.includes('TP')) return 'TP';
    return 'MANUAL';
  }
  if (t.tradeId?.includes('TP') || t.comment?.includes('TP')) return 'TP';
  if (t.tradeId?.includes('SL') || t.comment?.includes('SL')) return 'SL';
  return 'MANUAL';
}

export function cleanUserNote(rawComment: string | null | undefined): string {
  if (!rawComment) return '';
  const trimmed = rawComment.trim();
  if (trimmed === 'SL Hit' || trimmed === 'SL' || trimmed === 'TP Hit' || trimmed === 'TP' || trimmed === 'MANUAL_CLOSE' || trimmed === 'MANUAL') {
    return '';
  }
  return trimmed.replace(/\s*\((SL Hit|TP Hit|Manual Close)\)$/i, '').trim();
}

export const TradeJournal: React.FC<TradeJournalProps> = ({ trades, sessionId }) => {
  const [search, setSearch] = useState('');
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [viewImageUrl, setViewImageUrl] = useState<string | null>(null);

  const [editingTradeId, setEditingTradeId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<string>('');
  const [localComments, setLocalComments] = useState<Record<string, string>>({});

  // AI Review Modal State
  const [selectedAiTrade, setSelectedAiTrade] = useState<HistoryState | null>(null);
  const [showAiModal, setShowAiModal] = useState<boolean>(false);

  const filteredTrades = useMemo(() => {
    return trades.filter((t) => {
      if (directionFilter !== 'ALL' && t.direction !== directionFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const sym = (t.symbol || '').toLowerCase();
        const userNote = cleanUserNote(localComments[t.tradeId] ?? t.comment).toLowerCase();
        const reason = getTradeCloseReason(t).toLowerCase();
        return sym.includes(q) || userNote.includes(q) || reason.includes(q);
      }
      return true;
    });
  }, [trades, search, directionFilter, localComments]);

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

  const handleStartEdit = (tradeId: string, currentNote: string) => {
    setEditingTradeId(tradeId);
    setEditingNote(cleanUserNote(currentNote));
  };

  const handleSaveNoteDirect = async (tradeId: string, noteToSave: string) => {
    const cleanNote = cleanUserNote(noteToSave);

    setLocalComments((prev) => ({ ...prev, [tradeId]: cleanNote }));

    // Sync to TradingEngineService
    tradingEngine.updateHistoryComment(tradeId, cleanNote);

    // If session is specified, persist to disk/db
    if (sessionId) {
      try {
        const state = (await loadTradingState(sessionId)) || loadTradingStateSync(sessionId);
        if (state?.schema?.history) {
          const item = state.schema.history.find((h: any) => h.tradeId === tradeId);
          if (item) {
            item.comment = cleanNote || null;
            await saveTradingState(sessionId, state);
          }
        }
      } catch (err) {
        console.warn('[TradeJournal] Persist comment failed:', err);
      }
    }

    window.dispatchEvent(new CustomEvent('show-toast', { detail: '📝 Catatan jurnal tersimpan!' }));
  };

  const handleSaveNote = async (tradeId: string) => {
    await handleSaveNoteDirect(tradeId, editingNote);
    setEditingTradeId(null);
  };

  const handleCancelEdit = () => {
    setEditingTradeId(null);
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
              placeholder="Search symbol / notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                background: '#040812',
                border: '1px solid #142036',
                color: '#cbd5e1',
                fontSize: '11px',
                padding: '4px 8px',
                borderRadius: '6px',
                width: '180px',
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
                <th>Close Reason & Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrades.map((trd) => {
                const netProfit = Number(trd.profit || 0) - Number(trd.commission || 0) + Number(trd.swap || 0);
                const isWin = netProfit >= 0;
                const reason = getTradeCloseReason(trd);
                const userNote = cleanUserNote(localComments[trd.tradeId] ?? trd.comment);

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
                    <td className="journal-comment-cell">
                      {editingTradeId === trd.tradeId ? (
                        <div className="journal-note-editor" onClick={(e) => e.stopPropagation()}>
                          <textarea
                            className="journal-note-input"
                            value={editingNote}
                            maxLength={200}
                            autoFocus
                            placeholder="Tulis refleksi / catatan trade ini..."
                            onChange={(e) => setEditingNote(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                handleSaveNote(trd.tradeId);
                              } else if (e.key === 'Escape') {
                                handleCancelEdit();
                              }
                            }}
                          />
                          <div className="journal-note-actions">
                            <button
                              type="button"
                              className="journal-note-btn cancel"
                              onClick={handleCancelEdit}
                            >
                              Batal
                            </button>
                            <button
                              type="button"
                              className="journal-note-btn save"
                              onClick={() => handleSaveNote(trd.tradeId)}
                            >
                              Simpan Note
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="journal-comment-block">
                          {/* Reason Badge & AI Review Trigger (Independent of User Note) */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span
                              className={`journal-reason-badge ${
                                reason === 'SL'
                                  ? 'journal-reason-badge--sl'
                                  : reason === 'TP'
                                  ? 'journal-reason-badge--tp'
                                  : 'journal-reason-badge--manual'
                              }`}
                            >
                              {reason === 'SL' ? 'SL Hit' : reason === 'TP' ? 'TP Hit' : 'Manual Close'}
                            </span>

                            <button
                              type="button"
                              className="journal-ai-review-btn"
                              onClick={() => {
                                setSelectedAiTrade(trd);
                                setShowAiModal(true);
                              }}
                              title="Minta AI mengevaluasi trade ini (termasuk visual screenshot chart jika ada)"
                            >
                              <Sparkles size={10} />
                              <span>AI Review</span>
                            </button>
                          </div>

                          {/* Custom User Note */}
                          {userNote ? (
                            <div
                              className="journal-note-bubble"
                              onClick={() => handleStartEdit(trd.tradeId, userNote)}
                              title="Klik untuk mengedit catatan jurnal"
                            >
                              <FileText size={12} className="journal-note-icon" />
                              <span className="journal-note-text">{userNote}</span>
                            </div>
                          ) : (
                            <div
                              className="journal-note-placeholder"
                              onClick={() => handleStartEdit(trd.tradeId, '')}
                              title="Klik untuk menambah catatan jurnal"
                            >
                              <Edit3 size={11} />
                              <span>+ Catatan</span>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
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

      {/* AI Trade Review Modal */}
      <AICoachModal
        isOpen={showAiModal}
        onClose={() => {
          setShowAiModal(false);
          setSelectedAiTrade(null);
        }}
        mode="trade"
        trade={selectedAiTrade}
        onAppendNote={(aiText) => {
          if (selectedAiTrade) {
            const current = cleanUserNote(localComments[selectedAiTrade.tradeId] ?? selectedAiTrade.comment);
            const firstLines = aiText.split('\n').filter((l: string) => l.trim().length > 0).slice(0, 3).join(' ');
            const shortInsight = `[AI: ${firstLines.replace(/#/g, '').slice(0, 150)}...]`;
            const updated = current ? `${current}\n\n${shortInsight}` : shortInsight;
            handleSaveNoteDirect(selectedAiTrade.tradeId, updated);
          }
        }}
      />
    </div>
  );
};
