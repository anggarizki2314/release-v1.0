/**
 * Trading Engine 2.0 — Account Types
 * Type definitions for Account Engine state, metrics, transactions, and snapshots.
 * Zero UI, React, Chart, or Replay dependencies.
 */

export interface AccountState {
  balance: number;
  equity: number;
  floatingPnL: number;
  realizedPnL?: number;
  usedMargin?: number;
  freeMargin: number;
  marginLevel: number | null; // Infinity when usedMargin is 0
  openPositions?: number;
  closedPositions?: number;
  winTrades?: number;
  lossTrades?: number;
}

export interface AccountConfig {
  initialBalance: number;
  currency: string;
  leverage: number;
}

export interface AccountModel extends AccountState {
  margin: number;
  currency: string;
  leverage: number;
  initialBalance: number;
  highWaterMark: number;
}


export interface AccountSnapshot {
  state: AccountState;
  model: AccountModel;
  timestamp: number;
}

