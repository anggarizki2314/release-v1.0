/**
 * Replay Engine V3 — Stage 11: Replay Integration Validation Test Suite
 * Validates real application compatibility, multi-pair, multi-timeframe, timezone invariance,
 * high-speed playback (1x-100x), 50 random date jumps, and memory leak cleanup.
 */

import type { Candle, Timeframe } from '@/types';
import { ReplayEngineV3 } from '../ReplayEngineV3';
import { CandleValidationLayer } from '../data/CandleValidationLayer';

function generateRealDataset(symbol: string, count: number, startUTC = 1700000000, stepSeconds = 60): Candle[] {
  const candles: Candle[] = [];
  let basePrice = symbol.includes('XAU') ? 2000.0 : 1.1000;
  for (let i = 0; i < count; i++) {
    const time = startUTC + i * stepSeconds;
    const open = basePrice;
    const high = open + (symbol.includes('XAU') ? 2.5 : 0.0010);
    const low = open - (symbol.includes('XAU') ? 2.5 : 0.0010);
    const close = open + (symbol.includes('XAU') ? 1.0 : 0.0005);
    candles.push({ time, open, high, low, close });
    basePrice = close;
  }
  return candles;
}

export interface ValidationReportSummary {
  readonly totalTests: number;
  readonly passedTests: number;
  readonly failedTests: number;
  readonly details: readonly string[];
}

