import type { Candle } from '@/types';
import type { RsiPoint } from './rsi';

export interface RsiDivergenceLine {
  type: 'regular_bullish' | 'regular_bearish' | 'hidden_bullish' | 'hidden_bearish';
  time1: number;
  rsi1: number;
  price1: number;
  time2: number;
  rsi2: number;
  price2: number;
  label: string;
  color: string;
}

/**
 * Calculates Regular & Hidden RSI Divergences:
 * - Regular Bullish: Price Lower Low, RSI Higher Low (Reversal Long)
 * - Regular Bearish: Price Higher High, RSI Lower High (Reversal Short)
 * - Hidden Bullish: Price Higher Low, RSI Lower Low (Trend Continuation Long)
 * - Hidden Bearish: Price Lower High, RSI Higher High (Trend Continuation Short)
 */
export function calculateRsiDivergences(
  candles: Candle[],
  rsiPoints: RsiPoint[],
  lookback: number = 5
): RsiDivergenceLine[] {
  if (!candles || !rsiPoints || rsiPoints.length < lookback * 3) return [];

  // Map candles by time for O(1) lookup
  const candleMap = new Map<number, Candle>();
  for (const c of candles) {
    candleMap.set(c.time, c);
  }

  // Find pivot highs and pivot lows in RSI
  interface Pivot {
    index: number;
    time: number;
    rsi: number;
    priceHigh: number;
    priceLow: number;
  }

  const pivotHighs: Pivot[] = [];
  const pivotLows: Pivot[] = [];

  for (let i = lookback; i < rsiPoints.length - lookback; i++) {
    const curr = rsiPoints[i];
    const c = candleMap.get(curr.time);
    if (!c) continue;

    let isHigh = true;
    let isLow = true;

    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (rsiPoints[j].value >= curr.value) isHigh = false;
      if (rsiPoints[j].value <= curr.value) isLow = false;
    }

    if (isHigh) {
      pivotHighs.push({
        index: i,
        time: curr.time,
        rsi: curr.value,
        priceHigh: c.high,
        priceLow: c.low,
      });
    }

    if (isLow) {
      pivotLows.push({
        index: i,
        time: curr.time,
        rsi: curr.value,
        priceHigh: c.high,
        priceLow: c.low,
      });
    }
  }

  const divergences: RsiDivergenceLine[] = [];

  // 1. Check Bearish Divergences between adjacent Pivot Highs
  for (let i = 1; i < pivotHighs.length; i++) {
    const p1 = pivotHighs[i - 1];
    const p2 = pivotHighs[i];

    const dist = p2.index - p1.index;
    if (dist < 4 || dist > 40) continue;

    // Regular Bearish: Price makes Higher High, RSI makes Lower High
    if (p2.priceHigh > p1.priceHigh && p2.rsi < p1.rsi) {
      divergences.push({
        type: 'regular_bearish',
        time1: p1.time,
        rsi1: p1.rsi,
        price1: p1.priceHigh,
        time2: p2.time,
        rsi2: p2.rsi,
        price2: p2.priceHigh,
        label: 'Bear Div',
        color: '#ef4444',
      });
    }
    // Hidden Bearish: Price makes Lower High, RSI makes Higher High
    else if (p2.priceHigh < p1.priceHigh && p2.rsi > p1.rsi) {
      divergences.push({
        type: 'hidden_bearish',
        time1: p1.time,
        rsi1: p1.rsi,
        price1: p1.priceHigh,
        time2: p2.time,
        rsi2: p2.rsi,
        price2: p2.priceHigh,
        label: 'H-Bear Div',
        color: '#f97316',
      });
    }
  }

  // 2. Check Bullish Divergences between adjacent Pivot Lows
  for (let i = 1; i < pivotLows.length; i++) {
    const p1 = pivotLows[i - 1];
    const p2 = pivotLows[i];

    const dist = p2.index - p1.index;
    if (dist < 4 || dist > 40) continue;

    // Regular Bullish: Price makes Lower Low, RSI makes Higher Low
    if (p2.priceLow < p1.priceLow && p2.rsi > p1.rsi) {
      divergences.push({
        type: 'regular_bullish',
        time1: p1.time,
        rsi1: p1.rsi,
        price1: p1.priceLow,
        time2: p2.time,
        rsi2: p2.rsi,
        price2: p2.priceLow,
        label: 'Bull Div',
        color: '#22c55e',
      });
    }
    // Hidden Bullish: Price makes Higher Low, RSI makes Lower Low
    else if (p2.priceLow > p1.priceLow && p2.rsi < p1.rsi) {
      divergences.push({
        type: 'hidden_bullish',
        time1: p1.time,
        rsi1: p1.rsi,
        price1: p1.priceLow,
        time2: p2.time,
        rsi2: p2.rsi,
        price2: p2.priceLow,
        label: 'H-Bull Div',
        color: '#06b6d4',
      });
    }
  }

  return divergences;
}
