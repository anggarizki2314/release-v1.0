/**
 * Trading Engine 2.0 — Challenge Validators
 * Independent rule validators for Challenge Engine.
 * Pure TypeScript, zero side-effects, zero inter-validator dependencies.
 */

import type { ClosedPositionRecord } from '../repository/ClosedPositionRepository';

export class TargetValidator {
  public static evaluate(
    profitPercent: number,
    targetPercent: number,
    currentTradingDays: number,
    minimumTradingDays: number
  ): { targetReached: boolean; isPassed: boolean; remainingTargetPercent: number } {
    const targetReached = profitPercent >= targetPercent;
    const daysMet = currentTradingDays >= minimumTradingDays;
    const isPassed = targetReached && daysMet;
    const remainingTargetPercent = Math.max(0, targetPercent - profitPercent);

    return { targetReached, isPassed, remainingTargetPercent };
  }
}

export class DailyLossValidator {
  public static evaluate(
    dailyDrawdownDollar: number,
    dailyLossLimitDollar: number
  ): { dailyLossViolated: boolean; remainingDailyLossDollar: number } {
    const dailyLossViolated = dailyLossLimitDollar > 0 && dailyDrawdownDollar >= dailyLossLimitDollar;
    const remainingDailyLossDollar = Math.max(0, dailyLossLimitDollar - dailyDrawdownDollar);

    return { dailyLossViolated, remainingDailyLossDollar };
  }
}

export class MaxLossValidator {
  public static evaluate(
    maximumDrawdownDollar: number,
    maxTotalLossLimitDollar: number
  ): { maximumLossViolated: boolean; remainingMaximumLossDollar: number } {
    const maximumLossViolated = maxTotalLossLimitDollar > 0 && maximumDrawdownDollar >= maxTotalLossLimitDollar;
    const remainingMaximumLossDollar = Math.max(0, maxTotalLossLimitDollar - maximumDrawdownDollar);

    return { maximumLossViolated, remainingMaximumLossDollar };
  }
}

export class TradingDaysValidator {
  /**
   * Calculates current trading days based on unique calendar days (YYYY-MM-DD)
   * with at least 1 CLOSED position.
   */
  public static evaluate(closedPositions: ReadonlyArray<ClosedPositionRecord>): number {
    if (!closedPositions || closedPositions.length === 0) return 0;

    const uniqueDays = new Set<string>();
    for (const pos of closedPositions) {
      if (pos.closedAt && pos.closedAt > 0) {
        const dateStr = new Date(pos.closedAt).toISOString().split('T')[0];
        uniqueDays.add(dateStr);
      }
    }

    return uniqueDays.size;
  }
}
