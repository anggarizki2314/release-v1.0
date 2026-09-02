/**
 * Trading Engine 2.0 — AccountEngine
 * Business logic module calculating real-time trading account metrics.
 *
 * Source of truth flow:
 * Session + Position Engine (PositionManager) + ClosedPositionRepository
 *   ↓
 * AccountEngine
 *   ↓
 * Dashboard / Challenge Engine / Analytics
 *
 * Subscribes strictly to PositionEngine via single PositionChanged event.
 * Reads Open Positions from PositionEngine & Closed Positions from ClosedPositionRepository.
 * Zero UI, React, Chart, or Direct TradingStore dependencies.
 */

import type { PositionManager } from '../position/PositionManager';
import type { ClosedPositionRepository } from '../repository/ClosedPositionRepository';
import type { AccountState, AccountConfig } from './AccountTypes';
import { InstrumentMetadata } from '../instrument/InstrumentMetadata';

export type AccountEngineListener = (state: Readonly<AccountState>) => void;

export class AccountEngine {
  private positionManager: PositionManager;
  private closedPositionRepo: ClosedPositionRepository;

  private initialBalance: number;
  private currency: string;
  private leverage: number;

  private state: AccountState;
  private listeners: Set<AccountEngineListener> = new Set();
  private unsubscribePositionManager: (() => void) | null = null;

  constructor(
    positionManager: PositionManager,
    closedPositionRepo: ClosedPositionRepository,
    config: Partial<AccountConfig> = {}
  ) {
    this.positionManager = positionManager;
    this.closedPositionRepo = closedPositionRepo;

    this.initialBalance = config.initialBalance ?? 0;
    this.currency = config.currency ?? 'USD';
    this.leverage = config.leverage ?? 100;

    this.state = {
      balance: this.initialBalance,
      equity: this.initialBalance,
      floatingPnL: 0,
      realizedPnL: 0,
      usedMargin: 0,
      freeMargin: this.initialBalance,
      marginLevel: Infinity,
      openPositions: 0,
      closedPositions: 0,
      winTrades: 0,
      lossTrades: 0,
    };

    this.subscribeToPositionEngine();
    this.recalculate();
  }

  /**
   * Subscribes strictly to PositionEngine via single PositionChanged event.
   */
  private subscribeToPositionEngine(): void {
    if (this.unsubscribePositionManager) {
      this.unsubscribePositionManager();
    }

    this.unsubscribePositionManager = this.positionManager.on('PositionChanged', (payload) => {
      if (payload.event === 'RESET') {
        this.resetInternal();
      }
      this.recalculate();
    });
  }

  /**
   * Recalculates all account metrics based on Open Positions & ClosedPositionRepository.
   */
  public recalculate(): Readonly<AccountState> {
    // 1. Read CLOSED positions stats from ClosedPositionRepository
    const totalRealizedPnL = this.closedPositionRepo.getTotalRealizedPnL();
    const closedStats = this.closedPositionRepo.getStatistics();

    this.state.realizedPnL = Math.round(totalRealizedPnL * 100) / 100;
    // Balance ONLY changes when positions are closed (realized PnL accumulated)
    this.state.balance = Math.round((this.initialBalance + totalRealizedPnL) * 100) / 100;
    this.state.closedPositions = closedStats.closedPositions;
    this.state.winTrades = closedStats.winTrades;
    this.state.lossTrades = closedStats.lossTrades;

    // 2. Read OPEN positions from PositionEngine
    const openPositionsList = this.positionManager.getOpenPositions();
    this.state.openPositions = openPositionsList.length;

    // 3. Floating PnL = sum of floating PnLs across all OPEN positions
    const floatingPnL = openPositionsList.reduce((sum, pos) => sum + (pos.floatingPnL || 0), 0);
    this.state.floatingPnL = Math.round(floatingPnL * 100) / 100;

    // 4. Equity = Balance + FloatingPnL
    const equity = this.state.balance + this.state.floatingPnL;
    this.state.equity = Math.round(equity * 100) / 100;

    // 5. Used Margin = sum of required margin for all OPEN positions
    const usedMargin = openPositionsList.reduce((sum, pos) => {
      const contractSize = InstrumentMetadata.getContractSize(pos.symbol);
      const lev = this.leverage > 0 ? this.leverage : 100;
      const isUsdBase = InstrumentMetadata.isUsdBasePair(pos.symbol);
      const posMargin = isUsdBase
        ? (contractSize * pos.volume) / lev
        : (contractSize * pos.volume * pos.currentPrice) / lev;
      return sum + posMargin;
    }, 0);

    this.state.usedMargin = Math.round(usedMargin * 100) / 100;

    // 6. Free Margin = Equity - UsedMargin
    this.state.freeMargin = Math.round((this.state.equity - this.state.usedMargin) * 100) / 100;

    // 7. Margin Level = (Equity / UsedMargin) * 100 (Infinity when UsedMargin = 0)
    if (this.state.usedMargin <= 0) {
      this.state.marginLevel = Infinity;
    } else {
      this.state.marginLevel = Math.round(((this.state.equity / this.state.usedMargin) * 100) * 100) / 100;
    }

    this.notifyListeners();
    return this.getState();
  }

  /**
   * Initializes or updates Account Engine configuration (Session params).
   */
  public initializeSession(initialBalance: number, currency?: string, leverage?: number): void {
    this.initialBalance = initialBalance;
    if (currency !== undefined) this.currency = currency;
    if (leverage !== undefined) this.leverage = leverage;
    this.resetInternal();
    this.recalculate();
  }

  /**
   * Resets account state to initial balance & clears counters.
   */
  public reset(newInitialBalance?: number, newLeverage?: number): void {
    if (newInitialBalance !== undefined) this.initialBalance = newInitialBalance;
    if (newLeverage !== undefined) this.leverage = newLeverage;
    this.resetInternal();
    this.recalculate();
  }

  private resetInternal(): void {
    this.state = {
      balance: this.initialBalance,
      equity: this.initialBalance,
      floatingPnL: 0,
      realizedPnL: 0,
      usedMargin: 0,
      freeMargin: this.initialBalance,
      marginLevel: Infinity,
      openPositions: 0,
      closedPositions: 0,
      winTrades: 0,
      lossTrades: 0,
    };
  }

  public getState(): Readonly<AccountState> {
    return { ...this.state };
  }

  public getInitialBalance(): number {
    return this.initialBalance;
  }

  public getLeverage(): number {
    return this.leverage;
  }

  public getCurrency(): string {
    return this.currency;
  }

  public subscribe(listener: AccountEngineListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const currentState = this.getState();
    this.listeners.forEach((l) => {
      try {
        l(currentState);
      } catch (err) {
        console.error('[AccountEngine] Listener error:', err);
      }
    });
  }

  public destroy(): void {
    if (this.unsubscribePositionManager) {
      this.unsubscribePositionManager();
      this.unsubscribePositionManager = null;
    }
    this.listeners.clear();
  }
}
