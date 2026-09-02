/**
 * Trading Engine 2.0 — PriceComparator
 * Pure functions evaluating market prices against Pending Orders and active Position SL/TP triggers.
 * Zero UI, React, Chart, or Replay dependencies.
 */

import type { OrderType, PositionDirection } from '../order/OrderTypes';

import { InstrumentMetadata } from '../instrument/InstrumentMetadata';

export class PriceComparator {
  /**
   * Evaluates if a LIMIT order is touched:
   * BUY_LIMIT triggers when Ask <= EntryPrice (or Candle Low <= EntryPrice)
   * SELL_LIMIT triggers when Bid >= EntryPrice (or Candle High >= EntryPrice)
   */
  public static checkLimitOrderTrigger(
    type: OrderType,
    entryPrice: number,
    high: number,
    low: number,
    bid: number,
    ask: number
  ): boolean {
    if (entryPrice <= 0) return false;
    if (type === 'BUY_LIMIT') {
      return (ask > 0 && ask <= entryPrice) || (low > 0 && low <= entryPrice);
    }
    if (type === 'SELL_LIMIT') {
      return (bid > 0 && bid >= entryPrice) || (high > 0 && high >= entryPrice);
    }
    return false;
  }

  /**
   * Evaluates if a STOP order is touched:
   * BUY_STOP triggers when Ask >= EntryPrice (or Candle High >= EntryPrice)
   * SELL_STOP triggers when Bid <= EntryPrice (or Candle Low <= EntryPrice)
   */
  public static checkStopOrderTrigger(
    type: OrderType,
    entryPrice: number,
    high: number,
    low: number,
    bid: number,
    ask: number
  ): boolean {
    if (entryPrice <= 0) return false;
    if (type === 'BUY_STOP') {
      return (ask > 0 && ask >= entryPrice) || (high > 0 && high >= entryPrice);
    }
    if (type === 'SELL_STOP') {
      return (bid > 0 && bid <= entryPrice) || (low > 0 && low <= entryPrice);
    }
    return false;
  }

  /**
   * Evaluates if a Position Stop Loss is hit:
   * BUY: Candle Low <= StopLoss
   * SELL: Candle High >= StopLoss
   */
  public static checkStopLossHit(
    direction: PositionDirection,
    stopLoss: number | null | undefined,
    high: number,
    low: number
  ): boolean {
    if (stopLoss === null || stopLoss === undefined || isNaN(stopLoss) || stopLoss <= 0) return false;
    const numSl = Number(stopLoss);

    if (direction === 'BUY') {
      return low > 0 && low <= numSl;
    }
    if (direction === 'SELL') {
      return high > 0 && high >= numSl;
    }
    return false;
  }

  /**
   * Evaluates if a Position Take Profit is hit:
   * BUY: Candle High >= TakeProfit
   * SELL: Candle Low <= TakeProfit
   */
  public static checkTakeProfitHit(
    direction: PositionDirection,
    takeProfit: number | null | undefined,
    high: number,
    low: number
  ): boolean {
    if (takeProfit === null || takeProfit === undefined || isNaN(takeProfit) || takeProfit <= 0) return false;
    const numTp = Number(takeProfit);

    if (direction === 'BUY') {
      return high > 0 && high >= numTp;
    }
    if (direction === 'SELL') {
      return low > 0 && low <= numTp;
    }
    return false;
  }

  /**
   * Calculates Position Floating PnL:
   * BUY: (CurrentPrice - EntryPrice) * Volume * ContractSize
   * SELL: (EntryPrice - CurrentPrice) * Volume * ContractSize
   * Automatically converts quote currency to USD if symbol is provided.
   */
  public static calculatePositionPnl(
    direction: PositionDirection,
    entryPrice: number,
    currentPrice: number,
    volume: number,
    contractSize: number,
    symbol?: string
  ): number {
    if (entryPrice <= 0 || volume <= 0 || contractSize <= 0) return 0;

    const diff = direction === 'BUY' ? currentPrice - entryPrice : entryPrice - currentPrice;
    const rawPnL = diff * volume * contractSize;
    if (symbol) {
      const converted = InstrumentMetadata.convertQuoteToAccount(symbol, rawPnL, currentPrice || entryPrice);
      return Math.round(converted * 100) / 100;
    }
    return Math.round(rawPnL * 100) / 100;
  }
}
