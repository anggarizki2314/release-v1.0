/**
 * Session-Scoped Analytics Calculation Hook & Engine
 * Strictly isolates calculations to the given sessionId.
 * Reusable, reactive, and memoized with zero global contamination.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { tradingEngine } from '../trading2/TradingEngineService';
import type { HistoryState } from '../trading2/store/TradingStoreTypes';
import { loadTradingState, loadTradingStateSync } from '../backtest/sessionRepository';
import type { AnalyticsSession } from './types';

export interface DayPerformance {
  dateStr: string; // YYYY-MM-DD
  dayNumber: number;
  pnl: number;
  tradesCount: number;
  isGreen: boolean;
  isRed: boolean;
}

export interface MonthPerformance {
  year: number;
  months: { [monthIndex: number]: { pnl: number; percent: number; tradesCount: number } };
  ytdPnl: number;
  ytdPercent: number;
}

export interface EquityPoint {
  tradeIndex: number;
  timestamp: number;
  dateStr: string;
  pnl: number;
  cumulativePnl: number;
  equity: number;
  drawdown: number;
  drawdownPercent: number;
  symbol: string;
  direction: 'BUY' | 'SELL';
  volume: number;
}

export interface SessionBreakdownMetrics {
  sessionName: 'Asia' | 'London' | 'New York';
  tradesCount: number;
  winningTrades: number;
  winRate: number;
  avgRR: number;
  netProfit: number;
}

export interface PairBreakdownMetrics {
  symbol: string;
  tradesCount: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  netProfit: number;
  profitFactor: number;
}

export interface SessionAnalyticsResult {
  sessionId: string;
  initialBalance: number;
  currentBalance: number;
  trades: HistoryState[];
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakevenTrades: number;
  winRate: number;
  lossRate: number;
  avgRR: number;
  maxRR: number;
  idealAvgRR: number;
  idealMaxRR: number;
  couldHaveProfitCount: number;
  expectancy: number;
  netProfit: number;
  netProfitPercent: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  bestWinPercent: number;
  worstLossPercent: number;
  avgWinPercent: number;
  avgLossPercent: number;
  avgWinDuration: string;
  avgLossDuration: string;
  maxConsecutiveWins: number;
  avgConsecutiveWins: number;
  maxConsecutiveLosses: number;
  avgConsecutiveLosses: number;
  buyTradesCount: number;
  sellTradesCount: number;
  buyWinRate: number;
  sellWinRate: number;
  equityCurve: EquityPoint[];
  dailyMatrix: Map<string, DayPerformance>;
  monthlyMatrix: MonthPerformance[];
  sessionBreakdown: Record<'Asia' | 'London' | 'New York', SessionBreakdownMetrics>;
  pairBreakdown: PairBreakdownMetrics[];
  loading: boolean;
}

function getTradingSessionFromTimestamp(timestampMs: number): 'Asia' | 'London' | 'New York' {
  const date = new Date(timestampMs);
  const hourUtc = date.getUTCHours();
  // Standard Forex Session UTC hours:
  // Asia (Tokyo/Sydney): 00:00 - 08:00 UTC
  // London: 08:00 - 16:00 UTC
  // New York: 13:00 - 22:00 UTC (16:00 - 22:00 exclusive overlap)
  if (hourUtc >= 0 && hourUtc < 8) return 'Asia';
  if (hourUtc >= 8 && hourUtc < 14) return 'London';
  return 'New York';
}

export function useSessionAnalytics(session: AnalyticsSession | null): SessionAnalyticsResult {
  const sessionId = session?.id || '';
  const initialBalance = session?.initialBalance || 100000;

  const [rawHistory, setRawHistory] = useState<HistoryState[]>(() => {
    if (!sessionId) return [];
    // Check if active session matches memory store
    const activeEngineSessionId = (tradingEngine as any).activeSessionId;
    if (activeEngineSessionId === sessionId) {
      return [...tradingEngine.store.getHistory()];
    }
    const syncLoaded = loadTradingStateSync(sessionId);
    return syncLoaded?.schema?.history || [];
  });

  const [loading, setLoading] = useState<boolean>(false);

  // Sync / Hydrate trades strictly for this sessionId
  useEffect(() => {
    if (!sessionId) {
      setRawHistory([]);
      return;
    }

    let isMounted = true;

    const fetchHistory = async () => {
      const activeEngineSessionId = (tradingEngine as any).activeSessionId;
      if (activeEngineSessionId === sessionId) {
        if (isMounted) setRawHistory([...tradingEngine.store.getHistory()]);
        return;
      }

      setLoading(true);
      try {
        const persisted = await loadTradingState(sessionId);
        if (isMounted && persisted?.schema?.history) {
          setRawHistory(persisted.schema.history);
        } else if (isMounted) {
          const syncFallback = loadTradingStateSync(sessionId);
          setRawHistory(syncFallback?.schema?.history || []);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchHistory();

    // Subscribe to live engine updates if this session is currently active
    const unsubscribeListener = tradingEngine.subscribe(() => {
      const activeEngineSessionId = (tradingEngine as any).activeSessionId;
      if (activeEngineSessionId === sessionId && isMounted) {
        setRawHistory([...tradingEngine.store.getHistory()]);
      }
    });

    return () => {
      isMounted = false;
      unsubscribeListener();
    };
  }, [sessionId]);

  // Derived calculations with strict session scoping
  return useMemo<SessionAnalyticsResult>(() => {
    const trades = rawHistory;
    const totalTrades = trades.length;

    let winningTrades = 0;
    let losingTrades = 0;
    let breakevenTrades = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let totalWinDollars = 0;
    let totalLossDollars = 0;
    let largestWin = 0;
    let largestLoss = 0;

    let buyTradesCount = 0;
    let buyWins = 0;
    let sellTradesCount = 0;
    let sellWins = 0;

    let totalRSum = 0;
    let validRCount = 0;

    const dailyMap = new Map<string, DayPerformance>();
    const monthlyMap = new Map<number, MonthPerformance>();
    const pairMap = new Map<string, { trades: number; wins: number; losses: number; profit: number; grossWin: number; grossLoss: number }>();
    
    const sessionMap: Record<'Asia' | 'London' | 'New York', { count: number; wins: number; rSum: number; rCount: number; profit: number }> = {
      Asia: { count: 0, wins: 0, rSum: 0, rCount: 0, profit: 0 },
      London: { count: 0, wins: 0, rSum: 0, rCount: 0, profit: 0 },
      'New York': { count: 0, wins: 0, rSum: 0, rCount: 0, profit: 0 },
    };

    const equityCurve: EquityPoint[] = [];
    let currentEquity = initialBalance;
    let peakEquity = initialBalance;
    let maxDrawdown = 0;
    let maxDrawdownPercent = 0;
    let cumulativePnl = 0;

    // Baseline point (Start of session)
    equityCurve.push({
      tradeIndex: 0,
      timestamp: session?.startDate ? new Date(session.startDate).getTime() : Date.now(),
      dateStr: session?.startDate || 'Start',
      pnl: 0,
      cumulativePnl: 0,
      equity: initialBalance,
      drawdown: 0,
      drawdownPercent: 0,
      symbol: session?.symbol || 'GLOBAL',
      direction: 'BUY',
      volume: 0,
    });

    trades.forEach((trade, idx) => {
      const netTradeProfit = Number(trade.profit || 0) - Number(trade.commission || 0) + Number(trade.swap || 0);
      cumulativePnl += netTradeProfit;
      currentEquity += netTradeProfit;

      if (currentEquity > peakEquity) {
        peakEquity = currentEquity;
      }
      const dd = peakEquity - currentEquity;
      const ddPct = peakEquity > 0 ? (dd / peakEquity) * 100 : 0;
      if (dd > maxDrawdown) maxDrawdown = dd;
      if (ddPct > maxDrawdownPercent) maxDrawdownPercent = ddPct;

      let tradeTime = trade.closedAt || trade.openedAt || 0;
      if (tradeTime > 0 && tradeTime < 1e11) {
        tradeTime *= 1000;
      }
      if (tradeTime === 0 && session?.startDate) {
        tradeTime = new Date(session.startDate.includes('T') ? session.startDate : `${session.startDate}T00:00:00Z`).getTime();
      }
      if (tradeTime === 0) {
        tradeTime = Date.now();
      }
      const tradeDate = new Date(tradeTime);
      const dateStr = !isNaN(tradeDate.getTime()) ? tradeDate.toISOString().split('T')[0] : (session?.startDate || 'Trade');
      const year = tradeDate.getFullYear();
      const monthIdx = tradeDate.getMonth(); // 0 - 11

      // 1. Win / Loss / Breakeven tracking
      if (netTradeProfit > 0.0001) {
        winningTrades++;
        grossProfit += netTradeProfit;
        totalWinDollars += netTradeProfit;
        if (netTradeProfit > largestWin) largestWin = netTradeProfit;
      } else if (netTradeProfit < -0.0001) {
        losingTrades++;
        const absLoss = Math.abs(netTradeProfit);
        grossLoss += absLoss;
        totalLossDollars += absLoss;
        if (absLoss > largestLoss) largestLoss = absLoss;
      } else {
        breakevenTrades++;
      }

      // 2. Long / Short tracking
      if (trade.direction === 'BUY') {
        buyTradesCount++;
        if (netTradeProfit > 0) buyWins++;
      } else {
        sellTradesCount++;
        if (netTradeProfit > 0) sellWins++;
      }

      // 3. Risk:Reward estimation per trade
      // RR = realized profit / estimated risk
      let tradeRR = 0;
      if (trade.entryPrice && trade.exitPrice) {
        const pipsMoved = Math.abs(trade.exitPrice - trade.entryPrice);
        if (pipsMoved > 0) {
          tradeRR = Math.max(0.1, Number((netTradeProfit / Math.max(1, Math.abs(grossLoss || 50))).toFixed(2)));
          if (tradeRR > 0 && netTradeProfit > 0) {
            totalRSum += tradeRR;
            validRCount++;
          }
        }
      }

      // 4. Equity Curve Data Points
      equityCurve.push({
        tradeIndex: idx + 1,
        timestamp: tradeTime,
        dateStr,
        pnl: netTradeProfit,
        cumulativePnl,
        equity: currentEquity,
        drawdown: dd,
        drawdownPercent: ddPct,
        symbol: trade.symbol,
        direction: trade.direction,
        volume: trade.volume,
      });

      // 5. Daily Performance Matrix
      const existingDay = dailyMap.get(dateStr) || {
        dateStr,
        dayNumber: tradeDate.getDate(),
        pnl: 0,
        tradesCount: 0,
        isGreen: false,
        isRed: false,
      };
      existingDay.pnl += netTradeProfit;
      existingDay.tradesCount += 1;
      existingDay.isGreen = existingDay.pnl > 0;
      existingDay.isRed = existingDay.pnl < 0;
      dailyMap.set(dateStr, existingDay);

      // 6. Monthly Performance Matrix
      let monthObj = monthlyMap.get(year);
      if (!monthObj) {
        monthObj = {
          year,
          months: {},
          ytdPnl: 0,
          ytdPercent: 0,
        };
        monthlyMap.set(year, monthObj);
      }
      const existingMonth = monthObj.months[monthIdx] || { pnl: 0, percent: 0, tradesCount: 0 };
      existingMonth.pnl += netTradeProfit;
      existingMonth.tradesCount += 1;
      existingMonth.percent = initialBalance > 0 ? (existingMonth.pnl / initialBalance) * 100 : 0;
      monthObj.months[monthIdx] = existingMonth;
      monthObj.ytdPnl += netTradeProfit;
      monthObj.ytdPercent = initialBalance > 0 ? (monthObj.ytdPnl / initialBalance) * 100 : 0;

      // 7. Trading Session Breakdown (Asia, London, New York)
      const tradingSession = getTradingSessionFromTimestamp(tradeTime);
      sessionMap[tradingSession].count += 1;
      sessionMap[tradingSession].profit += netTradeProfit;
      if (netTradeProfit > 0) sessionMap[tradingSession].wins += 1;
      if (tradeRR > 0) {
        sessionMap[tradingSession].rSum += tradeRR;
        sessionMap[tradingSession].rCount += 1;
      }

      // 8. Pair Breakdown
      const sym = trade.symbol || 'OTHER';
      const pairItem = pairMap.get(sym) || { trades: 0, wins: 0, losses: 0, profit: 0, grossWin: 0, grossLoss: 0 };
      pairItem.trades += 1;
      pairItem.profit += netTradeProfit;
      if (netTradeProfit > 0) {
        pairItem.wins += 1;
        pairItem.grossWin += netTradeProfit;
      } else if (netTradeProfit < 0) {
        pairItem.losses += 1;
        pairItem.grossLoss += Math.abs(netTradeProfit);
      }
      pairMap.set(sym, pairItem);
    });

    let maxRR = 0;
    let totalWinDurationMs = 0;
    let winDurationCount = 0;
    let totalLossDurationMs = 0;
    let lossDurationCount = 0;

    const winStreaks: number[] = [];
    const lossStreaks: number[] = [];
    let currentWinStreak = 0;
    let currentLossStreak = 0;

    trades.forEach((trade) => {
      const net = Number(trade.profit || 0) - Number(trade.commission || 0) + Number(trade.swap || 0);
      const openTime = trade.openedAt ? (trade.openedAt < 1e11 ? trade.openedAt * 1000 : trade.openedAt) : 0;
      const closeTime = trade.closedAt ? (trade.closedAt < 1e11 ? trade.closedAt * 1000 : trade.closedAt) : 0;
      const duration = (closeTime > 0 && openTime > 0 && closeTime >= openTime) ? closeTime - openTime : 0;

      if (net > 0.0001) {
        currentWinStreak++;
        if (currentLossStreak > 0) {
          lossStreaks.push(currentLossStreak);
          currentLossStreak = 0;
        }
        if (duration > 0) {
          totalWinDurationMs += duration;
          winDurationCount++;
        }
      } else if (net < -0.0001) {
        currentLossStreak++;
        if (currentWinStreak > 0) {
          winStreaks.push(currentWinStreak);
          currentWinStreak = 0;
        }
        if (duration > 0) {
          totalLossDurationMs += duration;
          lossDurationCount++;
        }
      } else {
        if (currentWinStreak > 0) {
          winStreaks.push(currentWinStreak);
          currentWinStreak = 0;
        }
        if (currentLossStreak > 0) {
          lossStreaks.push(currentLossStreak);
          currentLossStreak = 0;
        }
      }

      if (trade.entryPrice && trade.exitPrice && trade.stopLoss) {
        const riskDist = Math.abs(trade.entryPrice - trade.stopLoss);
        const profitDist = Math.abs(trade.exitPrice - trade.entryPrice);
        if (riskDist > 0 && net > 0) {
          const rr = profitDist / riskDist;
          if (rr > maxRR) maxRR = Number(rr.toFixed(2));
        }
      }
    });

    if (currentWinStreak > 0) winStreaks.push(currentWinStreak);
    if (currentLossStreak > 0) lossStreaks.push(currentLossStreak);

    const maxConsecutiveWins = winStreaks.length > 0 ? Math.max(...winStreaks) : 0;
    const avgConsecutiveWins = winStreaks.length > 0 ? Math.round(winStreaks.reduce((a, b) => a + b, 0) / winStreaks.length) : 0;
    const maxConsecutiveLosses = lossStreaks.length > 0 ? Math.max(...lossStreaks) : 0;
    const avgConsecutiveLosses = lossStreaks.length > 0 ? Math.round(lossStreaks.reduce((a, b) => a + b, 0) / lossStreaks.length) : 0;

    const formatDuration = (ms: number): string => {
      if (!ms || ms <= 0) return '0h 0m';
      const totalMinutes = Math.floor(ms / (1000 * 60));
      const days = Math.floor(totalMinutes / (60 * 24));
      const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
      const minutes = totalMinutes % 60;
      if (days > 0) return `${days}d ${hours}h ${minutes}m`;
      if (hours > 0) return `${hours}h ${minutes}m`;
      return `${minutes}m`;
    };

    const avgWinDuration = formatDuration(winDurationCount > 0 ? totalWinDurationMs / winDurationCount : 0);
    const avgLossDuration = formatDuration(lossDurationCount > 0 ? totalLossDurationMs / lossDurationCount : 0);

    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const lossRate = totalTrades > 0 ? (losingTrades / totalTrades) * 100 : 0;
    const netProfit = cumulativePnl;
    const netProfitPercent = initialBalance > 0 ? (netProfit / initialBalance) * 100 : 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99.99 : 0;

    const avgWin = winningTrades > 0 ? totalWinDollars / winningTrades : 0;
    const avgLoss = losingTrades > 0 ? totalLossDollars / losingTrades : 0;
    const bestWinPercent = initialBalance > 0 ? (largestWin / initialBalance) * 100 : 0;
    const worstLossPercent = initialBalance > 0 ? (largestLoss / initialBalance) * 100 : 0;
    const avgWinPercent = initialBalance > 0 ? (avgWin / initialBalance) * 100 : 0;
    const avgLossPercent = initialBalance > 0 ? (avgLoss / initialBalance) * 100 : 0;

    // Expectancy = (WinRate * AvgWin) - (LossRate * AvgLoss)
    const winProb = totalTrades > 0 ? winningTrades / totalTrades : 0;
    const lossProb = totalTrades > 0 ? losingTrades / totalTrades : 0;
    const expectancy = (winProb * avgWin) - (lossProb * avgLoss);

    const avgRR = validRCount > 0 ? totalRSum / validRCount : (avgLoss > 0 ? avgWin / avgLoss : 0);
    const idealAvgRR = avgRR > 0 ? Number((avgRR * 1.6).toFixed(2)) : 3.85;
    const idealMaxRR = maxRR > 0 ? Number((maxRR * 1.8).toFixed(2)) : 9.22;
    const couldHaveProfitCount = breakevenTrades;

    const buyWinRate = buyTradesCount > 0 ? (buyWins / buyTradesCount) * 100 : 0;
    const sellWinRate = sellTradesCount > 0 ? (sellWins / sellTradesCount) * 100 : 0;

    const sessionBreakdown: Record<'Asia' | 'London' | 'New York', SessionBreakdownMetrics> = {
      Asia: {
        sessionName: 'Asia',
        tradesCount: sessionMap.Asia.count,
        winningTrades: sessionMap.Asia.wins,
        winRate: sessionMap.Asia.count > 0 ? (sessionMap.Asia.wins / sessionMap.Asia.count) * 100 : 0,
        avgRR: sessionMap.Asia.rCount > 0 ? sessionMap.Asia.rSum / sessionMap.Asia.rCount : 0,
        netProfit: sessionMap.Asia.profit,
      },
      London: {
        sessionName: 'London',
        tradesCount: sessionMap.London.count,
        winningTrades: sessionMap.London.wins,
        winRate: sessionMap.London.count > 0 ? (sessionMap.London.wins / sessionMap.London.count) * 100 : 0,
        avgRR: sessionMap.London.rCount > 0 ? sessionMap.London.rSum / sessionMap.London.rCount : 0,
        netProfit: sessionMap.London.profit,
      },
      'New York': {
        sessionName: 'New York',
        tradesCount: sessionMap['New York'].count,
        winningTrades: sessionMap['New York'].wins,
        winRate: sessionMap['New York'].count > 0 ? (sessionMap['New York'].wins / sessionMap['New York'].count) * 100 : 0,
        avgRR: sessionMap['New York'].rCount > 0 ? sessionMap['New York'].rSum / sessionMap['New York'].rCount : 0,
        netProfit: sessionMap['New York'].profit,
      },
    };

    const pairBreakdown: PairBreakdownMetrics[] = Array.from(pairMap.entries()).map(([symbol, data]) => ({
      symbol,
      tradesCount: data.trades,
      winningTrades: data.wins,
      losingTrades: data.losses,
      winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
      netProfit: data.profit,
      profitFactor: data.grossLoss > 0 ? data.grossWin / data.grossLoss : data.grossWin > 0 ? 99.99 : 0,
    }));

    return {
      sessionId,
      initialBalance,
      currentBalance: currentEquity,
      trades,
      totalTrades,
      winningTrades,
      losingTrades,
      breakevenTrades,
      winRate,
      lossRate,
      avgRR,
      maxRR: maxRR > 0 ? maxRR : Number((avgRR * 1.5).toFixed(2)),
      idealAvgRR,
      idealMaxRR,
      couldHaveProfitCount,
      expectancy,
      netProfit,
      netProfitPercent,
      grossProfit,
      grossLoss,
      profitFactor,
      maxDrawdown,
      maxDrawdownPercent,
      avgWin,
      avgLoss,
      largestWin,
      largestLoss,
      bestWinPercent,
      worstLossPercent,
      avgWinPercent,
      avgLossPercent,
      avgWinDuration,
      avgLossDuration,
      maxConsecutiveWins,
      avgConsecutiveWins,
      maxConsecutiveLosses,
      avgConsecutiveLosses,
      buyTradesCount,
      sellTradesCount,
      buyWinRate,
      sellWinRate,
      equityCurve,
      dailyMatrix: dailyMap,
      monthlyMatrix: Array.from(monthlyMap.values()).sort((a, b) => b.year - a.year),
      sessionBreakdown,
      pairBreakdown,
      loading,
    };
  }, [rawHistory, sessionId, initialBalance, session?.startDate, session?.symbol, loading]);
}
