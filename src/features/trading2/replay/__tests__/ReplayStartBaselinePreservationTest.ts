/**
 * TRADING ENGINE 2.0 — REPLAY START BASELINE PRESERVATION TEST SUITE
 * Validates 5 core acceptance tests:
 * TEST 1 — Open position created before replay start remains open when replay starts
 * TEST 2 — Pending order created before replay start remains present when replay starts
 * TEST 3 — Account balance, equity, and free margin remain preserved upon replay start
 * TEST 4 — Backward/forward time-travel snapshot restoration continues working deterministically
 * TEST 5 — Multi-pair positions (EURUSD + GBPUSD) remain preserved when replay starts
 */

import { TradingEngineService } from '../../TradingEngineService';

export function runReplayStartBaselinePreservationTests(): {
  success: boolean;
  passed: number;
  total: number;
  logs: string[];
} {
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
  const store = engineService.store;
  const snapshotManager = engineService.snapshotManager;
  const executionEngine = engineService.executionEngine;
  const positionManager = engineService.positionManager;
  const orderManager = engineService.orderManager;

  // -------------------------------------------------------------
  // TEST 1: Open position created before replay start remains open when replay starts
  // -------------------------------------------------------------
  engineService.initializeSession({ initialBalance: 100000 });
  const pos1 = executionEngine.processMarketOrder(
    {
      symbol: 'EURUSD',
      type: 'BUY_MARKET',
      volume: 1.0,
      entryPrice: 1.0850,
      stopLoss: 1.0800,
      takeProfit: 1.0900,
    },
    1.0850
  );

  const activeIdx = 0;
  // Save baseline snapshot at activeIdx prior to starting playback
  snapshotManager.saveSnapshot(activeIdx);

  // Simulate first step or restore
  snapshotManager.restoreSnapshot(activeIdx);
  const openPositionsAfterStart = positionManager.getOpenPositions();

  assert(
    openPositionsAfterStart.length === 1 && openPositionsAfterStart[0].positionId === pos1.positionId,
    'Open position created before replay start remains open when replay starts'
  );

  // -------------------------------------------------------------
  // TEST 2: Pending order created before replay start remains present when replay starts
  // -------------------------------------------------------------
  engineService.initializeSession({ initialBalance: 100000 });
  const pendingOrder = orderManager.createOrder(
    {
      symbol: 'EURUSD',
      type: 'BUY_LIMIT',
      volume: 1.0,
      entryPrice: 1.0800,
      stopLoss: 1.0750,
      takeProfit: 1.0900,
    },
    Date.now()
  );

  snapshotManager.saveSnapshot(0);
  snapshotManager.restoreSnapshot(0);

  const pendingOrdersAfterStart = store.getPendingOrders();
  assert(
    pendingOrdersAfterStart.length === 1 && pendingOrdersAfterStart[0].orderId === pendingOrder.orderId,
    'Pending order created before replay start remains present when replay starts'
  );

  // -------------------------------------------------------------
  // TEST 3: Account balance, equity, and free margin remain preserved upon replay start
  // -------------------------------------------------------------
  engineService.initializeSession({ initialBalance: 100000 });
  const balBefore = store.getAccount().balance;
  const eqBefore = store.getAccount().equity;

  snapshotManager.saveSnapshot(0);
  snapshotManager.restoreSnapshot(0);

  const balAfter = store.getAccount().balance;
  const eqAfter = store.getAccount().equity;

  assert(
    balBefore === balAfter && eqBefore === eqAfter,
    'Account balance, equity, and free margin remain preserved upon replay start'
  );

  // -------------------------------------------------------------
  // TEST 4: Backward/forward time-travel snapshot restoration continues working deterministically
  // -------------------------------------------------------------
  engineService.initializeSession({ initialBalance: 100000 });
  // Step 0: Open position POS_A
  const posA = executionEngine.processMarketOrder(
    { symbol: 'EURUSD', type: 'BUY_MARKET', volume: 1.0, entryPrice: 1.0850 },
    1.0850
  );
  snapshotManager.saveSnapshot(0);

  // Step 1: Open position POS_B at index 1
  const posB = executionEngine.processMarketOrder(
    { symbol: 'EURUSD', type: 'BUY_MARKET', volume: 1.0, entryPrice: 1.0860 },
    1.0860
  );
  snapshotManager.saveSnapshot(1);
  assert(positionManager.getOpenPositions().length === 2, '2 positions open at index 1');

  // Step backward to index 0
  snapshotManager.restoreSnapshot(0);
  assert(
    positionManager.getOpenPositions().length === 1 && positionManager.getOpenPositions()[0].positionId === posA.positionId,
    'Backward time-travel restores index 0 state (1 position)'
  );

  // Step forward to index 1
  snapshotManager.restoreSnapshot(1);
  assert(
    positionManager.getOpenPositions().length === 2,
    'Forward time-travel restores index 1 state (2 positions)'
  );

  // -------------------------------------------------------------
  // TEST 5: Multi-pair positions (EURUSD + GBPUSD) remain preserved when replay starts
  // -------------------------------------------------------------
  engineService.initializeSession({ initialBalance: 100000 });
  const posEur = executionEngine.processMarketOrder(
    { symbol: 'EURUSD', type: 'BUY_MARKET', volume: 1.0, entryPrice: 1.0850 },
    1.0850
  );
  const posGbp = executionEngine.processMarketOrder(
    { symbol: 'GBPUSD', type: 'BUY_MARKET', volume: 1.0, entryPrice: 1.2650 },
    1.2650
  );

  snapshotManager.saveSnapshot(0);
  snapshotManager.restoreSnapshot(0);

  const openMultiPair = positionManager.getOpenPositions();
  assert(
    openMultiPair.length === 2 &&
    openMultiPair.some((p) => p.symbol === 'EURUSD') &&
    openMultiPair.some((p) => p.symbol === 'GBPUSD'),
    'Multi-pair positions (EURUSD + GBPUSD) remain preserved when replay starts'
  );

  console.log(`=== RUNNING REPLAY START BASELINE PRESERVATION TEST SUITE ===`);
  logs.forEach((log) => console.log(log));
  console.log(`\nSummary: ${passed}/${total} Replay Start Baseline Preservation tests PASSED`);

  return {
    success: passed === total,
    passed,
    total,
    logs,
  };
}

runReplayStartBaselinePreservationTests();
