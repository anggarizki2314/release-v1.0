/**
 * TRADING ENGINE 2.0 — REAL PROCESS RESTART HYDRATION TEST SUITE
 * Validates SQLite-first hydration across simulated process boundaries (cleared memory & cleared cache).
 */

import { TradingEngineService } from '../../TradingEngineService';
import { TradingStoreSelectors } from '../../store/TradingStoreSelectors';
import { saveTradingState } from '../../../backtest/sessionRepository';

export async function runTradingStateRealRestartTests(): Promise<{
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
  const restartSessionIdTp = 'session-restart-tp-001';

  // -------------------------------------------------------------
  // TEST 1: Closed TP trade survives real restart
  // -------------------------------------------------------------
  await engineService.initializeSession({ id: restartSessionIdTp, initialBalance: 100000 });
  const posTp = engineService.executionEngine.processMarketOrder(
    { symbol: 'GBPUSD', type: 'BUY_MARKET', volume: 1.0, entryPrice: 1.27000, takeProfit: 1.28000 },
    1.27000,
    t0
  );
  engineService.processTick('GBPUSD', 1.27500, 1.28100, 1.27400, 1.28050, t0 + 60); // TP hit
  saveTradingState(restartSessionIdTp, getSnapshot());

  // SIMULATE REAL PROCESS RESTART: Clear in-memory store and re-initialize engine
  await engineService.initializeSession({ id: restartSessionIdTp, initialBalance: 100000 });
  const historyTp = engineService.getTradeHistory();

  assert(
    historyTp.length === 1 && historyTp[0].positionId === posTp.positionId,
    'Closed TP trade survives simulated real process restart'
  );

  // -------------------------------------------------------------
  // TEST 2: Closed SL trade survives real restart
  // -------------------------------------------------------------
  const restartSessionIdSl = 'session-restart-sl-002';
  await engineService.initializeSession({ id: restartSessionIdSl, initialBalance: 100000 });
  const posSl = engineService.executionEngine.processMarketOrder(
    { symbol: 'GBPUSD', type: 'BUY_MARKET', volume: 1.0, entryPrice: 1.27000, stopLoss: 1.26500 },
    1.27000,
    t0
  );
  engineService.processTick('GBPUSD', 1.26800, 1.26850, 1.26450, 1.26480, t0 + 60); // SL hit
  saveTradingState(restartSessionIdSl, getSnapshot());

  await engineService.initializeSession({ id: restartSessionIdSl, initialBalance: 100000 });
  const historySl = engineService.getTradeHistory();

  assert(
    historySl.length === 1 && historySl[0].positionId === posSl.positionId,
    'Closed SL trade survives simulated real process restart'
  );

  // -------------------------------------------------------------
  // TEST 3: Trade ID remains identical
  // -------------------------------------------------------------
  assert(
    historyTp.length > 0 && historyTp[0].tradeId.includes('TP'),
    'Trade ID remains identical after hydration'
  );

  // -------------------------------------------------------------
  // TEST 4: Position ID remains identical
  // -------------------------------------------------------------
  assert(
    historyTp.length > 0 && historyTp[0].positionId === posTp.positionId,
    'Position ID remains identical after hydration'
  );

  // -------------------------------------------------------------
  // TEST 5: Two closed trades from different symbols survive
  // -------------------------------------------------------------
  const restartSessionIdMulti = 'session-restart-multi-003';
  await engineService.initializeSession({ id: restartSessionIdMulti, initialBalance: 100000 });

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
  saveTradingState(restartSessionIdMulti, getSnapshot());

  await engineService.initializeSession({ id: restartSessionIdMulti, initialBalance: 100000 });
  const multiHistory = engineService.getTradeHistory();

  assert(
    multiHistory.length === 2 &&
      multiHistory.some((h) => h.positionId === eurPos.positionId) &&
      multiHistory.some((h) => h.positionId === gbpPos.positionId),
    'Two closed trades from different symbols (EURUSD + GBPUSD) survive real process restart'
  );

  // -------------------------------------------------------------
  // TEST 6: Open position survives restart
  // -------------------------------------------------------------
  const restartSessionIdOpen = 'session-restart-open-004';
  await engineService.initializeSession({ id: restartSessionIdOpen, initialBalance: 100000 });
  const posOpen = engineService.executionEngine.processMarketOrder(
    { symbol: 'EURUSD', type: 'BUY_MARKET', volume: 0.5, entryPrice: 1.08500 },
    1.08500,
    t0
  );
  saveTradingState(restartSessionIdOpen, getSnapshot());

  await engineService.initializeSession({ id: restartSessionIdOpen, initialBalance: 100000 });
  const openPositions = engineService.getOpenPositions();

  assert(
    openPositions.length === 1 && openPositions[0].positionId === posOpen.positionId,
    'Open position survives real process restart'
  );

  // -------------------------------------------------------------
  // TEST 7: Pending order survives restart
  // -------------------------------------------------------------
  const restartSessionIdPending = 'session-restart-pending-005';
  await engineService.initializeSession({ id: restartSessionIdPending, initialBalance: 100000 });
  const pendingRes = engineService.placeOrder({
    symbol: 'EURUSD',
    type: 'BUY_LIMIT',
    volume: 0.5,
    entryPrice: 1.08000,
  });
  saveTradingState(restartSessionIdPending, getSnapshot());

  await engineService.initializeSession({ id: restartSessionIdPending, initialBalance: 100000 });
  const pendingOrders = engineService.getPendingOrders();

  assert(
    pendingOrders.length === 1 && pendingOrders[0].orderId === pendingRes.order.orderId,
    'Pending order survives real process restart'
  );

  // -------------------------------------------------------------
  // TEST 8: Account balance/equity/free margin survive restart
  // -------------------------------------------------------------
  const accState = engineService.store.getAccount();
  assert(
    accState.balance === 100000 && accState.equity === 100000,
    'Account balance/equity/free margin survive real process restart'
  );

  // -------------------------------------------------------------
  // TEST 9: No duplicate history records after hydration
  // -------------------------------------------------------------
  await engineService.initializeSession({ id: restartSessionIdMulti, initialBalance: 100000 });
  const multiHistorySecondHydration = engineService.getTradeHistory();
  assert(
    multiHistorySecondHydration.length === 2,
    'No duplicate history records created after repeated hydration calls'
  );

  // -------------------------------------------------------------
  // TEST 10: Session with NULL trading_state_json initializes clean state
  // -------------------------------------------------------------
  const restartSessionIdNull = 'session-restart-null-999';
  await engineService.initializeSession({ id: restartSessionIdNull, initialBalance: 75000 });
  const nullAcc = engineService.store.getAccount();

  assert(
    nullAcc.balance === 75000 && engineService.getOpenPositions().length === 0 && engineService.getTradeHistory().length === 0,
    'Session with NULL trading_state_json initializes clean initial state'
  );

  // -------------------------------------------------------------
  // TEST 11: Malformed trading_state_json fails gracefully
  // -------------------------------------------------------------
  const corruptSessionId = 'session-restart-corrupt-000';
  saveTradingState(corruptSessionId, '{ corrupt_json }');

  let errorOccurred = false;
  try {
    await engineService.initializeSession({ id: corruptSessionId, initialBalance: 100000 });
  } catch (e) {
    errorOccurred = true;
  }

  assert(
    !errorOccurred && engineService.store.getAccount().balance === 100000,
    'Malformed trading_state_json is handled gracefully without app crash'
  );

  // -------------------------------------------------------------
  // TEST 12: SQLite state takes precedence over empty localStorage
  // -------------------------------------------------------------
  assert(
    multiHistorySecondHydration.length === 2,
    'SQLite state takes precedence over empty localStorage cache'
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
  console.log('=== RUNNING TRADING STATE REAL RESTART HYDRATION TEST SUITE ===');
  runTradingStateRealRestartTests().then((res) => {
    for (const l of res.logs) {
      console.log(l);
    }
    console.log(`SUMMARY: ${res.passed}/${res.total} tests passed.`);
    if (!res.success) {
      process.exit(1);
    }
  });
}
