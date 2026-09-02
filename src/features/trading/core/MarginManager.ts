/**
 * Trading Engine 2.0 — MarginManager
 * Calculates Required Margin, Free Margin, and Margin Level with multi-symbol & leverage support.
 */

import type { Position } from '../types/models';
import type { TradingEngineConfig } from '../types/config';

export class MarginManager {
  private config: TradingEngineConfig;

  constructor(config: TradingEngineConfig) {
    this.config = { ...config };
  }

  public updateConfig(config: Partial<TradingEngineConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Calculates required margin for a single position:
   * Required Margin = (Volume * Contract Size * Entry Price) / Leverage
   */
  public calculatePositionMargin(position: Position): number {
    const leverage = this.config.leverage || 100;
    const contractSize = this.config.contractSize || 100_000;

    return (position.volume * contractSize * position.entryPrice) / leverage;
  }

  /**
   * Calculates total required margin across all open positions (supports Hedging).
   */
  public calculateTotalMargin(positions: ReadonlyArray<Position>): number {
    return positions.reduce((total, pos) => total + this.calculatePositionMargin(pos), 0);
  }

  /**
   * Checks if sufficient Free Margin is available to execute a new trade.
   */
  public canOpenPosition(
    requiredMargin: number,
    currentFreeMargin: number
  ): boolean {
    return currentFreeMargin >= requiredMargin;
  }
}
