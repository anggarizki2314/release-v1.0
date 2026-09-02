/**
 * Trading Engine 2.0 — ChallengeEngine
 * Business logic engine validating challenge rules & session evaluation modes.
 *
 * Source of Truth:
 * Session + AccountEngine + ClosedPositionRepository
 *   ↓
 * ChallengeEngine
 *   ↓
 * Dashboard / Analytics / Trade History
 *
 * Strictly READ-ONLY. Never mutates Balance, Equity, Positions, or Orders.
 * Zero hardcoded prop-firm names.
 */

import type { AccountEngine } from '../account/AccountEngine';
import type { ClosedPositionRepository } from '../repository/ClosedPositionRepository';
import type { ChallengeState, ChallengeRules, ChallengeMode, ChallengeStatus } from './ChallengeTypes';
import { TargetValidator, DailyLossValidator, MaxLossValidator, TradingDaysValidator } from './ChallengeValidators';

export type ChallengeEngineListener = (state: Readonly<ChallengeState>) => void;

export class ChallengeEngine {
  private accountEngine: AccountEngine;
  private closedPositionRepo: ClosedPositionRepository;

  private mode: ChallengeMode = 'NORMAL';
  private rules: ChallengeRules;
  private state: ChallengeState;

  private dayStartEquity: number;
  private currentDayStr: string | null = null;
  private listeners: Set<ChallengeEngineListener> = new Set();

  private unsubscribeAccount: (() => void) | null = null;
  private unsubscribeClosedRepo: (() => void) | null = null;

  constructor(
    accountEngine: AccountEngine,
    closedPositionRepo: ClosedPositionRepository,
    rules?: Partial<ChallengeRules>,
    mode: ChallengeMode = 'NORMAL'
  ) {
    this.accountEngine = accountEngine;
    this.closedPositionRepo = closedPositionRepo;
    this.mode = mode;

    const initialBal = rules?.initialBalance ?? accountEngine.getInitialBalance() ?? 100_000;
    this.rules = {
      initialBalance: initialBal,
      profitTargetPercent: rules?.profitTargetPercent ?? 10.0,
      maxDailyLossPercent: rules?.maxDailyLossPercent ?? 5.0,
      maxTotalLossPercent: rules?.maxTotalLossPercent ?? 10.0,
      minimumTradingDays: rules?.minimumTradingDays ?? 0,
      leverage: rules?.leverage ?? 100,
      currency: rules?.currency ?? 'USD',
    };

    this.dayStartEquity = initialBal;
    this.state = this.createInitialState();

    this.bindSubscriptions();
    this.recalculate();
  }

  private bindSubscriptions(): void {
    if (this.unsubscribeAccount) this.unsubscribeAccount();
    if (this.unsubscribeClosedRepo) this.unsubscribeClosedRepo();

    this.unsubscribeAccount = this.accountEngine.subscribe(() => this.recalculate());
    this.unsubscribeClosedRepo = this.closedPositionRepo.subscribe(() => this.recalculate());
  }

  private createInitialState(): ChallengeState {
    if (this.mode === 'NORMAL') {
      return {
        mode: 'NORMAL',
        status: 'NORMAL MODE',
        profit: 0,
        profitPercent: 0,
        targetPercent: 0,
        remainingTarget: 0,
        dailyDrawdown: 0,
        maximumDrawdown: 0,
        remainingDailyLoss: 0,
        remainingMaximumLoss: 0,
        minimumTradingDays: 0,
        currentTradingDays: 0,
        targetReached: false,
        dailyLossViolated: false,
        maximumLossViolated: false,
        violationReason: null,
      };
    }

    const initialBal = this.rules.initialBalance;
    const targetDollar = (initialBal * this.rules.profitTargetPercent) / 100;
    const dailyLossDollar = (initialBal * this.rules.maxDailyLossPercent) / 100;
    const maxLossDollar = (initialBal * this.rules.maxTotalLossPercent) / 100;

    return {
      mode: 'CHALLENGE',
      status: 'IDLE',
      profit: 0,
      profitPercent: 0,
      targetPercent: this.rules.profitTargetPercent,
      remainingTarget: targetDollar,
      dailyDrawdown: 0,
      maximumDrawdown: 0,
      remainingDailyLoss: dailyLossDollar,
      remainingMaximumLoss: maxLossDollar,
      minimumTradingDays: this.rules.minimumTradingDays,
      currentTradingDays: 0,
      targetReached: false,
      dailyLossViolated: false,
      maximumLossViolated: false,
      violationReason: null,
    };
  }

