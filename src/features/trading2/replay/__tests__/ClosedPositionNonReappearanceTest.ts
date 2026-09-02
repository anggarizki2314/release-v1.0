/**
 * TRADING ENGINE 2.0 — CLOSED POSITION NON-REAPPEARANCE TEST SUITE
 * Validates 10 core acceptance criteria:
 * TEST 1 — GBPUSD BUY position closes on TP hit.
 * TEST 2 — Forward replay past TP maintains closed position state.
 * TEST 3 — Price returning to exact old TP price does NOT reopen closed position.
 * TEST 4 — GBPUSD BUY position closes on SL hit.
 * TEST 5 — Price returning to exact old SL price does NOT reopen closed position.
 * TEST 6 — EURUSD and GBPUSD positions independently close and stay closed.
 * TEST 7 — Backward replay before TP/SL index restores historical OPEN state.
 * TEST 8 — Forward replay from before TP/SL causes position to close again at TP/SL.
 * TEST 9 — Forward replay past TP/SL keeps position CLOSED (no stale snapshot resurrection).
 * TEST 10 — Genuinely NEW order creates a NEW position ID and opens normally.
 */

import { TradingEngineService } from '../../TradingEngineService';

export function runClosedPositionNonReappearanceTests(): {
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

  const t0 = 1704258000;

  // -------------------------------------------------------------
  // TEST 1: GBPUSD BUY position closes on TP hit.
  // -------------------------------------------------------------
  engineService.initializeSession({ initialBalance: 100000 });
  const posGbpTp = executionEngine.processMarketOrder(
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

  snapshotManager.saveSnapshot(100);

  // Tick at index 101 hits TP
  engineService.processTick('GBPUSD', 1.27500, 1.28100, 1.27400, 1.28050, t0 + 60);
  snapshotManager.saveSnapshot(101); // Re-save snapshot 101 with post-execution state

  const posAfterTp = positionManager.getPosition(posGbpTp.positionId);
  const isClosedTp1 = posAfterTp === undefined || posAfterTp.status === 'CLOSED';

  assert(
    isClosedTp1,
    'GBPUSD BUY position closes on TP hit'
  );

  // -------------------------------------------------------------
  // TEST 2: After TP close, replay continues past TP.
  // -------------------------------------------------------------
  // Move to index 102 (price moves further up to 1.2850)
  engineService.processTick('GBPUSD', 1.28050, 1.28600, 1.28000, 1.28500, t0 + 120);
  snapshotManager.saveSnapshot(102);

  const posAfterCont = positionManager.getPosition(posGbpTp.positionId);
  const isClosedTp2 = posAfterCont === undefined;

  assert(
    isClosedTp2,
    'After TP close, replay continues past TP with position remaining removed'
  );

  // -------------------------------------------------------------
  // TEST 3: Price returning to exact old TP price does NOT reopen closed position.
  // -------------------------------------------------------------
  // Move to index 103 (price drops back down to 1.28000 - old TP price!)
  engineService.processTick('GBPUSD', 1.28400, 1.28450, 1.27950, 1.28000, t0 + 180);
  snapshotManager.saveSnapshot(103);

  const posAfterReturnTp = positionManager.getPosition(posGbpTp.positionId);
  const openPositionsCountTp = positionManager.getOpenPositions().length;

  assert(
    posAfterReturnTp === undefined && openPositionsCountTp === 0,
    'Price returning to exact old TP price does NOT reopen closed position'
  );

  // -------------------------------------------------------------
  // TEST 4: GBPUSD BUY position closes on SL hit.
  // -------------------------------------------------------------
  engineService.initializeSession({ initialBalance: 100000 });
  const posGbpSl = executionEngine.processMarketOrder(
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

  snapshotManager.saveSnapshot(200);

  // Tick at index 201 hits SL
  engineService.processTick('GBPUSD', 1.26800, 1.26850, 1.26450, 1.26480, t0 + 60);
  snapshotManager.saveSnapshot(201);

  const posAfterSl = positionManager.getPosition(posGbpSl.positionId);
  const isClosedSl = posAfterSl === undefined;

  assert(
    isClosedSl,
    'GBPUSD BUY position closes on SL hit'
  );

  // -------------------------------------------------------------
  // TEST 5: Price later returns to old SL price does NOT reopen closed position.
  // -------------------------------------------------------------
  // Move to index 202 (price rises back up to 1.26500 - old SL price!)
  engineService.processTick('GBPUSD', 1.26480, 1.26550, 1.26400, 1.26500, t0 + 120);
  snapshotManager.saveSnapshot(202);

  const posAfterReturnSl = positionManager.getPosition(posGbpSl.positionId);
  const openPositionsCountSl = positionManager.getOpenPositions().length;

  assert(
    posAfterReturnSl === undefined && openPositionsCountSl === 0,
    'Price returning to exact old SL price does NOT reopen closed position'
  );

  // -------------------------------------------------------------
  // TEST 6: EURUSD and GBPUSD positions independently close and stay closed.
  // -------------------------------------------------------------
  engineService.initializeSession({ initialBalance: 100000 });
  const eurPosIndep = executionEngine.processMarketOrder(
    {
      symbol: 'EURUSD',
      type: 'BUY_MARKET',
      volume: 1.0,
      entryPrice: 1.08500,
      takeProfit: 1.09000,
    },
    1.08500,
    t0
  );

  const gbpPosIndep = executionEngine.processMarketOrder(
    {
      symbol: 'GBPUSD',
      type: 'BUY_MARKET',
      volume: 1.0,
      entryPrice: 1.27000,
      takeProfit: 1.28000,
    },
    1.27000,
    t0
  );

  snapshotManager.saveSnapshot(300);

  // Hit EURUSD TP at 301
  engineService.processTick('EURUSD', 1.08500, 1.09100, 1.08500, 1.09050, t0 + 60);
  snapshotManager.saveSnapshot(301);

  // Hit GBPUSD TP at 302
  engineService.processTick('GBPUSD', 1.27000, 1.28100, 1.27000, 1.28050, t0 + 120);
  snapshotManager.saveSnapshot(302);

  // Replay ticks both symbols again at 303 (price re-enters TP zone)
  engineService.processTick('EURUSD', 1.09000, 1.09050, 1.08950, 1.09000, t0 + 180);
  engineService.processTick('GBPUSD', 1.28000, 1.28050, 1.27950, 1.28000, t0 + 180);
  snapshotManager.saveSnapshot(303);

  const openCountIndep = positionManager.getOpenPositions().length;

  assert(
    openCountIndep === 0,
    'EURUSD and GBPUSD positions independently close and stay closed when price re-enters old TP areas'
  );

  // -------------------------------------------------------------
  // TEST 7: Backward replay before TP/SL index restores historical OPEN state.
  // -------------------------------------------------------------
  snapshotManager.restoreSnapshot(300); // Historical index before TP hits
  const openRestoredPreTp = positionManager.getOpenPositions();

  assert(
    openRestoredPreTp.length === 2 &&
      openRestoredPreTp.some((p) => p.positionId === eurPosIndep.positionId) &&
      openRestoredPreTp.some((p) => p.positionId === gbpPosIndep.positionId),
    'Backward replay before TP/SL index restores historical OPEN state'
  );

  // -------------------------------------------------------------
  // TEST 8: Forward replay from before TP/SL causes position to close again at TP/SL.
  // -------------------------------------------------------------
  engineService.processTick('EURUSD', 1.08500, 1.09100, 1.08500, 1.09050, t0 + 60);
  snapshotManager.saveSnapshot(301);

  const eurPostForward = positionManager.getPosition(eurPosIndep.positionId);
  const gbpPostForward = positionManager.getPosition(gbpPosIndep.positionId);

  assert(
    eurPostForward === undefined && gbpPostForward !== undefined,
    'Forward replay from before TP causes position to close again at TP (EURUSD closed, GBPUSD still open)'
  );

  // -------------------------------------------------------------
  // TEST 9: Forward replay past TP/SL keeps position CLOSED (no stale snapshot resurrection).
  // -------------------------------------------------------------
  engineService.processTick('GBPUSD', 1.27000, 1.28100, 1.27000, 1.28050, t0 + 120);
  snapshotManager.saveSnapshot(302);

  snapshotManager.restoreSnapshot(302);
  const openPostAll = positionManager.getOpenPositions();

  assert(
    openPostAll.length === 0,
    'Forward replay past TP/SL restores snapshot where positions are CLOSED (no stale snapshot resurrection)'
  );

  // -------------------------------------------------------------
  // TEST 10: Genuinely NEW order creates a NEW position ID and opens normally.
  // -------------------------------------------------------------
  const newPos = executionEngine.processMarketOrder(
    {
      symbol: 'GBPUSD',
      type: 'BUY_MARKET',
      volume: 1.0,
      entryPrice: 1.28000,
    },
    1.28000,
    t0 + 240
  );

  const openCountNew = positionManager.getOpenPositions().length;

  assert(
    openCountNew === 1 && newPos.positionId !== posGbpTp.positionId && newPos.positionId !== gbpPosIndep.positionId,
    'Genuinely NEW order creates a unique NEW position ID and opens normally'
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
  console.log('=== RUNNING CLOSED POSITION NON-REAPPEARANCE TEST SUITE ===');
  const res = runClosedPositionNonReappearanceTests();
  for (const l of res.logs) {
    console.log(l);
  }
  console.log(`SUMMARY: ${res.passed}/${res.total} tests passed.`);
  if (!res.success) {
    process.exit(1);
  }
}
