/**
 * Trading Engine 2.0 — PositionsTab
 * Renders active OPEN positions in the Bottom Panel with PositionPanel cards & Tabular View.
 * Realtime updates on every replay tick & SL/TP drag without page refresh.
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { tradingEngine } from '../TradingEngineService';
import type { PositionModel } from '../position/PositionTypes';
import { PositionCalculator, type Position } from '../position/PositionCalculator';
import { InstrumentMetadata } from '../instrument/InstrumentMetadata';
import { useAccountEngine } from '../account/useAccountEngine';
import { useChallengeEngine } from '../challenge/useChallengeEngine';
import { ModifyPositionModal, type ModifyItemData } from './ModifyPositionModal';
import { activeChartBridge } from '../integration/ActiveChartBridge';
import './TradingTables.css';

export const PositionsTab: React.FC = () => {
  const accountState = useAccountEngine();
  const challengeState = useChallengeEngine();
  const [positions, setPositions] = useState<ReadonlyArray<PositionModel>>(() =>
    tradingEngine.getOpenPositions()
  );
  const [modifyItem, setModifyItem] = useState<ModifyItemData | null>(null);
  const [viewImageUrl, setViewImageUrl] = useState<string | null>(null);
  const [pendingScreenshot, setPendingScreenshot] = useState<{ positionId: string, dataUrl: string, timeframe: string } | null>(null);

  useEffect(() => {
    setPositions(tradingEngine.getOpenPositions());
    return tradingEngine.subscribe(() => {
      setPositions(tradingEngine.getOpenPositions());
    });
  }, []);

  const calculatedPositions: Position[] = positions.map((p) => PositionCalculator.calculate(p));

  const handleClosePosition = (positionId: string, currentPrice: number) => {
    tradingEngine.closePosition(positionId, currentPrice);
  };

  const isFloatingPos = accountState.floatingPnL >= 0;
  const fmtMoney = (val: number) => `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const badgeClass = challengeState.status.toLowerCase().replace(' ', '');

  const handleAttachScreenshot = (positionId: string) => {
    window.dispatchEvent(
      new CustomEvent('capture-active-chart-screenshot', {
        detail: {
          onCapture: (dataUrl: string, timeframe: string) => {
            setPendingScreenshot({ positionId, dataUrl, timeframe });
          },
        },
      })
    );
  };

  const confirmPendingScreenshot = () => {
    if (pendingScreenshot) {
      tradingEngine.attachScreenshotToPosition(pendingScreenshot.positionId, pendingScreenshot.dataUrl, pendingScreenshot.timeframe);
      setPendingScreenshot(null);
      window.dispatchEvent(
        new CustomEvent('show-toast', { detail: '📸 Screenshot ditambahkan ke posisi!' })
      );
    }
  };

  const handleDeleteScreenshot = (positionId: string, screenshotId: string) => {
    tradingEngine.removeScreenshotFromPosition(positionId, screenshotId);
    window.dispatchEvent(
      new CustomEvent('show-toast', { detail: '🗑️ Screenshot posisi dihapus' })
    );
  };

  return (
    <div className="te2-table-container">
      {/* Account Engine & Challenge Engine Binding Strip — Direct reading from AccountEngine & ChallengeEngine */}
      <div className="te2-account-strip">
        {/* Status Badge */}
        <div className="te2-account-metric">
          <span className={`te2-status-badge ${badgeClass}`}>
            {challengeState.status}
          </span>
        </div>

        {/* Account Engine Metrics */}
        <div className="te2-account-metric">
          <span className="te2-account-label">Balance:</span>
          <span className="te2-account-val">{fmtMoney(accountState.balance)}</span>
        </div>
        <div className="te2-account-metric">
          <span className="te2-account-label">Equity:</span>
          <span className="te2-account-val">{fmtMoney(accountState.equity)}</span>
        </div>
        <div className="te2-account-metric">
          <span className="te2-account-label">Floating PnL:</span>
          <span className={`te2-account-val ${isFloatingPos ? 'pos' : 'neg'}`}>
            {isFloatingPos ? '+' : ''}{fmtMoney(accountState.floatingPnL)}
          </span>
        </div>
        <div className="te2-account-metric">
          <span className="te2-account-label">Free Margin:</span>
          <span className="te2-account-val">{fmtMoney(accountState.freeMargin)}</span>
        </div>
        <div className="te2-account-metric">
          <span className="te2-account-label">Used Margin:</span>
          <span className="te2-account-val">{fmtMoney(accountState.usedMargin ?? (accountState as any).margin ?? 0)}</span>

        </div>
        <div className="te2-account-metric">
          <span className="te2-account-label">Margin Level:</span>
          <span className="te2-account-val">
            {accountState.marginLevel === null || accountState.marginLevel === Infinity
              ? 'Infinity'
              : `${accountState.marginLevel.toFixed(2)}%`}
          </span>
        </div>


        {/* Challenge Engine Metrics — Displayed ONLY when mode === 'CHALLENGE' */}
        {challengeState.mode === 'CHALLENGE' && (
          <>
            <div className="te2-account-metric">
              <span className="te2-account-label">Profit %:</span>
              <span className={`te2-account-val ${challengeState.profitPercent >= 0 ? 'pos' : 'neg'}`}>
                {challengeState.profitPercent >= 0 ? '+' : ''}{challengeState.profitPercent.toFixed(2)}%
              </span>
            </div>
            <div className="te2-account-metric">
              <span className="te2-account-label">Rem. Target:</span>
              <span className="te2-account-val">{fmtMoney(challengeState.remainingTarget)}</span>
            </div>
            <div className="te2-account-metric">
              <span className="te2-account-label">Rem. Daily Loss:</span>
              <span className="te2-account-val">{fmtMoney(challengeState.remainingDailyLoss)}</span>
            </div>
            <div className="te2-account-metric">
              <span className="te2-account-label">Rem. Max Loss:</span>
              <span className="te2-account-val">{fmtMoney(challengeState.remainingMaximumLoss)}</span>
            </div>
            <div className="te2-account-metric">
              <span className="te2-account-label">Trading Days:</span>
              <span className="te2-account-val">
                {challengeState.currentTradingDays} / {challengeState.minimumTradingDays} Days
              </span>
            </div>
          </>
        )}
      </div>

      {positions.length === 0 ? (
        <div className="te2-empty-state">
          <span>No open positions. Place a Market Order or hit a Pending Order to see active positions here.</span>
        </div>
      ) : (
        <table className="te2-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Side</th>
              <th>Volume</th>
              <th>Entry</th>
              <th>Current</th>
              <th>SL</th>
              <th>TP</th>
              <th>Risk ($)</th>
              <th>Reward ($)</th>
              <th>RR</th>
              <th>Floating PnL</th>
              <th>Screenshots</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {calculatedPositions.map((p) => {
              const digits = InstrumentMetadata.getDigits(p.symbol);
              const fmt = (val: number | null) => (val != null ? val.toFixed(digits) : '—');
              const isBuy = p.side === 'BUY';
              const pnlVal = Number(p.floatingPnL) || 0;
              const isProfit = pnlVal > 0.00001;
              const isLoss = pnlVal < -0.00001;
              const pnlClass = isProfit ? 'te2-pnl-positive' : isLoss ? 'te2-pnl-negative' : 'te2-pnl-zero';
              const pnlFormatted = isProfit
                ? `+$${pnlVal.toFixed(2)}`
                : isLoss
                ? `-$${Math.abs(pnlVal).toFixed(2)}`
                : `$0.00`;

              return (
                <tr key={p.id}>
                  <td><strong>{p.symbol}</strong></td>
                  <td>
                    <span className={`te2-badge ${isBuy ? 'buy' : 'sell'}`}>{p.side}</span>
                  </td>
                  <td>
                    <span
                      style={{ cursor: 'pointer', borderBottom: '1px dashed #38bdf8' }}
                      title="Click to modify lot size"
                      onClick={() => setModifyItem({
                        id: p.id,
                        symbol: p.symbol,
                        direction: p.side,
                        entryPrice: p.entryPrice,
                        volume: p.volume,
                        stopLoss: p.stopLoss,
                        takeProfit: p.takeProfit,
                      })}
                    >
                      {p.volume} Lot
                    </span>
                  </td>
                  <td>{fmt(p.entryPrice)}</td>
                  <td>{fmt(p.currentPrice)}</td>
                  <td>{fmt(p.stopLoss)}</td>
                  <td>{fmt(p.takeProfit)}</td>
                  <td>${p.riskAmount.toFixed(2)}</td>
                  <td>${p.rewardAmount.toFixed(2)}</td>
                  <td>1 : {p.rr.toFixed(2)}</td>
                  <td className={pnlClass}>{pnlFormatted}</td>
                  <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                      {p.screenshots && p.screenshots.length > 0 && p.screenshots.map((ss) => (
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
                                handleDeleteScreenshot(p.id, ss.id);
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
                        onClick={() => handleAttachScreenshot(p.id)}
                        title="Attach Screenshot (Jepret Chart Aktif)"
                      >
                        📷 +
                      </button>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        className="te2-btn-bep"
                        title={p.stopLoss === p.entryPrice ? 'SL is already at Break Even' : 'Set Stop Loss to Entry Price (BEP)'}
                        disabled={p.stopLoss === p.entryPrice}
                        onClick={() => {
                          const bridgeState = activeChartBridge.getChartState();
                          const replayNow = bridgeState?.currentReplayTime ? bridgeState.currentReplayTime * 1000 : Date.now();
                          tradingEngine.modifyPosition({
                            positionId: p.id,
                            stopLoss: p.entryPrice,
                          }, replayNow, bridgeState?.currentReplayIndex);
                        }}
                      >
                        BEP
                      </button>
                      <button
                        type="button"
                        className="te2-btn-modify"
                        onClick={() => setModifyItem({
                          id: p.id,
                          symbol: p.symbol,
                          direction: p.side,
                          entryPrice: p.entryPrice,
                          volume: p.volume,
                          stopLoss: p.stopLoss,
                          takeProfit: p.takeProfit,
                        })}
                      >
                        Modify
                      </button>
                      <button
                        type="button"
                        className="te2-btn-cancel"
                        onClick={() => handleClosePosition(p.id, p.currentPrice)}
                      >
                        Close
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Modify Position Modal */}
      <ModifyPositionModal
        isOpen={modifyItem !== null}
        item={modifyItem}
        onClose={() => setModifyItem(null)}
        onSave={(updates) => {
          if (modifyItem) {
            tradingEngine.modifyPosition({
              positionId: modifyItem.id,
              volume: updates.volume,
              stopLoss: updates.stopLoss,
              takeProfit: updates.takeProfit,
            });
          }
        }}
      />

      {/* Image Preview Modal */}
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
