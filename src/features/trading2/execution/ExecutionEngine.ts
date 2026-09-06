/**
 * Trading Engine 2.0 — ExecutionEngine
 * Core execution runtime processing market price updates (ticks/candles) against orders & positions.
 * ONLY module allowed to evaluate market price triggers against Orders & Positions.
 * Integrates strictly with TradingStore, OrderManager, PositionManager, AccountManager, HistoryManager, & EventBus.
 * NEVER communicates directly with React, UI, Chart, Drawing, Workspace, or Replay UI.
 */

import type { TradingStore } from '../store/TradingStore';
import type { OrderManager } from '../order/OrderManager';
import type { PositionManager } from '../position/PositionManager';
import type { AccountManager } from '../account/AccountManager';
import type { HistoryManager } from '../history/HistoryManager';
import type { PositionModel } from '../position/PositionTypes';
import type { CreateOrderParams } from '../order/OrderTypes';
import type {
  MarketPriceUpdate,
  ExecutionConfig,
  ExecutionSummary,
} from './ExecutionTypes';
import { DEFAULT_EXECUTION_CONFIG } from './ExecutionTypes';
import type {
  ExecutionEventKey,
  ExecutionEventListener,
  ExecutionEventPayloads,
} from './ExecutionEvents';
import { ExecutionRuntime } from './ExecutionRuntime';
import { PriceComparator } from './PriceComparator';
import { InstrumentMetadata } from '../instrument/InstrumentMetadata';

export class ExecutionEngine {
  private store: TradingStore;
  private orderManager: OrderManager;
  private positionManager: PositionManager;
  private accountManager: AccountManager;
  private historyManager: HistoryManager;
  private config: ExecutionConfig;
  private runtime: ExecutionRuntime;
  private listeners: { [K in ExecutionEventKey]?: ExecutionEventListener<K>[] } = {};

  constructor(
    store: TradingStore,
    orderManager: OrderManager,
    positionManager: PositionManager,
    accountManager: AccountManager,
    historyManager: HistoryManager,
    config: Partial<ExecutionConfig> = {}
  ) {
    this.store = store;
    this.orderManager = orderManager;
    this.positionManager = positionManager;
    this.accountManager = accountManager;
    this.historyManager = historyManager;
    this.config = { ...DEFAULT_EXECUTION_CONFIG, ...config };
    this.runtime = new ExecutionRuntime();
    this.runtime.start();
  }

  // ─── EVENT SUBSCRIPTION ───────────────────────────────────────────

  public on<K extends ExecutionEventKey>(
    event: K,
    listener: ExecutionEventListener<K>
  ): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    (this.listeners[event] as ExecutionEventListener<K>[]).push(listener);

