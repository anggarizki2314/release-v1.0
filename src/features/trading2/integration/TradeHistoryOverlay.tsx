/**
 * Trading Engine 2.0 — TradeHistoryOverlay
 * Renders execution arrows (Entry/Exit) and dashed connecting lines on chart candles for closed trades.
 * Synchronized with Lightweight Charts 60/120 FPS timeScale and priceScale.
 */

import React, { useEffect, useState } from 'react';
import type { HistoryState } from '../store/TradingStoreTypes';
import { tradingEngine } from '../TradingEngineService';
import { activeChartBridge } from './ActiveChartBridge';
import { InstrumentMetadata } from '../instrument/InstrumentMetadata';
import './TradeHistoryOverlay.css';

export interface TradeHistoryOverlayProps {
  chart: any;
  series: any;
  currentSymbol: string;
  candles?: any[];
  timeframe?: string;
  visible: boolean;
  chartWidth: number;
  chartHeight: number;
}

function findLastIdx(candles: any[], timestamp: number): number {
  let low = 0;
  let high = candles.length - 1;
  let best = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (candles[mid].time <= timestamp) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return best;
}

function timestampToX(
  chart: any,
  timestamp: number,
  candles?: any[]
): number | null {
  if (!chart) return null;
  const timeScale = chart.timeScale();
  if (!timeScale) return null;

  if (candles && candles.length > 0) {
    const leftIdx = findLastIdx(candles, timestamp);
    if (leftIdx >= 0 && leftIdx < candles.length) {
      if (candles[leftIdx].time === timestamp) {
        try {
          const logicalX = timeScale.logicalToCoordinate(leftIdx as any);
          if (logicalX !== null && typeof logicalX === 'number' && Number.isFinite(logicalX)) {
            return logicalX;
          }
        } catch {}
      }
    }
  }

  try {
    const directX = timeScale.timeToCoordinate(timestamp as any);
    if (directX !== null && typeof directX === 'number' && Number.isFinite(directX)) {
      return directX;
    }
  } catch {}

  if (candles && candles.length > 0) {
    const leftIdx = findLastIdx(candles, timestamp);
    if (leftIdx >= 0 && leftIdx < candles.length) {
      try {
        const logicalX = timeScale.logicalToCoordinate(leftIdx as any);
        if (logicalX !== null && typeof logicalX === 'number' && Number.isFinite(logicalX)) {
          return logicalX;
        }
      } catch {}
    }
  }

  return null;
}

