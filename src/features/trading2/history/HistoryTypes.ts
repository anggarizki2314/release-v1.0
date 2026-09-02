/**
 * Trading Engine 2.0 — History Types
 * Type definitions for ClosedTrade history archiving and summary statistics.
 * Zero UI, React, Chart, or Replay dependencies.
 */

import type { PositionDirection } from '../position/PositionTypes';
import type { TradeScreenshot } from '../store/TradingStoreTypes';

export interface ClosedTradeModel {
  tradeId: string;
  positionId: string;
  orderId: string;
  symbol: string;
  direction: PositionDirection;
  volume: number;
  entryPrice: number;
  exitPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  realizedPnL: number;
  commission: number;
  swap: number;
  comment: string | null;
  magicNumber: number | null;
  openedAt: number;
  closedAt: number;
  closeReason: 'MANUAL' | 'SL' | 'TP' | 'STOPOUT' | 'REVERSE' | 'PARTIAL';
  screenshots?: TradeScreenshot[];
}

export interface TradeHistorySummary {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRatePercent: number;
  grossProfit: number;
  grossLoss: number;
  netProfit: number;
  profitFactor: number;
}
