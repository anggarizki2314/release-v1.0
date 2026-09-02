/**
 * Trading Engine 2.0 — Order Types
 * Type definitions for Order types, statuses, model schema, and creation parameters.
 * Zero UI, React, Chart, or Replay dependencies.
 */

export type OrderType =
  | 'BUY_MARKET'
  | 'SELL_MARKET'
  | 'BUY_LIMIT'
  | 'SELL_LIMIT'
  | 'BUY_STOP'
  | 'SELL_STOP';

export type OrderStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'FILLED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'REJECTED';

export type PositionDirection = 'BUY' | 'SELL';

/**
 * Order Model Schema
 */
export interface OrderModel {
  orderId: string;
  symbol: string;
  type: OrderType;
  direction: PositionDirection;
  volume: number; // Lot size
  entryPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  riskPercent: number;
  riskDollar: number;
  rewardDollar: number;
  rrRatio: number;
  comment: string | null;
  magicNumber: number | null;
  createdAt: number; // Unix timestamp in ms
  modifiedAt: number; // Unix timestamp in ms
  status: OrderStatus;
  rejectionReason?: string;
  cancellationReason?: string;
}

export interface CreateOrderParams {
  symbol: string;
  type: OrderType;
  volume: number;
  entryPrice: number;
  stopLoss?: number | null;
  takeProfit?: number | null;
  riskPercent?: number;
  riskDollar?: number;
  rewardDollar?: number;
  rrRatio?: number;
  comment?: string | null;
  magicNumber?: number | null;
}

export interface OrderValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
