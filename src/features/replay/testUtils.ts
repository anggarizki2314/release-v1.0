import type { Candle } from '@/types';
import { ReplayEngine } from './engine';
import {
  findReplayStartPointIndex,
  findNearestCandleIndex,
  separateDataset,
  getDatasetTimeRange,
} from './replayStartPoint';
import { parseAndFindStartPoint, getSignificantDates } from './startPointHelpers';

/**
 * Test utilities untuk validasi replay engine functionality.
 * Ini adalah helper untuk manual testing dan validation di Hari 7.
 */

/**
 * Create mock candle dataset untuk testing.
 * Generates sequential candles dengan interval tertentu.
 */
export function createMockCandles(count: number, startTime: number = 0, intervalSeconds: number = 60): Candle[] {
  const candles: Candle[] = [];
  for (let i = 0; i < count; i++) {
    const time = startTime + i * intervalSeconds;
    candles.push({
      time,
      open: 100 + i * 0.1,
      high: 100 + i * 0.1 + 0.5,
      low: 100 + i * 0.1 - 0.3,
      close: 100 + i * 0.1 + 0.2,
      volume: 1000 + i * 10,
    });
  }
  return candles;
}

/**
 * TEST 1: Validate state transitions
 */
export function testStateTransitions(): boolean {
  console.log('\n=== TEST 1: State Transitions ===');
  try {
    const candles = createMockCandles(10);
    const engine = new ReplayEngine();

    console.log('Initial status:', engine.getStatus()); // should be 'idle'
    if (engine.getStatus() !== 'idle') throw new Error('Initial status should be idle');

    engine.initialize({
      symbolId: 1,
      symbol: 'TEST',
      timeframe: 'M1',
      allCandles: candles,
      replayStartIndex: 0,
    });

    console.log('After initialize:', engine.getStatus()); // should be 'ready'
    if (engine.getStatus() !== 'ready') throw new Error('Status should be ready after init');

    engine.play();
    console.log('After play:', engine.getStatus()); // should be 'playing'
    if (engine.getStatus() !== 'playing') throw new Error('Status should be playing');

    engine.pause();
    console.log('After pause:', engine.getStatus()); // should be 'paused'
    if (engine.getStatus() !== 'paused') throw new Error('Status should be paused');

    engine.play();
    console.log('After play again:', engine.getStatus()); // should be 'playing'
    if (engine.getStatus() !== 'playing') throw new Error('Status should be playing');

    // Move to end
    engine.setCurrentIndex(candles.length - 1);
    console.log('After move to end:', engine.getStatus()); // should be 'finished'
    if (engine.getStatus() !== 'finished') throw new Error('Status should be finished');

    console.log('✓ State transitions test passed');
    return true;
  } catch (err) {
    console.error('✗ State transitions test failed:', err);
    return false;
  }
}

/**
 * TEST 2: Validate start point detection
 */
export function testStartPointDetection(): boolean {
  console.log('\n=== TEST 2: Start Point Detection ===');
  try {
    const startTime = 1000;
    const candles = createMockCandles(7, startTime, 60); // 7 candles, 1 minute each
    // Times: 1000, 1060, 1120, 1180, 1240, 1300, 1360

    // Test 'first'
    const firstIdx = findReplayStartPointIndex(candles, { strategy: 'first' });
    console.log('First index:', firstIdx); // should be 0
    if (firstIdx !== 0) throw new Error('First strategy should return 0');

    // Test 'last'
    const lastIdx = findReplayStartPointIndex(candles, { strategy: 'last' });
    console.log('Last index:', lastIdx); // should be 6
    if (lastIdx !== 6) throw new Error('Last strategy should return 6');

    // Test 'midpoint'
    const midIdx = findReplayStartPointIndex(candles, { strategy: 'midpoint' });
    console.log('Midpoint index:', midIdx); // should be 3
    if (midIdx !== 3) throw new Error('Midpoint strategy should return 3');

    // Test 'timestamp'
    const targetTime = 1180; // exact match with candle 3
    const tsIdx = findReplayStartPointIndex(candles, { strategy: 'timestamp', targetTimestamp: targetTime });
    console.log('Timestamp index (exact match):', tsIdx); // should be 3
    if (tsIdx !== 3) throw new Error('Timestamp strategy should find exact match');

    // Test 'timestamp' with nearest
    const targetTime2 = 1150; // between candle 2 and 3
    const tsIdx2 = findReplayStartPointIndex(candles, { strategy: 'timestamp', targetTimestamp: targetTime2 });
    console.log('Timestamp index (nearest):', tsIdx2); // should be 2 or 3
    if (tsIdx2 !== 2 && tsIdx2 !== 3) throw new Error('Timestamp strategy should find nearest');

    console.log('✓ Start point detection test passed');
    return true;
  } catch (err) {
    console.error('✗ Start point detection test failed:', err);
    return false;
  }
}

