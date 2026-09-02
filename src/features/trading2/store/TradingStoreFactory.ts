/**
 * Trading Engine 2.0 — Trading Store Factory
 * Pure factory function returning a fresh, un-shared TradingStore instance.
 * No singleton, no global variables.
 */

import type { TradingStoreSchema, TradingSettingsState } from './TradingStoreTypes';
import { TradingStore } from './TradingStore';

export interface CreateTradingStoreConfig {
  initialBalance?: number;
  currency?: string;
  leverage?: number;
  commissionModel?: 'PER_LOT' | 'PERCENTAGE' | 'ZERO';
  spreadModel?: 'FIXED' | 'FLOATING';
  defaultRiskPercent?: number;
  defaultLot?: number;
  defaultRR?: number;
  defaultCommission?: number;
  defaultSpread?: number;
}

export const DEFAULT_STORE_SETTINGS: TradingSettingsState = {
  defaultRiskPercent: 1.0,
  defaultLot: 0.1,
  defaultRR: 2.0,
  defaultCommission: 0.0,
  defaultSpread: 0.0,
  currency: 'USD',
  leverage: 100,
};

/**
 * Creates and initializes a fresh TradingStore instance.
 */
export function createTradingStore(config: CreateTradingStoreConfig = {}): TradingStore {
  const initialBalance = config.initialBalance ?? 0;
  const currency = config.currency ?? 'USD';
  const leverage = config.leverage ?? 100;

  const defaultSchema: TradingStoreSchema = {
    account: {
      balance: initialBalance,
      equity: initialBalance,
      floatingPnL: 0,
      margin: 0,
      freeMargin: initialBalance,
      marginLevel: null,
      currency,
      leverage,
      commissionModel: config.commissionModel ?? 'PER_LOT',
      spreadModel: config.spreadModel ?? 'FLOATING',
    },
    positions: [],
    orders: [],
    history: [],
    settings: {
      ...DEFAULT_STORE_SETTINGS,
      currency,
      leverage,
      defaultRiskPercent: config.defaultRiskPercent ?? DEFAULT_STORE_SETTINGS.defaultRiskPercent,
      defaultLot: config.defaultLot ?? DEFAULT_STORE_SETTINGS.defaultLot,
      defaultRR: config.defaultRR ?? DEFAULT_STORE_SETTINGS.defaultRR,
      defaultCommission: config.defaultCommission ?? DEFAULT_STORE_SETTINGS.defaultCommission,
      defaultSpread: config.defaultSpread ?? DEFAULT_STORE_SETTINGS.defaultSpread,
    },
    runtime: {
      selectedPositionId: null,
      selectedOrderId: null,
      lastReplayTimestamp: null,
      engineStatus: 'IDLE',
      version: '2.0.0',
    },
  };

  return new TradingStore(defaultSchema);
}
