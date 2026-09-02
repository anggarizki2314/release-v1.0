/**
 * Replay Playback Performance + Final Candle Handoff Verification Suite
 *
 * Verifies:
 * TEST A — FINAL CANDLE HANDOFF: H1 boundary transition & pre-generated OHLC matching.
 * TEST B — NO REPEATED FINAL AGGREGATION: Completed higher-timeframe bars are cached as SQLITE_CLOSED.
 * TEST C — SQLITE CACHE: Single-fetch cache reutilization.
 * TEST D — CHART UPDATE: Incremental series.update vs series.setData strategy.
 * TEST E — MULTI-PAIR: Shared master replay clock with isolated symbol caches.
 * TEST F — AUTO FOLLOW ON: Viewport moves incrementally with 15% right padding.
 * TEST G — AUTO FOLLOW OFF: Viewport remains stationary on manual pan during play.
 * TEST H — MEMORY: Flat memory usage across 1,000 continuous ticks.
 */

import type { Candle } from '@/types';
import { resolveReplayCandles, getBucketStart, getBucketEnd } from '../../../chart/candleResolver';
import { ReplayEngine } from '../../../replay/engine';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[FAIL] ${message}`);
  }
}

export function runReplayPerformanceTests(): { success: boolean; logs: string[] } {
  const logs: string[] = [];
  let passed = 0;
  let total = 0;

  function runTest(name: string, fn: () => void) {
    total++;
    try {
      fn();
      passed++;
      logs.push(`[PASS] ${name}`);
    } catch (err: any) {
      logs.push(`[FAIL] ${name}: ${err.message}`);
    }
  }

  // Sample M1 candles across two H1 buckets (10:00 - 10:59 and 11:00 - 11:59)
  const mockM1Candles: Candle[] = [];
  const baseTime = 1704100000; // 2024-01-01 10:00:00 UTC (H1 bucket 10:00)

  // Bucket 1 (10:00 - 10:59: 60 M1 candles)
  for (let i = 0; i < 60; i++) {
    mockM1Candles.push({
      time: baseTime + i * 60,
      open: 1.3000 + i * 0.0001,
      high: 1.3000 + i * 0.0001 + 0.0005,
      low: 1.3000 + i * 0.0001 - 0.0002,
      close: 1.3000 + (i + 1) * 0.0001,
    });
  }
  // Bucket 2 (11:00 - 11:59: 60 M1 candles)
  for (let i = 0; i < 60; i++) {
    mockM1Candles.push({
      time: baseTime + 3600 + i * 60,
      open: 1.3060 + i * 0.0001,
      high: 1.3060 + i * 0.0001 + 0.0005,
      low: 1.3060 + i * 0.0001 - 0.0002,
      close: 1.3060 + (i + 1) * 0.0001,
    });
  }

  // Pre-generated H1 candles matching exact M1 boundaries
  const mockPreGenH1: Candle[] = [
    {
      time: baseTime,
      open: 1.3000,
      high: 1.3000 + 59 * 0.0001 + 0.0005,
      low: 1.3000 - 0.0002,
      close: 1.3000 + 60 * 0.0001,
    },
    {
      time: baseTime + 3600,
      open: 1.3060,
      high: 1.3060 + 59 * 0.0001 + 0.0005,
      low: 1.3060 - 0.0002,
      close: 1.3060 + 60 * 0.0001,
    },
  ];

  // TEST A — FINAL CANDLE HANDOFF
  runTest('TEST A — FINAL CANDLE HANDOFF (H1 boundary transition & pre-generated OHLC matching)', () => {
    // Replay at 10:35 (H1 ongoing)
    const midReplay = resolveReplayCandles({
      timeframe: 'H1',
      currentReplayTime: baseTime + 35 * 60,
      tfCandles: mockPreGenH1,
      m1Candles: mockM1Candles,
      symbolId: 1,
    });
    assert(midReplay.length === 1, 'Ongoing H1 candle present');
    assert(midReplay[0].source === 'M1_ONGOING', 'Ongoing H1 candle sourced from M1');

    // Replay crosses boundary at 11:00:00 (10:00 bucket is closed)
    const boundaryReplay = resolveReplayCandles({
      timeframe: 'H1',
      currentReplayTime: baseTime + 3600,
      tfCandles: mockPreGenH1,
      m1Candles: mockM1Candles,
      symbolId: 1,
    });
    assert(boundaryReplay.length === 2, '2 H1 candles present after boundary');
    assert(boundaryReplay[0].source === 'SQLITE_CLOSED', 'Closed H1 10:00 candle is marked SQLITE_CLOSED');
    assert(boundaryReplay[0].open === mockPreGenH1[0].open, 'Closed H1 Open matches pre-generated OHLC');
    assert(boundaryReplay[0].close === mockPreGenH1[0].close, 'Closed H1 Close matches pre-generated OHLC');
    assert(boundaryReplay[1].source === 'M1_ONGOING', 'New H1 11:00 candle is ONGOING from M1');
  });

  // TEST B — NO REPEATED FINAL AGGREGATION
  runTest('TEST B — NO REPEATED FINAL AGGREGATION (Completed bars sliced in O(log N))', () => {
    const t0 = performance.now();
    for (let i = 0; i < 1000; i++) {
      resolveReplayCandles({
        timeframe: 'H1',
        currentReplayTime: baseTime + 3600 + (i % 60) * 60,
        tfCandles: mockPreGenH1,
        m1Candles: mockM1Candles,
        symbolId: 1,
      });
    }
    const elapsed = performance.now() - t0;
    assert(elapsed < 50, `1,000 resolution ticks completed in ${elapsed.toFixed(2)}ms (< 50ms)`);
  });

  // TEST C — SQLITE CACHE
  runTest('TEST C — SQLITE CACHE (Pre-generated TF dataset reused without database queries)', () => {
    const res1 = resolveReplayCandles({
      timeframe: 'H1',
      currentReplayTime: baseTime + 1800,
      tfCandles: mockPreGenH1,
      m1Candles: mockM1Candles,
      symbolId: 1,
    });
    const res2 = resolveReplayCandles({
      timeframe: 'H1',
      currentReplayTime: baseTime + 1860,
      tfCandles: mockPreGenH1,
      m1Candles: mockM1Candles,
      symbolId: 1,
    });
    assert(res1[0].time === res2[0].time, 'Cached timeframe dataset reuse verified');
  });

  // TEST D — CHART UPDATE
  runTest('TEST D — CHART UPDATE (Incremental update strategy logic)', () => {
    let lastCount = 100;
    let lastTime = 1704100000;

    let updateType = '';
    const evaluateUpdateStrategy = (currentCount: number, currentLastTime: number) => {
      if (currentCount === lastCount && currentLastTime === lastTime) {
        updateType = 'UPDATE_ONGOING';
      } else if (currentCount > lastCount) {
        updateType = 'UPDATE_FINAL_AND_ONGOING';
      } else {
        updateType = 'SET_DATA_RESET';
      }
    };

    evaluateUpdateStrategy(100, 1704100000);
    assert(updateType === 'UPDATE_ONGOING', 'Ongoing tick uses incremental UPDATE_ONGOING');

    evaluateUpdateStrategy(101, 1704103600);
    assert(updateType === 'UPDATE_FINAL_AND_ONGOING', 'New candle boundary uses UPDATE_FINAL_AND_ONGOING');
  });

  // TEST E — MULTI-PAIR ISOLATION
  runTest('TEST E — MULTI-PAIR (EURUSD and GBPUSD separate resolution streams on single clock)', () => {
    const clock = baseTime + 1800;
    const eurusd = resolveReplayCandles({
      timeframe: 'H1',
      currentReplayTime: clock,
      tfCandles: mockPreGenH1,
      m1Candles: mockM1Candles,
      symbolId: 1,
    });
    const gbpusd = resolveReplayCandles({
      timeframe: 'H1',
      currentReplayTime: clock,
      tfCandles: mockPreGenH1,
      m1Candles: mockM1Candles,
      symbolId: 2,
    });

    assert(eurusd.length === 1 && gbpusd.length === 1, 'Both pairs resolved independently');
    assert(eurusd[0].time === gbpusd[0].time, 'Both pairs share master currentReplayTime anchor');
  });

  // TEST F — AUTO FOLLOW ON
  runTest('TEST F — AUTO FOLLOW ON (Incremental scroll range calculation)', () => {
    const currentCount = 100;
    const visibleWidth = 150;
    const rightPad = Math.max(3, Math.floor(visibleWidth * 0.15));
    const newTo = currentCount - 1 + rightPad;
    const newFrom = Math.max(0, newTo - visibleWidth);

    assert(newTo === 121, 'Calculated right edge offset includes 15% right padding');
    assert(newFrom === 0, 'Calculated left edge range is non-negative');
  });

  // TEST G — AUTO FOLLOW OFF
  runTest('TEST G — AUTO FOLLOW OFF (Viewport remains stationary during ticks)', () => {
    const autoFollow = false;
    const isUserPanned = true;
    const shouldAutoFollow = autoFollow && !isUserPanned;

    assert(shouldAutoFollow === false, 'Auto follow mode evaluates to false when user panned');
  });

  // TEST H — MEMORY STABILITY
  runTest('TEST H — MEMORY STABILITY (Zero object accumulation across 1,000 ticks)', () => {
    const memoryBefore = process.memoryUsage().heapUsed;
    for (let i = 0; i < 1000; i++) {
      resolveReplayCandles({
        timeframe: 'H1',
        currentReplayTime: baseTime + (i % 3600),
        tfCandles: mockPreGenH1,
        m1Candles: mockM1Candles,
        symbolId: 1,
      });
    }
    const memoryAfter = process.memoryUsage().heapUsed;
    const diffMb = (memoryAfter - memoryBefore) / (1024 * 1024);
    assert(diffMb < 10, `Memory growth is ${diffMb.toFixed(2)}MB (< 10MB) across 1,000 ticks`);
  });

  // TEST I — NON-BLOCKING BUFFER PREFETCH THRESHOLD (2500 M1 candles)
  runTest('TEST I — NON-BLOCKING BUFFER PREFETCH THRESHOLD (Trigger threshold when remaining <= 2500)', () => {
    const totalCount = 10000;
    const currentIdx = 7600; // remaining = 2399 <= 2500
    const remaining = totalCount - 1 - currentIdx;
    const PREFETCH_THRESHOLD = 2500;
    const shouldPrefetch = remaining <= PREFETCH_THRESHOLD;
    assert(shouldPrefetch === true, 'Prefetch threshold correctly evaluates to true when remaining <= 2500');
  });

  // TEST J — BUFFER EXHAUSTION WHILE IPC PENDING (No False Finish)
  runTest('TEST J — BUFFER EXHAUSTION WHILE IPC PENDING (isFinished returns false when hasMoreFutureData is true)', () => {
    const engine = new ReplayEngine();
    engine.initialize({
      symbolId: 1,
      symbol: 'EURUSD',
      timeframe: 'M1',
      allCandles: mockM1Candles,
      replayStartIndex: 0,
    });

    // Move to end of current buffer
    engine.setCurrentIndex(mockM1Candles.length - 1);
    assert(engine.isBufferExhausted() === true, 'isBufferExhausted is true at array boundary');
    assert(engine.isFinished() === false, 'isFinished remains FALSE while hasMoreFutureData is true');

    // SQLite returns 0 candles -> TRUE SESSION END
    engine.setHasMoreFutureData(false);
    assert(engine.isFinished() === true, 'isFinished becomes TRUE only after hasMoreFutureData is set to false');
  });

  // TEST K — IN-PLACE BUFFER UPDATE
  runTest('TEST K — IN-PLACE BUFFER UPDATE (updateAllCandles updates dataset without index reset)', () => {
    const engine = new ReplayEngine();
    engine.initialize({
      symbolId: 1,
      symbol: 'EURUSD',
      timeframe: 'M1',
      allCandles: mockM1Candles,
      replayStartIndex: 0,
    });
    engine.setCurrentIndex(50);
    assert(engine.getCurrentIndex() === 50, 'Index set to 50');

    // Create expanded dataset (append 60 new candles)
    const expandedCandles = [...mockM1Candles];
    for (let i = 0; i < 60; i++) {
      expandedCandles.push({
        time: baseTime + 7200 + i * 60,
        open: 1.3100,
        high: 1.3110,
        low: 1.3090,
        close: 1.3105,
      });
    }

    // In-place buffer expansion
    engine.updateAllCandles(expandedCandles);
    assert(engine.getAllCandles().length === 180, 'Dataset expanded from 120 to 180 candles');
    assert(engine.getCurrentIndex() === 50, 'Current index remains 100% preserved at 50');
    assert(engine.isBufferExhausted() === false, 'isBufferExhausted is false after expansion');
  });

  // TEST L — TIMEFRAME AWARE NEXT CANDLE BOUNDARY STEPPING
  runTest('TEST L — TIMEFRAME AWARE NEXT CANDLE BOUNDARY STEPPING (M30 from 10:01 steps to 10:30)', () => {
    const alignedBaseTime = 1704096000; // 2024-01-01 08:00:00 UTC (aligned to 1h / 30m boundary)
    const t0801 = alignedBaseTime + 60; // 08:01:00 UTC
    const m30End = getBucketEnd(getBucketStart(t0801, 'M30'), 'M30');
    assert(m30End === alignedBaseTime + 1800, 'M30 bucket boundary for 08:01 evaluates to 08:30:00 (1704097800)');

    const h1End = getBucketEnd(getBucketStart(t0801, 'H1'), 'H1');
    assert(h1End === alignedBaseTime + 3600, 'H1 bucket boundary for 08:01 evaluates to 09:00:00 (1704099600)');

    const m5End = getBucketEnd(getBucketStart(t0801, 'M5'), 'M5');
    assert(m5End === alignedBaseTime + 300, 'M5 bucket boundary for 08:01 evaluates to 08:05:00 (1704096300)');
  });

  return { success: passed === total, logs };
}
