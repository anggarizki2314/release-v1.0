/**
 * Trading Engine 2.0 — Trading Store Selectors
 * Pure, side-effect-free selector functions operating on TradingStoreSchema.
 * Zero business rules, zero framework dependencies.
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

export class TradingStoreSelectors {
  /**
   * Returns current account state.
   */
  public static getAccount(schema: TradingStoreSchema): Readonly<AccountState> {
    return { ...schema.account };
  }

  /**
   * Returns all positions.
   */
  public static getPositions(schema: TradingStoreSchema): ReadonlyArray<PositionState> {
    return schema.positions.map((p) => ({ ...p }));
  }

  /**
   * Returns open positions only.
   */
  public static getOpenPositions(schema: TradingStoreSchema): ReadonlyArray<PositionState> {
    return schema.positions.filter((p) => p.status === 'OPEN').map((p) => ({ ...p }));
  }

  /**
   * Returns position by ID.
   */
  public static getPositionById(schema: TradingStoreSchema, positionId: string): Readonly<PositionState> | undefined {
    const pos = schema.positions.find((p) => p.positionId === positionId);
    return pos ? { ...pos } : undefined;
  }

  /**
   * Returns currently selected position in runtime state.
   */
  public static getSelectedPosition(schema: TradingStoreSchema): Readonly<PositionState> | undefined {
    if (!schema.runtime.selectedPositionId) return undefined;
    return TradingStoreSelectors.getPositionById(schema, schema.runtime.selectedPositionId);
  }

  /**
   * Returns all orders.
   */
  public static getOrders(schema: TradingStoreSchema): ReadonlyArray<OrderState> {
    return schema.orders.map((o) => ({ ...o }));
  }

  /**
   * Returns pending orders only.
   */
  public static getPendingOrders(schema: TradingStoreSchema): ReadonlyArray<OrderState> {
    return schema.orders.filter((o) => o.status === 'PENDING').map((o) => ({ ...o }));
  }

  /**
   * Returns order by ID.
   */
  public static getOrderById(schema: TradingStoreSchema, orderId: string): Readonly<OrderState> | undefined {
    const ord = schema.orders.find((o) => o.orderId === orderId);
    return ord ? { ...ord } : undefined;
  }

  /**
   * Returns currently selected order in runtime state.
   */
  public static getSelectedOrder(schema: TradingStoreSchema): Readonly<OrderState> | undefined {
    if (!schema.runtime.selectedOrderId) return undefined;
    return TradingStoreSelectors.getOrderById(schema, schema.runtime.selectedOrderId);
  }

  /**
   * Returns closed trade history array.
   */
  public static getHistory(schema: TradingStoreSchema): ReadonlyArray<HistoryState> {
    return schema.history.map((h) => ({ ...h }));
  }

  /**
   * Returns current trading settings.
   */
  public static getSettings(schema: TradingStoreSchema): Readonly<TradingSettingsState> {
    return { ...schema.settings };
  }

  /**
   * Returns current runtime state.
   */
  public static getRuntimeState(schema: TradingStoreSchema): Readonly<RuntimeState> {
    return { ...schema.runtime };
  }

  /**
   * Creates a serializable snapshot of current store state.
   */
  public static getSnapshot(schema: TradingStoreSchema): TradingStoreSnapshot {
    return {
      schema: JSON.parse(JSON.stringify(schema)),
      exportedAt: Date.now(),
      version: schema.runtime.version,
    };
  }
}
