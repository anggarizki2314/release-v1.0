/**
 * Trading Engine 2.0 — Trading Store Actions Interface
 * Pure interface for store state mutations without business calculations or validation.
 */

import type {
  PositionState,
  OrderState,
  HistoryState,
  AccountState,
  TradingSettingsState,
  RuntimeState,
  TradingStoreSnapshot,
} from './TradingStoreTypes';

export interface ITradingStoreActions {
  // Position State Actions
  addPosition(position: PositionState): void;
  updatePosition(position: PositionState): void;
  removePosition(positionId: string): void;

  // Order State Actions
  addOrder(order: OrderState): void;
  updateOrder(order: OrderState): void;
  removeOrder(orderId: string): void;

  // History State Actions
  addHistory(trade: HistoryState): void;

  // Account State Actions
  updateAccount(account: Partial<AccountState>): void;

  // Trading Settings Actions
  updateSettings(settings: Partial<TradingSettingsState>): void;

  // Runtime State Actions
  setRuntimeState(runtime: Partial<RuntimeState>): void;

  // Store Lifecycle Actions
  resetStore(): void;
  loadSnapshot(snapshot: TradingStoreSnapshot): void;
}
