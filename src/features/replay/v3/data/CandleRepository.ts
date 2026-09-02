/**
 * Replay Engine V3 — CandleRepository Data Gateway
 * Storage ➔ Validation Layer ➔ CandleRepository ➔ Replay Engine
 * Architecture Frozen v1.0
 */

import type { Candle, Timeframe } from '@/types';
import type { ReplayTimestampUTC, ReplayStartMode, ReplayCacheKey } from '../contracts/ReplayTypes';
import type { ISearchStrategy, StartModeResolutionResult } from '../contracts/ISearchStrategy';
import { CandleValidationLayer } from './CandleValidationLayer';
import { BinarySearchStrategy } from './BinarySearchStrategy';
import { TwoLevelReplayCache } from './TwoLevelReplayCache';

export class CandleRepository {
  private datasets = new Map<string, Candle[]>();
  private cache = new TwoLevelReplayCache();
  private searchStrategy: ISearchStrategy;

  constructor(searchStrategy?: ISearchStrategy) {
    this.searchStrategy = searchStrategy ?? new BinarySearchStrategy();
  }

  public setSearchStrategy(strategy: ISearchStrategy): void {
    this.searchStrategy = strategy;
  }

  private getDatasetKey(symbol: string, timeframe: Timeframe | string): string {
    return `${symbol.toUpperCase()}:${timeframe}`;
  }

  /**
   * Loads and validates raw candles for a symbol + timeframe dataset.
   */
  public loadDataset(
    symbol: string,
    timeframe: Timeframe | string,
    rawCandles: Candle[]
  ): number {
    const { sanitizedCandles } = CandleValidationLayer.validateAndSanitize(rawCandles);
    const key = this.getDatasetKey(symbol, timeframe);
    this.datasets.set(key, sanitizedCandles);
    return sanitizedCandles.length;
  }

  /**
   * Finds candle index by timestamp using search strategy & Two-Level Composite Cache.
   */
  public findCandleIndexByTime(
    symbol: string,
    timeframe: Timeframe,
    targetTimeUTC: ReplayTimestampUTC,
    mode: ReplayStartMode = 'PREVIOUS'
  ): StartModeResolutionResult | null {
    const cacheKey: ReplayCacheKey = { symbol, timeframe, timestampUTC: targetTimeUTC };
    const cachedIdx = this.cache.getAbsoluteIndex(cacheKey);
    const datasetKey = this.getDatasetKey(symbol, timeframe);
    const candles = this.datasets.get(datasetKey);

    if (!candles || candles.length === 0) return null;

    if (cachedIdx !== undefined && cachedIdx >= 0 && cachedIdx < candles.length) {
      return { candle: candles[cachedIdx], index: cachedIdx };
    }

    const result = this.searchStrategy.findCandleIndex(candles, targetTimeUTC, mode);
    if (result) {
      this.cache.setAbsoluteIndex(cacheKey, result.index);
    }
    return result;
  }

  public getCandleAt(symbol: string, timeframe: Timeframe | string, index: number): Candle | null {
    const datasetKey = this.getDatasetKey(symbol, timeframe);
    const candles = this.datasets.get(datasetKey);
    if (!candles || index < 0 || index >= candles.length) return null;
    return candles[index];
  }

  public getCandlesSlice(
    symbol: string,
    timeframe: Timeframe | string,
    startIndex: number,
    endIndex: number
  ): Candle[] {
    const datasetKey = this.getDatasetKey(symbol, timeframe);
    const candles = this.datasets.get(datasetKey);
    if (!candles || candles.length === 0) return [];
    const validStart = Math.max(0, startIndex);
    const validEnd = Math.min(candles.length, endIndex + 1);
    if (validStart >= validEnd) return [];
    return candles.slice(validStart, validEnd);
  }

  public getDatasetLength(symbol: string, timeframe: Timeframe | string): number {
    const datasetKey = this.getDatasetKey(symbol, timeframe);
    return this.datasets.get(datasetKey)?.length ?? 0;
  }

  public getCache(): TwoLevelReplayCache {
    return this.cache;
  }

  public clear(): void {
    this.datasets.clear();
    this.cache.clear();
  }
}
