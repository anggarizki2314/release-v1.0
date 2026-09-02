/**
 * Trading Engine 2.0 — Order Events
 * Event types and payload interfaces emitted during Order lifecycle mutations.
 * Pure TypeScript without framework dependencies.
 */

import type { OrderModel } from './OrderTypes';

export interface OrderEventPayloads {
  OrderCreated: { order: OrderModel };
  OrderUpdated: { oldOrder: OrderModel; newOrder: OrderModel };
  OrderCancelled: { order: OrderModel; reason: string };
  OrderFilled: { order: OrderModel; fillPrice: number; filledAt: number };
  OrderRejected: { order: OrderModel; reason: string };
  OrderExpired: { order: OrderModel };
}

export type OrderEventKey = keyof OrderEventPayloads;

export type OrderEventListener<K extends OrderEventKey> = (
  payload: OrderEventPayloads[K]
) => void;
