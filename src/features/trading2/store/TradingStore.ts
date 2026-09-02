/**
 * Trading Engine 2.0 — TradingStore
 * Single Source of Truth central state container for Trading Engine 2.0.
 * Pure TypeScript, framework-independent, serializable, and event-emitting state container.
 * Zero business rules or calculation logic — state management only.
 */

import type {
  TradingStoreSchema,
  AccountState,
  PositionState,
  OrderState,
  HistoryState,
  TradingSettingsState,
  RuntimeState,
  TradingStoreSnapshot,
} from './TradingStoreTypes';
import type { ITradingStoreActions } from './TradingStoreActions';
import type {
  TradingStoreEventKey,
  TradingStoreEventListener,
  TradingStoreEventPayloads,
} from './TradingStoreEvents';
import { TradingStoreSelectors } from './TradingStoreSelectors';

export class TradingStore implements ITradingStoreActions {
  private schema: TradingStoreSchema;
  private listeners: { [K in TradingStoreEventKey]?: TradingStoreEventListener<K>[] } = {};
  private revision: number = 0;

  constructor(initialSchema: TradingStoreSchema) {
    this.schema = JSON.parse(JSON.stringify(initialSchema));
  }

  // ─── PUB / SUB EVENT SUBSCRIPTION ─────────────────────────────────

  public subscribe<K extends TradingStoreEventKey>(
    event: K,
    listener: TradingStoreEventListener<K>
  ): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    (this.listeners[event] as TradingStoreEventListener<K>[]).push(listener);

