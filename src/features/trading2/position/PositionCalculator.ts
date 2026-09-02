/**
 * Trading Engine 2.0 — PositionCalculator
 * Pure TypeScript metrics calculator for open positions.
 * Computes realtime Floating PnL, Risk ($), Reward ($), RR Ratio, and Distance to SL/TP in price & pips.
 * 100% independent from Account Engine.
 */

import type { PositionModel } from './PositionTypes';
import type { TradeScreenshot } from '../store/TradingStoreTypes';
import { InstrumentMetadata } from '../instrument/InstrumentMetadata';

export interface PositionDistance {
  price: number;
  pips: number;
}

export interface Position {
  id: string;
  symbol: string;
  timeframe: string;
  side: 'BUY' | 'SELL';
  status: 'OPEN' | 'CLOSED';
  entryPrice: number;
  currentPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  volume: number;
  openedAt: number;
  closedAt: number | null;
  closePrice: number | null;
  comment?: string;
  floatingPnL: number;
  riskAmount: number;
  rewardAmount: number;
  rr: number;
  distanceToSL: PositionDistance;
  distanceToTP: PositionDistance;
  screenshots?: TradeScreenshot[];
}

export class PositionCalculator {
  /**
   * Calculates realtime Position metrics from raw PositionModel.
   */
  public static calculate(pos: PositionModel): Position {
    const spec = InstrumentMetadata.getSpec(pos.symbol);
    const contractSize = spec.contractSize;
    const pipSize = spec.pipSize;

    const isBuy = pos.direction === 'BUY';

    // 1. Realtime Floating PnL
    const priceDiff = isBuy
      ? pos.currentPrice - pos.entryPrice
      : pos.entryPrice - pos.currentPrice;
    const rawFloatingPnL = priceDiff * pos.volume * contractSize;
    const floatingPnL = InstrumentMetadata.convertQuoteToAccount(
      pos.symbol,
      rawFloatingPnL,
      pos.currentPrice || pos.entryPrice
    );

    // 2. Risk Amount ($)
    let riskPrice = 0;
    if (pos.stopLoss !== null && pos.stopLoss > 0) {
      riskPrice = isBuy ? pos.entryPrice - pos.stopLoss : pos.stopLoss - pos.entryPrice;
    }
    const rawRisk = Math.max(0, riskPrice * pos.volume * contractSize);
    const riskAmount = InstrumentMetadata.convertQuoteToAccount(
      pos.symbol,
      rawRisk,
      pos.entryPrice
    );

    // 3. Reward Amount ($)
    let rewardPrice = 0;
    if (pos.takeProfit !== null && pos.takeProfit > 0) {
      rewardPrice = isBuy ? pos.takeProfit - pos.entryPrice : pos.entryPrice - pos.takeProfit;
    }
    const rawReward = Math.max(0, rewardPrice * pos.volume * contractSize);
    const rewardAmount = InstrumentMetadata.convertQuoteToAccount(
      pos.symbol,
      rawReward,
      pos.entryPrice
    );

    // 4. Realtime R:R Ratio
    const rr = riskAmount > 0 ? rewardAmount / riskAmount : 0;

    // 5. Distance to SL (Price & Pips)
    let distPriceSL = 0;
    let distPipsSL = 0;
    if (pos.stopLoss !== null && pos.stopLoss > 0) {
      distPriceSL = Math.abs(pos.currentPrice - pos.stopLoss);
      distPipsSL = Math.round((distPriceSL / pipSize) * 10) / 10;
    }

    // 6. Distance to TP (Price & Pips)
    let distPriceTP = 0;
    let distPipsTP = 0;
    if (pos.takeProfit !== null && pos.takeProfit > 0) {
      distPriceTP = Math.abs(pos.takeProfit - pos.currentPrice);
      distPipsTP = Math.round((distPriceTP / pipSize) * 10) / 10;
    }

    return {
      id: pos.positionId,
      symbol: pos.symbol,
      timeframe: (pos as any).timeframe || 'M5',
      side: pos.direction,
      status: pos.status === 'CLOSED' ? 'CLOSED' : 'OPEN',
      entryPrice: pos.entryPrice,
      currentPrice: pos.currentPrice,
      stopLoss: pos.stopLoss,
      takeProfit: pos.takeProfit,
      volume: pos.volume,
      openedAt: pos.openedAt,
      closedAt: pos.closedAt,
      closePrice: pos.closedAt ? pos.currentPrice : null,
      comment: pos.comment || undefined,
      floatingPnL: Math.round(floatingPnL * 100) / 100,
      riskAmount: Math.round(riskAmount * 100) / 100,
      rewardAmount: Math.round(rewardAmount * 100) / 100,
      rr: Math.round(rr * 100) / 100,
      distanceToSL: { price: distPriceSL, pips: distPipsSL },
      distanceToTP: { price: distPriceTP, pips: distPipsTP },
      screenshots: pos.screenshots,
    };
  }
}
