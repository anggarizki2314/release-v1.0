/**
 * Trading Engine 2.0 — OrderFactory
 * Factory class returning fully initialized OrderModel objects with IDs, timestamps, and default initial status.
 * Pure TypeScript without UI or framework dependencies.
 */

import type { CreateOrderParams, OrderModel, OrderStatus, PositionDirection } from './OrderTypes';

export class OrderFactory {
  private static idCounter: number = 1;

  /**
   * Instantiates a fully initialized OrderModel object.
   */
  public static createOrder(params: CreateOrderParams, now: number = Date.now()): OrderModel {
    const orderId = `ORD-${now}-${OrderFactory.idCounter++}`;
    const direction: PositionDirection = params.type.startsWith('BUY') ? 'BUY' : 'SELL';

    // Market orders start ACTIVE/PENDING execution; Limit/Stop orders start PENDING trigger.
    const initialStatus: OrderStatus = 'PENDING';

    const comment = params.comment
      ? params.comment.substring(0, 64)
      : null;

    return {
      orderId,
      symbol: params.symbol,
      type: params.type,
      direction,
      volume: params.volume,
      entryPrice: params.entryPrice,
      stopLoss: params.stopLoss ?? null,
      takeProfit: params.takeProfit ?? null,
      riskPercent: params.riskPercent ?? 0,
      riskDollar: params.riskDollar ?? 0,
      rewardDollar: params.rewardDollar ?? 0,
      rrRatio: params.rrRatio ?? 0,
      comment,
      magicNumber: params.magicNumber ?? null,
      createdAt: now,
      modifiedAt: now,
      status: initialStatus,
    };
  }
}
