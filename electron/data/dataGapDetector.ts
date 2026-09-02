import { getDatabase } from '../database/db';
import { getTradingSessionCalendar, type TradingSessionCalendar } from './sessionConfig';

export type GapClassification =
  | 'EXPECTED_MARKET_CLOSURE'
  | 'POSSIBLE_GAP'
  | 'LARGE_DATA_GAP'
  | 'CONFIRMED_MISSING_DATA'
  | 'SOURCE_NO_DATA'
  | 'SOURCE_VALIDATION_FAILED';

export interface DataGap {
  fromTime: number; // Unix seconds UTC
  toTime: number;   // Unix seconds UTC
  durationSeconds: number;
  classification: GapClassification;
  formattedFrom: string;
  formattedTo: string;
  gapType: 'INTERNAL_GAP' | 'DATASET_START_BOUNDARY' | 'DATASET_END_BOUNDARY';
}

export interface GapDetectorConfig {
  largeGapThresholdSeconds?: number; // Default: 86400 (24h)
  expectedIntervalSeconds?: number;  // Default: 60 (for M1)
}

function formatUtcDate(unixSec: number): string {
  if (!unixSec) return '';
  return new Date(unixSec * 1000).toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
}

interface IntervalSegment {
  fromTime: number;
  toTime: number;
  isTradable: boolean;
}

/**
 * Segment a missing interval [gapStart, gapEnd] into contiguous tradable vs non-tradable segments.
 */
function segmentMissingInterval(
  gapStart: number,
  gapEnd: number,
  calendar: TradingSessionCalendar
): IntervalSegment[] {
  if (gapStart > gapEnd) return [];

  const totalSec = gapEnd - gapStart + 60;
  // Use adaptive step: 60s for short gaps, 10m for day gaps, 1h for multi-day gaps
  const stepSec = totalSec > 86400 * 7 ? 3600 : (totalSec > 86400 ? 600 : 60);

  const segments: IntervalSegment[] = [];
  let curStart = gapStart;
  let curTradable = calendar.isTradableMinute(gapStart);

  for (let t = gapStart; t <= gapEnd; t += stepSec) {
    const tradable = calendar.isTradableMinute(t);
    if (tradable !== curTradable) {
      segments.push({
        fromTime: curStart,
        toTime: Math.max(curStart, t - 1),
        isTradable: curTradable,
      });
      curStart = t;
      curTradable = tradable;
    }
  }

  segments.push({
    fromTime: curStart,
    toTime: gapEnd,
    isTradable: curTradable,
  });

  return segments;
}

/**
 * Coalesce contiguous / overlapping raw gap objects of identical classification.
 */
function coalesceGaps(rawGaps: DataGap[], largeGapThreshold: number): DataGap[] {
  if (rawGaps.length === 0) return [];

  // Filter out invalid zero/negative duration gaps
  const validGaps = rawGaps.filter((g) => g.fromTime <= g.toTime && g.durationSeconds > 0);
  if (validGaps.length === 0) return [];

  // Sort by fromTime
  validGaps.sort((a, b) => a.fromTime - b.fromTime);

  const merged: DataGap[] = [];
  let current = { ...validGaps[0] };

  for (let i = 1; i < validGaps.length; i++) {
    const next = validGaps[i];

    // If same classification and contiguous/overlapping (gap <= 3600s between segments of same class)
    const canMerge =
      current.classification === next.classification &&
      next.fromTime <= current.toTime + 3600;

    if (canMerge) {
      current.toTime = Math.max(current.toTime, next.toTime);
      current.durationSeconds = current.toTime - current.fromTime + 60;
      current.formattedTo = formatUtcDate(current.toTime);
      if (current.classification !== 'EXPECTED_MARKET_CLOSURE') {
        current.classification =
          current.durationSeconds >= largeGapThreshold ? 'LARGE_DATA_GAP' : 'POSSIBLE_GAP';
      }
    } else {
      merged.push(current);
      current = { ...next };
    }
  }
  merged.push(current);

  return merged;
}