    return () => this.off(event, listener);
  }

  public off<K extends ExecutionEventKey>(
    event: K,
    listener: ExecutionEventListener<K>
  ): void {
    const list = this.listeners[event] as ExecutionEventListener<K>[] | undefined;
    if (!list) return;
    this.listeners[event] = list.filter((l) => l !== listener) as any;
  }

  private emit<K extends ExecutionEventKey>(
    event: K,
    payload: ExecutionEventPayloads[K]
  ): void {
    const list = this.listeners[event] as ExecutionEventListener<K>[] | undefined;
    if (!list || list.length === 0) return;

    const listCopy = [...list];
    for (const listener of listCopy) {
      try {
        listener(payload);
      } catch (err) {
        console.error(`[ExecutionEngine] Listener error for event "${event}":`, err);
      }
    }
  }

  // ─── CORE EXECUTION LOOP (PROCESS MARKET TICK / CANDLE) ─────────────

  /**
   * Processes a single market tick/candle update:
   * 1. Evaluates pending orders (LIMIT / STOP) -> triggers fill & position open
   * 2. Evaluates active positions -> updates current price & floating PnL
   * 3. Evaluates SL / TP triggers -> closes position & archives trade history
   * 4. Updates Account state via AccountManager
   */
  public processMarketTick(update: MarketPriceUpdate): ExecutionSummary {
    this.runtime.incrementTickCount(update.timestamp);

    let ordersFilled = 0;
    let positionsClosed = 0;
    let slHits = 0;
    let tpHits = 0;

    // STEP 1: Evaluate Pending Orders (Limit & Stop Orders)
    const pendingOrders = this.orderManager.getPendingOrders();
    for (const order of pendingOrders) {
      if (order.symbol !== update.symbol) continue;

      // Auto-heal createdAt if wall-clock Date.now() was used during historical replay
      if (order.createdAt > update.timestamp + 86400000) {
        order.createdAt = update.timestamp;
      }

      // Guard: Do not trigger pending orders against candles strictly before the order was placed
      if (update.timestamp < order.createdAt) {
        continue;
      }

      let isTriggered = false;
      let triggerPrice = order.entryPrice;

      if (order.type.includes('LIMIT')) {
        isTriggered = PriceComparator.checkLimitOrderTrigger(
          order.type,
          order.entryPrice,
          update.high,
          update.low,
          update.bid,
          update.ask
        );
      } else if (order.type.includes('STOP')) {
        isTriggered = PriceComparator.checkStopOrderTrigger(
          order.type,
          order.entryPrice,
          update.high,
          update.low,
          update.bid,
          update.ask
        );
      }

      if (isTriggered) {
        const filledOrder = this.orderManager.fillOrder(order.orderId, triggerPrice, update.timestamp);
        if (filledOrder) {
          ordersFilled++;
          const position = this.positionManager.openPosition({
            order: filledOrder,
            fillPrice: triggerPrice,
            openedAt: update.timestamp,
          }, update.timestamp);

          this.emit('OrderFilled', { order: filledOrder, fillPrice: triggerPrice, filledAt: update.timestamp });
          this.emit('PositionOpened', { position });
        }
      }
    }

    // STEP 2 & 3: Evaluate Active Positions (Floating PnL & SL/TP Triggers)
    const openPositions = this.positionManager.getOpenPositions();
    let totalFloatingPnL = 0;

    for (const pos of openPositions) {
      const posSym = (pos.symbol ?? '').trim().toUpperCase();
      const updSym = (update.symbol ?? '').trim().toUpperCase();
      if (posSym !== updSym) {
        totalFloatingPnL += pos.floatingPnL;
        continue;
      }

      // Auto-heal openedAt if wall-clock Date.now() was used during historical replay
      if (pos.openedAt > update.timestamp + 86400000) {
        this.positionManager.updatePosition(pos.positionId, {
          openedAt: update.timestamp,
        });
        pos.openedAt = update.timestamp;
      }

      // Guard: Do not evaluate SL/TP triggers against candles strictly before the position opened
      if (update.timestamp < pos.openedAt) {
        continue;
      }

      const symbolContractSize = InstrumentMetadata.getContractSize(pos.symbol);
      const currentPrice = pos.direction === 'BUY' ? update.bid : update.ask;
      const floatingPnL = PriceComparator.calculatePositionPnl(
        pos.direction,
        pos.entryPrice,
        currentPrice,
        pos.volume,
        symbolContractSize,
        pos.symbol
      );

      totalFloatingPnL += floatingPnL;

      // Update position current price & floating PnL
      this.positionManager.updatePosition(pos.positionId, {
        currentPrice,
        floatingPnL,
      });

      let isSlHit = false;
      let isTpHit = false;

      if (this.config.autoTriggerSLTP) {
        // On the entry candle itself, do NOT check historical high/low wicks that formed before entry.
        // Only subsequent future candles (timestamp > openedAt) evaluate against candle high/low extremes.
        const isSameCandle = update.timestamp <= pos.openedAt;
        const evalHigh = isSameCandle ? currentPrice : update.high;
        const evalLow = isSameCandle ? currentPrice : update.low;

        const slHit =
          PriceComparator.checkStopLossHit(pos.direction, pos.stopLoss, evalHigh, evalLow) ||
          (pos.stopLoss !== null && pos.stopLoss > 0 && currentPrice > 0
            ? (pos.direction === 'BUY' ? currentPrice <= pos.stopLoss : currentPrice >= pos.stopLoss)
            : false);

        const tpHit =
          PriceComparator.checkTakeProfitHit(pos.direction, pos.takeProfit, evalHigh, evalLow) ||
          (pos.takeProfit !== null && pos.takeProfit > 0 && currentPrice > 0
            ? (pos.direction === 'BUY' ? currentPrice >= pos.takeProfit : currentPrice <= pos.takeProfit)
            : false);

        if (slHit && tpHit) {
          // When both SL and TP are touched in the same candle:
          // We use the "Proximity to Open" heuristic to determine which was likely hit first.
          // The trigger closest to the candle's open price is assumed to be hit first.
          const slDistance = pos.stopLoss ? Math.abs(pos.stopLoss - update.open) : Infinity;
          const tpDistance = pos.takeProfit ? Math.abs(pos.takeProfit - update.open) : Infinity;
          
          if (tpDistance < slDistance) {
            isTpHit = true;
          } else {
            isSlHit = true;
          }
        } else {
          isSlHit = slHit;
          isTpHit = tpHit;
        }
      }

      if (isSlHit) {
        const slPrice = pos.stopLoss ?? currentPrice;
        const closedPos = this.positionManager.closePosition(pos.positionId, slPrice, update.timestamp);

        if (closedPos) {
          positionsClosed++;
          slHits++;

          console.log('[POSITION-CLOSED]', {
            positionId: closedPos.positionId,
            symbol: closedPos.symbol,
            closePrice: slPrice,
            reason: 'SL',
            timestamp: update.timestamp,
          });

          const pnl = PriceComparator.calculatePositionPnl(pos.direction, pos.entryPrice, slPrice, pos.volume, symbolContractSize, pos.symbol);
          const tradeRecord = {
            tradeId: `TRD-SL-${update.timestamp}-${pos.positionId}`,
            positionId: pos.positionId,
            orderId: pos.orderId,
            symbol: pos.symbol,
            direction: pos.direction,
            volume: pos.volume,
            entryPrice: pos.entryPrice,
            exitPrice: slPrice,
            stopLoss: pos.stopLoss,
            takeProfit: pos.takeProfit,
            realizedPnL: pnl,
            commission: pos.commission,
            swap: pos.swap,
            comment: pos.comment ?? null,
            magicNumber: pos.magicNumber,
            openedAt: pos.openedAt,
            closedAt: update.timestamp,
            closeReason: 'SL' as const,
            screenshots: pos.screenshots,
          };

          this.historyManager.addHistory(tradeRecord);
          this.accountManager.applyRealizedPnL(pnl);

          this.emit('StopLossHit', { position: closedPos, slPrice, closedAt: update.timestamp });
          this.emit('PositionClosed', { position: closedPos, closePrice: slPrice, reason: 'SL' });
          this.emit('HistoryAdded', { trade: tradeRecord });
        }
        continue;
      }

      // Check Take Profit Trigger
      if (isTpHit) {
        const tpPrice = pos.takeProfit ?? currentPrice;
        const closedPos = this.positionManager.closePosition(pos.positionId, tpPrice, update.timestamp);

        if (closedPos) {
          positionsClosed++;
          tpHits++;

          console.log('[POSITION-CLOSED]', {
            positionId: closedPos.positionId,
            symbol: closedPos.symbol,
            closePrice: tpPrice,
            reason: 'TP',
            timestamp: update.timestamp,
          });

          const pnl = PriceComparator.calculatePositionPnl(pos.direction, pos.entryPrice, tpPrice, pos.volume, symbolContractSize, pos.symbol);
          const tradeRecord = {
            tradeId: `TRD-TP-${update.timestamp}-${pos.positionId}`,
            positionId: pos.positionId,
            orderId: pos.orderId,
            symbol: pos.symbol,
            direction: pos.direction,
            volume: pos.volume,
            entryPrice: pos.entryPrice,
            exitPrice: tpPrice,
            stopLoss: pos.stopLoss,
            takeProfit: pos.takeProfit,
            realizedPnL: pnl,
            commission: pos.commission,
            swap: pos.swap,
            comment: pos.comment ?? null,
            magicNumber: pos.magicNumber,
            openedAt: pos.openedAt,
            closedAt: update.timestamp,
            closeReason: 'TP' as const,
            screenshots: pos.screenshots,
          };

          this.historyManager.addHistory(tradeRecord);
          this.accountManager.applyRealizedPnL(pnl);

          this.emit('TakeProfitHit', { position: closedPos, tpPrice, closedAt: update.timestamp });
          this.emit('PositionClosed', { position: closedPos, closePrice: tpPrice, reason: 'TP' });
          this.emit('HistoryAdded', { trade: tradeRecord });
        }
        continue;
      }
    }

    // STEP 4: Update Account Metrics
    this.accountManager.updateFloatingPnL(totalFloatingPnL);
    const accountState = this.accountManager.getAccountModel();

    this.emit('PositionUpdated', {
      positionsCount: this.positionManager.getOpenPositions().length,
      totalFloatingPnL,
    });

    this.emit('AccountUpdated', {
      balance: accountState.balance,
      equity: accountState.equity,
      floatingPnL: accountState.floatingPnL,
    });

    const summary: ExecutionSummary = {
      ticksProcessed: this.runtime.getTotalTicks(),
      ordersFilled,
      positionsClosed,
      slHits,
      tpHits,
      totalFloatingPnL,
      timestamp: update.timestamp,
    };

    this.emit('ExecutionCycleCompleted', { summary });
    return summary;
  }

  /**
   * Helper method to instantly process and fill a MARKET order.
   */
  public processMarketOrder(params: CreateOrderParams, marketPrice: number, now: number = Date.now()): PositionModel {
    const order = this.orderManager.createOrder({
      ...params,
      entryPrice: marketPrice,
    }, now);

    if (order.status === 'REJECTED') {
      throw new Error(`[ExecutionEngine] Order rejected: ${order.rejectionReason}`);
    }

    const filledOrder = this.orderManager.fillOrder(order.orderId, marketPrice, now);
    if (!filledOrder) {
      throw new Error('[ExecutionEngine] Failed to fill market order.');
    }

    const position = this.positionManager.openPosition({
      order: filledOrder,
      fillPrice: marketPrice,
      openedAt: now,
    }, now);

    this.emit('OrderFilled', { order: filledOrder, fillPrice: marketPrice, filledAt: now });
    this.emit('PositionOpened', { position });

    return position;
  }

  // ─── QUERY & CONTROL METHODS ──────────────────────────────────────

  public reset(): void {
    this.runtime.reset();
  }

  public getRuntime(): ExecutionRuntime {
    return this.runtime;
  }

  public getConfig(): Readonly<ExecutionConfig> {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<ExecutionConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
