/**
 * Trading Engine 2.0 — HistoryManager
 * Archives closed trades and serves as data source for statistics calculation.
 */

import type { ClosedTrade } from '../types/models';
import type { TradingStore } from './TradingStore';

export interface HistorySummaryStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRatePercent: number;
  grossProfit: number;
  grossLoss: number;
  netProfit: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  avgRR: number;
}

export class HistoryManager {
  constructor(private store: TradingStore) {}

  /**
   * Retrieves all archived closed trades from store.
   */
  public getClosedTrades(): ReadonlyArray<ClosedTrade> {
    return this.store.getHistory();
  }

  /**
   * Filter trades by symbol.
   */
  public getTradesBySymbol(symbol: string): ClosedTrade[] {
    return this.store.getHistory().filter((t) => t.symbol === symbol);
  }

  /**
   * Calculates comprehensive performance statistics from trade history.
   */
  public calculateSummaryStats(): HistorySummaryStats {
    const trades = this.store.getHistory();
    const totalTrades = trades.length;

    if (totalTrades === 0) {
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRatePercent: 0,
        grossProfit: 0,
        grossLoss: 0,
        netProfit: 0,
        profitFactor: 0,
        avgWin: 0,
        avgLoss: 0,
        avgRR: 0,
      };
    }

    let winningTrades = 0;
    let losingTrades = 0;
    let grossProfit = 0;
    let grossLoss = 0;

    trades.forEach((t) => {
      if (t.realizedPnl > 0) {
        winningTrades++;
        grossProfit += t.realizedPnl;
      } else if (t.realizedPnl < 0) {
        losingTrades++;
        grossLoss += Math.abs(t.realizedPnl);
      }
    });

    const netProfit = grossProfit - grossLoss;
    const winRatePercent = (winningTrades / totalTrades) * 100;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? grossProfit : 0;
    const avgWin = winningTrades > 0 ? grossProfit / winningTrades : 0;
    const avgLoss = losingTrades > 0 ? grossLoss / losingTrades : 0;
    const avgRR = avgLoss > 0 ? avgWin / avgLoss : 0;

    return {
      totalTrades,
      winningTrades,
      losingTrades,
      winRatePercent: Math.round(winRatePercent * 100) / 100,
      grossProfit: Math.round(grossProfit * 100) / 100,
      grossLoss: Math.round(grossLoss * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
      profitFactor: Math.round(profitFactor * 100) / 100,
      avgWin: Math.round(avgWin * 100) / 100,
      avgLoss: Math.round(avgLoss * 100) / 100,
      avgRR: Math.round(avgRR * 100) / 100,
    };
  }
}
