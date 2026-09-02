/**
 * Trading Engine 2.0 — OrderManager
 * Business layer managing ONLY order state lifecycle: create, update, validate, activate, fill, cancel, expire, reject.
 * Integrates strictly with TradingStore and RiskManager.
 * Does NOT execute trades or create positions. Zero UI, React, Chart, or Replay dependencies.
 */

import type { TradingStore } from '../store/TradingStore';
import type { RiskManager } from '../risk/RiskManager';
import type {
  OrderModel,
  CreateOrderParams,
  OrderValidationResult,
  PositionDirection,
} from './OrderTypes';
import type {
  OrderEventKey,
  OrderEventListener,
  OrderEventPayloads,
} from './OrderEvents';
import { OrderFactory } from './OrderFactory';
import { OrderValidator } from './OrderValidator';
import type { OrderState } from '../store/TradingStoreTypes';

export class OrderManager {
  private store: TradingStore;
  private riskManager: RiskManager;
  private listeners: { [K in OrderEventKey]?: OrderEventListener<K>[] } = {};

  constructor(store: TradingStore, riskManager: RiskManager) {
    this.store = store;
    this.riskManager = riskManager;
  }

  // ─── EVENT SUBSCRIPTION ───────────────────────────────────────────

  public on<K extends OrderEventKey>(
    event: K,
    listener: OrderEventListener<K>
  ): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    (this.listeners[event] as OrderEventListener<K>[]).push(listener);

