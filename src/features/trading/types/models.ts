/**
 * Trading Engine 2.0 — Models & Type Definitions
 * Pure data models supporting Hedging Mode (multiple BUY and SELL positions on same symbol).
 */

export type PositionSide = 'BUY' | 'SELL';

export type PositionStatus = 'OPEN' | 'CLOSED';

export type OrderType = 'MARKET' | 'LIMIT' | 'STOP';

export type OrderStatus = 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'REJECTED';

export type TradeCloseReason = 'MANUAL' | 'SL' | 'TP' | 'SO' | 'REVERSE' | 'PARTIAL';

/**
 * Position Model — Represents an active or historical position.
 */
export interface Position {
  positionId: string;
  orderId: string;
  symbol: string;
  side: PositionSide;
  volume: number; // Size in Lots
  entryPrice: number;
  currentPrice: number;
  sl: number | null;
  tp: number | null;
  floatingPnl: number;
  commission: number;
  swap: number;
  comment: string | null;
  magicNumber: number | null;
  createdTime: number; // Unix timestamp in ms
  modifiedTime: number; // Unix timestamp in ms
  status: PositionStatus;
}

/**
 * Order Model — Represents a pending or executed order.
 */
export interface Order {
  orderId: string;
  type: OrderType;
  symbol: string;
  side: PositionSide;
  volume: number;
  entryPrice: number; // Price to execute (current market price for MARKET order)
  sl: number | null;
  tp: number | null;
  comment: string | null;
  magicNumber: number | null;
  status: OrderStatus;
  createdTime: number;
  modifiedTime: number;
}

/**
 * Account State Model — Represents current account metric snapshot.
 */
export interface AccountState {
  balance: number;
  equity: number;
  floatingPnl: number;
  margin: number;
  freeMargin: number;
  marginLevel: number | null; // Percentage (null if margin is 0)
}

/**
 * Closed Trade Model — Represents an archived closed trade for statistics.
 */
export interface ClosedTrade {
  tradeId: string;
  positionId: string;
  symbol: string;
  side: PositionSide;
  volume: number;
  entryPrice: number;
  exitPrice: number;
  sl: number | null;
  tp: number | null;
  realizedPnl: number;
  commission: number;
  swap: number;
  comment: string | null;
  magicNumber: number | null;
  openTime: number;
  closeTime: number;
  closeReason: TradeCloseReason;
}
