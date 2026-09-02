import { useCallback, useEffect, useRef, useState } from 'react';
import type { Candle, Timeframe } from '@/types';
import { getCandles, getCandlesBefore, getCandlesRange } from './api';
import { PAGE_CANDLE_BATCH } from './viewport';
import { profiler } from '@/utils/profiler';
import { resampleCandles, clearResampleCache } from '@/utils/dataResampler';
import type { AnalyticsSession } from '../analytics/types';
import { REPLAY_DEBUG } from '@/config/debug';

const EMPTY_CANDLES: Candle[] = [];

// Sliding window memory budget for active viewport (RAM bound ~300 MB)
const TARGET_WINDOW_M1_CANDLES = 40000;
const MAX_WINDOW_M1_CANDLES = 55000;

// Global shared in-memory timeframe cache per symbol: symbolId -> (timeframe -> Candle[])
// Guarantees all instances of useCandles (AppShell, PaneContainer, ReplayEngine) share the same underlying data.
const globalSymbolTimeframeCache = new Map<number, Map<string, Candle[]>>();

type CacheListener = () => void;
const cacheListeners = new Map<number, Set<CacheListener>>();

export function subscribeSymbolCache(symbolId: number, listener: CacheListener): () => void {
  let set = cacheListeners.get(symbolId);
  if (!set) {
    set = new Set();
    cacheListeners.set(symbolId, set);
  }
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0) cacheListeners.delete(symbolId);
  };
}

export function notifySymbolCacheUpdated(symbolId: number) {
  const set = cacheListeners.get(symbolId);
  if (set) {
    for (const listener of set) {
      listener();
    }
  }
}

// In-flight M1 query promise deduplication to prevent duplicate parallel IPC/database fetches
const inFlightM1Promises = new Map<number, Promise<Candle[]>>();

export function getSymbolCache(symbolId: number): Map<string, Candle[]> {
  let cache = globalSymbolTimeframeCache.get(symbolId);
  if (!cache) {
    cache = new Map<string, Candle[]>();
    globalSymbolTimeframeCache.set(symbolId, cache);
  }
  return cache;
}

export function clearSymbolTimeframeCache(symbolId?: number) {
  clearResampleCache();
  if (symbolId !== undefined) {
    globalSymbolTimeframeCache.delete(symbolId);
    inFlightM1Promises.delete(symbolId);
  } else {
    globalSymbolTimeframeCache.clear();
    inFlightM1Promises.clear();
  }
}

/**
 * Loads and caches base candles for one (symbol, timeframe) pair using an M1-base Timeframe Cache.
 *
 * Implements Bidirectional Dynamic Windowing:
 * - When panning left (past): loads older candles and trims off-screen right-side candles.
 * - When panning right (future/replay): loads forward candles and trims off-screen left-side candles.
 * - Maintains bounded RAM footprint (~300 MB) during continuous replay and panning.
 */
