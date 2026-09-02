/**
 * Replay Engine V3 — ReplayIndexResolver
 * Multi-candle while loop advance (O(1) amortized tick complexity).
 * Encapsulated per ChartContext.
 * Architecture Frozen v1.0
 */

import type { Candle, Timeframe } from '@/types';
import type { ReplayTimestampUTC, ReplayStartMode } from '../contracts/ReplayTypes';
import type { CandleRepository } from '../data/CandleRepository';

export class ReplayIndexResolver {
  private currentAbsoluteIndex: number = 0;

  constructor(
    private symbol: string,
    private timeframe: Timeframe | string,
    private repository: CandleRepository
  ) {}

  public get absoluteIndex(): number {
    return this.currentAbsoluteIndex;
  }

  public setAbsoluteIndex(index: number): void {
    const maxLen = this.repository.getDatasetLength(this.symbol, this.timeframe);
    if (maxLen > 0) {
      this.currentAbsoluteIndex = Math.max(0, Math.min(index, maxLen - 1));
    } else {
      this.currentAbsoluteIndex = 0;
    }
  }

  /**
   * Re-anchors index using Binary Search via Repository (used on Create Session, Jump Date, or Re-sync).
   */
  public reanchorByTime(
    targetTimeUTC: ReplayTimestampUTC,
    mode: ReplayStartMode = 'PREVIOUS'
  ): number {
    const match = this.repository.findCandleIndexByTime(
      this.symbol,
      this.timeframe as Timeframe,
      targetTimeUTC,
      mode
    );
    if (match) {
      this.currentAbsoluteIndex = match.index;
    } else {
      this.currentAbsoluteIndex = 0;
    }
    return this.currentAbsoluteIndex;
  }

  /**
   * Fast incremental resolution for playback ticks (O(1) amortized complexity).
   * Uses a while loop to advance past multiple candles if playback speed is high.
   */
  public resolveIndexForTime(currentTimeUTC: ReplayTimestampUTC): number {
    const totalLength = this.repository.getDatasetLength(this.symbol, this.timeframe);
    if (totalLength === 0) return 0;

    // Check if backwards jump occurred
    const currentCandle = this.repository.getCandleAt(this.symbol, this.timeframe, this.currentAbsoluteIndex);
    if (currentCandle && currentTimeUTC < currentCandle.time) {
      return this.reanchorByTime(currentTimeUTC, 'PREVIOUS');
    }

    // Forward multi-candle while loop advance
    while (this.currentAbsoluteIndex + 1 < totalLength) {
      const nextCandle = this.repository.getCandleAt(this.symbol, this.timeframe, this.currentAbsoluteIndex + 1);
      if (!nextCandle || currentTimeUTC < nextCandle.time) {
        break; // Reached tick frontier
      }
      this.currentAbsoluteIndex++;
    }

    return this.currentAbsoluteIndex;
  }
}
