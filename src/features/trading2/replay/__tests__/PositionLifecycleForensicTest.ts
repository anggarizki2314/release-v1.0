/**
 * FORENSIC DIAGNOSTIC TEST — POSITION LIFECYCLE AUDIT
 * Traces exact position lifecycle from creation to TP/SL closure to store state to UI selectors.
 */

import { TradingEngineService } from '../../TradingEngineService';

export function runPositionLifecycleForensicTest(): {
  positionId: string;
  openPositionsBefore: number;
  openPositionsAfter: number;
  historyTradesCountAfter: number;
  foundInOpen: boolean;
  foundInHistory: boolean;
  logs: string[];
} {
  const logs: string[] = [];
  const engineService = TradingEngineService.getInstance();
  engineService.initializeSession({ initialBalance: 100000 });

  const t0 = 1704258000;

  // 1. PLACE ORDER & OPEN POSITION
  const pos = engineService.executionEngine.processMarketOrder(
    {
      symbol: 'GBPUSD',
      type: 'BUY_MARKET',
      volume: 1.0,
      entryPrice: 1.27000,
      stopLoss: 1.26500,
      takeProfit: 1.28000,
    },
    1.27000,
    t0
  );

  logs.push(`[POSITION-LIFECYCLE] ${JSON.stringify({
    positionId: pos.positionId,
    symbol: pos.symbol,
    status: pos.status,
    action: 'OPEN',
    replayTime: t0,
  })}`);

  const openBefore = engineService.getOpenPositions();
  const openCountBefore = openBefore.length;

  logs.push(`[POSITION-STORE-BEFORE-CLOSE] ${JSON.stringify({
    positionId: pos.positionId,
    openPositionsCount: openCountBefore,
    foundInOpen: openBefore.some((p) => p.positionId === pos.positionId),
  })}`);

  // 2. TP HIT & CLOSE POSITION
  engineService.processTick('GBPUSD', 1.27500, 1.28100, 1.27400, 1.28050, t0 + 60);

  logs.push(`[POSITION-TP-SL-CLOSE] ${JSON.stringify({
    positionId: pos.positionId,
    symbol: pos.symbol,
    reason: 'TP',
    closePrice: 1.28000,
    closeTime: t0 + 60,
  })}`);

  // 3. STORE STATE AFTER CLOSE
  const openAfter = engineService.getOpenPositions();
  const historyAfter = engineService.getTradeHistory();

  const foundInOpen = openAfter.some((p) => p.positionId === pos.positionId);
  const foundInHistory = historyAfter.some((h) => h.positionId === pos.positionId);

  logs.push(`[POSITION-STORE-AFTER-CLOSE] ${JSON.stringify({
    positionId: pos.positionId,
    openPositionsCount: openAfter.length,
    closedPositionsCount: historyAfter.length,
    positionStillInOpenPositions: foundInOpen,
    positionFoundInTradeHistory: foundInHistory,
  })}`);

  // 4. UI SOURCE SELECTORS
  logs.push(`[POSITION-UI-SOURCE] ${JSON.stringify({
    positionId: pos.positionId,
    sourceCollectionPositionsTab: 'TradingStore.getOpenPositions() [Filters status === OPEN]',
    sourceCollectionTradesTab: 'TradingStore.getHistory() [Stores closed trade records]',
    visibleInPositionsPanel: foundInOpen,
    visibleInTradesTab: foundInHistory,
  })}`);

  return {
    positionId: pos.positionId,
    openPositionsBefore: openCountBefore,
    openPositionsAfter: openAfter.length,
    historyTradesCountAfter: historyAfter.length,
    foundInOpen,
    foundInHistory,
    logs,
  };
}

if (require.main === module) {
  console.log('=== RUNNING POSITION LIFECYCLE FORENSIC AUDIT ===');
  const res = runPositionLifecycleForensicTest();
  for (const l of res.logs) {
    console.log(l);
  }
}
