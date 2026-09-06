/**
 * Trading Engine 2.0 — HistoryManager
 * Business layer responsible for archiving closed trades into TradingStore.
 * Integrates strictly with TradingStore.
 * Zero UI, React, Chart, or Replay dependencies.
 */

import type { TradingStore } from '../store/TradingStore';
import type { ClosedTradeModel, TradeHistorySummary } from './HistoryTypes';
import type { HistoryState } from '../store/TradingStoreTypes';

export class HistoryManager {
  private store: TradingStore;
  private idCounter: number = 1;

  constructor(store: TradingStore) {
    this.store = store;
  }

  /**
   * Archives a closed trade record into TradingStore.
   */
  public addHistory(trade: ClosedTradeModel): void {
    const historyState: HistoryState = {
      tradeId: trade.tradeId || `TRD-${Date.now()}-${this.idCounter++}`,
      positionId: trade.positionId,
      symbol: trade.symbol,
      direction: trade.direction,
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice,
      stopLoss: trade.stopLoss ?? null,
      takeProfit: trade.takeProfit ?? null,
      volume: trade.volume,
      profit: trade.realizedPnL,
      commission: trade.commission,
      swap: trade.swap,
      openedAt: trade.openedAt,
      closedAt: trade.closedAt,
      comment: trade.comment,
      closeReason: trade.closeReason ?? 'MANUAL',
      screenshots: trade.screenshots,
    };

    this.store.addHistory(historyState);
  }

  /**
   * Retrieves all archived closed trades.
   */
  public getHistory(): ReadonlyArray<HistoryState> {
    return this.store.getHistory();
  }

  /**
   * Computes summary performance statistics.
   */
  public getSummaryStats(): TradeHistorySummary {
    const history = this.store.getHistory();
    const totalTrades = history.length;

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
      };
    }

    let winningTrades = 0;
    let losingTrades = 0;
    let grossProfit = 0;
    let grossLoss = 0;

    history.forEach((h) => {
      if (h.profit > 0) {
        winningTrades++;
        grossProfit += h.profit;
      } else if (h.profit < 0) {
        losingTrades++;
        grossLoss += Math.abs(h.profit);
      }
    });

    const netProfit = grossProfit - grossLoss;
    const winRatePercent = (winningTrades / totalTrades) * 100;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit;

    return {
      totalTrades,
      winningTrades,
      losingTrades,
      winRatePercent: Math.round(winRatePercent * 100) / 100,
      grossProfit: Math.round(grossProfit * 100) / 100,
      grossLoss: Math.round(grossLoss * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
      profitFactor: Math.round(profitFactor * 100) / 100,
    };
  }

  public reset(): void {
    // History is cleared when TradingStore is reset
  }
}
