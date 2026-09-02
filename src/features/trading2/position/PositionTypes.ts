/**
 * Trading Engine 2.0 — Position Types
 * Type definitions for Hedging Position model, status, open parameters, and validation.
 * Zero UI, React, Chart, or Replay dependencies.
 */

import type { OrderModel } from '../order/OrderTypes';
import type { TradeScreenshot } from '../store/TradingStoreTypes';

export type PositionDirection = 'BUY' | 'SELL';

export type PositionStatus = 'OPEN' | 'PARTIALLY_CLOSED' | 'CLOSED';

export interface PositionModel {
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
  realizedPnL: number;
  commission: number;
  swap: number;
  riskDollar: number;
  rewardDollar: number;
  rrRatio: number;
  comment: string | null;
  magicNumber: number | null;
  openedAt: number;   // Unix timestamp in ms
  modifiedAt: number; // Unix timestamp in ms
  closedAt: number | null;
  status: PositionStatus;
  screenshots?: TradeScreenshot[];
}

export interface OpenPositionParams {
  order: OrderModel;
  fillPrice?: number;
  openedAt?: number;
}

export interface PartialCloseParams {
  positionId: string;
  closeVolume: number;
  closePrice: number;
  closedAt?: number;
}

export interface ModifyPositionParams {
  positionId: string;
  volume?: number;
  stopLoss?: number | null;
  takeProfit?: number | null;
  comment?: string | null;
  magicNumber?: number | null;
}

export interface PositionValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
