import type { Candle } from '@/types';

/**
 * Timeline utility functions for replay position calculation.
 *
 * All calculations are timestamp-based (unix seconds), not index-based.
 * The timeline represents the replay range from start to end time,
 * and the current position is calculated as a percentage of that range.
 */

/**
 * Calculate progress as a fraction (0–1) from timestamps.
 *
 * progress = (currentTime - startTime) / (endTime - startTime)
 *
 * Returns 0 if at or before start, 1 if at or after end.
 * Returns 0 if the range is degenerate (endTime <= startTime).
 */
export function calculateTimelineProgress(
  startTime: number | null,
  currentTime: number | null,
  endTime: number | null
): number {
  if (startTime === null || currentTime === null || endTime === null) return 0;
  if (endTime <= startTime) return 0;
  const progress = (currentTime - startTime) / (endTime - startTime);
  return Math.max(0, Math.min(1, progress));
}

/**
 * Convert a progress fraction (0–1) back to a unix timestamp.
 */
export function timestampFromProgress(
  startTime: number,
  progress: number,
  endTime: number
): number {
  const clamped = Math.max(0, Math.min(1, progress));
  return startTime + clamped * (endTime - startTime);
}

/**
 * Find the nearest valid candle to a target timestamp.
 * Uses binary search for O(log n) performance.
 *
 * Returns the Candle object, or null if the array is empty.
 */
export function findNearestCandle(
  allCandles: Candle[],
  targetTime: number
): Candle | null {
  if (allCandles.length === 0) return null;

  if (targetTime <= allCandles[0].time) return allCandles[0];
  if (targetTime >= allCandles[allCandles.length - 1].time) {
    return allCandles[allCandles.length - 1];
  }

  let left = 0;
  let right = allCandles.length - 1;

  while (left < right) {
    const mid = (left + right) >> 1;
    if (allCandles[mid].time === targetTime) return allCandles[mid];
    if (allCandles[mid].time < targetTime) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }

  // left === right; compare with predecessor to find nearest
  if (left > 0) {
    const prev = allCandles[left - 1];
    const curr = allCandles[left];
    return Math.abs(prev.time - targetTime) <= Math.abs(curr.time - targetTime)
      ? prev
      : curr;
  }

  return allCandles[left];
}

/**
 * Convert a percentage (0–100) on the timeline to the nearest valid
 * candle timestamp within the replay range [startTime, endTime].
 *
 * allCandles must be sorted by time ASC.
 * Only candles within the replay range are considered.
 */
export function candleFromTimelinePercent(
  allCandles: Candle[],
  percent: number,
  startTime: number,
  endTime: number
): Candle | null {
  if (allCandles.length === 0 || endTime <= startTime) return null;

  const targetTime = timestampFromProgress(startTime, percent / 100, endTime);
  return findNearestCandle(allCandles, targetTime);
}

/**
 * Validate that a replay session has the minimum required fields
 * for the timeline to render.
 */
export function isTimelineValid(
  startTime: number | null,
  currentTime: number | null,
  endTime: number | null
): boolean {
  return (
    startTime !== null &&
    currentTime !== null &&
    endTime !== null &&
    endTime >= startTime
  );
}
