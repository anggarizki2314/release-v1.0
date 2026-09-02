/**
 * utils/dataResampler.ts
 *
 * Efficient M1 (1-Minute) Candlestick Downsampling & Memoized Aggregation Engine.
 */

import type { Candle, Timeframe } from '@/types';
import { getBucketStart } from '@/features/chart/candleResolver';

/**
 * Converts a timeframe string to seconds.
 */
export function timeframeToSeconds(tf: string | Timeframe): number {
  const norm = String(tf).trim().toUpperCase();
  let sec = 60;

  switch (norm) {
    case 'M1':
    case '1M':
    case '1':
      sec = 60;
      break;
    case 'M3':
    case '3M':
    case '3':
      sec = 180;
      break;
    case 'M5':
    case '5M':
    case '5':
      sec = 300;
      break;
    case 'M15':
    case '15M':
    case '15':
      sec = 900;
      break;
    case 'M30':
    case '30M':
    case '30':
      sec = 1800;
      break;
    case 'H1':
    case '1H':
    case '60':
      sec = 3600;
      break;
    case 'H4':
    case '4H':
    case '240':
      sec = 14400;
      break;
    case 'H7':
    case '7H':
    case '420':
      sec = 25200;
      break;
    case 'D1':
    case '1D':
    case 'D':
    case '1440':
      sec = 86400;
      break;
    case 'W1':
    case '1W':
    case 'W':
      sec = 604800;
      break;
    case 'MN1':
    case 'MN':
    case '1MN':
    case 'M1N':
    case 'MONTHLY':
      sec = 2592000;
      break;
    default: {
      const matchPrefix = norm.match(/^([MHDW])(\d+)$/);
      if (matchPrefix) {
        const unit = matchPrefix[1];
        const val = parseInt(matchPrefix[2], 10);
        if (unit === 'M') sec = val * 60;
        else if (unit === 'H') sec = val * 3600;
        else if (unit === 'D') sec = val * 86400;
        else if (unit === 'W') sec = val * 604800;
      } else {
        const matchSuffix = norm.match(/^(\d+)([MHDW])$/);
        if (matchSuffix) {
          const val = parseInt(matchSuffix[1], 10);
          const unit = matchSuffix[2];
          if (unit === 'M') sec = val * 60;
          else if (unit === 'H') sec = val * 3600;
          else if (unit === 'D') sec = val * 86400;
          else if (unit === 'W') sec = val * 604800;
        } else {
          sec = 60;
        }
      }
    }
  }

  return sec;
}

// In-memory cache for resampled candle datasets
const resampleCache = new Map<string, Candle[]>();

/**
 * Clears the resample cache if datasets are unmounted or updated.
 */
export function clearResampleCache(): void {
  resampleCache.clear();
}

/**
 * Aggregates M1 candles into target timeframe candles with high-performance O(N) single-pass bucket aggregation.
 * Utilizes memoized caching to ensure 0-recomputation when switching timeframes back and forth.
 */
export function resampleCandles(
  candles: Candle[],
  targetTimeframe: string | Timeframe,
  anchorOffset: number = 0,
  limitMaxCandles?: number
): Candle[] {
  if (!candles || candles.length === 0) return [];

  const intervalSec = timeframeToSeconds(targetTimeframe);

  // If timeframe is 1-minute (or unparsed default 60), return candles directly
  if (intervalSec <= 60) {
    return (limitMaxCandles && candles.length > limitMaxCandles)
      ? candles.slice(candles.length - limitMaxCandles)
      : candles;
  }

  // Generate cache key based on array reference bounds & target timeframe
  const firstTime = candles[0].time;
  const lastTime = candles[candles.length - 1].time;
  const cacheKey = `${candles.length}:${firstTime}:${lastTime}:${targetTimeframe}:${limitMaxCandles ?? 'all'}`;

  const cached = resampleCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const aggregated: Candle[] = [];
  let currentBucket: Candle | null = null;
  let bucketStartTime = 0;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const bTime = getBucketStart(c.time, targetTimeframe, anchorOffset);

    if (!currentBucket || bTime !== bucketStartTime) {
      if (currentBucket) {
        aggregated.push(currentBucket);
      }
      bucketStartTime = bTime;
      currentBucket = {
        time: bTime,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume ?? 0,
      };
    } else {
      if (c.high > currentBucket.high) currentBucket.high = c.high;
      if (c.low < currentBucket.low) currentBucket.low = c.low;
      currentBucket.close = c.close;
      if (c.volume !== undefined) {
        currentBucket.volume = (currentBucket.volume ?? 0) + c.volume;
      }
    }
  }

  if (currentBucket) {
    aggregated.push(currentBucket);
  }

  let result = aggregated;
  if (limitMaxCandles && result.length > limitMaxCandles) {
    result = result.slice(result.length - limitMaxCandles);
  }

  // Save to cache (limit memory growth to 10 cached timeframe entries max)
  if (resampleCache.size >= 10) {
    const firstKey = resampleCache.keys().next().value;
    if (firstKey) resampleCache.delete(firstKey);
  }
  resampleCache.set(cacheKey, result);

  return result;
}
