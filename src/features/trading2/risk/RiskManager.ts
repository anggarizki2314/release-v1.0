/**
 * Trading Engine 2.0 — RiskManager
 * Business layer managing all Trading Risk calculations and validations.
 * Integrates ONLY with TradingStore and AccountManager.
 * Does NOT place orders or modify positions.
 * Zero UI, React, Chart, Drawing, or Replay dependencies.
 */

import type { TradingStore } from '../store/TradingStore';
import type { AccountManager } from '../account/AccountManager';
import type {
  RiskInputParams,
  RiskCalculationResult,
  RewardCalculationResult,
  RRCalculationResult,
  LotCalculationResult,
  MarginCalculationResult,
  CompleteRiskAssessment,
  RiskValidationWarning,
  RiskManagerSettings,
} from './RiskTypes';
import { DEFAULT_RISK_SETTINGS } from './RiskTypes';
import type {
  RiskEventKey,
  RiskEventListener,
  RiskEventPayloads,
} from './RiskEvents';
import { RiskCalculator } from './RiskCalculator';
import { LotCalculator } from './LotCalculator';
import { RewardCalculator } from './RewardCalculator';

export class RiskManager {
  private store: TradingStore;
  private accountManager: AccountManager;
  private settings: RiskManagerSettings;
  private listeners: { [K in RiskEventKey]?: RiskEventListener<K>[] } = {};

  constructor(
    store: TradingStore,
    accountManager: AccountManager,
    settings: Partial<RiskManagerSettings> = {}
  ) {
    this.store = store;
    this.accountManager = accountManager;
    this.settings = { ...DEFAULT_RISK_SETTINGS, ...settings };
  }

  // ─── EVENT SUBSCRIPTION ───────────────────────────────────────────

  public on<K extends RiskEventKey>(
    event: K,
    listener: RiskEventListener<K>
  ): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    (this.listeners[event] as RiskEventListener<K>[]).push(listener);

