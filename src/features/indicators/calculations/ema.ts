import type { Candle } from '@/types';

export interface EmaPoint {
  time: number;
  value: number;
}

/**
 * Calculates Exponential Moving Average (EMA) for a series of candles.
 * Complexity: O(N)
 */
export function calculateEma(
  candles: Candle[],
  period: number,
  source: 'close' | 'open' | 'high' | 'low' = 'close'
): EmaPoint[] {
  if (!candles || candles.length < period) return [];

  const multiplier = 2 / (period + 1);
  const result: EmaPoint[] = [];

  // Initial SMA as baseline seed
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += candles[i][source];
  }
  let prevEma = sum / period;
  result.push({ time: candles[period - 1].time, value: Number(prevEma.toFixed(5)) });

  // Calculate subsequent EMA values
  for (let i = period; i < candles.length; i++) {
    const val = candles[i][source];
    const currentEma = (val - prevEma) * multiplier + prevEma;
    result.push({ time: candles[i].time, value: Number(currentEma.toFixed(5)) });
    prevEma = currentEma;
  }

  return result;
}
