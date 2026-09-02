import { useCallback, useEffect, useRef, useState } from 'react';
import type { Candle, Timeframe } from '@/types';
import { getSetting, setSetting } from '@features/database';
import { localDateToUtcSeconds, subtractCalendarDays } from '@features/timezone';
import { getCandlesFrom, getCandlesRange } from '@features/chart/api';
import { tradingEngine } from '@features/trading2/TradingEngineService';
import { ReplayEngine } from './engine';
import { timeframeToSeconds, resampleCandles, clearResampleCache } from '@/utils/dataResampler';
import { getBucketStart, getBucketEnd, findFirstIdx, findLastIdx } from '../chart/candleResolver';
import { mergeDeduplicateCandles, getSymbolCache, notifySymbolCacheUpdated } from '../chart/useCandles';
import { REPLAY_DEBUG } from '@/config/debug';

import { findNearestCandleIndex, findFirstCandleIndexOnOrAfter } from './replayStartPoint';
import type { ReplayState } from './types';
import { INITIAL_REPLAY_STATE } from './types';
import type { AnalyticsSession } from '../analytics/types';

/** Default playback interval: 500ms per candle at 1x speed. */
const DEFAULT_INTERVAL_MS = 500;
const PREFETCH_THRESHOLD = 5000;

const VALID_SPEEDS = new Set([0.5, 1, 2, 5, 10, 20]);

interface PersistedReplaySession {
  startTime: number;
  currentTime: number | null;
  speed: number;
  startDate?: string | null;
  bufferDays?: number;
}

function parseReplaySession(
  startTimeRaw: string | null,
  currentTimeRaw: string | null,
  speedRaw: string | null,
  startDateRaw?: string | null,
  bufferDaysRaw?: string | null
): PersistedReplaySession | null {
  if (!startTimeRaw) return null;
  const startTime = Number(startTimeRaw);
  if (!Number.isFinite(startTime) || startTime <= 0) return null;

  let currentTime: number | null = null;
  if (currentTimeRaw) {
    const t = Number(currentTimeRaw);
    if (Number.isFinite(t) && t > 0) currentTime = t;
  }

  let speed = 1;
  if (speedRaw) {
    const s = Number(speedRaw);
    if (VALID_SPEEDS.has(s)) speed = s;
  }

  const startDate = startDateRaw || null;
  const bufferDays = bufferDaysRaw ? Math.max(0, parseInt(bufferDaysRaw, 10) || 3) : 3;

  return { startTime, currentTime, speed, startDate, bufferDays };
}

/**
 * Stable Replay Engine Hook — OLD_STABLE Golden Reference architecture.
 *
 * Provides:
 * - Pure timestamp-based binary search candle slicing support
 * - Recursive setTimeout playback loop
 * - Timestamp re-anchoring across timeframe switches
 * - Physical buffer boundary protection (cannot step backward past start point)
 * - Integration with CURRENT activeSession SQLite auto-save
 */
