/**
 * Trading Engine 2.0 — TradesTab
 * Renders archived CLOSED trades in the Bottom Panel (Trade History).
 * Synchronized with TradingEngineService.
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { tradingEngine } from '../TradingEngineService';
import type { HistoryState } from '../store/TradingStoreTypes';
import { InstrumentMetadata } from '../instrument/InstrumentMetadata';
import { formatTimestampUTC } from '@features/timezone';
import './TradingTables.css';

export const TradesTab: React.FC = () => {
  const [trades, setTrades] = useState<ReadonlyArray<HistoryState>>(() =>
    tradingEngine.getTradeHistory()
  );
  const [viewImageUrl, setViewImageUrl] = useState<string | null>(null);
  const [pendingScreenshot, setPendingScreenshot] = useState<{ tradeId: string, dataUrl: string, timeframe: string } | null>(null);

  useEffect(() => {
    setTrades(tradingEngine.getTradeHistory());
    return tradingEngine.subscribe(() => {
      setTrades(tradingEngine.getTradeHistory());
    });
  }, []);

  if (trades.length === 0) {
    return (
      <div className="te2-empty-state">
        <span>No closed trades yet. Closed positions hit by TP/SL or closed manually will appear here.</span>
      </div>
    );
  }

  const formatTime = (ms: number | null) => {
    if (!ms) return '—';
    const sec = ms > 10000000000 ? Math.floor(ms / 1000) : ms;
    return formatTimestampUTC(sec);
  };

  const handleAttachScreenshot = (tradeId: string) => {
    window.dispatchEvent(
      new CustomEvent('capture-active-chart-screenshot', {
        detail: {
          onCapture: (dataUrl: string, timeframe: string) => {
            setPendingScreenshot({ tradeId, dataUrl, timeframe });
          },
        },
      })
    );
  };

  const confirmPendingScreenshot = () => {
    if (pendingScreenshot) {
      tradingEngine.attachScreenshotToHistory(pendingScreenshot.tradeId, pendingScreenshot.dataUrl, pendingScreenshot.timeframe);
      setPendingScreenshot(null);
      window.dispatchEvent(
        new CustomEvent('show-toast', { detail: '📸 Screenshot ditambahkan!' })
      );
    }
  };

  const handleDeleteScreenshot = (tradeId: string, screenshotId: string) => {
    tradingEngine.removeScreenshotFromHistory(tradeId, screenshotId);
    window.dispatchEvent(
      new CustomEvent('show-toast', { detail: '🗑️ Screenshot dihapus' })
    );
  };

  return (
    <div className="te2-table-container">
      <table className="te2-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Direction</th>
            <th>Volume</th>
            <th>Entry Price</th>
            <th>Exit Price</th>
            <th>SL</th>
            <th>TP</th>
            <th>Risk ($)</th>
            <th>RR</th>
            <th>Final PnL</th>
            <th>Screenshots</th>
            <th>Opened At</th>
            <th>Closed At</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => {
            const digits = InstrumentMetadata.getDigits(t.symbol);
            const fmt = (val: number | null | undefined) => (val != null && val > 0 ? val.toFixed(digits) : '—');
            const isBuy = t.direction === 'BUY';

            const spec = InstrumentMetadata.getSpec(t.symbol);
            const contractSize = spec.contractSize;

            let sl = t.stopLoss && t.stopLoss > 0 ? t.stopLoss : null;
            let tp = t.takeProfit && t.takeProfit > 0 ? t.takeProfit : null;

            if (sl === null || tp === null) {
              if (t.tradeId.includes('SL') || t.comment?.includes('SL') || t.profit < 0) {
                sl = sl ?? t.exitPrice;
                const riskDiff = Math.abs(t.entryPrice - sl);
                tp = tp ?? (isBuy ? t.entryPrice + 3 * riskDiff : t.entryPrice - 3 * riskDiff);
              } else if (t.tradeId.includes('TP') || t.comment?.includes('TP') || t.profit > 0) {
                tp = tp ?? t.exitPrice;
                const rewardDiff = Math.abs(tp - t.entryPrice);
                sl = sl ?? (isBuy ? t.entryPrice - rewardDiff / 3 : t.entryPrice + rewardDiff / 3);
              } else {
                const defaultPip = spec.pipSize * 20;
                sl = isBuy ? t.entryPrice - defaultPip : t.entryPrice + defaultPip;
                tp = isBuy ? t.entryPrice + 3 * defaultPip : t.entryPrice - 3 * defaultPip;
              }
            }

            const riskDiff = Math.abs(isBuy ? t.entryPrice - sl : sl - t.entryPrice);
            const rawRisk = Math.max(0, riskDiff * t.volume * contractSize);
            const riskAmount = InstrumentMetadata.convertQuoteToAccount(t.symbol, rawRisk, t.entryPrice);

            const rewardDiff = Math.abs(isBuy ? tp - t.entryPrice : t.entryPrice - tp);
            const rawReward = Math.max(0, rewardDiff * t.volume * contractSize);
            const rewardAmount = InstrumentMetadata.convertQuoteToAccount(t.symbol, rawReward, t.entryPrice);
            const rr = riskAmount > 0 ? rewardAmount / riskAmount : 3;

            const pnlVal = Number(t.profit) || 0;
            const isProfit = pnlVal > 0.00001;
            const isLoss = pnlVal < -0.00001;
            const pnlClass = isProfit ? 'te2-pnl-positive' : isLoss ? 'te2-pnl-negative' : 'te2-pnl-zero';
            const pnlFormatted = isProfit
              ? `+$${pnlVal.toFixed(2)}`
              : isLoss
              ? `-$${Math.abs(pnlVal).toFixed(2)}`
              : `$0.00`;

            return (
              <tr key={t.tradeId}>
                <td><strong>{t.symbol}</strong></td>
                <td>
                  <span className={`te2-badge ${isBuy ? 'buy' : 'sell'}`}>{t.direction}</span>
                </td>
                <td>{t.volume} Lot</td>
                <td>{fmt(t.entryPrice)}</td>
                <td>{fmt(t.exitPrice)}</td>
                <td>{fmt(sl)}</td>
                <td>{fmt(tp)}</td>
                <td>${riskAmount.toFixed(2)}</td>
                <td>1 : {rr.toFixed(2)}</td>
                <td className={pnlClass}>{pnlFormatted}</td>
                <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                    {t.screenshots && t.screenshots.length > 0 && t.screenshots.map((ss) => (
                      <div key={ss.id} style={{ display: 'flex', border: '1px solid var(--border-color, rgba(255,255,255,0.1))', borderRadius: '4px', overflow: 'hidden' }}>
                        <button
                          className="te2-btn-modify"
                          style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0, padding: '2px 6px', fontSize: '11px', display: 'flex', alignItems: 'center' }}
                          onClick={() => setViewImageUrl(ss.dataUrl)}
                          title={`Lihat Screenshot ${ss.timeframe}`}
                        >
                          {ss.timeframe} <span style={{marginLeft: 2}}>📷</span>
                        </button>
                        <button
                          className="te2-btn-cancel"
                          style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, padding: '2px 4px', display: 'flex', alignItems: 'center' }}
                          onClick={() => {
                            if (confirm(`Hapus screenshot ${ss.timeframe} ini?`)) {
                              handleDeleteScreenshot(t.tradeId, ss.id);
                            }
                          }}
                          title="Hapus Screenshot"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                    <button
                      className="te2-btn-modify"
                      style={{ padding: '2px 6px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      onClick={() => handleAttachScreenshot(t.tradeId)}
                      title="Attach Screenshot (Jepret Chart Aktif)"
                    >
                      📷 +
                    </button>
                  </div>
                </td>
                <td>{formatTime(t.openedAt)}</td>
                <td>{formatTime(t.closedAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Image Preview Modal (View Only) */}
      {viewImageUrl && createPortal(
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
        </div>,
        document.body
      )}

      {/* Pending Screenshot Confirmation Modal */}
      {pendingScreenshot && createPortal(
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)', zIndex: 99999,
            display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
            padding: '20px'
          }}
        >
          <div style={{ background: '#040812', padding: '16px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid #1e293b' }}>
            <h3 style={{ color: '#f8fafc', margin: 0 }}>Preview Screenshot ({pendingScreenshot.timeframe})</h3>
            <img
              src={pendingScreenshot.dataUrl}
              alt="Screenshot Pending"
              style={{ maxWidth: '80vw', maxHeight: '70vh', borderRadius: '4px', border: '1px solid #334155' }}
            />
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                className="te2-btn-cancel"
                onClick={() => setPendingScreenshot(null)}
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                Discard
              </button>
              <button
                className="te2-btn-modify"
                onClick={confirmPendingScreenshot}
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                Save Screenshot
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
