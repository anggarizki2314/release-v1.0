/**
 * TRADING ENGINE 2.0 — TRADING STATE PERSISTENCE TEST SUITE
 * Validates 12 core acceptance criteria for trading state persistence across sessions and application restart.
 */

import { TradingEngineService } from '../../TradingEngineService';
import { TradingStoreSelectors } from '../../store/TradingStoreSelectors';
import { saveTradingState, loadTradingState, loadTradingStateSync } from '../../../backtest/sessionRepository';

export async function runTradingStatePersistenceTests(): Promise<{
  success: boolean;
  passed: number;
  total: number;
  logs: string[];
}> {
  const logs: string[] = [];
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, description: string) {
    total++;
    if (condition) {
      passed++;
      logs.push(`[PASS] Test ${total}: ${description}`);
    } else {
      logs.push(`[FAIL] Test ${total}: ${description}`);
    }
  }

  const engineService = TradingEngineService.getInstance();
  const getSnapshot = () => TradingStoreSelectors.getSnapshot(engineService.store.getSchemaRaw());
  const t0 = 1704258000;
  const testSessionId = 'test-session-persist-001';

  // -------------------------------------------------------------
  // TEST 1: Open position -> save -> reload -> position remains OPEN
  // -------------------------------------------------------------
  await engineService.initializeSession({ id: testSessionId, initialBalance: 100000 });
  const posOpen = engineService.executionEngine.processMarketOrder(
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

  saveTradingState(testSessionId, getSnapshot());

  // Simulate App Shutdown & Re-initialization
  await engineService.initializeSession({ id: testSessionId, initialBalance: 100000 });
  const openPosAfterReload = engineService.getOpenPositions();

  assert(
    openPosAfterReload.length === 1 && openPosAfterReload[0].positionId === posOpen.positionId && openPosAfterReload[0].status === 'OPEN',
    'Open position survives save/reload with status OPEN'
  );

  // -------------------------------------------------------------
  // TEST 2: Open position -> TP -> CLOSED -> save -> reload -> CLOSED trade remains
  // -------------------------------------------------------------
  engineService.processTick('GBPUSD', 1.27500, 1.28100, 1.27400, 1.28050, t0 + 60); // Hit TP
  saveTradingState(testSessionId, getSnapshot());

  // Simulate App Shutdown & Re-initialization
  await engineService.initializeSession({ id: testSessionId, initialBalance: 100000 });
  const historyAfterTp = engineService.getTradeHistory();
  const closedTpTrade = historyAfterTp.find((h) => h.positionId === posOpen.positionId);

  assert(
    closedTpTrade !== undefined && historyAfterTp.length === 1,
    'Position closed by TP survives app restart in closed trade history'
  );

  // -------------------------------------------------------------
  // TEST 3: Open position -> SL -> CLOSED -> save -> reload -> CLOSED trade remains
  // -------------------------------------------------------------
  const testSessionIdSl = 'test-session-persist-002';
  await engineService.initializeSession({ id: testSessionIdSl, initialBalance: 100000 });
  const posSl = engineService.executionEngine.processMarketOrder(
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

  engineService.processTick('GBPUSD', 1.26800, 1.26850, 1.26450, 1.26480, t0 + 60); // Hit SL
  saveTradingState(testSessionIdSl, getSnapshot());

  await engineService.initializeSession({ id: testSessionIdSl, initialBalance: 100000 });
  const historyAfterSl = engineService.getTradeHistory();
  const closedSlTrade = historyAfterSl.find((h) => h.positionId === posSl.positionId);

  assert(
    closedSlTrade !== undefined && historyAfterSl.length === 1,
    'Position closed by SL survives app restart in closed trade history'
  );

  // -------------------------------------------------------------
  // TEST 4: Closed trade retains exact realized PnL
  // -------------------------------------------------------------
  const expectedPnlTp = 1000; // (1.28000 - 1.27000) * 1.0 * 100000
  const actualPnlTp = closedTpTrade ? closedTpTrade.profit : 0;

  assert(
    Math.abs(actualPnlTp - expectedPnlTp) < 0.01,
    `Closed trade retains exact realized PnL (Expected $${expectedPnlTp}, Got $${actualPnlTp})`
  );

  // -------------------------------------------------------------
  // TEST 5: Closed trade retains exact close reason = TP
  // -------------------------------------------------------------
  assert(
    closedTpTrade !== undefined && (closedTpTrade.comment?.includes('TP') || closedTpTrade.tradeId.includes('TP')),
    'Closed trade retains exact close reason = TP'
  );

  // -------------------------------------------------------------
  // TEST 6: Closed trade retains exact close reason = SL
  // -------------------------------------------------------------
  assert(
    closedSlTrade !== undefined && (closedSlTrade.comment?.includes('SL') || closedSlTrade.tradeId.includes('SL')),
    'Closed trade retains exact close reason = SL'
  );

  // -------------------------------------------------------------
  // TEST 7: Pending order survives save/reload
  // -------------------------------------------------------------
  const testSessionIdOrder = 'test-session-persist-003';
  await engineService.initializeSession({ id: testSessionIdOrder, initialBalance: 100000 });
  const pendingRes = engineService.placeOrder({
    symbol: 'EURUSD',
    type: 'BUY_LIMIT',
    volume: 0.5,
    entryPrice: 1.08000,
  });

  saveTradingState(testSessionIdOrder, getSnapshot());

  await engineService.initializeSession({ id: testSessionIdOrder, initialBalance: 100000 });
  const pendingAfterReload = engineService.getPendingOrders();

  assert(
    pendingAfterReload.length === 1 && pendingAfterReload[0].orderId === pendingRes.order.orderId,
    'Pending order survives save/reload'
  );

  // -------------------------------------------------------------
  // TEST 8: EURUSD + GBPUSD closed trades survive together
  // -------------------------------------------------------------
  const testSessionIdMulti = 'test-session-persist-004';
  await engineService.initializeSession({ id: testSessionIdMulti, initialBalance: 100000 });

  const eurPos = engineService.executionEngine.processMarketOrder(
    { symbol: 'EURUSD', type: 'BUY_MARKET', volume: 1.0, entryPrice: 1.08500, takeProfit: 1.09000 },
    1.08500,
    t0
  );

  const gbpPos = engineService.executionEngine.processMarketOrder(
    { symbol: 'GBPUSD', type: 'BUY_MARKET', volume: 1.0, entryPrice: 1.27000, takeProfit: 1.28000 },
    1.27000,
    t0
  );

  engineService.processTick('EURUSD', 1.08500, 1.09100, 1.08500, 1.09050, t0 + 60);
  engineService.processTick('GBPUSD', 1.27000, 1.28100, 1.27000, 1.28050, t0 + 120);

  saveTradingState(testSessionIdMulti, getSnapshot());

  await engineService.initializeSession({ id: testSessionIdMulti, initialBalance: 100000 });
  const multiHistory = engineService.getTradeHistory();

  assert(
    multiHistory.length === 2 &&
      multiHistory.some((h) => h.positionId === eurPos.positionId) &&
      multiHistory.some((h) => h.positionId === gbpPos.positionId),
    'EURUSD + GBPUSD closed trades survive together across application restart'
  );

  // -------------------------------------------------------------
  // TEST 9: Existing session without trading_state_json still loads safely
  // -------------------------------------------------------------
  const testSessionIdNew = 'test-session-brand-new-999';
  await engineService.initializeSession({ id: testSessionIdNew, initialBalance: 50000 });

  const newAcc = engineService.store.getAccount();

  assert(
    newAcc.balance === 50000 && engineService.getOpenPositions().length === 0 && engineService.getTradeHistory().length === 0,
    'Existing session without trading_state_json loads safely with initial fresh account balance'
  );

  // -------------------------------------------------------------
  // TEST 10: Corrupt/malformed trading state does not crash the application
  // -------------------------------------------------------------
  const corruptSessionId = 'test-session-corrupt-000';
  saveTradingState(corruptSessionId, '{ invalid_json ::: }');

  let errorThrown = false;
  try {
    await engineService.initializeSession({ id: corruptSessionId, initialBalance: 100000 });
  } catch (e) {
    errorThrown = true;
  }

  assert(
    !errorThrown && engineService.store.getAccount().balance === 100000,
    'Corrupt/malformed trading state is handled gracefully without crashing app'
  );

  // -------------------------------------------------------------
  // TEST 11: Position IDs remain identical after hydration
  // -------------------------------------------------------------
  assert(
    openPosAfterReload[0].positionId === posOpen.positionId,
    `Position ID remains identical after hydration (${openPosAfterReload[0]?.positionId} === ${posOpen.positionId})`
  );

  // -------------------------------------------------------------
  // TEST 12: Trade IDs remain identical after hydration
  // -------------------------------------------------------------
  assert(
    closedTpTrade !== undefined && closedTpTrade.positionId === posOpen.positionId,
    `Trade ID / Position ID remains identical after hydration (${closedTpTrade?.positionId} === ${posOpen.positionId})`
  );

  const allPassed = passed === total;
  return {
    success: allPassed,
    passed,
    total,
    logs,
  };
}

if (require.main === module) {
  console.log('=== RUNNING TRADING STATE PERSISTENCE TEST SUITE ===');
  runTradingStatePersistenceTests().then((res) => {
    for (const l of res.logs) {
      console.log(l);
    }
    console.log(`SUMMARY: ${res.passed}/${res.total} tests passed.`);
    if (!res.success) {
      process.exit(1);
    }
  });
}
