/**
 * Trading Engine 2.0 — RewardCalculator
 * Pure calculation functions for Reward Dollar, Reward Percent, Pip Reward, Estimated Profit, and Risk:Reward Ratio.
 * Zero UI, React, Chart, or Replay dependencies.
 */

import type { PositionSide, RRCalculationResult, RiskValidationWarning } from './RiskTypes';
import { InstrumentMetadata } from '../instrument/InstrumentMetadata';

export class RewardCalculator {
  /**
   * Estimated Profit = Volume * ContractSize * Distance (for BUY: TP - Entry, for SELL: Entry - TP)
   */
  public static calculateEstimatedProfit(
    side: PositionSide,
    entryPrice: number,
    takeProfit: number | null,
    volume: number,
    contractSize: number,
    symbol?: string
  ): number {
    if (!takeProfit || entryPrice <= 0 || volume <= 0 || contractSize <= 0) return 0;

    const diff = side === 'BUY' ? takeProfit - entryPrice : entryPrice - takeProfit;
    const rawProfit = Math.max(0, diff * volume * contractSize);
    if (symbol) {
      return InstrumentMetadata.convertQuoteToAccount(symbol, rawProfit, entryPrice);
    }
    return rawProfit;
  }

  /**
   * Reward Percent = (Reward Dollar / Balance) * 100
   */
  public static calculateRewardPercent(balance: number, rewardDollar: number): number {
    if (balance <= 0 || rewardDollar <= 0) return 0;
    return (rewardDollar / balance) * 100;
  }

  /**
   * Calculates TP Distance in pips/ticks: Math.abs(TakeProfit - EntryPrice) / tickSize
   */
  public static calculatePipReward(
    entryPrice: number,
    takeProfit: number | null,
    tickSize: number
  ): number {
    if (!takeProfit || entryPrice <= 0 || tickSize <= 0) return 0;
    const distance = Math.abs(takeProfit - entryPrice);
    return Math.round(distance / tickSize);
  }

  /**
   * Risk to Reward Ratio (RR) = TP Distance / SL Distance
   */
  public static calculateRiskRewardRatio(
    entryPrice: number,
    stopLoss: number | null,
    takeProfit: number | null
  ): RRCalculationResult {
    if (!stopLoss || !takeProfit || entryPrice <= 0) {
      return { rrRatio: 0, formattedRatio: '1 : 0.00' };
    }

    const slDistance = Math.abs(entryPrice - stopLoss);
    const tpDistance = Math.abs(takeProfit - entryPrice);

    if (slDistance <= 0) {
      return { rrRatio: 0, formattedRatio: '1 : 0.00' };
    }

    const ratio = Math.round((tpDistance / slDistance) * 100) / 100;
    return {
      rrRatio: ratio,
      formattedRatio: `1 : ${ratio.toFixed(2)}`,
    };
  }

  /**
   * Validates Take Profit inputs and returns warning list.
   */
  public static validateReward(
    entryPrice: number,
    takeProfit: number | null,
    side: PositionSide
  ): RiskValidationWarning[] {
    const warnings: RiskValidationWarning[] = [];

    if (takeProfit !== null) {
      if (takeProfit <= 0) {
        warnings.push({
          code: 'TP_INVALID',
          severity: 'INVALID',
          message: 'Take Profit price must be greater than 0.',
        });
      } else if (side === 'BUY' && takeProfit <= entryPrice) {
        warnings.push({
          code: 'TP_INVALID',
          severity: 'INVALID',
          message: 'BUY Take Profit must be above Entry Price.',
        });
      } else if (side === 'SELL' && takeProfit >= entryPrice) {
        warnings.push({
          code: 'TP_INVALID',
          severity: 'INVALID',
          message: 'SELL Take Profit must be below Entry Price.',
        });
      }
    }

    return warnings;
  }
}
