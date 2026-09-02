// Feature: replay
// Replay engine: candle-by-candle replay with start point selection.

export { INITIAL_REPLAY_STATE } from './types';
export type { ReplayState, ReplayStatus } from './types';

export { ReplayEngine } from './engine';
export type { ReplayEngineConfig, ReplayDataView } from './engine';

export { useReplayEngine } from './useReplayEngine';
export { useChartFilteredCandles, useVisibleTimeRange } from './useChartFilter';

export { ReplayProvider, useReplay } from './ReplayContext';

export {
  findReplayStartPointIndex,
  findNearestCandleIndex,
  findFirstCandleIndexOnOrAfter,
  separateDataset,
  getDatasetTimeRange,
} from './replayStartPoint';

export type { ReplayStartPointOptions, SeparatedDataset, DatasetTimeRange } from './replayStartPoint';

export { ReplayRenderer, replayRenderer } from './ReplayRenderer';
export type { LWCCandle } from './ReplayRenderer';

export {
  parseAndFindStartPoint,
  unixSecondsToDateString,
  getSignificantDates,
} from './startPointHelpers';
export type { SignificantDate } from './startPointHelpers';

export {
  calculateTimelineProgress,
  timestampFromProgress,
  findNearestCandle,
  candleFromTimelinePercent,
  isTimelineValid,
} from './replayTimeline';

// ── Replay Engine V3 Exports (Architecture Frozen v1.0) ──
export * from './v3/contracts/ReplayTypes';
export * from './v3/contracts/ReplayEvents';
export * from './v3/contracts/IClock';
export * from './v3/contracts/ISearchStrategy';
export { CandleValidationLayer } from './v3/data/CandleValidationLayer';
export { BinarySearchStrategy } from './v3/data/BinarySearchStrategy';
export { TwoLevelReplayCache } from './v3/data/TwoLevelReplayCache';
export { CandleRepository } from './v3/data/CandleRepository';
export { WindowManager } from './v3/data/WindowManager';
export { ReplayClock } from './v3/core/ReplayClock';
export { ReplayTimeline as ReplayTimelineV3 } from './v3/core/ReplayTimeline';
export { ReplayEventBus } from './v3/core/ReplayEventBus';
export { ReplaySessionManager } from './v3/core/ReplaySessionManager';
export { PlaybackController } from './v3/core/PlaybackController';
export { ReplayIndexResolver } from './v3/context/ReplayIndexResolver';
export { ChartContext as ChartContextV3 } from './v3/context/ChartContext';
export { ChartSynchronizer } from './v3/context/ChartSynchronizer';
export { ReplayEngineV3 } from './v3/ReplayEngineV3';
export { useReplayEngineV3 } from './v3/useReplayEngineV3';
export { ReplayProviderV3, useReplayV3 } from './v3/ReplayContextV3';
