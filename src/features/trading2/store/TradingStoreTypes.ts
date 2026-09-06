/**
 * Trading Engine 2.0 — Trading Store Types
 * Pure TypeScript schema definitions for TradingStore state, models, and snapshots.
 * Zero UI, React, Chart, or Replay dependencies.
 */

export type PositionDirection = 'BUY' | 'SELL';

export type PositionStatus = 'OPEN' | 'CLOSED';

export type OrderType = 'MARKET' | 'BUY_LIMIT' | 'SELL_LIMIT' | 'BUY_STOP' | 'SELL_STOP';

export type OrderStatus = 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'REJECTED';

export type EngineStatus = 'IDLE' | 'RUNNING' | 'PAUSED' | 'STOPPED' | 'ERROR';

/**
 * Account State Model
 */
export interface AccountState {
  balance: number;
  equity: number;
  floatingPnL: number;
  margin: number;
  freeMargin: number;
  marginLevel: number | null;
  currency: string;
  leverage: number;
  commissionModel: 'PER_LOT' | 'PERCENTAGE' | 'ZERO';
  spreadModel: 'FIXED' | 'FLOATING';
}

/**
 * Position Model
 */
export interface PositionState {
  positionId: string;
  orderId: string;
  symbol: string;
  direction: PositionDirection;
  volume: number; // Lot size
  entryPrice: number;
  currentPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  floatingPnL: number;
  commission: number;
  swap: number;
  magicNumber: number | null;
  comment: string | null;
  createdAt: number; // Unix timestamp in ms
  modifiedAt: number; // Unix timestamp in ms
  status: PositionStatus;
  screenshots?: TradeScreenshot[];
}

/**
 * Order Model
 */
export interface OrderState {
  orderId: string;
  symbol: string;
  type: OrderType;
  volume: number;
  entryPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  magicNumber: number | null;
  comment: string | null;
  createdAt: number;
  status: OrderStatus;
}

/**
 * History Trade Model
 */
export interface TradeScreenshot {
  id: string;
  dataUrl: string;
  timeframe: string;
}

export interface HistoryState {
  tradeId: string;
  positionId: string;
  symbol: string;
  direction: PositionDirection;
  entryPrice: number;
  exitPrice: number;
  stopLoss?: number | null;
  takeProfit?: number | null;
  volume: number;
  profit: number;
  commission: number;
  swap: number;
  openedAt: number;
  closedAt: number;
  comment: string | null;
  closeReason?: 'MANUAL' | 'SL' | 'TP' | 'STOPOUT' | 'REVERSE' | 'PARTIAL' | string;
  screenshots?: TradeScreenshot[];
}

/**
 * Trading Settings Model
 */
export interface TradingSettingsState {
  defaultRiskPercent: number;
  defaultLot: number;
  defaultRR: number;
  defaultCommission: number;
  defaultSpread: number;
  currency: string;
  leverage: number;
}

/**
 * Runtime State Model
 */
export interface RuntimeState {
  selectedPositionId: string | null;
  selectedOrderId: string | null;
  lastReplayTimestamp: number | null;
  engineStatus: EngineStatus;
  version: string;
}

/**
 * Complete TradingStore State Schema
 */
export interface TradingStoreSchema {
  account: AccountState;
  positions: PositionState[];
  orders: OrderState[];
  history: HistoryState[];
  settings: TradingSettingsState;
  runtime: RuntimeState;
}

/**
 * Serializable TradingStore Snapshot for Save/Load, Persistence, and Undo/Redo
 */
export interface TradingStoreSnapshot {
  schema: TradingStoreSchema;
  exportedAt: number;
  version: string;
}
