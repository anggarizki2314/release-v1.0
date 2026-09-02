/**
 * Trading Engine 2.0 — PositionFactory
 * Factory class returning fully initialized PositionModel objects with unique PositionIDs and default OPEN status.
 * Supports Hedging Mode: Every position receives a unique PositionID; no merging or netting occurs.
 * Pure TypeScript without UI or framework dependencies.
 */

import type { PositionModel, OpenPositionParams } from './PositionTypes';

export class PositionFactory {
  private static idCounter: number = 1;

  /**
   * Instantiates a new Hedging PositionModel from an executed order.
   */
  public static createPosition(params: OpenPositionParams, now: number = Date.now()): PositionModel {
    const positionId = `POS-${now}-${PositionFactory.idCounter++}`;
    const { order, fillPrice } = params;
    const entryPrice = fillPrice ?? order.entryPrice;

    return {
      positionId,
      orderId: order.orderId,
      symbol: order.symbol,
      direction: order.direction,
      volume: order.volume,
      entryPrice,
      currentPrice: entryPrice,
      stopLoss: order.stopLoss ?? null,
      takeProfit: order.takeProfit ?? null,
      floatingPnL: 0,
      realizedPnL: 0,
      commission: 0,
      swap: 0,
      riskDollar: order.riskDollar ?? 0,
      rewardDollar: order.rewardDollar ?? 0,
      rrRatio: order.rrRatio ?? 0,
      comment: order.comment ?? null,
      magicNumber: order.magicNumber ?? null,
      openedAt: now,
      modifiedAt: now,
      closedAt: null,
      status: 'OPEN',
    };
  }
}
