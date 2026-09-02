/**
 * features/chart/candleResolver.ts
 *
 * Phase 9 — Replay Engine + Generated Timeframe Integration Resolver.
 * Resolves replay-visible candlestick dataset for any requested timeframe:
 * 1. Completed historical candles come from pre-generated SQLite TF candles.
 * 2. Currently forming (incomplete) candle is dynamically constructed from M1 source candles up to currentReplayTime.
 * 3. Prevents future-candle OHLC leakage (a TF candle whose interval ends after currentReplayTime is NEVER taken from pre-generated dataset).
 * 4. Preserves currentReplayTime as an immutable UTC anchor during timeframe switches.
 */

import type { Candle, Timeframe } from '@/types';
import { getNYCloseAnchor } from '../../utils/timezone';

export const TIMEFRAME_SECONDS: Record<string, number> = {
  M1: 60,
  '1m': 60,
  '1M': 60,
  M3: 180,
  '3m': 180,
  '3M': 180,
  M5: 300,
  '5m': 300,
  '5M': 300,
  M15: 900,
  '15m': 900,
  '15M': 900,
  M30: 1800,
  '30m': 1800,
  '30M': 1800,
  H1: 3600,
  '1H': 3600,
  '1h': 3600,
  H4: 14400,
  '4H': 14400,
  '4h': 14400,
  H7: 25200,
  '7H': 25200,
  '7h': 25200,
  D1: 86400,
  '1D': 86400,
  '1d': 86400,
  W1: 604800,
  '1W': 604800,
  '1w': 604800,
  Monthly: 2592000,
  '1MN': 2592000,
  MN: 2592000,
  MN1: 2592000,
  MONTHLY: 2592000,
};

const WEEK_MONDAY_ANCHOR = -3 * 86400; // Thursday 1970-01-01 -> Monday 00:00 UTC anchor

/**
 * Calculates start of bucket timestamp (Unix seconds UTC) for a given timestamp and timeframe.
 */
export function getBucketStart(timeUTC: number, timeframe: string | Timeframe, anchorOffset = 0): number {
  const tf = String(timeframe).trim();
  const norm = tf.toUpperCase();

  // Robustly parse the timeframe to seconds (supporting custom timeframes like H6 or 6H)
  let size = 60;
  if (TIMEFRAME_SECONDS[tf]) size = TIMEFRAME_SECONDS[tf];
  else if (TIMEFRAME_SECONDS[norm]) size = TIMEFRAME_SECONDS[norm];
  else {
    const matchPrefix = norm.match(/^([MHDW])(\d+)$/);
    if (matchPrefix) {
      const unit = matchPrefix[1];
      const val = parseInt(matchPrefix[2], 10);
      if (unit === 'M') size = val * 60;
      else if (unit === 'H') size = val * 3600;
      else if (unit === 'D') size = val * 86400;
      else if (unit === 'W') size = val * 604800;
    } else {
      const matchSuffix = norm.match(/^(\d+)([MHDW])$/);
      if (matchSuffix) {
        const val = parseInt(matchSuffix[1], 10);
        const unit = matchSuffix[2];
        if (unit === 'M') size = val * 60;
        else if (unit === 'H') size = val * 3600;
        else if (unit === 'D') size = val * 86400;
        else if (unit === 'W') size = val * 604800;
      }
    }
  }

  if (norm === 'W1' || norm === '1W' || norm === 'W') {
    return WEEK_MONDAY_ANCHOR + Math.floor((timeUTC - WEEK_MONDAY_ANCHOR) / 604800) * 604800;
  }

  if (norm === 'MONTHLY' || norm === 'MN' || norm === '1MN' || norm === 'MN1' || norm === 'M1N') {
    const d = new Date(timeUTC * 1000);
    return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000);
  }

  // Anchor NY Close for any Hour or Day based timeframe
  if (norm.includes('H') || norm.includes('D')) {
    const anchor = getNYCloseAnchor(timeUTC) + anchorOffset;
    return anchor + Math.floor((timeUTC - anchor) / size) * size;
  }

  return Math.floor(timeUTC / size) * size;
}

/**
 * Calculates end timestamp (exclusive boundary) for a candle starting at bucketStartUTC.
 */
export function getBucketEnd(bucketStartUTC: number, timeframe: string | Timeframe): number {
  const tf = String(timeframe).trim();
  const norm = tf.toUpperCase();
  if (norm === 'MONTHLY' || norm === 'MN' || norm === '1MN' || norm === 'MN1' || norm === 'M1N') {
    const d = new Date(bucketStartUTC * 1000);
    return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / 1000);
  }
  const size = TIMEFRAME_SECONDS[tf] ?? TIMEFRAME_SECONDS[norm] ?? 60;
  return bucketStartUTC + size;
}

