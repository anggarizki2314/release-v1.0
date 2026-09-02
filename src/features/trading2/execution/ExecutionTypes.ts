/**
 * Trading Engine 2.0 — Execution Types
 * Type definitions for Market Price Updates, Execution Configuration, and Execution Summary metrics.
 * Zero UI, React, Chart, or Replay dependencies.
 */

export interface MarketPriceUpdate {
  symbol: string;
  timestamp: number; // Unix timestamp in ms
  open: number;
  high: number;
  low: number;
  close: number;
  bid: number;
  ask: number;
}

export interface ExecutionConfig {
  contractSize: number;  // Standard forex = 100,000
  slippagePips: number;  // Execution slippage tolerance
  spreadPips: number;    // Fixed or default spread
  autoTriggerSLTP: boolean; // Automatically trigger SL/TP hits
}

export interface ExecutionSummary {
  ticksProcessed: number;
  ordersFilled: number;
  positionsClosed: number;
  slHits: number;
  tpHits: number;
  totalFloatingPnL: number;
  timestamp: number;
}

export const DEFAULT_EXECUTION_CONFIG: ExecutionConfig = {
  contractSize: 100_000,
  slippagePips: 0,
  spreadPips: 0,
  autoTriggerSLTP: true,
};
