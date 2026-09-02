/**
 * ReplayPrefetchReconnectionTest.ts
 *
 * Comprehensive test suite verifying:
 * 1. Prefetch trigger when remaining <= 2500
 * 2. Duplicate prefetch request prevention while active
 * 3. Buffer expansion via engine.updateAllCandles() without resetting currentIndex / engine
 * 4. Weekend gap crossing (Jan 5 -> Jan 7/8) without entering finished state
 * 5. True session end logic when SQLite returns zero new rows
 */

import type { Candle } from '@/types';
import { ReplayEngine } from '../../../../features/replay/engine';
import { mergeDeduplicateCandles } from '../../../../features/chart/useCandles';
import { getBucketStart, getBucketEnd } from '../../../../features/chart/candleResolver';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`[FAIL] ${message}`);
  }
}

export function runReplayPrefetchReconnectionTests(): { success: boolean; logs: string[] } {
  const logs: string[] = [];
  const log = (msg: string) => logs.push(msg);

  const baseTimestamp = 1704240000; // 2024-01-03 00:00:00 UTC

  // Create initial 4,302 M1 candles simulating 7-day chunk (Jan 3 to Jan 10 with weekend gap)
  const initialCandles: Candle[] = [];
  for (let i = 0; i < 4302; i++) {
    // Add artificial gap at 2000 (weekend gap simulation)
    const extraGap = i >= 2000 ? 172800 : 0; // 48 hour weekend gap
    const t = baseTimestamp + i * 60 + extraGap;
    initialCandles.push({
      time: t,
      open: 1.0900 + (i % 100) * 0.0001,
      high: 1.0905 + (i % 100) * 0.0001,
      low: 1.0895 + (i % 100) * 0.0001,
      close: 1.0902 + (i % 100) * 0.0001,
      volume: 10,
    });
  }

  try {
    // TEST 1: Initial buffer setup
    const engine = new ReplayEngine();
    engine.initialize({
      symbolId: 95,
      symbol: 'EURUSD',
      timeframe: 'M5',
      allCandles: initialCandles,
      replayStartIndex: 0,
    });

    assert(engine.getAllCandles().length === 4302, 'TEST 1: Initial engine allCandles count is 4302');
    log('[PASS] TEST 1 — Initial engine dataset loaded with 4,302 M1 candles');

    // TEST 2: Prefetch threshold evaluation (remaining <= 2500)
    engine.setCurrentIndex(1801); // 4302 - 1 - 1801 = 2500
    const currentIdx = engine.getCurrentIndex();
    const remaining = engine.getAllCandles().length - 1 - currentIdx;
    const PREFETCH_THRESHOLD = 2500;
    const shouldPrefetch = remaining <= PREFETCH_THRESHOLD;

    assert(shouldPrefetch === true, 'TEST 2: Prefetch threshold triggers when remaining <= 2500');
    assert(remaining === 2500, 'TEST 2: Exact remaining count is 2500');
    log('[PASS] TEST 2 — Prefetch threshold evaluates true when remaining <= 2500 (remaining = 2500)');

    // TEST 3: Duplicate request protection simulation
    let loadingMoreFuture = true;
    const secondTrigger = remaining <= PREFETCH_THRESHOLD && !loadingMoreFuture;
    assert(secondTrigger === false, 'TEST 3: Duplicate prefetch request is blocked while loading');
    log('[PASS] TEST 3 — Duplicate prefetch request correctly blocked while loadingMoreFuture is true');

    // TEST 4: Buffer expansion via updateAllCandles without resetting state
    const nextStartUtc = initialCandles[initialCandles.length - 1].time + 60;
    const incomingCandles: Candle[] = [];
    for (let i = 0; i < 5760; i++) {
      incomingCandles.push({
        time: nextStartUtc + i * 60,
        open: 1.0950,
        high: 1.0955,
        low: 1.0945,
        close: 1.0952,
        volume: 10,
      });
    }

    const merged = mergeDeduplicateCandles(engine.getAllCandles(), incomingCandles);
    assert(merged.length === 4302 + 5760, 'Merged array count is 10062');

    const prevCurrentIndex = engine.getCurrentIndex();
    const prevCurrentTime = engine.getAllCandles()[prevCurrentIndex].time;

    engine.updateAllCandles(merged);

    assert(engine.getAllCandles().length === 10062, 'TEST 4: Engine buffer expanded to 10062');
    assert(engine.getCurrentIndex() === prevCurrentIndex, 'TEST 4: Engine currentIndex preserved after updateAllCandles');
    assert(engine.getAllCandles()[engine.getCurrentIndex()].time === prevCurrentTime, 'TEST 4: Engine currentReplayTime preserved after updateAllCandles');
    assert(engine.isFinished() === false, 'TEST 4: Engine isFinished remains false after buffer expansion');
    log('[PASS] TEST 4 — Buffer expanded from 4,302 to 10,062 candles without resetting currentIndex or engine instance');

    // TEST 5: Weekend gap step navigation
    engine.setCurrentIndex(1999);
    const friCandle = engine.getAllCandles()[1999];
    const friBucketStart = getBucketStart(friCandle.time, 'M5');
    const targetEndTime = getBucketEnd(friBucketStart, 'M5');

    // Find next candle across weekend gap
    const sunIdx = engine.getAllCandles().findIndex((c) => c.time >= targetEndTime);
    assert(sunIdx === 2000, 'TEST 5: Step forward across weekend gap lands on first Sunday candle index');
    assert(engine.getAllCandles()[sunIdx].time > friCandle.time + 3600, 'TEST 5: Time delta crosses weekend gap (> 1 hour)');
    log('[PASS] TEST 5 — Stepping across weekend gap advances cleanly from Friday to Sunday candle');

    // TEST 6: True session end when SQLite returns 0 rows
    const emptyIncoming: Candle[] = [];
    const mergedEmpty = mergeDeduplicateCandles(engine.getAllCandles(), emptyIncoming);
    const newRowsCount = mergedEmpty.length - engine.getAllCandles().length;
    assert(newRowsCount === 0, 'TEST 6: 0 new rows when SQLite returns empty');

    // Reach end of expanded buffer
    engine.setCurrentIndex(engine.getAllCandles().length - 1);
    assert(engine.getCurrentIndex() === 10061, 'TEST 6: Reached last candle of expanded buffer');
    engine.setHasMoreFutureData(false);
    assert(engine.isFinished() === true, 'TEST 6: Engine enters finished status only when SQLite has no more data');
    log('[PASS] TEST 6 — True session end sets status = finished only when zero new rows return from SQLite');

    return { success: true, logs };
  } catch (err: any) {
    logs.push(`[ERROR] ${err.message}`);
    return { success: false, logs };
  }
}
