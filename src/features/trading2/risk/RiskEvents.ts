/**
 * Trading Engine 2.0 — Risk Events
 * Event map and payload interfaces emitted during risk calculations.
 * Pure TypeScript without framework dependencies.
 */

import type {
  RiskCalculationResult,
  RewardCalculationResult,
  LotCalculationResult,
  MarginCalculationResult,
  RiskValidationWarning,
} from './RiskTypes';

export interface RiskEventPayloads {
  RiskChanged: RiskCalculationResult;
  RewardChanged: RewardCalculationResult;
  LotChanged: LotCalculationResult;
  MarginChanged: MarginCalculationResult;
  ValidationChanged: { warnings: RiskValidationWarning[] };
}

export type RiskEventKey = keyof RiskEventPayloads;

export type RiskEventListener<K extends RiskEventKey> = (
  payload: RiskEventPayloads[K]
) => void;