  /**
   * Recalculates Challenge State based on AccountEngine & ClosedPositionRepository.
   */
  public recalculate(currentTimestamp?: number): Readonly<ChallengeState> {
    if (this.mode === 'NORMAL') {
      this.state = {
        mode: 'NORMAL',
        status: 'NORMAL MODE',
        profit: 0,
        profitPercent: 0,
        targetPercent: 0,
        remainingTarget: 0,
        dailyDrawdown: 0,
        maximumDrawdown: 0,
        remainingDailyLoss: 0,
        remainingMaximumLoss: 0,
        minimumTradingDays: 0,
        currentTradingDays: 0,
        targetReached: false,
        dailyLossViolated: false,
        maximumLossViolated: false,
        violationReason: null,
      };
      this.notifyListeners();
      return this.getState();
    }

    // ── CHALLENGE MODE EVALUATION ──
    const accountState = this.accountEngine.getState();
    const closedPositions = this.closedPositionRepo.getClosedPositions();
    const initialBal = this.rules.initialBalance > 0 ? this.rules.initialBalance : accountState.balance;

    // 1. Trading Days calculation
    const currentTradingDays = TradingDaysValidator.evaluate(closedPositions);

    // 2. Profit & Target calculation
    const profit = Math.round((accountState.equity - initialBal) * 100) / 100;
    const profitPercent = initialBal > 0 ? Math.round(((profit / initialBal) * 100) * 100) / 100 : 0;
    const targetDollar = (initialBal * this.rules.profitTargetPercent) / 100;
    const remainingTarget = Math.max(0, Math.round((targetDollar - profit) * 100) / 100);

    // 3. Day rollover & Intraday Daily Loss tracking
    const dateStr = currentTimestamp ? new Date(currentTimestamp).toISOString().split('T')[0] : null;
    if (dateStr && dateStr !== this.currentDayStr) {
      this.currentDayStr = dateStr;
      this.dayStartEquity = accountState.equity;
    }
    const dailyDrawdown = Math.max(0, Math.round((this.dayStartEquity - accountState.equity) * 100) / 100);
    const dailyLossLimitDollar = (initialBal * this.rules.maxDailyLossPercent) / 100;

    // 4. Maximum Total Drawdown calculation
    const maximumDrawdown = Math.max(0, Math.round((initialBal - accountState.equity) * 100) / 100);
    const maxTotalLossLimitDollar = (initialBal * this.rules.maxTotalLossPercent) / 100;

    // 5. Run Independent Rule Validators
    const targetResult = TargetValidator.evaluate(
      profitPercent,
      this.rules.profitTargetPercent,
      currentTradingDays,
      this.rules.minimumTradingDays
    );

    const dailyLossResult = DailyLossValidator.evaluate(dailyDrawdown, dailyLossLimitDollar);
    const maxLossResult = MaxLossValidator.evaluate(maximumDrawdown, maxTotalLossLimitDollar);

    // Preserve previous violation if already failed
    const dailyLossViolated = this.state.dailyLossViolated || dailyLossResult.dailyLossViolated;
    const maximumLossViolated = this.state.maximumLossViolated || maxLossResult.maximumLossViolated;

    // Determine status
    let status: ChallengeStatus = 'RUNNING';
    let violationReason: string | null = this.state.violationReason ?? null;

    if (dailyLossViolated) {
      status = 'FAILED';
      violationReason = 'Maximum Daily Loss Limit Exceeded';
    } else if (maximumLossViolated) {
      status = 'FAILED';
      violationReason = 'Maximum Total Drawdown Limit Exceeded';
    } else if (targetResult.isPassed) {
      status = 'PASSED';
      violationReason = null;
    } else if (closedPositions.length === 0 && accountState.equity === initialBal) {
      status = 'IDLE';
    }

    this.state = {
      mode: 'CHALLENGE',
      status,
      profit,
      profitPercent,
      targetPercent: this.rules.profitTargetPercent,
      remainingTarget,
      dailyDrawdown,
      maximumDrawdown,
      remainingDailyLoss: Math.round(dailyLossResult.remainingDailyLossDollar * 100) / 100,
      remainingMaximumLoss: Math.round(maxLossResult.remainingMaximumLossDollar * 100) / 100,
      minimumTradingDays: this.rules.minimumTradingDays,
      currentTradingDays,
      targetReached: targetResult.targetReached,
      dailyLossViolated,
      maximumLossViolated,
      violationReason,
    };

    this.notifyListeners();
    return this.getState();
  }

  /**
   * Initializes or updates Session rules & mode.
   */
  public initializeSession(
    mode: ChallengeMode = 'NORMAL',
    rules?: Partial<ChallengeRules>
  ): void {
    this.mode = mode;
    if (rules) {
      this.rules = {
        ...this.rules,
        ...rules,
        initialBalance: rules.initialBalance ?? this.rules.initialBalance,
      };
    }
    this.dayStartEquity = this.rules.initialBalance;
    this.currentDayStr = null;
    this.state = this.createInitialState();
    this.recalculate();
  }

  public getState(): Readonly<ChallengeState> {
    return { ...this.state };
  }

  public getMode(): ChallengeMode {
    return this.mode;
  }

  public getRules(): Readonly<ChallengeRules> {
    return { ...this.rules };
  }

  public subscribe(listener: ChallengeEngineListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const currentState = this.getState();
    this.listeners.forEach((l) => {
      try {
        l(currentState);
      } catch (err) {
        console.error('[ChallengeEngine] Listener error:', err);
      }
    });
  }

  public destroy(): void {
    if (this.unsubscribeAccount) this.unsubscribeAccount();
    if (this.unsubscribeClosedRepo) this.unsubscribeClosedRepo();
    this.listeners.clear();
  }
}
