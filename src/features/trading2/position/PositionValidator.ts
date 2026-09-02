/**
 * Trading Engine 2.0 — PositionValidator
 * Pure validation functions for Position parameters (Volume, SL, TP, Status, Comment, Magic Number).
 * Zero UI, React, Chart, or Replay dependencies.
 */

import type { PositionModel, OpenPositionParams, ModifyPositionParams, PositionValidationResult } from './PositionTypes';
import { InstrumentMetadata } from '../instrument/InstrumentMetadata';

export class PositionValidator {
  /**
   * Validates parameters before opening a new position from order execution.
   */
  public static validateOpen(params: OpenPositionParams): PositionValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const { order, fillPrice } = params;

    if (!order) {
      errors.push('FILLED Order object is required to open position.');
      return { valid: false, errors, warnings };
    }

    if (order.volume <= 0 || order.volume < 0.01) {
      errors.push('Position volume must be at least 0.01 lots.');
    }

    const price = fillPrice ?? order.entryPrice;
    if (price <= 0) {
      errors.push('Position entry price must be greater than 0.');
    }

    const isBuy = order.direction === 'BUY';

    if (order.stopLoss !== null && order.stopLoss > 0) {
      if (isBuy && order.stopLoss >= price) {
        errors.push('BUY Stop Loss must be strictly below Entry Price.');
      } else if (!isBuy && order.stopLoss <= price) {
        errors.push('SELL Stop Loss must be strictly above Entry Price.');
      }
    }

    if (order.takeProfit !== null && order.takeProfit > 0) {
      if (isBuy && order.takeProfit <= price) {
        errors.push('BUY Take Profit must be strictly above Entry Price.');
      } else if (!isBuy && order.takeProfit >= price) {
        errors.push('SELL Take Profit must be strictly below Entry Price.');
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validates position modification parameters (SL/TP/Comment/MagicNumber).
   */
  public static validateModify(pos: PositionModel, params: ModifyPositionParams): PositionValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (pos.status === 'CLOSED') {
      errors.push('Cannot modify a CLOSED position.');
      return { valid: false, errors, warnings };
    }

    if (params.volume !== undefined) {
      if (params.volume <= 0 || params.volume < 0.01) {
        errors.push('Modified volume must be at least 0.01 lots.');
      }
    }

    const isBuy = pos.direction === 'BUY';
    const entryPrice = pos.entryPrice;
    const currentPrice = pos.currentPrice > 0 ? pos.currentPrice : 0;
    const digits = InstrumentMetadata.getDigits(pos.symbol);

    if (params.stopLoss !== undefined && params.stopLoss !== null && params.stopLoss > 0) {
      if (currentPrice > 0) {
        if (isBuy && params.stopLoss > currentPrice) {
          warnings.push(`BUY Stop Loss (${params.stopLoss.toFixed(digits)}) is set above current live price (${currentPrice.toFixed(digits)}).`);
        } else if (!isBuy && params.stopLoss < currentPrice) {
          warnings.push(`SELL Stop Loss (${params.stopLoss.toFixed(digits)}) is set below current live price (${currentPrice.toFixed(digits)}).`);
        }
      }
      if (isBuy && params.stopLoss >= entryPrice) {
        warnings.push('BUY Stop Loss is set at or above Entry Price (Locking Profit / BE).');
      } else if (!isBuy && params.stopLoss <= entryPrice) {
        warnings.push('SELL Stop Loss is set at or below Entry Price (Locking Profit / BE).');
      }
    }

    if (params.takeProfit !== undefined && params.takeProfit !== null && params.takeProfit > 0) {
      if (currentPrice > 0) {
        if (isBuy && params.takeProfit <= currentPrice) {
          warnings.push(`BUY Take Profit (${params.takeProfit.toFixed(digits)}) is at or below current market price (${currentPrice.toFixed(digits)}).`);
        } else if (!isBuy && params.takeProfit >= currentPrice) {
          warnings.push(`SELL Take Profit (${params.takeProfit.toFixed(digits)}) is at or above current market price (${currentPrice.toFixed(digits)}).`);
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validates partial close volume bounds.
   */
  public static validatePartialClose(pos: PositionModel, closeVolume: number): PositionValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (pos.status === 'CLOSED') {
      errors.push('Cannot partial close a CLOSED position.');
    } else if (closeVolume <= 0) {
      errors.push('Partial close volume must be greater than 0.');
    } else if (closeVolume >= pos.volume) {
      warnings.push('Close volume equals or exceeds position volume; executing full position close.');
    } else if (pos.volume - closeVolume < 0.01) {
      errors.push('Remaining volume after partial close must be at least 0.01 lots.');
    }

    return { valid: errors.length === 0, errors, warnings };
  }
}
