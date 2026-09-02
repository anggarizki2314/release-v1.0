/**
 * Replay Engine V3 — Binary Search Strategy Implementation
 * Architecture Frozen v1.0
 */

import type { Candle } from '@/types';
import type { ReplayTimestampUTC, ReplayStartMode } from '../contracts/ReplayTypes';
import type { ISearchStrategy, StartModeResolutionResult } from '../contracts/ISearchStrategy';

export class BinarySearchStrategy implements ISearchStrategy {
  /**
   * Performs O(log N) binary search with explicit start mode resolution.
   */
  public findCandleIndex(
    candles: Candle[],
    targetTimeUTC: ReplayTimestampUTC,
    mode: ReplayStartMode = 'PREVIOUS'
  ): StartModeResolutionResult | null {
    if (!Array.isArray(candles) || candles.length === 0) {
      return null;
    }

    let left = 0;
    let right = candles.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const midTime = candles[mid].time;

      if (midTime === targetTimeUTC) {
        return { candle: candles[mid], index: mid };
      }

      if (midTime < targetTimeUTC) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    // Exact mode fails if no exact match was found
    if (mode === 'EXACT') {
      return null;
    }

    // PREVIOUS: Return latest candle with time <= targetTimeUTC
    if (mode === 'PREVIOUS') {
      const idx = right;
      return idx >= 0 && idx < candles.length ? { candle: candles[idx], index: idx } : null;
    }

    // NEXT: Return earliest candle with time >= targetTimeUTC
    if (mode === 'NEXT') {
      const idx = left;
      return idx >= 0 && idx < candles.length ? { candle: candles[idx], index: idx } : null;
    }

    // NEAREST: Select candle with minimal distance.
    // Tie-break rule: If distance is equal, PREVIOUS (right) is selected deterministically.
    if (mode === 'NEAREST') {
      if (right < 0) return { candle: candles[left], index: left };
      if (left >= candles.length) return { candle: candles[right], index: right };

      const distPrev = Math.abs(candles[right].time - targetTimeUTC);
      const distNext = Math.abs(candles[left].time - targetTimeUTC);

      if (distPrev <= distNext) {
        return { candle: candles[right], index: right };
      } else {
        return { candle: candles[left], index: left };
      }
    }

    return null;
  }
}
