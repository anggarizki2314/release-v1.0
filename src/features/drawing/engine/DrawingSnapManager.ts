/**
 * Drawing Engine — DrawingSnapManager
 *
 * Snaps drawing points to OHLC, grid, and candle center.
 */

import type { SnapResult } from './types';

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

const SNAP_THRESHOLD = 5; // pixels

export class DrawingSnapManager {
  private enabled = false;
  private threshold = SNAP_THRESHOLD;
  private candles: CandleData[] = [];
  private snapTypes = new Set(['ohlc']);

  setEnabled(v: boolean) { this.enabled = v; }
  isEnabled(): boolean { return this.enabled; }
  setThreshold(t: number) { this.threshold = t; }
  getThreshold(): number { return this.threshold; }
  setCandles(c: CandleData[]) { this.candles = c; }
  getCandles(): CandleData[] { return this.candles; }
  enableSnapType(type: string) { this.snapTypes.add(type); }
  disableSnapType(type: string) { this.snapTypes.delete(type); }

  snap(
    time: number,
    price: number,
    xToTime?: (x: number) => number,
    yToPrice?: (y: number) => number,
    timeToX?: (t: number) => number,
    priceToY?: (p: number) => number
  ): SnapResult {
    if (!this.enabled || this.candles.length === 0) return { time, price, snapped: false };

    // Find nearest candle by time
    let nearest: CandleData | null = null;
    let minDist = Infinity;
    for (const c of this.candles) {
      const dist = Math.abs(c.time - time);
      if (dist < minDist) { minDist = dist; nearest = c; }
    }

    if (nearest && this.snapTypes.has('ohlc')) {
      // Wick-only snap targets: HIGH (top wick) & LOW (bottom wick)
      const snapPrices = [nearest.high, nearest.low];
      let bestPrice = price;
      let bestDist = Infinity;

      for (const sp of snapPrices) {
        let d: number;
        if (priceToY && timeToX) {
          const candleX = timeToX(nearest.time);
          const cursorX = timeToX(time);
          const snapY = priceToY(sp);
          const cursorY = priceToY(price);
          d = Math.hypot(candleX - cursorX, snapY - cursorY);
        } else {
          d = Math.abs(sp - price);
        }

        if (d < bestDist) {
          bestDist = d;
          bestPrice = sp;
        }
      }

      // Check pixel threshold if screen converters provided, or price distance threshold
      const thresholdLimit = (priceToY && timeToX) ? Math.max(this.threshold, 25) : (this.threshold * 0.01);
      if (bestDist <= thresholdLimit) {
        return { time: nearest.time, price: bestPrice, snapped: true, snapType: 'ohlc' };
      }
    }

    return { time, price, snapped: false };
  }
}
