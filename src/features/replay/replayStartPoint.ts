import type { Candle } from '@/types';

/**
 * Utility untuk menentukan replay start point dari dataset.
 *
 * Hari ke-7 fokus pada:
 * 1. Full dataset (semua candles dari DB)
 * 2. Replay start point (index mana yang menjadi mulai replay)
 * 3. Historical context (candles sebelum start point)
 * 4. Future replay data (candles setelah start point)
 */

export interface ReplayStartPointOptions {
  /**
   * Strategy untuk menentukan start point.
   * - 'first': mulai dari candle pertama (index 0)
   * - 'last': mulai dari candle terakhir
   * - 'midpoint': mulai dari tengah dataset (untuk testing)
   * - 'timestamp': mulai dari candle paling dekat dengan timestamp tertentu
   */
  strategy: 'first' | 'last' | 'midpoint' | 'timestamp';
  /**
   * Jika strategy='timestamp', gunakan timestamp ini (unix seconds).
   */
  targetTimestamp?: number;
}

/**
 * Tentukan index replay start point dalam array candles.
 * allCandles harus sudah sorted by time ASC.
 *
 * @returns index dalam array (0-based)
 */
export function findReplayStartPointIndex(
  allCandles: Candle[],
  options: ReplayStartPointOptions
): number {
  if (allCandles.length === 0) {
    throw new Error('Cannot find start point in empty candles array');
  }

  switch (options.strategy) {
    case 'first':
      return 0;

    case 'last':
      return allCandles.length - 1;

    case 'midpoint':
      return Math.floor(allCandles.length / 2);

    case 'timestamp': {
      if (options.targetTimestamp === undefined) {
        throw new Error('timestamp strategy requires targetTimestamp');
      }
      return findNearestCandleIndex(allCandles, options.targetTimestamp);
    }

    default:
      throw new Error(`Unknown strategy: ${(options as any).strategy}`);
  }
}

/**
 * Find index of candle paling dekat dengan target timestamp.
 * Menggunakan binary search untuk efficiency.
 *
 * @param allCandles array candles sorted by time ASC
 * @param targetTime unix seconds
 * @returns index of nearest candle
 */
export function findNearestCandleIndex(allCandles: Candle[], targetTime: number): number {
  return findContainingCandleIndex(allCandles, targetTime);
}

/**
 * Finds the index of the candle containing targetTime (openTime <= targetTime < closeTime).
 * Uses binary search and guarantees it never returns a future candle (openTime > targetTime).
 */
export function findContainingCandleIndex(
  allCandles: Candle[],
  targetTime: number
): number {
  if (allCandles.length === 0) {
    throw new Error('Cannot find candle in empty array');
  }

  if (targetTime <= allCandles[0].time) {
    return 0;
  }

  if (targetTime >= allCandles[allCandles.length - 1].time) {
    return allCandles.length - 1;
  }

  let left = 0;
  let right = allCandles.length - 1;

  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (allCandles[mid].time === targetTime) {
      return mid;
    } else if (allCandles[mid].time < targetTime) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }

  // Ensure selected candle openTime <= targetTime (never select future openTime)
  if (left > 0 && allCandles[left].time > targetTime) {
    return left - 1;
  }

  return left;
}

/**
 * Find index of the first valid candle whose time is >= targetTime (on or after).
 * Never returns a candle strictly before targetTime unless targetTime is after all candles.
 * Used to resolve replay start date (e.g. weekend dates -> next Monday) without shifting backward into buffer.
 */
export function findFirstCandleIndexOnOrAfter(allCandles: Candle[], targetTime: number): number {
  if (allCandles.length === 0) {
    throw new Error('Cannot find candle in empty array');
  }

  if (targetTime <= allCandles[0].time) {
    return 0;
  }

  if (targetTime >= allCandles[allCandles.length - 1].time) {
    return allCandles.length - 1;
  }

  let left = 0;
  let right = allCandles.length - 1;

  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (allCandles[mid].time < targetTime) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }

  return left;
}


/**
 * Pisahkan dataset menjadi historical dan future berdasarkan start index.
 *
 * Historical = candles dari index 0 sampai startIndex (inclusive)
 * Future = candles dari startIndex + 1 sampai akhir
 */
export interface SeparatedDataset {
  historicalContext: Candle[];
  visibleStartCandle: Candle;
  futureReplayData: Candle[];
  totalCandles: number;
  startIndex: number;
}

export function separateDataset(allCandles: Candle[], startIndex: number): SeparatedDataset {
  if (startIndex < 0 || startIndex >= allCandles.length) {
    throw new Error(`Invalid start index ${startIndex} for array of length ${allCandles.length}`);
  }

  return {
    historicalContext: allCandles.slice(0, startIndex),
    visibleStartCandle: allCandles[startIndex],
    futureReplayData: allCandles.slice(startIndex + 1),
    totalCandles: allCandles.length,
    startIndex,
  };
}

/**
 * Get time range dari dataset.
 */
export interface DatasetTimeRange {
  firstTime: number;
  lastTime: number;
  durationSeconds: number;
}

export function getDatasetTimeRange(allCandles: Candle[]): DatasetTimeRange {
  if (allCandles.length === 0) {
    throw new Error('Cannot get time range from empty candles');
  }

  const firstTime = allCandles[0].time;
  const lastTime = allCandles[allCandles.length - 1].time;

  return {
    firstTime,
    lastTime,
    durationSeconds: lastTime - firstTime,
  };
}