export function useReplayEngine(
  symbolId: number | null,
  symbol: string | null,
  timeframe: Timeframe | null,
  allCandles: Candle[],
  activeSession?: AnalyticsSession | null,
  onUpdateSessionState?: (updates: Partial<AnalyticsSession>) => void,
  allSymbols?: import('@/types').SymbolInfo[]
) {
  const engineRef = useRef<ReplayEngine | null>(null);
  const [replayState, setReplayState] = useState<ReplayState>(INITIAL_REPLAY_STATE);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);


  const speedRef = useRef(1);

  // Authoritative Replay Timeframe & Auto Follow state
  const [replayTimeframe, setReplayTimeframeState] = useState<Timeframe>('M5');
  const [autoFollow, setAutoFollowState] = useState<boolean>(true);

  const setReplayTimeframe = useCallback((tf: Timeframe) => {
    setReplayTimeframeState(tf);
  }, []);

  const setAutoFollow = useCallback((af: boolean) => {
    setAutoFollowState(af);
  }, []);

  const toggleAutoFollow = useCallback(() => {
    setAutoFollowState((prev) => !prev);
  }, []);

  // Persistence tracking
  const [persistedSession, setPersistedSession] = useState<PersistedReplaySession | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const restoredStartTimeRef = useRef<number | null>(null);
  const restoredCurrentTimeRef = useRef<number | null>(null);

  // Load persisted session from database settings
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getSetting('replay:startTime'),
      getSetting('replay:currentTime'),
      getSetting('replay:speed'),
      getSetting('replay:startDate'),
      getSetting('replay:bufferDays'),
    ]).then(([startTimeRaw, currentTimeRaw, speedRaw, startDateRaw, bufferDaysRaw]) => {
      if (cancelled) return;
      setPersistedSession(
        parseReplaySession(startTimeRaw, currentTimeRaw, speedRaw, startDateRaw, bufferDaysRaw)
      );
      setSessionReady(true);
    }).catch((err) => {
      console.error('Failed to load persisted replay session:', err);
      if (!cancelled) setSessionReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Duplicate protection tracker for ReplayAdapter ticks & non-blocking buffer prefetch
  const lastForwardedTimeRef = useRef<number | null>(null);
  const loadingMoreFutureRef = useRef(false);
  const noMoreFutureDataRef = useRef(false);
  const startTimerRef = useRef<(() => void) | null>(null);

  /** Forward replay candle tick to Trading Engine 2.0 via ReplayAdapter */
  const forwardCandleToTradingEngine = useCallback(
    (candle: Candle) => {
      if (!symbol || !candle) return;
      tradingEngine.replayAdapter.onReplayCandle({
        symbol,
        timestamp: candle.time * 1000,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
      });
    },
    [symbol]
  );

  /** Clear playback timer safely */
  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /** Read latest state snapshot from engine and push to React state */
  const syncState = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) {
      setReplayState(INITIAL_REPLAY_STATE);
      return;
    }
    const base = engine.getReplayState();
    const currentCandle = engine.getAllCandles()[engine.getCurrentIndex()];

    if (base.currentReplayTime !== null) {
      restoredCurrentTimeRef.current = base.currentReplayTime;
    }
    if (base.replayStartTime !== null) {
      restoredStartTimeRef.current = base.replayStartTime;
    }

    if (REPLAY_DEBUG) {
      console.log('[MASTER-CLOCK-PUBLISH]', {
        currentIndex: engine.getCurrentIndex(),
        engineReplayTime: currentCandle ? currentCandle.time : null,
        publishedReplayTime: base.currentReplayTime,
        publishedReplayTimeISO: base.currentReplayTime ? new Date(base.currentReplayTime * 1000).toISOString() : null,
        status: base.status,
      });
    }

    setReplayState((prev) => ({
      ...base,
      startDate: prev.startDate,
      bufferDays: prev.bufferDays,
      replaySelectionMode: prev.replaySelectionMode,
    }));
  }, []);

  // Handle manual 1-click 'refresh-chart-lag' (flushes snapshot memory & re-anchors engine buffer around current replay position)
  useEffect(() => {
    const handleRefreshLag = () => {
      const engine = engineRef.current;
      if (!engine) return;

      const currentIdx = engine.getCurrentIndex();
      const allCandles = engine.getAllCandles();

      // 1. Re-initialize TradingEngine snapshot baseline at current candle, clearing accumulated past snapshot trees
      if (currentIdx >= 0 && currentIdx < allCandles.length) {
        tradingEngine.snapshotManager.initialize(currentIdx);
      }

      // 2. Prune old trailing past candles if buffer grew large, keeping a comfortable 30-day window
      if (currentIdx > 15000) {
        const trimCount = currentIdx - 15000;
        const pruned = allCandles.slice(trimCount);
        engine.updateAllCandles(pruned);
        engine.setCurrentIndex(15000);
      }

      syncState();
    };

    window.addEventListener('refresh-chart-lag', handleRefreshLag);
    return () => window.removeEventListener('refresh-chart-lag', handleRefreshLag);
  }, [syncState]);

  /** Trigger non-blocking future buffer prefetch from SQLite when remaining candles <= threshold */
  const triggerPrefetchIfNeeded = useCallback(
    (currentIdx: number, candles: Candle[]) => {
      if (!symbolId || !symbol) return;

      const remaining = candles.length - 1 - currentIdx;
      const intervalSec = timeframeToSeconds(timeframe || 'M1');
      const prefetchThreshold = Math.max(200, Math.round((7 * 86400) / intervalSec));
      const shouldPrefetch = remaining <= prefetchThreshold;

      if (REPLAY_DEBUG) {
        console.log('[PREFETCH-CHECK]', {
          currentIndex: currentIdx,
          bufferLength: candles.length,
          remaining,
          threshold: prefetchThreshold,
          shouldPrefetch,
          loadingMoreFuture: loadingMoreFutureRef.current,
          noMoreFutureData: noMoreFutureDataRef.current,
        });
      }

      if (!shouldPrefetch || loadingMoreFutureRef.current || noMoreFutureDataRef.current) {
        return;
      }

      loadingMoreFutureRef.current = true;
      const lastLoadedUtc = candles[candles.length - 1].time;
      const nextEndUtc = lastLoadedUtc + 30 * 86400; // Next 30-day chunk

      const currentCandle = candles[currentIdx];
      const curTime = currentCandle ? currentCandle.time : null;

      if (REPLAY_DEBUG) {
        console.log('[PREFETCH-START]', {
          symbolId,
          timeframe,
          rangeStart: lastLoadedUtc + 1,
          rangeStartISO: new Date((lastLoadedUtc + 1) * 1000).toISOString(),
          rangeEnd: nextEndUtc,
          rangeEndISO: new Date(nextEndUtc * 1000).toISOString(),
          currentReplayTime: curTime,
          currentReplayTimeISO: curTime ? new Date(curTime * 1000).toISOString() : null,
          bufferLengthBefore: candles.length,
          currentIndex: currentIdx,
        });
      }

      // 1. Prefetch for primary symbol (try M1 first, fallback to current timeframe)
      getCandlesRange(symbolId, 'M1', lastLoadedUtc + 1, nextEndUtc)
        .then(async (newM1Candles: Candle[]) => {
          let fetchedCandles = newM1Candles;
          if (!fetchedCandles || fetchedCandles.length === 0) {
            fetchedCandles = (await getCandlesRange(symbolId, timeframe || 'M1', lastLoadedUtc + 1, nextEndUtc)) as Candle[];
          }

          if (!fetchedCandles || fetchedCandles.length === 0) {
            if (REPLAY_DEBUG) {
              console.log('[PREFETCH-END-OF-DATA]', {
                rangeStart: lastLoadedUtc + 1,
                rangeStartISO: new Date((lastLoadedUtc + 1) * 1000).toISOString(),
                rangeEnd: nextEndUtc,
                rangeEndISO: new Date(nextEndUtc * 1000).toISOString(),
                currentReplayTime: curTime,
                currentReplayTimeISO: curTime ? new Date(curTime * 1000).toISOString() : null,
              });
              console.log('[ReplayDataLoader] TRUE SESSION END');
            }
            noMoreFutureDataRef.current = true;
            if (engineRef.current) {
              engineRef.current.setHasMoreFutureData(false);
            }
            return;
          }

          // 2. Sync shared symbol cache
          const symbolCache = getSymbolCache(symbolId);
          const currentM1 = symbolCache.get('M1') ?? [];
          const mergedM1 = mergeDeduplicateCandles(currentM1, fetchedCandles);
          symbolCache.set('M1', mergedM1);

          clearResampleCache();
          for (const key of Array.from(symbolCache.keys())) {
            if (key !== 'M1') {
              symbolCache.delete(key);
            }
          }

          const activeTf = timeframe ?? 'M1';
          const updatedTfCandles = activeTf === 'M1' ? mergedM1 : resampleCandles(mergedM1, activeTf);
          symbolCache.set(activeTf, updatedTfCandles);

          if (engineRef.current) {
            engineRef.current.updateAllCandles(updatedTfCandles);
            engineRef.current.setHasMoreFutureData(true);
          }

          // Broadcast update to all active chart panes (PaneContainer, AppShell)
          notifySymbolCacheUpdated(symbolId);
          void window.forexReplay?.trimMemory?.();

          if (engineRef.current && engineRef.current.getStatus() === 'playing' && timerRef.current === null) {
            if (startTimerRef.current) {
              startTimerRef.current();
            }
          }
        })
        .catch((err) => {
          console.error('[ReplayPrefetch ERROR]', err);
        })
        .finally(() => {
          loadingMoreFutureRef.current = false;
        });
    },
    [symbolId, symbol, timeframe]
  );

  /** Advance one candle or step by target timeframe boundary. Returns false if finished. */
  const stepForward = useCallback((tf?: Timeframe | string): boolean => {
    const engine = engineRef.current;
    if (!engine) {
      if (REPLAY_DEBUG) console.log('[REPLAY-TIMER-STOP]', { reason: 'No engine instance' });
      return false;
    }
    if (engine.isFinished() && noMoreFutureDataRef.current) {
      if (REPLAY_DEBUG) {
        console.log('[REPLAY-TIMER-STOP]', {
          reason: 'Engine isFinished and noMoreFutureData is true',
          currentIndex: engine.getCurrentIndex(),
          allCandlesLength: engine.getAllCandles().length,
          remaining: engine.getAllCandles().length - 1 - engine.getCurrentIndex(),
          engineStatus: engine.getStatus(),
          isFinished: engine.isFinished(),
          isBufferExhausted: engine.isBufferExhausted(),
          loadingMoreFuture: loadingMoreFutureRef.current,
          noMoreFutureData: noMoreFutureDataRef.current,
        });
      }
      return false;
    }

    const candles = engine.getAllCandles();
    const currentIdx = engine.getCurrentIndex();
    if (currentIdx < 0 || currentIdx >= candles.length) {
      if (REPLAY_DEBUG) {
        console.log('[REPLAY-TIMER-STOP]', {
          reason: `Invalid currentIdx ${currentIdx} out of ${candles.length}`,
        });
      }
      return false;
    }

    const remaining = candles.length - 1 - currentIdx;
    const currentCandle = candles[currentIdx];
    const currentTime = currentCandle.time;
    const lastCandle = candles[candles.length - 1];

    // Log REPLAY-DEBUG for every 100 ticks, or when remaining <= 3000, or when near buffer end
    if (REPLAY_DEBUG && (currentIdx % 100 === 0 || remaining <= 3000 || remaining <= 5)) {
      console.log('[REPLAY-DEBUG]', {
        currentReplayTime: currentTime,
        currentReplayTimeISO: new Date(currentTime * 1000).toISOString(),
        currentIndex: currentIdx,
        allCandlesLength: candles.length,
        currentCandleTime: currentTime,
        currentCandleTimeISO: new Date(currentTime * 1000).toISOString(),
        lastLoadedCandleTime: lastCandle ? lastCandle.time : null,
        lastLoadedCandleTimeISO: lastCandle ? new Date(lastCandle.time * 1000).toISOString() : null,
        remaining,
        isFinished: engine.isFinished(),
        isBufferExhausted: engine.isBufferExhausted(),
        hasMoreFutureData: (engine as any).hasMoreFutureData ?? false,
        loadingMoreFuture: loadingMoreFutureRef.current,
        noMoreFutureData: noMoreFutureDataRef.current,
      });

      console.log('[SESSION-END-DEBUG]', {
        sessionEnd: activeSession?.endDate ?? null,
        sessionEndISO: activeSession?.endDate ?? null,
        currentReplayTime: currentTime,
        currentReplayTimeISO: new Date(currentTime * 1000).toISOString(),
        currentIndex: currentIdx,
        lastLoadedCandleTime: lastCandle ? lastCandle.time : null,
        lastLoadedCandleTimeISO: lastCandle ? new Date(lastCandle.time * 1000).toISOString() : null,
      });

      console.log('[MASTER-CLOCK-DEBUG]', {
        currentReplayTime: currentTime,
        currentReplayTimeISO: new Date(currentTime * 1000).toISOString(),
        status: engine.getStatus(),
        currentIndex: currentIdx,
      });
    }

    // Trigger non-blocking future buffer prefetch if remaining candles <= PREFETCH_THRESHOLD
    triggerPrefetchIfNeeded(currentIdx, candles);

    const activeTf = tf ?? replayTimeframe;

    // Calculate target timeframe boundary
    const bucketStart = getBucketStart(currentTime, activeTf);
    const targetEndTime = getBucketEnd(bucketStart, activeTf);

    // Find target index in candles using O(log N) binary search
    let targetIdx = findFirstIdx(candles, targetEndTime);

    if (targetIdx < 0) {
      if (loadingMoreFutureRef.current) {
        if (REPLAY_DEBUG) {
          console.log('[REPLAY-TIMER-STOP]', {
            reason: 'Buffer wait state — IPC prefetch request pending',
            currentReplayTime: currentTime,
            currentReplayTimeISO: new Date(currentTime * 1000).toISOString(),
            currentIndex: currentIdx,
            allCandlesLength: candles.length,
            remaining,
            engineStatus: engine.getStatus(),
            isFinished: engine.isFinished(),
            isBufferExhausted: engine.isBufferExhausted(),
            loadingMoreFuture: loadingMoreFutureRef.current,
            noMoreFutureData: noMoreFutureDataRef.current,
          });
        }
        return false;
      }
      if (!noMoreFutureDataRef.current) {
        triggerPrefetchIfNeeded(currentIdx, candles);
        if (REPLAY_DEBUG) {
          console.log('[REPLAY-TIMER-STOP]', {
            reason: 'Target index beyond buffer — triggering prefetch',
            currentIndex: currentIdx,
            targetEndTime,
            targetEndTimeISO: new Date(targetEndTime * 1000).toISOString(),
          });
        }
        return false;
      }
      if (REPLAY_DEBUG) {
        console.log('[REPLAY-TIMER-STOP]', {
          reason: 'TRUE SESSION END — No more data available in SQLite',
          currentIndex: currentIdx,
          allCandlesLength: candles.length,
          remaining,
          engineStatus: engine.getStatus(),
        });
        console.log('[ReplayDataLoader] TRUE SESSION END');
      }
      engine.setHasMoreFutureData(false);
      return false;
    }

    if (targetIdx <= currentIdx) {
      targetIdx = Math.min(candles.length - 1, currentIdx + 1);
    }

    // Weekend gap transition logging if step jumps across a gap > 1 hour
    const targetCandle = candles[targetIdx];
    if (targetCandle && targetCandle.time - currentTime > 3600) {
      if (REPLAY_DEBUG) {
        console.log('[WEEKEND-TRANSITION]', {
          previousCandleTime: currentTime,
          previousCandleTimeISO: new Date(currentTime * 1000).toISOString(),
          currentCandleTime: targetCandle.time,
          currentCandleTimeISO: new Date(targetCandle.time * 1000).toISOString(),
          timestampDeltaSeconds: targetCandle.time - currentTime,
          currentIndex: currentIdx,
          nextIndex: targetIdx,
          allCandlesLength: candles.length,
        });
      }
    }

    const openPosBeforeStep = tradingEngine.getOpenPositions();

    // Step forward: forward ALL intermediate candle ticks to trading engine to avoid skipping wicks
    for (let i = currentIdx + 1; i <= targetIdx; i++) {
      const c = candles[i];
      if (c) {
        lastForwardedTimeRef.current = c.time;
        forwardCandleToTradingEngine(c);
      }
    }
    if (candles[targetIdx]) {
      tradingEngine.snapshotManager.saveSnapshot(targetIdx);
    }

    const openPosAfterStep = tradingEngine.getOpenPositions();
    const startIdx = replayState.replayStartIndex ?? 0;
    if (currentIdx === startIdx || targetIdx === startIdx + 1) {
      if (REPLAY_DEBUG) {
        console.log('[REPLAY-FIRST-STEP]', JSON.stringify({
          targetIdx,
          snapshotUsed: targetIdx,
          openPositionsBeforeRestore: openPosBeforeStep.map((p) => p.positionId),
          openPositionsAfterRestore: openPosAfterStep.map((p) => p.positionId),
        }));
      }
    }

    engine.setCurrentIndex(targetIdx);

    const postCandle = candles[targetIdx];
    const nextCandle = candles[targetIdx + 1];
    if (REPLAY_DEBUG) {
      console.log('[POST-STEP-CLOCK]', {
        currentIndex: targetIdx,
        currentReplayTime: postCandle ? postCandle.time : null,
        currentReplayTimeISO: postCandle ? new Date(postCandle.time * 1000).toISOString() : null,
        nextCandleTime: nextCandle ? nextCandle.time : null,
        nextCandleTimeISO: nextCandle ? new Date(nextCandle.time * 1000).toISOString() : null,
        allCandlesLength: candles.length,
        status: engine.getStatus(),
      });
    }

    return !engine.isFinished();
  }, [forwardCandleToTradingEngine, replayTimeframe, triggerPrefetchIfNeeded, activeSession?.endDate]);

  /** Step backward one candle or step by target timeframe boundary. Clamped to replayStartIndex. */
  const stepBackward = useCallback((tf?: Timeframe | string): boolean => {
    const engine = engineRef.current;
    if (!engine) return false;

    const state = engine.getReplayState();
    const startIdx = state.replayStartIndex;
    if (startIdx === null) return false;

    const candles = engine.getAllCandles();
    const currentIdx = engine.getCurrentIndex();
    if (currentIdx <= startIdx) return false;

    const activeTf = tf ?? replayTimeframe;
    const currentCandle = candles[currentIdx];
    const currentTime = currentCandle ? currentCandle.time : 0;

    const bucketStart = getBucketStart(currentTime, activeTf);
    const prevTargetTime = currentTime <= bucketStart
      ? getBucketStart(bucketStart - 1, activeTf)
      : bucketStart;

    let targetIdx = findLastIdx(candles, prevTargetTime);
    if (targetIdx < 0) {
      targetIdx = startIdx;
    }
    if (targetIdx >= currentIdx) {
      targetIdx = Math.max(startIdx, currentIdx - 1);
    }
    if (targetIdx < startIdx) {
      targetIdx = startIdx;
    }

    engine.setCurrentIndex(targetIdx);
    tradingEngine.snapshotManager.restoreSnapshot(targetIdx);
    if (candles[targetIdx]) {
      lastForwardedTimeRef.current = candles[targetIdx].time;
      restoredCurrentTimeRef.current = candles[targetIdx].time;
    }

    return true;
  }, [replayTimeframe]);

  const lastSymbolIdRef = useRef<number | null>(null);
  const lastTimeframeRef = useRef<Timeframe | null>(null);
  const lastSessionIdRef = useRef<string | null>(null);
  const allCandlesCount = allCandles.length;
  const firstCandleTime = allCandles[0]?.time ?? 0;
  const lastCandleTime = allCandles[allCandles.length - 1]?.time ?? 0;

  // ── Reset / Re-initialize engine when symbol, timeframe, or dataset changes ──
  useEffect(() => {
    if (REPLAY_DEBUG) {
      console.log('[REPLAY-INIT-EFFECT-EVAL]', {
        symbolId,
        symbol,
        timeframe,
        allCandlesLength: allCandles.length,
        sessionReady,
        activeSessionId: activeSession?.id,
        activeSessionStartDate: activeSession?.startDate,
        activeSessionReplayStartTime: activeSession?.replayStartTime,
        activeSessionCurrentReplayTime: activeSession?.currentReplayTime,
        hasEngine: engineRef.current !== null,
      });
    }

    if (!symbolId || !symbol || !timeframe || allCandles.length === 0 || !sessionReady) {
      clearTimer();
      if (engineRef.current) {
        engineRef.current.reset();
        engineRef.current = null;
      }
      tradingEngine.snapshotManager.clear();
      setReplayState(INITIAL_REPLAY_STATE);
      lastSymbolIdRef.current = null;
      lastTimeframeRef.current = null;
      lastSessionIdRef.current = null;
      restoredStartTimeRef.current = null;
      restoredCurrentTimeRef.current = null;
      return;
    }

    const currentSessionId = activeSession?.id ?? null;
    const isSessionChanged = lastSessionIdRef.current !== currentSessionId;

    if (isSessionChanged) {
      restoredStartTimeRef.current = null;
      restoredCurrentTimeRef.current = null;
      lastForwardedTimeRef.current = null;
    }

    const isSameSymbolAndTf =
      !isSessionChanged &&
      lastSymbolIdRef.current === symbolId &&
      lastTimeframeRef.current === timeframe &&
      engineRef.current !== null;

    // If symbol, timeframe, and session are unchanged, just update candles without resetting engine or clearing timer
    if (isSameSymbolAndTf && engineRef.current) {
      engineRef.current.updateAllCandles(allCandles);
      if (engineRef.current.getStatus() === 'playing' && timerRef.current === null && startTimerRef.current) {
        startTimerRef.current();
      }
      return;
    }

    lastSymbolIdRef.current = symbolId;
    lastTimeframeRef.current = timeframe;
    lastSessionIdRef.current = currentSessionId;
    loadingMoreFutureRef.current = false;
    noMoreFutureDataRef.current = false;

    // ── Restoration / Initialization on dataset load ──
    let sessionStartDateUtc: number | null = null;
    if (activeSession?.startDate) {
      if (typeof activeSession.startDate === 'number') {
        sessionStartDateUtc = activeSession.startDate;
      } else if (!isNaN(Number(activeSession.startDate)) && Number(activeSession.startDate) > 100000000) {
        sessionStartDateUtc = Number(activeSession.startDate);
      } else {
        sessionStartDateUtc = localDateToUtcSeconds(
          activeSession.startDate.includes('T')
            ? activeSession.startDate.split('T')[0]
            : activeSession.startDate,
          'UTC'
        );
      }
    }

    // Default replay start to session start date if not explicitly initialized
    const defaultReplayStartUtc = sessionStartDateUtc ?? null;

    // activeSession is authoritative over legacy global persistedSession
    const effectiveStartTime =
      activeSession?.replayStartTime ??
      defaultReplayStartUtc ??
      sessionStartDateUtc ??
      restoredStartTimeRef.current ??
      (activeSession ? null : persistedSession?.startTime) ??
      (allCandles.length > 0 ? allCandles[0].time : null);

    const effectiveCurrentTime =
      activeSession?.currentReplayTime ??
      restoredCurrentTimeRef.current ??
      (activeSession ? null : persistedSession?.currentTime) ??
      effectiveStartTime;

    clearTimer();

    if (engineRef.current) {
      engineRef.current.reset();
      engineRef.current = null;
    }

    if (effectiveStartTime !== null && allCandles.length > 0) {
      let startIdx = findNearestCandleIndex(allCandles, effectiveStartTime);
      if (startIdx < 0) startIdx = 0;
      if (startIdx >= allCandles.length) startIdx = allCandles.length - 1;

      let currentIdx = startIdx;
      if (effectiveCurrentTime !== null) {
        currentIdx = findNearestCandleIndex(allCandles, effectiveCurrentTime);
        if (currentIdx < 0) currentIdx = 0;
        if (currentIdx >= allCandles.length) currentIdx = allCandles.length - 1;
      }

      try {
        const engine = new ReplayEngine();
        engine.initialize({
          symbolId,
          symbol,
          timeframe,
          allCandles,
          replayStartIndex: startIdx,
        });

        engine.setCurrentIndex(currentIdx);

        engineRef.current = engine;
        speedRef.current = persistedSession?.speed ?? 1;

        const resolvedStartTime = allCandles[startIdx]?.time ?? effectiveStartTime;
        const resolvedCurrentTime = allCandles[currentIdx]?.time ?? effectiveCurrentTime ?? resolvedStartTime;
        restoredStartTimeRef.current = resolvedStartTime;
        restoredCurrentTimeRef.current = resolvedCurrentTime;
        lastForwardedTimeRef.current = resolvedCurrentTime;

        tradingEngine.snapshotManager.initialize(startIdx);
        tradingEngine.snapshotManager.saveSnapshot(currentIdx);

        const currentCandle = allCandles[currentIdx];
        if (currentCandle) {
          forwardCandleToTradingEngine(currentCandle);
        }

        if (REPLAY_DEBUG) {
          console.log('[FORENSIC-REPLAY-INIT-STATE]', {
            startIdx,
            currentIdx,
            resolvedStartTime,
            resolvedCurrentTime,
            resolvedStartTimeISO: new Date(resolvedStartTime * 1000).toISOString(),
            resolvedCurrentTimeISO: new Date(resolvedCurrentTime * 1000).toISOString(),
            positionsCount: tradingEngine.getOpenPositions().length,
            historyCount: tradingEngine.getTradeHistory().length,
          });
        }

        const base = engine.getReplayState();
        setReplayState({
          ...base,
          replaySelectionMode: false,
          replayStartIndex: startIdx,
          currentReplayTime: resolvedCurrentTime,
          startDate: activeSession?.startDate ?? persistedSession?.startDate,
          bufferDays: persistedSession?.bufferDays,
        });
      } catch (err) {
        console.error('Failed to initialize replay engine:', err);
        setReplayState(INITIAL_REPLAY_STATE);
      }
    } else {
      setReplayState(INITIAL_REPLAY_STATE);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    symbolId,
    symbol,
    timeframe,
    allCandlesCount,
    firstCandleTime,
    lastCandleTime,
    clearTimer,
    sessionReady,
    activeSession?.id,
  ]);

  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Persist replay session settings & SQLite activeSession sync ──
  useEffect(() => {
    if (!sessionReady || !engineRef.current?.isInitialized()) return;
    if (!replayState.isReplayMode) {
      if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
      void setSetting('replay:startTime', '');
      void setSetting('replay:currentTime', '');
      return;
    }
    const effectivePersistTime = replayState.currentReplayTime ?? restoredCurrentTimeRef.current;
    const effectiveStartTime = replayState.replayStartTime ?? restoredStartTimeRef.current;

    const doPersist = () => {
      if (effectiveStartTime !== null) {
        void setSetting('replay:startTime', String(effectiveStartTime));
      }
      if (effectivePersistTime !== null) {
        void setSetting('replay:currentTime', String(effectivePersistTime));
      }

      if (activeSession?.id && onUpdateSessionState) {
        onUpdateSessionState({
          currentReplayIndex: replayState.currentReplayIndex,
          currentReplayTime: effectivePersistTime,
          replayStartTime: effectiveStartTime,
          updatedAt: Date.now(),
        });
      }
    };

    // If currently playing, debounce persistence so disk I/O and root context re-renders don't choke the playback loop
    if (replayState.status === 'playing') {
      if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
      persistTimeoutRef.current = setTimeout(doPersist, 1500);
      return () => {
        if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
      };
    } else {
      // When paused, stopped, or user seeks, persist immediately!
      if (persistTimeoutRef.current) {
        clearTimeout(persistTimeoutRef.current);
        persistTimeoutRef.current = null;
      }
      doPersist();
    }
  }, [
    replayState.replayStartTime,
    replayState.currentReplayTime,
    replayState.currentReplayIndex,
    replayState.isReplayMode,
    replayState.status,
    sessionReady,
    activeSession?.id,
    onUpdateSessionState,
  ]);

  // ── Start playback loop (recursive setTimeout) ──
  const startTimer = useCallback(() => {
    const tick = () => {
      const hasMore = stepForward();
      syncState();
      if (hasMore) {
        const interval = Math.max(16, Math.round(DEFAULT_INTERVAL_MS / speedRef.current));
        timerRef.current = setTimeout(tick, interval);
      } else {
        // If prefetch is in flight, or more future data exists, wait seamlessly without pausing!
        if (loadingMoreFutureRef.current || !noMoreFutureDataRef.current) {
          timerRef.current = setTimeout(tick, 100);
          return;
        }
        timerRef.current = null;
        tradingEngine.replayAdapter.onReplayPaused();
        syncState();
      }
    };
    const interval = Math.max(16, Math.round(DEFAULT_INTERVAL_MS / speedRef.current));
    timerRef.current = setTimeout(tick, interval);
  }, [stepForward, syncState]);

  useEffect(() => {
    startTimerRef.current = startTimer;
  }, [startTimer]);

  const play = useCallback((speed: number = 1) => {
    let engine = engineRef.current;

    // Safety Auto-Recovery: if engine was somehow not initialized yet, initialize it on the fly
    if (!engine) {
      if (allCandles.length > 0 && symbolId && symbol && timeframe) {
        const targetCurrentTime = activeSession?.currentReplayTime ?? null;
        let startIdx = 0;
        let currentIdx = 0;
        if (targetCurrentTime) {
          currentIdx = findNearestCandleIndex(allCandles, targetCurrentTime);
          if (currentIdx < 0) currentIdx = 0;
          if (currentIdx >= allCandles.length) currentIdx = allCandles.length - 1;
        }
        engine = new ReplayEngine();
        engine.initialize({
          symbolId,
          symbol,
          timeframe,
          allCandles,
          replayStartIndex: startIdx,
        });
        engine.setCurrentIndex(currentIdx);
        engineRef.current = engine;
        tradingEngine.snapshotManager.initialize(startIdx);
        tradingEngine.snapshotManager.saveSnapshot(currentIdx);
        syncState();
      } else {
        if (REPLAY_DEBUG) {
          console.warn('[REPLAY-PLAY-BLOCKED] Cannot play: allCandles empty or symbolId missing', {
            allCandlesLength: allCandles.length,
            symbolId,
            symbol,
            timeframe,
            sessionReady,
          });
        }
        return;
      }
    }

    if (timerRef.current !== null) return;
    if (engine.isFinished() && noMoreFutureDataRef.current) return;

    if (engine.isFinished() && !noMoreFutureDataRef.current) {
      triggerPrefetchIfNeeded(engine.getCurrentIndex(), engine.getAllCandles());
    }

    const currentIdx = engine.getCurrentIndex();
    const startIdx = engine.getReplayState().replayStartIndex ?? currentIdx;
    const activeIdx = currentIdx !== null && currentIdx >= 0 ? currentIdx : (startIdx ?? 0);

    const openPositionsBefore = tradingEngine.getOpenPositions();
    if (REPLAY_DEBUG) {
      console.log('[REPLAY-BASELINE-BEFORE]', JSON.stringify({
        replayStartIndex: startIdx,
        activeIdx,
        openPositionsCount: openPositionsBefore.length,
        positionIds: openPositionsBefore.map((p) => p.positionId),
      }));
    }

    // Ensure baseline snapshot at activeIdx holds live TradingStore state before playback begins
    tradingEngine.snapshotManager.saveSnapshot(activeIdx);

    const savedSnap = tradingEngine.snapshotManager.getSnapshot(activeIdx);
    if (REPLAY_DEBUG) {
      console.log('[REPLAY-BASELINE-CAPTURE]', JSON.stringify({
        snapshotId: `snap-${activeIdx}`,
        replayStartIndex: activeIdx,
        openPositionsCount: savedSnap?.schema?.positions ? savedSnap.schema.positions.length : 0,
        positionIds: savedSnap?.schema?.positions ? savedSnap.schema.positions.map((p) => p.positionId) : [],
      }));
    }

    tradingEngine.replayAdapter.onReplayStarted();
    speedRef.current = speed;
    engine.play();
    syncState();
    startTimer();
  }, [allCandles, symbolId, symbol, timeframe, sessionReady, syncState, startTimer]);

  const pause = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    clearTimer();
    engine.pause();
    tradingEngine.replayAdapter.onReplayPaused();
    syncState();
  }, [clearTimer, syncState]);


  const setSpeed = useCallback(
    (newSpeed: number) => {
      speedRef.current = newSpeed;
      if (timerRef.current !== null) {
        clearTimer();
        startTimer();
      }
      if (sessionReady) {
        void setSetting('replay:speed', String(newSpeed));
      }
    },
    [clearTimer, startTimer, sessionReady]
  );

  const nextCandle = useCallback((tf?: Timeframe | string) => {
    const engine = engineRef.current;
    if (!engine) return;
    if (timerRef.current !== null) {
      clearTimer();
      engine.pause();
    }
    if (engine.isFinished()) return;
    stepForward(tf ?? replayTimeframe);
    syncState();
  }, [replayTimeframe, stepForward, clearTimer, syncState]);

  const prevCandle = useCallback((tf?: Timeframe | string) => {
    const engine = engineRef.current;
    if (!engine) return;
    if (timerRef.current !== null) {
      clearTimer();
      engine.pause();
    }
    stepBackward(tf ?? replayTimeframe);
    syncState();
  }, [replayTimeframe, stepBackward, clearTimer, syncState]);

  const skipForward = useCallback(
    (count: number = 10) => {
      const engine = engineRef.current;
      if (!engine) return;
      if (timerRef.current !== null) {
        clearTimer();
        engine.pause();
      }
      for (let i = 0; i < count; i++) {
        if (engine.isFinished()) break;
        stepForward();
      }
      syncState();
    },
    [stepForward, clearTimer, syncState]
  );

  const startReplaySelection = useCallback(() => {
    if (!symbolId || !symbol || !timeframe || allCandles.length === 0) return;
    clearTimer();
    const engine = engineRef.current;
    if (engine && engine.getStatus() === 'playing') {
      engine.pause();
    }

    setReplayState((prev) => ({
      ...prev,
      replaySelectionMode: true,
      status: 'selecting',
    }));
  }, [symbolId, symbol, timeframe, allCandles.length, clearTimer]);

  const confirmReplayStartPoint = useCallback(
    (startIndex: number) => {
      if (!symbolId || !symbol || !timeframe || allCandles.length === 0) return;
      if (startIndex < 0 || startIndex >= allCandles.length) return;

      try {
        clearTimer();
        engineRef.current?.reset();

        const engine = new ReplayEngine();
        engine.initialize({
          symbolId,
          symbol,
          timeframe,
          allCandles,
          replayStartIndex: startIndex,
        });
        engineRef.current = engine;
        lastForwardedTimeRef.current = allCandles[startIndex]?.time ?? null;
        tradingEngine.replayAdapter.onReplayReset();
        tradingEngine.snapshotManager.initialize(startIndex);

        const startTime = allCandles[startIndex]?.time ?? null;
        restoredStartTimeRef.current = startTime;
        restoredCurrentTimeRef.current = startTime;

        const base = engine.getReplayState();
        setReplayState({
          ...base,
          replaySelectionMode: false,
          replayStartIndex: startIndex,
        });
      } catch (err) {
        console.error('Failed to confirm replay start point:', err);
        setReplayState(INITIAL_REPLAY_STATE);
      }
    },
    [symbolId, symbol, timeframe, allCandles, clearTimer]
  );

  const cancelReplaySelection = useCallback(() => {
    setReplayState((prev) => {
      const engine = engineRef.current;
      const restoredStatus = engine && engine.isInitialized() ? engine.getStatus() : 'idle';
      return {
        ...prev,
        replaySelectionMode: false,
        status: restoredStatus,
      };
    });
  }, []);

  const exitReplayMode = useCallback(() => {
    clearTimer();
    speedRef.current = 1;
    lastForwardedTimeRef.current = null;
    restoredCurrentTimeRef.current = null;
    restoredStartTimeRef.current = null;
    if (engineRef.current) {
      engineRef.current.reset();
      engineRef.current = null;
    }
    tradingEngine.replayAdapter.onReplayReset();
    tradingEngine.snapshotManager.clear();
    setReplayState(INITIAL_REPLAY_STATE);
    if (sessionReady) {
      void setSetting('replay:startTime', '');
      void setSetting('replay:currentTime', '');
      void setSetting('replay:speed', '1');
    }
  }, [clearTimer, sessionReady]);

  const seekToIndex = useCallback(
    (index: number) => {
      const engine = engineRef.current;
      if (!engine) return;
      const candles = engine.getAllCandles();
      if (index < 0 || index >= candles.length) return;

      if (timerRef.current !== null) {
        clearTimer();
        engine.pause();
      }

      try {
        engine.setCurrentIndex(index);
        if (tradingEngine.snapshotManager.hasSnapshot(index)) {
          tradingEngine.snapshotManager.restoreSnapshot(index);
        } else {
          // Find nearest available snapshot before index
          let startSearchIdx = index;
          while (startSearchIdx >= 0 && !tradingEngine.snapshotManager.hasSnapshot(startSearchIdx)) {
            startSearchIdx--;
          }
          if (startSearchIdx >= 0) {
            tradingEngine.snapshotManager.restoreSnapshot(startSearchIdx);
            for (let i = startSearchIdx + 1; i <= index; i++) {
              const c = candles[i];
              if (c) {
                forwardCandleToTradingEngine(c);
                tradingEngine.snapshotManager.saveSnapshot(i);
              }
            }
          } else {
            tradingEngine.snapshotManager.saveSnapshot(index);
          }
        }

        if (candles[index]) {
          lastForwardedTimeRef.current = candles[index].time;
          restoredCurrentTimeRef.current = candles[index].time;
        }
        syncState();
      } catch (err) {
        console.error('Failed to seek to index:', err);
      }
    },
    [clearTimer, forwardCandleToTradingEngine, syncState]
  );

  const seekToTimestamp = useCallback(
    (timestamp: number) => {
      const engine = engineRef.current;
      if (!engine || allCandles.length === 0) return;

      const idx = findNearestCandleIndex(allCandles, timestamp);
      if (idx >= 0 && idx < allCandles.length) {
        seekToIndex(idx);
      }
    },
    [allCandles, seekToIndex]
  );

  const resetReplay = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;

    clearTimer();
    const state = engine.getReplayState();
    const startIdx = state.replayStartIndex;
    if (startIdx !== null) {
      try {
        engine.setCurrentIndex(startIdx);
        const candles = engine.getAllCandles();
        if (candles[startIdx]) {
          lastForwardedTimeRef.current = candles[startIdx].time;
          restoredCurrentTimeRef.current = candles[startIdx].time;
        }
        tradingEngine.replayAdapter.onReplayReset();
        tradingEngine.snapshotManager.restoreSnapshot(startIdx);
      } catch (err) {
        console.error('Failed to reset replay:', err);
      }
    }
    syncState();
  }, [clearTimer, syncState]);

  const getDataView = useCallback(() => {
    return engineRef.current?.getDataView() ?? null;
  }, []);

  const getAllCandles = useCallback((): Candle[] => {
    if (engineRef.current && engineRef.current.isInitialized()) {
      return engineRef.current.getAllCandles();
    }
    return allCandles;
  }, [allCandles]);

  const getProgress = useCallback((): number => {
    return engineRef.current?.getProgressPercentage() ?? 0;
  }, []);

  const initializingRef = useRef(false);

  const createReplaySession = useCallback(
    async (startDateStr: string, bufferDaysCount: number, sessionTz: string) => {
      if (initializingRef.current) return;
      initializingRef.current = true;
      if (!symbolId || !symbol || !timeframe) {
        initializingRef.current = false;
        throw new Error('Symbol dan Timeframe harus dipilih terlebih dahulu');
      }


      const cleanBufferDays = Math.max(0, Math.floor(Number(bufferDaysCount) || 0));
      const bufferDateStr = subtractCalendarDays(startDateStr, cleanBufferDays);
      const bufferStartUtcSec = localDateToUtcSeconds(bufferDateStr, sessionTz);
      const startUtcSec = localDateToUtcSeconds(startDateStr, sessionTz);

      const sessionCandles = await getCandlesFrom(symbolId, timeframe, bufferStartUtcSec);
      if (!sessionCandles || sessionCandles.length === 0) {
        throw new Error(`Tidak ada data candle untuk ${symbol} (${timeframe}) mulai tanggal ${bufferDateStr}`);
      }

      const startIndex = findFirstCandleIndexOnOrAfter(sessionCandles, startUtcSec);
      if (startIndex < 0 || startIndex >= sessionCandles.length) {
        throw new Error(`Tanggal Start Date (${startDateStr}) di luar jangkauan data`);
      }

      try {
        clearTimer();
        if (engineRef.current) {
          engineRef.current.reset();
          engineRef.current = null;
        }

        // 1. Update shared in-memory symbol timeframe cache for all active chart panes
        const symbolCache = getSymbolCache(symbolId);
        symbolCache.clear();
        symbolCache.set('M1', sessionCandles);
        notifySymbolCacheUpdated(symbolId);

        const engine = new ReplayEngine();
        engine.initialize({
          symbolId,
          symbol,
          timeframe,
          allCandles: sessionCandles,
          replayStartIndex: startIndex,
        });
        engineRef.current = engine;
        const startTime = sessionCandles[startIndex]?.time ?? null;
        lastForwardedTimeRef.current = startTime;
        restoredStartTimeRef.current = startTime;
        restoredCurrentTimeRef.current = startTime;
        tradingEngine.replayAdapter.onReplayReset();
        tradingEngine.snapshotManager.initialize(startIndex);

        const base = engine.getReplayState();
        setReplayState({
          ...base,
          replaySelectionMode: false,
          replayStartIndex: startIndex,
          startDate: startDateStr,
          bufferDays: cleanBufferDays,
        });

        if (sessionReady) {
          void setSetting('replay:startDate', startDateStr);
          void setSetting('replay:bufferDays', String(cleanBufferDays));
          void setSetting('replay:startTime', String(sessionCandles[startIndex].time));
          void setSetting('replay:currentTime', String(sessionCandles[startIndex].time));
        }

        // Trigger chart view reset to center on the new replay start candle
        window.dispatchEvent(new CustomEvent('reset-active-chart'));
      } catch (err) {
        console.error('Failed to create replay session:', err);
        setReplayState(INITIAL_REPLAY_STATE);
        throw err;
      } finally {
        initializingRef.current = false;
      }
    },

    [symbolId, symbol, timeframe, clearTimer, sessionReady]
  );

  useEffect(() => {
    return () => {
      clearTimer();
      engineRef.current?.reset();
      engineRef.current = null;
    };
  }, [clearTimer]);

  return {
    masterCandles: allCandles,
    sessionCandles: allCandles,


    currentIndex: replayState.currentReplayIndex ?? 0,
    isPlaying: replayState.status === 'playing',
    speed: speedRef.current,
    replayState,
    startReplaySelection,
    confirmReplayStartPoint,
    cancelReplaySelection,
    exitReplayMode,
    createReplaySession,
    play,
    pause,
    setSpeed,
    nextCandle,
    prevCandle,
    skipForward,
    seekToIndex,
    seekToTimestamp,
    resetReplay,
    getDataView,
    getAllCandles,
    getProgress,
    sessionReady,
    isInitialized: engineRef.current?.isInitialized() ?? false,
    replayTimeframe,
    autoFollow,
    setReplayTimeframe,
    setAutoFollow,
    toggleAutoFollow,
  };
}
