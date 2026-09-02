import type { AnalyticsSession } from '../../analytics/types';
import { loadTradingStateSync } from '../../backtest/sessionRepository';

export interface ComputedSessionMetrics {
  curBal: number;
  initialBal: number;
  netPnl: number;
  netPnlPct: number;
  winRate: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  profitFactor: number;
  maxDrawdownPct: number;
  avgRR: number;
  equityPoints: number[];
  isPos: boolean;
}

export function getSessionMetrics(session?: AnalyticsSession | null): ComputedSessionMetrics {
  if (!session) {
    return {
      curBal: 100000,
      initialBal: 100000,
      netPnl: 0,
      netPnlPct: 0,
      winRate: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      profitFactor: 0,
      maxDrawdownPct: 0,
      avgRR: 0,
      equityPoints: [100000, 100000],
      isPos: true,
    };
  }

  const initialBal = session.initialBalance ?? 100000;
  let curBal = session.currentBalance ?? initialBal;
  let netPnl = session.netProfit ?? 0;
  let netPnlPct = session.netProfitPercent ?? 0;
  let winRate = session.winRate ?? 0;
  let totalTrades = session.totalTrades ?? 0;
  let winningTrades = session.winningTrades ?? 0;
  let losingTrades = session.losingTrades ?? 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let peakEquity = initialBal;
  let maxDrawdownVal = 0;
  let maxDrawdownPct = 0;

  const equityPoints: number[] = [initialBal];

  const sync = loadTradingStateSync(session.id);
  if (sync?.schema?.history && Array.isArray(sync.schema.history) && sync.schema.history.length > 0) {
    const history = sync.schema.history;
    totalTrades = history.length;
    let pnlSum = 0;
    let runningEquity = initialBal;
    winningTrades = 0;
    losingTrades = 0;

    history.forEach((h: any) => {
      const p = Number(h.profit || 0) - Number(h.commission || 0) + Number(h.swap || 0);
      pnlSum += p;
      runningEquity += p;
      equityPoints.push(runningEquity);

      if (runningEquity > peakEquity) {
        peakEquity = runningEquity;
      }
      const dd = peakEquity - runningEquity;
      if (dd > maxDrawdownVal) {
        maxDrawdownVal = dd;
        maxDrawdownPct = peakEquity > 0 ? (dd / peakEquity) * 100 : 0;
      }

      if (p > 0) {
        winningTrades++;
        grossProfit += p;
      } else if (p < 0) {
        losingTrades++;
        grossLoss += Math.abs(p);
      }
    });

    winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    netPnl = pnlSum;
    curBal = initialBal + pnlSum;
    netPnlPct = initialBal > 0 ? (pnlSum / initialBal) * 100 : 0;
  } else if (sync?.schema?.balance !== undefined) {
    curBal = sync.schema.balance;
    netPnl = curBal - initialBal;
    netPnlPct = initialBal > 0 ? (netPnl / initialBal) * 100 : 0;
    equityPoints.push(curBal);
  }

  const profitFactor = grossLoss > 0
    ? (grossProfit / grossLoss)
    : grossProfit > 0
    ? grossProfit
    : 0;

  const avgRR = losingTrades > 0 && winningTrades > 0
    ? (grossProfit / winningTrades) / (grossLoss / losingTrades)
    : 0;

  return {
    curBal,
    initialBal,
    netPnl,
    netPnlPct,
    winRate,
    totalTrades,
    winningTrades,
    losingTrades,
    profitFactor,
    maxDrawdownPct,
    avgRR,
    equityPoints: equityPoints.length > 1 ? equityPoints : [initialBal, curBal],
    isPos: netPnl >= 0,
  };
}