/**
 * TEST 3: Validate dataset separation
 */
export function testDatasetSeparation(): boolean {
  console.log('\n=== TEST 3: Dataset Separation ===');
  try {
    const candles = createMockCandles(7, 1000, 60);
    const startIdx = 3;

    const separated = separateDataset(candles, startIdx);

    console.log('Historical candles:', separated.historicalContext.length); // should be 3
    if (separated.historicalContext.length !== 3) throw new Error('Historical should have 3 candles');

    console.log('Start candle time:', separated.visibleStartCandle.time); // should be 1180
    if (separated.visibleStartCandle.time !== candles[3].time) throw new Error('Start candle mismatch');

    console.log('Future candles:', separated.futureReplayData.length); // should be 3
    if (separated.futureReplayData.length !== 3) throw new Error('Future should have 3 candles');

    console.log('Total candles:', separated.totalCandles); // should be 7
    if (separated.totalCandles !== 7) throw new Error('Total should be 7');

    console.log('✓ Dataset separation test passed');
    return true;
  } catch (err) {
    console.error('✗ Dataset separation test failed:', err);
    return false;
  }
}

/**
 * TEST 4: Validate data view filtering
 */
export function testDataViewFiltering(): boolean {
  console.log('\n=== TEST 4: Data View Filtering ===');
  try {
    const candles = createMockCandles(10, 1000, 60);
    const engine = new ReplayEngine();

    engine.initialize({
      symbolId: 1,
      symbol: 'TEST',
      timeframe: 'M1',
      allCandles: candles,
      replayStartIndex: 0,
    });

    // At start, should only see first candle
    let view = engine.getDataView();
    console.log('At index 0 - Historical:', view.historicalCandles.length); // should be 1
    if (view.historicalCandles.length !== 1) throw new Error('Historical should have 1 candle at start');

    // Move forward
    engine.setCurrentIndex(5);
    view = engine.getDataView();
    console.log('At index 5 - Historical:', view.historicalCandles.length); // should be 6
    if (view.historicalCandles.length !== 6) throw new Error('Historical should have 6 candles at index 5');

    console.log('At index 5 - Future:', view.futureCandles.length); // should be 4
    if (view.futureCandles.length !== 4) throw new Error('Future should have 4 candles at index 5');

    console.log('✓ Data view filtering test passed');
    return true;
  } catch (err) {
    console.error('✗ Data view filtering test failed:', err);
    return false;
  }
}

/**
 * TEST 5: Validate progress calculation
 */
