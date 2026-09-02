/**
 * Trading Engine 2.0 — PositionPanel
 * Realtime Position Management Info Panel Component.
 * Displays Entry, Current Price, Floating PnL, Risk ($), Reward ($), RR Ratio, Distance to TP/SL in pips, and Status.
 * Updates automatically on every replay tick & drag event without refresh.
 */

import React, { useState } from 'react';
import type { Position } from '../position/PositionCalculator';
import { InstrumentMetadata } from '../instrument/InstrumentMetadata';
import { tradingEngine } from '../TradingEngineService';
import { ModifyPositionModal, type ModifyItemData } from './ModifyPositionModal';
import { activeChartBridge } from '../integration/ActiveChartBridge';
import './PositionPanel.css';

export interface PositionPanelProps {
  positions: ReadonlyArray<Position>;
  onClosePosition: (positionId: string, currentPrice: number) => void;
}

export const PositionPanel: React.FC<PositionPanelProps> = ({
  positions,
  onClosePosition,
}) => {
  const [modifyItem, setModifyItem] = useState<ModifyItemData | null>(null);

  if (positions.length === 0) return null;

  return (
    <div className="te2-position-panel-grid">
      {positions.map((pos) => {
        const isBuy = pos.side === 'BUY';
        const digits = InstrumentMetadata.getDigits(pos.symbol);
        const fmtPrice = (val: number | null) => (val != null ? val.toFixed(digits) : '—');
        const isProfit = pos.floatingPnL >= 0;

        return (
          <div key={pos.id} className={`te2-position-card ${isBuy ? 'buy' : 'sell'}`}>
            {/* Header */}
            <div className="te2-pos-card-header">
              <div className="te2-pos-title">
                <span className={`te2-pos-side-badge ${isBuy ? 'buy' : 'sell'}`}>{pos.side}</span>
                <span className="te2-pos-symbol">{pos.symbol}</span>
                <span
                  className="te2-pos-volume"
                  style={{ cursor: 'pointer', borderBottom: '1px dashed #38bdf8' }}
                  title="Click to modify lot size"
                  onClick={() => setModifyItem({
                    id: pos.id,
                    symbol: pos.symbol,
                    direction: pos.side,
                    entryPrice: pos.entryPrice,
                    volume: pos.volume,
                    stopLoss: pos.stopLoss,
                    takeProfit: pos.takeProfit,
                  })}
                >
                  {pos.volume} Lot
                </span>
              </div>
              <span className={`te2-pos-status-badge ${pos.status.toLowerCase()}`}>{pos.status}</span>
            </div>

            {/* Price Row */}
            <div className="te2-pos-row-grid">
              <div className="te2-pos-stat-box">
                <span className="te2-pos-label">Entry</span>
                <span className="te2-pos-value price">{fmtPrice(pos.entryPrice)}</span>
              </div>
              <div className="te2-pos-stat-box">
                <span className="te2-pos-label">Current</span>
                <span className="te2-pos-value price active">{fmtPrice(pos.currentPrice)}</span>
              </div>
              <div className="te2-pos-stat-box highlight">
                <span className="te2-pos-label">Floating PnL</span>
                <span className={`te2-pos-value pnl ${isProfit ? 'profit' : 'loss'}`}>
                  {isProfit ? `+$${pos.floatingPnL.toFixed(2)}` : `-$${Math.abs(pos.floatingPnL).toFixed(2)}`}
                </span>
              </div>
            </div>

            {/* Risk / Reward Row */}
            <div className="te2-pos-row-grid">
              <div className="te2-pos-stat-box">
                <span className="te2-pos-label">Risk</span>
                <span className="te2-pos-value loss">${pos.riskAmount.toFixed(2)}</span>
              </div>
              <div className="te2-pos-stat-box">
                <span className="te2-pos-label">Reward</span>
                <span className="te2-pos-value profit">${pos.rewardAmount.toFixed(2)}</span>
              </div>
              <div className="te2-pos-stat-box">
                <span className="te2-pos-label">RR Ratio</span>
                <span className="te2-pos-value rr">1 : {pos.rr.toFixed(2)}</span>
              </div>
            </div>

            {/* Distance Row */}
            <div className="te2-pos-row-grid">
              <div className="te2-pos-stat-box">
                <span className="te2-pos-label">Distance SL</span>
                <span className="te2-pos-value sub">
                  {pos.stopLoss ? `${pos.distanceToSL.pips} pips` : '—'}
                </span>
              </div>
              <div className="te2-pos-stat-box">
                <span className="te2-pos-label">Distance TP</span>
                <span className="te2-pos-value sub">
                  {pos.takeProfit ? `${pos.distanceToTP.pips} pips` : '—'}
                </span>
              </div>
              <div className="te2-pos-stat-box btn-box" style={{ display: 'flex', flexDirection: 'row', gap: '6px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="te2-pos-bep-btn"
                  title={pos.stopLoss === pos.entryPrice ? 'SL is already at Break Even' : 'Set Stop Loss to Entry Price (BEP)'}
                  disabled={pos.stopLoss === pos.entryPrice}
                  onClick={() => {
                    const bridgeState = activeChartBridge.getChartState();
                    const replayNow = bridgeState?.currentReplayTime ? bridgeState.currentReplayTime * 1000 : Date.now();
                    tradingEngine.modifyPosition({
                      positionId: pos.id,
                      stopLoss: pos.entryPrice,
                    }, replayNow, bridgeState?.currentReplayIndex);
                  }}
                >
                  BEP
                </button>
                <button
                  type="button"
                  className="te2-pos-modify-btn"
                  onClick={() => setModifyItem({
                    id: pos.id,
                    symbol: pos.symbol,
                    direction: pos.side,
                    entryPrice: pos.entryPrice,
                    volume: pos.volume,
                    stopLoss: pos.stopLoss,
                    takeProfit: pos.takeProfit,
                  })}
                >
                  Modify
                </button>
                <button
                  type="button"
                  className="te2-pos-close-btn"
                  onClick={() => onClosePosition(pos.id, pos.currentPrice)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })}

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
    </div>
  );
};
