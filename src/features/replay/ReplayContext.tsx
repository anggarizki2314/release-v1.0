import React, { createContext, useContext, ReactNode } from 'react';
import type { Timeframe, Candle } from '@/types';
import { useReplayEngine } from './useReplayEngine';
import type { ReplayState } from './types';
import { FEATURE_FLAGS } from '@/config/featureFlags';
import { useReplayEngineV3Bridge } from './v3/useReplayEngineV3Bridge';
import type { ReplayEngineV3 } from './v3/ReplayEngineV3';

import type { AnalyticsSession } from '../analytics/types';

export interface ReplayContextType {
  masterCandles: Candle[];
  sessionCandles: Candle[];
  currentIndex: number;
  isPlaying: boolean;
  speed: number;
  initReplaySession: (startDate: number, endDate?: number, bufferCount?: number) => void;
  replayState: ReplayState;
  startReplaySelection: () => void;
  confirmReplayStartPoint: (startIndex: number) => void;
  createReplaySession: (startDateStr: string, bufferDaysCount: number, sessionTz: string) => Promise<void>;
  cancelReplaySelection: () => void;

  exitReplayMode: () => void;
  play: (speed?: number) => void;
  pause: () => void;
  setSpeed: (speed: number) => void;
  nextCandle: (tf?: Timeframe | string) => void;
  prevCandle: (tf?: Timeframe | string) => void;
  skipForward: (count?: number) => void;
  seekToIndex: (index: number) => void;
  seekToTimestamp: (timestamp: number) => void;
  resetReplay: () => void;
  getDataView: () => any;
  getProgress: () => number;
  sessionReady: boolean;
  isInitialized: boolean;
  replayStatus?: string;
  engineV3?: ReplayEngineV3;

  replayTimeframe: Timeframe;
  autoFollow: boolean;
  setReplayTimeframe: (tf: Timeframe) => void;
  setAutoFollow: (autoFollow: boolean) => void;
  toggleAutoFollow: () => void;
}

const ReplayContext = createContext<ReplayContextType | undefined>(undefined);

interface ReplayProviderProps {
  children: ReactNode;
  symbolId: number | null;
  symbol: string | null;
  timeframe: Timeframe | null;
  allCandles: Candle[];
  activeSession?: AnalyticsSession | null;
  onUpdateSessionState?: (updates: Partial<AnalyticsSession>) => void;
  symbols?: import('@/types').SymbolInfo[];
}

export function ReplayProvider({
  children,
  symbolId,
  symbol,
  timeframe,
  allCandles,
  activeSession,
  onUpdateSessionState,
  symbols,
}: ReplayProviderProps) {
  console.log('[REPLAY ENGINE] Mounting ReplayProvider with symbol:', symbol, 'timeframe:', timeframe, 'allCandles count:', allCandles.length);

  const engineV2 = useReplayEngine(
    symbolId,
    symbol,
    timeframe,
    allCandles,
    activeSession,
    onUpdateSessionState,
    symbols
  );

  const activeEngine = engineV2;

  const value: ReplayContextType = {
    masterCandles: activeEngine.masterCandles,
    sessionCandles: activeEngine.sessionCandles,
    currentIndex: activeEngine.currentIndex,
    isPlaying: activeEngine.isPlaying,
    speed: activeEngine.speed,
    initReplaySession: (startSec: number, endSec?: number, bufferCount?: number) => {
      // Deprecated helper retained for contract compatibility
    },
    replayState: activeEngine.replayState,
    startReplaySelection: activeEngine.startReplaySelection,
    confirmReplayStartPoint: activeEngine.confirmReplayStartPoint,
    createReplaySession: activeEngine.createReplaySession,
    cancelReplaySelection: activeEngine.cancelReplaySelection,

    exitReplayMode: activeEngine.exitReplayMode,
    play: activeEngine.play,
    pause: activeEngine.pause,
    setSpeed: activeEngine.setSpeed,
    nextCandle: activeEngine.nextCandle,
    prevCandle: activeEngine.prevCandle,
    skipForward: activeEngine.skipForward,
    seekToIndex: activeEngine.seekToIndex,
    seekToTimestamp: activeEngine.seekToTimestamp,
    resetReplay: activeEngine.resetReplay,
    getDataView: activeEngine.getDataView,
    getProgress: activeEngine.getProgress,
    sessionReady: activeEngine.sessionReady,
    isInitialized: activeEngine.isInitialized,
    replayStatus: activeEngine.replayState.status,

    replayTimeframe: activeEngine.replayTimeframe,
    autoFollow: activeEngine.autoFollow,
    setReplayTimeframe: activeEngine.setReplayTimeframe,
    setAutoFollow: activeEngine.setAutoFollow,
    toggleAutoFollow: activeEngine.toggleAutoFollow,
  };

  return <ReplayContext.Provider value={value}>{children}</ReplayContext.Provider>;
}


export function useReplay(): ReplayContextType {
  const context = useContext(ReplayContext);
  if (!context) {
    throw new Error('useReplay must be used within ReplayProvider');
  }
  return context;
}
