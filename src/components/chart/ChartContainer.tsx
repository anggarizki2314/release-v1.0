import { forwardRef, useEffect, useLayoutEffect, useImperativeHandle, useRef, useState, useCallback, useMemo } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
  LogicalRange,
  Range,
  Time,
  TickMarkType,
} from 'lightweight-charts';
import type { Candle, Timeframe } from '@/types';
import { useReplay } from '@features/replay';
import { useChartFilteredCandles } from '@features/replay/useChartFilter';
import { findNearestCandleIndex } from '@features/replay';

import { unixSecondsToDateString } from '@features/replay';
import { defaultRange, focusRange, calculateReplayViewport, PAN_LOAD_THRESHOLD, DEFAULT_VISIBLE_CANDLES } from '@features/chart/viewport';
import { getSetting, setSetting } from '@features/database';
import { formatTimestampInTimezone, formatTimestampWithDayInTimezone, formatTickMark, getUtcOffsetMinutes } from '@features/timezone';
import { useTheme, isDarkTheme } from '@features/appearance';
import type { ThemeObject } from '@features/appearance';
import { resampleCandles, timeframeToSeconds } from '@/utils/dataResampler';
import { findLastIdx } from '@features/chart';
import { resampleCandlesWorker } from '@/services/dataWorkerClient';
import { profiler } from '@/utils/profiler';
import { useWorkspace, crosshairBus } from '@features/workspace';
import { useIndicatorStore, calculateBottomIndicatorsHeight } from '@features/indicators';
import type { AnalyticsSession } from '@features/analytics/types';
import { FEATURE_FLAGS } from '@/config/featureFlags';
import { REPLAY_DEBUG } from '@/config/debug';
import './ChartContainer.css';

interface ChartContainerProps {
  paneId?: string;
  symbolId: number | null;
  symbolName?: string;
  timeframe: Timeframe;
  allCandles: Candle[];
  m1Candles?: Candle[];
  loadingMore: boolean;
  hasMoreBefore: boolean;
  hasMoreAfter?: boolean;
  loadMoreBefore: () => void;
  loadMoreAfter?: () => void;
  resetToken: number;
  /** IANA timezone identifier for display formatting. */
  timezone: string;
  activeSession?: AnalyticsSession | null;
}

export interface ChartContainerHandle {
  /**
   * Resets ONLY the chart viewport (horizontal zoom/pan AND vertical
   * price scale) — never touches candle data, the database, symbol
   * selection, or replay state.
   *
   * - No `focusTime`: shows the most recent DEFAULT_VISIBLE_CANDLES.
   * - With `focusTime`: centers the viewport on the candle nearest
   *   that timestamp, keeping some "before" context.
   */
  resetChartView: (focusTime?: number) => void;
  /** Expose chart and series refs for external use. */
  getChart: () => IChartApi | null;
  getSeries: () => ISeriesApi<'Candlestick'> | null;
}

