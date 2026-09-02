import type { Timeframe } from '@/types';

export type ReplayStatus = 'idle' | 'selecting' | 'ready' | 'playing' | 'paused' | 'finished';

export interface ReplayState {
  isReplayMode: boolean;
  replaySelectionMode: boolean;
  status: ReplayStatus;
  symbol: string | null;
  symbolId: number | null;
  timeframe: Timeframe | null;
  replayStartTime: number | null;
  replayStartIndex: number | null;
  currentReplayTime: number | null;
  currentReplayIndex: number | null;
  replayEndTime: number | null;
  totalCandlesInReplay: number;
  startDate?: string | null;
  bufferDays?: number;
}

export const INITIAL_REPLAY_STATE: ReplayState = {
  isReplayMode: false,
  replaySelectionMode: false,
  status: 'idle',
  symbol: null,
  symbolId: null,
  timeframe: null,
  replayStartTime: null,
  replayStartIndex: null,
  currentReplayTime: null,
  currentReplayIndex: null,
  replayEndTime: null,
  totalCandlesInReplay: 0,
  startDate: null,
  bufferDays: 3,
};

