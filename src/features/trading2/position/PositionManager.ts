/**
 * Trading Engine 2.0 — PositionManager
 * Business layer managing ONLY active positions: Open, Update, Modify SL/TP, Partial Close, Close, and Reverse.
 * Full Hedging Support: Multiple BUY and SELL positions on the same symbol coexist independently without merging or netting.
 * Integrates strictly with TradingStore, AccountManager, and OrderManager.
 * Zero UI, React, Chart, Drawing, or Replay dependencies.
 */

import type { TradingStore } from '../store/TradingStore';
import type { AccountManager } from '../account/AccountManager';
import type { OrderManager } from '../order/OrderManager';
import type { OrderModel } from '../order/OrderTypes';
import type {
  PositionModel,
  OpenPositionParams,
  ModifyPositionParams,
  PartialCloseParams,
  PositionValidationResult,
  PositionDirection,
} from './PositionTypes';
import type {
  PositionEventKey,
  PositionEventListener,
  PositionEventPayloads,
} from './PositionEvents';
import { PositionFactory } from './PositionFactory';
import { PositionValidator } from './PositionValidator';
import type { PositionState } from '../store/TradingStoreTypes';

export class PositionManager {
  private store: TradingStore;
  private accountManager: AccountManager;
  private orderManager: OrderManager;
  private listeners: { [K in PositionEventKey]?: PositionEventListener<K>[] } = {};

  constructor(
    store: TradingStore,
    accountManager: AccountManager,
    orderManager: OrderManager
  ) {
    this.store = store;
    this.accountManager = accountManager;
    this.orderManager = orderManager;
  }

  // ─── EVENT SUBSCRIPTION ───────────────────────────────────────────

  public on<K extends PositionEventKey>(
    event: K,
    listener: PositionEventListener<K>
  ): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    (this.listeners[event] as PositionEventListener<K>[]).push(listener);

