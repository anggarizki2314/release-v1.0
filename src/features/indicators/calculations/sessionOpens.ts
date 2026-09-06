import type { Candle, Timeframe } from '@/types';
import type { OpenLevelConfig } from '../types';
import { getBucketEnd } from '../../chart/candleResolver';

export interface OpenLineSegment {
  id: string;
  name: string;
  price: number;
  startTime: number;
  endTime: number;
  color: string;
  opacity: number;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  lineWidth: number;
}

/**
 * Binary search to find the index of the first candle whose interval CONTAINS or is AFTER the timestamp.
 */
function findFirstCandleContainingOrAfter(candles: Candle[], timestamp: number, timeframe: string | Timeframe): number {
  let low = 0;
  let high = candles.length - 1;
  let result = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const candleEnd = getBucketEnd(candles[mid].time, timeframe);
    if (candleEnd > timestamp) {
      result = mid;
      high = mid - 1; // Look left to see if an earlier candle also satisfies this (shouldn't happen with non-overlapping candles, but standard binary search pattern)
    } else {
      low = mid + 1;
    }
  }
  return result;
}

/**
 * Calculates opening price horizontal lines (Daily Open, London Open, NY Open) across visible days.
 */
export function calculateSessionOpens(
  candles: Candle[],
  opensConfig: OpenLevelConfig[],
  timeframe: string | Timeframe,
  fromTime?: number | null,
  toTime?: number | null
): OpenLineSegment[] {
  if (!candles || candles.length === 0 || !opensConfig || opensConfig.length === 0) {
    return [];
  }

  // Session Opens (London, NY, Midnight, Daily) are intraday benchmark levels.
  // Skip on 4H, Daily, Weekly, and Monthly timeframes.
  const tfUpper = String(timeframe).toUpperCase();
  if (['4H', 'H4', 'D', '1D', 'D1', 'W', '1W', 'W1', 'M', '1M', 'MN', '12M', 'Y'].includes(tfUpper)) {
    return [];
  }

  const enabledConfigs = opensConfig.filter((o) => o.enabled);
  if (enabledConfigs.length === 0) return [];

  const datasetFirst = candles[0].time;
  const datasetLast = candles[candles.length - 1].time;

  // TradingView Lookback standard:
  // Session Opens are benchmark levels for the active day and recent sessions (max 3 days lookback).
  // Calculate relative to the latest visible/replay candle (toTime ?? datasetLast).
  const referenceEnd = toTime ?? datasetLast;
  const maxLookbackDays = 3;
  const earliestAllowed = Math.max(datasetFirst, referenceEnd - 86400 * maxLookbackDays);

  const firstTime = Math.max(earliestAllowed, (fromTime ?? earliestAllowed));
  const lastTime = Math.min(datasetLast, referenceEnd);

  const startDate = new Date(firstTime * 1000);
  startDate.setUTCHours(0, 0, 0, 0);

  const endDate = new Date(lastTime * 1000);
  endDate.setUTCHours(23, 59, 59, 999);

  const lines: OpenLineSegment[] = [];

  const currentDay = new Date(startDate);
  while (currentDay <= endDate) {
    const y = currentDay.getUTCFullYear();
    const m = currentDay.getUTCMonth();
    const d = currentDay.getUTCDate();

    // Next day 00:00 UTC boundary
    const nextDayStartUtc = Math.floor(Date.UTC(y, m, d + 1, 0, 0, 0) / 1000);

    for (const conf of enabledConfigs) {
      const [hStr, mStr] = conf.timeUtc.split(':');
      const hour = Number(hStr) || 0;
      const minute = Number(mStr) || 0;

      const targetTimeUtc = Math.floor(Date.UTC(y, m, d, hour, minute, 0) / 1000);
      const cycleEndUtc = targetTimeUtc + 86400;

      // Find the first candle whose interval contains or is immediately after targetTimeUtc on this day
      const cIdx = findFirstCandleContainingOrAfter(candles, targetTimeUtc, timeframe);
      if (cIdx === -1) continue;

      const candle = candles[cIdx];
      // Verify the candle belongs to the cycle.
      // It belongs to the cycle if its interval ends after the target time, AND its start time is before the cycle ends.
      const candleEnd = getBucketEnd(candle.time, timeframe);
      if (candleEnd <= targetTimeUtc || candle.time >= cycleEndUtc) {
        continue;
      }

      // If this session has not started yet relative to current replay / data time, do not draw it yet
      if (candle.time > referenceEnd) {
        continue;
      }

      const openPrice = candle.open;
      const startTime = candle.time;

      // Determine session boundary:
      // - Daily Open: ends at the start of next daily open (targetTimeUtc + 86400).
      // - Intraday Opens (London 07:00, NY 12:00, Midnight 04:00):
      //   Borders stay strictly within that trading day cycle, ending at the next day boundary.
      const isDaily = conf.id.includes('daily') || conf.name.toLowerCase().includes('daily');
      const sessionBoundaryEnd = isDaily ? cycleEndUtc : Math.min(cycleEndUtc, nextDayStartUtc);

      // Replay / Current data clamping:
      // Line extends only up to the current candle (referenceEnd) and NEVER penetrates into future unseen candles!
      const endCandleEnd = getBucketEnd(referenceEnd, timeframe);
      const endTime = Math.min(sessionBoundaryEnd, Math.max(candleEnd, endCandleEnd));

      if (endTime > startTime) {
        lines.push({
          id: `${conf.id}-${startTime}`,
          name: conf.name,
          price: openPrice,
          startTime,
          endTime,
          color: conf.color,
          opacity: conf.opacity !== undefined ? conf.opacity : 0.9,
          lineStyle: conf.lineStyle || 'solid',
          lineWidth: conf.lineWidth || 1.5,
        });
      }
    }

    currentDay.setUTCDate(currentDay.getUTCDate() + 1);
  }

  return lines;
}
