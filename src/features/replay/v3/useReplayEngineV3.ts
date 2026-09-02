/**
 * Replay Engine V3 — React Hook Wrapper (useReplayEngineV3)
 * Architecture Frozen v1.0
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Candle, Timeframe } from '@/types';
import type { ReplayTimestampUTC, ReplayStartMode, ReplayTimelineState } from './contracts/ReplayTypes';
import { ReplayEngineV3 } from './ReplayEngineV3';

export function useReplayEngineV3() {
  const engineRef = useRef<ReplayEngineV3 | null>(null);

  if (!engineRef.current) {
    engineRef.current = new ReplayEngineV3();
  }

  const engine = engineRef.current;
  const [timelineState, setTimelineState] = useState<ReplayTimelineState>(engine.timeline.state);

  useEffect(() => {
    const syncState = () => {
      setTimelineState({ ...engine.timeline.state });
    };

    const unsub1 = engine.eventBus.on('ReplayTimeChanged', syncState);
    const unsub2 = engine.eventBus.on('ReplayStarted', syncState);
    const unsub3 = engine.eventBus.on('ReplayPaused', syncState);
    const unsub4 = engine.eventBus.on('ReplayStopped', syncState);
    const unsub5 = engine.eventBus.on('ReplayFinished', syncState);
    const unsub6 = engine.eventBus.on('ReplaySpeedChanged', syncState);
    const unsub7 = engine.eventBus.on('ReplaySessionCreated', syncState);
    const unsub8 = engine.eventBus.on('ReplaySessionDestroyed', syncState);

    return () => {
      unsub1(); unsub2(); unsub3(); unsub4();
      unsub5(); unsub6(); unsub7(); unsub8();
    };
  }, [engine]);

  const loadCandles = useCallback((symbol: string, timeframe: Timeframe | string, candles: Candle[]) => {
    return engine.loadCandles(symbol, timeframe, candles);
  }, [engine]);

  const createSession = useCallback((
    symbol: string,
    timeframe: Timeframe | string,
    targetStartUTC: ReplayTimestampUTC,
    targetEndUTC?: ReplayTimestampUTC,
    startMode: ReplayStartMode = 'PREVIOUS'
  ) => {
    return engine.createSession({ symbol, timeframe, targetStartUTC, targetEndUTC, startMode });
  }, [engine]);

  const play = useCallback(() => { console.log('[REPLAY FORENSIC 3] Engine state BEFORE play()', { timelineStatus: engine.timeline.status, currentReplayTimeUTC: engine.timeline.currentReplayTimeUTC, playbackSpeed: engine.timeline.playbackSpeed, activeSession: !!engine.timeline.state.activeSession, synchronizerContexts: engine.synchronizer.getChartContexts().length }); return engine.play(); }, [engine]);
  const pause = useCallback(() => engine.pause(), [engine]);
  const stop = useCallback(() => engine.stop(), [engine]);
  const setSpeed = useCallback((s: number) => engine.setSpeed(s), [engine]);
  const jumpToTime = useCallback((t: ReplayTimestampUTC) => engine.jumpToTime(t), [engine]);
  const stepForward = useCallback((s?: number) => engine.stepForward(s), [engine]);
  const stepBackward = useCallback((s?: number) => engine.stepBackward(s), [engine]);

  return {
    engine,
    timelineState,
    loadCandles,
    createSession,
    play,
    pause,
    stop,
    setSpeed,
    jumpToTime,
    stepForward,
    stepBackward,
  };
}