/**
 * Forensic Data Integrity & Market-Session Aware Gap Detector (M1 Authoritative SSoT).
 *
 * Evaluates internal timestamp discontinuities between stored candle rows in O(N) time.
 * Distinguishes expected market closures (weekends/daily rollover) from unexpected missing data.
 *
 * Performance Optimized: Uses streaming iterator and cooperative event-loop yielding
 * to guarantee that the Electron Main Process message pumping loop never starves.
 */
export async function detectDataGaps(
  symbolId: number,
  timeframe: string = 'M1',
  fromTime?: number,
  toTime?: number,
  config?: GapDetectorConfig
): Promise<{
  symbolId: number;
  timeframe: string;
  firstTime: number | null;
  lastTime: number | null;
  totalCandles: number;
  gaps: DataGap[];
  recoverableMissingRanges: DataGap[];
  internalGapsCount: number;
  unexpectedGapsCount: number;
  hasLargeGap: boolean;
}> {
  const database = getDatabase();

  // Lookup symbol name to resolve appropriate session calendar (schema: symbols.id, symbols.name)
  const symRow = database
    .prepare('SELECT name FROM symbols WHERE id = ?')
    .get(symbolId) as { name: string } | undefined;
  const symbolName = symRow?.name ?? 'UNKNOWN';
  const calendar = getTradingSessionCalendar(symbolName);

  const largeGapThreshold = config?.largeGapThresholdSeconds ?? 86400; // 24h default
  const expectedInterval = config?.expectedIntervalSeconds ?? (timeframe === 'M1' ? 60 : 60);

  // Build lightweight timestamp query
  let sql = 'SELECT time FROM candles WHERE symbol_id = ? AND timeframe = ?';
  const params: any[] = [symbolId, timeframe.toUpperCase()];

  if (fromTime !== undefined && fromTime !== null) {
    sql += ' AND time >= ?';
    params.push(fromTime);
  }
  if (toTime !== undefined && toTime !== null) {
    sql += ' AND time <= ?';
    params.push(toTime);
  }
  sql += ' ORDER BY time ASC';

  const rawGaps: DataGap[] = [];
  let firstTime: number | null = null;
  let lastTime: number | null = null;
  let prevTime: number | null = null;
  let totalCandles = 0;

  // Stream rows via SQLite iterator to avoid massive single-array memory allocation
  const iterator = database.prepare(sql).iterate(...params) as Iterable<{ time: number }>;

  for (const row of iterator) {
    totalCandles++;
    if (firstTime === null) {
      firstTime = row.time;
    }
    lastTime = row.time;

    if (prevTime !== null) {
      const delta = row.time - prevTime;

      // Discontinuity detected if delta > expected step
      if (delta > expectedInterval) {
        const gapStart = prevTime + expectedInterval;
        const gapEnd = row.time - expectedInterval;

        if (gapStart <= gapEnd) {
          // Evaluate segments inside [gapStart, gapEnd]
          const segments = segmentMissingInterval(gapStart, gapEnd, calendar);

          for (const seg of segments) {
            const segDuration = seg.toTime - seg.fromTime + 60;
            if (segDuration > 0) {
              let classification: 'EXPECTED_MARKET_CLOSURE' | 'POSSIBLE_GAP' | 'LARGE_DATA_GAP';

              if (!seg.isTradable) {
                classification = 'EXPECTED_MARKET_CLOSURE';
              } else if (segDuration >= largeGapThreshold) {
                classification = 'LARGE_DATA_GAP';
              } else {
                classification = 'POSSIBLE_GAP';
              }

              rawGaps.push({
                fromTime: seg.fromTime,
                toTime: seg.toTime,
                durationSeconds: segDuration,
                classification,
                formattedFrom: formatUtcDate(seg.fromTime),
                formattedTo: formatUtcDate(seg.toTime),
                gapType: 'INTERNAL_GAP',
              });
            }
          }
        }
      }
    }

    prevTime = row.time;

    // Yield to the Node.js event loop every 10,000 candles so window message pumping never freezes
    if (totalCandles % 10000 === 0) {
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
  }

  // Handle empty dataset case
  if (totalCandles === 0) {
    if (fromTime !== undefined && fromTime !== null && toTime !== undefined && toTime !== null && fromTime <= toTime) {
      const segments = segmentMissingInterval(fromTime, toTime, calendar);
      for (const seg of segments) {
        const segDuration = seg.toTime - seg.fromTime + 60;
        if (segDuration > 0) {
          rawGaps.push({
            fromTime: seg.fromTime,
            toTime: seg.toTime,
            durationSeconds: segDuration,
            classification: !seg.isTradable ? 'EXPECTED_MARKET_CLOSURE' : segDuration >= largeGapThreshold ? 'LARGE_DATA_GAP' : 'POSSIBLE_GAP',
            formattedFrom: formatUtcDate(seg.fromTime),
            formattedTo: formatUtcDate(seg.toTime),
            gapType: 'INTERNAL_GAP',
          });
        }
      }
    }
    const gaps = coalesceGaps(rawGaps, largeGapThreshold);
    const recoverableMissingRanges = gaps.filter(
      (g) => g.classification === 'POSSIBLE_GAP' || g.classification === 'LARGE_DATA_GAP'
    );
    return {
      symbolId,
      timeframe: timeframe.toUpperCase(),
      firstTime: null,
      lastTime: null,
      totalCandles: 0,
      gaps,
      recoverableMissingRanges,
      internalGapsCount: gaps.length,
      unexpectedGapsCount: recoverableMissingRanges.length,
      hasLargeGap: recoverableMissingRanges.some((g) => g.classification === 'LARGE_DATA_GAP'),
    };
  }

  // Boundary gap before firstTime if fromTime is specified and fromTime < firstTime
  if (fromTime !== undefined && fromTime !== null && firstTime !== null && fromTime < firstTime - expectedInterval) {
    const gapStart = fromTime;
    const gapEnd = firstTime - expectedInterval;
    const segments = segmentMissingInterval(gapStart, gapEnd, calendar);
    for (const seg of segments) {
      const segDuration = seg.toTime - seg.fromTime + 60;
      if (segDuration > 0) {
        rawGaps.push({
          fromTime: seg.fromTime,
          toTime: seg.toTime,
          durationSeconds: segDuration,
          classification: !seg.isTradable ? 'EXPECTED_MARKET_CLOSURE' : segDuration >= largeGapThreshold ? 'LARGE_DATA_GAP' : 'POSSIBLE_GAP',
          formattedFrom: formatUtcDate(seg.fromTime),
          formattedTo: formatUtcDate(seg.toTime),
          gapType: 'DATASET_START_BOUNDARY',
        });
      }
    }
  }

  // Boundary gap after lastTime if toTime is specified and toTime > lastTime
  if (toTime !== undefined && toTime !== null && lastTime !== null && toTime > lastTime + expectedInterval) {
    const gapStart = lastTime + expectedInterval;
    const gapEnd = toTime;
    const segments = segmentMissingInterval(gapStart, gapEnd, calendar);
    for (const seg of segments) {
      const segDuration = seg.toTime - seg.fromTime + 60;
      if (segDuration > 0) {
        rawGaps.push({
          fromTime: seg.fromTime,
          toTime: seg.toTime,
          durationSeconds: segDuration,
          classification: !seg.isTradable ? 'EXPECTED_MARKET_CLOSURE' : segDuration >= largeGapThreshold ? 'LARGE_DATA_GAP' : 'POSSIBLE_GAP',
          formattedFrom: formatUtcDate(seg.fromTime),
          formattedTo: formatUtcDate(seg.toTime),
          gapType: 'DATASET_END_BOUNDARY',
        });
      }
    }
  }

  // Coalesce contiguous gap segments
  const gaps = coalesceGaps(rawGaps, largeGapThreshold);

  // Separate recoverable ranges (strictly exclude EXPECTED_MARKET_CLOSURE)
  const recoverableMissingRanges = gaps.filter(
    (g) => g.classification === 'POSSIBLE_GAP' || g.classification === 'LARGE_DATA_GAP'
  );

  const unexpectedGapsCount = recoverableMissingRanges.length;
  const hasLargeGap = recoverableMissingRanges.some((g) => g.classification === 'LARGE_DATA_GAP');

  return {
    symbolId,
    timeframe: timeframe.toUpperCase(),
    firstTime,
    lastTime,
    totalCandles,
    gaps,
    recoverableMissingRanges,
    internalGapsCount: gaps.length,
    unexpectedGapsCount,
    hasLargeGap,
  };
}