/**
 * Thin wrapper around Lightweight Charts.
 *
 * Now accepts candle data as props and subscribes to chart click/crosshair
 * events for replay start point selection. Full dataset is always sent to the
 * chart; ReplayRenderer controls future-candle visibility via ghost candles.
 */

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return '255,255,255';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r},${g},${b}`;
}

/**
 * Advance or rewind time by N bars, skipping weekends (Saturday & Sunday pre-market) for Forex/Commodities.
 */
function addTradingInterval(baseTime: number, deltaBars: number, intervalSec: number, isCrypto: boolean = false): number {
  const roundedBars = Math.round(deltaBars);
  if (isCrypto || roundedBars === 0) return Math.round(baseTime + deltaBars * intervalSec);

  if (roundedBars > 0) {
    let t = baseTime;
    for (let i = 0; i < roundedBars; i++) {
      t += intervalSec;
      const d = new Date(t * 1000);
      const day = d.getUTCDay(); // 0=Sun, 6=Sat
      const hour = d.getUTCHours();
      // If Saturday (day 6) or Sunday before 21:00 UTC (day 0, hour < 21)
      if (day === 6 || (day === 0 && hour < 21)) {
        const daysToAdd = day === 6 ? 1 : 0;
        const targetSun = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + daysToAdd, 21, 0, 0));
        t = Math.floor(targetSun.getTime() / 1000);
      }
    }
    return t;
  } else {
    let t = baseTime;
    const count = Math.abs(roundedBars);
    for (let i = 0; i < count; i++) {
      t -= intervalSec;
      const d = new Date(t * 1000);
      const day = d.getUTCDay();
      const hour = d.getUTCHours();
      if (day === 6 || (day === 0 && hour < 21)) {
        const daysToSub = day === 0 ? 2 : 1;
        const targetFri = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysToSub, 21, 0, 0));
        t = Math.floor(targetFri.getTime() / 1000);
      }
    }
    return t;
  }
}

/**
 * Robust mapping from screen coordinate X on source chart to UTC timestamp.
 * Prioritizes 100% exact real candle timestamps from allCandles (database),
 * falling back to forex-aware trading intervals if beyond dataset boundaries.
 */
function getTimeFromCoordinate(
  chart: IChartApi,
  x: number,
  displayCandles: { time: number }[],
  timeframe: Timeframe | string,
  allCandles?: { time: number }[],
  isCrypto: boolean = false
): number | null {
  if (!chart || !displayCandles || displayCandles.length === 0) return null;
  const timeScale = chart.timeScale();

  try {
    const directTime = timeScale.coordinateToTime(x as any);
    if (directTime !== null && typeof directTime === 'number' && Number.isFinite(directTime) && directTime > 0) {
      return directTime;
    }
  } catch {}

  const logical = timeScale.coordinateToLogical(x as any);
  if (logical === null || typeof logical !== 'number' || !Number.isFinite(logical)) return null;

  const intervalSec = timeframeToSeconds(timeframe);
  const lastIdx = displayCandles.length - 1;
  const lastCandle = displayCandles[lastIdx];
  const firstCandle = displayCandles[0];

  if (logical >= lastIdx) {
    const deltaBars = Math.round(logical - lastIdx);
    // 1. Look up exact real candle timestamp from full dataset if in replay mode
    if (allCandles && allCandles.length > 0) {
      const idxInAll = allCandles.findIndex((c) => c.time === lastCandle.time);
      if (idxInAll !== -1) {
        const targetIdx = idxInAll + deltaBars;
        if (targetIdx >= 0 && targetIdx < allCandles.length) {
          return allCandles[targetIdx].time;
        }
      }
    }
    // 2. Fallback to market-aware interval calculation
    return addTradingInterval(lastCandle.time, deltaBars, intervalSec, isCrypto);
  } else if (logical <= 0) {
    const deltaBars = Math.round(logical);
    if (allCandles && allCandles.length > 0) {
      const idxInAll = allCandles.findIndex((c) => c.time === firstCandle.time);
      if (idxInAll !== -1) {
        const targetIdx = idxInAll + deltaBars;
        if (targetIdx >= 0 && targetIdx < allCandles.length) {
          return allCandles[targetIdx].time;
        }
      }
    }
    return addTradingInterval(firstCandle.time, deltaBars, intervalSec, isCrypto);
  } else {
    const floorIdx = Math.floor(logical);
    const ceilIdx = Math.min(lastIdx, floorIdx + 1);
    const frac = logical - floorIdx;
    const t1 = displayCandles[floorIdx].time;
    const t2 = displayCandles[ceilIdx].time;
    return Math.round(t1 + frac * (t2 - t1));
  }
}

/**
 * Robust mapping from UTC timestamp to screen coordinate X on target chart,
 * supporting both candle areas, weekend/holiday gaps, and future/past empty areas.
 */
function getCoordinateFromTime(
  chart: IChartApi,
  timestamp: number,
  candles: { time: number }[],
  timeframe: Timeframe | string
): number | null {
  if (!chart || timestamp === null || timestamp === undefined || !Number.isFinite(timestamp) || timestamp <= 0) {
    return null;
  }
  const timeScale = chart.timeScale();

  // 1. Direct time conversion
  try {
    const directX = timeScale.timeToCoordinate(timestamp as any);
    if (directX !== null && typeof directX === 'number' && Number.isFinite(directX)) {
      return directX;
    }
  } catch {}

  if (!candles || candles.length === 0) return null;

  const intervalSec = timeframeToSeconds(timeframe);
  const lastCandle = candles[candles.length - 1];
  const firstCandle = candles[0];

  // 2. Future empty area (timestamp > lastCandle.time)
  if (timestamp > lastCandle.time) {
    const deltaBars = (timestamp - lastCandle.time) / intervalSec;
    const projectedLogical = (candles.length - 1) + deltaBars;
    try {
      const x = timeScale.logicalToCoordinate(projectedLogical as any);
      if (x !== null && typeof x === 'number' && Number.isFinite(x)) return x;
    } catch {}
  }

  // 3. Past empty area (timestamp < firstCandle.time)
  if (timestamp < firstCandle.time) {
    const deltaBars = (firstCandle.time - timestamp) / intervalSec;
    const projectedLogical = 0 - deltaBars;
    try {
      const x = timeScale.logicalToCoordinate(projectedLogical as any);
      if (x !== null && typeof x === 'number' && Number.isFinite(x)) return x;
    } catch {}
  }

  // 4. In between candles (weekend / holiday / intraday gap)
  const leftIdx = findLastIdx(candles as Candle[], timestamp);
  if (leftIdx >= 0 && leftIdx < candles.length - 1) {
    const cLeft = candles[leftIdx];
    const cRight = candles[leftIdx + 1];
    try {
      const xLeft = timeScale.timeToCoordinate(cLeft.time as any);
      const xRight = timeScale.timeToCoordinate(cRight.time as any);
      if (xLeft !== null && xRight !== null && Number.isFinite(xLeft) && Number.isFinite(xRight)) {
        const ratio = (timestamp - cLeft.time) / (cRight.time - cLeft.time);
        return xLeft + ratio * (xRight - xLeft);
      }
      if (xLeft !== null && Number.isFinite(xLeft)) return xLeft;
      if (xRight !== null && Number.isFinite(xRight)) return xRight;
    } catch {}
  } else if (leftIdx >= 0) {
    try {
      const x = timeScale.timeToCoordinate(candles[leftIdx].time as any);
      if (x !== null && Number.isFinite(x)) return x;
    } catch {}
  }

  return null;
}

interface FutureTickMark {
  x: number;
  text: string;
  isDay: boolean;
}

function calculateFutureTickMarks(
  chart: IChartApi | null,
  displayCandles: { time: number }[],
  timeframe: string | Timeframe,
  timezone: string,
  chartWidth: number,
  allCandles?: { time: number }[],
  isCrypto: boolean = false
): FutureTickMark[] {
  if (!chart || !displayCandles || displayCandles.length === 0 || chartWidth <= 0) return [];
  const timeScale = chart.timeScale();
  const range = timeScale.getVisibleLogicalRange();
  const lastIdx = displayCandles.length - 1;
  if (!range || range.to <= lastIdx) return [];

  const lastCandle = displayCandles[lastIdx];
  const intervalSec = timeframeToSeconds(timeframe);
  const lastX = timeScale.logicalToCoordinate(lastIdx as any);
  const nextX = timeScale.logicalToCoordinate((lastIdx + 1) as any);
  if (lastX === null || nextX === null) return [];

  const barWidth = Math.max(1, Math.abs(nextX - lastX));
  const barsPerDay = Math.max(1, Math.round(86400 / intervalSec));
  const dayWidth = barsPerDay * barWidth;

  const ticks: FutureTickMark[] = [];
  const maxLogical = Math.min(range.to, lastIdx + 400);

  const idxInAll = allCandles && allCandles.length > 0 ? allCandles.findIndex((c) => c.time === lastCandle.time) : -1;

  // Match native chart:
  // If days are very crowded (dayWidth < 50px), step days so labels don't collide
  const dayStep = dayWidth < 50 ? Math.max(1, Math.ceil(55 / dayWidth)) : 1;
  // Only show intraday hours if zoomed in close enough (dayWidth > 250px) and timeframe <= 1H
  const showIntraDayHours = dayWidth > 250 && intervalSec <= 3600;
  let hourInterval = 24;
  if (showIntraDayHours) {
    if (dayWidth >= 1200) hourInterval = 1;
    else if (dayWidth >= 600) hourInterval = 2;
    else if (dayWidth >= 400) hourInterval = 4;
    else hourInterval = 6;
  }

  let dayCount = 0;
  let lastPlacedX = -999;

  // Track previous day using timezone offset
  const lastOffset = getUtcOffsetMinutes(timezone, lastCandle.time);
  let prevLocalDay = Math.floor((lastCandle.time + lastOffset * 60) / 86400);

  for (let logical = lastIdx + 1; logical <= maxLogical; logical++) {
    const x = timeScale.logicalToCoordinate(logical as any);
    if (x === null || x < 0) continue;
    if (x > chartWidth - 45) break;

    const deltaBars = Math.round(logical - lastIdx);
    let futureTime: number;

    // Use exact real candle timestamp from full dataset if available
    if (idxInAll !== -1 && allCandles && idxInAll + deltaBars < allCandles.length) {
      futureTime = allCandles[idxInAll + deltaBars].time;
    } else {
      futureTime = addTradingInterval(lastCandle.time, deltaBars, intervalSec, isCrypto);
    }

    const offsetMin = getUtcOffsetMinutes(timezone, futureTime);
    const localSec = futureTime + offsetMin * 60;
    const currLocalDay = Math.floor(localSec / 86400);
    const isNewDay = currLocalDay !== prevLocalDay;

    if (isNewDay) {
      prevLocalDay = currLocalDay;
      dayCount++;

      if (dayCount % dayStep === 0) {
        if (x - lastPlacedX >= 45) {
          ticks.push({
            x,
            text: formatTickMark(futureTime, timezone, 2),
            isDay: true,
          });
          lastPlacedX = x;
        }
      }
    } else if (showIntraDayHours) {
      const localHour = Math.floor((localSec % 86400) / 3600);
      const localMin = Math.floor((localSec % 3600) / 60);
      if (localMin === 0 && localHour % hourInterval === 0) {
        if (x - lastPlacedX >= 55) {
          ticks.push({
            x,
            text: formatTickMark(futureTime, timezone, 3),
            isDay: false,
          });
          lastPlacedX = x;
        }
      }
    }
  }

  return ticks;
}

function computeScaleMargins(bottomPanesHeight: number, totalHeight: number) {
  const timeScaleHeight = 26;
  if (bottomPanesHeight <= 0 || totalHeight <= 0) {
    return { top: 0.08, bottom: 0.10 };
  }
  const usableHeight = Math.max(80, totalHeight - bottomPanesHeight - timeScaleHeight);
  // 8% breathing room of usable height so candles never collide with the indicator pane
  const bottomOccupiedPx = bottomPanesHeight + timeScaleHeight + Math.round(usableHeight * 0.08);
  const bottomFraction = Math.min(0.85, Math.max(0.10, bottomOccupiedPx / totalHeight));
  return {
    top: 0.08,
    bottom: bottomFraction,
  };
}

const ChartContainer = forwardRef<ChartContainerHandle, ChartContainerProps>(
  (
    {
      paneId,
      symbolId,
      symbolName,
      timeframe,
      allCandles,
      m1Candles,
      loadingMore,
      hasMoreBefore,
      hasMoreAfter = false,
      loadMoreBefore,
      loadMoreAfter,
      resetToken,
      timezone,
      activeSession,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const chartDataRef = useRef<{ time: number }[]>([]);
    const lastSymbolTfKeyRef = useRef<string | null>(null);
    const prevResetTokenRef = useRef<number>(resetToken);
    const { theme } = useTheme();
    const isLight = !isDarkTheme(theme);
    const labelBg = theme.scale.price.background && theme.scale.price.background !== 'transparent'
      ? theme.scale.price.background
      : (isLight ? '#334155' : '#1e293b');
    const defaultTextColor = isLight ? '#334155' : '#d1d5db';
    const textColor = theme.scale.price.text && theme.scale.price.text !== '#838da0'
      ? theme.scale.price.text
      : defaultTextColor;
    const { indicators, dayeQuartersHeight, rsiHeight } = useIndicatorStore();
    const bottomIndicatorsHeight = useMemo(
      () => calculateBottomIndicatorsHeight(indicators, dayeQuartersHeight, rsiHeight, timeframe),
      [indicators, dayeQuartersHeight, rsiHeight, timeframe]
    );
    const bottomIndicatorsHeightRef = useRef(bottomIndicatorsHeight);
    bottomIndicatorsHeightRef.current = bottomIndicatorsHeight;

    const chartRenderCountRef = useRef(0);
    chartRenderCountRef.current += 1;

    const { replayState, sessionReady, replayStatus, confirmReplayStartPoint } = useReplay();
    const isDatasetReady = allCandles && allCandles.length > 0;

    // Projected Future Time Scale Ticks & Crosshair Future Badge
    const [futureHover, setFutureHover] = useState<{ x: number; label: string } | null>(null);
    const [futureTicks, setFutureTicks] = useState<FutureTickMark[]>([]);

    const updateFutureTicks = useCallback(() => {
      const container = containerRef.current;
      const chart = chartRef.current;
      if (!container || !chart) return;
      const symStr = String(symbolName || symbolId || '');
      const isCrypto = /btc|eth|sol|xrp|crypto/i.test(symStr);
      const ticks = calculateFutureTickMarks(
        chart,
        chartDataRef.current,
        timeframeRef.current,
        timezoneRef.current,
        container.clientWidth,
        allCandlesRef.current,
        isCrypto
      );
      setFutureTicks(ticks);
    }, [symbolName, symbolId]);

    // Multi-layout Synchronized Vertical Cursor Shadow (Direct DOM ref for 0ms latency & 0 React re-renders)
    const shadowRef = useRef<HTMLDivElement | null>(null);
    const currentShadowTimestampRef = useRef<number | null>(null);

    const updateShadowCoordinate = useCallback((timestamp: number | null) => {
      currentShadowTimestampRef.current = timestamp;
      const el = shadowRef.current;
      if (!el) return;

      if (timestamp === null || timestamp === undefined || !Number.isFinite(timestamp) || timestamp <= 0) {
        el.style.display = 'none';
        return;
      }
      const chart = chartRef.current;
      if (!chart) {
        el.style.display = 'none';
        return;
      }

      const candles = chartDataRef.current;
      const tf = timeframeRef.current;
      const x = getCoordinateFromTime(chart, timestamp, candles, tf);
      const containerEl = containerRef.current;
      const width = containerEl ? containerEl.clientWidth : 0;

      if (x !== null && typeof x === 'number' && Number.isFinite(x) && x >= 0 && (width === 0 || x <= width)) {
        el.style.left = `${Math.round(x)}px`;
        el.style.display = 'block';
      } else {
        el.style.display = 'none';
      }
    }, []);

    const detachAutoFollow = useCallback((reason: string) => {
      if (autoFollowRef.current) {
        autoFollowRef.current = false;
        lastProgrammaticRangeRef.current = null;
        if (REPLAY_DEBUG) {
          console.log('[VP-DETACH]', { reason, replayTime: replayStateRef.current.currentReplayTime });
        }
      }
    }, []);



    if (REPLAY_DEBUG) {
      console.log(`[REACT LIFECYCLE] ChartContainer render #${chartRenderCountRef.current}`, {
        paneId: paneId || 'pane-0',
        sessionReady,
        isDatasetReady,
        replayStatus: replayStatus ?? replayState.status,
        allCandlesCount: allCandles.length,
        isMounted: true,
      });
    }

    useEffect(() => {
      console.log(`[REACT LIFECYCLE] ChartContainer MOUNTED (paneId: ${paneId || 'pane-0'})`);
      return () => {
        console.log(`[REACT LIFECYCLE] ChartContainer UNMOUNTING (paneId: ${paneId || 'pane-0'})`);
        console.trace(`[REACT LIFECYCLE STACK] ChartContainer unmounted from:`);
      };
    }, [paneId]);

    // Preview timestamp — only tracked in selection mode.
    const [previewTime, setPreviewTime] = useState<number | null>(null);

    // Workspace & Crosshair sync state refs.
    const { workspace } = useWorkspace();
    const workspaceRef = useRef(workspace);
    useEffect(() => { workspaceRef.current = workspace; }, [workspace]);

    const currentPaneId = paneId || 'pane-0';
    const paneIdRef = useRef(currentPaneId);
    useEffect(() => { paneIdRef.current = currentPaneId; }, [currentPaneId]);

    const symbolIdRef = useRef(symbolId);
    useEffect(() => { symbolIdRef.current = symbolId; }, [symbolId]);

    const timeframeRef = useRef(timeframe);
    useEffect(() => { timeframeRef.current = timeframe; }, [timeframe]);

    const activeSourcePaneRef = useRef<string | null>(null);

    // Refs for event handlers (set up once, must read current values).
    const replayStateRef = useRef(replayState);
    replayStateRef.current = replayState;
    const allCandlesRef = useRef(allCandles);
    allCandlesRef.current = allCandles;
    const confirmRef = useRef(confirmReplayStartPoint);
    confirmRef.current = confirmReplayStartPoint;

    // Pagination refs (mirrors for the chart event handler).
    const hasMoreBeforeRef = useRef(hasMoreBefore);
    hasMoreBeforeRef.current = hasMoreBefore;
    const hasMoreAfterRef = useRef(hasMoreAfter);
    hasMoreAfterRef.current = hasMoreAfter;
    const loadingMoreRef = useRef(loadingMore);
    loadingMoreRef.current = loadingMore;
    const loadMoreBeforeRef = useRef(loadMoreBefore);
    loadMoreBeforeRef.current = loadMoreBefore;
    const loadMoreAfterRef = useRef(loadMoreAfter);
    loadMoreAfterRef.current = loadMoreAfter;

    // Track last preview time to avoid unnecessary re-renders.
    const lastPreviewTimeRef = useRef<number | null>(null);

    // Day 14: Viewport persistence — save/restore visible time range.
    const viewportSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const symbolTimeframeKey = `${symbolId}:${timeframe}`;
    // Tracks the viewport that should survive setData() resets.
    const targetViewportRef = useRef<{ from: number; to: number } | null>(null);

    // Auto Follow & User Pan Detection Refs (Forensic Chart Viewport Architecture)
    const autoFollowRef = useRef<boolean>(true);
    const isUserViewportInteractionRef = useRef<boolean>(false);
    const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);
    const prevLogicalRangeRef = useRef<{ from: number; to: number } | null>(null);
    const lastProgrammaticRangeRef = useRef<{ from: number; to: number } | null>(null);

    const setProgrammaticLogicalRange = (
      chart: IChartApi,
      range: { from: number; to: number },
      origin: string = 'PROGRAMMATIC'
    ) => {
      lastProgrammaticRangeRef.current = range;
      if (REPLAY_DEBUG) {
        console.log('[VP-PROGRAMMATIC-WRITE]', {
          origin,
          from: range.from,
          to: range.to,
          currentReplayTime: replayStateRef.current.currentReplayTime,
          autoFollow: autoFollowRef.current,
        });
      }
      chart.timeScale().setVisibleLogicalRange(range as any);
    };

    // Day 15: Timezone ref for tickMarkFormatter (reads latest timezone without chart recreation).
    const timezoneRef = useRef(timezone);
    useEffect(() => { timezoneRef.current = timezone; }, [timezone]);

    // Mapping Cache: keyed by (replayIndex, length) in replay mode, by (length) in normal mode
    const mappedCacheRef = useRef<Map<string, any[]>>(new Map());

    const prevSymbolIdRef = useRef(symbolId);
    useEffect(() => {
      if (prevSymbolIdRef.current !== symbolId) {
        prevSymbolIdRef.current = symbolId;
        mappedCacheRef.current.clear();
      }
    }, [symbolId]);

    // Track previous replay index for step delta detection (reveal vs hide vs reset)
    const prevReplayIndexRef = useRef<number | null>(null);

    // Filter candles for display: in replay mode, only show candles up to
    // currentReplayTime. Use activeSession as authoritative fallback during cold resume hydration.
    const effectiveReplayTime =
      replayState.currentReplayTime ??
      activeSession?.currentReplayTime ??
      null;

    const effectiveIsReplayMode =
      replayState.isReplayMode ||
      effectiveReplayTime !== null;

    const displayCandles = useChartFilteredCandles(
      allCandles,
      effectiveIsReplayMode,
      effectiveReplayTime,
      timeframe,
      m1Candles
    );


    // Day 14: Save viewport to app_settings (debounced).
    const saveViewport = (chart: IChartApi, data: { time: number }[]) => {
      if (viewportSaveTimerRef.current) {
        clearTimeout(viewportSaveTimerRef.current);
      }
      viewportSaveTimerRef.current = setTimeout(() => {
        const range = chart.timeScale().getVisibleRange();
        if (!range || data.length === 0) return;
        const fromIdx = Math.max(0, Math.floor(range.from as number));
        const toIdx = Math.min(data.length - 1, Math.ceil(range.to as number));
        const fromTime = data[fromIdx]?.time;
        const toTime = data[toIdx]?.time;
        if (fromTime && toTime && fromTime < toTime) {
          const key = `chart:viewport:${symbolTimeframeKey}`;
          void setSetting(key, `${fromTime}:${toTime}`);
        }
      }, 500);
    };

    // Day 14: Restore viewport from app_settings.
    const restoreViewport = async (
      chart: IChartApi,
      data: { time: number }[]
    ): Promise<boolean> => {
      if (data.length === 0 || replayStateRef.current.isReplayMode || effectiveIsReplayMode) return false;
      const key = `chart:viewport:${symbolTimeframeKey}`;
      const saved = await getSetting(key);
      if (!saved || replayStateRef.current.isReplayMode || effectiveIsReplayMode) return false;
      const parts = saved.split(':');
      if (parts.length !== 2) return false;
      const fromTime = Number(parts[0]);
      const toTime = Number(parts[1]);
      if (!Number.isFinite(fromTime) || !Number.isFinite(toTime) || fromTime >= toTime) return false;
      let fromIdx = data.findIndex((c) => c.time >= fromTime);
      let toIdx = data.findIndex((c) => c.time >= toTime);
      if (fromIdx === -1) fromIdx = 0;
      if (toIdx === -1) toIdx = data.length - 1;
      if (fromIdx >= toIdx) return false;
      const range = { from: fromIdx, to: toIdx };
      targetViewportRef.current = range;
      setProgrammaticLogicalRange(chart, range);
      return true;
    };

    function getChartOptions(theme: ThemeObject, symbolStr?: string, timeframeStr?: string) {
      const isLight = !isDarkTheme(theme);
      const gridColor = theme.grid.visible
        ? `rgba(${hexToRgb(theme.grid.color)}, ${theme.grid.opacity / 100})`
        : 'transparent';

      const labelBg = theme.scale.price.background && theme.scale.price.background !== 'transparent'
        ? theme.scale.price.background
        : (isLight ? '#334155' : '#1e293b');

      const defaultTextColor = isLight ? '#334155' : '#d1d5db';
      const textColor = theme.scale.price.text && theme.scale.price.text !== '#838da0'
        ? theme.scale.price.text
        : defaultTextColor;

      return {
        layout: {
          background: { type: ColorType.Solid, color: theme.chart.background },
          textColor: textColor,
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          fontSize: 12,
        },
        watermark: {
          visible: !!symbolStr,
          fontSize: 72,
          horzAlign: 'center',
          vertAlign: 'center',
          color: isLight ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.03)',
          text: symbolStr ? `${symbolStr} • ${timeframeStr}` : '',
        },
        grid: {
          vertLines: { color: gridColor },
          horzLines: { color: gridColor },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: {
            color: theme.crosshair.color,
            width: theme.crosshair.width,
            style: theme.crosshair.style === 'dashed' ? 3 : 0,
            labelBackgroundColor: labelBg,
          },
          horzLine: {
            color: theme.crosshair.color,
            width: theme.crosshair.width,
            style: theme.crosshair.style === 'dashed' ? 3 : 0,
            labelBackgroundColor: labelBg,
          },
        },
        rightPriceScale: {
          visible: true,
          borderColor: theme.scale.price.border || (isLight ? '#d1d4dc' : '#242934'),
          textColor: textColor,
          scaleMargins: computeScaleMargins(
            bottomIndicatorsHeightRef.current,
            containerRef.current?.clientHeight || 600
          ),
        },
        kineticScroll: {
          touch: true,
          mouse: true,
        },
        handleScroll: {
          mouseWheel: true,
          pressedMove: true,
          horzTouchDrag: true,
          vertTouchDrag: false,
        },
        handleScale: {
          mouseWheel: true,
          pinch: true,
          axisPressedMouseMove: true,
        },
        localization: {
          timeFormatter: (time: Time) => {
            const ts = typeof time === 'number' ? time : (time as any).timestamp ?? 0;
            return formatTimestampWithDayInTimezone(ts, timezoneRef.current);
          },
        },
        timeScale: {
          visible: true,
          borderColor: theme.scale.time.border || (isLight ? '#d1d4dc' : '#242934'),
          textColor: textColor,
          timeVisible: true,
          secondsVisible: false,
          fixLeftEdge: false,
          fixRightEdge: false,
          lockVisibleTimeRangeOnResize: false,
          rightOffset: 5,
          shiftVisibleRangeOnNewBar: false,
          tickMarkFormatter: (time: Time, tickMarkType: TickMarkType) => {
            const ts = time as number;
            return formatTickMark(ts, timezoneRef.current, tickMarkType);
          },
        },
        autoSize: true,
      } as const;
    }

    function getPriceFormatOptions(samplePrice?: number) {
      if (samplePrice !== undefined && samplePrice !== null && samplePrice > 0) {
        if (samplePrice > 500) {
          return { type: 'price' as const, precision: 2, minMove: 0.01 };
        }
        if (samplePrice > 50 && samplePrice <= 500) {
          return { type: 'price' as const, precision: 3, minMove: 0.001 };
        }
      }
      return {
        type: 'price' as const,
        precision: 5,
        minMove: 0.00001,
      };
    }

    function getCandleOptions(theme: ThemeObject, samplePrice?: number) {
      return {
        upColor: theme.candle.bull.body,
        downColor: theme.candle.bear.body,
        borderUpColor: theme.candle.bull.border,
        borderDownColor: theme.candle.bear.border,
        wickUpColor: theme.candle.bull.wick,
        wickDownColor: theme.candle.bear.wick,
        priceFormat: getPriceFormatOptions(samplePrice),
      } as const;
    }

    // Day 14: Component mount / unmount tracking.
    useEffect(() => {
      console.log('[RUNTIME LOG 1] ChartContainer MOUNTED');
      return () => {
        console.log('[RUNTIME LOG 1] ChartContainer UNMOUNTED');
      };
    }, []);

    const chartInstanceIdRef = useRef<string | null>(null);
    const seriesInstanceIdRef = useRef<string | null>(null);

    // Mount chart + series once. Register click + crosshair handlers.
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const chartId = `chart_${Math.random().toString(36).substring(2, 9)}`;
      const seriesId = `series_${Math.random().toString(36).substring(2, 9)}`;
      chartInstanceIdRef.current = chartId;
      seriesInstanceIdRef.current = seriesId;

      console.log('[FORENSIC STEP 1 & 5] createChart() DOM Check:', {
        containerId: container.id || 'chart-container',
        clientWidth: container.clientWidth,
        clientHeight: container.clientHeight,
        rect: container.getBoundingClientRect(),
      });

      const chart = createChart(container, getChartOptions(theme, symbolName ?? 'TradePro', timeframe) as any);
      console.log('[FORENSIC STEP 1] returned chart instance:', chart);

      const series = chart.addCandlestickSeries(getCandleOptions(theme));
      console.log('[FORENSIC STEP 2] returned series instance:', series);

      chartRef.current = chart;
      seriesRef.current = series;

      const onPointerDown = () => {
        isUserViewportInteractionRef.current = true;
      };
      const onPointerUp = () => {
        setTimeout(() => {
          isUserViewportInteractionRef.current = false;
        }, 150);
      };
      container.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointerup', onPointerUp);

      // Day 5: pan-to-load-more-history (throttled by 100ms) + User Pan Detection
      let panLoadTimer: ReturnType<typeof setTimeout> | null = null;
      const handleVisibleLogicalRangeChange = (range: LogicalRange | null) => {
        if (!range) return;

        if (REPLAY_DEBUG) {
          console.log('[VP-LC-RANGE]', {
            paneId: currentPaneId,
            from: range.from,
            to: range.to,
            previousFrom: prevLogicalRangeRef.current?.from,
            previousTo: prevLogicalRangeRef.current?.to,
            autoFollow: autoFollowRef.current,
            replayTime: replayStateRef.current.currentReplayTime,
          });
        }

        // USER PAN DETECTION: Match against last programmatic range write (relaxed pixel snap tolerance)
        const target = lastProgrammaticRangeRef.current;
        const isProgrammaticMatch =
          target !== null &&
          Math.abs(range.from - target.from) < 1.5 &&
          Math.abs(range.to - target.to) < 1.5;

        if (isProgrammaticMatch) {
          return;
        }

        // Only detach autoFollow if range change was driven by active user physical interaction (mouse drag, trackpad, wheel)
        if (isUserViewportInteractionRef.current && autoFollowRef.current) {
          detachAutoFollow('user-pan');
        }
        prevLogicalRangeRef.current = { from: range.from, to: range.to };

        if (panLoadTimer) return;
        panLoadTimer = setTimeout(() => {
          panLoadTimer = null;
          // Pan Left -> trigger when near beginning of buffer and more data is available in SQLite
          if (
            range.from < PAN_LOAD_THRESHOLD &&
            hasMoreBeforeRef.current &&
            !loadingMoreRef.current
          ) {
            loadMoreBeforeRef.current();
          }
          // Pan Right -> ONLY trigger when user is actively panning
          const totalBars = chartDataRef.current.length;
          if (
            isUserViewportInteractionRef.current &&
            range.to > totalBars - PAN_LOAD_THRESHOLD &&
            hasMoreAfterRef.current &&
            !loadingMoreRef.current &&
            loadMoreAfterRef.current
          ) {
            loadMoreAfterRef.current();
          }
        }, 100);

        // Update cursor shadow when chart is panned or zoomed
        if (currentShadowTimestampRef.current !== null) {
          updateShadowCoordinate(currentShadowTimestampRef.current);
        }

        // Update projected future time ticks on visible range change
        updateFutureTicks();
      };
      chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleLogicalRangeChange);

      // Day 8 & Global Crosshair Sync: crosshair move handler.
      const handleCrosshairMove = (params: any) => {
        // 1. Replay start selection timestamp preview
        const state = replayStateRef.current;
        if (state.status === 'selecting' && params?.time) {
          const t = params.time as number;
          if (t !== lastPreviewTimeRef.current) {
            lastPreviewTimeRef.current = t;
            setPreviewTime(t);
          }
        } else if (lastPreviewTimeRef.current !== null) {
          lastPreviewTimeRef.current = null;
          setPreviewTime(null);
        }

        // 2. Obtain exact timestamp from params or compute from screen coordinate in empty areas
        const containerEl = containerRef.current;
        const chart = chartRef.current;
        if (!containerEl || !chart) return;

        const rect = containerEl.getBoundingClientRect();
        if (rect.height <= 0 || rect.width <= 0) return;

        const symStr = String(symbolName || symbolId || '');
        const isCrypto = /btc|eth|sol|xrp|crypto/i.test(symStr);
        let time: number | null =
          typeof params?.time === 'number' && Number.isFinite(params.time) && params.time > 0
            ? params.time
            : params?.point && params.point.x >= 0
            ? getTimeFromCoordinate(chart, params.point.x, chartDataRef.current, timeframeRef.current, allCandlesRef.current, isCrypto)
            : null;

        // 3. Future Crosshair Time Badge for empty right area (where params.time is undefined)
        if (params && params.point && params.point.x >= 0 && params.point.y >= 0 && !params.time && time !== null) {
          setFutureHover({
            x: params.point.x,
            label: formatTimestampWithDayInTimezone(time, timezoneRef.current),
          });
        } else {
          setFutureHover(null);
        }

        // 4. Global Crosshair Synchronization publishing
        const pId = paneIdRef.current;
        if (!workspaceRef.current?.syncCrosshair) return;

        if (!params || !params.point || params.point.x < 0 || params.point.y < 0) {
          if (activeSourcePaneRef.current === pId) {
            crosshairBus.publishClear(pId);
            activeSourcePaneRef.current = null;
          }
          return;
        }

        if (time !== null && Number.isFinite(time) && time > 0) {
          activeSourcePaneRef.current = pId;
          const relativeY = Math.min(1, Math.max(0, params.point.y / rect.height));
          crosshairBus.publishMove({
            sourcePaneId: pId,
            symbolId: symbolIdRef.current,
            time,
            price: 0,
            relativeY,
          });
        }
      };
      chart.subscribeCrosshairMove(handleCrosshairMove);

      // Day 8: Click on chart → confirm replay start point.
      const handleChartClick = (params: { time?: Time }) => {
        const state = replayStateRef.current;
        if (state.status !== 'selecting' || !params.time) return;
        const clickTime = params.time as number;
        const candles = allCandlesRef.current;
        if (!candles || candles.length === 0) return;
        const idx = findNearestCandleIndex(candles, clickTime);
        if (idx >= 0) {
          confirmRef.current(idx);
        }
      };
      chart.subscribeClick(handleChartClick);

      // Day 14: Save viewport on every visible range change (debounced).
      const handleViewportChange = () => {
        saveViewport(chart, chartDataRef.current);
      };
      chart.timeScale().subscribeVisibleLogicalRangeChange(handleViewportChange);

      // Native DOM Pointer & Wheel Event Listeners: Trace & Instant Detach
      const handlePointerDown = (e: PointerEvent) => {
        pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
        isUserViewportInteractionRef.current = true;
      };

      const handlePointerMove = (e: PointerEvent) => {
        if (!isUserViewportInteractionRef.current || !pointerDownPosRef.current) return;
        const dx = Math.abs(e.clientX - pointerDownPosRef.current.x);
        const dy = Math.abs(e.clientY - pointerDownPosRef.current.y);
        if ((dx > 3 || dy > 3) && autoFollowRef.current) {
          detachAutoFollow('user-drag');
        }
      };

      const handlePointerUpWindow = (e: PointerEvent) => {
        isUserViewportInteractionRef.current = false;
        pointerDownPosRef.current = null;
      };

      let wheelTimer: ReturnType<typeof setTimeout> | null = null;
      const handleWheel = (e: WheelEvent) => {
        isUserViewportInteractionRef.current = true;
        if (autoFollowRef.current) {
          detachAutoFollow('wheel-zoom');
        }
        if (wheelTimer) clearTimeout(wheelTimer);
        wheelTimer = setTimeout(() => {
          isUserViewportInteractionRef.current = false;
        }, 300);
      };

      container.addEventListener('pointerdown', handlePointerDown);
      window.addEventListener('pointermove', handlePointerMove, true);
      window.addEventListener('pointerup', handlePointerUpWindow, true);
      container.addEventListener('wheel', handleWheel, { passive: true });

      return () => {
        container.removeEventListener('pointerdown', onPointerDown);
        window.removeEventListener('pointerup', onPointerUp);
        container.removeEventListener('pointerdown', handlePointerDown);
        window.removeEventListener('pointermove', handlePointerMove, true);
        window.removeEventListener('pointerup', handlePointerUpWindow, true);
        container.removeEventListener('wheel', handleWheel);
        chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleLogicalRangeChange);
        chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleViewportChange);
        chart.unsubscribeCrosshairMove(handleCrosshairMove);
        chart.unsubscribeClick(handleChartClick);
        chart.remove();
        chartRef.current = null;
        seriesRef.current = null;
      };
    }, []);

    function resetVerticalScale() {
      try {
        const chart = chartRef.current;
        const series = seriesRef.current;
        if (!chart || !series) return;
        const totalHeight = containerRef.current?.clientHeight || 600;
        const margins = computeScaleMargins(bottomIndicatorsHeightRef.current, totalHeight);
        chart.priceScale('right').applyOptions({
          scaleMargins: margins,
        });
        series.priceScale().applyOptions({ autoScale: true });
      } catch {}
    }

    // Dynamic adjustment when bottom indicator sub-panes (Daye Quarters / RSI) are resized, added, or removed
    useEffect(() => {
      const chart = chartRef.current;
      const series = seriesRef.current;
      if (!chart || !series) return;

      const totalHeight = containerRef.current?.clientHeight || 600;
      const margins = computeScaleMargins(bottomIndicatorsHeight, totalHeight);

      chart.priceScale('right').applyOptions({
        scaleMargins: margins,
      });
      series.priceScale().applyOptions({ autoScale: true });
    }, [bottomIndicatorsHeight]);

    // Dynamic Theme synchronization: instantly apply theme changes to chart and candles
    useEffect(() => {
      const chart = chartRef.current;
      const series = seriesRef.current;
      if (!chart || !series) return;

      chart.applyOptions(getChartOptions(theme, symbolName ?? 'TradePro', timeframe) as any);
      series.applyOptions(getCandleOptions(theme));
    }, [theme, symbolName, timeframe]);

    // Day 15: When timezone changes, update formatters and force tick marks / crosshair to re-render.
    useEffect(() => {
      const chart = chartRef.current;
      if (!chart) return;
      chart.applyOptions({
        localization: {
          timeFormatter: (time: Time) => {
            const ts = typeof time === 'number' ? time : (time as any).timestamp ?? 0;
            return formatTimestampWithDayInTimezone(ts, timezone);
          },
        },
        timeScale: {
          tickMarkFormatter: (time: Time, tickMarkType: TickMarkType) => {
            const ts = time as number;
            return formatTickMark(ts, timezone, tickMarkType);
          },
        },
      } as any);
      chart.timeScale().applyOptions({});
      updateFutureTicks();
    }, [timezone, updateFutureTicks]);

    // Appearance: apply theme changes to chart in realtime.
    useEffect(() => {
      const chart = chartRef.current;
      const series = seriesRef.current;
      if (!chart) return;
      chart.applyOptions(getChartOptions(theme) as any);
      if (series) series.applyOptions(getCandleOptions(theme));
      chart.timeScale().applyOptions({});
    }, [theme]);

    // Handle manual 1-click 'refresh-chart-lag' viewport recentering & autoFollow lock
    useEffect(() => {
      const handleRefresh = () => {
        autoFollowRef.current = true;
        isUserViewportInteractionRef.current = false;
        mappedCacheRef.current.clear();
        const chart = chartRef.current;
        const data = chartDataRef.current;
        if (chart && data.length > 0) {
          const range = defaultRange(data.length);
          if (range) {
            targetViewportRef.current = range;
            setProgrammaticLogicalRange(chart, range, 'MANUAL_REFRESH_LAG');
          }
          resetVerticalScale();
        }
      };
      window.addEventListener('refresh-chart-lag', handleRefresh);
      return () => window.removeEventListener('refresh-chart-lag', handleRefresh);
    }, []);

    // Feed displayCandles (filtered by replay cutoffTime) to chart whenever they change.
    useLayoutEffect(() => {
      const chart = chartRef.current;
      const series = seriesRef.current;
      if (!chart || !series) return;

      if (displayCandles.length > 0) {
        const samplePrice = displayCandles[0].close;
        series.applyOptions({
          priceFormat: getPriceFormatOptions(samplePrice),
        });
      }

      const currentSymbolTfKey = `${symbolId}:${timeframe}`;
      const isFreshLoad = lastSymbolTfKeyRef.current !== currentSymbolTfKey;
      if (displayCandles.length > 0) {
        lastSymbolTfKeyRef.current = currentSymbolTfKey;
      }

      const prevData = chartDataRef.current;
      const prevDataLen = prevData.length;
      const delta = displayCandles.length - prevDataLen;
      const prevLogicalRange = chart.timeScale().getVisibleLogicalRange();

      if (REPLAY_DEBUG) {
        console.log('[VP-TICK]', {
          replayTime: effectiveReplayTime,
          dataLength: displayCandles.length,
          delta,
          autoFollow: autoFollowRef.current,
          from: prevLogicalRange?.from,
          to: prevLogicalRange?.to,
        });
      }

      // FIX #2: Incremental series.update() optimization during normal forward playback
      const isResetTokenUnchanged = prevResetTokenRef.current === resetToken;
      prevResetTokenRef.current = resetToken;

      let isIncremental = false;

      // Sanity checks: not a fresh timeframe/symbol load, resetToken unchanged, non-empty dataset, and matching first candle time
      if (
        !isFreshLoad &&
        isResetTokenUnchanged &&
        displayCandles.length > 0 &&
        prevData.length > 0 &&
        displayCandles[0].time === prevData[0].time
      ) {
        const lastNewCandle = displayCandles[displayCandles.length - 1];
        const lastPrevCandle = prevData[prevData.length - 1];

        // CASE A: Forming candle update (same length, same last candle timestamp)
        if (displayCandles.length === prevData.length && lastNewCandle.time === lastPrevCandle.time) {
          isIncremental = true;
          series.update(lastNewCandle as any);
        }
        // CASE B: New candle opened (length increased by 1, new 2nd-to-last candle matches previous last candle timestamp)
        else if (
          displayCandles.length === prevData.length + 1 &&
          displayCandles[displayCandles.length - 2].time === lastPrevCandle.time
        ) {
          isIncremental = true;
          // 1. Finalize the previous candle that just completed with its full finalized OHLC
          const finalizedPrevCandle = displayCandles[displayCandles.length - 2];
          series.update(finalizedPrevCandle as any);
          // 2. Open / append the new forming candle
          series.update(lastNewCandle as any);
        }
      }

      // Fallback: Full dataset replacement for initial load, timeframe/symbol switch, seek/backward, or major buffer shift
      if (!isIncremental) {
        series.setData(displayCandles as any);
      }

      chartDataRef.current = displayCandles;

      const isInitialArrival = (prevDataLen <= 2) && displayCandles.length > 2;

      if ((isFreshLoad || isInitialArrival) && displayCandles.length > 0 && !isUserViewportInteractionRef.current) {
        autoFollowRef.current = true;
        const range = defaultRange(displayCandles.length);
        if (range) {
          targetViewportRef.current = range;
          setProgrammaticLogicalRange(chart, range, 'INITIAL_FRESH_LOAD');
        }
        resetVerticalScale();
      } else if (
        autoFollowRef.current &&
        !isUserViewportInteractionRef.current &&
        displayCandles.length > 0 &&
        delta !== 0
      ) {
        // AUTO FOLLOW ON: Viewport advances smoothly only when new candles open or on full dataset reload
        const rawWidth = prevLogicalRange ? prevLogicalRange.to - prevLogicalRange.from : DEFAULT_VISIBLE_CANDLES;
        const visibleWidth =
          Number.isFinite(rawWidth) && rawWidth >= 10 && rawWidth <= DEFAULT_VISIBLE_CANDLES * 2
            ? rawWidth
            : DEFAULT_VISIBLE_CANDLES;
        const rightPad = Math.max(5, Math.ceil(visibleWidth * 0.10));
        const lastIndex = displayCandles.length - 1;
        const newTo = lastIndex + rightPad;
        const newFrom = newTo - visibleWidth;
        const followRange = { from: newFrom, to: newTo };

        // Only issue programmatic update if range has actually shifted
        if (!prevLogicalRange || Math.abs(prevLogicalRange.to - newTo) > 0.1) {
          targetViewportRef.current = followRange;
          setProgrammaticLogicalRange(chart, followRange, 'REPLAY_AUTO_FOLLOW');
        }
      } else if (
        !autoFollowRef.current &&
        prevLogicalRange &&
        !isUserViewportInteractionRef.current
      ) {
        // USER PANNED: When older candles are prepended (delta > 0, displayCandles[0].time < prevData[0].time),
        // adjust logical range by prependedCount so user's visual position stays 100% frozen without jumping!
        let prependedCount = 0;
        if (prevData.length > 0 && displayCandles.length > prevData.length && displayCandles[0].time < prevData[0].time) {
          const oldFirstTime = prevData[0].time;
          for (let i = 0; i < displayCandles.length; i++) {
            if (displayCandles[i].time === oldFirstTime) {
              prependedCount = i;
              break;
            }
          }
        }

        if (prependedCount > 0) {
          const shiftedRange = {
            from: prevLogicalRange.from + prependedCount,
            to: prevLogicalRange.to + prependedCount,
          };
          targetViewportRef.current = shiftedRange;
          setProgrammaticLogicalRange(chart, shiftedRange, 'PRESERVE_USER_PAN_PREPEND');
        }
      }

      // Auto-load backward history if initial/resumed dataset is small (< PAN_LOAD_THRESHOLD, e.g. 1 candle)
      if (
        displayCandles.length > 0 &&
        displayCandles.length < PAN_LOAD_THRESHOLD &&
        hasMoreBeforeRef.current &&
        !loadingMoreRef.current
      ) {
        loadMoreBeforeRef.current();
      }

      // Update projected future time ticks on data update
      updateFutureTicks();
    }, [displayCandles, resetToken, updateFutureTicks]);


    useImperativeHandle(
      ref,
      () => ({
        resetChartView: (focusTime?: number) => {
          const chart = chartRef.current;
          const data = chartDataRef.current;
          if (!chart || data.length === 0) return;

          // Reset Chart restores autoFollow to true
          autoFollowRef.current = true;

          let range: { from: number; to: number } | null = null;
          if (focusTime !== undefined) {
            range = focusRange(data, focusTime);
          } else {
            // Default Reset: center around active candle (last index of current dataset) with 10% right-side spacing
            const lastIndex = data.length - 1;
            const prevLogicalRange = chart.timeScale().getVisibleLogicalRange();
            const visibleWidth = prevLogicalRange
              ? Math.max(10, prevLogicalRange.to - prevLogicalRange.from)
              : DEFAULT_VISIBLE_CANDLES;
            const rightPad = Math.max(5, Math.ceil(visibleWidth * 0.10));
            const targetTo = lastIndex + rightPad;
            const targetFrom = targetTo - visibleWidth;
            range = { from: targetFrom, to: targetTo };
          }

          if (range) {
            targetViewportRef.current = range;
            if (REPLAY_DEBUG) {
              console.log('[VP-RESET]', {
                replayTime: replayStateRef.current.currentReplayTime,
                activeLogicalIndex: data.length - 1,
                from: range.from,
                to: range.to,
              });
            }
            setProgrammaticLogicalRange(chart, range, 'RESET_VIEW');
          }
          resetVerticalScale();
        },

        getChart: () => chartRef.current,
        getSeries: () => seriesRef.current,
      }),
      []
    );

    // Day 14: Cleanup viewport save timer on unmount.
    useEffect(() => {
      return () => {
        if (viewportSaveTimerRef.current) {
          clearTimeout(viewportSaveTimerRef.current);
        }
      };
    }, []);

    // Global Crosshair & Vertical Shadow Synchronization subscription
    useEffect(() => {
      const unsubMove = crosshairBus.subscribeMove((payload) => {
        if (workspaceRef.current?.syncCrosshair === false) {
          updateShadowCoordinate(null);
          return;
        }
        const currentPaneId = paneIdRef.current || 'pane-0';
        // Only target panes (not the active source pane) render the synchronized vertical shadow
        if (payload && payload.time && payload.sourcePaneId !== currentPaneId) {
          updateShadowCoordinate(payload.time);
        } else {
          updateShadowCoordinate(null);
        }
      });

      const unsubClear = crosshairBus.subscribeClear(() => {
        updateShadowCoordinate(null);
      });

      return () => {
        unsubMove();
        unsubClear();
      };
    }, [updateShadowCoordinate]);

    // Format preview timestamp for display (selection mode) — uses timezone.
    const previewLabel =
      previewTime !== null ? formatTimestampInTimezone(previewTime, timezone) : null;

    return (
      <div className="chart-container-wrapper" style={{ background: theme.chart.background }}>
        <div
          ref={containerRef}
          className="chart-container"
          onMouseLeave={() => {
            const pId = paneId || 'pane-0';
            if (activeSourcePaneRef.current === pId) {
              crosshairBus.publishClear(pId);
              activeSourcePaneRef.current = null;
            }
            updateShadowCoordinate(null);
            setFutureHover(null);
          }}
        />

        {/* Multi-layout Synchronized Vertical Cursor Shadow (Direct DOM overlay) */}
        <div
          ref={shadowRef}
          className="chart-cursor-shadow"
          style={{ display: 'none' }}
        />

        {/* Projected Future Time Scale Ticks on Bottom Axis */}
        {futureTicks.length > 0 && (
          <div className="chart-future-ticks-container">
            {futureTicks.map((tick, i) => (
              <span
                key={i}
                className={`chart-future-tick ${tick.isDay ? 'chart-future-tick--day' : 'chart-future-tick--hour'}`}
                style={{ left: tick.x, color: tick.isDay ? textColor : '#787b86' }}
              >
                {tick.text}
              </span>
            ))}
          </div>
        )}

        {/* Future Crosshair Time Badge on Bottom Axis */}
        {futureHover && (
          <div
            className="chart-future-crosshair-badge"
            style={{ left: futureHover.x, background: labelBg }}
          >
            {futureHover.label}
          </div>
        )}

        {/* Day 8: Timestamp preview during start point selection */}
        {replayState.status === 'selecting' && previewLabel && (
          <div className="chart-container__replay-preview">{previewLabel}</div>
        )}

        {/* Loading Indicator for on-demand pan fetch */}
        {loadingMore && (
          <div className="chart-container__loading-more">
            <span className="data-spin" style={{ display: 'inline-block' }}>⟳</span> Loading candles...
          </div>
        )}
      </div>
    );
  }
);

ChartContainer.displayName = 'ChartContainer';

export default ChartContainer;
