/**
 * Trading Engine 2.0 — Trading Store Events
 * Event types and payloads emitted on store state mutations.
 * Pure TypeScript without UI or external framework dependencies.
 */

import type {
  PositionState,
  OrderState,
  HistoryState,
  AccountState,
  TradingSettingsState,
  RuntimeState,
  TradingStoreSchema,
  TradingStoreSnapshot,
} from './TradingStoreTypes';

export interface TradingStoreEventPayloads {
  PositionAdded: { position: PositionState };
  PositionUpdated: { position: PositionState };
  PositionRemoved: { positionId: string };
  OrderAdded: { order: OrderState };
  OrderUpdated: { order: OrderState };
  OrderRemoved: { orderId: string };
  HistoryAdded: { trade: HistoryState };
  HistoryRemoved: { tradeId: string; trade?: HistoryState };
  HistoryCleared: { count: number };
  AccountUpdated: { account: AccountState };
  SettingsUpdated: { settings: TradingSettingsState };
  RuntimeUpdated: { runtime: RuntimeState };
  StoreReset: { schema: TradingStoreSchema };
  SnapshotLoaded: { snapshot: TradingStoreSnapshot };
}

export type TradingStoreEventKey = keyof TradingStoreEventPayloads;

export type TradingStoreEventListener<K extends TradingStoreEventKey> = (
  payload: TradingStoreEventPayloads[K]
) => void;
