/**
 * Trading Engine 2.0 — RealOrderOverlay (120 FPS Pointer Capture Drag Engine)
 * Rebuilt Order & Position Lines Component with Pointer Capture & rAF Sync.
 * Zero DOM position storage, zero mousemove drift, zero jitter.
 * Price-anchored SVG rendering updated via requestAnimationFrame.
 */

import React, { useRef, useEffect } from 'react';
import type { OrderModel } from '../order/OrderTypes';
import { RiskCalculator } from '../risk/RiskCalculator';
import { RewardCalculator } from '../risk/RewardCalculator';
import { InstrumentMetadata } from '../instrument/InstrumentMetadata';
import { tradingEngine } from '../TradingEngineService';
import { activeChartBridge } from './ActiveChartBridge';
import { PriceComparator } from '../execution/PriceComparator';
import { ModifyPositionModal, type ModifyItemData } from '../ui/ModifyPositionModal';
import './RealOrderOverlay.css';

function snapPrice(price: number, tickSize: number = 0.00001): number {
  if (tickSize <= 0) return price;
  return Math.round(price / tickSize) * tickSize;
}

export interface RealOrderOverlayProps {
  chart?: any;
  series?: any;
  orders: ReadonlyArray<OrderModel>;
  currentSymbol: string;
  chartHeight: number;
  chartWidth: number;
  priceToY: (price: number) => number | null;
  yToPrice: (y: number) => number;
  onModifyOrder: (orderId: string, updates: Partial<OrderModel>) => void;
  onCancelOrder: (orderId: string) => void;
}

function getOrderTypeLabel(type: string): string {
  if (type === 'BUY_MARKET' || type === 'BUY') return 'Buy';
  if (type === 'SELL_MARKET' || type === 'SELL') return 'Sell';
  if (type === 'BUY_LIMIT') return 'Buy Limit';
  if (type === 'SELL_LIMIT') return 'Sell Limit';
  if (type === 'BUY_STOP') return 'Buy Stop';
  if (type === 'SELL_STOP') return 'Sell Stop';
  return type.replace('_', ' ');
}

