import type { Candle } from '@/types';
import type { ReplayState } from './types';

/**
 * Replay Derived Values
 *
 * All time-based fields (currentReplayTime, replayStartTime, replayEndTime)
 * are NOT stored in ReplayState. They are always computed from the canonical
 * index fields (currentReplayIndex, replayStartIndex) + the allCandles array.
 *
 * This is the SINGLE place where index → time conversion happens.
 * No other file should do its own index→time math.
 */
export interface ReplayDerived {
  currentReplayTime: number | null;
  replayStartTime: number | null;
  replayEndTime: number | null;
  totalCandlesInReplay: number;
  /** 0–100, progress from start to current */
  progress: number;
}

export function getReplayDerived(
  allCandles: Candle[],
  state: ReplayState
): ReplayDerived {
  const startIdx = state.replayStartIndex;
  const currIdx = state.currentReplayIndex;

  const replayStartTime =
    startIdx !== null && allCandles[startIdx] ? allCandles[startIdx].time : null;

  const currentReplayTime =
    currIdx !== null && allCandles[currIdx] ? allCandles[currIdx].time : null;

  const replayEndTime =
    allCandles.length > 0 ? allCandles[allCandles.length - 1].time : null;

  const totalCandlesInReplay =
    startIdx !== null ? Math.max(0, allCandles.length - startIdx) : 0;

  let progress = 0;
  if (
    startIdx !== null &&
    currIdx !== null &&
    allCandles.length > startIdx
  ) {
    const totalSteps = allCandles.length - startIdx;
    const currentStep = currIdx - startIdx;
    progress = totalSteps > 0 ? Math.min(100, Math.max(0, (currentStep / totalSteps) * 100)) : 0;
  }

  return {
    currentReplayTime,
    replayStartTime,
    replayEndTime,
    totalCandlesInReplay,
    progress,
  };
}