    return () => this.off(event, listener);
  }

  public off<K extends OrderEventKey>(
    event: K,
    listener: OrderEventListener<K>
  ): void {
    const list = this.listeners[event] as OrderEventListener<K>[] | undefined;
    if (!list) return;
    this.listeners[event] = list.filter((l) => l !== listener) as any;
  }

  private emit<K extends OrderEventKey>(
    event: K,
    payload: OrderEventPayloads[K]
  ): void {
    const list = this.listeners[event] as OrderEventListener<K>[] | undefined;
    if (!list || list.length === 0) return;

    const listCopy = [...list];
    for (const listener of listCopy) {
      try {
        listener(payload);
      } catch (err) {
        console.error(`[OrderManager] Listener error for event "${event}":`, err);
      }
    }
  }

  // ─── PUBLIC ORDER LIFECYCLE METHODS ───────────────────────────────

  /**
   * Validates and creates a new Order model, writing it to TradingStore.
   */
  public createOrder(params: CreateOrderParams, now: number = Date.now()): OrderModel {
    const validation = OrderValidator.validateOrder(params);
    const order = OrderFactory.createOrder(params, now);

    if (!validation.valid) {
      const rejectedOrder: OrderModel = {
        ...order,
        status: 'REJECTED',
        rejectionReason: validation.errors.join('; '),
      };
      this.store.addOrder(this.mapToStoreState(rejectedOrder));
      this.emit('OrderRejected', { order: rejectedOrder, reason: rejectedOrder.rejectionReason! });
      return rejectedOrder;
    }

    this.store.addOrder(this.mapToStoreState(order));
    this.emit('OrderCreated', { order });
    return order;
  }

  /**
   * Updates an existing order parameters in store.
   */
  public updateOrder(
    orderId: string,
    updates: Partial<OrderModel>,
    now: number = Date.now()
  ): OrderModel | undefined {
    const existing = this.getOrder(orderId);
    if (!existing || existing.status === 'CANCELLED' || existing.status === 'FILLED') {
      return undefined;
    }

    const updated: OrderModel = {
      ...existing,
      ...updates,
      modifiedAt: now,
    };

    this.store.updateOrder(this.mapToStoreState(updated));
    this.emit('OrderUpdated', { oldOrder: existing, newOrder: updated });
    return updated;
  }

  /**
   * Cancels a pending or active order.
   */
  public cancelOrder(orderId: string, reason: string = 'User Cancelled', now: number = Date.now()): OrderModel | undefined {
    const existing = this.getOrder(orderId);
    if (!existing || existing.status === 'CANCELLED' || existing.status === 'FILLED') {
      return undefined;
    }

    const cancelled: OrderModel = {
      ...existing,
      status: 'CANCELLED',
      cancellationReason: reason,
      modifiedAt: now,
    };

    this.store.updateOrder(this.mapToStoreState(cancelled));
    this.emit('OrderCancelled', { order: cancelled, reason });
    return cancelled;
  }

  /**
   * Marks a pending order as ACTIVE.
   */
  public activateOrder(orderId: string, now: number = Date.now()): OrderModel | undefined {
    const existing = this.getOrder(orderId);
    if (!existing || existing.status !== 'PENDING') return undefined;

    const activated: OrderModel = {
      ...existing,
      status: 'ACTIVE',
      modifiedAt: now,
    };

    this.store.updateOrder(this.mapToStoreState(activated));
    this.emit('OrderUpdated', { oldOrder: existing, newOrder: activated });
    return activated;
  }

  /**
   * Marks an order as FILLED (ready for Execution Engine / Position Manager).
   */
  public fillOrder(orderId: string, fillPrice: number, filledAt: number = Date.now()): OrderModel | undefined {
    const existing = this.getOrder(orderId);
    if (!existing || (existing.status !== 'PENDING' && existing.status !== 'ACTIVE')) {
      return undefined;
    }

    const filled: OrderModel = {
      ...existing,
      entryPrice: fillPrice,
      status: 'FILLED',
      modifiedAt: filledAt,
    };

    this.store.updateOrder(this.mapToStoreState(filled));
    this.emit('OrderFilled', { order: filled, fillPrice, filledAt });
    return filled;
  }

  /**
   * Rejects an order with a reason.
   */
  public rejectOrder(orderId: string, reason: string, now: number = Date.now()): OrderModel | undefined {
    const existing = this.getOrder(orderId);
    if (!existing) return undefined;

    const rejected: OrderModel = {
      ...existing,
      status: 'REJECTED',
      rejectionReason: reason,
      modifiedAt: now,
    };

    this.store.updateOrder(this.mapToStoreState(rejected));
    this.emit('OrderRejected', { order: rejected, reason });
    return rejected;
  }

  /**
   * Expires an order (e.g. pending order timeout).
   */
  public expireOrder(orderId: string, now: number = Date.now()): OrderModel | undefined {
    const existing = this.getOrder(orderId);
    if (!existing || existing.status !== 'PENDING') return undefined;

    const expired: OrderModel = {
      ...existing,
      status: 'EXPIRED',
      modifiedAt: now,
    };

    this.store.updateOrder(this.mapToStoreState(expired));
    this.emit('OrderExpired', { order: expired });
    return expired;
  }

  // ─── QUERY METHODS ────────────────────────────────────────────────

  public getOrder(orderId: string): OrderModel | undefined {
    const state = this.store.getOrderById(orderId);
    return state ? this.mapToModel(state) : undefined;
  }

  public getOrders(): ReadonlyArray<OrderModel> {
    return this.store.getOrders().map((o) => this.mapToModel(o));
  }

  public getPendingOrders(): ReadonlyArray<OrderModel> {
    return this.store.getPendingOrders().map((o) => this.mapToModel(o));
  }

  public validateOrder(params: CreateOrderParams): OrderValidationResult {
    return OrderValidator.validateOrder(params);
  }

  public reset(): void {
    // Orders are cleared when TradingStore is reset
  }

  // ─── MAPPER HELPERS ───────────────────────────────────────────────

  private mapToModel(state: OrderState): OrderModel {
    const direction: PositionDirection = state.type.startsWith('BUY') ? 'BUY' : 'SELL';
    return {
      orderId: state.orderId,
      symbol: state.symbol,
      type: state.type as any,
      direction,
      volume: state.volume,
      entryPrice: state.entryPrice,
      stopLoss: state.stopLoss,
      takeProfit: state.takeProfit,
      riskPercent: 0,
      riskDollar: 0,
      rewardDollar: 0,
      rrRatio: 0,
      comment: state.comment,
      magicNumber: state.magicNumber,
      createdAt: state.createdAt,
      modifiedAt: state.createdAt,
      status: state.status as any,
    };
  }

  private mapToStoreState(model: OrderModel): OrderState {
    return {
      orderId: model.orderId,
      symbol: model.symbol,
      type: model.type as any,
      volume: model.volume,
      entryPrice: model.entryPrice,
      stopLoss: model.stopLoss,
      takeProfit: model.takeProfit,
      magicNumber: model.magicNumber,
      comment: model.comment,
      createdAt: model.createdAt,
      status: model.status as any,
    };
  }
}