function formatAmount(amount: number): string {
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export interface PreviewOrderData {
  isOpen: boolean;
  symbol: string;
  orderType: string;
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  volume: number;
}

export const RealOrderOverlay: React.FC<RealOrderOverlayProps> = ({
  chart,
  series,
  orders,
  currentSymbol,
  chartHeight,
  chartWidth,
  priceToY,
  yToPrice,
  onModifyOrder,
  onCancelOrder,
}) => {
  const [modifyItem, setModifyItem] = React.useState<ModifyItemData | null>(null);
  const [previewOrder, setPreviewOrder] = React.useState<PreviewOrderData | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [, setRenderTick] = React.useState(0);
  const [dragOverride, setDragOverride] = React.useState<{
    orderId: string;
    lineType: 'ENTRY' | 'SL' | 'TP';
    price: number;
  } | null>(null);
  const dragOverrideRef = useRef<{
    orderId: string;
    lineType: 'ENTRY' | 'SL' | 'TP';
    price: number;
  } | null>(null);

  // Subscribe to chart visible range change, price scale drag, and pan/zoom events with rAF for 120fps sync
  useEffect(() => {
    if (!chart) return;
    let rafId: number | null = null;
    let isPointerActive = false;

    const triggerRender = () => {
      setRenderTick((t) => (t + 1) % 1000000);
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

  // Subscribe to live OrderPopup preview state
  useEffect(() => {
    const handlePreviewChange = (e: Event) => {
      const customEvent = e as CustomEvent<PreviewOrderData>;
      if (customEvent.detail && customEvent.detail.isOpen) {
        setPreviewOrder(customEvent.detail);
      } else {
        setPreviewOrder(null);
      }
    };

    window.addEventListener('order-popup-preview-changed', handlePreviewChange);
    return () => window.removeEventListener('order-popup-preview-changed', handlePreviewChange);
  }, []);

  const handlePointerDown = (
    orderId: string,
    lineType: 'ENTRY' | 'SL' | 'TP',
    e: React.PointerEvent<SVGElement | HTMLDivElement>
  ) => {
    if (lineType === 'ENTRY') {
      const order = allDisplayOrders.find((o) => o.orderId === orderId);
      if (!order || order.status === 'ACTIVE' || order.type.includes('MARKET')) {
        return;
      }
    }
    e.preventDefault();
    e.stopPropagation();

    const spec = InstrumentMetadata.getSpec(currentSymbol);
    const tickSize = spec.pipSize || 0.0001;
    const targetOrder = allDisplayOrders.find((o) => o.orderId === orderId);
    const activePos = openPositions.find((p) => p.positionId === orderId || p.orderId === orderId);
    const isBuy = targetOrder ? targetOrder.direction === 'BUY' : (activePos ? activePos.direction === 'BUY' : true);
    const currentLivePrice = activePos?.currentPrice || targetOrder?.entryPrice || 0;

    const onPointerMove = (moveEv: PointerEvent) => {
      if (!containerRef.current) return;
      const bounds = containerRef.current.getBoundingClientRect();
      const relativeY = moveEv.clientY - bounds.top;
      const rawPrice = yToPrice(relativeY);
      let snappedPrice = snapPrice(rawPrice, tickSize);

      // Clamp dragged SL/TP so it NEVER crosses current live price (preventing accidental immediate liquidation)
      if (currentLivePrice > 0) {
        const buffer = tickSize * 0.5;
        if (lineType === 'SL') {
          if (isBuy) {
            snappedPrice = Math.min(snappedPrice, snapPrice(currentLivePrice - buffer, tickSize));
          } else {
            snappedPrice = Math.max(snappedPrice, snapPrice(currentLivePrice + buffer, tickSize));
          }
        } else if (lineType === 'TP') {
          if (isBuy) {
            snappedPrice = Math.max(snappedPrice, snapPrice(currentLivePrice + buffer, tickSize));
          } else {
            snappedPrice = Math.min(snappedPrice, snapPrice(currentLivePrice - buffer, tickSize));
          }
        }
      }

      dragOverrideRef.current = { orderId, lineType, price: snappedPrice };
      setDragOverride({ orderId, lineType, price: snappedPrice });

      if (orderId === '__PREVIEW__') {
        window.dispatchEvent(
          new CustomEvent('order-popup-preview-dragged', {
            detail: { lineType, price: snappedPrice },
          })
        );
      }
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      const final = dragOverrideRef.current;
      dragOverrideRef.current = null;
      setDragOverride(null);

      if (final && final.price > 0) {
        if (final.orderId === '__PREVIEW__') {
          window.dispatchEvent(
            new CustomEvent('order-popup-preview-dragged', {
              detail: { lineType: final.lineType, price: final.price },
            })
          );
        } else {
          const updates = final.lineType === 'SL'
            ? { stopLoss: final.price }
            : final.lineType === 'TP'
            ? { takeProfit: final.price }
            : { entryPrice: final.price };
          onModifyOrder(final.orderId, updates);
        }
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  const pendingOrders = orders.filter(
    (o) => o.symbol === currentSymbol && (o.status === 'PENDING' || o.status === 'ACTIVE')
  );

  const isPreviewMatching =
    previewOrder &&
    previewOrder.isOpen &&
    previewOrder.symbol.toUpperCase() === currentSymbol.toUpperCase();

  const previewOrderModel: OrderModel | null = isPreviewMatching
    ? {
        orderId: '__PREVIEW__',
        symbol: previewOrder.symbol,
        type: previewOrder.orderType as any,
        direction: previewOrder.direction,
        volume: previewOrder.volume,
        entryPrice: previewOrder.entryPrice,
        stopLoss: previewOrder.stopLoss,
        takeProfit: previewOrder.takeProfit,
        status: 'PENDING' as any,
        riskPercent: 1.0,
        riskDollar: 100,
        rewardDollar: 200,
        rrRatio: 2.0,
        comment: 'Preview',
        magicNumber: null,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      }
    : null;

  const allDisplayOrders = previewOrderModel ? [...pendingOrders, previewOrderModel] : pendingOrders;

  if (allDisplayOrders.length === 0) return null;

  const spec = InstrumentMetadata.getSpec(currentSymbol);
  const contractSize = spec.contractSize;

  const rightMargin = 45;
  const containerWidth = 480;
  const connectorX = chartWidth - rightMargin - 60;
  const labelX = Math.max(10, connectorX - containerWidth - 15);

  const openPositions = tradingEngine.getOpenPositions();

  return (
    <div ref={containerRef} className="te2-real-overlay-container">
      <svg width={chartWidth} height={chartHeight} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
        {allDisplayOrders.map((order) => {
          const isDraggingThisEntry = dragOverride && dragOverride.orderId === order.orderId && dragOverride.lineType === 'ENTRY';
          const isDraggingThisSL = dragOverride && dragOverride.orderId === order.orderId && dragOverride.lineType === 'SL';
          const isDraggingThisTP = dragOverride && dragOverride.orderId === order.orderId && dragOverride.lineType === 'TP';

          const effectiveEntry = isDraggingThisEntry ? dragOverride.price : order.entryPrice;
          const effectiveSL = isDraggingThisSL ? dragOverride.price : order.stopLoss;
          const effectiveTP = isDraggingThisTP ? dragOverride.price : order.takeProfit;

          const isBuy = order.type.startsWith('BUY');
          const direction = isBuy ? 'BUY' : 'SELL';
          const entryY = priceToY(effectiveEntry);
          const slY = effectiveSL !== null ? priceToY(effectiveSL) : null;
          const tpY = effectiveTP !== null ? priceToY(effectiveTP) : null;
          const activePos = openPositions.find((p) => p.positionId === order.orderId || p.orderId === order.orderId);
          const liveChart = activeChartBridge.getChartState();
          const currentLivePrice = (liveChart && liveChart.symbol === currentSymbol && liveChart.currentReplayPrice > 0)
            ? liveChart.currentReplayPrice
            : (activePos?.currentPrice || order.entryPrice);

          const floatingPnL = activePos
            ? (typeof activePos.floatingPnL === 'number'
                ? activePos.floatingPnL
                : PriceComparator.calculatePositionPnl(direction, order.entryPrice, currentLivePrice, order.volume, contractSize, currentSymbol))
            : 0;
          const isPosActive = !!activePos || order.status === 'ACTIVE';

          const estimatedLoss = effectiveSL !== null
            ? RiskCalculator.calculateEstimatedLoss(direction, effectiveEntry, effectiveSL, order.volume, contractSize, currentSymbol)
            : 0;

          const estimatedProfit = effectiveTP !== null
            ? RewardCalculator.calculateEstimatedProfit(direction, effectiveEntry, effectiveTP, order.volume, contractSize, currentSymbol)
            : 0;

          const slRR = effectiveSL !== null && effectiveTP !== null
            ? RewardCalculator.calculateRiskRewardRatio(effectiveEntry, effectiveSL, effectiveTP)
            : null;

          let tpRRRatio = '3';
          if (slRR && slRR.rrRatio > 0) {
            tpRRRatio = slRR.rrRatio % 1 === 0 ? slRR.rrRatio.toFixed(0) : slRR.rrRatio.toFixed(1);
          }

          const isEntryDraggable = order.orderId === '__PREVIEW__' ? !order.type.includes('MARKET') : order.status === 'PENDING';

          // Vertical connector line bounds
          const yPoints: number[] = [];
          if (entryY !== null) yPoints.push(entryY);
          if (slY !== null) yPoints.push(slY);
          if (tpY !== null) yPoints.push(tpY);
          const minY = yPoints.length > 0 ? Math.min(...yPoints) : 0;
          const maxY = yPoints.length > 0 ? Math.max(...yPoints) : 0;

          return (
            <g key={order.orderId}>
              {/* Vertical Connector Line on the right */}
              {yPoints.length > 1 && (
                <g className="tv-connector-group">
                  <line
                    x1={connectorX}
                    y1={minY}
                    x2={connectorX}
                    y2={maxY}
                    className="tv-connector-line"
                  />
                  {entryY !== null && <circle cx={connectorX} cy={entryY} r={3.5} className="tv-connector-dot entry" />}
                  {slY !== null && <circle cx={connectorX} cy={slY} r={3.5} className="tv-connector-dot sl" />}
                  {tpY !== null && <circle cx={connectorX} cy={tpY} r={3.5} className="tv-connector-dot tp" />}
                </g>
              )}

              {/* ENTRY Line */}
              {entryY !== null && entryY >= -50 && entryY <= chartHeight + 50 && (
                <g className="te2-real-line-group entry-group">
                  <line
                    x1={0}
                    y1={entryY}
                    x2={chartWidth}
                    y2={entryY}
                    className="te2-real-hitbox entry-hitbox"
                    style={{ cursor: isEntryDraggable ? 'ns-resize' : 'default' }}
                    onPointerDown={isEntryDraggable ? (e) => handlePointerDown(order.orderId, 'ENTRY', e) : undefined}
                  />
                  <line x1={0} y1={entryY} x2={chartWidth - rightMargin} y2={entryY} className={`te2-real-line entry ${isBuy ? 'buy' : 'sell'}`} />
                  <foreignObject x={labelX} y={entryY - 14} width={containerWidth} height={30} style={{ pointerEvents: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', width: '100%', height: '100%', pointerEvents: 'auto' }}>
                      <div className={`tv-badge-entry-wrapper ${isBuy ? 'buy' : 'sell'}`}>
                        {/* TP Toggle Button */}
                        <button
                          type="button"
                          className={`tv-pill-toggle tp ${order.takeProfit !== null ? 'active' : ''}`}
                          title={order.takeProfit !== null ? 'Remove TP' : 'Add Default TP (1:3)'}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (order.orderId === '__PREVIEW__') {
                              const newTp = order.takeProfit !== null ? 0 : (isBuy ? order.entryPrice + 60 * spec.pipSize : order.entryPrice - 60 * spec.pipSize);
                              window.dispatchEvent(new CustomEvent('order-popup-preview-dragged', { detail: { lineType: 'TP', price: snapPrice(newTp, spec.pipSize) } }));
                            } else if (order.takeProfit !== null) {
                              onModifyOrder(order.orderId, { takeProfit: null });
                            } else {
                              const tpOffset = 60 * spec.pipSize;
                              const newTp = isBuy ? order.entryPrice + tpOffset : order.entryPrice - tpOffset;
                              onModifyOrder(order.orderId, { takeProfit: snapPrice(newTp, spec.pipSize) });
                            }
                          }}
                        >
                          TP
                        </button>

                        {/* SL Toggle Button */}
                        <button
                          type="button"
                          className={`tv-pill-toggle sl ${order.stopLoss !== null ? 'active' : ''}`}
                          title={order.stopLoss !== null ? 'Remove SL' : 'Add Default SL'}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (order.orderId === '__PREVIEW__') {
                              const newSl = order.stopLoss !== null ? 0 : (isBuy ? order.entryPrice - 20 * spec.pipSize : order.entryPrice + 20 * spec.pipSize);
                              window.dispatchEvent(new CustomEvent('order-popup-preview-dragged', { detail: { lineType: 'SL', price: snapPrice(newSl, spec.pipSize) } }));
                            } else if (order.stopLoss !== null) {
                              onModifyOrder(order.orderId, { stopLoss: null });
                            } else {
                              const slOffset = 20 * spec.pipSize;
                              const newSl = isBuy ? order.entryPrice - slOffset : order.entryPrice + slOffset;
                              onModifyOrder(order.orderId, { stopLoss: snapPrice(newSl, spec.pipSize) });
                            }
                          }}
                        >
                          SL
                        </button>

                        {/* BEP Toggle Button (Only for active open positions) */}
                        {isPosActive && (
                          <button
                            type="button"
                            className={`tv-pill-toggle bep ${order.stopLoss === order.entryPrice ? 'active' : ''}`}
                            title={order.stopLoss === order.entryPrice ? 'SL is already at Break Even' : 'Set Stop Loss to Break Even (Entry Price)'}
                            onClick={(e) => {
                              e.stopPropagation();
                              onModifyOrder(order.orderId, { stopLoss: order.entryPrice });
                            }}
                          >
                            BEP
                          </button>
                        )}

                        {/* Main Entry Pill: [ volume | Buy Limit / Buy | ✕ ] or Active [ -1 | -45.00 USD | ✕ ] */}
                        <div
                          className={`tv-pill-main ${isBuy ? 'buy' : 'sell'} ${isPosActive ? 'active-pos' : ''}`}
                          style={{
                            cursor: isPosActive
                              ? 'pointer'
                              : isEntryDraggable
                              ? 'ns-resize'
                              : order.orderId === '__PREVIEW__'
                              ? 'default'
                              : 'pointer',
                          }}
                          title={
                            isPosActive
                              ? 'Click to modify position'
                              : isEntryDraggable
                              ? 'Drag to adjust Entry Price'
                              : order.orderId === '__PREVIEW__'
                              ? 'Order Preview'
                              : 'Click to modify order'
                          }
                          onPointerDown={
                            !isPosActive && isEntryDraggable
                              ? (e) => handlePointerDown(order.orderId, 'ENTRY', e)
                              : undefined
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            if (order.orderId === '__PREVIEW__') return;
                            if (isEntryDraggable) return;
                            setModifyItem({
                              id: order.orderId,
                              symbol: order.symbol,
                              direction: isBuy ? 'BUY' : 'SELL',
                              entryPrice: order.entryPrice,
                              volume: order.volume,
                              stopLoss: order.stopLoss,
                              takeProfit: order.takeProfit,
                              isPendingOrder: order.status === 'PENDING',
                            });
                          }}
                        >
                          {isPosActive ? (
                            <>
                              <span className={`tv-pill-tag ${isBuy ? 'buy' : 'sell'}`}>
                                {isBuy ? `${order.volume}` : `-${order.volume}`}
                              </span>
                              <span className={`tv-pill-segment amount ${floatingPnL >= 0 ? 'profit' : 'loss'}`}>
                                {floatingPnL >= 0 ? `+${formatAmount(floatingPnL)} USD` : `-${formatAmount(Math.abs(floatingPnL))} USD`}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="tv-pill-segment vol">{order.volume}</span>
                              <span className="tv-pill-segment title">
                                {order.orderId === '__PREVIEW__' ? `Preview ${getOrderTypeLabel(order.type)}` : getOrderTypeLabel(order.type)}
                              </span>
                            </>
                          )}
                          <button
                            type="button"
                            className="tv-pill-segment close"
                            title={order.orderId === '__PREVIEW__' ? 'Cancel Preview' : (isPosActive ? 'Close Position' : 'Cancel Order')}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (order.orderId === '__PREVIEW__') {
                                window.dispatchEvent(new CustomEvent('order-popup-preview-cancel'));
                              } else {
                                onCancelOrder(order.orderId);
                              }
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  </foreignObject>
                </g>
              )}

              {/* TAKE PROFIT Line (Pointer Capture Draggable) */}
              {tpY !== null && effectiveTP !== null && tpY >= -50 && tpY <= chartHeight + 50 && (
                <g className="te2-real-line-group tp-group">
                  <line
                    x1={0}
                    y1={tpY}
                    x2={chartWidth}
                    y2={tpY}
                    className="te2-real-hitbox tp-hitbox"
                    onPointerDown={(e) => handlePointerDown(order.orderId, 'TP', e)}
                  />
                  <line x1={0} y1={tpY} x2={chartWidth - rightMargin} y2={tpY} className="te2-real-line tp" />
                  <foreignObject x={labelX} y={tpY - 14} width={containerWidth} height={30} style={{ pointerEvents: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', width: '100%', height: '100%', paddingRight: entryY !== null && Math.abs(tpY - entryY) < 24 ? '260px' : '0px', pointerEvents: 'auto' }}>
                      <div
                        className="tv-badge-pill tp"
                        onPointerDown={(e) => handlePointerDown(order.orderId, 'TP', e)}
                      >
                        <span className="tv-pill-segment rr">{tpRRRatio}</span>
                        <span className="tv-pill-segment amount profit">+{formatAmount(estimatedProfit)} USD</span>
                        <button
                          type="button"
                          className="tv-pill-segment close"
                          title="Remove Take Profit"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (order.orderId === '__PREVIEW__') {
                              window.dispatchEvent(new CustomEvent('order-popup-preview-dragged', { detail: { lineType: 'TP', price: 0 } }));
                            } else {
                              onModifyOrder(order.orderId, { takeProfit: null });
                            }
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </foreignObject>
                </g>
              )}

              {/* STOP LOSS Line (Pointer Capture Draggable) - Hidden when at Break Even (BEP) */}
              {slY !== null && effectiveSL !== null && Math.abs(effectiveSL - effectiveEntry) > (spec.pipSize * 0.05) && slY >= -50 && slY <= chartHeight + 50 && (
                <g className="te2-real-line-group sl-group">
                  <line
                    x1={0}
                    y1={slY}
                    x2={chartWidth}
                    y2={slY}
                    className="te2-real-hitbox sl-hitbox"
                    onPointerDown={(e) => handlePointerDown(order.orderId, 'SL', e)}
                  />
                  <line x1={0} y1={slY} x2={chartWidth - rightMargin} y2={slY} className="te2-real-line sl" />
                  <foreignObject x={labelX} y={slY - 14} width={containerWidth} height={30} style={{ pointerEvents: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', width: '100%', height: '100%', paddingRight: entryY !== null && Math.abs(slY - entryY) < 24 ? '260px' : '0px', pointerEvents: 'auto' }}>
                      <div
                        className="tv-badge-pill sl"
                        onPointerDown={(e) => handlePointerDown(order.orderId, 'SL', e)}
                      >
                        <span className="tv-pill-segment rr">1</span>
                        <span className="tv-pill-segment amount loss">-{formatAmount(estimatedLoss)} USD</span>
                        <button
                          type="button"
                          className="tv-pill-segment close"
                          title="Remove Stop Loss"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (order.orderId === '__PREVIEW__') {
                              window.dispatchEvent(new CustomEvent('order-popup-preview-dragged', { detail: { lineType: 'SL', price: 0 } }));
                            } else {
                              onModifyOrder(order.orderId, { stopLoss: null });
                            }
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </foreignObject>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* Modify Position / Order Modal */}
      <ModifyPositionModal
        isOpen={modifyItem !== null}
        item={modifyItem}
        onClose={() => setModifyItem(null)}
        onSave={(updates) => {
          if (modifyItem) {
            onModifyOrder(modifyItem.id, {
              volume: updates.volume,
              entryPrice: updates.entryPrice,
              stopLoss: updates.stopLoss,
              takeProfit: updates.takeProfit,
            });
          }
        }}
      />
    </div>
  );
};
