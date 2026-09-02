import { useMemo, useRef } from 'react';
import type { Candle, Timeframe } from '@/types';
import { WINDOW_SIZE, WINDOW_MARGIN } from '@/config/replayConfig';
import { getBucketStart, constructPartialCandle, PartialCandleCache } from '../chart/candleResolver';
import { REPLAY_DEBUG } from '@/config/debug';

/**
 * Hook untuk filter candles yang boleh ditampilkan ke chart berdasarkan replay state.
 *
 * FIX #3 — Sliding Window Buffer + Live Forming Candle Sync:
 * - Completed historical candles come from pre-generated/resampled TF candles up to activeBucketStart.
 * - Currently forming active candle at activeBucketStart is dynamically constructed from M1 source candles up to cutoffTime.
 * - Guarantees zero future OHLC leakage (prevents price jumping/shifting into future prices).
 * - Preserves O(1) series.update() incremental playback.
 */
export function useChartFilteredCandles(
  allCandles: Candle[],
  isReplayMode: boolean,
  cutoffTime: number | null,
  timeframe?: string | Timeframe,
  m1Candles?: Candle[]
): Candle[] {
  const windowStartRef = useRef<number>(0);
  const cachedCompletedSliceRef = useRef<{
    allCandles: Candle[];
    start: number;
    lastCompletedIdx: number;
    slice: Candle[];
  }>({
    allCandles: [],
    start: -1,
    lastCompletedIdx: -1,
    slice: [],
  });
  const partialCandleCacheRef = useRef<PartialCandleCache | undefined>(undefined);

  return useMemo(() => {
    if (!isReplayMode || cutoffTime === null) {
      windowStartRef.current = 0;
      return allCandles;
    }

    if (allCandles.length === 0) {
      windowStartRef.current = 0;
      return [];
    }

    const normTf = timeframe ? String(timeframe).trim().toUpperCase() : 'M1';
    const isHigherTf = normTf !== 'M1' && normTf !== '1M';
    const activeBucketStart = isHigherTf ? getBucketStart(cutoffTime, timeframe!) : cutoffTime;

    // Binary search for the last completed candle with time < activeBucketStart (or <= cutoffTime for M1)
    let lo = 0;
    let hi = allCandles.length - 1;
    let lastCompletedIdx = -1;

    const maxCompletedTime = isHigherTf ? activeBucketStart - 1 : cutoffTime;

    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (allCandles[mid].time <= maxCompletedTime) {
        lastCompletedIdx = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    // Construct forming candle from M1 if in higher timeframe
    let partialCandle: Candle | null = null;
    if (isHigherTf && m1Candles && m1Candles.length > 0) {
      if (!partialCandleCacheRef.current) {
        partialCandleCacheRef.current = {
          bucketStartUTC: -1,
          lastEndIdx: -1,
          high: 0,
          low: 0,
          volumeSum: 0
        };
      }
      partialCandle = constructPartialCandle(m1Candles, activeBucketStart, cutoffTime, partialCandleCacheRef.current);
    }

    // If higher TF but no partialCandle constructed, fallback to nearest candle in allCandles
    if (isHigherTf && !partialCandle) {
      let loFb = 0;
      let hiFb = allCandles.length - 1;
      let fbIdx = -1;
      while (loFb <= hiFb) {
        const mid = (loFb + hiFb) >> 1;
        if (allCandles[mid].time <= cutoffTime) {
          fbIdx = mid;
          loFb = mid + 1;
        } else {
          hiFb = mid - 1;
        }
      }
      lastCompletedIdx = fbIdx;
    }

    if (lastCompletedIdx < 0 && !partialCandle) {
      windowStartRef.current = 0;
      return [];
    }

    const totalBarsCount = (lastCompletedIdx >= 0 ? lastCompletedIdx + 1 : 0) + (partialCandle ? 1 : 0);

    // If total bars count is within WINDOW_SIZE (20,000 candles), NEVER prune the past — start is strictly 0!
    let start = 0;
    if (totalBarsCount > WINDOW_SIZE) {
      start = windowStartRef.current;
      const isOutOfBounds =
        start < 0 ||
        start > totalBarsCount - 1 ||
        (totalBarsCount - 1) - start > WINDOW_SIZE + WINDOW_MARGIN ||
        (totalBarsCount - 1) - start < 100;

      if (isOutOfBounds) {
        start = Math.max(0, totalBarsCount - 1 - WINDOW_SIZE);
        windowStartRef.current = start;
      }
    } else {
      windowStartRef.current = 0;
    }

    // Reuse cached completed slice if base dataset, start, and lastCompletedIdx have not changed
    let completedSlice: Candle[];
    const cache = cachedCompletedSliceRef.current;
    if (
      cache.allCandles === allCandles &&
      cache.start === start &&
      cache.lastCompletedIdx === lastCompletedIdx
    ) {
      completedSlice = cache.slice;
    } else {
      completedSlice = lastCompletedIdx >= 0 ? allCandles.slice(start, lastCompletedIdx + 1) : [];
      cachedCompletedSliceRef.current = {
        allCandles,
        start,
        lastCompletedIdx,
        slice: completedSlice,
      };
    }

    const result = partialCandle ? [...completedSlice, partialCandle] : completedSlice;

    if (REPLAY_DEBUG) {
      console.log('[CHART-FILTER-RESULT]', {
        timeframe,
        cutoffTime,
        cutoffISO: cutoffTime ? new Date(cutoffTime * 1000).toISOString() : null,
        allCandlesCount: allCandles.length,
        firstAllCandleISO: allCandles[0]?.time ? new Date(allCandles[0].time * 1000).toISOString() : null,
        lastAllCandleISO: allCandles[allCandles.length - 1]?.time ? new Date(allCandles[allCandles.length - 1].time * 1000).toISOString() : null,
        lastCompletedIdx,
        hasPartialCandle: !!partialCandle,
        partialCandleTimeISO: partialCandle ? new Date(partialCandle.time * 1000).toISOString() : null,
        resultCount: result.length,
        firstResultISO: result[0]?.time ? new Date(result[0].time * 1000).toISOString() : null,
        lastResultISO: result[result.length - 1]?.time ? new Date(result[result.length - 1].time * 1000).toISOString() : null,
      });
    }

    return result;
  }, [allCandles, isReplayMode, cutoffTime, timeframe, m1Candles]);
}

/**
 * Hook untuk get visible range time berdasarkan filtered candles.
 * Gunakan untuk auto-scroll/viewport positioning di chart.
 */
export function useVisibleTimeRange(
  filteredCandles: Candle[]
): { firstTime: number | null; lastTime: number | null } {
  return useMemo(() => {
    if (filteredCandles.length === 0) {
      return { firstTime: null, lastTime: null };
    }

    return {
      firstTime: filteredCandles[0].time,
      lastTime: filteredCandles[filteredCandles.length - 1].time,
    };
  }, [filteredCandles]);
}
