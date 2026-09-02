/**
 * Trading Engine 2.0 — OrderValidator
 * Pure validation functions for Order parameters (Volume, Entry Price, SL, TP, Risk, RR, Comment Length).
 * Zero UI, React, Chart, or Replay dependencies. Never executes trades!
 */

import type { CreateOrderParams, OrderModel, OrderValidationResult } from './OrderTypes';

export class OrderValidator {
  /**
   * Validates order parameters before creation or activation.
   */
  public static validateOrder(
    params: CreateOrderParams | OrderModel,
    maxCommentLength: number = 64
  ): OrderValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Symbol Validation
    if (!params.symbol || params.symbol.trim().length === 0) {
      errors.push('Order symbol is required.');
    }

    // 2. Volume Validation
    if (params.volume <= 0) {
      errors.push('Order volume must be greater than 0 lots.');
    } else if (params.volume < 0.01) {
      errors.push('Minimum order volume is 0.01 lots.');
    }

    // 3. Entry Price Validation
    if (params.entryPrice <= 0) {
      errors.push('Entry price must be greater than 0.');
    }

    const isBuy = params.type.startsWith('BUY');
    const isSell = params.type.startsWith('SELL');

    // 4. Stop Loss Validation
    if (params.stopLoss !== undefined && params.stopLoss !== null) {
      if (params.stopLoss <= 0) {
        errors.push('Stop Loss price must be greater than 0.');
      } else if (isBuy && params.stopLoss >= params.entryPrice) {
        errors.push('BUY Stop Loss must be strictly below Entry Price.');
      } else if (isSell && params.stopLoss <= params.entryPrice) {
        errors.push('SELL Stop Loss must be strictly above Entry Price.');
      }
    }

    // 5. Take Profit Validation
    if (params.takeProfit !== undefined && params.takeProfit !== null) {
      if (params.takeProfit <= 0) {
        errors.push('Take Profit price must be greater than 0.');
      } else if (isBuy && params.takeProfit <= params.entryPrice) {
        errors.push('BUY Take Profit must be strictly above Entry Price.');
      } else if (isSell && params.takeProfit >= params.entryPrice) {
        errors.push('SELL Take Profit must be strictly below Entry Price.');
      }
    }

    // 6. Comment Length Validation
    if (params.comment && params.comment.length > maxCommentLength) {
      warnings.push(`Order comment exceeds maximum length of ${maxCommentLength} characters and will be truncated.`);
    }

    // 7. Risk Warning
    if (params.riskPercent && params.riskPercent > 3.0) {
      warnings.push(`Order risk (${params.riskPercent.toFixed(2)}%) exceeds recommended threshold (3.0%).`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