export function testProgressCalculation(): boolean {
  console.log('\n=== TEST 5: Progress Calculation ===');
  try {
    const candles = createMockCandles(100, 1000, 60);
    const engine = new ReplayEngine();

    engine.initialize({
      symbolId: 1,
      symbol: 'TEST',
      timeframe: 'M1',
      allCandles: candles,
      replayStartIndex: 0,
    });

    const progress0 = engine.getProgressPercentage();
    console.log('Progress at start:', progress0, '%'); // should be ~1%
    if (progress0 < 0 || progress0 > 2) throw new Error('Progress at start should be ~1%');

    engine.setCurrentIndex(50);
    const progress50 = engine.getProgressPercentage();
    console.log('Progress at 50:', progress50, '%'); // should be ~51%
    if (progress50 < 50 || progress50 > 52) throw new Error('Progress at 50 should be ~51%');

    engine.setCurrentIndex(99);
    const progress99 = engine.getProgressPercentage();
    console.log('Progress at end:', progress99, '%'); // should be 100%
    if (progress99 < 99 || progress99 > 100) throw new Error('Progress at end should be ~100%');

    console.log('✓ Progress calculation test passed');
    return true;
  } catch (err) {
    console.error('✗ Progress calculation test failed:', err);
    return false;
  }
}

/**
 * TEST 6: Validate nearest candle finding
 */
export function testNearestCandleFinding(): boolean {
  console.log('\n=== TEST 6: Nearest Candle Finding ===');
  try {
    const candles = createMockCandles(10, 1000, 60);
    // Times: 1000, 1060, 1120, 1180, ...

    // Exact match
    let idx = findNearestCandleIndex(candles, 1060);
    console.log('Exact match (1060):', idx); // should be 1
    if (idx !== 1) throw new Error('Should find exact match at index 1');

    // Between two candles, closer to first
    idx = findNearestCandleIndex(candles, 1090);
    console.log('Between 1 and 2, closer to 2 (1090):', idx); // should be 1 or 2
    if (idx !== 1 && idx !== 2) throw new Error('Should find nearest between 1 and 2');

    // Before all
    idx = findNearestCandleIndex(candles, 500);
    console.log('Before all (500):', idx); // should be 0
    if (idx !== 0) throw new Error('Should return 0 for time before all candles');

    // After all
    idx = findNearestCandleIndex(candles, 9999);
    console.log('After all (9999):', idx); // should be 9
    if (idx !== 9) throw new Error('Should return last index for time after all candles');

    console.log('✓ Nearest candle finding test passed');
    return true;
  } catch (err) {
    console.error('✗ Nearest candle finding test failed:', err);
    return false;
  }
}

/**
 * TEST 7: Validate time range calculation
 */
export function testTimeRangeCalculation(): boolean {
  console.log('\n=== TEST 7: Time Range Calculation ===');
  try {
    const startTime = 1000;
    const candles = createMockCandles(10, startTime, 60);

    const range = getDatasetTimeRange(candles);

    console.log('First time:', range.firstTime); // should be 1000
    if (range.firstTime !== 1000) throw new Error('First time should be 1000');

    console.log('Last time:', range.lastTime); // should be 1540
    if (range.lastTime !== 1540) throw new Error('Last time should be 1540');

    console.log('Duration:', range.durationSeconds, 'seconds'); // should be 540
    if (range.durationSeconds !== 540) throw new Error('Duration should be 540 seconds');

    console.log('✓ Time range calculation test passed');
    return true;
  } catch (err) {
    console.error('✗ Time range calculation test failed:', err);
    return false;
  }
}

/**
 * Run all tests dan report results
 */
export function runAllTests(): { passed: number; failed: number } {
  console.log('\n╔═══════════════════════════════════════╗');
  console.log('║   REPLAY ENGINE - HARI 7 VALIDATION   ║');
  console.log('╚═══════════════════════════════════════╝');

  const tests = [
    testStateTransitions,
    testStartPointDetection,
    testDatasetSeparation,
    testDataViewFiltering,
    testProgressCalculation,
    testNearestCandleFinding,
    testTimeRangeCalculation,
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    if (test()) {
      passed++;
    } else {
      failed++;
    }
  }

  console.log('\n╔═══════════════════════════════════════╗');
  console.log(`║  RESULTS: ${passed} passed, ${failed} failed       ║`);
  console.log('╚═══════════════════════════════════════╝\n');

  return { passed, failed };
}