export const TradeHistoryOverlay: React.FC<TradeHistoryOverlayProps> = ({
  chart,
  series,
  currentSymbol,
  candles,
  visible,
  chartWidth,
  chartHeight,
}) => {
  const [historyTrades, setHistoryTrades] = useState<ReadonlyArray<HistoryState>>(() =>
    tradingEngine.getTradeHistory()
  );
  const [hoveredTrade, setHoveredTrade] = useState<{ trade: HistoryState; x: number; y: number } | null>(null);
  const [, setRenderTrigger] = useState(0);

  // Sync trade history data
  useEffect(() => {
    setHistoryTrades(tradingEngine.getTradeHistory());
    const unsubscribe = tradingEngine.subscribe(() => {
      setHistoryTrades(tradingEngine.getTradeHistory());
    });

    const handleStorage = () => setHistoryTrades(tradingEngine.getTradeHistory());
    window.addEventListener('storage', handleStorage);
    window.addEventListener('trade-history-updated', handleStorage);

    return () => {
      if (unsubscribe) unsubscribe();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('trade-history-updated', handleStorage);
    };
  }, []);

  // Listen to chart pan / zoom and price scale drag events to trigger smooth re-render
  useEffect(() => {
    if (!chart) return;
    let rafId: number | null = null;
    let isPointerActive = false;

    const triggerRender = () => {
      setRenderTrigger((prev) => prev + 1);
    };

    const handleRangeChange = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        triggerRender();
      });
    };

    const trackingLoop = () => {
      if (!isPointerActive) return;
      triggerRender();
      rafId = requestAnimationFrame(trackingLoop);
    };

    const handlePointerDown = () => {
      isPointerActive = true;
      if (rafId === null) {
        rafId = requestAnimationFrame(trackingLoop);
      }
    };

    const handlePointerUp = () => {
      isPointerActive = false;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      triggerRender();
    };

    let wheelTimer: ReturnType<typeof setTimeout> | null = null;
    const handleWheel = () => {
      triggerRender();
      if (wheelTimer) clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => {
        triggerRender();
      }, 200);
    };

    const chartEl = typeof chart.chartElement === 'function' ? chart.chartElement() : null;

    try {
      const timeScale = chart.timeScale();
      timeScale.subscribeVisibleLogicalRangeChange(handleRangeChange);
      timeScale.subscribeVisibleTimeRangeChange(handleRangeChange);

      if (chartEl) {
        chartEl.addEventListener('pointerdown', handlePointerDown);
        chartEl.addEventListener('wheel', handleWheel, { passive: true });
      }
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerUp);

      return () => {
        isPointerActive = false;
        if (rafId !== null) cancelAnimationFrame(rafId);
        if (wheelTimer) clearTimeout(wheelTimer);
        try {
          timeScale.unsubscribeVisibleLogicalRangeChange(handleRangeChange);
          timeScale.unsubscribeVisibleTimeRangeChange(handleRangeChange);
        } catch {}
        if (chartEl) {
          chartEl.removeEventListener('pointerdown', handlePointerDown);
          chartEl.removeEventListener('wheel', handleWheel);
        }
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerUp);
      };
    } catch {
      return;
    }
  }, [chart]);

  if (!visible || !chart || !series) return null;

  const liveChart = activeChartBridge.getChartState();
  const currentReplayTime = liveChart?.currentReplayTime ?? null;

  const relevantTrades = historyTrades.filter((t) => {
    if (t.symbol !== currentSymbol) return false;
    if (currentReplayTime !== null) {
      const closedSec = t.closedAt > 10000000000 ? Math.floor(t.closedAt / 1000) : t.closedAt;
      return closedSec <= currentReplayTime;
    }
    return true;
  });
  if (relevantTrades.length === 0) return null;

  const spec = InstrumentMetadata.getSpec(currentSymbol);
  const formatPrice = (p: number) => p.toFixed(spec.digits);

  return (
    <div className="te2-trade-history-overlay" style={{ width: chartWidth, height: chartHeight }}>
      <svg
        width={chartWidth}
        height={chartHeight}
        style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
      >
        {relevantTrades.map((trade) => {
          let openedSec = trade.openedAt > 10000000000 ? Math.floor(trade.openedAt / 1000) : trade.openedAt;
          let closedSec = trade.closedAt > 10000000000 ? Math.floor(trade.closedAt / 1000) : trade.closedAt;

          if (openedSec > closedSec) {
            openedSec = closedSec;
          }

          const x1 = timestampToX(chart, openedSec, candles);
          const y1 = series?.priceToCoordinate ? series.priceToCoordinate(trade.entryPrice) : null;
          const x2 = timestampToX(chart, closedSec, candles);
          const y2 = series?.priceToCoordinate ? series.priceToCoordinate(trade.exitPrice) : null;

          if (x1 === null || y1 === null || x2 === null || y2 === null) {
            return null;
          }

          const isBuy = trade.direction === 'BUY';
          const lineColor = isBuy ? '#3b82f6' : '#ef4444';

          // Arrow coordinates
          // Entry Arrow:
          // BUY -> Up Arrow at (x1, y1)
          // SELL -> Down Arrow at (x1, y1)
          const entryArrowPoints = isBuy
            ? `${x1},${y1} ${x1 - 6},${y1 + 14} ${x1 + 6},${y1 + 14}` // Pointing UP
            : `${x1},${y1} ${x1 - 6},${y1 - 14} ${x1 + 6},${y1 - 14}`; // Pointing DOWN

          // Exit Arrow:
          // BUY close (Sell) -> Down Arrow at (x2, y2)
          // SELL close (Buy cover) -> Up Arrow at (x2, y2)
          const exitArrowPoints = isBuy
            ? `${x2},${y2} ${x2 - 6},${y2 - 14} ${x2 + 6},${y2 - 14}` // Pointing DOWN
            : `${x2},${y2} ${x2 - 6},${y2 + 14} ${x2 + 6},${y2 + 14}`; // Pointing UP

          const entryColor = isBuy ? '#3b82f6' : '#ef4444';
          const exitColor = isBuy ? '#ef4444' : '#3b82f6';

          return (
            <g
              key={trade.tradeId || `${trade.openedAt}-${trade.closedAt}`}
              className="te2-trade-history-group"
              style={{ pointerEvents: 'auto' }}
              onMouseEnter={() => {
                setHoveredTrade({ trade, x: x2, y: y2 });
              }}
              onMouseLeave={() => setHoveredTrade(null)}
            >
              {/* Invisible wide hover hitbox */}
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="transparent"
                strokeWidth={14}
                style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
              />

              {/* Dashed connector line */}
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={lineColor}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                className="te2-trade-history-line"
              />

              {/* Entry Arrow */}
              <polygon
                points={entryArrowPoints}
                fill={entryColor}
                stroke="#ffffff"
                strokeWidth={1}
                className="te2-trade-arrow entry"
              />

              {/* Exit Arrow */}
              <polygon
                points={exitArrowPoints}
                fill={exitColor}
                stroke="#ffffff"
                strokeWidth={1}
                className="te2-trade-arrow exit"
              />
            </g>
          );
        })}
      </svg>

      {/* Floating Hover Tooltip */}
      {hoveredTrade && (
        <div
          className="te2-trade-tooltip"
          style={{
            left: Math.min(Math.max(10, hoveredTrade.x + 12), chartWidth - 190),
            top: Math.min(Math.max(10, hoveredTrade.y - 45), chartHeight - 90),
          }}
        >
          <div className="te2-tooltip-header">
            <span className={`te2-tooltip-dir ${hoveredTrade.trade.direction.toLowerCase()}`}>
              {hoveredTrade.trade.direction}
            </span>
            <span className="te2-tooltip-vol">{hoveredTrade.trade.volume} Lot</span>
            <span className={`te2-tooltip-pnl ${hoveredTrade.trade.profit >= 0 ? 'profit' : 'loss'}`}>
              {hoveredTrade.trade.profit >= 0 ? `+$${hoveredTrade.trade.profit.toFixed(2)}` : `-$${Math.abs(hoveredTrade.trade.profit).toFixed(2)}`}
            </span>
          </div>
          <div className="te2-tooltip-row">
            <span>Entry:</span>
            <strong>{formatPrice(hoveredTrade.trade.entryPrice)}</strong>
            <span>→ Exit:</span>
            <strong>{formatPrice(hoveredTrade.trade.exitPrice)}</strong>
          </div>
          <div className="te2-tooltip-footer">
            <span>Alasan: {hoveredTrade.trade.comment || 'MANUAL'}</span>
          </div>
        </div>
      )}
    </div>
  );
};
