/**
 * Trading Engine 2.0 — Configuration & Settings
 * Engine setup parameters including leverage, contract size, hedging mode, and risk thresholds.
 */

export interface TradingEngineConfig {
  initialBalance: number;
  leverage: number; // e.g. 100 for 1:100 leverage
  hedging: boolean; // Must be true for Hedging mode
  commissionPerLot: number;
  contractSize: number; // Standard forex contract size = 100,000
  marginCallLevelPercent: number; // e.g. 80%
  stopOutLevelPercent: number; // e.g. 50%
}

export const DEFAULT_ENGINE_CONFIG: TradingEngineConfig = {
  initialBalance: 100_000,
  leverage: 100,
  hedging: true,
  commissionPerLot: 0,
  contractSize: 100_000,
  marginCallLevelPercent: 80,
  stopOutLevelPercent: 50,
};
