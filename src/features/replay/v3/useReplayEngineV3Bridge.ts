import { useCallback, useEffect, useRef, useState } from 'react';
import type { Candle, Timeframe } from '@/types';
import type { AnalyticsSession } from '../../analytics/types';
import type { ReplayState } from '../types';
import { INITIAL_REPLAY_STATE } from '../types';
import { useReplayEngineV3 } from './useReplayEngineV3';

export function useReplayEngineV3Bridge(
  symbolId: number | null,
  symbol: string | null,
  timeframe: Timeframe | null,
  allCandles: Candle[],
  activeSession?: AnalyticsSession | null
) {
  const v3 = useReplayEngineV3();
  const [replayState, setReplayState] = useState<ReplayState>(INITIAL_REPLAY_STATE);

  const effectiveSymbol = symbolId ? String(symbolId) : (symbol ?? 'DEFAULT');
  console.time('[STARTUP TRACE 3] useReplayEngineV3Bridge initialization');
  console.log('[STARTUP TRACE 3] Bridge init - symbol:', effectiveSymbol, 'timeframe:', timeframe, 'candles length:', allCandles.length);

  // Load candles into V3 CandleRepository
  useEffect(() => {
    if (effectiveSymbol && timeframe && allCandles.length > 0) {
      console.time('[STARTUP TRACE 4] CandleRepository loadCandles');
      const count = v3.loadCandles(effectiveSymbol, timeframe, allCandles);
      console.log(`[STARTUP TRACE 4] Repository ready: Loaded ${count} candles for ${effectiveSymbol}:${timeframe}`);
      console.timeEnd('[STARTUP TRACE 4] CandleRepository loadCandles');
    }
  }, [effectiveSymbol, timeframe, allCandles, v3]);

  // Auto-initialize V3 Replay Session from activeSession metadata (startDate, endDate, replayStartTime)
  const initializedSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeSession || !effectiveSymbol || !timeframe || allCandles.length === 0) return;

    if (initializedSessionIdRef.current === activeSession.id && v3.engine.timeline.state.activeSession) {
      return;
    }

    let startSec: number | null = null;
    if (activeSession.startDate) {
      const startDateStr = activeSession.startDate.includes('T') ? activeSession.startDate : `${activeSession.startDate}T00:00:00Z`;
      const parsed = Math.floor(new Date(startDateStr).getTime() / 1000);
      if (!isNaN(parsed) && parsed > 0) startSec = parsed;
    }

    let endSec: number | null = null;
    if (activeSession.endDate) {
      const endDateStr = activeSession.endDate.includes('T') ? activeSession.endDate : `${activeSession.endDate}T23:59:59Z`;
      const parsed = Math.floor(new Date(endDateStr).getTime() / 1000);
      if (!isNaN(parsed) && parsed > 0) endSec = parsed;
    }

    const minDatasetTime = allCandles[0].time;
    const maxDatasetTime = allCandles[allCandles.length - 1].time;

    const validStart = startSec ?? minDatasetTime;
    const validEnd = endSec ?? maxDatasetTime;

    let targetStartSec = validStart;
    if (activeSession.currentReplayTime !== null && activeSession.currentReplayTime !== undefined) {
      const crt = activeSession.currentReplayTime;
      if (crt >= validStart && crt <= validEnd) {
        targetStartSec = crt;
      }
    }

    console.log('[REPLAY V3 BRIDGE] Auto-initializing session from activeSession:', {
      sessionId: activeSession.id,
      startDate: activeSession.startDate,
      endDate: activeSession.endDate,
      targetStartSec,
      validStart,
      validEnd,
      totalCandles: allCandles.length,
    });

    const match = v3.engine.repository.findCandleIndexByTime(effectiveSymbol, timeframe, targetStartSec, 'PREVIOUS');
    const startIndex = match ? match.index : 0;
    const effectiveStartCandle = allCandles[startIndex] ?? allCandles[0];

    const sessionRes = v3.createSession(
      effectiveSymbol,
      timeframe,
      effectiveStartCandle.time,
      validEnd,
      'PREVIOUS'
    );

    initializedSessionIdRef.current = activeSession.id;

    setReplayState((prev) => ({
      ...prev,
      isReplayMode: true,
      replaySelectionMode: false,
      status: 'paused',
      symbol,
      symbolId,
      timeframe,
      replayStartIndex: startIndex,
      currentReplayIndex: startIndex,
    }));
  }, [activeSession, effectiveSymbol, timeframe, allCandles, v3, symbol, symbolId]);

  // Sync V3 Timeline State & ReplayTimeChanged to ReplayState
  useEffect(() => {
    const unsub = v3.engine.eventBus.on('ReplayTimeChanged', (payload) => {
      if (!allCandles.length || !effectiveSymbol || !timeframe) return;
      const match = v3.engine.repository.findCandleIndexByTime(
        effectiveSymbol,
        timeframe,
        payload.currentTimeUTC,
        'PREVIOUS'
      );
      if (match) {
        setReplayState((prev) => ({
          ...prev,
          currentReplayIndex: match.index,
        }));
      }
    });

    return () => unsub();
  }, [v3.engine, allCandles, effectiveSymbol, timeframe]);

  useEffect(() => {
    const ts = v3.engine.timeline.state;
    if (ts.status === 'idle' || !ts.activeSession) {
      setReplayState((prev) => ({
        ...INITIAL_REPLAY_STATE,
        status: prev.status === 'selecting' ? 'selecting' : 'idle',
        replaySelectionMode: prev.replaySelectionMode,
      }));
    } else {
      const match = effectiveSymbol && timeframe && ts.currentReplayTimeUTC
        ? v3.engine.repository.findCandleIndexByTime(effectiveSymbol, timeframe, ts.currentReplayTimeUTC, 'PREVIOUS')
        : null;
      const startMatch = effectiveSymbol && timeframe && ts.replayStartTimeUTC
        ? v3.engine.repository.findCandleIndexByTime(effectiveSymbol, timeframe, ts.replayStartTimeUTC, 'PREVIOUS')
        : null;

      setReplayState((prev) => ({
        ...prev,
        isReplayMode: true,
        replaySelectionMode: false,
        status: ts.status as any,
        symbol,
        symbolId,
        timeframe,
        replayStartTime: ts.replayStartTimeUTC ?? prev.replayStartTime,
        currentReplayTime: ts.currentReplayTimeUTC ?? prev.currentReplayTime,
        replayStartIndex: startMatch ? startMatch.index : (prev.replayStartIndex ?? 0),
        currentReplayIndex: match ? match.index : (prev.currentReplayIndex ?? 0),
      }));
    }
  }, [v3.timelineState, symbol, symbolId, effectiveSymbol, timeframe, allCandles.length, v3.engine.repository]);

  const confirmReplayStartPoint = useCallback(
    (startIndex: number) => {
      if (!effectiveSymbol || !timeframe || allCandles.length === 0) return;
      const candle = allCandles[startIndex];
      if (!candle) return;

      console.log('[REPLAY DATE FORENSIC 2b] confirmReplayStartPoint', { startIndex, candleTime: candle.time, symbol: effectiveSymbol, timeframe, totalCandles: allCandles.length });

      console.log(
        `[V3 RUNTIME TRACE] Create Session ➔ TargetStartUTC: ${candle.time} ➔ Binary Search Index: ${startIndex} ➔ Start Candle Time: ${candle.time} ➔ SUCCESS`
      );

      const sessionRes = v3.createSession(effectiveSymbol, timeframe, candle.time, undefined, 'PREVIOUS');
      console.log('[REPLAY FIX 1] Session created:', { startTimeUTC: sessionRes.resolvedStartCandleTime, currentReplayTimeUTC: v3.timelineState.currentReplayTimeUTC, activeSession: !!v3.timelineState.activeSession });

      setReplayState((prev) => ({
        ...prev,
        isReplayMode: true,
        replaySelectionMode: false,
        status: 'paused',
        replayStartIndex: startIndex,
        currentReplayIndex: startIndex,
      }));
    },
    [effectiveSymbol, timeframe, allCandles, v3]
  );

  const startReplaySelection = useCallback(() => {
    setReplayState((prev) => ({ ...prev, status: 'selecting', replaySelectionMode: true }));
  }, []);

  const cancelReplaySelection = useCallback(() => {
    setReplayState((prev) => ({ ...prev, status: 'idle', replaySelectionMode: false }));
  }, []);

  const exitReplayMode = useCallback(() => {
    v3.stop();
    v3.engine.reset();
    setReplayState(INITIAL_REPLAY_STATE);
  }, [v3]);

  const isDatasetReady = allCandles && allCandles.length > 0;

  return {
    engineV3: v3.engine,
    v3,
    replayState,
    masterCandles: allCandles,
    sessionCandles: allCandles,
    currentIndex: 0,
    isPlaying: v3.timelineState.status === 'playing',
    speed: v3.timelineState.playbackSpeed,
    /** App Dataset Lifecycle State: True when SQLite dataset is loaded and ChartContainer can mount */
    sessionReady: isDatasetReady,
    isInitialized: isDatasetReady,
    /** Replay Engine Playback State Machine (SSoT) */
    replayStatus: v3.timelineState.status,
    startReplaySelection,
    confirmReplayStartPoint,
    cancelReplaySelection,
    exitReplayMode,
    play: (...args: Parameters<typeof v3.play>) => { console.log('[REPLAY FORENSIC 2] ReplayProvider/Bridge play() CALLED', { timelineStatus: v3.timelineState.status, currentTimeUTC: v3.timelineState.currentReplayTimeUTC, activeSession: !!v3.timelineState.activeSession }); return v3.play(...args); },
    pause: v3.pause,
    setSpeed: v3.setSpeed,
    nextCandle: () => v3.stepForward(60),
    prevCandle: () => v3.stepBackward(60),
    skipForward: (c?: number) => v3.stepForward((c ?? 1) * 60),
    seekToIndex: (idx: number) => {
      const c = allCandles[idx];
      if (c) v3.jumpToTime(c.time);
    },
    seekToTimestamp: (ts: number) => v3.jumpToTime(ts),
    resetReplay: exitReplayMode,
    initReplaySession: (startSec: number, endSec?: number, bufferCount: number = 0) => {
      if (effectiveSymbol && timeframe && allCandles.length > 0) {
        const match = v3.engine.repository.findCandleIndexByTime(effectiveSymbol, timeframe, startSec, 'PREVIOUS');
        let startIndex = match ? match.index : 0;

        if (bufferCount > 0) {
          startIndex = Math.max(0, startIndex - bufferCount);
        }

        const effectiveStartCandle = allCandles[startIndex] ?? allCandles[0];
        console.log('[REPLAY DATE FORENSIC 2] initReplaySession resolved', { startSec, endSec, bufferCount, matchIndex: match?.index, matchCandleTime: match?.candle?.time, finalStartIndex: startIndex, effectiveStartCandleTime: effectiveStartCandle.time, symbol: effectiveSymbol, timeframe });
        const sessionRes = v3.createSession(effectiveSymbol, timeframe, effectiveStartCandle.time, endSec, 'PREVIOUS');
        console.log('[REPLAY FIX 1] Session created via initReplaySession:', { startTimeUTC: sessionRes.resolvedStartCandleTime, currentReplayTimeUTC: v3.timelineState.currentReplayTimeUTC, activeSession: !!v3.timelineState.activeSession });

        setReplayState((prev) => ({
          ...prev,
          isReplayMode: true,
          replaySelectionMode: false,
          status: 'paused',
          replayStartIndex: startIndex,
          currentReplayIndex: startIndex,
        }));
      }
    },
    getDataView: () => ({ historicalCandles: allCandles, visibleCandle: null, futureCandles: [] }),
    getProgress: () => 0,
  };
}
