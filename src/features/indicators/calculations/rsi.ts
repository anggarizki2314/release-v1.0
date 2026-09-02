import type { Candle } from '@/types';
import type { RsiSource } from '../types';

export interface RsiPoint {
  time: number;
  value: number;
}

export function getCandleSourcePrice(candle: Candle, source: RsiSource = 'close'): number {
  switch (source) {
    case 'open':
      return candle.open;
    case 'high':
      return candle.high;
    case 'low':
      return candle.low;
    case 'hl2':
      return (candle.high + candle.low) / 2;
    case 'hlc3':
      return (candle.high + candle.low + candle.close) / 3;
    case 'ohlc4':
      return (candle.open + candle.high + candle.low + candle.close) / 4;
    case 'close':
    default:
      return candle.close;
  }
}

/**
 * Calculates Relative Strength Index (RSI) with Wilder's Smoothed Moving Average (RMA).
 * Complexity: O(N)
 *
 * Warm-up rule: Requires at least (period + 1) candles to generate the first RSI point at index `period`.
 * Range: Strictly mathematically bounded in [0, 100].
 */
export function calculateRsi(
  candles: Candle[],
  period: number = 14,
  source: RsiSource = 'close'
): RsiPoint[] {
  if (!candles || candles.length <= period || period < 1) return [];

  const changes: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const curr = getCandleSourcePrice(candles[i], source);
    const prev = getCandleSourcePrice(candles[i - 1], source);
    changes.push(curr - prev);
  }

  let avgGain = 0;
  let avgLoss = 0;

  // First SMA of gains and losses over the initial `period` changes
  for (let i = 0; i < period; i++) {
    const change = changes[i];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }

  avgGain /= period;
  avgLoss /= period;

  const result: RsiPoint[] = [];

  // Calculate initial RSI value at index `period`
  let initialRsi: number;
  if (avgGain + avgLoss === 0) {
    initialRsi = 50;
  } else if (avgLoss === 0) {
    initialRsi = 100;
  } else if (avgGain === 0) {
    initialRsi = 0;
  } else {
    const rs = avgGain / avgLoss;
    initialRsi = 100 - 100 / (1 + rs);
  }

  // Strictly clamp between 0 and 100
  initialRsi = Math.max(0, Math.min(100, initialRsi));
  result.push({ time: candles[period].time, value: Number(initialRsi.toFixed(2)) });

  // Wilder's smoothing (RMA) for subsequent candles
  for (let i = period; i < changes.length; i++) {
    const change = changes[i];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    let currentRsi: number;
    if (avgGain + avgLoss === 0) {
      currentRsi = 50;
    } else if (avgLoss === 0) {
      currentRsi = 100;
    } else if (avgGain === 0) {
      currentRsi = 0;
    } else {
      const currentRs = avgGain / avgLoss;
      currentRsi = 100 - 100 / (1 + currentRs);
    }

    currentRsi = Math.max(0, Math.min(100, currentRsi));
    result.push({ time: candles[i + 1].time, value: Number(currentRsi.toFixed(2)) });
  }

  return result;
}
