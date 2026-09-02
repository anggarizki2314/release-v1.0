/**
 * Trading Engine 2.0 — RiskCalculator
 * Pure calculation functions for Risk Dollar, Risk Percent, Pip Risk, and Estimated Loss.
 * Zero UI, React, Chart, or Replay dependencies.
 */

import type { PositionSide, RiskValidationWarning } from './RiskTypes';
import { InstrumentMetadata } from '../instrument/InstrumentMetadata';

export class RiskCalculator {
  /**
   * Risk Dollar = Balance * (Risk Percent / 100)
   */
  public static calculateRiskDollar(balance: number, riskPercent: number): number {
    if (balance <= 0 || riskPercent <= 0) return 0;
    return (balance * riskPercent) / 100;
  }

  /**
   * Risk Percent = (Risk Dollar / Balance) * 100
   */
  public static calculateRiskPercent(balance: number, riskDollar: number): number {
    if (balance <= 0 || riskDollar <= 0) return 0;
    return (riskDollar / balance) * 100;
  }

  /**
   * Calculates SL Distance in pips/ticks: Math.abs(EntryPrice - StopLoss) / tickSize
   */
  public static calculatePipRisk(
    entryPrice: number,
    stopLoss: number | null,
    tickSize: number
  ): number {
    if (!stopLoss || entryPrice <= 0 || tickSize <= 0) return 0;
    const distance = Math.abs(entryPrice - stopLoss);
    return Math.round(distance / tickSize);
  }

  /**
   * Estimated Loss = Volume * ContractSize * Distance (for BUY: Entry - SL, for SELL: SL - Entry)
   */
  public static calculateEstimatedLoss(
    side: PositionSide,
    entryPrice: number,
    stopLoss: number | null,
    volume: number,
    contractSize: number,
    symbol?: string
  ): number {
    if (!stopLoss || entryPrice <= 0 || volume <= 0 || contractSize <= 0) return 0;

    const diff = side === 'BUY' ? entryPrice - stopLoss : stopLoss - entryPrice;
    const rawLoss = Math.max(0, diff * volume * contractSize);
    if (symbol) {
      return InstrumentMetadata.convertQuoteToAccount(symbol, rawLoss, entryPrice);
    }
    return rawLoss;
  }

  /**
   * Validates risk inputs and returns warning list.
   */
  public static validateRisk(
    riskPercent: number,
    entryPrice: number,
    stopLoss: number | null,
    side: PositionSide,
    maxAllowedRiskPercent: number
  ): RiskValidationWarning[] {
    const warnings: RiskValidationWarning[] = [];

    if (entryPrice <= 0) {
      warnings.push({
        code: 'SL_INVALID',
        severity: 'INVALID',
        message: 'Invalid Entry Price (must be > 0).',
      });
    }

    if (stopLoss !== null) {
      if (stopLoss <= 0) {
        warnings.push({
          code: 'SL_INVALID',
          severity: 'INVALID',
          message: 'Stop Loss price must be greater than 0.',
        });
      } else if (side === 'BUY' && stopLoss >= entryPrice) {
        warnings.push({
          code: 'SL_INVALID',
          severity: 'INVALID',
          message: 'BUY Stop Loss must be below Entry Price.',
        });
      } else if (side === 'SELL' && stopLoss <= entryPrice) {
        warnings.push({
          code: 'SL_INVALID',
          severity: 'INVALID',
          message: 'SELL Stop Loss must be above Entry Price.',
        });
      }
    }

    if (riskPercent > maxAllowedRiskPercent) {
      warnings.push({
        code: 'RISK_HIGH',
        severity: 'WARNING',
        message: `Requested risk (${riskPercent.toFixed(2)}%) exceeds recommended threshold (${maxAllowedRiskPercent}%).`,
      });
    }

    return warnings;
  }
}
