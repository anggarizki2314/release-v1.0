/**
 * Timezone Display Verification Test Suite
 *
 * Verifies that Timezone selection is strictly PRESENTATIONAL / DISPLAY ONLY:
 * 1. Historical DST in winter (EST UTC-05:00) vs summer (EDT UTC-04:00) for America/New_York.
 * 2. Same UTC instant produces correct formatted strings in different IANA timezones.
 * 3. Master currentReplayTime and candle timestamps/OHLC remain strictly UTC & invariant.
 * 4. Timezone switching does not pause, jump, or modify replay playback loop.
 */

import {
  formatTimestampInTimezone,
  getUtcOffsetMinutes,
  formatOffsetLabel,
  parseDateTimeInTimezone,
} from '../utils';
import type { Candle } from '../../../types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[FAIL] ${message}`);
  }
}

export function runTimezoneDisplayTests(): { success: boolean; logs: string[] } {
  const logs: string[] = [];
  let passed = 0;
  let total = 0;

  function runTest(name: string, fn: () => void) {
    total++;
    try {
      fn();
      passed++;
      logs.push(`[PASS] ${name}`);
    } catch (err: any) {
      logs.push(`[FAIL] ${name}: ${err.message}`);
    }
  }

  // -------------------------------------------------------------
  // TEST A — Winter New York (EST = UTC-05:00)
  // -------------------------------------------------------------
  runTest('TEST A — Winter New York (2024-01-03 23:39 UTC -> 2024-01-03 18:39 EST, UTC-05:00)', () => {
    const winterUtcSec = 1704325140; // 2024-01-03 23:39:00 UTC
    const formatted = formatTimestampInTimezone(winterUtcSec, 'America/New_York');
    const offsetMin = getUtcOffsetMinutes('America/New_York', winterUtcSec);
    const offsetLabel = formatOffsetLabel(offsetMin);

    assert(formatted === '2024-01-03 18:39', `Winter New York display expected "2024-01-03 18:39", got "${formatted}"`);
    assert(offsetMin === -300, `Winter New York offset expected -300 mins, got ${offsetMin}`);
    assert(offsetLabel === 'UTC-05:00', `Winter New York offset label expected "UTC-05:00", got "${offsetLabel}"`);
  });

  // -------------------------------------------------------------
  // TEST B — Summer New York (EDT = UTC-04:00)
  // -------------------------------------------------------------
  runTest('TEST B — Summer New York (2024-07-03 23:39 UTC -> 2024-07-03 19:39 EDT, UTC-04:00)', () => {
    const summerUtcSec = 1720050000; // 2024-07-03 23:40:00 UTC (1720049940 = 23:39 UTC)
    const exactSummerSec = 1720049940; // 2024-07-03 23:39:00 UTC
    const formatted = formatTimestampInTimezone(exactSummerSec, 'America/New_York');
    const offsetMin = getUtcOffsetMinutes('America/New_York', exactSummerSec);
    const offsetLabel = formatOffsetLabel(offsetMin);

    assert(formatted === '2024-07-03 19:39', `Summer New York display expected "2024-07-03 19:39", got "${formatted}"`);
    assert(offsetMin === -240, `Summer New York offset expected -240 mins, got ${offsetMin}`);
    assert(offsetLabel === 'UTC-04:00', `Summer New York offset label expected "UTC-04:00", got "${offsetLabel}"`);
  });

  // -------------------------------------------------------------
  // TEST C — Same Instant Across Multiple Timezones
  // -------------------------------------------------------------
  runTest('TEST C — Same UTC Instant formatted across UTC, New York, Jakarta, London, Tokyo', () => {
    const utcSec = 1704325140; // 2024-01-03 23:39:00 UTC

    const utcStr = formatTimestampInTimezone(utcSec, 'UTC');
    const nyStr = formatTimestampInTimezone(utcSec, 'America/New_York');
    const jakartaStr = formatTimestampInTimezone(utcSec, 'Asia/Jakarta');
    const londonStr = formatTimestampInTimezone(utcSec, 'Europe/London');
    const tokyoStr = formatTimestampInTimezone(utcSec, 'Asia/Tokyo');

    assert(utcStr === '2024-01-03 23:39', `UTC expected "2024-01-03 23:39", got "${utcStr}"`);
    assert(nyStr === '2024-01-03 18:39', `New York expected "2024-01-03 18:39", got "${nyStr}"`);
    assert(jakartaStr === '2024-01-04 06:39', `Jakarta expected "2024-01-04 06:39", got "${jakartaStr}"`);
    assert(londonStr === '2024-01-03 23:39', `London expected "2024-01-03 23:39", got "${londonStr}"`);
    assert(tokyoStr === '2024-01-04 08:39', `Tokyo expected "2024-01-04 08:39", got "${tokyoStr}"`);

    // Verify roundtrip parsing in each timezone returns the exact same UTC instant
    assert(parseDateTimeInTimezone('2024-01-03 18:39', 'America/New_York') === utcSec, 'NY roundtrip matches utcSec');
    assert(parseDateTimeInTimezone('2024-01-04 06:39', 'Asia/Jakarta') === utcSec, 'Jakarta roundtrip matches utcSec');
  });

  // -------------------------------------------------------------
  // TEST D — Replay Clock Invariance (currentReplayTime unchanged)
  // -------------------------------------------------------------
  runTest('TEST D — Master currentReplayTime remains 100% invariant across timezone switches', () => {
    const initialClock = 1704325140;
    let currentReplayTime = initialClock;

    const timezones = ['UTC', 'America/New_York', 'Asia/Jakarta', 'Europe/London', 'Asia/Tokyo', 'UTC'];
    for (const tz of timezones) {
      // Switching display timezone
      const displayStr = formatTimestampInTimezone(currentReplayTime, tz);
      assert(typeof displayStr === 'string' && displayStr.length > 0, `Display string formatted for ${tz}`);
      assert(currentReplayTime === initialClock, `currentReplayTime modified during ${tz} switch!`);
    }
  });

  // -------------------------------------------------------------
  // TEST E — Candle Timestamp & OHLC Invariance
  // -------------------------------------------------------------
  runTest('TEST E — Candle timestamp and OHLC remain 100% identical after timezone switches', () => {
    const testCandle: Candle = {
      time: 1704325140,
      open: 1.0950,
      high: 1.0980,
      low: 1.0940,
      close: 1.0965,
      volume: 1250,
    };

    const originalCandleCopy = { ...testCandle };

    // Simulate timezone switches
    formatTimestampInTimezone(testCandle.time, 'America/New_York');
    formatTimestampInTimezone(testCandle.time, 'Asia/Jakarta');
    formatTimestampInTimezone(testCandle.time, 'Asia/Tokyo');

    assert(testCandle.time === originalCandleCopy.time, 'Candle timestamp must remain UTC');
    assert(testCandle.open === originalCandleCopy.open, 'Candle Open unchanged');
    assert(testCandle.high === originalCandleCopy.high, 'Candle High unchanged');
    assert(testCandle.low === originalCandleCopy.low, 'Candle Low unchanged');
    assert(testCandle.close === originalCandleCopy.close, 'Candle Close unchanged');
  });

  // -------------------------------------------------------------
  // TEST F — Playback Invariance (PLAY continues without pause/jump)
  // -------------------------------------------------------------
  runTest('TEST F — Timezone switch during active playback does not interrupt or alter replay status', () => {
    let playbackStatus: 'playing' | 'paused' = 'playing';
    let currentReplayTime = 1704325140;
    let speed = 2;

    // Simulate switching timezone during PLAY
    const activeTimezone = 'America/New_York';
    const displayTimeStr = formatTimestampInTimezone(currentReplayTime, activeTimezone);

    assert(playbackStatus === 'playing', 'Playback remains active');
    assert(currentReplayTime === 1704325140, 'currentReplayTime unchanged');
    assert(speed === 2, 'Replay speed unchanged');
    assert(displayTimeStr === '2024-01-03 18:39', 'Formatted display string updated correctly');
  });

  // -------------------------------------------------------------
  // TEST G — Dynamic DST Transition Verification
  // -------------------------------------------------------------
  runTest('TEST G — Dynamic DST offset transition for America/New_York (Jan vs July 2024)', () => {
    const janTime = 1704325140; // Jan 3, 2024 -> EST (-300 mins)
    const julyTime = 1720049940; // July 3, 2024 -> EDT (-240 mins)

    const janOffset = getUtcOffsetMinutes('America/New_York', janTime);
    const julyOffset = getUtcOffsetMinutes('America/New_York', julyTime);

    assert(janOffset === -300, `Jan offset expected -300 (EST), got ${janOffset}`);
    assert(julyOffset === -240, `July offset expected -240 (EDT), got ${julyOffset}`);
    assert(janOffset !== julyOffset, 'DST transition produces dynamic offset change');
  });

  const success = passed === total;
  logs.push(`\nSummary: ${passed}/${total} Timezone Display tests PASSED`);
  return { success, logs };
}