    return () => this.off(event, listener);
  }

  public off<K extends PositionEventKey>(
    event: K,
    listener: PositionEventListener<K>
  ): void {
    const list = this.listeners[event] as PositionEventListener<K>[] | undefined;
    if (!list) return;
    this.listeners[event] = list.filter((l) => l !== listener) as any;
  }

  private emit<K extends PositionEventKey>(
    event: K,
    payload: PositionEventPayloads[K]
  ): void {
    const list = this.listeners[event] as PositionEventListener<K>[] | undefined;
    if (!list || list.length === 0) return;

    const listCopy = [...list];
    for (const listener of listCopy) {
      try {
        listener(payload);
      } catch (err) {
        console.error(`[PositionManager] Listener error for event "${event}":`, err);
      }
    }
  }

  // ─── PUBLIC POSITION LIFECYCLE METHODS ────────────────────────────

  /**
   * Opens a new Hedging position from an executed order.
   * Every position receives a unique PositionID; positions are never merged or netted.
   */
  public openPosition(params: OpenPositionParams, now: number = Date.now()): PositionModel {
    const validation = PositionValidator.validateOpen(params);
    if (!validation.valid) {
      throw new Error(`[PositionManager] Invalid open position parameters: ${validation.errors.join('; ')}`);
    }

    const position = PositionFactory.createPosition(params, now);
    this.store.addPosition(this.mapToStoreState(position));

    this.emit('PositionOpened', { position });
    this.emit('PositionChanged', { event: 'OPEN', position });
    return position;
  }

  /**
   * Updates position dynamic properties (e.g. currentPrice, floatingPnL).
   */
  public updatePosition(
    positionId: string,
    updates: Partial<PositionModel>
  ): PositionModel | undefined {
    const existing = this.getPosition(positionId);
    if (!existing || existing.status === 'CLOSED') return undefined;

    const updated: PositionModel = {
      ...existing,
      ...updates,
      modifiedAt: updates.modifiedAt ?? existing.modifiedAt,
    };

    this.store.updatePosition(this.mapToStoreState(updated));
    this.emit('PositionUpdated', { position: updated });
    this.emit('PositionChanged', { event: 'UPDATE', position: updated });
    return updated;
  }

  /**
   * Modifies Stop Loss of an open position.
   */
  public modifySL(positionId: string, stopLoss: number | null): PositionModel | undefined {
    return this.modifyPosition({ positionId, stopLoss });
  }

  /**
   * Modifies Take Profit of an open position.
   */
  public modifyTP(positionId: string, takeProfit: number | null): PositionModel | undefined {
    return this.modifyPosition({ positionId, takeProfit });
  }

  /**
   * Modifies position SL, TP, Comment, or Magic Number.
   */
  public modifyPosition(params: ModifyPositionParams, now: number = Date.now()): PositionModel | undefined {
    const existing = this.getPosition(params.positionId) ||
      this.getOpenPositions().find((p) => p.positionId === params.positionId || p.orderId === params.positionId);
    if (!existing || existing.status === 'CLOSED') return undefined;

    const validation = PositionValidator.validateModify(existing, params);
    if (!validation.valid) {
      console.warn(`[PositionManager] Invalid modify parameters: ${validation.errors.join('; ')}`);
      return undefined;
    }

    const updated: PositionModel = {
      ...existing,
      volume: params.volume !== undefined ? params.volume : existing.volume,
      stopLoss: params.stopLoss !== undefined ? params.stopLoss : existing.stopLoss,
      takeProfit: params.takeProfit !== undefined ? params.takeProfit : existing.takeProfit,
      comment: params.comment !== undefined ? params.comment : existing.comment,
      magicNumber: params.magicNumber !== undefined ? params.magicNumber : existing.magicNumber,
      modifiedAt: now,
    };

    this.store.updatePosition(this.mapToStoreState(updated));
    this.emit('PositionModified', { oldPosition: existing, newPosition: updated });
    this.emit('PositionChanged', { event: 'MODIFY', position: updated });
    return updated;
  }

  /**
   * Partials closes a position by reducing volume (e.g. 0.50 lot -> close 0.20 -> 0.30 remaining).
   */
  public partialClose(
    params: PartialCloseParams,
    now: number = Date.now()
  ): { remainingPosition: PositionModel; closedPosition: PositionModel } | undefined {
    const existing = this.getPosition(params.positionId);
    if (!existing || existing.status === 'CLOSED') return undefined;

    const validation = PositionValidator.validatePartialClose(existing, params.closeVolume);
    if (!validation.valid) {
      throw new Error(`[PositionManager] Invalid partial close: ${validation.errors.join('; ')}`);
    }

    if (params.closeVolume >= existing.volume) {
      const closed = this.closePosition(params.positionId, params.closePrice, now);
      if (!closed) return undefined;
      return { remainingPosition: closed, closedPosition: closed };
    }

    const remainingVolume = Math.round((existing.volume - params.closeVolume) * 100) / 100;

    const remainingPosition: PositionModel = {
      ...existing,
      volume: remainingVolume,
      status: 'PARTIALLY_CLOSED',
      modifiedAt: now,
    };

    const closedPosition: PositionModel = {
      ...existing,
      positionId: `${existing.positionId}-PCL`,
      volume: params.closeVolume,
      currentPrice: params.closePrice,
      status: 'CLOSED',
      closedAt: now,
      modifiedAt: now,
    };

    this.store.updatePosition(this.mapToStoreState(remainingPosition));

    this.emit('PositionPartiallyClosed', {
      originalPositionId: existing.positionId,
      closedVolume: params.closeVolume,
      remainingPosition,
      closedPosition,
    });
    this.emit('PositionChanged', { event: 'PARTIAL_CLOSE', position: remainingPosition, closedPosition });

    return { remainingPosition, closedPosition };
  }

  /**
   * Closes a position fully.
   */
  public closePosition(positionId: string, closePrice: number, now: number = Date.now()): PositionModel | undefined {
    const existing = this.getPosition(positionId) ||
      this.getOpenPositions().find((p) => p.positionId === positionId || p.orderId === positionId);
    if (!existing || existing.status === 'CLOSED') return undefined;

    const closed: PositionModel = {
      ...existing,
      currentPrice: closePrice,
      status: 'CLOSED',
      closedAt: now,
      modifiedAt: now,
    };

    this.store.removePosition(existing.positionId);
    this.emit('PositionClosed', { position: closed, closePrice, closedAt: now });
    this.emit('PositionChanged', { event: 'CLOSE', closedPosition: closed });
    return closed;
  }

  /**
   * Reverses a position: closes current position & opens equivalent opposite direction position.
   */
  public reversePosition(
    positionId: string,
    reversePrice: number,
    now: number = Date.now()
  ): { closedPosition: PositionModel; reversedPosition: PositionModel } | undefined {
    const existing = this.getPosition(positionId);
    if (!existing || existing.status === 'CLOSED') return undefined;

    const closedPosition = this.closePosition(positionId, reversePrice, now);
    if (!closedPosition) return undefined;

    const oppositeDirection: PositionDirection = existing.direction === 'BUY' ? 'SELL' : 'BUY';

    // Create a dummy filled order for the opposite position
    const reverseOrder: OrderModel = {
      orderId: `ORD-REV-${now}`,
      symbol: existing.symbol,
      type: oppositeDirection === 'BUY' ? 'BUY_MARKET' : 'SELL_MARKET',
      direction: oppositeDirection,
      volume: existing.volume,
      entryPrice: reversePrice,
      stopLoss: null,
      takeProfit: null,
      riskPercent: 0,
      riskDollar: existing.riskDollar,
      rewardDollar: 0,
      rrRatio: 0,
      comment: existing.comment ? `Reverse of ${positionId}` : 'Position Reversed',
      magicNumber: existing.magicNumber,
      createdAt: now,
      modifiedAt: now,
      status: 'FILLED',
    };

    const reversedPosition = this.openPosition({ order: reverseOrder, fillPrice: reversePrice, openedAt: now }, now);

    this.emit('PositionReversed', { closedPosition, newPosition: reversedPosition });
    this.emit('PositionChanged', { event: 'REVERSE', position: reversedPosition, closedPosition });
    return { closedPosition, reversedPosition };
  }

  // ─── QUERY METHODS ────────────────────────────────────────────────

  public getPosition(positionId: string): PositionModel | undefined {
    const state = this.store.getPositionById(positionId);
    return state ? this.mapToModel(state) : undefined;
  }

  public getPositions(): ReadonlyArray<PositionModel> {
    return this.store.getPositions().map((p) => this.mapToModel(p));
  }

  public getOpenPositions(): ReadonlyArray<PositionModel> {
    return this.store.getOpenPositions().map((p) => this.mapToModel(p));
  }

  public validateOpen(params: OpenPositionParams): PositionValidationResult {
    return PositionValidator.validateOpen(params);
  }

  public reset(): void {
    this.store.resetStore();
    this.emit('PositionChanged', { event: 'RESET' });
  }

  // ─── MAPPER HELPERS ───────────────────────────────────────────────

  private mapToModel(state: PositionState): PositionModel {
    return {
      positionId: state.positionId,
      orderId: state.orderId,
      symbol: state.symbol,
      direction: state.direction as PositionDirection,
      volume: state.volume,
      entryPrice: state.entryPrice,
      currentPrice: state.currentPrice,
      stopLoss: state.stopLoss,
      takeProfit: state.takeProfit,
      floatingPnL: state.floatingPnL,
      realizedPnL: 0,
      commission: state.commission,
      swap: state.swap,
      riskDollar: 0,
      rewardDollar: 0,
      rrRatio: 0,
      comment: state.comment,
      magicNumber: state.magicNumber,
      openedAt: state.createdAt,
      modifiedAt: state.modifiedAt,
      closedAt: state.status === 'CLOSED' ? state.modifiedAt : null,
      status: state.status as any,
      screenshots: state.screenshots,
    };
  }

  private mapToStoreState(model: PositionModel): PositionState {
    return {
      positionId: model.positionId,
      orderId: model.orderId,
      symbol: model.symbol,
      direction: model.direction,
      volume: model.volume,
      entryPrice: model.entryPrice,
      currentPrice: model.currentPrice,
      stopLoss: model.stopLoss,
      takeProfit: model.takeProfit,
      floatingPnL: model.floatingPnL,
      commission: model.commission,
      swap: model.swap,
      magicNumber: model.magicNumber,
      comment: model.comment,
      createdAt: model.openedAt,
      modifiedAt: model.modifiedAt,
      status: model.status as any,
      screenshots: model.screenshots,
    };
  }
}
