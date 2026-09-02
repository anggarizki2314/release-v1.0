/**
 * Replay Engine V3 — Comprehensive Architecture Verification Test Suite
 * Architecture Frozen v1.0
 */

import type { Candle } from '@/types';
import { ReplayEngineV3 } from '../ReplayEngineV3';
import { BinarySearchStrategy } from '../data/BinarySearchStrategy';
import { CandleValidationLayer } from '../data/CandleValidationLayer';

function generateMockCandles(count: number, startSeconds = 1700000000, stepSeconds = 60): Candle[] {
  const candles: Candle[] = [];
  let price = 1.1000;
  for (let i = 0; i < count; i++) {
    const time = startSeconds + i * stepSeconds;
    const open = price;
    const high = open + 0.0010;
    const low = open - 0.0010;
    const close = open + 0.0005;
    candles.push({ time, open, high, low, close });
    price = close;
  }
  return candles;
}

export function runReplayV3SelfTests(): boolean {
  console.log('=== STARTING REPLAY ENGINE V3 ARCHITECTURE SELF-TESTS ===');
  let passed = true;

  try {
    // Test 1: Validation Layer
    console.log('[Test 1] Testing CandleValidationLayer...');
    const raw = generateMockCandles(10);
    raw.push({ time: 1700000000, open: 1, high: 2, low: 0.5, close: 1.5 }); // Duplicate timestamp
    const { sanitizedCandles, report } = CandleValidationLayer.validateAndSanitize(raw);
    if (sanitizedCandles.length !== 10 || report.duplicateCount !== 1) {
      console.error('FAIL: CandleValidationLayer deduplication failed', report);
      passed = false;
    } else {
      console.log('PASS: CandleValidationLayer deduplicated correctly.');
    }

    // Test 2: Binary Search Strategy with ReplayStartMode
    console.log('[Test 2] Testing BinarySearchStrategy with ReplayStartMode...');
    const strategy = new BinarySearchStrategy();
    const dataset = generateMockCandles(100, 1000, 60); // 1000, 1060, 1120...

    // EXACT mode (hit)
    const exactHit = strategy.findCandleIndex(dataset, 1060, 'EXACT');
    if (!exactHit || exactHit.index !== 1) {
      console.error('FAIL: BinarySearchStrategy EXACT hit failed', exactHit);
      passed = false;
    }

    // EXACT mode (miss)
    const exactMiss = strategy.findCandleIndex(dataset, 1030, 'EXACT');
    if (exactMiss !== null) {
      console.error('FAIL: BinarySearchStrategy EXACT miss should return null', exactMiss);
      passed = false;
    }

    // PREVIOUS mode (target 1030 falls between 1000 and 1060 -> selects 1000 index 0)
    const prevRes = strategy.findCandleIndex(dataset, 1030, 'PREVIOUS');
    if (!prevRes || prevRes.index !== 0) {
      console.error('FAIL: BinarySearchStrategy PREVIOUS mode failed', prevRes);
      passed = false;
    }

    // NEXT mode (target 1030 falls between 1000 and 1060 -> selects 1060 index 1)
    const nextRes = strategy.findCandleIndex(dataset, 1030, 'NEXT');
    if (!nextRes || nextRes.index !== 1) {
      console.error('FAIL: BinarySearchStrategy NEXT mode failed', nextRes);
      passed = false;
    }

    // NEAREST mode with Tie-Break (target 1030 is 30s from 1000 and 30s from 1060 -> prefers PREVIOUS index 0)
    const nearestTie = strategy.findCandleIndex(dataset, 1030, 'NEAREST');
    if (!nearestTie || nearestTie.index !== 0) {
      console.error('FAIL: BinarySearchStrategy NEAREST tie-break failed', nearestTie);
      passed = false;
    } else {
      console.log('PASS: BinarySearchStrategy start modes verified.');
    }

    // Test 3: ReplayEngineV3 End-to-End Orchestration & Multi-Chart Fan-Out
    console.log('[Test 3] Testing ReplayEngineV3 & Multi-Chart Fan-Out...');
    const engine = new ReplayEngineV3();
    const eurusdM1 = generateMockCandles(500, 1700000000, 60);
    const xauusdM5 = generateMockCandles(500, 1700000000, 300);

    engine.loadCandles('EURUSD', 'M1', eurusdM1);
    engine.loadCandles('XAUUSD', 'M5', xauusdM5);

    // Create 2 Chart Contexts (Multi-Pair & Multi-Timeframe)
    const chart1 = engine.createChartContext('pane-1', 'EURUSD', 'M1');
    const chart2 = engine.createChartContext('pane-2', 'XAUUSD', 'M5');

    let chart1Index = -1;
    let chart2Index = -1;

    chart1.subscribe((data) => {
      chart1Index = data.absoluteIndex;
    });

    chart2.subscribe((data) => {
      chart2Index = data.absoluteIndex;
    });

    // Create Session at timestamp 1700000300 (5th candle M1, 2nd candle M5)
    const sessionRes = engine.createSession({
      symbol: 'EURUSD',
      timeframe: 'M1',
      targetStartUTC: 1700000300,
      startMode: 'PREVIOUS',
    });

    if (sessionRes.resolvedStartCandleTime !== 1700000300) {
      console.error('FAIL: Engine session start time mismatch', sessionRes);
      passed = false;
    }

    if (chart1Index !== 5 || chart2Index !== 1) {
      console.error('FAIL: Multi-chart fan-out initial index mismatch', { chart1Index, chart2Index });
      passed = false;
    } else {
      console.log('PASS: Multi-chart initial fan-out verified (Chart 1: 5, Chart 2: 1).');
    }

    // Jump Date test
    console.log('[Test 4] Testing Jump Date...');
    engine.jumpToTime(1700000600); // 10th candle M1 (index 10), 3rd candle M5 (index 2)
    if (chart1Index !== 10 || chart2Index !== 2) {
      console.error('FAIL: Jump date index mismatch', { chart1Index, chart2Index });
      passed = false;
    } else {
      console.log('PASS: Jump date multi-chart sync verified (Chart 1: 10, Chart 2: 2).');
    }

    engine.reset();
  } catch (err) {
    console.error('EXCEPTIONAL FAIL in self-tests:', err);
    passed = false;
  }

  if (passed) {
    console.log('=== ALL REPLAY ENGINE V3 SELF-TESTS PASSED SUCCESSFULLY! ===');
  }
  return passed;
}
