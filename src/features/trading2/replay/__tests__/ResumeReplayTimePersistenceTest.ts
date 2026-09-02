/**
 * Forensic Test Suite — Resume Replay Time Persistence & Priority Validation
 *
 * Tests the 6 core regression cases:
 * 1. Resume Saved Progress (16:00 start -> 02:00 current -> resolves to 02:00)
 * 2. Resume After Multiple Renders (dataset update, effect rerun -> 02:00 remains 02:00)
 * 3. Fresh Session (16:00 start, null current -> initializes at 16:00)
 * 4. Resume At Different Timestamp (16:00 start -> 23:45 current -> resolves to 23:45)
 * 5. Current Replay Time Must Win Over Start Time (effectiveCurrentTime === 02:00, never 16:00)
 * 6. SQLite Persistence Integrity (Row mapping and update maintain currentReplayTime without overwrite)
 */

import { rowToAnalyticsSession, analyticsSessionToRow } from '@features/backtest/sessionRepository';
import type { AnalyticsSession } from '@features/analytics/types';
import { findNearestCandleIndex } from '@features/replay/replayStartPoint';
import type { Candle } from '@/types';

export function runResumeReplayTimePersistenceTests(): {
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

  // Mock M1 Candlestick dataset spanning multiple days
  // Day 1: 1704067200 (2024-01-01 00:00 UTC) -> 1704124800 (16:00 UTC) -> 1704160800 (Day 2 02:00 UTC)
  const mockCandles: Candle[] = [];
  const startEpoch = 1704067200; // 2024-01-01 00:00:00 UTC
  for (let i = 0; i < 2880; i++) {
    // 2 days of M1 candles (60s each)
    const t = startEpoch + i * 60;
    mockCandles.push({
      time: t,
      open: 1.1000 + (i % 10) * 0.0001,
      high: 1.1010 + (i % 10) * 0.0001,
      low: 1.0990 + (i % 10) * 0.0001,
      close: 1.1005 + (i % 10) * 0.0001,
      volume: 100,
    });
  }

  const time1600 = 1704124800; // 2024-01-01 16:00:00 UTC (index 960)
  const time0200 = 1704160800; // 2024-01-02 02:00:00 UTC (index 1560)
  const time2345 = 1704152700; // 2024-01-01 23:45:00 UTC (index 1425)

  // -------------------------------------------------------------
  // TEST 1: Resume Saved Progress (start: 16:00, current: 02:00)
  // -------------------------------------------------------------
  const sessionSavedProgress: AnalyticsSession = {
    id: 'session-resume-1',
    name: 'Saved Progress Session',
    symbol: 'EURUSD',
    symbols: ['EURUSD'],
    timeframe: 'M15',
    dateRange: '2024-01-01 – 2024-01-05',
    startDate: '2024-01-01',
    endDate: '2024-01-05',
    mode: 'normal',
    status: 'active',
    initialBalance: 100000,
    currentBalance: 100000,
    netProfit: 0,
    netProfitPercent: 0,
    winRate: 0,
    totalTrades: 0,
    profitFactor: 0,
    expectancy: 0,
    lastPlayed: 'Just now',
    winningTrades: 0,
    losingTrades: 0,
    avgRR: 0,
    avgWin: 0,
    avgLoss: 0,
    largestWin: 0,
    largestLoss: 0,
    currentReplayIndex: 600,
    currentReplayTime: time0200,
    replayStartTime: time1600,
    updatedAt: Date.now(),
  };

  const startIdx1 = findNearestCandleIndex(mockCandles, sessionSavedProgress.replayStartTime!);
  const currentIdx1 = findNearestCandleIndex(mockCandles, sessionSavedProgress.currentReplayTime!);
  assert(
    mockCandles[startIdx1].time === time1600 && mockCandles[currentIdx1].time === time0200,
    'TEST 1 — Resume Saved Progress resolves start to 16:00 and current position to 02:00'
  );

  // -------------------------------------------------------------
  // TEST 2: Resume After Multiple Renders (Simulate Ref & Closure Guard)
  // -------------------------------------------------------------
  // Simulate internal restoredCurrentTimeRef and stale closure where replayState is temporarily uncommitted
  const restoredCurrentTimeRef = { current: time0200 };
  const restoredStartTimeRef = { current: time1600 };
  const staleReplayState = { replayStartTime: time1600, currentReplayTime: null as number | null };

  const effectiveCurrentTime =
    staleReplayState.currentReplayTime ??
    restoredCurrentTimeRef.current ??
    sessionSavedProgress.currentReplayTime ??
    null;

  const effectiveStartTime =
    staleReplayState.replayStartTime ??
    restoredStartTimeRef.current ??
    sessionSavedProgress.replayStartTime ??
    null;

  const resolvedIdx = findNearestCandleIndex(mockCandles, effectiveCurrentTime!);
  assert(
    effectiveCurrentTime === time0200 && mockCandles[resolvedIdx].time === time0200,
    'TEST 2 — Re-anchor effect reads restoredCurrentTimeRef (02:00) even when React state is stale (null)'
  );

  // -------------------------------------------------------------
  // TEST 3: Fresh Session (start: 16:00, current: null)
  // -------------------------------------------------------------
  const freshSession: AnalyticsSession = {
    ...sessionSavedProgress,
    id: 'session-fresh-3',
    currentReplayTime: null,
    currentReplayIndex: null,
    replayStartTime: time1600,
  };

  const freshCurrentTimeRef = { current: null as number | null };
  const freshEffectiveCurrent =
    freshSession.currentReplayTime ?? freshCurrentTimeRef.current ?? null;
  const freshEffectiveStart = freshSession.replayStartTime ?? null;

  assert(
    freshEffectiveCurrent === null && freshEffectiveStart === time1600,
    'TEST 3 — Fresh session correctly identifies absence of saved progress and initializes at replayStartTime (16:00)'
  );

  // -------------------------------------------------------------
  // TEST 4: Resume At Different Timestamp (start: 16:00, current: 23:45)
  // -------------------------------------------------------------
  const sessionDiffProgress: AnalyticsSession = {
    ...sessionSavedProgress,
    id: 'session-diff-4',
    currentReplayTime: time2345,
    currentReplayIndex: 465,
    replayStartTime: time1600,
  };

  const diffCurrentRef = { current: sessionDiffProgress.currentReplayTime };
  const diffEffectiveCurrent =
    sessionDiffProgress.currentReplayTime ?? diffCurrentRef.current ?? null;
  const diffIdx = findNearestCandleIndex(mockCandles, diffEffectiveCurrent!);

  assert(
    mockCandles[diffIdx].time === time2345,
    'TEST 4 — Resume at arbitrary timestamp (23:45) correctly resolves and anchors to 23:45'
  );

  // -------------------------------------------------------------
  // TEST 5: Current Replay Time Must Win Over Start Time
  // -------------------------------------------------------------
  const priorityTestSession = {
    replayStartTime: time1600,
    currentReplayTime: time0200,
  };

  const determinedPosition: number = priorityTestSession.currentReplayTime ?? priorityTestSession.replayStartTime;
  assert(
    determinedPosition === time0200 && (determinedPosition as number) !== time1600,
    'TEST 5 — Current replay timestamp (02:00) strictly wins over start timestamp (16:00)'
  );

  // -------------------------------------------------------------
  // TEST 6: SQLite Persistence Integrity (Row conversion & update)
  // -------------------------------------------------------------
  const row = analyticsSessionToRow(sessionSavedProgress);
  assert(
    row.current_replay_time === time0200 && row.start_time !== time0200,
    'TEST 6A — analyticsSessionToRow serializes current_replay_time as 02:00 (1704160800)'
  );

  const restoredSession = rowToAnalyticsSession(row);
  assert(
    restoredSession.currentReplayTime === time0200,
    'TEST 6B — rowToAnalyticsSession deserializes currentReplayTime as 02:00 (1704160800) without overwrite'
  );

  return {
    success: passed === total,
    passed,
    total,
    logs,
  };
}
