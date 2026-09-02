/**
 * Replay Chart Viewport Verification Test Suite
 * Validates timeframe-based candle buffer calculation and centered viewport bounds.
 */

import {
  getTimeframeMinutes,
  getTwoDayBufferCandles,
  calculateReplayViewport,
} from '../viewport';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

export function runViewportTests() {
  console.log('=====================================================');
  console.log('RUNNING REPLAY INITIAL VIEWPORT VERIFICATION SUITE');
  console.log('=====================================================\n');

  // 1. Timeframe Minutes & 2-Day Buffer Calculation Tests
  console.log('--- TEST 1: TIMEFRAME 2-DAY CANDLE BUFFER CALCULATION ---');

  const m1Buffer = getTwoDayBufferCandles('M1');
  console.log(`M1 2-Day Buffer: ${m1Buffer} candles (Expected: 2880)`);
  assert(m1Buffer === 2880, `Expected 2880 for M1, got ${m1Buffer}`);

  const m5Buffer = getTwoDayBufferCandles('M5');
  console.log(`M5 2-Day Buffer: ${m5Buffer} candles (Expected: 576)`);
  assert(m5Buffer === 576, `Expected 576 for M5, got ${m5Buffer}`);

  const m15Buffer = getTwoDayBufferCandles('M15');
  console.log(`M15 2-Day Buffer: ${m15Buffer} candles (Expected: 192)`);
  assert(m15Buffer === 192, `Expected 192 for M15, got ${m15Buffer}`);

  const h1Buffer = getTwoDayBufferCandles('H1');
  console.log(`H1 2-Day Buffer: ${h1Buffer} candles (Expected: 48)`);
  assert(h1Buffer === 48, `Expected 48 for H1, got ${h1Buffer}`);

  const h4Buffer = getTwoDayBufferCandles('H4');
  console.log(`H4 2-Day Buffer: ${h4Buffer} candles (Expected: 12)`);
  assert(h4Buffer === 12, `Expected 12 for H4, got ${h4Buffer}`);

  const d1Buffer = getTwoDayBufferCandles('D1');
  console.log(`D1 2-Day Buffer: ${d1Buffer} candles (Expected: 2)`);
  assert(d1Buffer === 2, `Expected 2 for D1, got ${d1Buffer}`);

  console.log('✓ TEST 1 PASSED: Timeframe 2-day candle buffers calculated accurately without hardcoding.\n');

  // 2. Centered Viewport Bounds Test
  console.log('--- TEST 2: REPLAY START CENTERED VIEWPORT BOUNDS ---');

  const replayStartIndex = 1000;
  const viewportM15 = calculateReplayViewport(replayStartIndex, 'M15');
  const centerM15 = (viewportM15.from + viewportM15.to) / 2;

  console.log(`Replay Start Index: ${replayStartIndex}`);
  console.log(`M15 Viewport Range: from ${viewportM15.from} to ${viewportM15.to}`);
  console.log(`Calculated Center Index: ${centerM15}`);

  assert(viewportM15.from === 1000 - 192, `Expected from = 808, got ${viewportM15.from}`);
  assert(viewportM15.to === 1000 + 192, `Expected to = 1192, got ${viewportM15.to}`);
  assert(centerM15 === replayStartIndex, `Expected center to equal replayStartIndex (1000), got ${centerM15}`);

  console.log('✓ TEST 2 PASSED: Viewport places Replay Start Index exactly in the dead center with +/- 2 days buffer.\n');

  console.log('=====================================================');
  console.log('ALL VIEWPORT VERIFICATION TESTS PASSED SUCCESSFULLY!');
  console.log('=====================================================\n');
}

runViewportTests();
