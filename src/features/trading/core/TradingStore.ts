/**
 * Trading Engine 2.0 — TradingStore
 * Single source of truth holding Account State, Open Positions, Pending Orders, and History.
 * Pure TypeScript store without React Context or DOM dependencies.
 */

import type { AccountState, Position, Order, ClosedTrade } from '../types/models';

export interface TradingSnapshot {
  account: AccountState;
  positions: Position[];
  orders: Order[];
  history: ClosedTrade[];
}

export class TradingStore {
  private account: AccountState;
  private positions: Map<string, Position> = new Map();
  private orders: Map<string, Order> = new Map();
  private history: ClosedTrade[] = [];

  constructor(initialBalance: number = 100_000) {
    this.account = {
      balance: initialBalance,
      equity: initialBalance,
      floatingPnl: 0,
      margin: 0,
      freeMargin: initialBalance,
      marginLevel: null,
    };
  }

  // ─── READ-ONLY GETTERS ──────────────────────────────────────────────

  public getAccount(): Readonly<AccountState> {
    return { ...this.account };
  }

  public getPositions(): ReadonlyArray<Position> {
    return Array.from(this.positions.values());
  }

  public getPositionById(positionId: string): Readonly<Position> | undefined {
    const pos = this.positions.get(positionId);
    return pos ? { ...pos } : undefined;
  }

  public getOrders(): ReadonlyArray<Order> {
    return Array.from(this.orders.values());
  }

  public getOrderById(orderId: string): Readonly<Order> | undefined {
    const ord = this.orders.get(orderId);
    return ord ? { ...ord } : undefined;
  }

  public getHistory(): ReadonlyArray<ClosedTrade> {
    return [...this.history];
  }

  public getSnapshot(): TradingSnapshot {
    return {
      account: this.getAccount(),
      positions: Array.from(this.getPositions()),
      orders: Array.from(this.getOrders()),
      history: Array.from(this.getHistory()),
    };
  }

  // ─── STATE MUTATIONS (INTERNAL CORE USAGE) ─────────────────────────

  public updateAccount(account: AccountState): void {
    this.account = { ...account };
  }

  public addPosition(position: Position): void {
    this.positions.set(position.positionId, { ...position });
  }

  public updatePosition(position: Position): void {
    if (this.positions.has(position.positionId)) {
      this.positions.set(position.positionId, { ...position });
    }
  }

  public removePosition(positionId: string): Position | undefined {
    const pos = this.positions.get(positionId);
    if (pos) {
      this.positions.delete(positionId);
    }
    return pos;
  }

  public addOrder(order: Order): void {
    this.orders.set(order.orderId, { ...order });
  }

  public updateOrder(order: Order): void {
    if (this.orders.has(order.orderId)) {
      this.orders.set(order.orderId, { ...order });
    }
  }

  public removeOrder(orderId: string): Order | undefined {
    const ord = this.orders.get(orderId);
    if (ord) {
      this.orders.delete(orderId);
    }
    return ord;
  }

  public addTradeToHistory(trade: ClosedTrade): void {
    this.history.push({ ...trade });
  }

  public reset(initialBalance: number = 100_000): void {
    this.account = {
      balance: initialBalance,
      equity: initialBalance,
      floatingPnl: 0,
      margin: 0,
      freeMargin: initialBalance,
      marginLevel: null,
    };
    this.positions.clear();
    this.orders.clear();
    this.history = [];
  }
}