    return () => this.unsubscribe(event, listener);
  }

  public unsubscribe<K extends TradingStoreEventKey>(
    event: K,
    listener: TradingStoreEventListener<K>
  ): void {
    const list = this.listeners[event] as TradingStoreEventListener<K>[] | undefined;
    if (!list) return;
    this.listeners[event] = list.filter((l) => l !== listener) as any;
  }

  private emit<K extends TradingStoreEventKey>(
    event: K,
    payload: TradingStoreEventPayloads[K]
  ): void {
    this.revision++;
    const list = this.listeners[event] as TradingStoreEventListener<K>[] | undefined;
    if (!list || list.length === 0) return;

    const listCopy = [...list];
    for (const listener of listCopy) {
      try {
        listener(payload);
      } catch (err) {
        console.error(`[TradingStore] Listener error for event "${event}":`, err);
      }
    }
  }

  public getRevision(): number {
    return this.revision;
  }

  // ─── PURE SELECTOR GETTERS ────────────────────────────────────────

  public getAccount(): Readonly<AccountState> {
    return TradingStoreSelectors.getAccount(this.schema);
  }

  public getPositions(): ReadonlyArray<PositionState> {
    return TradingStoreSelectors.getPositions(this.schema);
  }

  public getOpenPositions(): ReadonlyArray<PositionState> {
    return TradingStoreSelectors.getOpenPositions(this.schema);
  }

  public getPositionById(positionId: string): Readonly<PositionState> | undefined {
    return TradingStoreSelectors.getPositionById(this.schema, positionId);
  }

  public getSelectedPosition(): Readonly<PositionState> | undefined {
    return TradingStoreSelectors.getSelectedPosition(this.schema);
  }

  public getOrders(): ReadonlyArray<OrderState> {
    return TradingStoreSelectors.getOrders(this.schema);
  }

  public getPendingOrders(): ReadonlyArray<OrderState> {
    return TradingStoreSelectors.getPendingOrders(this.schema);
  }

  public getOrderById(orderId: string): Readonly<OrderState> | undefined {
    return TradingStoreSelectors.getOrderById(this.schema, orderId);
  }

  public getSelectedOrder(): Readonly<OrderState> | undefined {
    return TradingStoreSelectors.getSelectedOrder(this.schema);
  }

  public getHistory(): ReadonlyArray<HistoryState> {
    return TradingStoreSelectors.getHistory(this.schema);
  }

  public getSettings(): Readonly<TradingSettingsState> {
    return TradingStoreSelectors.getSettings(this.schema);
  }

  public getRuntimeState(): Readonly<RuntimeState> {
    return TradingStoreSelectors.getRuntimeState(this.schema);
  }

  public saveSnapshot(): TradingStoreSnapshot {
    return TradingStoreSelectors.getSnapshot(this.schema);
  }

  public getSchemaRaw(): Readonly<TradingStoreSchema> {
    return this.schema;
  }

  // ─── ACTIONS / MUTATORS (STATE ONLY, NO CALCULATIONS) ──────────────

  public addPosition(position: PositionState): void {
    this.schema.positions.push({ ...position });
    this.emit('PositionAdded', { position: { ...position } });
  }

  public updatePosition(position: PositionState): void {
    const idx = this.schema.positions.findIndex((p) => p.positionId === position.positionId);
    if (idx >= 0) {
      this.schema.positions[idx] = { ...position };
      this.emit('PositionUpdated', { position: { ...position } });
    }
  }

  public removePosition(positionId: string): void {
    const idx = this.schema.positions.findIndex((p) => p.positionId === positionId);
    if (idx >= 0) {
      this.schema.positions.splice(idx, 1);
      this.emit('PositionRemoved', { positionId });
    }
  }

  public addOrder(order: OrderState): void {
    this.schema.orders.push({ ...order });
    this.emit('OrderAdded', { order: { ...order } });
  }

  public updateOrder(order: OrderState): void {
    const idx = this.schema.orders.findIndex((o) => o.orderId === order.orderId);
    if (idx >= 0) {
      this.schema.orders[idx] = { ...order };
      this.emit('OrderUpdated', { order: { ...order } });
    }
  }

  public removeOrder(orderId: string): void {
    const idx = this.schema.orders.findIndex((o) => o.orderId === orderId);
    if (idx >= 0) {
      this.schema.orders.splice(idx, 1);
      this.emit('OrderRemoved', { orderId });
    }
  }

  public addHistory(trade: HistoryState): void {
    this.schema.history.push({ ...trade });
    this.emit('HistoryAdded', { trade: { ...trade } });
  }

  public updateHistory(tradeId: string, updates: Partial<HistoryState>): void {
    const idx = this.schema.history.findIndex((h) => h.tradeId === tradeId);
    if (idx >= 0) {
      this.schema.history[idx] = { ...this.schema.history[idx], ...updates };
      this.emit('HistoryAdded', { trade: { ...this.schema.history[idx] } }); // Reusing HistoryAdded for now, or just emit StoreReset? History updates are rare.
    }
  }

  public updateAccount(accountUpdates: Partial<AccountState>): void {
    this.schema.account = { ...this.schema.account, ...accountUpdates };
    this.emit('AccountUpdated', { account: { ...this.schema.account } });
  }

  public updateSettings(settingsUpdates: Partial<TradingSettingsState>): void {
    this.schema.settings = { ...this.schema.settings, ...settingsUpdates };
    this.emit('SettingsUpdated', { settings: { ...this.schema.settings } });
  }

  public setRuntimeState(runtimeUpdates: Partial<RuntimeState>): void {
    this.schema.runtime = { ...this.schema.runtime, ...runtimeUpdates };
    this.emit('RuntimeUpdated', { runtime: { ...this.schema.runtime } });
  }

  public resetStore(): void {
    this.schema.positions = [];
    this.schema.orders = [];
    this.schema.history = [];
    this.schema.account.floatingPnL = 0;
    this.schema.account.equity = this.schema.account.balance;
    this.schema.account.margin = 0;
    this.schema.account.freeMargin = this.schema.account.balance;
    this.schema.account.marginLevel = null;
    this.schema.runtime.selectedPositionId = null;
    this.schema.runtime.selectedOrderId = null;

    this.emit('StoreReset', { schema: JSON.parse(JSON.stringify(this.schema)) });
  }

  public loadSnapshot(snapshot: TradingStoreSnapshot): void {
    if (!snapshot || !snapshot.schema) {
      throw new Error('[TradingStore] Invalid snapshot provided.');
    }
    this.schema = JSON.parse(JSON.stringify(snapshot.schema));
    this.emit('SnapshotLoaded', { snapshot: JSON.parse(JSON.stringify(snapshot)) });
  }
}
