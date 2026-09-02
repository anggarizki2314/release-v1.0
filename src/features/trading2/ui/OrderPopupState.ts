/**
 * Trading Engine 2.0 — OrderPopupState
 * Local form state model for OrderPopup inputs.
 * Pure UI state container without calculation logic.
 */

import type { OrderType } from '../order/OrderTypes';
import type { RRPreset, RiskPreset } from '../risk/RiskTypes';
import type { RiskInputMode, RiskBaseMode } from './OrderPopupTypes';
import { InstrumentMetadata } from '../instrument/InstrumentMetadata';
import { LotCalculator } from '../risk/LotCalculator';

export interface OrderPopupFormState {
  symbol: string;
  orderType: OrderType;
  entryPrice: number;
  volume: number;
  riskMode: RiskInputMode;
  riskBase: RiskBaseMode;
  riskPercent: number;
  riskDollar: number;
  rrPreset: RRPreset;
  riskPreset: RiskPreset;
  stopLoss: string;
  takeProfit: string;
  comment: string;
}

export function createDefaultPopupState(
  orderType: OrderType,
  symbol: string,
  currentPrice: number,
  balance: number,
  initialStopLoss?: number | null,
  initialTakeProfit?: number | null,
  initialDeposit?: number
): OrderPopupFormState {
  const isBuy = orderType.startsWith('BUY');
  const spec = InstrumentMetadata.getSpec(symbol);
  const pipSize = spec.pipSize;
  const digits = spec.digits;
  const contractSize = spec.contractSize;

  // Default 20 pips SL & 60 pips TP (1:3 RR) if not provided by drawing
  const defaultSlOffset = 20 * pipSize;
  const defaultTpOffset = 60 * pipSize;

  const defaultSl = initialStopLoss != null
    ? initialStopLoss.toFixed(digits)
    : isBuy
    ? (currentPrice - defaultSlOffset).toFixed(digits)
    : (currentPrice + defaultSlOffset).toFixed(digits);

  const defaultTp = initialTakeProfit != null
    ? initialTakeProfit.toFixed(digits)
    : isBuy
    ? (currentPrice + defaultTpOffset).toFixed(digits)
    : (currentPrice - defaultTpOffset).toFixed(digits);

  const defaultRiskPercent = 1.0;
  const baseAmount = balance > 0 ? balance : (initialDeposit && initialDeposit > 0 ? initialDeposit : 10000);
  const defaultRiskDollar = (baseAmount * defaultRiskPercent) / 100;

  const parsedSl = parseFloat(defaultSl);
  const slDist = !isNaN(parsedSl) && parsedSl > 0 ? Math.abs(currentPrice - parsedSl) : 0;
  const calculatedLot = slDist > 0
    ? LotCalculator.calculateAutoLot(defaultRiskDollar, slDist, contractSize, symbol, currentPrice)
    : 0.1;

  return {
    symbol,
    orderType,
    entryPrice: currentPrice,
    volume: calculatedLot,
    riskMode: 'PERCENT',
    riskBase: 'BALANCE',
    riskPercent: defaultRiskPercent,
    riskDollar: defaultRiskDollar,
    rrPreset: '1:3',
    riskPreset: '1%',
    stopLoss: defaultSl,
    takeProfit: defaultTp,
    comment: '',
  };
}
