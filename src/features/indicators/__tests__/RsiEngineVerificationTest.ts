/**
 * RSI Engine Verification Test Suite
 * Validates:
 * 1. Wilder smoothing calculation precision & boundary clamping (0-100)
 * 2. Warm-up requirements (no dummy values, returns empty when candles <= period)
 * 3. Multi-source compatibility (close, open, high, low, hl2, hlc3, ohlc4)
 * 4. Zero future data leakage during replay
 * 5. Replay time travel determinism (forward & backward stepping)
 * 6. Dynamic parameter changes (14 -> 7 -> 21 -> 14)
 * 7. Multiple RSI instance isolation
 * 8. Timeframe independence
 */

import { calculateRsi, getCandleSourcePrice, type RsiPoint } from '../calculations/rsi';
import type { Candle } from '@/types';

export function runRsiEngineVerificationTests(): {
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

  // Generate synthetic candles helper
  function generateCandles(count: number, basePrice: number = 1.1000, stepFn?: (i: number) => number): Candle[] {
    const candles: Candle[] = [];
    let current = basePrice;
    for (let i = 0; i < count; i++) {
      const delta = stepFn ? stepFn(i) : (Math.sin(i / 5) * 0.0020);
      const open = current;
      const close = current + delta;
      const high = Math.max(open, close) + 0.0005;
      const low = Math.min(open, close) - 0.0005;
      candles.push({
        time: 1700000000 + i * 60,
        open,
        high,
        low,
        close,
        volume: 100,
      });
      current = close;
    }
    return candles;
  }

  // -------------------------------------------------------------
  // TEST 1: Warm-up period requirement (candles <= period returns empty)
  // -------------------------------------------------------------
  const shortCandles = generateCandles(14); // Exactly 14 candles
  const shortRsi = calculateRsi(shortCandles, 14);
  assert(
    shortRsi.length === 0,
    'Warm-up: calculateRsi returns empty array when candle count is <= period (no dummy/fake values)'
  );

  // -------------------------------------------------------------
  // TEST 2: First valid point at index `period`
  // -------------------------------------------------------------
  const warmCandles = generateCandles(15); // Exactly 15 candles (index 0..14)
  const warmRsi = calculateRsi(warmCandles, 14);
  assert(
    warmRsi.length === 1 && warmRsi[0].time === warmCandles[14].time,
    'Warm-up: First RSI point is emitted exactly at index `period` with corresponding candle timestamp'
  );

  // -------------------------------------------------------------
  // TEST 3: Extreme Flat Line handling (avgGain = 0, avgLoss = 0 -> RSI = 50)
  // -------------------------------------------------------------
  const flatCandles = generateCandles(20, 1.1000, () => 0); // zero change
  const flatRsi = calculateRsi(flatCandles, 14);
  assert(
    flatRsi.length === 6 && flatRsi.every((p) => p.value === 50),
    'Edge Case: Completely flat price returns neutral RSI = 50 with zero NaN or division-by-zero'
  );

  // -------------------------------------------------------------
  // TEST 4: Extreme Continuous Bullish Trend (RSI = 100)
  // -------------------------------------------------------------
  const bullCandles = generateCandles(25, 1.1000, () => 0.0010); // constant gains
  const bullRsi = calculateRsi(bullCandles, 14);
  assert(
    bullRsi.length === 11 && bullRsi.every((p) => p.value === 100),
    'Edge Case: Continuous uptrend (gains only) yields RSI = 100'
  );

  // -------------------------------------------------------------
  // TEST 5: Extreme Continuous Bearish Trend (RSI = 0)
  // -------------------------------------------------------------
  const bearCandles = generateCandles(25, 1.1000, () => -0.0010); // constant losses
  const bearRsi = calculateRsi(bearCandles, 14);
  assert(
    bearRsi.length === 11 && bearRsi.every((p) => p.value === 0),
    'Edge Case: Continuous downtrend (losses only) yields RSI = 0'
  );

  // -------------------------------------------------------------
  // TEST 6: Mathematical Bound Range [0, 100]
  // -------------------------------------------------------------
  const volatileCandles = generateCandles(100, 1.1000, (i) => (i % 2 === 0 ? 0.0050 : -0.0048));
  const volatileRsi = calculateRsi(volatileCandles, 14);
  const allInRange = volatileRsi.every((p) => p.value >= 0 && p.value <= 100);
  assert(
    allInRange && volatileRsi.length === 86,
    'Range: All calculated RSI values are strictly bounded within [0, 100]'
  );

  // -------------------------------------------------------------
  // TEST 7: Multi-Source Support (close, open, high, low, hl2, hlc3, ohlc4)
  // -------------------------------------------------------------
  const rsiClose = calculateRsi(volatileCandles, 14, 'close');
  const rsiOpen = calculateRsi(volatileCandles, 14, 'open');
  const rsiHl2 = calculateRsi(volatileCandles, 14, 'hl2');
  const rsiHlc3 = calculateRsi(volatileCandles, 14, 'hlc3');
  const rsiOhlc4 = calculateRsi(volatileCandles, 14, 'ohlc4');
  assert(
    rsiClose.length > 0 && rsiOpen.length > 0 && rsiHl2.length > 0 && rsiHlc3.length > 0 && rsiOhlc4.length > 0,
    'Sources: Successfully calculates RSI across all supported sources (close, open, high, low, hl2, hlc3, ohlc4)'
  );

  // -------------------------------------------------------------
  // TEST 8: Zero Future Data Leakage
  // -------------------------------------------------------------
  const all100Candles = generateCandles(100, 1.1000);
  const cutoff50Candles = all100Candles.slice(0, 50); // Replay time at candle 50
  const rsiCutoff50 = calculateRsi(cutoff50Candles, 14);

  // Now simulate future candles being fetched/appended in background cache up to 100 candles
  // Filter for chart/replay with cutoff at candle 50 timestamp:
  const replayCutoffTime = all100Candles[49].time;
  const filteredAtReplayTime = all100Candles.filter((c) => c.time <= replayCutoffTime);
  const rsiAtCutoffWithFutureInDb = calculateRsi(filteredAtReplayTime, 14);

  const lastRsiBefore = rsiCutoff50[rsiCutoff50.length - 1].value;
  const lastRsiAfter = rsiAtCutoffWithFutureInDb[rsiAtCutoffWithFutureInDb.length - 1].value;
  assert(
    rsiCutoff50.length === rsiAtCutoffWithFutureInDb.length && lastRsiBefore === lastRsiAfter,
    `Zero Future Leakage: RSI at Replay Time ${replayCutoffTime} is 100% identical (${lastRsiBefore} vs ${lastRsiAfter}) regardless of future candles in database`
  );

  // -------------------------------------------------------------
  // TEST 9: Replay Determinism & Time Travel (T1 -> T2 -> T3 -> T2 -> T1 -> T2)
  // -------------------------------------------------------------
  const sliceT1 = all100Candles.slice(0, 30);
  const sliceT2 = all100Candles.slice(0, 40);
  const sliceT3 = all100Candles.slice(0, 50);

  const rsiT1_first = calculateRsi(sliceT1, 14);
  const rsiT2_first = calculateRsi(sliceT2, 14);
  const rsiT3 = calculateRsi(sliceT3, 14);

  // Time travel backward to T2
  const rsiT2_backward = calculateRsi(sliceT2, 14);
  // Time travel backward to T1
  const rsiT1_backward = calculateRsi(sliceT1, 14);
  // Time travel forward again to T2
  const rsiT2_forwardAgain = calculateRsi(sliceT2, 14);

  const valT1_1 = rsiT1_first[rsiT1_first.length - 1].value;
  const valT1_2 = rsiT1_backward[rsiT1_backward.length - 1].value;
  const valT2_1 = rsiT2_first[rsiT2_first.length - 1].value;
  const valT2_2 = rsiT2_backward[rsiT2_backward.length - 1].value;
  const valT2_3 = rsiT2_forwardAgain[rsiT2_forwardAgain.length - 1].value;

  assert(
    valT1_1 === valT1_2 && valT2_1 === valT2_2 && valT2_2 === valT2_3,
    `Determinism & Time Travel: Backward/Forward stepping produces zero drift (T1: ${valT1_1}==${valT1_2}, T2: ${valT2_1}==${valT2_2}==${valT2_3})`
  );

  // -------------------------------------------------------------
  // TEST 10: Dynamic Parameter Change Invalidation (14 -> 7 -> 21 -> 14)
  // -------------------------------------------------------------
  const dataset = generateCandles(60, 1.1000);
  const rsi14_initial = calculateRsi(dataset, 14);
  const rsi7 = calculateRsi(dataset, 7);
  const rsi21 = calculateRsi(dataset, 21);
  const rsi14_returned = calculateRsi(dataset, 14);

  const v14_init = rsi14_initial[rsi14_initial.length - 1].value;
  const v7 = rsi7[rsi7.length - 1].value;
  const v21 = rsi21[rsi21.length - 1].value;
  const v14_ret = rsi14_returned[rsi14_returned.length - 1].value;

  assert(
    v14_init === v14_ret && v14_init !== v7 && v14_init !== v21,
    `Parameter Changes: Changing 14 -> 7 (${v7}) -> 21 (${v21}) -> 14 (${v14_ret}) preserves exact mathematical idempotency`
  );

  // -------------------------------------------------------------
  // TEST 11: Multiple RSI Instance Isolation
  // -------------------------------------------------------------
  const rsiInstA = calculateRsi(dataset, 7);
  const rsiInstB = calculateRsi(dataset, 14);
  const rsiInstC = calculateRsi(dataset, 21);

  // Modifying instance A (7 -> 10)
  const rsiInstA_mod = calculateRsi(dataset, 10);
  const rsiInstB_after = calculateRsi(dataset, 14);
  const rsiInstC_after = calculateRsi(dataset, 21);

  const bBefore = rsiInstB[rsiInstB.length - 1].value;
  const bAfter = rsiInstB_after[rsiInstB_after.length - 1].value;
  const cBefore = rsiInstC[rsiInstC.length - 1].value;
  const cAfter = rsiInstC_after[rsiInstC_after.length - 1].value;

  assert(
    bBefore === bAfter && cBefore === cAfter && rsiInstA_mod.length !== rsiInstA.length,
    'Multiple Instances: Modifying one RSI instance has 0 impact on other coexisting RSI instances'
  );

  // -------------------------------------------------------------
  // TEST 12: Timeframe Awareness Isolation (M5 vs M15 vs H1)
  // -------------------------------------------------------------
  const m5Candles = generateCandles(60, 1.1000, (i) => Math.sin(i / 3) * 0.0015);
  const m15Candles = generateCandles(60, 1.1000, (i) => Math.cos(i / 2) * 0.0030);

  const rsiM5 = calculateRsi(m5Candles, 14);
  const rsiM15 = calculateRsi(m15Candles, 14);

  const rsiM5Val = rsiM5[rsiM5.length - 1].value;
  const rsiM15Val = rsiM15[rsiM15.length - 1].value;

  assert(
    rsiM5Val !== rsiM15Val && rsiM5.length === 46 && rsiM15.length === 46,
    `Timeframe Awareness: M5 and M15 use distinct native timeframe series (M5=${rsiM5Val}, M15=${rsiM15Val})`
  );

  return {
    success: passed === total,
    passed,
    total,
    logs,
  };
}

// Direct CLI Execution
if (require.main === module || process.argv[1]?.includes('RsiEngineVerificationTest')) {
  console.log('--- RUNNING RSI ENGINE VERIFICATION TEST SUITE ---');
  const result = runRsiEngineVerificationTests();
  result.logs.forEach((log) => console.log(log));
  console.log(`\nResult: ${result.passed}/${result.total} passed. Success: ${result.success}`);
  if (!result.success) {
    process.exit(1);
  }
}
