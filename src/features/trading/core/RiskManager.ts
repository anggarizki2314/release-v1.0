/**
 * Trading Engine 2.0 — RiskManager
 * Risk calculation utilities: Risk %, Risk $, Auto Lot size, RR, Pip calculator, and Risk Warnings.
 */

import type { PositionSide } from '../types/models';
import type { TradingStore } from './TradingStore';

export interface LotCalculationParams {
  symbol: string;
  riskPercent: number; // e.g. 1%
  slPips: number;
}

export interface RiskRewardResult {
  riskAmount: number;
  rewardAmount: number;
  rrRatio: number;
}

export class RiskManager {
  constructor(private store: TradingStore) {}

  /**
   * Calculates monetary risk amount ($) given a percentage of current balance.
   */
  public calculateRiskAmount(riskPercent: number): number {
    const balance = this.store.getAccount().balance;
    return (balance * Math.max(0, riskPercent)) / 100;
  }

  /**
   * Calculates automatic position lot size given risk percentage and SL distance in pips.
   */
  public calculateAutoLotSize(params: LotCalculationParams): number {
    if (params.slPips <= 0) return 0.01;

    const riskAmount = this.calculateRiskAmount(params.riskPercent);
    const pipValuePerLot = this.calculatePipValue(params.symbol);

    if (pipValuePerLot <= 0) return 0.01;

    const rawLot = riskAmount / (params.slPips * pipValuePerLot);
    // Round down to 2 decimal places (standard lot step 0.01)
    return Math.max(0.01, Math.floor(rawLot * 100) / 100);
  }

  /**
   * Calculates Risk to Reward (RR) ratio.
   */
  public calculateRiskReward(
    side: PositionSide,
    entryPrice: number,
    sl: number | null,
    tp: number | null
  ): RiskRewardResult {
    if (!sl || !tp || entryPrice <= 0) {
      return { riskAmount: 0, rewardAmount: 0, rrRatio: 0 };
    }

    const slDistance = Math.abs(entryPrice - sl);
    const tpDistance = Math.abs(tp - entryPrice);

    const rrRatio = slDistance > 0 ? tpDistance / slDistance : 0;

    return {
      riskAmount: slDistance,
      rewardAmount: tpDistance,
      rrRatio: Math.round(rrRatio * 100) / 100,
    };
  }

  /**
   * Calculates pip value per 1.0 standard lot.
   * Standard forex pair (e.g. EURUSD): 1 pip = 0.0001 = $10 / lot
   * JPY pair (e.g. USDJPY): 1 pip = 0.01
   */
  public calculatePipValue(symbol: string): number {
    const isJpy = symbol.toUpperCase().includes('JPY');
    const contractSize = 100_000;
    const pipSize = isJpy ? 0.01 : 0.0001;

    return pipSize * contractSize;
  }

  /**
   * Estimates monetary profit ($) for a TP price.
   */
  public estimateProfit(side: PositionSide, entry: number, tp: number, volume: number): number {
    const contractSize = 100_000;
    const diff = side === 'BUY' ? tp - entry : entry - tp;
    return Math.max(0, diff * volume * contractSize);
  }

  /**
   * Estimates monetary loss ($) for an SL price.
   */
  public estimateLoss(side: PositionSide, entry: number, sl: number, volume: number): number {
    const contractSize = 100_000;
    const diff = side === 'BUY' ? entry - sl : sl - entry;
    return Math.max(0, diff * volume * contractSize);
  }

  /**
   * Validates if a trade exceeds account risk warning limits.
   */
  public checkRiskWarning(requestedVolume: number, freeMargin: number, requiredMargin: number): string | null {
    if (requiredMargin > freeMargin) {
      return 'Insufficient Free Margin to execute trade.';
    }
    if (requestedVolume <= 0) {
      return 'Invalid volume size.';
    }
    return null;
  }
}
