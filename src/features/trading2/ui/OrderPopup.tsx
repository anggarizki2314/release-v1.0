/**
 * Trading Engine 2.0 — OrderPopup
 * TradingView-style Order Creation Modal Component.
 * Pure UI presentation layer — performs zero trade execution, zero position creation, and zero replay manipulation.
 * Emits OpenOrderCommand callback only.
 */

import React, { useState, useEffect, useRef } from 'react';
import type { OrderPopupProps, RiskBaseMode, RiskInputMode } from './OrderPopupTypes';
import { createDefaultPopupState } from './OrderPopupState';
import { RiskCalculator } from '../risk/RiskCalculator';
import { LotCalculator } from '../risk/LotCalculator';
import { RewardCalculator } from '../risk/RewardCalculator';
import { InstrumentMetadata } from '../instrument/InstrumentMetadata';
import type { CreateOrderParams } from '../order/OrderTypes';
import type { InstrumentSpecs } from '../risk/RiskTypes';
import './OrderPopup.css';

export const OrderPopup: React.FC<OrderPopupProps> = ({
  isOpen,
  orderType,
  symbol,
  timeframe = '1H',
  currentPrice,
  balance,
  initialDeposit,
  freeMargin,
  leverage,
  initialStopLoss,
  initialTakeProfit,
  instrumentCategory = 'FOREX',
  onClose,
  onPlaceOrder,
}) => {
  const effectiveDeposit = initialDeposit && initialDeposit > 0 ? initialDeposit : balance;

  const [form, setForm] = useState(() =>
    createDefaultPopupState(orderType, symbol, currentPrice, balance, initialStopLoss, initialTakeProfit, effectiveDeposit)
  );

  // Floating Draggable Position
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== 'undefined') {
      return {
        x: Math.max(20, window.innerWidth - 370),
        y: 75,
      };
    }
    return { x: 100, y: 75 };
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
    setForm(createDefaultPopupState(orderType, symbol, currentPrice, balance, initialStopLoss, initialTakeProfit, effectiveDeposit));
  }, [orderType, symbol, currentPrice, balance, effectiveDeposit, initialStopLoss, initialTakeProfit, isOpen]);

  if (!isOpen) return null;

  const isBuy = form.orderType.startsWith('BUY');
  const execType: 'MARKET' | 'LIMIT' | 'STOP' = form.orderType.includes('LIMIT')
    ? 'LIMIT'
    : form.orderType.includes('STOP')
    ? 'STOP'
    : 'MARKET';

  const spec = InstrumentMetadata.getSpec(symbol);
  const contractSize = spec.contractSize;
  const tickSize = spec.pipSize;

  const parsedSl = parseFloat(form.stopLoss);
  const parsedTp = parseFloat(form.takeProfit);
  const slValue = !isNaN(parsedSl) && parsedSl > 0 ? parsedSl : null;
  const tpValue = !isNaN(parsedTp) && parsedTp > 0 ? parsedTp : null;

  const getBaseAmount = (base: RiskBaseMode): number => {
    if (base === 'DEPOSIT' && effectiveDeposit > 0) return effectiveDeposit;
    return balance > 0 ? balance : 10000;
  };

  // Handler for Direction change (BUY vs SELL)
  const handleDirectionChange = (newDir: 'BUY' | 'SELL') => {
    const newType = `${newDir}_${execType}` as import('../order/OrderTypes').OrderType;
    const isNewBuy = newDir === 'BUY';
    const specInfo = InstrumentMetadata.getSpec(symbol);
    const defaultSlOffset = 20 * specInfo.pipSize;
    const defaultTpOffset = 60 * specInfo.pipSize;

    const currentEntry = execType === 'MARKET' ? currentPrice : form.entryPrice;
    const newSl = isNewBuy ? currentEntry - defaultSlOffset : currentEntry + defaultSlOffset;
    const newTp = isNewBuy ? currentEntry + defaultTpOffset : currentEntry - defaultTpOffset;
    const newSlStr = newSl.toFixed(specInfo.digits);
    const newTpStr = newTp.toFixed(specInfo.digits);

    const slDist = Math.abs(currentEntry - newSl);
    const dl = form.riskMode === 'PERCENT' ? (getBaseAmount(form.riskBase) * form.riskPercent) / 100 : form.riskDollar;
    const newVol = slDist > 0 && dl > 0 ? LotCalculator.calculateAutoLot(dl, slDist, contractSize, symbol, currentEntry) : form.volume;

    setForm((prev) => ({
      ...prev,
      orderType: newType,
      stopLoss: newSlStr,
      takeProfit: newTpStr,
      volume: newVol,
    }));
  };

  // Handler for Execution Type change (MARKET vs LIMIT vs STOP)
  const handleExecTypeChange = (newExec: 'MARKET' | 'LIMIT' | 'STOP') => {
    const newType = `${isBuy ? 'BUY' : 'SELL'}_${newExec}` as import('../order/OrderTypes').OrderType;
    let newEntry = form.entryPrice;
    if (newExec === 'MARKET') {
      newEntry = currentPrice;
    } else if (newExec === 'LIMIT' && form.entryPrice === currentPrice) {
      const offset = 10 * spec.pipSize;
      newEntry = isBuy ? currentPrice - offset : currentPrice + offset;
    }
    setForm((prev) => ({
      ...prev,
      orderType: newType,
      entryPrice: newEntry,
    }));
  };

  // Handler for Entry Price change (Limit / Stop orders)
  const handleEntryPriceChange = (newEntryStr: string) => {
    const parsed = parseFloat(newEntryStr);
    const newEntry = !isNaN(parsed) && parsed > 0 ? parsed : form.entryPrice;
    const slDist = slValue !== null ? Math.abs(newEntry - slValue) : 0;
    let newVol = form.volume;
    if (slDist > 0 && form.riskDollar > 0) {
      newVol = LotCalculator.calculateAutoLot(form.riskDollar, slDist, contractSize, symbol, newEntry);
    }
    setForm((prev) => ({
      ...prev,
      entryPrice: newEntry,
      volume: newVol,
    }));
  };

  // Handler for Risk Mode change ('PERCENT' vs 'DOLLAR')
  const handleRiskModeChange = (mode: RiskInputMode) => {
    const base = getBaseAmount(form.riskBase);
    if (mode === 'PERCENT') {
      const pct = base > 0 ? (form.riskDollar / base) * 100 : 1.0;
      setForm((prev) => ({ ...prev, riskMode: mode, riskPercent: Number(pct.toFixed(2)) }));
    } else {
      const dl = (base * form.riskPercent) / 100;
      setForm((prev) => ({ ...prev, riskMode: mode, riskDollar: Number(dl.toFixed(2)) }));
    }
  };

  // Handler for Risk Base change ('BALANCE' vs 'DEPOSIT')
  const handleRiskBaseChange = (base: RiskBaseMode) => {
    const baseAmt = getBaseAmount(base);
    if (form.riskMode === 'PERCENT') {
      const dl = (baseAmt * form.riskPercent) / 100;
      const slDist = slValue !== null ? Math.abs(form.entryPrice - slValue) : 0;
      let newVol = form.volume;
      if (slDist > 0) {
        newVol = LotCalculator.calculateAutoLot(dl, slDist, contractSize, symbol, form.entryPrice);
      }
      setForm((prev) => ({
        ...prev,
        riskBase: base,
        riskDollar: dl,
        volume: newVol,
      }));
    } else {
      const pct = baseAmt > 0 ? (form.riskDollar / baseAmt) * 100 : 0;
      setForm((prev) => ({
        ...prev,
        riskBase: base,
        riskPercent: Number(pct.toFixed(2)),
      }));
    }
  };

  // Handler for Risk Percent change
  const handleRiskPercentChange = (val: number) => {
    const base = getBaseAmount(form.riskBase);
    const dl = (base * val) / 100;
    const slDist = slValue !== null ? Math.abs(form.entryPrice - slValue) : 0;
    let newVol = form.volume;
    if (slDist > 0) {
      newVol = LotCalculator.calculateAutoLot(dl, slDist, contractSize, symbol, form.entryPrice);
    }
    setForm((prev) => ({
      ...prev,
      riskPercent: val,
      riskDollar: dl,
      volume: newVol,
    }));
  };

  // Handler for Risk Dollar change
  const handleRiskDollarChange = (dl: number) => {
    const base = getBaseAmount(form.riskBase);
    const pct = base > 0 ? (dl / base) * 100 : 0;
    const slDist = slValue !== null ? Math.abs(form.entryPrice - slValue) : 0;
    let newVol = form.volume;
    if (slDist > 0) {
      newVol = LotCalculator.calculateAutoLot(dl, slDist, contractSize, symbol, form.entryPrice);
    }
    setForm((prev) => ({
      ...prev,
      riskDollar: dl,
      riskPercent: Number(pct.toFixed(2)),
      volume: newVol,
    }));
  };

  // Handler for manual Volume (Lot Size) change
  const handleVolumeChange = (newVol: number) => {
    const base = getBaseAmount(form.riskBase);
    const estLoss = slValue !== null
      ? RiskCalculator.calculateEstimatedLoss(isBuy ? 'BUY' : 'SELL', form.entryPrice, slValue, newVol, contractSize, symbol)
      : 0;
    const pct = base > 0 ? (estLoss / base) * 100 : 0;
    setForm((prev) => ({
      ...prev,
      volume: newVol,
      riskDollar: estLoss,
      riskPercent: Number(pct.toFixed(2)),
    }));
  };

  // Handler for Stop Loss change
  const handleStopLossChange = (newSlStr: string) => {
    const parsed = parseFloat(newSlStr);
    const newSl = !isNaN(parsed) && parsed > 0 ? parsed : null;
    const slDist = newSl !== null ? Math.abs(form.entryPrice - newSl) : 0;

    let newVol = form.volume;
    if (slDist > 0 && form.riskDollar > 0) {
      newVol = LotCalculator.calculateAutoLot(form.riskDollar, slDist, contractSize, symbol, form.entryPrice);
    }

    setForm((prev) => ({
      ...prev,
      stopLoss: newSlStr,
      volume: newVol,
    }));
  };

  // Handler for Take Profit change
  const handleTakeProfitChange = (newTpStr: string) => {
    setForm((prev) => ({
      ...prev,
      takeProfit: newTpStr,
    }));
  };

  // Broadcast preview lines to chart overlay in real-time
  useEffect(() => {
    if (!isOpen) {
      window.dispatchEvent(
        new CustomEvent('order-popup-preview-changed', {
          detail: { isOpen: false },
        })
      );
      return;
    }

    const effectiveEntry = execType === 'MARKET' ? currentPrice : form.entryPrice;

    window.dispatchEvent(
      new CustomEvent('order-popup-preview-changed', {
        detail: {
          isOpen: true,
          symbol: form.symbol,
          orderType: form.orderType,
          direction: isBuy ? 'BUY' : 'SELL',
          entryPrice: effectiveEntry,
          stopLoss: slValue,
          takeProfit: tpValue,
          volume: form.volume,
        },
      })
    );
  }, [isOpen, form.symbol, form.orderType, form.entryPrice, currentPrice, slValue, tpValue, form.volume, isBuy, execType]);

  useEffect(() => {
    return () => {
      window.dispatchEvent(
        new CustomEvent('order-popup-preview-changed', {
          detail: { isOpen: false },
        })
      );
    };
  }, []);

  // Listen for chart drag events and preview cancel
  useEffect(() => {
    if (!isOpen) return;

    const handleDrag = (e: Event) => {
      const customEvent = e as CustomEvent<{ lineType: 'SL' | 'TP' | 'ENTRY'; price: number }>;
      if (!customEvent.detail) return;
      const { lineType, price } = customEvent.detail;
      const specInfo = InstrumentMetadata.getSpec(form.symbol);
      const priceStr = price > 0 ? price.toFixed(specInfo.digits) : '';

      if (lineType === 'SL') {
        handleStopLossChange(priceStr);
      } else if (lineType === 'TP') {
        handleTakeProfitChange(priceStr);
      } else if (lineType === 'ENTRY') {
        handleEntryPriceChange(priceStr);
      }
    };

    const handleCancel = () => {
      onClose();
    };

    window.addEventListener('order-popup-preview-dragged', handleDrag);
    window.addEventListener('order-popup-preview-cancel', handleCancel);
    return () => {
      window.removeEventListener('order-popup-preview-dragged', handleDrag);
      window.removeEventListener('order-popup-preview-cancel', handleCancel);
    };
  }, [isOpen, form.symbol, form.entryPrice, form.riskDollar, form.riskBase, form.riskMode, form.riskPercent, form.volume, contractSize, symbol, onClose]);

  // Live Read-only Summary Calculations via Pure Calculators
  const riskDollar =
    form.riskMode === 'PERCENT'
      ? (getBaseAmount(form.riskBase) * form.riskPercent) / 100
      : form.riskDollar;

  const estimatedLoss = RiskCalculator.calculateEstimatedLoss(
    isBuy ? 'BUY' : 'SELL',
    form.entryPrice,
    slValue,
    form.volume,
    contractSize,
    symbol
  );

  const estimatedProfit = RewardCalculator.calculateEstimatedProfit(
    isBuy ? 'BUY' : 'SELL',
    form.entryPrice,
    tpValue,
    form.volume,
    contractSize,
    symbol
  );

  const rrRatio = RewardCalculator.calculateRiskRewardRatio(
    form.entryPrice,
    slValue,
    tpValue
  );

  const requiredMargin = LotCalculator.calculateRequiredMargin(
    form.volume,
    form.entryPrice,
    contractSize,
    leverage,
    symbol
  );

  const remainingFreeMargin = LotCalculator.calculateRemainingMargin(freeMargin, requiredMargin);

  // Validation Warnings
  const warnings: string[] = [];
  if (requiredMargin > freeMargin) {
    warnings.push('Insufficient Free Margin to place order.');
  }
  if (slValue !== null) {
    if (isBuy && slValue >= form.entryPrice) warnings.push('BUY Stop Loss must be below Entry Price.');
    if (!isBuy && slValue <= form.entryPrice) warnings.push('SELL Stop Loss must be above Entry Price.');
  }
  if (tpValue !== null) {
    if (isBuy && tpValue <= form.entryPrice) warnings.push('BUY Take Profit must be above Entry Price.');
    if (!isBuy && tpValue >= form.entryPrice) warnings.push('SELL Take Profit must be below Entry Price.');
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Market Orders always execute at the live replay price on confirm frame
    const actualEntryPrice = orderType.includes('MARKET') ? currentPrice : form.entryPrice;

    const baseAmount = getBaseAmount(form.riskBase);
    const cmd: CreateOrderParams = {
      symbol: form.symbol,
      type: form.orderType,
      volume: form.volume,
      entryPrice: actualEntryPrice,
      stopLoss: slValue,
      takeProfit: tpValue,
      riskPercent: form.riskMode === 'PERCENT' ? form.riskPercent : (form.riskDollar / baseAmount) * 100,
      riskDollar,
      rewardDollar: estimatedProfit,
      rrRatio: rrRatio.rrRatio,
      comment: form.comment.substring(0, 100),
    };

    onPlaceOrder(cmd);
    onClose();
  };

  return (
    <div className="te2-popup-overlay">
      <div
        className="te2-popup-card"
        style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="te2-popup-header" onPointerDown={handleHeaderPointerDown}>
          <div className="te2-popup-title-group">
            <span className={`te2-popup-badge ${isBuy ? 'buy' : 'sell'}`}>
              {form.orderType.replace('_', ' ')}
            </span>
            <span className="te2-popup-symbol">{symbol}</span>
          </div>
          <button
            type="button"
            className="te2-popup-close-btn"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="te2-popup-body">
          {/* Order Side & Execution Type Selector */}
          <div className="te2-order-type-tabs">
            <div className="te2-direction-toggle">
              <button
                type="button"
                className={`te2-dir-btn buy ${isBuy ? 'active' : ''}`}
                onClick={() => handleDirectionChange('BUY')}
              >
                BUY
              </button>
              <button
                type="button"
                className={`te2-dir-btn sell ${!isBuy ? 'active' : ''}`}
                onClick={() => handleDirectionChange('SELL')}
              >
                SELL
              </button>
            </div>
            <div className="te2-exec-toggle">
              <button
                type="button"
                className={`te2-exec-btn ${execType === 'MARKET' ? 'active' : ''}`}
                onClick={() => handleExecTypeChange('MARKET')}
              >
                Market
              </button>
              <button
                type="button"
                className={`te2-exec-btn ${execType === 'LIMIT' ? 'active' : ''}`}
                onClick={() => handleExecTypeChange('LIMIT')}
              >
                Limit
              </button>
              <button
                type="button"
                className={`te2-exec-btn ${execType === 'STOP' ? 'active' : ''}`}
                onClick={() => handleExecTypeChange('STOP')}
              >
                Stop
              </button>
            </div>
          </div>

          {/* Row 1: Risk Mode & Risk Base Selection */}
          <div className="te2-form-row">
            <div className="te2-form-group">
              <label className="te2-form-label">Risk Mode</label>
              <div className="te2-toggle-group">
                <button
                  type="button"
                  className={`te2-toggle-btn ${form.riskMode === 'PERCENT' ? 'active' : ''}`}
                  onClick={() => handleRiskModeChange('PERCENT')}
                >
                  Risk %
                </button>
                <button
                  type="button"
                  className={`te2-toggle-btn ${form.riskMode === 'DOLLAR' ? 'active' : ''}`}
                  onClick={() => handleRiskModeChange('DOLLAR')}
                >
                  Risk $
                </button>
              </div>
            </div>
            <div className="te2-form-group">
              <label className="te2-form-label">Risk Base</label>
              <div className="te2-toggle-group">
                <button
                  type="button"
                  className={`te2-toggle-btn ${form.riskBase === 'BALANCE' ? 'active' : ''}`}
                  onClick={() => handleRiskBaseChange('BALANCE')}
                  title={`Calculate based on Current Balance ($${balance.toLocaleString()})`}
                >
                  Balance (${Math.round(balance).toLocaleString()})
                </button>
                <button
                  type="button"
                  className={`te2-toggle-btn ${form.riskBase === 'DEPOSIT' ? 'active' : ''}`}
                  onClick={() => handleRiskBaseChange('DEPOSIT')}
                  title={`Calculate based on Initial Deposit ($${effectiveDeposit.toLocaleString()})`}
                >
                  Deposit (${Math.round(effectiveDeposit).toLocaleString()})
                </button>
              </div>
            </div>
          </div>

          {/* Row 2: Risk Value & Lot Size (Volume) with Live Auto-sync */}
          <div className="te2-form-row">
            <div className="te2-form-group">
              <label className="te2-form-label">
                {form.riskMode === 'PERCENT' ? 'Risk Percentage (%)' : 'Risk Amount ($)'}
              </label>
              <input
                type="number"
                step="any"
                min="0"
                className="te2-input"
                value={form.riskMode === 'PERCENT' ? form.riskPercent : form.riskDollar}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  if (form.riskMode === 'PERCENT') {
                    handleRiskPercentChange(val);
                  } else {
                    handleRiskDollarChange(val);
                  }
                }}
              />
              {form.riskMode === 'PERCENT' && (
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
                        fontWeight: form.riskPercent === pct ? 700 : 500,
                        borderRadius: '4px',
                        background: form.riskPercent === pct ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                        border: form.riskPercent === pct ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                        color: form.riskPercent === pct ? '#38bdf8' : '#94a3b8',
                        cursor: 'pointer',
                      }}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="te2-form-group">
              <label className="te2-form-label">Lot Size (Volume)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="te2-input"
                value={form.volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value) || 0.01)}
              />
            </div>
          </div>

          {/* Row 3: Entry Price */}
          <div className="te2-form-row">
            <div className="te2-form-group">
              <label className="te2-form-label">
                {execType === 'MARKET' ? 'Entry Price (Market Execution)' : `${execType === 'LIMIT' ? 'Limit' : 'Stop'} Entry Price`}
              </label>
              <input
                type="number"
                step="any"
                className={`te2-input ${execType !== 'MARKET' ? 'editable' : ''}`}
                value={execType === 'MARKET' ? currentPrice : form.entryPrice}
                onChange={(e) => handleEntryPriceChange(e.target.value)}
                readOnly={execType === 'MARKET'}
              />
            </div>
          </div>

          {/* Row 4: Stop Loss & Take Profit */}
          <div className="te2-form-row">
            <div className="te2-form-group">
              <label className="te2-form-label">Stop Loss</label>
              <input
                type="number"
                step="any"
                className={`te2-input ${slValue !== null && ((isBuy && slValue >= (execType === 'MARKET' ? currentPrice : form.entryPrice)) || (!isBuy && slValue <= (execType === 'MARKET' ? currentPrice : form.entryPrice))) ? 'invalid' : ''}`}
                value={form.stopLoss}
                onChange={(e) => handleStopLossChange(e.target.value)}
                placeholder="0.00000"
              />
            </div>
            <div className="te2-form-group">
              <label className="te2-form-label">Take Profit</label>
              <input
                type="number"
                step="any"
                className={`te2-input ${tpValue !== null && ((isBuy && tpValue <= (execType === 'MARKET' ? currentPrice : form.entryPrice)) || (!isBuy && tpValue >= (execType === 'MARKET' ? currentPrice : form.entryPrice))) ? 'invalid' : ''}`}
                value={form.takeProfit}
                onChange={(e) => handleTakeProfitChange(e.target.value)}
                placeholder="0.00000"
              />
            </div>
          </div>

          {/* Comment */}
          <div className="te2-form-group">
            <label className="te2-form-label">Comment (Max 100 chars)</label>
            <input
              type="text"
              maxLength={100}
              className="te2-input"
              value={form.comment}
              onChange={(e) => setForm({ ...form, comment: e.target.value })}
              placeholder="Optional trade notes..."
            />
          </div>

          {/* Live Summary Card (Read-only) */}
          <div className="te2-summary-card">
            <div className="te2-summary-row">
              <span className="te2-summary-label">Estimated Risk:</span>
              <span className="te2-summary-value loss">
                -${estimatedLoss.toFixed(2)} ({form.riskMode === 'PERCENT' ? `${form.riskPercent.toFixed(2)}%` : `${((estimatedLoss / getBaseAmount(form.riskBase)) * 100).toFixed(2)}%`})
              </span>
            </div>
            <div className="te2-summary-row">
              <span className="te2-summary-label">Estimated Reward:</span>
              <span className="te2-summary-value profit">+${estimatedProfit.toFixed(2)}</span>
            </div>
            <div className="te2-summary-row">
              <span className="te2-summary-label">Risk Reward Ratio:</span>
              <span className="te2-summary-value">{rrRatio.formattedRatio}</span>
            </div>
            <div className="te2-summary-row">
              <span className="te2-summary-label">Required Margin:</span>
              <span className="te2-summary-value">${requiredMargin.toFixed(2)}</span>
            </div>
            <div className="te2-summary-row">
              <span className="te2-summary-label">Remaining Free Margin:</span>
              <span className="te2-summary-value">${remainingFreeMargin.toFixed(2)}</span>
            </div>
          </div>

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="te2-warning-box">
              {warnings.map((w, idx) => (
                <div key={idx}>⚠️ {w}</div>
              ))}
            </div>
          )}

          {/* Footer Buttons */}
          <div className="te2-popup-footer">
            <button type="button" className="te2-btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={`te2-btn-submit ${isBuy ? 'buy' : 'sell'}`}>
              Place {isBuy ? 'BUY' : 'SELL'} {execType === 'MARKET' ? 'Market' : execType} Order
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
