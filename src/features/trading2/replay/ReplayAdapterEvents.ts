/**
 * Trading Engine 2.0 — Replay Adapter Events
 * Event types and payload interfaces emitted during Replay adaptation.
 * Pure TypeScript without framework dependencies.
 */

import type { ReplayAdapterStatus } from './ReplayAdapterTypes';

export interface ReplayAdapterEventPayloads {
  AdapterStateChanged: { status: ReplayAdapterStatus; timestamp: number };
  CandleForwarded: { symbol: string; timestamp: number };
  TickForwarded: { symbol: string; timestamp: number };
}

export type ReplayAdapterEventKey = keyof ReplayAdapterEventPayloads;

export type ReplayAdapterEventListener<K extends ReplayAdapterEventKey> = (
  payload: ReplayAdapterEventPayloads[K]
) => void;
