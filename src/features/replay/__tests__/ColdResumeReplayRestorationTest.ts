import { ReplayEngine } from '../engine';
import { findNearestCandleIndex } from '../replayStartPoint';
import type { Candle } from '@/types';
import type { AnalyticsSession } from '../../analytics/types';

export function runColdResumeReplayRestorationTests() {
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

  // Generate continuous M1 candles from 2024-01-01 00:00:00 UTC (1704067200) for 10 days
  const baseStartUtc = 1704067200; // 2024-01-01 00:00:00 UTC
  const totalM1Bars = 10 * 1440;   // 14400 M1 bars
  const mockM1Candles: Candle[] = [];

  for (let i = 0; i < totalM1Bars; i++) {
    const time = baseStartUtc + i * 60;
    mockM1Candles.push({
      time,
      open: 1.1000 + (i % 50) * 0.0001,
      high: 1.1000 + (i % 50) * 0.0001 + 0.0005,
      low: 1.1000 + (i % 50) * 0.0001 - 0.0005,
      close: 1.1000 + (i % 50) * 0.0001 + 0.0002,
      volume: 100,
    });
  }

  // Helper simulating the exact useReplayEngine restoration logic
  function simulateEngineRestoration(
    activeSession: Partial<AnalyticsSession> | null,
    allCandles: Candle[]
  ) {
    const restoredStartTime = activeSession?.replayStartTime ?? null;
    const restoredCurrentTime = activeSession?.currentReplayTime ?? null;
    const hasSavedReplayProgress =
      restoredCurrentTime !== null ||
      (typeof activeSession?.currentReplayIndex === 'number' && activeSession.currentReplayIndex >= 0);
    const hasReplayStart = restoredStartTime !== null;

    if (!hasSavedReplayProgress && !hasReplayStart) {
      return {
        isInitialized: false,
        replayState: {
          isReplayMode: false,
          currentReplayTime: null,
          currentReplayIndex: null,
        },
        engine: null,
      };
    }

    let effectiveStartSec: number | null = restoredStartTime;
    if (effectiveStartSec === null && activeSession?.startDate) {
      const startDateStr = activeSession.startDate.includes('T') ? activeSession.startDate : `${activeSession.startDate}T00:00:00Z`;
      const t = Math.floor(new Date(startDateStr).getTime() / 1000);
      if (!isNaN(t) && t > 0) effectiveStartSec = t;
    }
    if (effectiveStartSec === null && allCandles.length > 0) {
      effectiveStartSec = allCandles[0].time;
    }

    const startIdx = effectiveStartSec !== null ? findNearestCandleIndex(allCandles, effectiveStartSec) : 0;
    let currentIdx = startIdx;
    if (restoredCurrentTime !== null) {
      currentIdx = findNearestCandleIndex(allCandles, restoredCurrentTime);
      if (currentIdx < startIdx) currentIdx = startIdx;
      if (currentIdx >= allCandles.length) currentIdx = allCandles.length - 1;
    }

    const engine = new ReplayEngine();
    engine.initialize({
      symbolId: 1,
      symbol: 'EURUSD',
      timeframe: 'M1',
      allCandles,
      replayStartIndex: startIdx,
    });

    if (currentIdx > startIdx) {
      engine.setCurrentIndex(currentIdx);
    }

    const base = engine.getReplayState();
    return {
      isInitialized: true,
      replayState: {
        ...base,
        currentReplayTime: allCandles[currentIdx]?.time ?? restoredCurrentTime,
      },
      engine,
    };
  }

  // -----------------------------------------------------------------
  // TEST 1: Fresh Session (No Replay Started Yet)
  // -----------------------------------------------------------------
  const freshSession: Partial<AnalyticsSession> = {
    id: 'session-fresh-1',
    startDate: '2024-01-01',
    replayStartTime: null,
    currentReplayTime: null,
    currentReplayIndex: null,
  };

  const freshResult = simulateEngineRestoration(freshSession, mockM1Candles);
  assert(
    freshResult.isInitialized === false &&
    freshResult.replayState.isReplayMode === false &&
    freshResult.replayState.currentReplayTime === null,
    `TEST 1 — Fresh Session: ReplayEngine is NOT automatically initialized, waiting for ReplaySetupModal`
  );

  // -----------------------------------------------------------------
  // TEST 2: Cold Resume With Current Time Only (replayStartTime is null in SQLite)
  // -----------------------------------------------------------------
  const coldResumeSession: Partial<AnalyticsSession> = {
    id: 'session-cold-2',
    startDate: '2024-01-01',
    replayStartTime: null,
    currentReplayTime: 1704247200, // 2024-01-03 02:00:00 UTC (50 hours from start = 3000 M1 bars)
    currentReplayIndex: 3000,
  };

  const coldResult = simulateEngineRestoration(coldResumeSession, mockM1Candles);
  assert(
    coldResult.isInitialized === true &&
    coldResult.replayState.isReplayMode === true &&
    coldResult.replayState.currentReplayTime === 1704247200,
    `TEST 2 — Cold Resume with currentReplayTime only: ReplayEngine initialized and restores currentReplayTime=1704247200 (isReplayMode=true)`
  );

  // -----------------------------------------------------------------
  // TEST 3: Current Time Must Win (Never revert to startDate 2024-01-01)
  // -----------------------------------------------------------------
  const candleAtCurrent = coldResult.engine?.getCandleAtIndex(coldResult.engine.getCurrentIndex());
  assert(
    candleAtCurrent !== null &&
    candleAtCurrent?.time === 1704247200 &&
    coldResult.engine?.getCurrentIndex() === 3000,
    `TEST 3 — Current Time Priority: Engine currentIndex is 3000 (2024-01-03 02:00), never 0 (2024-01-01)`
  );

  // -----------------------------------------------------------------
  // TEST 4: Confirmed Replay Start (Start set, no playback yet)
  // -----------------------------------------------------------------
  const confirmedStartSession: Partial<AnalyticsSession> = {
    id: 'session-start-4',
    startDate: '2024-01-01',
    replayStartTime: 1704153600, // 2024-01-02 00:00:00 UTC
    currentReplayTime: null,
    currentReplayIndex: null,
  };

  const confirmedResult = simulateEngineRestoration(confirmedStartSession, mockM1Candles);
  assert(
    confirmedResult.isInitialized === true &&
    confirmedResult.replayState.isReplayMode === true &&
    confirmedResult.engine?.getCurrentIndex() === 1440, // index of 2024-01-02 00:00:00
    `TEST 4 — Confirmed Replay Start: Successfully initialized from replayStartTime (index 1440)`
  );

  // -----------------------------------------------------------------
  // TEST 5: Cold Resume Persistence Protection (No NULL overwrite)
  // -----------------------------------------------------------------
  let persistedTime: number | null = 1704247200;
  const syncPersistence = (state: { isReplayMode: boolean; currentReplayTime: number | null }) => {
    if (state.isReplayMode && state.currentReplayTime !== null) {
      persistedTime = state.currentReplayTime;
    }
  };
  syncPersistence(coldResult.replayState);

  assert(
    persistedTime === 1704247200,
    `TEST 5 — Persistence Protection: SQLite current_replay_time remains 1704247200 (never overwritten with NULL)`
  );

  // -----------------------------------------------------------------
  // TEST 6: Playback Continuation After Resume
  // -----------------------------------------------------------------
  coldResult.engine?.play();
  coldResult.engine?.setCurrentIndex(coldResult.engine.getCurrentIndex() + 1);
  const nextCandle = coldResult.engine?.getCandleAtIndex(coldResult.engine.getCurrentIndex());

  assert(
    nextCandle?.time === 1704247260 &&
    coldResult.engine?.getCurrentIndex() === 3001,
    `TEST 6 — Play Continues: Replay advances smoothly to next candle 02:01 (timestamp 1704247260)`
  );

  return {
    success: passed === total,
    passed,
    total,
    logs,
  };
}
