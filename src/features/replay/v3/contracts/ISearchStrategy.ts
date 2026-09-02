/**
 * Replay Engine V3 — Search Strategy Interface Pattern
 * Architecture Frozen v1.0
 */

import type { Candle } from '@/types';
import type { ReplayTimestampUTC, ReplayStartMode } from './ReplayTypes';

/**
 * Result returned by search strategies.
 */
export interface StartModeResolutionResult {
  readonly candle: Candle;
  readonly index: number;
}

/**
 * Abstract interface for timestamp matching strategies over sorted candle arrays.
 */
export interface ISearchStrategy {
  findCandleIndex(
    candles: Candle[],
    targetTimeUTC: ReplayTimestampUTC,
    mode: ReplayStartMode
  ): StartModeResolutionResult | null;
}
