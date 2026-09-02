/**
 * Trading Engine 2.0 — Execution Events
 * Event types and payload interfaces emitted during execution runtime.
 * Pure TypeScript without framework dependencies.
 */

import type { OrderModel } from '../order/OrderTypes';
import type { PositionModel } from '../position/PositionTypes';
import type { ClosedTradeModel } from '../history/HistoryTypes';
import type { ExecutionSummary } from './ExecutionTypes';

export interface ExecutionEventPayloads {
  OrderFilled: { order: OrderModel; fillPrice: number; filledAt: number };
  PositionOpened: { position: PositionModel };
  PositionUpdated: { positionsCount: number; totalFloatingPnL: number };
  PositionClosed: { position: PositionModel; closePrice: number; reason: string };
  StopLossHit: { position: PositionModel; slPrice: number; closedAt: number };
  TakeProfitHit: { position: PositionModel; tpPrice: number; closedAt: number };
  AccountUpdated: { balance: number; equity: number; floatingPnL: number };
  HistoryAdded: { trade: ClosedTradeModel };
  ExecutionCycleCompleted: { summary: ExecutionSummary };
}

export type ExecutionEventKey = keyof ExecutionEventPayloads;

export type ExecutionEventListener<K extends ExecutionEventKey> = (
  payload: ExecutionEventPayloads[K]
) => void;
