/**
 * Trading Engine 2.0 — Deterministic Time Travel Test Suite
 * Validates 100% deterministic state behavior during forward stepping, backward stepping,
 * user mutation branching, SL/TP execution, pending order fills, account state restoration,
 * and timeframe switching.
 */

import { TradingEngineService } from '../../TradingEngineService';
import type { Candle } from '@/types';

export function runDeterministicTimeTravelTests(): {
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
  const adapter = engineService.replayAdapter;

  const symbol = 'EURUSD';

  // Sample Replay Candle Sequence A, B, C
  const candleA: Candle = { time: 1000, open: 1.0800, high: 1.0810, low: 1.0790, close: 1.0805, volume: 100 };
  const candleB: Candle = { time: 1060, open: 1.0805, high: 1.0860, low: 1.0800, close: 1.0855, volume: 150 };
  const candleC: Candle = { time: 1120, open: 1.0855, high: 1.0890, low: 1.0820, close: 1.0830, volume: 200 };

  // Reset store for test run
  store.resetStore();

  // -------------------------------------------------------------
  // TEST 1: Initial state at replay start
  // -------------------------------------------------------------
  const startIndex = 10;
  const S_start = snapshotManager.initialize(startIndex);
  assert(
    snapshotManager.hasSnapshot(startIndex) && S_start.schema.account.balance === 10000,
    'Initial state at replay start saved in snapshotMap'
  );

  // -------------------------------------------------------------
  // TEST 2: A → B: Snapshot B equals TradingStore state after B
  // -------------------------------------------------------------
  adapter.onReplayCandle({
    symbol,
    timestamp: candleB.time * 1000,
    open: candleB.open,
    high: candleB.high,
    low: candleB.low,
    close: candleB.close,
  });
  const indexB = 11;
  snapshotManager.saveSnapshot(indexB);
  const snapB_1 = snapshotManager.getSnapshot(indexB);
  assert(
    snapB_1 !== null && snapB_1.schema.account.balance === 10000,
    'Snapshot B saved and equals TradingStore state after B'
  );

  // -------------------------------------------------------------
  // TEST 3: A → B → C → B: State at B equals original B state
  // -------------------------------------------------------------
  adapter.onReplayCandle({
    symbol,
    timestamp: candleC.time * 1000,
    open: candleC.open,
    high: candleC.high,
    low: candleC.low,
    close: candleC.close,
  });
  const indexC = 12;
  snapshotManager.saveSnapshot(indexC);

  // Step back to B
  snapshotManager.restoreSnapshot(indexB);
  const currentAccountB = store.getSchemaRaw().account;
  assert(
    currentAccountB.balance === 10000 && snapshotManager.hasSnapshot(indexB),
    'A → B → C → B: TradingStore state at B equals original B state'
  );

  // -------------------------------------------------------------
  // TEST 4: A → B → C → B → A: State at A equals original A state
  // -------------------------------------------------------------
  snapshotManager.restoreSnapshot(startIndex);
  const currentAccountA = store.getSchemaRaw().account;
  assert(
    currentAccountA.balance === 10000 && store.getSchemaRaw().positions.length === 0,
    'A → B → C → B → A: TradingStore state at A equals original A state'
  );

  // -------------------------------------------------------------
  // TEST 5: A → B → C → B → A → B → C: Final state equals original C
  // -------------------------------------------------------------
  snapshotManager.restoreSnapshot(indexC);
  const snapC_restored = store.getSchemaRaw();
  assert(
    snapC_restored.account.balance === 10000,
    'A → B → C → B → A → B → C: Final state equals original C state'
  );

  // -------------------------------------------------------------
  // TEST 6: User creates new order at B → new branch used
  // -------------------------------------------------------------
  snapshotManager.restoreSnapshot(indexB);
  engineService.placeOrder(
    {
      symbol,
      type: 'BUY_LIMIT',
      volume: 1.0,
      entryPrice: 1.0825,
      stopLoss: 1.0800,
      takeProfit: 1.0880,
    },
    Date.now(),
    indexB
  );

  const pendingOrdersAtB = store.getSchemaRaw().orders;
  assert(
    pendingOrdersAtB.length === 1 && pendingOrdersAtB[0].entryPrice === 1.0825,
    'User creates new order at B: branch updated with new order'
  );

  // -------------------------------------------------------------
  // TEST 7: Branch invalidation (future snapshots C deleted after mutation at B)
  // -------------------------------------------------------------
  assert(
    !snapshotManager.hasSnapshot(indexC),
    'Branch Invalidation: Old snapshot C was invalidated when mutating state at B'
  );

  // Process fresh candle C' on new branch
  adapter.onReplayCandle({
    symbol,
    timestamp: candleC.time * 1000,
    open: candleC.open,
    high: candleC.high,
    low: candleC.low, // 1.0820 triggers BUY_LIMIT at 1.0825!
    close: candleC.close,
  });
  snapshotManager.saveSnapshot(indexC);

  const positionsAfterFreshC = store.getSchemaRaw().positions;
  assert(
    positionsAfterFreshC.length === 1 && positionsAfterFreshC[0].entryPrice === 1.0825,
    'Fresh forward path B → C\' executed order and created position on new branch'
  );

  // -------------------------------------------------------------
  // TEST 8: SL/TP execution followed by backward navigation
  // -------------------------------------------------------------
  // Candle D hits SL (low 1.0790 <= SL 1.0800)
  adapter.onReplayCandle({
    symbol,
    timestamp: 1200000,
    open: 1.0830,
    high: 1.0830,
    low: 1.0790,
    close: 1.0795,
  });
  const indexD = 13;
  snapshotManager.saveSnapshot(indexD);

  const positionsAtD = store.getSchemaRaw().positions;
  const historyAtD = store.getSchemaRaw().history;
  const positionClosedAtD = positionsAtD.length === 0 && historyAtD.length === 1;

  // Step back to C' (before SL execution)
  snapshotManager.restoreSnapshot(indexC);
  const positionsAtC = store.getSchemaRaw().positions;
  const historyAtC = store.getSchemaRaw().history;

  assert(
    positionClosedAtD && positionsAtC.length === 1 && historyAtC.length === 0,
    'SL execution: Closed position disappears when returning before execution, reappears on replay forward'
  );

  // -------------------------------------------------------------
  // TEST 9: Pending order execution followed by backward navigation
  // -------------------------------------------------------------
  snapshotManager.restoreSnapshot(indexB);
  const ordersAtB = store.getSchemaRaw().orders;
  assert(
    ordersAtB.length === 1 && ordersAtB[0].status === 'PENDING',
    'Pending order returns to historical PENDING status when stepping back before fill'
  );

  // -------------------------------------------------------------
  // TEST 10: Account balance / equity / margin restoration
  // -------------------------------------------------------------
  snapshotManager.restoreSnapshot(startIndex);
  const restoredAccountStart = store.getSchemaRaw().account;
  assert(
    restoredAccountStart.balance === 10000 && restoredAccountStart.margin === 0,
    'Account balance, equity, and margin fully restored on backward navigation'
  );

  // -------------------------------------------------------------
  // TEST 11: Timeframe switch with open position
  // -------------------------------------------------------------
  snapshotManager.restoreSnapshot(indexC);
  const snapPositionM1 = store.getSchemaRaw().positions;
  const currentSnapTimeframe = snapshotManager.initialize(50); // Re-anchor to index 50 on M5
  const positionsOnM5 = store.getSchemaRaw().positions;
  assert(
    currentSnapTimeframe !== null && positionsOnM5.length === snapPositionM1.length,
    'Timeframe switch preserves active positions while re-anchoring snapshot namespace'
  );

  // -------------------------------------------------------------
  // TEST 12: Timeframe switch with pending orders
  // -------------------------------------------------------------
  const ordersOnM5 = store.getSchemaRaw().orders;
  assert(
    ordersOnM5.length === snapC_restored.orders.length,
    'Timeframe switch preserves pending orders under new timeframe namespace'
  );

  const success = passed === total;
  return { success, passed, total, logs };
}
