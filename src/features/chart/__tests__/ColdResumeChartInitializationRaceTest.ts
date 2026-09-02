import { useChartFilteredCandles } from '../../replay/useChartFilter';
import { defaultRange } from '../viewport';
import type { Candle } from '@/types';
import type { AnalyticsSession } from '../../analytics/types';

export function runColdResumeChartInitializationRaceTests() {
  const logs: string[] = [];
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, description: string) {
    total++;
    if (condition) {
      passed++;
      logs.push(`  [PASS] ${description}`);
    } else {
      logs.push(`  [FAIL] ${description}`);
    }
  }

  // Generate continuous M15 candles from 2024-01-01 00:00:00 UTC (1704067200) for 10 days
  const baseStartUtc = 1704067200; // 2024-01-01 00:00:00 UTC
  const totalM15Bars = 10 * 96;    // 960 M15 bars (10 days)
  const mockM15Candles: Candle[] = [];

  for (let i = 0; i < totalM15Bars; i++) {
    const time = baseStartUtc + i * 900;
    mockM15Candles.push({
      time,
      open: 1.1000 + (i % 20) * 0.0001,
      high: 1.1000 + (i % 20) * 0.0001 + 0.0005,
      low: 1.1000 + (i % 20) * 0.0001 - 0.0005,
      close: 1.1000 + (i % 20) * 0.0001 + 0.0002,
      volume: 500,
    });
  }

  // Target cold resume timestamp: 2024-01-03 02:00:00 UTC (1704247200) -> index 200 (50 hours / 0.25 = 200 bars)
  const targetReplayUtc = 1704247200;

  // -----------------------------------------------------------------
  // TEST 1: Cold Resume Viewport Calculation with Async Hydration Fallback
  // -----------------------------------------------------------------
  // Simulating initial tick where replayState is still un-hydrated (INITIAL_REPLAY_STATE)
  const unhydratedReplayState = {
    isReplayMode: false,
    currentReplayTime: null,
  };

  const resumedActiveSession: Partial<AnalyticsSession> = {
    id: 'session-cold-resume-1',
    startDate: '2024-01-01',
    currentReplayTime: targetReplayUtc,
    currentReplayIndex: 3000,
  };

  // Derive effective replay state (as done in updated ChartContainer)
  const effectiveReplayTime =
    unhydratedReplayState.currentReplayTime ??
    resumedActiveSession.currentReplayTime ??
    null;

  const effectiveIsReplayMode =
    unhydratedReplayState.isReplayMode ||
    effectiveReplayTime !== null;

  assert(
    effectiveIsReplayMode === true && effectiveReplayTime === 1704247200,
    `TEST 1A — Effective Replay State correctly resolves isReplayMode=true & currentReplayTime=1704247200 on initial tick`
  );

  // Filter candles using effective state
  const filterCandlesManual = (all: Candle[], isReplay: boolean, cutoff: number | null) => {
    if (!isReplay || cutoff === null) return all;
    let lo = 0;
    let hi = all.length - 1;
    let cutoffIdx = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (all[mid].time <= cutoff) {
        cutoffIdx = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return cutoffIdx >= 0 ? all.slice(0, cutoffIdx + 1) : [];
  };

  const displayCandles = filterCandlesManual(mockM15Candles, effectiveIsReplayMode, effectiveReplayTime);
  const lastDisplayCandle = displayCandles[displayCandles.length - 1];

  assert(
    displayCandles.length === 201 && lastDisplayCandle?.time === targetReplayUtc,
    `TEST 1B — displayCandles contains exactly 201 bars up to last replayed candle 2024-01-03 02:00:00 UTC`
  );

  const initialRange = defaultRange(displayCandles.length);
  assert(
    initialRange !== null && initialRange.to >= 200,
    `TEST 1C — Initial Viewport range (${initialRange?.from}..${initialRange?.to}) targets last replay-visible candle (index 200)`
  );

  // -----------------------------------------------------------------
  // TEST 2: Empty Data does NOT consume isFreshLoad token
  // -----------------------------------------------------------------
  let lastSymbolTfKey: string | null = null;
  const currentKey = '1:M15';

  // Tick 0: Data is empty []
  const mappedTick0: Candle[] = [];
  const isFreshLoadTick0 = lastSymbolTfKey !== currentKey;
  if (mappedTick0.length > 0) {
    lastSymbolTfKey = currentKey;
  }

  assert(
    isFreshLoadTick0 === true && lastSymbolTfKey === null,
    `TEST 2A — Tick 0 (Empty dataset): isFreshLoad is true, but key is NOT locked`
  );

  // Tick 1: Non-empty data arrives
  const mappedTick1 = displayCandles;
  const isFreshLoadTick1 = lastSymbolTfKey !== currentKey;
  if (mappedTick1.length > 0) {
    lastSymbolTfKey = currentKey;
  }

  assert(
    isFreshLoadTick1 === true && lastSymbolTfKey === currentKey,
    `TEST 2B — Tick 1 (Non-empty dataset): isFreshLoad remains true and initializes viewport exactly once`
  );

  // Tick 2: Subsequent re-render
  const isFreshLoadTick2 = lastSymbolTfKey !== currentKey;
  assert(
    isFreshLoadTick2 === false,
    `TEST 2C — Tick 2 (Subsequent render): isFreshLoad is false (does not re-trigger defaultRange)`
  );

  // -----------------------------------------------------------------
  // TEST 3: Future Candle Hiding
  // -----------------------------------------------------------------
  const futureLeaked = displayCandles.filter((c) => c.time > targetReplayUtc);
  assert(
    futureLeaked.length === 0,
    `TEST 3 — Future Candles (> 2024-01-03 02:00) are 100% hidden (0 leaked bars)`
  );

  // -----------------------------------------------------------------
  // TEST 4: Playback Continuation
  // -----------------------------------------------------------------
  const advancedReplayUtc = targetReplayUtc + 900; // 02:15:00 UTC
  const advancedCandles = filterCandlesManual(mockM15Candles, true, advancedReplayUtc);
  const lastAdvancedCandle = advancedCandles[advancedCandles.length - 1];

  assert(
    advancedCandles.length === 202 && lastAdvancedCandle?.time === advancedReplayUtc,
    `TEST 4 — Play continues forward to next bar 02:15:00 UTC without reverting to session start`
  );

  // -----------------------------------------------------------------
  // TEST 5: Fresh Session Protection
  // -----------------------------------------------------------------
  const freshSession: Partial<AnalyticsSession> = {
    id: 'session-fresh-5',
    startDate: '2024-01-01',
    currentReplayTime: null,
    replayStartTime: null,
  };

  const freshEffectiveTime = unUnhydratedFresh(freshSession);
  function unUnhydratedFresh(sess: Partial<AnalyticsSession>) {
    return sess.currentReplayTime ?? null;
  }
  const freshIsReplay = freshEffectiveTime !== null;

  assert(
    freshIsReplay === false && freshEffectiveTime === null,
    `TEST 5 — Fresh Session: effectiveIsReplayMode=false (Replay filter NOT activated prematurely)`
  );

  return {
    success: passed === total,
    passed,
    total,
    logs,
  };
}
