/**
 * Trading Engine 2.0 — Command Definitions
 * Strongly-typed commands sent from UI or Replay Engine to Trading Engine.
 */

import type { PositionSide, OrderType, TradeCloseReason } from './models';

export interface OpenPositionCommand {
  symbol: string;
  side: PositionSide;
  volume: number;
  entryPrice?: number;
  sl?: number | null;
  tp?: number | null;
  comment?: string | null;
  magicNumber?: number | null;
}

export interface ClosePositionCommand {
  positionId: string;
  closePrice?: number;
  reason?: TradeCloseReason;
}

export interface ModifyPositionCommand {
  positionId: string;
  sl?: number | null;
  tp?: number | null;
}

export interface PartialCloseCommand {
  positionId: string;
  closeVolume: number;
  closePrice?: number;
}

export interface ReversePositionCommand {
  positionId: string;
  closePrice?: number;
}

export interface PlaceOrderCommand {
  symbol: string;
  type: OrderType;
  side: PositionSide;
  volume: number;
  entryPrice: number;
  sl?: number | null;
  tp?: number | null;
  comment?: string | null;
  magicNumber?: number | null;
}

export interface CancelOrderCommand {
  orderId: string;
}

export interface ProcessTickCommand {
  symbol: string;
  bid: number;
  ask: number;
  time: number;
}

export interface ResetAccountCommand {
  initialBalance: number;
}