export function findFirstIdx(candles: Candle[], minTime: number): number {
  let lo = 0;
  let hi = candles.length - 1;
  let res = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (candles[mid].time >= minTime) {
      res = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }
  return res;
}

export function findLastIdx(candles: Candle[], maxTime: number): number {
  let lo = 0;
  let hi = candles.length - 1;
  let res = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (candles[mid].time <= maxTime) {
      res = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return res;
}

/**
 * Helper to get the latest legitimately known M1 close price at or immediately before currentReplayTime.
 * Respects M1 timestamp semantics (candle.time = OPEN time, candle closes at candle.time + 60).
 */
export function getLatestKnownM1PriceAt(
  m1Candles: Candle[],
  currentReplayTime: number
): number | null {
  if (!m1Candles || m1Candles.length === 0) return null;
  const idx = findLastIdx(m1Candles, currentReplayTime);
  return idx >= 0 ? m1Candles[idx].close : null;
}

/**
 * Determines whether a timeframe candle is fully completed at currentReplayTime.
 * A candle starting at `candleTimeUTC` is completed ONLY IF currentReplayTime >= bucketEnd.
 */
export function isCandleCompleted(
  candleTimeUTC: number,
  currentReplayTime: number,
  timeframe: string | Timeframe
): boolean {
  const bucketEnd = getBucketEnd(candleTimeUTC, timeframe);
  return currentReplayTime >= bucketEnd;
}

export interface PartialCandleCache {
  bucketStartUTC: number;
  lastEndIdx: number;
  high: number;
  low: number;
  volumeSum: number;
}

/**
 * Constructs a single partial forming candle from M1 source candles available up to currentReplayTime.
 */
export function constructPartialCandle(
  m1Candles: Candle[],
  bucketStartUTC: number,
  currentReplayTime: number,
  cache?: PartialCandleCache
): Candle | null {
  const startIdx = findFirstIdx(m1Candles, bucketStartUTC);
  const endIdx = findLastIdx(m1Candles, currentReplayTime);

  if (startIdx < 0 || endIdx < 0 || startIdx > endIdx) return null;

  let high: number;
  let low: number;
  let volumeSum: number;
  let loopStart: number;

  const first = m1Candles[startIdx];

  if (cache && cache.bucketStartUTC === bucketStartUTC && cache.lastEndIdx >= startIdx && endIdx >= cache.lastEndIdx) {
    high = cache.high;
    low = cache.low;
    volumeSum = cache.volumeSum;
    loopStart = cache.lastEndIdx + 1;
  } else {
    high = first.high;
    low = first.low;
    volumeSum = 0;
    loopStart = startIdx;
  }

  for (let i = loopStart; i <= endIdx; i++) {
    const c = m1Candles[i];
    if (c.high > high) high = c.high;
    if (c.low < low) low = c.low;
    if (c.volume != null) volumeSum += c.volume;
  }

  if (cache) {
    cache.bucketStartUTC = bucketStartUTC;
    cache.lastEndIdx = endIdx;
    cache.high = high;
    cache.low = low;
    cache.volumeSum = volumeSum;
  }

  return {
    time: bucketStartUTC,
    open: first.open,
    high,
    low,
    close: m1Candles[endIdx].close,
    volume: volumeSum > 0 ? volumeSum : undefined,
    source: 'M1_ONGOING',
  };
}

/**
 * Constructs a hybrid ongoing candle for HTF (D1, W1, Monthly) by combining:
 * 1. Valid completed lower-TF candles (e.g. H1 for D1, D1 for W1/Monthly) inside active bucket boundary whose closeTime <= currentReplayTime.
 * 2. M1 source candles for the current incomplete lower-TF segment up to currentReplayTime.
 */
export function constructHybridPartialCandle(
  lowerTfCandles: Candle[],
  m1Candles: Candle[],
  bucketStartUTC: number,
  currentReplayTime: number,
  lowerTimeframe: string | Timeframe
): Candle | null {
  // 1. Completed lower-TF bars inside current active bucket
  const completedLower = lowerTfCandles.filter(
    (c) => c.time >= bucketStartUTC && isCandleCompleted(c.time, currentReplayTime, lowerTimeframe)
  );

  let lastCompletedBoundary = bucketStartUTC;
  if (completedLower.length > 0) {
    const lastBar = completedLower[completedLower.length - 1];
    lastCompletedBoundary = getBucketEnd(lastBar.time, lowerTimeframe);
  }

  // 2. M1 candles for current incomplete segment
  const startIdx = findFirstIdx(m1Candles, lastCompletedBoundary);
  const endIdx = findLastIdx(m1Candles, currentReplayTime);
  const partialM1 = (startIdx >= 0 && endIdx >= 0 && startIdx <= endIdx)
    ? m1Candles.slice(startIdx, endIdx + 1)
    : [];

  if (completedLower.length === 0 && partialM1.length === 0) {
    return constructPartialCandle(m1Candles, bucketStartUTC, currentReplayTime);
  }

  const firstOpen = completedLower.length > 0 ? completedLower[0].open : partialM1[0].open;
  const lastClose = partialM1.length > 0 ? partialM1[partialM1.length - 1].close : completedLower[completedLower.length - 1].close;

  let high = firstOpen;
  let low = firstOpen;
  let volumeSum = 0;

  for (const c of completedLower) {
    if (c.high > high) high = c.high;
    if (c.low < low) low = c.low;
    if (c.volume != null) volumeSum += c.volume;
  }
  for (const c of partialM1) {
    if (c.high > high) high = c.high;
    if (c.low < low) low = c.low;
    if (c.volume != null) volumeSum += c.volume;
  }

  const normLower = String(lowerTimeframe).trim();
  const sourceTag = normLower === 'H1' ? 'HYBRID_H1_M1' : 'HYBRID_D1_M1';

  return {
    time: bucketStartUTC,
    open: firstOpen,
    high,
    low,
    close: lastClose,
    volume: volumeSum > 0 ? volumeSum : undefined,
    source: sourceTag,
  };
}

/**
 * Resolves the replay dataset for a selected timeframe at currentReplayTime.
 * - Uses pre-generated SQLite TF candles ONLY for completed bars (closeTime <= currentReplayTime).
 * - Constructs active forming bar for ongoing candle containing currentReplayTime.
 * - Enforces zero future candle OHLC leakage and price continuity.
 */
export function resolveReplayCandles(params: {
  timeframe: string | Timeframe;
  currentReplayTime: number | null;
  tfCandles: Candle[];
  m1Candles: Candle[];
  symbolId?: number | null;
}): Candle[] {
  const { timeframe, currentReplayTime, tfCandles, m1Candles } = params;

  if (currentReplayTime === null || timeframe === 'M1' || timeframe === '1M') {
    const lastIdx = currentReplayTime !== null ? findLastIdx(tfCandles, currentReplayTime) : -1;
    const raw = currentReplayTime !== null
      ? (lastIdx >= 0 ? tfCandles.slice(0, lastIdx + 1) : [])
      : tfCandles;
    return raw.map((c) => ({ ...c, source: 'SQLITE_CLOSED' }));
  }

  // 1. Keep pre-generated TF candles ONLY if they are fully completed at currentReplayTime.
  // Uses O(log N) binary search over sorted tfCandles.
  let lo = 0;
  let hi = tfCandles.length - 1;
  let lastCompletedIdx = -1;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (isCandleCompleted(tfCandles[mid].time, currentReplayTime, timeframe)) {
      lastCompletedIdx = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  const completedBars = lastCompletedIdx >= 0
    ? tfCandles.slice(0, lastCompletedIdx + 1).map((c) => ({ ...c, source: 'SQLITE_CLOSED' }))
    : [];

  // 2. Identify active forming bucket containing currentReplayTime
  const activeBucketStart = getBucketStart(currentReplayTime, timeframe);
  const activeBucketEnd = getBucketEnd(activeBucketStart, timeframe);

  // Check if currentReplayTime is within active bucket range
  if (currentReplayTime < activeBucketStart || currentReplayTime >= activeBucketEnd) {
    return completedBars;
  }

  // 3. Construct active forming partial candle
  let partialCandle: Candle | null = null;
  const normTf = String(timeframe).trim();

  if (normTf === 'D1' || normTf === '1D' || normTf === 'D') {
    partialCandle = constructHybridPartialCandle(tfCandles, m1Candles, activeBucketStart, currentReplayTime, 'H1');
  } else if (normTf === 'W1' || normTf === '1W' || normTf === 'Monthly' || normTf === 'MN') {
    partialCandle = constructHybridPartialCandle(tfCandles, m1Candles, activeBucketStart, currentReplayTime, 'D1');
  } else {
    partialCandle = constructPartialCandle(m1Candles, activeBucketStart, currentReplayTime);
  }

  if (partialCandle) {
    return [...completedBars, partialCandle];
  }

  return completedBars;
}
