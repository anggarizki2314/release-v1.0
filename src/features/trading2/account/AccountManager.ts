/**
 * Trading Engine 2.0 — AccountManager
 * Business layer managing ONLY Account calculations & state synchronization.
 * Integrates strictly with TradingStore. Reads & updates TradingStore.account.
 * Contains zero duplicated state, zero UI, zero React, zero Replay, zero Chart dependencies.
 */

import type { TradingStore } from '../store/TradingStore';
import type { AccountModel, AccountSnapshot } from './AccountTypes';
import type {
  AccountEventKey,
  AccountEventListener,
  AccountEventPayloads,
} from './AccountEvents';
import { AccountCalculations } from './AccountCalculations';

export class AccountManager {
  private store: TradingStore;
  private listeners: { [K in AccountEventKey]?: AccountEventListener<K>[] } = {};
  private highWaterMark: number;
  private initialDeposit: number;

  constructor(store: TradingStore) {
    this.store = store;
    const currentAccount = this.store.getAccount();
    this.highWaterMark = currentAccount.balance;
    this.initialDeposit = currentAccount.balance;
  }

  // ─── EVENT SUBSCRIPTION ───────────────────────────────────────────

  public on<K extends AccountEventKey>(
    event: K,
    listener: AccountEventListener<K>
  ): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    (this.listeners[event] as AccountEventListener<K>[]).push(listener);

