import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { InstrumentMetadata } from '../instrument/InstrumentMetadata';
import { RiskCalculator } from '../risk/RiskCalculator';
import { RewardCalculator } from '../risk/RewardCalculator';
import { LotCalculator } from '../risk/LotCalculator';
import { tradingEngine } from '../TradingEngineService';
import type { RiskInputMode, RiskBaseMode } from './OrderPopupTypes';
import './ModifyPositionModal.css';

export interface ModifyItemData {
  id: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  volume: number;
  stopLoss: number | null;
  takeProfit: number | null;
  isPendingOrder?: boolean;
}

export interface ModifyPositionModalProps {
  isOpen: boolean;
  item: ModifyItemData | null;
  balance?: number;
  initialDeposit?: number;
  onClose: () => void;
  onSave: (updates: {
    volume: number;
    stopLoss: number | null;
    takeProfit: number | null;
    entryPrice?: number;
  }) => void;
}

export const ModifyPositionModal: React.FC<ModifyPositionModalProps> = ({
  isOpen,
  item,
  balance,
  initialDeposit,
  onClose,
  onSave,
}) => {
  const accountModel = tradingEngine.getAccountModel();
  const currentBalance = balance ?? accountModel?.balance ?? 10000;
  const effectiveDeposit = initialDeposit ?? accountModel?.initialBalance ?? currentBalance;

  const [volume, setVolume] = useState<number>(1.0);
  const [entryPrice, setEntryPrice] = useState<number>(0);
  const [stopLoss, setStopLoss] = useState<string>('');
  const [takeProfit, setTakeProfit] = useState<string>('');
  const [riskMode, setRiskMode] = useState<RiskInputMode>('PERCENT');
  const [riskBase, setRiskBase] = useState<RiskBaseMode>('BALANCE');
  const [riskPercent, setRiskPercent] = useState<number>(1.0);
  const [riskDollar, setRiskDollar] = useState<number>(100);

  // Floating Draggable Position
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== 'undefined') {
      return {
        x: Math.max(20, window.innerWidth - 370),
        y: 80,
      };
    }
    return { x: 100, y: 80 };
  });

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
  });

  const handleHeaderPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;

    isDraggingRef.current = true;
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: pos.x,
      startY: pos.y,
    };

    const handlePointerMove = (ev: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const dx = ev.clientX - dragStartRef.current.mouseX;
      const dy = ev.clientY - dragStartRef.current.mouseY;
      const newX = Math.max(10, Math.min(window.innerWidth - 440, dragStartRef.current.startX + dx));
      const newY = Math.max(10, Math.min(window.innerHeight - 150, dragStartRef.current.startY + dy));
      setPos({ x: newX, y: newY });
    };

    const handlePointerUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  useEffect(() => {
    if (item) {
      setVolume(item.volume);
      setEntryPrice(item.entryPrice);
      setStopLoss(item.stopLoss != null ? String(item.stopLoss) : '');
      setTakeProfit(item.takeProfit != null ? String(item.takeProfit) : '');

      const spec = InstrumentMetadata.getSpec(item.symbol);
      const contractSize = spec.contractSize;
      const base = riskBase === 'DEPOSIT' && effectiveDeposit > 0 ? effectiveDeposit : currentBalance;

      if (item.stopLoss != null) {
        const estLoss = RiskCalculator.calculateEstimatedLoss(
          item.direction,
          item.entryPrice,
          item.stopLoss,
          item.volume,
          contractSize,
          item.symbol
        );
        const pct = base > 0 ? (estLoss / base) * 100 : 1.0;
        setRiskDollar(estLoss);
        setRiskPercent(Number(pct.toFixed(2)));
      } else {
        const dl = (base * 1.0) / 100;
        setRiskDollar(dl);
        setRiskPercent(1.0);
      }
    }
  }, [item, isOpen]);

  if (!isOpen || !item) return null;

  const isBuy = item.direction === 'BUY';
  const spec = InstrumentMetadata.getSpec(item.symbol);
  const digits = spec.digits;
  const contractSize = spec.contractSize;

  const parsedSl = parseFloat(stopLoss);
  const parsedTp = parseFloat(takeProfit);
  const slValue = !isNaN(parsedSl) && parsedSl > 0 ? parsedSl : null;
  const tpValue = !isNaN(parsedTp) && parsedTp > 0 ? parsedTp : null;
  const effectiveEntry = item.isPendingOrder ? entryPrice : item.entryPrice;

  const getBaseAmount = (base: RiskBaseMode): number => {
    if (base === 'DEPOSIT' && effectiveDeposit > 0) return effectiveDeposit;
    return currentBalance > 0 ? currentBalance : 10000;
  };

  const handleRiskModeChange = (mode: RiskInputMode) => {
    const base = getBaseAmount(riskBase);
    if (mode === 'PERCENT') {
      const pct = base > 0 ? (riskDollar / base) * 100 : 1.0;
      setRiskMode(mode);
      setRiskPercent(Number(pct.toFixed(2)));
    } else {
      const dl = (base * riskPercent) / 100;
      setRiskMode(mode);
      setRiskDollar(Number(dl.toFixed(2)));
    }
  };

  const handleRiskBaseChange = (base: RiskBaseMode) => {
    const baseAmt = getBaseAmount(base);
    if (riskMode === 'PERCENT') {
      const dl = (baseAmt * riskPercent) / 100;
      const slDist = slValue !== null ? Math.abs(effectiveEntry - slValue) : 0;
      let newVol = volume;
      if (slDist > 0) {
        newVol = LotCalculator.calculateAutoLot(dl, slDist, contractSize, item.symbol, effectiveEntry);
      }
      setRiskBase(base);
      setRiskDollar(dl);
      setVolume(newVol);
    } else {
      const pct = baseAmt > 0 ? (riskDollar / baseAmt) * 100 : 0;
      setRiskBase(base);
      setRiskPercent(Number(pct.toFixed(2)));
    }
  };

  const handleRiskPercentChange = (val: number) => {
    const base = getBaseAmount(riskBase);
    const dl = (base * val) / 100;
    const slDist = slValue !== null ? Math.abs(effectiveEntry - slValue) : 0;
    let newVol = volume;
    if (slDist > 0) {
      newVol = LotCalculator.calculateAutoLot(dl, slDist, contractSize, item.symbol, effectiveEntry);
    }
    setRiskPercent(val);
    setRiskDollar(dl);
    setVolume(newVol);
  };

  const handleRiskDollarChange = (dl: number) => {
    const base = getBaseAmount(riskBase);
    const pct = base > 0 ? (dl / base) * 100 : 0;
    const slDist = slValue !== null ? Math.abs(effectiveEntry - slValue) : 0;
    let newVol = volume;
    if (slDist > 0) {
      newVol = LotCalculator.calculateAutoLot(dl, slDist, contractSize, item.symbol, effectiveEntry);
    }
    setRiskDollar(dl);
    setRiskPercent(Number(pct.toFixed(2)));
    setVolume(newVol);
  };

  const handleVolumeChange = (newVol: number) => {
    const base = getBaseAmount(riskBase);
    const estLoss = slValue !== null
      ? RiskCalculator.calculateEstimatedLoss(item.direction, effectiveEntry, slValue, newVol, contractSize, item.symbol)
      : 0;
    const pct = base > 0 ? (estLoss / base) * 100 : 0;
    setVolume(newVol);
    setRiskDollar(estLoss);
    setRiskPercent(Number(pct.toFixed(2)));
  };

  const handleStopLossChange = (newSlStr: string) => {
    const parsed = parseFloat(newSlStr);
    const newSl = !isNaN(parsed) && parsed > 0 ? parsed : null;
    const slDist = newSl !== null ? Math.abs(effectiveEntry - newSl) : 0;

    let newVol = volume;
    if (slDist > 0 && riskDollar > 0) {
      newVol = LotCalculator.calculateAutoLot(riskDollar, slDist, contractSize, item.symbol, effectiveEntry);
    }

    setStopLoss(newSlStr);
    setVolume(newVol);
  };

  // Live Risk & Reward calculations
  const estimatedLoss = slValue !== null
    ? RiskCalculator.calculateEstimatedLoss(
        item.direction,
        effectiveEntry,
        slValue,
        volume,
        contractSize,
        item.symbol
      )
    : null;

  const estimatedProfit = tpValue !== null
    ? RewardCalculator.calculateEstimatedProfit(
        item.direction,
        effectiveEntry,
        tpValue,
        volume,
        contractSize,
        item.symbol
      )
    : null;

  const rrRatio = RewardCalculator.calculateRiskRewardRatio(
    effectiveEntry,
    slValue,
    tpValue
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      volume: Math.max(0.01, volume),
      stopLoss: slValue,
      takeProfit: tpValue,
      ...(item.isPendingOrder ? { entryPrice: effectiveEntry } : {}),
    });
    onClose();
  };

  const modalContent = (
    <div className="te2-modify-overlay">
      <div
        className="te2-modify-card"
        style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="te2-modify-header" onPointerDown={handleHeaderPointerDown}>
          <div className="te2-modify-title-group">
            <span className={`te2-modify-badge ${isBuy ? 'buy' : 'sell'}`}>
              {item.direction}
            </span>
            <span className="te2-modify-symbol">{item.symbol}</span>
            <span style={{ color: '#94a3b8', fontSize: '12px' }}>
              {item.isPendingOrder ? '(Pending Order)' : '(Position)'}
            </span>
          </div>
          <button
            type="button"
            className="te2-modify-close-btn"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="te2-modify-body">
          {/* Row 1: Risk Mode & Risk Base Selection */}
          <div className="te2-modify-row">
            <div className="te2-modify-field">
              <label className="te2-modify-label">Risk Mode</label>
              <div className="te2-toggle-group">
                <button
                  type="button"
                  className={`te2-toggle-btn ${riskMode === 'PERCENT' ? 'active' : ''}`}
                  onClick={() => handleRiskModeChange('PERCENT')}
                >
                  Risk %
                </button>
                <button
                  type="button"
                  className={`te2-toggle-btn ${riskMode === 'DOLLAR' ? 'active' : ''}`}
                  onClick={() => handleRiskModeChange('DOLLAR')}
                >
                  Risk $
                </button>
              </div>
            </div>
            <div className="te2-modify-field">
              <label className="te2-modify-label">Risk Base</label>
              <div className="te2-toggle-group">
                <button
                  type="button"
                  className={`te2-toggle-btn ${riskBase === 'BALANCE' ? 'active' : ''}`}
                  onClick={() => handleRiskBaseChange('BALANCE')}
                  title={`Calculate based on Current Balance ($${currentBalance.toLocaleString()})`}
                >
                  Balance (${Math.round(currentBalance).toLocaleString()})
                </button>
                <button
                  type="button"
                  className={`te2-toggle-btn ${riskBase === 'DEPOSIT' ? 'active' : ''}`}
                  onClick={() => handleRiskBaseChange('DEPOSIT')}
                  title={`Calculate based on Initial Deposit ($${effectiveDeposit.toLocaleString()})`}
                >
                  Deposit (${Math.round(effectiveDeposit).toLocaleString()})
                </button>
              </div>
            </div>
          </div>

          {/* Row 2: Risk Value & Lot Size with Auto-sync */}
          <div className="te2-modify-row">
            <div className="te2-modify-field">
              <label className="te2-modify-label">
                {riskMode === 'PERCENT' ? 'Risk Percentage (%)' : 'Risk Amount ($)'}
              </label>
              <input
                type="number"
                step="any"
                min="0"
                className="te2-modify-input"
                value={riskMode === 'PERCENT' ? riskPercent : riskDollar}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  if (riskMode === 'PERCENT') {
                    handleRiskPercentChange(val);
                  } else {
                    handleRiskDollarChange(val);
                  }
                }}
              />
              {riskMode === 'PERCENT' && (
                <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                  {[0.5, 1, 2, 3].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => handleRiskPercentChange(pct)}
                      style={{
                        flex: 1,
                        padding: '3px 4px',
                        fontSize: '11px',
                        fontWeight: riskPercent === pct ? 700 : 500,
                        borderRadius: '4px',
                        background: riskPercent === pct ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                        border: riskPercent === pct ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                        color: riskPercent === pct ? '#38bdf8' : '#94a3b8',
                        cursor: 'pointer',
                      }}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="te2-modify-field">
              <label className="te2-modify-label">Lot Size (Volume)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="1000"
                className="te2-modify-input"
                value={volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value) || 0.01)}
                required
                autoFocus
              />
            </div>
          </div>

          {/* Row 3: Entry Price */}
          <div className="te2-modify-row">
            <div className="te2-modify-field" style={{ gridColumn: 'span 2' }}>
              <label className="te2-modify-label">Entry Price</label>
              <input
                type="number"
                step="any"
                className="te2-modify-input"
                value={effectiveEntry}
                onChange={(e) => setEntryPrice(parseFloat(e.target.value) || 0)}
                readOnly={!item.isPendingOrder}
              />
            </div>
          </div>

          {/* Row 4: Stop Loss & Take Profit */}
          <div className="te2-modify-row">
            <div className="te2-modify-field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label className="te2-modify-label" style={{ marginBottom: 0 }}>Stop Loss</label>
                <button
                  type="button"
                  className="te2-modify-bep-btn"
                  onClick={() => handleStopLossChange(String(effectiveEntry))}
                  title="Set Stop Loss equal to Entry Price"
                >
                  Set to BEP
                </button>
              </div>
              <input
                type="number"
                step="any"
                className="te2-modify-input"
                value={stopLoss}
                onChange={(e) => handleStopLossChange(e.target.value)}
                placeholder={isBuy ? `< ${effectiveEntry.toFixed(digits)}` : `> ${effectiveEntry.toFixed(digits)}`}
              />
            </div>
            <div className="te2-modify-field">
              <label className="te2-modify-label">Take Profit</label>
              <input
                type="number"
                step="any"
                className="te2-modify-input"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                placeholder={isBuy ? `> ${effectiveEntry.toFixed(digits)}` : `< ${effectiveEntry.toFixed(digits)}`}
              />
            </div>
          </div>

          {/* Live Risk / Reward / RR Summary */}
          <div className="te2-modify-summary">
            <div className="te2-modify-stat">
              <span className="te2-modify-stat-label">Estimated Risk</span>
              <span className="te2-modify-stat-val loss">
                {estimatedLoss !== null ? `-$${estimatedLoss.toFixed(2)} (${((estimatedLoss / getBaseAmount(riskBase)) * 100).toFixed(2)}%)` : '—'}
              </span>
            </div>
            <div className="te2-modify-stat">
              <span className="te2-modify-stat-label">Estimated Reward</span>
              <span className="te2-modify-stat-val profit">
                {estimatedProfit !== null ? `+$${estimatedProfit.toFixed(2)}` : '—'}
              </span>
            </div>
            <div className="te2-modify-stat">
              <span className="te2-modify-stat-label">RR Ratio</span>
              <span className="te2-modify-stat-val rr">
                {rrRatio.rrRatio > 0 ? `1 : ${rrRatio.rrRatio.toFixed(2)}` : '—'}
              </span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="te2-modify-footer">
            <button
              type="button"
              className="te2-modify-btn-cancel"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="te2-modify-btn-save"
              onClick={(e) => {
                e.stopPropagation();
                handleSubmit(e);
              }}
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
};
