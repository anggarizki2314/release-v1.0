import type { Candle } from '@/types';
import type { UTCTimestamp } from 'lightweight-charts';

export interface LWCCandle {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  color?: string;
  borderColor?: string;
  wickColor?: string;
}

const TRANSPARENT = 'rgba(0,0,0,0)';

/**
 * ReplayRenderer — full-dataset renderer for Lightweight Charts.
 *
 * Core principle (FXReplay-style):
 *   TradingView ALWAYS receives the full candle array (e.g. 5000 candles).
 *   Visibility is controlled per-candle via transparent color for future candles.
 *   This eliminates the right-edge clamp bug where setVisibleLogicalRange
 *   was clamped to 1 candle because the series only contained 1001 entries.
 *
 * Usage:
 *   1. series.setData(renderer.buildFullDataset(allCandles, startIndex))
 *   2. On next/play: series.update(renderer.revealCandle(allCandles, newIndex))
 *   3. On prev:      series.update(renderer.hideCandle(allCandles, hiddenIndex))
 */
export class ReplayRenderer {
  /**
   * Build the full 5000-candle array for initial series.setData().
   * Candles at index <= currentReplayIndex are visible (normal color).
   * Candles at index >  currentReplayIndex are ghost (transparent).
   */
  buildFullDataset(
    allCandles: Candle[],
    currentReplayIndex: number
  ): LWCCandle[] {
    return allCandles.map((c, idx) => {
      if (idx <= currentReplayIndex) {
        return {
          time: c.time as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        };
      }
      // Ghost candle: use actual OHLC so TradingView price scale autoscale range is valid (>0),
      // but hide visually using transparent colors.
      return {
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        color: TRANSPARENT,
        borderColor: TRANSPARENT,
        wickColor: TRANSPARENT,
      };
    });
  }

  /**
   * Returns the candle to feed to series.update() when stepping FORWARD.
   * The newly-revealed candle gets its real OHLC; the candle becomes visible.
   */
  revealCandle(allCandles: Candle[], newIndex: number): LWCCandle | null {
    const c = allCandles[newIndex];
    if (!c) return null;
    return {
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    };
  }

  /**
   * Returns the candle to feed to series.update() when stepping BACKWARD.
   * The candle at hiddenIndex becomes ghost again.
   */
  hideCandle(allCandles: Candle[], hiddenIndex: number): LWCCandle | null {
    const c = allCandles[hiddenIndex];
    if (!c) return null;
    const prevClose = hiddenIndex > 0 && allCandles[hiddenIndex - 1] ? allCandles[hiddenIndex - 1].close : c.close;
    return {
      time: c.time as UTCTimestamp,
      open: prevClose,
      high: prevClose,
      low: prevClose,
      close: prevClose,
      color: TRANSPARENT,
      borderColor: TRANSPARENT,
      wickColor: TRANSPARENT,
    };
  }
}

export const replayRenderer = new ReplayRenderer();