export function useCandles(
  symbolId: number | null,
  timeframe: Timeframe,
  activeSession?: AnalyticsSession | null
) {
  const [candles, setCandles] = useState<Candle[]>(EMPTY_CANDLES);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreBefore, setHasMoreBefore] = useState(false);
  const [hasMoreAfter, setHasMoreAfter] = useState(false);
  const [resetToken, setResetToken] = useState(0);

  // Indices (NAS100, US30, SPX500, GER40, etc) start their daily session at 18:00 NY time (1 hour after forex 17:00 NY close)
  const isIndex = activeSession?.symbol && /100|30|500|SPX|NAS|US30|GER|DJI/i.test(activeSession.symbol);
  const anchorOffset = isIndex ? 3600 : 0;

  const symbolIdRef = useRef(symbolId);
  const timeframeRef = useRef(timeframe);
  const hasMoreBeforeRef = useRef(false);
  const hasMoreAfterRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const earliestTimeRef = useRef<number | null>(null);
  const latestTimeRef = useRef<number | null>(null);
  const maxAvailableFutureUtcRef = useRef<number | null>(null);

  useEffect(() => {
    symbolIdRef.current = symbolId;
    timeframeRef.current = timeframe;
  }, [symbolId, timeframe]);

  useEffect(() => {
    hasMoreBeforeRef.current = hasMoreBefore;
  }, [hasMoreBefore]);

  useEffect(() => {
    hasMoreAfterRef.current = hasMoreAfter;
  }, [hasMoreAfter]);

  useEffect(() => {
    earliestTimeRef.current = candles.length > 0 ? candles[0].time : null;
    latestTimeRef.current = candles.length > 0 ? candles[candles.length - 1].time : null;
  }, [candles]);

  const prevSessionIdRef = useRef(activeSession?.id);
  const loadingMoreFutureRef = useRef(false);
  const noMoreFutureDataRef = useRef(false);
  const loadedUntilUtcRef = useRef<number | null>(null);

  // Clear symbol cache ONLY when activeSession.id actually changes in an effect
  useEffect(() => {
    if (prevSessionIdRef.current !== activeSession?.id) {
      prevSessionIdRef.current = activeSession?.id;
      clearSymbolTimeframeCache();
      loadedUntilUtcRef.current = null;
      maxAvailableFutureUtcRef.current = null;
      noMoreFutureDataRef.current = false;
      loadingMoreFutureRef.current = false;
      setHasMoreBefore(false);
      setHasMoreAfter(false);
    }
  }, [activeSession?.id]);

  // Handle manual 1-click 'refresh-chart-lag' (flushes old memory buffers and re-anchors to current replay time)
  useEffect(() => {
    const handleRefreshLag = () => {
      clearSymbolTimeframeCache();
      void window.forexReplay?.trimMemory?.();
      loadedUntilUtcRef.current = null;
      maxAvailableFutureUtcRef.current = null;
      noMoreFutureDataRef.current = false;
      loadingMoreFutureRef.current = false;
      setHasMoreBefore(false);
      setHasMoreAfter(false);
      setResetToken((t) => t + 1);
    };
    window.addEventListener('refresh-chart-lag', handleRefreshLag);
    return () => window.removeEventListener('refresh-chart-lag', handleRefreshLag);
  }, []);

  const requestVersionRef = useRef(0);

  // Subscribe to external streaming prefetch chunk additions (e.g. from useReplayEngine)
  useEffect(() => {
    if (symbolId === null) return;

    return subscribeSymbolCache(symbolId, () => {
      const symbolCache = getSymbolCache(symbolId);
      const m1Candles = symbolCache.get('M1');
      if (!m1Candles || m1Candles.length === 0) return;

      if (timeframe === 'M1') {
        setCandles((prev) => {
          if (prev.length === m1Candles.length) return prev;
          return m1Candles;
        });
      } else {
        const cachedTf = symbolCache.get(timeframe);
        const resampled = cachedTf ?? resampleCandles(m1Candles, timeframe, anchorOffset);
        symbolCache.set(timeframe, resampled);
        setCandles((prev) => {
          if (prev.length === resampled.length) return prev;
          return resampled;
        });
      }
    });
  }, [symbolId, timeframe]);

  // Load / Resample / Cache effect ONLY whenever symbol, timeframe, or activeSession changes
  useEffect(() => {
    if (symbolId === null) {
      setCandles(EMPTY_CANDLES);
      setHasMoreBefore(false);
      setHasMoreAfter(false);
      setResetToken((t) => t + 1);
      return;
    }

    const requestedTf = timeframe;
    const requestId = ++requestVersionRef.current;
    const symbolCache = getSymbolCache(symbolId);

    // Helper to update candles state with raw timeframe candles
    const updateDataset = (rawTfCandles: Candle[]) => {
      if (requestId !== requestVersionRef.current) return;
      setCandles(rawTfCandles);
      setHasMoreBefore(rawTfCandles.length > 0);
      setResetToken((t) => t + 1);
    };

    // 1. Target Timeframe CACHE HIT
    if (symbolCache.has(requestedTf)) {
      const rawTfCandles = symbolCache.get(requestedTf)!;
      profiler.recordDbQuery(0);
      profiler.recordResample(0, rawTfCandles.length, rawTfCandles.length);
      if (rawTfCandles.length > 0 && loadedUntilUtcRef.current === null) {
        loadedUntilUtcRef.current = rawTfCandles[rawTfCandles.length - 1].time;
      }
      updateDataset(rawTfCandles);
      setLoading(false);
      return;
    }

    // 2. Base M1 CACHE HIT (target timeframe missing -> resample from existing M1)
    if (symbolCache.has('M1') && requestedTf !== 'M1') {
      const m1Candles = symbolCache.get('M1')!;
      const t0_res = performance.now();
      const rawTfCandles = resampleCandles(m1Candles, requestedTf, anchorOffset);
      const resMs = performance.now() - t0_res;
      profiler.recordResample(resMs, m1Candles.length, rawTfCandles.length);
      symbolCache.set(requestedTf, rawTfCandles);
      if (m1Candles.length > 0 && loadedUntilUtcRef.current === null) {
        loadedUntilUtcRef.current = m1Candles[m1Candles.length - 1].time;
      }
      updateDataset(rawTfCandles);
      setLoading(false);
      return;
    }

    // 3. CACHE MISS for both M1 and target timeframe: fetch Start-Date Prefetch range from SQLite
    let cancelled = false;
    setLoading(true);

    const getOrFetchM1 = async (): Promise<Candle[]> => {
      if (symbolCache.has('M1')) {
        return symbolCache.get('M1')!;
      }

      if (inFlightM1Promises.has(symbolId)) {
        return inFlightM1Promises.get(symbolId)!;
      }

      const fetchPromise = (async () => {
        const t0 = performance.now();
        let m1Candles: Candle[] = [];

        // ── Initial Rolling Buffer (30 days historical context + 30 days forward replay) ──
        let sessionStartUtc: number | null = null;
        if (activeSession?.startDate) {
          if (typeof activeSession.startDate === 'number') {
            sessionStartUtc = activeSession.startDate;
          } else if (!isNaN(Number(activeSession.startDate)) && Number(activeSession.startDate) > 100000000) {
            sessionStartUtc = Number(activeSession.startDate);
          } else {
            const startDateStr = activeSession.startDate.includes('T') ? activeSession.startDate : `${activeSession.startDate}T00:00:00Z`;
            const t = Math.floor(new Date(startDateStr).getTime() / 1000);
            if (!isNaN(t) && t > 0) sessionStartUtc = t;
          }
        }

        const defaultAnchorUtc = sessionStartUtc ?? null;
        const anchorUtc = activeSession?.currentReplayTime ?? activeSession?.replayStartTime ?? defaultAnchorUtc;

        if (anchorUtc !== null && anchorUtc > 0) {
          // Always load 30 days of historical context before anchor point, and 30 days after for playback
          const chunkStartUtc = Math.max(0, anchorUtc - 30 * 86400);
          const chunkEndUtc = anchorUtc + 30 * 86400;

          m1Candles = (await getCandlesRange(symbolId, 'M1', chunkStartUtc, chunkEndUtc)) as Candle[];
          if (m1Candles.length === 0) {
            m1Candles = (await getCandlesRange(symbolId, requestedTf, chunkStartUtc, chunkEndUtc)) as Candle[];
          }
          loadedUntilUtcRef.current = chunkEndUtc;
          maxAvailableFutureUtcRef.current = chunkEndUtc;
        }

        // Fallback if no session range specified or range query returned empty
        if (m1Candles.length === 0) {
          m1Candles = (await getCandles(symbolId, 'M1', 10000)) as Candle[];
          if (m1Candles.length === 0) {
            m1Candles = (await getCandles(symbolId, requestedTf, 10000)) as Candle[];
          }
          if (m1Candles.length > 0) {
            const lastTime = m1Candles[m1Candles.length - 1].time;
            loadedUntilUtcRef.current = lastTime;
            maxAvailableFutureUtcRef.current = lastTime;
          }
        }

        const dbMs = performance.now() - t0;
        profiler.recordDbQuery(dbMs);

        symbolCache.set('M1', m1Candles);
        return m1Candles;
      })();

      inFlightM1Promises.set(symbolId, fetchPromise);
      fetchPromise.finally(() => {
        inFlightM1Promises.delete(symbolId);
      });

      return fetchPromise;
    };

    getOrFetchM1()
      .then((m1Candles) => {
        if (cancelled || requestId !== requestVersionRef.current) return;

        let rawTfCandles: Candle[];
        if (requestedTf === 'M1') {
          rawTfCandles = m1Candles;
        } else {
          const t0_res = performance.now();
          const cachedTf = symbolCache.get(requestedTf);
          rawTfCandles = cachedTf ?? resampleCandles(m1Candles, requestedTf, anchorOffset);
          const resMs = performance.now() - t0_res;
          profiler.recordResample(resMs, m1Candles.length, rawTfCandles.length);
        }

        // Cache raw timeframe dataset (UNFILTERED)
        symbolCache.set(requestedTf, rawTfCandles);

        // Update React state with unfiltered dataset
        updateDataset(rawTfCandles);
      })
      .catch((err) => {
        console.error('Error loading candles:', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [symbolId, timeframe, activeSession?.id, anchorOffset]);

  /**
   * Backward Dynamic Loading (Pan Kiri / Past):
   * Loads older candles from SQLite when panning left and prepends them seamlessly.
   */
  const loadMoreBefore = useCallback(() => {
    const sid = symbolIdRef.current;
    const tf = timeframeRef.current;
    const before = earliestTimeRef.current;
    if (sid === null || before === null) return;
    if (loadingMoreRef.current || !hasMoreBeforeRef.current) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);

    const symbolCache = getSymbolCache(sid);

    const fetchOlder = async (): Promise<Candle[]> => {
      let older = (await getCandlesBefore(sid, 'M1', before, PAGE_CANDLE_BATCH)) as Candle[];
      if (older.length === 0 && tf !== 'M1') {
        older = (await getCandlesBefore(sid, tf, before, PAGE_CANDLE_BATCH)) as Candle[];
      }
      return older;
    };

    fetchOlder()
      .then((olderM1) => {
        if (sid !== symbolIdRef.current) return;
        if (!olderM1 || olderM1.length === 0) {
          hasMoreBeforeRef.current = false;
          setHasMoreBefore(false);
          return;
        }

        const currentM1 = symbolCache.get('M1') ?? [];
        const currentEarliest = currentM1.length > 0 ? currentM1[0].time : Infinity;
        const filteredOlder = (olderM1 as Candle[]).filter((c) => c.time < currentEarliest);
        if (filteredOlder.length === 0) {
          hasMoreBeforeRef.current = false;
          setHasMoreBefore(false);
          return;
        }

        const updatedM1 = [...filteredOlder, ...currentM1];
        symbolCache.set('M1', updatedM1);

        // Clear non-M1 caches so they will re-resample from updated M1 dataset
        clearResampleCache();
        for (const key of Array.from(symbolCache.keys())) {
          if (key !== 'M1') {
            symbolCache.delete(key);
          }
        }

        const activeTf = timeframeRef.current;
        const updatedTarget = activeTf === 'M1' ? updatedM1 : resampleCandles(updatedM1, activeTf, anchorOffset);
        symbolCache.set(activeTf, updatedTarget);

        setCandles(updatedTarget);
      })
      .finally(() => {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      });
  }, [anchorOffset]);

  /**
   * Forward Dynamic Loading (Pan Kanan / Future Replay Front):
   * Loads forward candles from SQLite when panning right and appends them seamlessly.
   */
  const loadMoreAfter = useCallback(() => {
    const sid = symbolIdRef.current;
    const tf = timeframeRef.current;
    const after = latestTimeRef.current;
    if (sid === null || after === null) return;
    if (loadingMoreRef.current || !hasMoreAfterRef.current) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);

    const symbolCache = getSymbolCache(sid);
    const nextEndUtc = after + 20 * 86400; // Next 20-day chunk

    getCandlesRange(sid, 'M1', after + 1, nextEndUtc)
      .then((newerM1: Candle[]) => {
        if (sid !== symbolIdRef.current) return;
        if (!newerM1 || newerM1.length === 0) {
          hasMoreAfterRef.current = false;
          setHasMoreAfter(false);
          return;
        }

        const currentM1 = symbolCache.get('M1') ?? [];
        const currentLatest = currentM1.length > 0 ? currentM1[currentM1.length - 1].time : -Infinity;
        const filteredNewer = (newerM1 as Candle[]).filter((c) => c.time > currentLatest);
        if (filteredNewer.length === 0) {
          hasMoreAfterRef.current = false;
          setHasMoreAfter(false);
          return;
        }

        const updatedM1 = [...currentM1, ...filteredNewer];
        symbolCache.set('M1', updatedM1);

        clearResampleCache();
        for (const key of Array.from(symbolCache.keys())) {
          if (key !== 'M1') {
            symbolCache.delete(key);
          }
        }

        const activeTf = timeframeRef.current;
        const updatedTarget = activeTf === 'M1' ? updatedM1 : resampleCandles(updatedM1, activeTf, anchorOffset);
        symbolCache.set(activeTf, updatedTarget);

        setCandles(updatedTarget);
        setResetToken((t) => t + 1);
      })
      .finally(() => {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      });
  }, [anchorOffset]);

  /**
   * Forward Playback Lazy Loading:
   * Dynamically loads future range from SQLite as replay playback advances forward.
   */
  const loadMoreFuture = useCallback(async (targetUtc?: number) => {
    const sid = symbolIdRef.current;
    const tf = timeframeRef.current;
    if (sid === null || loadingMoreFutureRef.current || noMoreFutureDataRef.current) return;

    const symbolCache = getSymbolCache(sid);
    const currentM1 = symbolCache.get('M1') ?? [];
    const loadedUntil = loadedUntilUtcRef.current ?? (currentM1.length > 0 ? currentM1[currentM1.length - 1].time : null);

    if (loadedUntil === null) return;

    loadingMoreFutureRef.current = true;
    const nextEndUtc = Math.max(loadedUntil + 30 * 86400, (targetUtc ?? loadedUntil) + 30 * 86400); // 30-day chunk ahead

    try {
      let [newTfCandles, newM1Candles] = await Promise.all([
        getCandlesRange(sid, tf, loadedUntil + 1, nextEndUtc) as Promise<Candle[]>,
        getCandlesRange(sid, 'M1', loadedUntil + 1, nextEndUtc) as Promise<Candle[]>,
      ]);

      if (newM1Candles.length === 0 && newTfCandles.length === 0) {
        noMoreFutureDataRef.current = true;
        return;
      }

      const effectiveNewM1 = newM1Candles.length > 0 ? newM1Candles : newTfCandles;
      const mergedM1 = mergeDeduplicateCandles(currentM1, effectiveNewM1);
      symbolCache.set('M1', mergedM1);

      clearResampleCache();
      for (const key of Array.from(symbolCache.keys())) {
        if (key !== 'M1') {
          symbolCache.delete(key);
        }
      }

      const activeTf = timeframeRef.current;
      const updatedTarget = activeTf === 'M1' ? mergedM1 : resampleCandles(mergedM1, activeTf, anchorOffset);
      symbolCache.set(activeTf, updatedTarget);

      setCandles(updatedTarget);
      loadedUntilUtcRef.current = nextEndUtc;
      maxAvailableFutureUtcRef.current = nextEndUtc;
      notifySymbolCacheUpdated(sid);
    } catch (err) {
      console.error('[ReplayDataLoader] Failed to lazy load future range:', err);
    } finally {
      loadingMoreFutureRef.current = false;
    }
  }, []);

  const symbolCache = symbolId !== null ? getSymbolCache(symbolId) : null;
  const m1Candles = symbolCache?.get('M1') ?? (timeframe === 'M1' ? candles : EMPTY_CANDLES);

  return {
    candles,
    m1Candles,
    loading,
    loadingMore,
    hasMoreBefore,
    hasMoreAfter,
    loadMoreBefore,
    loadMoreAfter,
    loadMoreFuture,
    resetToken,
  };
}

export function mergeDeduplicateCandles(existing: Candle[], incoming: Candle[]): Candle[] {
  if (incoming.length === 0) return existing;
  const seen = new Set(existing.map((c) => c.time));
  const cleanIncoming = incoming.filter((c) => !seen.has(c.time));
  if (cleanIncoming.length === 0) return existing;
  const merged = [...existing, ...cleanIncoming];
  merged.sort((a, b) => a.time - b.time);
  return merged;
}
