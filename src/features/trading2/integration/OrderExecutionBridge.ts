/**
 * Trading Engine 2.0 — OrderExecutionBridge
 * Orchestrates the complete Order Placement and Activation workflow.
 * Enforces strict Architecture Flow: UI -> Command -> OrderManager -> TradingStore -> ExecutionEngine -> PositionManager.
 * Zero direct store mutations inside UI.
 */

import type { OrderManager } from '../order/OrderManager';
import type { ExecutionEngine } from '../execution/ExecutionEngine';
import type { PositionManager } from '../position/PositionManager';
import type { CreateOrderParams, OrderModel } from '../order/OrderTypes';
import type { PositionModel } from '../position/PositionTypes';

export interface OrderExecutionBridgeResult {
  order: OrderModel;
  position?: PositionModel;
  isMarketOrder: boolean;
}

export class OrderExecutionBridge {
  private orderManager: OrderManager;
  private executionEngine: ExecutionEngine;
  private positionManager: PositionManager;

  constructor(
    orderManager: OrderManager,
    executionEngine: ExecutionEngine,
    positionManager: PositionManager
  ) {
    this.orderManager = orderManager;
    this.executionEngine = executionEngine;
    this.positionManager = positionManager;
  }

  /**
   * Processes OpenOrderCommand received from UI.
   * Market orders skip pending state and execute immediately via ExecutionEngine.
   * Pending orders remain PENDING in TradingStore waiting for price ticks.
   */
  public executeOrderCommand(cmd: CreateOrderParams, now: number = Date.now()): OrderExecutionBridgeResult {
    const isMarket = cmd.type.includes('MARKET') || (cmd.type as string) === 'BUY' || (cmd.type as string) === 'SELL';

    if (isMarket) {
      // Market Order Flow: Immediate Execution
      const position = this.executionEngine.processMarketOrder(cmd, cmd.entryPrice, now);
      const order = this.orderManager.getOrder(position.orderId)!;

      return {
        order,
        position,
        isMarketOrder: true,
      };
    }

    // Pending Order Flow: Saved to Store as PENDING
    const order = this.orderManager.createOrder(cmd, now);

    return {
      order,
      isMarketOrder: false,
    };
  }

  /**
   * Cancels a pending order and removes it from TradingStore.
   */
  public cancelOrderCommand(orderId: string, reason: string = 'User Cancelled'): OrderModel | undefined {
    return this.orderManager.cancelOrder(orderId, reason);
  }

  /**
   * Modifies pending order parameters (Entry Price, SL, TP).
   */
  public modifyOrderCommand(
    orderId: string,
    updates: Partial<OrderModel>
  ): OrderModel | undefined {
    return this.orderManager.updateOrder(orderId, updates);
  }
}
