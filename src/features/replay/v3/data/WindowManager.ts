/**
 * Replay Engine V3 — WindowManager
 * Generates WindowDescriptor metadata (zero candle arrays held).
 * Architecture Frozen v1.0
 */

import type { WindowDescriptor, PlaybackDirection } from '../contracts/ReplayTypes';

export interface WindowManagerConfig {
  readonly defaultWindowSize?: number; // Default 5000 candles
  readonly preloadMargin?: number;      // Default 1000 candles
}

export class WindowManager {
  private windowSize: number;
  private preloadMargin: number;

  constructor(config?: WindowManagerConfig) {
    this.windowSize = config?.defaultWindowSize ?? 5000;
    this.preloadMargin = config?.preloadMargin ?? 1000;
  }

  /**
   * Generates a WindowDescriptor for a given current absolute index and dataset length.
   */
  public generateWindowDescriptor(
    currentAbsoluteIndex: number,
    totalDatasetLength: number,
    direction: PlaybackDirection = 'forward'
  ): WindowDescriptor {
    if (totalDatasetLength <= 0) {
      return {
        version: 1,
        startIndex: 0,
        endIndex: 0,
        preloadBefore: 0,
        preloadAfter: 0,
        shouldLoadMore: false,
        direction,
      };
    }

    const safeIndex = Math.max(0, Math.min(currentAbsoluteIndex, totalDatasetLength - 1));

    // Allocate window buffer: historical buffer before safeIndex, endIndex capped at safeIndex
    const historicalBuffer = Math.floor(this.windowSize * 0.8);
    const futureBuffer = this.windowSize - historicalBuffer;

    const startIndex = Math.max(0, safeIndex - historicalBuffer);
    const endIndex = safeIndex;

    const preloadBefore = Math.max(0, startIndex - this.preloadMargin);
    const preloadAfter = Math.min(totalDatasetLength - 1, safeIndex + futureBuffer);

    const shouldLoadMore =
      direction === 'forward'
        ? safeIndex >= endIndex - this.preloadMargin
        : safeIndex <= startIndex + this.preloadMargin;

    return {
      version: 1,
      startIndex,
      endIndex,
      preloadBefore,
      preloadAfter,
      shouldLoadMore,
      direction,
    };
  }
}
