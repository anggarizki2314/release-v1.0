/**
 * Replay Engine V3 — ChartContext
 * Independent context owned by each chart pane.
 * Architecture Frozen v1.0
 */

import type { Candle, Timeframe } from '@/types';
import type { WindowDescriptor } from '../contracts/ReplayTypes';
import type { ReplayTimeChangedPayload } from '../contracts/ReplayEvents';
import type { CandleRepository } from '../data/CandleRepository';
import { WindowManager } from '../data/WindowManager';
import { ReplayIndexResolver } from './ReplayIndexResolver';

export type ChartUpdateListener = (data: {
  paneId: string;
  symbol: string;
  timeframe: Timeframe | string;
  absoluteIndex: number;
  windowDescriptor: WindowDescriptor;
  visibleCandles: Candle[];
}) => void;

export class ChartContext {
  private resolver: ReplayIndexResolver;
  private windowManager: WindowManager;
  private listeners = new Set<ChartUpdateListener>();
  private currentWindowDescriptor: WindowDescriptor | null = null;
  private _forensicTickCount = 0;
  private _lastLoggedIndex: number | null = null;
  private _lastCurrentTimeUTC: number | null = null;

  constructor(
    public readonly paneId: string,
    public readonly symbol: string,
    public readonly timeframe: Timeframe | string,
    private repository: CandleRepository
  ) {
    this.resolver = new ReplayIndexResolver(symbol, timeframe, repository);
    this.windowManager = new WindowManager();
  }

  public get absoluteIndex(): number {
    return this.resolver.absoluteIndex;
  }

  public subscribe(listener: ChartUpdateListener): () => void {
    this.listeners.add(listener);

    // Subscription Catch-Up: If session/window is active, immediately push visible state to new subscriber
    if (this.currentWindowDescriptor && this._lastCurrentTimeUTC !== null) {
      try {
        const absoluteIndex = this.resolver.absoluteIndex;
        const windowDescriptor = this.currentWindowDescriptor;
        const currentTimeUTC = this._lastCurrentTimeUTC;
        const rawCandles = this.repository.getCandlesSlice(
          this.symbol,
          this.timeframe,
          windowDescriptor.startIndex,
          absoluteIndex
        );
        const visibleCandles = rawCandles.filter((c) => c.time <= currentTimeUTC);

        listener({
          paneId: this.paneId,
          symbol: this.symbol,
          timeframe: this.timeframe,
          absoluteIndex,
          windowDescriptor,
          visibleCandles,
        });
      } catch (err) {
        console.error(`[ChartContext ${this.paneId}] Error in initial subscribe catch-up:`, err);
      }
    }

    return () => this.listeners.delete(listener);
  }

  /**
   * Called by ChartSynchronizer on ReplayTimeChanged event.
   */
  public onReplayTimeChanged(payload: ReplayTimeChangedPayload): void {
    const { currentTimeUTC, playbackDirection, reason } = payload;
    this._lastCurrentTimeUTC = currentTimeUTC;

    const newAbsoluteIndex =
      reason === 'jump' || reason === 'session_start'
        ? this.resolver.reanchorByTime(currentTimeUTC, 'PREVIOUS')
        : this.resolver.resolveIndexForTime(currentTimeUTC);

    const totalLen = this.repository.getDatasetLength(this.symbol, this.timeframe);
    const windowDescriptor = this.windowManager.generateWindowDescriptor(
      newAbsoluteIndex,
      totalLen,
      playbackDirection
    );

    this.currentWindowDescriptor = windowDescriptor;

    // Slice up to newAbsoluteIndex INCLUSIVE, then strictly enforce candle.time <= currentTimeUTC
    const rawCandles = this.repository.getCandlesSlice(
      this.symbol,
      this.timeframe,
      windowDescriptor.startIndex,
      newAbsoluteIndex
    );
    const visibleCandles = rawCandles.filter((c) => c.time <= currentTimeUTC);

    // Forensic logging
    if (reason === 'session_start') {
      console.log('[REPLAY VISIBILITY SESSION]', {
        startTimeUTC: currentTimeUTC,
        allCandlesCount: totalLen,
        initialReplayIndex: newAbsoluteIndex,
        initialVisibleCandlesCount: visibleCandles.length,
        firstVisibleTime: visibleCandles[0]?.time,
        lastVisibleTime: visibleCandles[visibleCandles.length - 1]?.time,
      });
      console.log('[REPLAY VISIBILITY 1]', {
        replayTimeUTC: currentTimeUTC,
        allCandlesCount: totalLen,
        visibleCandlesCount: visibleCandles.length,
        replayIndex: newAbsoluteIndex,
        firstVisibleTime: visibleCandles[0]?.time,
        lastVisibleTime: visibleCandles[visibleCandles.length - 1]?.time,
      });
    } else if (this._lastLoggedIndex !== newAbsoluteIndex) {
      this._lastLoggedIndex = newAbsoluteIndex;
      console.log('[REPLAY VISIBILITY TICK]', {
        replayTimeUTC: currentTimeUTC,
        replayIndex: newAbsoluteIndex,
        visibleCandlesCount: visibleCandles.length,
        lastVisibleTime: visibleCandles[visibleCandles.length - 1]?.time,
      });
    }

    this._forensicTickCount++;

    for (const listener of this.listeners) {
      try {
        listener({
          paneId: this.paneId,
          symbol: this.symbol,
          timeframe: this.timeframe,
          absoluteIndex: newAbsoluteIndex,
          windowDescriptor,
          visibleCandles,
        });
      } catch (err) {
        console.error(`[ChartContext ${this.paneId}] Error in chart update listener:`, err);
      }
    }
  }
}
