/**
 * Trading Engine 2.0 — Order Popup Types
 * Type definitions for Order Popup UI state, props, and presets.
 * Zero Replay or Core Engine logic inside UI types.
 */

import type { OrderType, PositionDirection, CreateOrderParams } from '../order/OrderTypes';
import type { RRPreset, RiskPreset, InstrumentCategory } from '../risk/RiskTypes';

export type RiskInputMode = 'PERCENT' | 'DOLLAR';
export type RiskBaseMode = 'BALANCE' | 'DEPOSIT';

export interface OrderPopupProps {
  isOpen: boolean;
  orderType: OrderType;
  symbol: string;
  timeframe?: string;
  currentPrice: number;
  balance: number;
  initialDeposit?: number;
  freeMargin: number;
  leverage: number;
  initialStopLoss?: number | null;
  initialTakeProfit?: number | null;
  instrumentCategory?: InstrumentCategory;
  onClose: () => void;
  onPlaceOrder: (cmd: CreateOrderParams) => void;
}

export interface OrderPopupSummary {
  estimatedProfit: number;
  estimatedLoss: number;
  rrRatioFormatted: string;
  requiredMargin: number;
  remainingFreeMargin: number;
  pipRisk: number;
  pipReward: number;
}
