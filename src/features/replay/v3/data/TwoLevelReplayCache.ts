/**
 * Replay Engine V3 — Two-Level Composite Key Cache
 * Architecture Frozen v1.0
 */

import type { ReplayCacheKey, WindowDescriptor } from '../contracts/ReplayTypes';
import { formatCompositeCacheKey } from '../contracts/ReplayTypes';

export class TwoLevelReplayCache {
  // Level 1: Composite Key (symbol:timeframe:timestampUTC) -> Absolute Index
  private level1TimestampIndex = new Map<string, number>();

  // Level 2: Key (symbol:timeframe:absoluteIndex) -> WindowDescriptor Metadata
  private level2WindowCache = new Map<string, WindowDescriptor>();

  public getAbsoluteIndex(key: ReplayCacheKey): number | undefined {
    const compositeKey = formatCompositeCacheKey(key);
    return this.level1TimestampIndex.get(compositeKey);
  }

  public setAbsoluteIndex(key: ReplayCacheKey, absoluteIndex: number): void {
    const compositeKey = formatCompositeCacheKey(key);
    this.level1TimestampIndex.set(compositeKey, absoluteIndex);
  }

  public getWindowDescriptor(keyString: string): WindowDescriptor | undefined {
    return this.level2WindowCache.get(keyString);
  }

  public setWindowDescriptor(keyString: string, descriptor: WindowDescriptor): void {
    this.level2WindowCache.set(keyString, descriptor);
  }

  public clear(): void {
    this.level1TimestampIndex.clear();
    this.level2WindowCache.clear();
  }

  public get sizeLevel1(): number {
    return this.level1TimestampIndex.size;
  }

  public get sizeLevel2(): number {
    return this.level2WindowCache.size;
  }
}