    return () => this.off(event, listener);
  }

  public off<K extends RiskEventKey>(
    event: K,
    listener: RiskEventListener<K>
  ): void {
    const list = this.listeners[event] as RiskEventListener<K>[] | undefined;
    if (!list) return;
    this.listeners[event] = list.filter((l) => l !== listener) as any;
  }

  private emit<K extends RiskEventKey>(
    event: K,
    payload: RiskEventPayloads[K]
  ): void {
    const list = this.listeners[event] as RiskEventListener<K>[] | undefined;
    if (!list || list.length === 0) return;

    const listCopy = [...list];
    for (const listener of listCopy) {
      try {
        listener(payload);
      } catch (err) {
        console.error(`[RiskManager] Listener error for event "${event}":`, err);
      }
    }
  }

  // ─── PUBLIC CALCULATION METHODS ───────────────────────────────────

  /**
   * Calculates Risk Dollar, Risk Percent, Pip Risk, and Estimated Loss.
   */
  public calculateRisk(input: RiskInputParams): RiskCalculationResult {
    const account = this.accountManager.getAccountModel();
    const balance = account.balance;
    const requestedRiskPercent = input.riskPercent ?? this.settings.defaultRiskPercent;

    const riskDollar = input.riskDollar ?? RiskCalculator.calculateRiskDollar(balance, requestedRiskPercent);
    const riskPercent = RiskCalculator.calculateRiskPercent(balance, riskDollar);

    const pipRisk = RiskCalculator.calculatePipRisk(
      input.entryPrice,
      input.stopLoss,
      input.instrumentSpecs.tickSize
    );

    const estimatedLoss = RiskCalculator.calculateEstimatedLoss(
      input.side,
      input.entryPrice,
      input.stopLoss,
      input.volume,
      input.instrumentSpecs.contractSize,
      input.symbol
    );

    const result: RiskCalculationResult = {
      riskDollar: Math.round(riskDollar * 100) / 100,
      riskPercent: Math.round(riskPercent * 100) / 100,
      pipRisk,
      estimatedLoss: Math.round(estimatedLoss * 100) / 100,
    };

    this.emit('RiskChanged', result);
    return result;
  }

  /**
   * Calculates Reward Dollar, Reward Percent, Pip Reward, and Estimated Profit.
   */
  public calculateReward(input: RiskInputParams): RewardCalculationResult {
    const account = this.accountManager.getAccountModel();
    const balance = account.balance;

    const rewardDollar = RewardCalculator.calculateEstimatedProfit(
      input.side,
      input.entryPrice,
      input.takeProfit,
      input.volume,
      input.instrumentSpecs.contractSize,
      input.symbol
    );

    const rewardPercent = RewardCalculator.calculateRewardPercent(balance, rewardDollar);

    const pipReward = RewardCalculator.calculatePipReward(
      input.entryPrice,
      input.takeProfit,
      input.instrumentSpecs.tickSize
    );

    const result: RewardCalculationResult = {
      rewardDollar: Math.round(rewardDollar * 100) / 100,
      rewardPercent: Math.round(rewardPercent * 100) / 100,
      pipReward,
      estimatedProfit: Math.round(rewardDollar * 100) / 100,
    };

    this.emit('RewardChanged', result);
    return result;
  }

  /**
   * Calculates Risk:Reward (RR) ratio.
   */
  public calculateRR(input: RiskInputParams): RRCalculationResult {
    return RewardCalculator.calculateRiskRewardRatio(
      input.entryPrice,
      input.stopLoss,
      input.takeProfit
    );
  }

  /**
   * Calculates Auto Lot Size based on risk dollar and SL distance.
   */
  public calculateLot(input: RiskInputParams): LotCalculationResult {
    const account = this.accountManager.getAccountModel();
    const balance = account.balance;
    const requestedRiskPercent = input.riskPercent ?? this.settings.defaultRiskPercent;

    const riskDollar = input.riskDollar ?? RiskCalculator.calculateRiskDollar(balance, requestedRiskPercent);
    const slDistance = input.stopLoss ? Math.abs(input.entryPrice - input.stopLoss) : 0;

    const autoLot = LotCalculator.calculateAutoLot(
      riskDollar,
      slDistance,
      input.instrumentSpecs.contractSize,
      input.symbol,
      input.entryPrice
    );

    const result: LotCalculationResult = {
      autoLotSize: autoLot,
      boundedLotSize: Math.max(0.01, autoLot),
    };

    this.emit('LotChanged', result);
    return result;
  }

  /**
   * Calculates Required Margin and Remaining Free Margin for trade.
   */
  public calculateMargin(input: RiskInputParams): MarginCalculationResult {
    const account = this.accountManager.getAccountModel();
    const leverage = input.leverage ?? account.leverage;

    const requiredMargin = LotCalculator.calculateRequiredMargin(
      input.volume,
      input.entryPrice,
      input.instrumentSpecs.contractSize,
      leverage,
      input.symbol
    );

    const remainingMargin = LotCalculator.calculateRemainingMargin(
      account.freeMargin,
      requiredMargin
    );

    const result: MarginCalculationResult = {
      requiredMargin: Math.round(requiredMargin * 100) / 100,
      remainingMargin: Math.round(remainingMargin * 100) / 100,
    };

    this.emit('MarginChanged', result);
    return result;
  }

  /**
   * Returns Risk Percent calculation.
   */
  public calculateRiskPercent(balance: number, riskDollar: number): number {
    return RiskCalculator.calculateRiskPercent(balance, riskDollar);
  }

  /**
   * Returns Reward Percent calculation.
   */
  public calculateRewardPercent(balance: number, rewardDollar: number): number {
    return RewardCalculator.calculateRewardPercent(balance, rewardDollar);
  }

  /**
   * Validates risk parameters and SL/TP bounds.
   */
  public validateRisk(input: RiskInputParams): RiskValidationWarning[] {
    const risk = this.calculateRisk(input);
    return RiskCalculator.validateRisk(
      risk.riskPercent,
      input.entryPrice,
      input.stopLoss,
      input.side,
      this.settings.maxAllowedRiskPercent
    );
  }

  /**
   * Validates margin bounds against account free margin.
   */
  public validateMargin(input: RiskInputParams): RiskValidationWarning[] {
    const margin = this.calculateMargin(input);
    const account = this.accountManager.getAccountModel();

    return LotCalculator.validateMargin(
      margin.requiredMargin,
      account.freeMargin,
      account.equity,
      this.settings.maxMarginUsagePercent
    );
  }

  /**
   * Evaluates complete risk assessment (Risk, Reward, RR, Lot, Margin, Warnings).
   */
  public assessCompleteRisk(input: RiskInputParams): CompleteRiskAssessment {
    const risk = this.calculateRisk(input);
    const reward = this.calculateReward(input);
    const rr = this.calculateRR(input);
    const lot = this.calculateLot(input);
    const margin = this.calculateMargin(input);

    const riskWarnings = this.validateRisk(input);
    const marginWarnings = this.validateMargin(input);
    const tpWarnings = RewardCalculator.validateReward(input.entryPrice, input.takeProfit, input.side);

    const warnings = [...riskWarnings, ...marginWarnings, ...tpWarnings];
    this.emit('ValidationChanged', { warnings });

    return {
      risk,
      reward,
      rr,
      lot,
      margin,
      warnings,
    };
  }

  /**
   * Resets settings to default parameters.
   */
  public reset(): void {
    this.settings = { ...DEFAULT_RISK_SETTINGS };
  }

  /**
   * Returns current settings.
   */
  public getSettings(): Readonly<RiskManagerSettings> {
    return { ...this.settings };
  }

  /**
   * Updates settings parameters.
   */
  public updateSettings(newSettings: Partial<RiskManagerSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
  }
}
