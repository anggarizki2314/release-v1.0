export interface AnalyticsSession {
  id: string;
  name: string;
  symbol: string;
  symbols?: string[];
  timeframe: string;
  dateRange: string;
  mode: 'normal' | 'challenge';
  status: 'active' | 'passed' | 'failed' | 'completed';
  initialBalance: number;
  currentBalance: number;
  netProfit: number;
  netProfitPercent: number;
  winRate: number;
  totalTrades: number;
  profitFactor: number;
  expectancy: number;
  lastPlayed: string;
  winningTrades: number;
  losingTrades: number;
  avgRR: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  startDate?: string;
  endDate?: string;
  currentReplayIndex?: number | null;
  currentReplayTime?: number | null;
  replayStartTime?: number | null;
  updatedAt?: number;
  challengeRules?: {
    dailyLossPercent: number;
    maxLossPercent: number;
    profitTargetPercent: number;
    minimumTradingDays: number;
  };
  challengeStatus?: {
    dailyLossCurrent: number;
    dailyLossLimit: number;
    maxLossCurrent: number;
    maxLossLimit: number;
    targetCurrent: number;
    targetLimit: number;
    minimumTradingDays?: number;
    currentTradingDays?: number;
  };
}

export interface MonthlyReturn {
  month: string;
  year: number;
  tradesCount: number;
  winRate: number;
  pnlDollar: number;
  pnlPercent: number;
}

export interface TradeJournalEntry {
  id: string;
  entryTime: string;
  exitTime: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  lotSize: number;
  entryPrice: number;
  exitPrice: number;
  pnlDollar: number;
  pnlPercent: number;
  rr: number;
  duration: string;
  comment: string;
}
