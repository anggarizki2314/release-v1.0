import type { Candle } from '@/types';
import { calculateSessionOpens } from '../calculations/sessionOpens';
import type { OpenLevelConfig } from '../types';

function runSessionOpensTests() {
  console.log('--- RUNNING SESSION OPENS VERIFICATION TEST SUITE ---');
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      console.log(`[PASS] Test ${total}: ${msg}`);
      passed++;
    } else {
      console.error(`[FAIL] Test ${total}: ${msg}`);
      process.exit(1);
    }
  }

  // Create mock candles across 2 days: 2026-08-20 & 2026-08-21
  // 1-hour candles
  const candles: Candle[] = [];
  const startDay1 = Math.floor(Date.UTC(2026, 7, 20, 0, 0, 0) / 1000); // 2026-08-20 00:00 UTC

  for (let i = 0; i < 48; i++) {
    const t = startDay1 + i * 3600;
    const base = 100 + i * 0.5;
    candles.push({
      time: t,
      open: base,
      high: base + 0.4,
      low: base - 0.2,
      close: base + 0.3,
      volume: 1000,
    });
  }

  const defaultOpens: OpenLevelConfig[] = [
    { id: 'do', name: 'Daily Open', enabled: true, timeUtc: '00:00', color: '#38bdf8', lineStyle: 'dashed', lineWidth: 1.5 },
    { id: 'lo', name: 'London Open', enabled: true, timeUtc: '07:00', color: '#a855f7', lineStyle: 'solid', lineWidth: 1.5 },
    { id: 'nyo', name: 'NY Open', enabled: true, timeUtc: '12:00', color: '#f97316', lineStyle: 'solid', lineWidth: 1.5 },
  ];

  // Test 1: Empty candles or empty config
  const emptyRes = calculateSessionOpens([], defaultOpens, 'H1');
  assert(emptyRes.length === 0, 'Empty candles return empty lines');

  // Test 2: Disabled config returns empty
  const disabledRes = calculateSessionOpens(candles, defaultOpens.map(o => ({ ...o, enabled: false })), 'H1');
  assert(disabledRes.length === 0, 'All disabled opens return empty lines');

  // Test 3: Calculates opens for both days
  const lines = calculateSessionOpens(candles, defaultOpens, 'H1');
  assert(lines.length === 6, `Calculates 6 lines (3 per day for 2 days), got ${lines.length}`);

  // Test 4: Day 1 Daily Open matches candle at index 0 (time 2026-08-20 00:00)
  const day1DO = lines.find(l => l.name === 'Daily Open' && l.startTime === startDay1);
  assert(day1DO !== undefined && day1DO.price === candles[0].open, `Day 1 DO has exact open price ${candles[0].open}`);

  // Test 5: Day 1 London Open (07:00 UTC = index 7)
  const day1LO = lines.find(l => l.name === 'London Open' && l.startTime === startDay1 + 7 * 3600);
  assert(day1LO !== undefined && day1LO.price === candles[7].open, `Day 1 LO has exact open price ${candles[7].open}`);

  // Test 6: Day 1 NY Open (12:00 UTC = index 12)
  const day1NYO = lines.find(l => l.name === 'NY Open' && l.startTime === startDay1 + 12 * 3600);
  assert(day1NYO !== undefined && day1NYO.price === candles[12].open, `Day 1 NYO has exact open price ${candles[12].open}`);

  // Test 7: Day 2 Daily Open (index 24)
  const day2DO = lines.find(l => l.name === 'Daily Open' && l.startTime === startDay1 + 24 * 3600);
  assert(day2DO !== undefined && day2DO.price === candles[24].open, `Day 2 DO has exact open price ${candles[24].open}`);

  // Test 8: End times bounded cleanly by next day boundary
  const day1Boundary = Math.floor(Date.UTC(2026, 7, 21, 0, 0, 0) / 1000);
  assert(day1DO?.endTime === day1Boundary, `Day 1 line ends at next day start ${day1Boundary}`);

  // Test 9: Viewport culling (only request Day 2)
  const day2Start = startDay1 + 24 * 3600;
  const day2Culled = calculateSessionOpens(candles, defaultOpens, 'H1', day2Start, day2Start + 86400);
  assert(day2Culled.some(l => l.startTime >= day2Start), 'Viewport culling correctly includes visible day lines');

  // Test 10: Custom open time (e.g. 04:00 UTC NY Midnight Open)
  const customOpens: OpenLevelConfig[] = [
    { id: 'midnight', name: 'Midnight Open', enabled: true, timeUtc: '04:00', color: '#eab308', lineStyle: 'dotted', lineWidth: 1.5 },
  ];
  const midnightLines = calculateSessionOpens(candles, customOpens, 'H1');
  assert(midnightLines.length === 2 && midnightLines[0].price === candles[4].open, `Custom 04:00 open matches index 4 price ${candles[4].open}`);

  console.log(`\nResult: ${passed}/${total} passed. Success: ${passed === total}\n`);
}

runSessionOpensTests();
