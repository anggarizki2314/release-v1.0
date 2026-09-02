/**
 * Trading Engine 2.0 — Replay Adapter Types
 * Data payload models for Replay candles, ticks, and state transitions.
 * Zero UI, React, Chart, or Replay dependencies.
 */

export type ReplayAdapterStatus =
  | 'IDLE'
  | 'CONNECTED'
  | 'PLAYING'
  | 'PAUSED'
  | 'STOPPED'
  | 'RESET';

export interface ReplayCandlePayload {
  symbol: string;
  timestamp: number; // Unix timestamp in ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  bid?: number;
  ask?: number;
}

export interface ReplayTickPayload {
  symbol: string;
  timestamp: number; // Unix timestamp in ms
  bid: number;
  ask: number;
  lastPrice?: number;
}

export interface ReplayStateUpdate {
  status: ReplayAdapterStatus;
  timestamp: number;
}
