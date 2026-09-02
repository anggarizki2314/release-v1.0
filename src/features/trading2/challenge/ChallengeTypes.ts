/**
 * Trading Engine 2.0 — Challenge Types
 * Data schemas for Challenge Engine state, rules, and validators.
 * Zero UI, React, Chart, or Replay dependencies.
 */

export type ChallengeMode = 'NORMAL' | 'CHALLENGE';

export type ChallengeStatus = 'IDLE' | 'NORMAL MODE' | 'RUNNING' | 'PASSED' | 'FAILED';

export interface ChallengeRules {
  initialBalance: number;
  profitTargetPercent: number; // e.g. 10.0 for 10%
  maxDailyLossPercent: number; // e.g. 5.0 for 5%
  maxTotalLossPercent: number; // e.g. 10.0 for 10%
  minimumTradingDays: number; // e.g. 5
  leverage: number;
  currency: string;
}

export interface ChallengeState {
  mode: ChallengeMode;
  status: ChallengeStatus;
  profit: number;
  profitPercent: number;
  targetPercent: number;
  remainingTarget: number;
  dailyDrawdown: number;
  maximumDrawdown: number;
  remainingDailyLoss: number;
  remainingMaximumLoss: number;
  minimumTradingDays: number;
  currentTradingDays: number;
  targetReached: boolean;
  dailyLossViolated: boolean;
  maximumLossViolated: boolean;
  violationReason?: string | null;
}
