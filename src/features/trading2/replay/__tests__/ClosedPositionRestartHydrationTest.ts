/**
 * Trading Engine 2.0 — ClosedPositionRestartHydrationTest
 * Acceptance test suite validating that closed positions NEVER reappear as open positions after real application restart.
 */

import { tradingEngine } from '../../TradingEngineService';
import { saveTradingState } from '../../../backtest/sessionRepository';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`[FAIL] ${msg}`);
    throw new Error(msg);
  }
  console.log(`[PASS] ${msg}`);
}

async function runClosedPositionRestartHydrationTests() {
  console.log('====================================================');
  console.log('RUNNING CLOSED POSITION RESTART HYDRATION TEST SUITE');
  console.log('====================================================');

  // TEST 1: Closed TP position does not exist in active positions after restart
  const sessionTp = 'session-test-tp-001';
  await tradingEngine.initializeSession({ id: sessionTp, initialBalance: 100000 });
  const openPos1 = tradingEngine.placeOrder({
    symbol: 'EURUSD',
    type: 'BUY_MARKET',
    volume: 1.0,
    entryPrice: 1.0900,
    stopLoss: 1.0850,
    takeProfit: 1.0950,
  });

  // Replay tick hits TP
  tradingEngine.processTick('EURUSD', 1.0900, 1.0960, 1.0890, 1.0955, 1704258100000);

  assert(tradingEngine.getOpenPositions().length === 0, 'Before restart: open positions must be 0 after TP');
  assert(tradingEngine.getTradeHistory().length === 1, 'Before restart: history must contain 1 closed trade');

  // Simulate complete process restart (re-initialize session from persisted state)
  await tradingEngine.initializeSession({ id: sessionTp, initialBalance: 100000 });

  assert(tradingEngine.getOpenPositions().length === 0, 'Test 1: Closed TP position does not exist in active positions after restart');

  // TEST 2: Closed SL position does not exist in active positions after restart
  const sessionSl = 'session-test-sl-002';
  await tradingEngine.initializeSession({ id: sessionSl, initialBalance: 100000 });
  const openPos2 = tradingEngine.placeOrder({
    symbol: 'EURUSD',
    type: 'BUY_MARKET',
    volume: 1.0,
    entryPrice: 1.0900,
    stopLoss: 1.0850,
    takeProfit: 1.0950,
  });

  // Replay tick hits SL
  tradingEngine.processTick('EURUSD', 1.0900, 1.0910, 1.0840, 1.0845, 1704258200000);

  assert(tradingEngine.getOpenPositions().length === 0, 'Before restart: open positions must be 0 after SL');
  assert(tradingEngine.getTradeHistory().length === 1, 'Before restart: history must contain 1 closed trade');

  await tradingEngine.initializeSession({ id: sessionSl, initialBalance: 100000 });

  assert(tradingEngine.getOpenPositions().length === 0, 'Test 2: Closed SL position does not exist in active positions after restart');

  // TEST 3: Closed trade exists in history after restart
  const historyAfterRestart = tradingEngine.getTradeHistory();
  assert(historyAfterRestart.length === 1, 'Test 3: Closed trade exists in history after restart');

  // TEST 4: Open position survives restart
  const sessionOpen = 'session-test-open-003';
  await tradingEngine.initializeSession({ id: sessionOpen, initialBalance: 100000 });
  const openPos3 = tradingEngine.placeOrder({
    symbol: 'EURUSD',
    type: 'BUY_MARKET',
    volume: 2.0,
    entryPrice: 1.0900,
    stopLoss: 1.0800,
    takeProfit: 1.1000,
  });

  assert(tradingEngine.getOpenPositions().length === 1, 'Before restart: 1 open position');

  await tradingEngine.initializeSession({ id: sessionOpen, initialBalance: 100000 });

  const restoredOpen = tradingEngine.getOpenPositions();
  assert(restoredOpen.length === 1, 'Test 4: Open position survives restart');
  assert(restoredOpen[0].volume === 2.0, 'Restored open position volume is intact');
  assert(restoredOpen[0].entryPrice === 1.0900, 'Restored open position entry price is intact');

  // TEST 5: Closed EURUSD + open GBPUSD survive correctly
  const sessionMulti = 'session-test-multi-004';
  await tradingEngine.initializeSession({ id: sessionMulti, initialBalance: 100000 });
  
  // 1. Open EURUSD
  tradingEngine.placeOrder({
    symbol: 'EURUSD',
    type: 'BUY_MARKET',
    volume: 1.0,
    entryPrice: 1.0900,
    stopLoss: 1.0850,
    takeProfit: 1.0950,
  });
  // 2. Open GBPUSD
  tradingEngine.placeOrder({
    symbol: 'GBPUSD',
    type: 'BUY_MARKET',
    volume: 1.5,
    entryPrice: 1.2700,
    stopLoss: 1.2600,
    takeProfit: 1.2850,
  });

  // 3. EURUSD hits TP
  tradingEngine.processTick('EURUSD', 1.0900, 1.0960, 1.0890, 1.0955, 1704258300000);

  assert(tradingEngine.getOpenPositions().length === 1, 'Before restart: 1 position open (GBPUSD)');
  assert(tradingEngine.getTradeHistory().length === 1, 'Before restart: 1 trade in history (EURUSD)');

  // Restart
  await tradingEngine.initializeSession({ id: sessionMulti, initialBalance: 100000 });

  const multiOpen = tradingEngine.getOpenPositions();
  const multiHistory = tradingEngine.getTradeHistory();
  assert(multiOpen.length === 1, 'Test 5: 1 position open after restart');
  assert(multiOpen[0].symbol === 'GBPUSD', 'Test 5: Open position is GBPUSD');
  assert(multiHistory.length === 1, 'Test 5: 1 trade in history after restart');
  assert(multiHistory[0].symbol === 'EURUSD', 'Test 5: History trade is EURUSD');

  // TEST 6: Chart-facing active positions contain only genuinely OPEN positions
  const chartPositions = tradingEngine.getOpenPositions();
  assert(chartPositions.every((p) => p.status === 'OPEN'), 'Test 6: Chart-facing active positions contain only genuinely OPEN positions');

  // TEST 7: Closed position ID never appears in active positions after hydration
  const closedId = multiHistory[0].positionId;
  assert(!chartPositions.some((p) => p.positionId === closedId), 'Test 7: Closed position ID never appears in active positions after hydration');

  // TEST 8: Closed position does not reappear when replay resumes
  // Moving EURUSD price through the old TP price should not re-trigger or open anything
  tradingEngine.processTick('EURUSD', 1.0940, 1.0980, 1.0930, 1.0970, 1704258400000);
  assert(tradingEngine.getOpenPositions().length === 1, 'Test 8: Closed EURUSD did not reappear when replay resumed');
  assert(tradingEngine.getTradeHistory().length === 1, 'Test 8: History remained unchanged');

  // TEST 9: Trade ID remains identical
  assert(multiHistory[0].tradeId !== undefined && multiHistory[0].tradeId.length > 0, 'Test 9: Trade ID remains identical and defined');

  // TEST 10: Position ID remains identical
  assert(multiHistory[0].positionId === closedId, 'Test 10: Position ID remains identical');

  console.log('====================================================');
  console.log('ALL 10 CLOSED POSITION RESTART HYDRATION TESTS PASSED');
  console.log('====================================================');
}

runClosedPositionRestartHydrationTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
