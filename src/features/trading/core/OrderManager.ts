/**
 * Trading Engine 2.0 — OrderManager
 * Manages pending limit/stop orders and validates order execution triggers.
 */

import type { Order } from '../types/models';
import type { PlaceOrderCommand, CancelOrderCommand } from '../types/commands';
import type { TradingStore } from './TradingStore';
import type { TradingEventBus } from './EventBus';
import type { PositionManager } from './PositionManager';

export class OrderManager {
  private idCounter: number = 1;

  constructor(
    private store: TradingStore,
    private eventBus: TradingEventBus,
    private positionManager: PositionManager
  ) {}

  /**
   * Places a pending order (Buy Limit, Sell Limit, Buy Stop, Sell Stop).
   */
  public placeOrder(cmd: PlaceOrderCommand, now: number): Order {
    const orderId = `ORD-${Date.now()}-${this.idCounter++}`;

    const order: Order = {
      orderId,
      type: cmd.type,
      symbol: cmd.symbol,
      side: cmd.side,
      volume: cmd.volume,
      entryPrice: cmd.entryPrice,
      sl: cmd.sl ?? null,
      tp: cmd.tp ?? null,
      comment: cmd.comment ?? null,
      magicNumber: cmd.magicNumber ?? null,
      status: 'PENDING',
      createdTime: now,
      modifiedTime: now,
    };

    this.store.addOrder(order);
    this.eventBus.emit('order:placed', { order });
    return order;
  }

  /**
   * Cancels a pending order.
   */
  public cancelOrder(cmd: CancelOrderCommand, now: number): Order | undefined {
    const order = this.store.getOrderById(cmd.orderId);
    if (!order || order.status !== 'PENDING') return undefined;

    const cancelled: Order = {
      ...order,
      status: 'CANCELLED',
      modifiedTime: now,
    };

    this.store.removeOrder(cmd.orderId);
    this.eventBus.emit('order:cancelled', { order: cancelled });
    return cancelled;
  }

  /**
   * Evaluates pending orders against incoming price ticks. Triggers & opens positions when price matches.
   */
  public checkPendingOrders(symbol: string, bid: number, ask: number, now: number): void {
    const orders = this.store.getOrders();

    orders.forEach((ord) => {
      if (ord.symbol !== symbol || ord.status !== 'PENDING') return;

      let triggered = false;

      if (ord.type === 'LIMIT') {
        if (ord.side === 'BUY' && ask <= ord.entryPrice) triggered = true;
        if (ord.side === 'SELL' && bid >= ord.entryPrice) triggered = true;
      } else if (ord.type === 'STOP') {
        if (ord.side === 'BUY' && ask >= ord.entryPrice) triggered = true;
        if (ord.side === 'SELL' && bid <= ord.entryPrice) triggered = true;
      }

      if (triggered) {
        this.store.removeOrder(ord.orderId);
        const executedOrder: Order = { ...ord, status: 'EXECUTED', modifiedTime: now };

        const position = this.positionManager.openPosition({
          symbol: ord.symbol,
          side: ord.side,
          volume: ord.volume,
          entryPrice: ord.entryPrice,
          sl: ord.sl,
          tp: ord.tp,
          comment: ord.comment ? `Triggered from ${ord.orderId}` : 'Pending Order',
          magicNumber: ord.magicNumber,
        }, ord.entryPrice, now);

        this.eventBus.emit('order:triggered', { order: executedOrder, position });
      }
    });
  }
}
