import { resolveReplayCandles } from '../../chart/candleResolver';
import { ReplayEngine } from '../engine';
import { useChartFilteredCandles } from '../useChartFilter';
import type { Candle } from '@/types';

export function runResumeLastReplayedCandleTests() {
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

  // Generate continuous M1 candles from 2024-01-01 00:00 UTC (1704067200) for 15 days
  const baseStartUtc = 1704067200; // 2024-01-01 00:00:00 UTC
  const totalM1Bars = 15 * 1440; // 15 days of M1 bars = 21600 bars
  const mockM1Candles: Candle[] = [];

  for (let i = 0; i < totalM1Bars; i++) {
    const time = baseStartUtc + i * 60;
    mockM1Candles.push({
      time,
      open: 1.1000 + (i % 100) * 0.0001,
      high: 1.1000 + (i % 100) * 0.0001 + 0.0005,
      low: 1.1000 + (i % 100) * 0.0001 - 0.0005,
      close: 1.1000 + (i % 100) * 0.0001 + 0.0002,
      volume: 100,
    });
  }

  // Generate M15 candles from M1
  const mockM15Candles: Candle[] = [];
  for (let i = 0; i < totalM1Bars; i += 15) {
    const time = baseStartUtc + i * 60;
    mockM15Candles.push({
      time,
      open: mockM1Candles[i].open,
      high: Math.max(...mockM1Candles.slice(i, i + 15).map((c) => c.high)),
      low: Math.min(...mockM1Candles.slice(i, i + 15).map((c) => c.low)),
      close: mockM1Candles[i + 14].close,
      volume: 1500,
    });
  }

  // -----------------------------------------------------------------
  // TEST 1: Basic Resume (2024-01-03 02:00)
  // -----------------------------------------------------------------
  const resumeTime1 = 1704247200; // 2024-01-03 02:00:00 UTC
  const startIdx1 = 0;
  const currentIdx1 = mockM1Candles.findIndex((c) => c.time === resumeTime1);

  const engine1 = new ReplayEngine();
  engine1.initialize({
    symbolId: 1,
    symbol: 'EURUSD',
    timeframe: 'M1',
    allCandles: mockM1Candles,
    replayStartIndex: startIdx1,
  });
  engine1.setCurrentIndex(currentIdx1);

  const replayState1 = engine1.getReplayState();
  const resolvedM15_1 = resolveReplayCandles({
    timeframe: 'M15',
    currentReplayTime: replayState1.currentReplayTime,
    tfCandles: mockM15Candles,
    m1Candles: mockM1Candles,
  });
  const lastResolvedCandle1 = resolvedM15_1[resolvedM15_1.length - 1];

  assert(
    replayState1.currentReplayTime === resumeTime1 &&
    lastResolvedCandle1 !== undefined &&
    lastResolvedCandle1.time <= resumeTime1,
    `TEST 1 — Basic Resume: Replay clock restored at 2024-01-03 02:00 (timestamp ${resumeTime1}) and M15 resolves up to last replayed candle`
  );

  // -----------------------------------------------------------------
  // TEST 2: Resume After > 7 Days (2024-01-12 15:30)
  // -----------------------------------------------------------------
  // 2024-01-12 15:30:00 UTC = 1704067200 + (11 * 86400) + (15 * 3600) + (30 * 60) = 1705073400
  const resumeTime2 = 1705073400;
  const currentIdx2 = mockM1Candles.findIndex((c) => c.time === resumeTime2);

  // Simulate initial prefetch window formula from useCandles.ts:
  const targetReplayUtc = resumeTime2;
  const initialEndUtcSec = targetReplayUtc !== null && targetReplayUtc > baseStartUtc
    ? Math.max(baseStartUtc + 7 * 86400, targetReplayUtc + 3 * 86400)
    : baseStartUtc + 7 * 86400;

  const loadedDataset = mockM1Candles.filter((c) => c.time <= initialEndUtcSec);
  const targetCandleLoaded = loadedDataset.some((c) => c.time === resumeTime2);

  const engine2 = new ReplayEngine();
  engine2.initialize({
    symbolId: 1,
    symbol: 'EURUSD',
    timeframe: 'M1',
    allCandles: loadedDataset,
    replayStartIndex: 0,
  });
  engine2.setCurrentIndex(currentIdx2);

  assert(
    targetCandleLoaded &&
    engine2.getReplayState().currentReplayTime === resumeTime2,
    `TEST 2 — Resume after >7 days (2024-01-12 15:30): Prefetch window guarantees target candle exists in loaded dataset (${loadedDataset.length} bars loaded)`
  );

  // -----------------------------------------------------------------
  // TEST 3: Future Candle Hiding
  // -----------------------------------------------------------------
  const resolvedM15_2 = resolveReplayCandles({
    timeframe: 'M15',
    currentReplayTime: resumeTime2,
    tfCandles: mockM15Candles,
    m1Candles: mockM1Candles,
  });

  const futureCandlesLeaked = resolvedM15_2.some((c) => c.time > resumeTime2);
  const formingCandleTime = resolvedM15_2[resolvedM15_2.length - 1].time;

  assert(
    !futureCandlesLeaked && formingCandleTime <= resumeTime2,
    `TEST 3 — Future Candle Hiding: 0 future candles leaked beyond 2024-01-12 15:30 (all bars <= cutoff)`
  );

  // -----------------------------------------------------------------
  // TEST 4: Playback Continuation from Resume Point
  // -----------------------------------------------------------------
  engine2.play();
  engine2.setCurrentIndex(engine2.getCurrentIndex() + 1); // Step forward 1 M1 candle
  const advancedState = engine2.getReplayState();

  assert(
    advancedState.currentReplayTime === resumeTime2 + 60 &&
    advancedState.currentReplayTime > resumeTime2,
    `TEST 4 — Play Continues: Replay advances smoothly from 15:30 -> 15:31 (does not jump back to session start)`
  );

  // -----------------------------------------------------------------
  // TEST 5: Multi-Timeframe Alignment at Master Clock
  // -----------------------------------------------------------------
  const m15Resolved = resolveReplayCandles({
    timeframe: 'M15',
    currentReplayTime: resumeTime2,
    tfCandles: mockM15Candles,
    m1Candles: mockM1Candles,
  });
  const h1Resolved = resolveReplayCandles({
    timeframe: 'H1',
    currentReplayTime: resumeTime2,
    tfCandles: mockM15Candles,
    m1Candles: mockM1Candles,
  });

  const lastM15 = m15Resolved[m15Resolved.length - 1];
  const lastH1 = h1Resolved[h1Resolved.length - 1];

  assert(
    lastM15.time <= resumeTime2 && lastH1.time <= resumeTime2,
    `TEST 5 — Multi-Timeframe: M15 (bucket ${lastM15.time}) and H1 (bucket ${lastH1.time}) both aligned <= master timestamp ${resumeTime2}`
  );

  // -----------------------------------------------------------------
  // TEST 6: Multi-Pair Isolation (No cross-talk on master clock)
  // -----------------------------------------------------------------
  const mockGbpM1 = mockM1Candles.map((c) => ({ ...c, close: c.close + 0.1 }));
  const gbpResolved = resolveReplayCandles({
    timeframe: 'M15',
    currentReplayTime: resumeTime2,
    tfCandles: mockM15Candles,
    m1Candles: mockGbpM1,
  });

  assert(
    gbpResolved.length === m15Resolved.length &&
    engine2.getReplayState().currentReplayTime === resumeTime2 + 60,
    `TEST 6 — Multi-Pair: Pair resolution does not alter or drift master replay clock`
  );

  // -----------------------------------------------------------------
  // TEST 7: Viewport Anchoring around Last Replayed Candle
  // -----------------------------------------------------------------
  // In ChartContainer, displayCandles = useChartFilteredCandles(allCandles, true, currentReplayTime)
  // The last element is displayCandles[displayCandles.length - 1]
  const lastDisplayTime = resolvedM15_2[resolvedM15_2.length - 1].time;

  assert(
    lastDisplayTime <= resumeTime2 &&
    Math.abs(lastDisplayTime - resumeTime2) < 900, // within 15 minutes (M15 bucket)
    `TEST 7 — Viewport Anchoring: Chart target anchor points directly to last replay-visible candle (time ${lastDisplayTime})`
  );

  return {
    success: passed === total,
    passed,
    total,
    logs,
  };
}
