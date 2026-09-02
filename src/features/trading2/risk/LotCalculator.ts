/**
 * Trading Engine 2.0 — LotCalculator
 * Pure calculation functions for Auto Lot Sizing and Required / Remaining Margin.
 * Zero UI, React, Chart, or Replay dependencies.
 */

import type { RiskValidationWarning } from './RiskTypes';
import { InstrumentMetadata } from '../instrument/InstrumentMetadata';

export class LotCalculator {
  /**
   * Auto Lot = Risk Dollar / (SL Distance in Account Currency * Contract Size)
   * Rounds down to 2 decimal places (minimum 0.01 lot)
   */
  public static calculateAutoLot(
    riskDollar: number,
    slDistancePrice: number,
    contractSize: number,
    symbol?: string,
    entryPrice?: number
  ): number {
    if (riskDollar <= 0 || slDistancePrice <= 0 || contractSize <= 0) return 0.01;

    let riskPerLot = slDistancePrice * contractSize;
    if (symbol && entryPrice && entryPrice > 0) {
      riskPerLot = InstrumentMetadata.convertQuoteToAccount(symbol, riskPerLot, entryPrice);
    }

    if (riskPerLot <= 0) return 0.01;

    const rawLot = riskDollar / riskPerLot;
    const boundedLot = Math.floor(rawLot * 100) / 100;
    return Math.max(0.01, boundedLot);
  }

  /**
   * Required Margin in USD account currency.
   * For USD base pairs (USDJPY, USDCAD, USDCHF): (Volume * Contract Size) / Leverage
   * For all other pairs / commodities: (Volume * Contract Size * Entry Price) / Leverage
   */
  public static calculateRequiredMargin(
    volume: number,
    entryPrice: number,
    contractSize: number,
    leverage: number,
    symbol?: string
  ): number {
    if (volume <= 0 || entryPrice <= 0 || contractSize <= 0 || leverage <= 0) return 0;

    if (symbol && InstrumentMetadata.isUsdBasePair(symbol)) {
      return (volume * contractSize) / leverage;
    }

    return (volume * contractSize * entryPrice) / leverage;
  }

  /**
   * Remaining Margin = Free Margin - Required Margin
   */
  public static calculateRemainingMargin(freeMargin: number, requiredMargin: number): number {
    return freeMargin - requiredMargin;
  }

  /**
   * Validates lot size and margin bounds.
   */
  public static validateMargin(
    requiredMargin: number,
    freeMargin: number,
    equity: number,
    maxMarginUsagePercent: number
  ): RiskValidationWarning[] {
    const warnings: RiskValidationWarning[] = [];

    if (requiredMargin > freeMargin) {
      warnings.push({
        code: 'FREE_MARGIN_LOW',
        severity: 'INVALID',
        message: 'Insufficient Free Margin to open position.',
      });
    }

    if (equity > 0) {
      const usagePercent = (requiredMargin / equity) * 100;
      if (usagePercent > maxMarginUsagePercent) {
        warnings.push({
          code: 'MARGIN_HIGH',
          severity: 'WARNING',
          message: `Margin usage (${usagePercent.toFixed(1)}%) exceeds safe threshold (${maxMarginUsagePercent}%).`,
        });
      }
    }

    return warnings;
  }
}
