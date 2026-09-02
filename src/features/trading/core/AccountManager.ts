/**
 * Trading Engine 2.0 — AccountManager
 * Business layer responsible for Account Balance, Equity, Floating PnL, Margin, Free Margin, and Margin Level metrics.
 */

import type { AccountState, Position } from '../types/models';
import type { TradingStore } from './TradingStore';
import type { TradingEventBus } from './EventBus';
import type { MarginManager } from './MarginManager';

export class AccountManager {
  constructor(
    private store: TradingStore,
    private eventBus: TradingEventBus,
    private marginManager: MarginManager
  ) {}

  /**
   * Recalculates Equity, Floating PnL, Used Margin, Free Margin, and Margin Level.
   * Emits `account:updated` event if state changes.
   */
  public recalculate(): AccountState {
    const currentAccount = this.store.getAccount();
    const positions = this.store.getPositions();

    // 1. Total Floating PnL across all open positions
    const totalFloatingPnl = positions.reduce((sum, pos) => sum + pos.floatingPnl, 0);

    // 2. Equity = Balance + Floating PnL
    const equity = currentAccount.balance + totalFloatingPnl;

    // 3. Required Margin calculated via MarginManager
    const margin = this.marginManager.calculateTotalMargin(positions);

    // 4. Free Margin = Equity - Used Margin
    const freeMargin = equity - margin;

    // 5. Margin Level = (Equity / Margin) * 100
    const marginLevel = margin > 0 ? (equity / margin) * 100 : null;

    const nextState: AccountState = {
      balance: currentAccount.balance,
      equity,
      floatingPnl: totalFloatingPnl,
      margin,
      freeMargin,
      marginLevel,
    };

    this.store.updateAccount(nextState);
    this.eventBus.emit('account:updated', { account: nextState });

    return nextState;
  }

  /**
   * Realizes profit/loss into balance upon position closure or partial close.
   */
  public applyRealizedPnl(pnlAmount: number): void {
    const current = this.store.getAccount();
    const newBalance = current.balance + pnlAmount;

    const nextState: AccountState = {
      ...current,
      balance: newBalance,
    };

    this.store.updateAccount(nextState);
    this.recalculate();
  }

  /**
   * Resets account balance and metrics.
   */
  public reset(initialBalance: number): void {
    this.store.reset(initialBalance);
    this.recalculate();
  }
}