    return () => this.off(event, listener);
  }

  public off<K extends AccountEventKey>(
    event: K,
    listener: AccountEventListener<K>
  ): void {
    const list = this.listeners[event] as AccountEventListener<K>[] | undefined;
    if (!list) return;
    this.listeners[event] = list.filter((l) => l !== listener) as any;
  }

  private emit<K extends AccountEventKey>(
    event: K,
    payload: AccountEventPayloads[K]
  ): void {
    const list = this.listeners[event] as AccountEventListener<K>[] | undefined;
    if (!list || list.length === 0) return;

    const listCopy = [...list];
    for (const listener of listCopy) {
      try {
        listener(payload);
      } catch (err) {
        console.error(`[AccountManager] Listener error for event "${event}":`, err);
      }
    }
  }

  // ─── PUBLIC ACCOUNT MANAGEMENT METHODS ───────────────────────────

  /**
   * Sets initial deposit base amount.
   */
  public setInitialDeposit(amount: number): void {
    if (amount > 0) {
      this.initialDeposit = amount;
    }
  }

  /**
   * Initializes account parameters and recalculates state metrics.
   */
  public initialize(
    initialBalance?: number,
    currency?: string,
    leverage?: number
  ): void {
    const current = this.store.getAccount();
    const balance = initialBalance ?? current.balance;
    const curr = currency ?? current.currency;
    const lev = leverage ?? current.leverage;

    if (initialBalance !== undefined && initialBalance > 0) {
      this.initialDeposit = initialBalance;
    }

    const equity = AccountCalculations.calculateEquity(balance, 0);
    const freeMargin = AccountCalculations.calculateFreeMargin(equity, 0);
    const marginLevel = AccountCalculations.calculateMarginLevel(equity, 0);

    this.highWaterMark = balance;

    this.store.updateAccount({
      balance,
      equity,
      floatingPnL: 0,
      margin: 0,
      freeMargin,
      marginLevel,
      currency: curr,
      leverage: lev,
    });

    this.emit('AccountReset', { account: this.getAccountModel() });
  }

  /**
   * Deposits funds into account balance.
   */
  public deposit(amount: number, reason: string = 'Deposit'): void {
    if (amount <= 0) return;

    const current = this.store.getAccount();
    const oldBalance = current.balance;
    const newBalance = oldBalance + amount;

    const equity = AccountCalculations.calculateEquity(newBalance, current.floatingPnL);
    const freeMargin = AccountCalculations.calculateFreeMargin(equity, current.margin);
    const marginLevel = AccountCalculations.calculateMarginLevel(equity, current.margin);

    this.highWaterMark = AccountCalculations.calculateHighWaterMark(this.highWaterMark, equity);

    this.store.updateAccount({
      balance: newBalance,
      equity,
      freeMargin,
      marginLevel,
    });

    this.emit('BalanceChanged', { oldBalance, newBalance, reason });
    this.emit('EquityChanged', { oldEquity: current.equity, newEquity: equity });
  }

  /**
   * Realizes profit/loss into account balance upon position closure.
   */
  public applyRealizedPnL(pnlAmount: number, reason: string = 'Realized PnL'): void {
    if (pnlAmount === 0) return;

    const current = this.store.getAccount();
    const oldBalance = current.balance;
    const newBalance = oldBalance + pnlAmount;

    const equity = AccountCalculations.calculateEquity(newBalance, current.floatingPnL);
    const freeMargin = AccountCalculations.calculateFreeMargin(equity, current.margin);
    const marginLevel = AccountCalculations.calculateMarginLevel(equity, current.margin);

    this.highWaterMark = AccountCalculations.calculateHighWaterMark(this.highWaterMark, equity);

    this.store.updateAccount({
      balance: newBalance,
      equity,
      freeMargin,
      marginLevel,
    });

    this.emit('BalanceChanged', { oldBalance, newBalance, reason });
    this.emit('EquityChanged', { oldEquity: current.equity, newEquity: equity });
  }

  /**
   * Withdraws funds from account balance if sufficient free margin exists.
   */
  public withdraw(amount: number, reason: string = 'Withdrawal'): boolean {
    if (amount <= 0) return false;

    const current = this.store.getAccount();
    if (current.freeMargin < amount) return false; // Prevent over-withdrawal

    const oldBalance = current.balance;
    const newBalance = oldBalance - amount;

    const equity = AccountCalculations.calculateEquity(newBalance, current.floatingPnL);
    const freeMargin = AccountCalculations.calculateFreeMargin(equity, current.margin);
    const marginLevel = AccountCalculations.calculateMarginLevel(equity, current.margin);

    this.store.updateAccount({
      balance: newBalance,
      equity,
      freeMargin,
      marginLevel,
    });

    this.emit('BalanceChanged', { oldBalance, newBalance, reason });
    this.emit('EquityChanged', { oldEquity: current.equity, newEquity: equity });
    return true;
  }

  /**
   * Updates total Floating PnL and recalculates Equity & Free Margin.
   */
  public updateFloatingPnL(floatingPnL: number): void {
    const current = this.store.getAccount();
    const oldEquity = current.equity;

    const newEquity = AccountCalculations.calculateEquity(current.balance, floatingPnL);
    const freeMargin = AccountCalculations.calculateFreeMargin(newEquity, current.margin);
    const marginLevel = AccountCalculations.calculateMarginLevel(newEquity, current.margin);

    this.highWaterMark = AccountCalculations.calculateHighWaterMark(this.highWaterMark, newEquity);

    this.store.updateAccount({
      floatingPnL,
      equity: newEquity,
      freeMargin,
      marginLevel,
    });

    this.emit('FloatingChanged', { floatingPnL });
    if (oldEquity !== newEquity) {
      this.emit('EquityChanged', { oldEquity, newEquity });
    }
  }

  /**
   * Updates used Margin and recalculates Free Margin & Margin Level.
   */
  public updateMargin(usedMargin: number): void {
    const current = this.store.getAccount();
    const oldMargin = current.margin;
    const margin = Math.max(0, usedMargin);

    const freeMargin = AccountCalculations.calculateFreeMargin(current.equity, margin);
    const marginLevel = AccountCalculations.calculateMarginLevel(current.equity, margin);

    this.store.updateAccount({
      margin,
      freeMargin,
      marginLevel,
    });

    this.emit('MarginChanged', {
      oldMargin,
      newMargin: margin,
      freeMargin,
      marginLevel,
    });
  }

  /**
   * Forces full recalculation of Equity, Free Margin, and Margin Level.
   */
  public updateEquity(): void {
    const current = this.store.getAccount();
    const oldEquity = current.equity;

    const equity = AccountCalculations.calculateEquity(current.balance, current.floatingPnL);
    const freeMargin = AccountCalculations.calculateFreeMargin(equity, current.margin);
    const marginLevel = AccountCalculations.calculateMarginLevel(equity, current.margin);

    this.highWaterMark = AccountCalculations.calculateHighWaterMark(this.highWaterMark, equity);

    this.store.updateAccount({
      equity,
      freeMargin,
      marginLevel,
    });

    if (oldEquity !== equity) {
      this.emit('EquityChanged', { oldEquity, newEquity: equity });
    }
  }

  /**
   * Resets account balance and metrics to baseline.
   */
  public reset(initialBalance?: number): void {
    const current = this.store.getAccount();
    const balance = initialBalance ?? current.balance;

    if (initialBalance !== undefined && initialBalance > 0) {
      this.initialDeposit = initialBalance;
    }

    this.store.updateAccount({
      balance,
      equity: balance,
      floatingPnL: 0,
      margin: 0,
      freeMargin: balance,
      marginLevel: null,
    });

    this.highWaterMark = balance;
    this.emit('AccountReset', { account: this.getAccountModel() });
  }

  /**
   * Creates a snapshot of current Account Model.
   */
  public snapshot(): AccountSnapshot {
    return {
      state: this.store.getAccount(),
      model: this.getAccountModel(),
      timestamp: Date.now(),
    };
  }


  /**
   * Restores Account state from snapshot.
   */
  public restore(snapshot: AccountSnapshot): void {
    if (!snapshot || !snapshot.model) return;

    this.store.updateAccount({
      balance: snapshot.model.balance,
      equity: snapshot.model.equity,
      floatingPnL: snapshot.model.floatingPnL,
      margin: snapshot.model.margin,
      freeMargin: snapshot.model.freeMargin,
      marginLevel: snapshot.model.marginLevel,
      currency: snapshot.model.currency,
      leverage: snapshot.model.leverage,
    });

    if (snapshot.model.initialBalance && snapshot.model.initialBalance > 0) {
      this.initialDeposit = snapshot.model.initialBalance;
    }

    this.highWaterMark = snapshot.model.highWaterMark;
    this.emit('AccountReset', { account: this.getAccountModel() });
  }

  /**
   * Returns current complete AccountModel view.
   */
  public getAccountModel(): AccountModel {
    const acc = this.store.getAccount();
    return {
      balance: acc.balance,
      equity: acc.equity,
      floatingPnL: acc.floatingPnL,
      margin: acc.margin,
      freeMargin: acc.freeMargin,
      marginLevel: acc.marginLevel ?? Infinity,
      currency: acc.currency,
      leverage: acc.leverage,
      initialBalance: this.initialDeposit > 0 ? this.initialDeposit : acc.balance,
      highWaterMark: this.highWaterMark,
    };
  }
}
