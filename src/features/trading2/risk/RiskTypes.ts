/**
 * Trading Engine 2.0 — Risk Types
 * Type definitions for Risk parameters, calculation outputs, presets, and validation warnings.
 * Zero UI, React, Chart, or Replay dependencies.
 */

export type InstrumentCategory = 'FOREX' | 'GOLD' | 'INDICES' | 'CRYPTO' | 'FUTURES';

export type PositionSide = 'BUY' | 'SELL';

export type RRPreset = '1:1' | '1:1.5' | '1:2' | '1:3' | '1:4' | 'CUSTOM';

export type RiskPreset = '0.25%' | '0.50%' | '1%' | '2%' | '3%' | 'CUSTOM';

export type LotSizingMode = 'FIXED_LOT' | 'RISK_PERCENT' | 'RISK_DOLLAR';

export interface InstrumentSpecs {
  category: InstrumentCategory;
  contractSize: number; // e.g., 100,000 for Forex, 100 for Gold, 1 for Crypto
  tickSize: number;     // e.g., 0.00001 for EURUSD, 0.01 for XAUUSD
  tickValue: number;    // Value of 1 tick per lot in account currency
}

export interface RiskInputParams {
  symbol?: string;
  side: PositionSide;
  entryPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  volume: number;
  riskPercent?: number;
  riskDollar?: number;
  leverage?: number;
  instrumentSpecs: InstrumentSpecs;
}

export interface RiskCalculationResult {
  riskDollar: number;
  riskPercent: number;
  pipRisk: number;
  estimatedLoss: number;
}

export interface RewardCalculationResult {
  rewardDollar: number;
  rewardPercent: number;
  pipReward: number;
  estimatedProfit: number;
}

export interface RRCalculationResult {
  rrRatio: number;
  formattedRatio: string;
}

export interface LotCalculationResult {
  autoLotSize: number;
  boundedLotSize: number;
}

export interface MarginCalculationResult {
  requiredMargin: number;
  remainingMargin: number;
}

export interface CompleteRiskAssessment {
  risk: RiskCalculationResult;
  reward: RewardCalculationResult;
  rr: RRCalculationResult;
  lot: LotCalculationResult;
  margin: MarginCalculationResult;
  warnings: RiskValidationWarning[];
}

export type WarningSeverity = 'WARNING' | 'INVALID';

export type WarningCode =
  | 'RISK_HIGH'
  | 'MARGIN_HIGH'
  | 'FREE_MARGIN_LOW'
  | 'SL_INVALID'
  | 'TP_INVALID'
  | 'LOT_OUT_OF_BOUNDS';

export interface RiskValidationWarning {
  code: WarningCode;
  severity: WarningSeverity;
  message: string;
}

export interface RiskManagerSettings {
  mode: LotSizingMode;
  defaultRiskPercent: number;
  defaultLot: number;
  defaultRRPreset: RRPreset;
  defaultRiskPreset: RiskPreset;
  maxAllowedRiskPercent: number; // Warning threshold (e.g. 3%)
  maxMarginUsagePercent: number; // Warning threshold (e.g. 80%)
}

export const DEFAULT_RISK_SETTINGS: RiskManagerSettings = {
  mode: 'RISK_PERCENT',
  defaultRiskPercent: 1.0,
  defaultLot: 0.1,
  defaultRRPreset: '1:3',
  defaultRiskPreset: '1%',
  maxAllowedRiskPercent: 3.0,
  maxMarginUsagePercent: 80.0,
};