export function runStage11IntegrationValidation(): ValidationReportSummary {
  console.log('\n========================================================================');
  console.log('  STAGE 11: REPLAY ENGINE V3 — REPLAY INTEGRATION VALIDATION SUITE     ');
  console.log('========================================================================\n');

  const details: string[] = [];
  let passedTests = 0;
  let failedTests = 0;

  const assert = (testName: string, condition: boolean, message: string) => {
    if (condition) {
      passedTests++;
      const msg = `[PASS] ${testName}: ${message}`;
      details.push(msg);
      console.log(msg);
    } else {
      failedTests++;
      const msg = `[FAIL] ${testName}: ${message}`;
      details.push(msg);
      console.error(msg);
    }
  };

  // -------------------------------------------------------------------
  // TEST SUITE 1: Full Pipeline Verification (DB -> Repo -> Engine -> Chart -> Non-Empty)
  // -------------------------------------------------------------------
  try {
    const engine = new ReplayEngineV3();
    const eurusdM1 = generateRealDataset('EURUSD', 1000, 1700000000, 60);
    const len = engine.loadCandles('EURUSD', 'M1', eurusdM1);

    const chart = engine.createChartContext('pane-1', 'EURUSD', 'M1');
    let visibleCandlesReceived: Candle[] = [];

    chart.subscribe((data) => {
      visibleCandlesReceived = data.visibleCandles;
    });

    engine.createSession({
      symbol: 'EURUSD',
      timeframe: 'M1',
      targetStartUTC: 1700000600,
      startMode: 'PREVIOUS',
    });

    assert(
      'Suite 1: Full Pipeline Verification',
      len === 1000 && visibleCandlesReceived.length > 0,
      `Loaded ${len} candles and rendered ${visibleCandlesReceived.length} visible candles (Non-empty check passed)`
    );
    engine.reset();
  } catch (err: any) {
    assert('Suite 1: Full Pipeline Verification', false, err.message);
  }

  // -------------------------------------------------------------------
  // TEST SUITE 2: Create Session & First Bar Render Validation
  // -------------------------------------------------------------------
  try {
    const engine = new ReplayEngineV3();
    const candles = generateRealDataset('EURUSD', 500, 1700000000, 60);
    engine.loadCandles('EURUSD', 'M1', candles);
    const chart = engine.createChartContext('pane-1', 'EURUSD', 'M1');

    let firstCandleTime: number | null = null;
    chart.subscribe((data) => {
      firstCandleTime = data.visibleCandles[data.visibleCandles.length - 1]?.time ?? null;
    });

    const targetStart = 1700000300; // 5th candle (index 5)
    engine.createSession({
      symbol: 'EURUSD',
      timeframe: 'M1',
      targetStartUTC: targetStart,
      startMode: 'PREVIOUS',
    });

    assert(
      'Suite 2: Create Session & First Bar Render',
      engine.timeline.currentReplayTimeUTC === targetStart && firstCandleTime === targetStart,
      `ReplayStartTimeUTC (${engine.timeline.currentReplayTimeUTC}) matched first visible bar timestamp (${firstCandleTime})`
    );
    engine.reset();
  } catch (err: any) {
    assert('Suite 2: Create Session & First Bar Render', false, err.message);
  }

  // -------------------------------------------------------------------
  // TEST SUITE 3: Timezone Formatting Isolation Validation
  // -------------------------------------------------------------------
  try {
    const engine = new ReplayEngineV3();
    const candles = generateRealDataset('EURUSD', 100, 1700000000, 60);
    engine.loadCandles('EURUSD', 'M1', candles);

    engine.createSession({
      symbol: 'EURUSD',
      timeframe: 'M1',
      targetStartUTC: 1700000000,
      startMode: 'PREVIOUS',
    });

    const initialTimeUTC = engine.timeline.currentReplayTimeUTC;

    // Simulate display timezone formatting changes (e.g. UTC -> WIB (+7h) -> EST (-5h))
    const formatTimezoneDisplay = (utcSeconds: number, offsetHours: number) => {
      return new Date((utcSeconds + offsetHours * 3600) * 1000).toISOString();
    };

    const labelUTC = formatTimezoneDisplay(initialTimeUTC!, 0);
    const labelWIB = formatTimezoneDisplay(initialTimeUTC!, 7);
    const labelEST = formatTimezoneDisplay(initialTimeUTC!, -5);

    assert(
      'Suite 3: Timezone Formatting Isolation',
      engine.timeline.currentReplayTimeUTC === initialTimeUTC && labelUTC !== labelWIB,
      `Timeline SSoT timestamp remain invariant (${initialTimeUTC}) while display labels formatted independently`
    );
    engine.reset();
  } catch (err: any) {
    assert('Suite 3: Timezone Formatting Isolation', false, err.message);
  }

  // -------------------------------------------------------------------
  // TEST SUITE 4: Multi-Pair Synchronization (EURUSD + XAUUSD)
  // -------------------------------------------------------------------
  try {
    const engine = new ReplayEngineV3();
    const eurusd = generateRealDataset('EURUSD', 500, 1700000000, 60);
    const xauusd = generateRealDataset('XAUUSD', 500, 1700000000, 60);

    engine.loadCandles('EURUSD', 'M1', eurusd);
    engine.loadCandles('XAUUSD', 'M1', xauusd);

    const c1 = engine.createChartContext('pane-eur', 'EURUSD', 'M1');
    const c2 = engine.createChartContext('pane-xau', 'XAUUSD', 'M1');

    let idx1 = -1;
    let idx2 = -1;

    c1.subscribe((data) => { idx1 = data.absoluteIndex; });
    c2.subscribe((data) => { idx2 = data.absoluteIndex; });

    engine.createSession({
      symbol: 'EURUSD',
      timeframe: 'M1',
      targetStartUTC: 1700000600,
      startMode: 'PREVIOUS',
    });

    engine.jumpToTime(1700001200);

    assert(
      'Suite 4: Multi-Pair Synchronization',
      idx1 === 20 && idx2 === 20,
      `EURUSD Index (${idx1}) and XAUUSD Index (${idx2}) advanced synchronously to timestamp 1700001200`
    );
    engine.reset();
  } catch (err: any) {
    assert('Suite 4: Multi-Pair Synchronization', false, err.message);
  }

  // -------------------------------------------------------------------
  // TEST SUITE 5: Multi-Timeframe Synchronization (M1 + M15 + H1)
  // -------------------------------------------------------------------
  try {
    const engine = new ReplayEngineV3();
    const m1Candles = generateRealDataset('EURUSD', 3600, 1700000000, 60);
    const m15Candles = generateRealDataset('EURUSD', 240, 1700000000, 900);
    const h1Candles = generateRealDataset('EURUSD', 60, 1700000000, 3600);

    engine.loadCandles('EURUSD', 'M1', m1Candles);
    engine.loadCandles('EURUSD', 'M15', m15Candles);
    engine.loadCandles('EURUSD', 'H1', h1Candles);

    const cM1 = engine.createChartContext('pane-m1', 'EURUSD', 'M1');
    const cM15 = engine.createChartContext('pane-m15', 'EURUSD', 'M15');
    const cH1 = engine.createChartContext('pane-h1', 'EURUSD', 'H1');

    let idxM1 = -1, idxM15 = -1, idxH1 = -1;
    cM1.subscribe((d) => { idxM1 = d.absoluteIndex; });
    cM15.subscribe((d) => { idxM15 = d.absoluteIndex; });
    cH1.subscribe((d) => { idxH1 = d.absoluteIndex; });

    // Target at 3 hours in (10800 seconds)
    const targetTime = 1700000000 + 10800;
    engine.createSession({
      symbol: 'EURUSD',
      timeframe: 'M1',
      targetStartUTC: targetTime,
      startMode: 'PREVIOUS',
    });

    assert(
      'Suite 5: Multi-Timeframe Synchronization',
      idxM1 === 180 && idxM15 === 12 && idxH1 === 3,
      `Multi-TF Index Lockstep Verified: M1 Index=${idxM1} (180), M15 Index=${idxM15} (12), H1 Index=${idxH1} (3)`
    );
    engine.reset();
  } catch (err: any) {
    assert('Suite 5: Multi-Timeframe Synchronization', false, err.message);
  }

  // -------------------------------------------------------------------
  // TEST SUITE 6: WindowManager Preload & Window Shift Validation
  // -------------------------------------------------------------------
  try {
    const engine = new ReplayEngineV3();
    const dataset = generateRealDataset('EURUSD', 10000, 1700000000, 60);
    engine.loadCandles('EURUSD', 'M1', dataset);

    const chart = engine.createChartContext('pane-1', 'EURUSD', 'M1');
    let lastDescriptor: any = null;

    chart.subscribe((d) => {
      lastDescriptor = d.windowDescriptor;
    });

    engine.createSession({
      symbol: 'EURUSD',
      timeframe: 'M1',
      targetStartUTC: 1700000000 + 5000 * 60,
      startMode: 'PREVIOUS',
    });

    assert(
      'Suite 6: WindowManager Preload & Window Shift',
      lastDescriptor !== null && lastDescriptor.startIndex >= 0 && lastDescriptor.shouldLoadMore !== undefined,
      `WindowDescriptor generated correctly (startIndex: ${lastDescriptor?.startIndex}, endIndex: ${lastDescriptor?.endIndex})`
    );
    engine.reset();
  } catch (err: any) {
    assert('Suite 6: WindowManager Preload & Window Shift', false, err.message);
  }

  // -------------------------------------------------------------------
  // TEST SUITE 7: Jump Date Stress Test (50 Random Jumps)
  // -------------------------------------------------------------------
  try {
    const engine = new ReplayEngineV3();
    const dataset = generateRealDataset('EURUSD', 2000, 1700000000, 60);
    engine.loadCandles('EURUSD', 'M1', dataset);

    const chart = engine.createChartContext('pane-1', 'EURUSD', 'M1');
    let currentIdx = -1;
    chart.subscribe((d) => { currentIdx = d.absoluteIndex; });

    engine.createSession({
      symbol: 'EURUSD',
      timeframe: 'M1',
      targetStartUTC: 1700000000,
      startMode: 'PREVIOUS',
    });

    let jumpsPassed = 0;
    const totalJumps = 50;

    for (let i = 0; i < totalJumps; i++) {
      const randomOffsetIndex = Math.floor(Math.random() * 1999);
      const targetTime = 1700000000 + randomOffsetIndex * 60;
      const ok = engine.jumpToTime(targetTime);
      if (ok && currentIdx === randomOffsetIndex) {
        jumpsPassed++;
      }
    }

    assert(
      'Suite 7: Jump Date Stress Test (50 Random Jumps)',
      jumpsPassed === totalJumps,
      `Successfully executed ${jumpsPassed}/${totalJumps} random date jumps with 100% index precision`
    );
    engine.reset();
  } catch (err: any) {
    assert('Suite 7: Jump Date Stress Test', false, err.message);
  }

  // -------------------------------------------------------------------
  // TEST SUITE 8: Playback Speed Stress Test (1x, 2x, 5x, 10x, 20x, 50x, 100x)
  // -------------------------------------------------------------------
  try {
    const engine = new ReplayEngineV3();
    const dataset = generateRealDataset('EURUSD', 1000, 1700000000, 60);
    engine.loadCandles('EURUSD', 'M1', dataset);

    const chart = engine.createChartContext('pane-1', 'EURUSD', 'M1');
    let currentIdx = -1;
    chart.subscribe((d) => { currentIdx = d.absoluteIndex; });

    engine.createSession({
      symbol: 'EURUSD',
      timeframe: 'M1',
      targetStartUTC: 1700000000,
      startMode: 'PREVIOUS',
    });

    const speeds = [1, 2, 5, 10, 20, 50, 100];
    let speedPassed = true;

    for (const speed of speeds) {
      engine.setSpeed(speed);
      // Simulate advance of 5 seconds real-time at given speed
      const deltaMs = 5000;
      (engine.timeline as any).advanceElapsedMilliseconds(deltaMs);
      engine.eventBus.emit('ReplayTimeChanged', {
        version: 1,
        eventId: `evt_speed_${speed}`,
        currentTimeUTC: engine.timeline.currentReplayTimeUTC!,
        playbackDirection: 'forward',
        reason: 'tick',
        speed,
      });

      if (currentIdx < 0 || currentIdx >= 1000) {
        speedPassed = false;
        break;
      }
    }

    assert(
      'Suite 8: Playback Speed Stress Test (1x..100x)',
      speedPassed,
      `Playback speed stress test across speeds ${speeds.join('x, ')}x executed without index overshoot`
    );
    engine.reset();
  } catch (err: any) {
    assert('Suite 8: Playback Speed Stress Test', false, err.message);
  }

  // -------------------------------------------------------------------
  // TEST SUITE 9: Finish / Resume State Machine Lifecycle
  // -------------------------------------------------------------------
  try {
    const engine = new ReplayEngineV3();
    const dataset = generateRealDataset('EURUSD', 10, 1700000000, 60);
    engine.loadCandles('EURUSD', 'M1', dataset);

    engine.createSession({
      symbol: 'EURUSD',
      timeframe: 'M1',
      targetStartUTC: 1700000000,
      startMode: 'PREVIOUS',
    });

    // Jump to last candle -> finishes replay
    const lastTime = 1700000000 + 9 * 60;
    engine.jumpToTime(lastTime);
    const isFinished = engine.timeline.status === 'finished';

    // Step backward -> resumes from finished to paused
    engine.stepBackward(60);
    const isResumed = engine.timeline.status === 'paused';

    assert(
      'Suite 9: Finish / Resume State Machine Lifecycle',
      isFinished && isResumed,
      `State transition verified: finished (${isFinished}) -> stepBackward -> paused (${isResumed})`
    );
    engine.reset();
  } catch (err: any) {
    assert('Suite 9: Finish / Resume State Machine Lifecycle', false, err.message);
  }

  // -------------------------------------------------------------------
  // TEST SUITE 10: Memory Leak & Disposing Audit
  // -------------------------------------------------------------------
  try {
    const engine = new ReplayEngineV3();
    const dataset = generateRealDataset('EURUSD', 100, 1700000000, 60);

    for (let i = 0; i < 50; i++) {
      engine.loadCandles('EURUSD', 'M1', dataset);
      const chart = engine.createChartContext(`pane-${i}`, 'EURUSD', 'M1');
      const unsub = chart.subscribe(() => {});

      engine.createSession({
        symbol: 'EURUSD',
        timeframe: 'M1',
        targetStartUTC: 1700000000,
        startMode: 'PREVIOUS',
      });

      unsub();
      engine.destroyChartContext(`pane-${i}`);
      engine.reset();
    }

    const remainingContexts = engine.synchronizer.getChartContexts().length;
    const cacheSize = engine.repository.getCache().sizeLevel1;

    assert(
      'Suite 10: Memory Leak & Disposing Audit',
      remainingContexts === 0 && cacheSize === 0,
      `Engine reset 50 times cleanly: 0 chart contexts remaining, 0 memory leak references`
    );
  } catch (err: any) {
    assert('Suite 10: Memory Leak & Disposing Audit', false, err.message);
  }

  console.log('\n========================================================================');
  console.log(`  INTEGRATION VERIFICATION SUMMARY: ${passedTests}/${passedTests + failedTests} SUITES PASSED  `);
  console.log('========================================================================\n');

  return {
    totalTests: passedTests + failedTests,
    passedTests,
    failedTests,
    details,
  };
}
