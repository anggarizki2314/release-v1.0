import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Settings, Eye, EyeOff, Trash2 } from 'lucide-react';
import type { Candle } from '@/types';
import { useIndicatorStore } from './useIndicatorStore';
import { calculateEma } from './calculations/ema';
import { calculateTradingSessions, type SessionBox } from './calculations/sessions';
import { calculateQuarterLevels, type QuarterLevel } from './calculations/quarters';
import { calculateDayeQuarters, type DayeQuarterBlock } from './calculations/dayeQuarters';
import { calculateRsi, type RsiPoint } from './calculations/rsi';
import { calculateRsiMa, type RsiMaPoint } from './calculations/rsiMa';
import { calculateRsiDivergences, type RsiDivergenceLine } from './calculations/rsiDivergence';
import { calculateSessionOpens, type OpenLineSegment } from './calculations/sessionOpens';
import type {
  EmaIndicatorConfig,
  EmaLineItem,
  SessionsIndicatorConfig,
  KillzonesIndicatorConfig,
  MacrosIndicatorConfig,
  SessionOpensIndicatorConfig,
  QuartersIndicatorConfig,
  RsiIndicatorConfig,
} from './types';
import { isIndicatorVisibleOnTimeframe } from './types';
import IndicatorLegend from './IndicatorLegend';
import { IndicatorSettingsModal } from './IndicatorSettingsModal';
import './IndicatorsLayer.css';

export interface IndicatorsLayerProps {
  chart: any;
  series: any;
  candles: Candle[];
  symbol: string;
  chartWidth: number;
  chartHeight: number;
  timeframe?: string;
}

function findLastIdx(candles: Candle[], timestamp: number): number {
  let low = 0;
  let high = candles.length - 1;
  let best = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (candles[mid].time <= timestamp) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return best;
}

function applyColorOpacity(hex: string, opacity: number = 1): string {
  if (opacity >= 1) return hex;
  if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex;
  if (hex.startsWith('#')) {
    const raw = hex.slice(1);
    let r = 0;
    let g = 0;
    let b = 0;
    if (raw.length === 3) {
      r = parseInt(raw[0] + raw[0], 16);
      g = parseInt(raw[1] + raw[1], 16);
      b = parseInt(raw[2] + raw[2], 16);
    } else if (raw.length >= 6) {
      r = parseInt(raw.slice(0, 2), 16);
      g = parseInt(raw.slice(2, 4), 16);
      b = parseInt(raw.slice(4, 6), 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return hex;
}

export const IndicatorsLayer: React.FC<IndicatorsLayerProps> = ({
  chart,
  series,
  candles,
  symbol,
  chartWidth,
  chartHeight,
  timeframe,
}) => {
  const {
    indicators,
    toggleIndicator,
    removeIndicator,
    dayeQuartersHeight,
    setDayeQuartersHeight,
    rsiHeight,
    setRsiHeight,
  } = useIndicatorStore();
  const emaSeriesMapRef = useRef<Map<string, any>>(new Map());
  const [latestValues, setLatestValues] = useState<Record<string, number | string>>({});
  const [tick, setTick] = useState(0);

  const [settingsModalId, setSettingsModalId] = useState<string | null>(null);

  const isRsiDraggingRef = useRef<{ startY: number; startH: number } | null>(null);

  const handleRsiResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isRsiDraggingRef.current = { startY: e.clientY, startH: rsiHeight };

      const onPointerMove = (ev: PointerEvent) => {
        if (!isRsiDraggingRef.current) return;
        const deltaY = isRsiDraggingRef.current.startY - ev.clientY;
        const maxH = Math.max(160, Math.round(chartHeight * 0.75));
        const nextH = Math.min(maxH, Math.max(70, isRsiDraggingRef.current.startH + deltaY));
        setRsiHeight(nextH);
      };

      const onPointerUp = () => {
        isRsiDraggingRef.current = null;
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    },
    [chartHeight, rsiHeight, setRsiHeight]
  );

  const isDayeDraggingRef = useRef<{ startY: number; startH: number } | null>(null);

  const handleDayeResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isDayeDraggingRef.current = { startY: e.clientY, startH: dayeQuartersHeight };

      const onPointerMove = (ev: PointerEvent) => {
        if (!isDayeDraggingRef.current) return;
        const deltaY = isDayeDraggingRef.current.startY - ev.clientY;
        const maxH = Math.max(120, Math.round(chartHeight * 0.5));
        const nextH = Math.min(maxH, Math.max(55, isDayeDraggingRef.current.startH + deltaY));
        setDayeQuartersHeight(nextH);
      };

      const onPointerUp = () => {
        isDayeDraggingRef.current = null;
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    },
    [chartHeight, dayeQuartersHeight, setDayeQuartersHeight]
  );

  const [rsiScaleFactors, setRsiScaleFactors] = useState<Record<string, number>>({});
  const [rsiPanOffsets, setRsiPanOffsets] = useState<Record<string, number>>({});
  const [isPanningRsiId, setIsPanningRsiId] = useState<string | null>(null);

  const isAxisDraggingRef = useRef<{ confId: string; startY: number; startScale: number } | null>(null);
  const isPlotPanningRef = useRef<{
    confId: string;
    startY: number;
    startOffset: number;
    plotH: number;
    rangeY: number;
  } | null>(null);

  const [crosshairPos, setCrosshairPos] = useState<{ x: number | null; time: number | null }>({
    x: null,
    time: null,
  });
  const [rsiHoverState, setRsiHoverState] = useState<{ confId: string; y: number; x: number } | null>(null);

  useEffect(() => {
    if (!chart) return;
    const handleCrosshairMove = (params: any) => {
      if (!params || !params.point || params.point.x < 0) {
        setCrosshairPos({ x: null, time: null });
        return;
      }
      setCrosshairPos({
        x: params.point.x,
        time: typeof params.time === 'number' ? params.time : null,
      });
    };

    chart.subscribeCrosshairMove(handleCrosshairMove);
    return () => {
      try {
        chart.unsubscribeCrosshairMove(handleCrosshairMove);
      } catch {}
    };
  }, [chart]);

  const handleAxisPointerDown = useCallback(
    (confId: string, e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const currentScale = rsiScaleFactors[confId] || 1.0;
      isAxisDraggingRef.current = { confId, startY: e.clientY, startScale: currentScale };

      const onPointerMove = (ev: PointerEvent) => {
        if (!isAxisDraggingRef.current) return;
        const deltaY = isAxisDraggingRef.current.startY - ev.clientY; // Drag up -> zoom in (taller)
        const sensitivity = 0.012;
        const nextScale = Math.max(0.35, Math.min(3.8, isAxisDraggingRef.current.startScale * (1 + deltaY * sensitivity)));
        setRsiScaleFactors((prev) => ({ ...prev, [confId]: nextScale }));
      };

      const onPointerUp = () => {
        isAxisDraggingRef.current = null;
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    },
    [rsiScaleFactors]
  );

  const handlePlotPointerDown = useCallback(
    (confId: string, plotH: number, rangeY: number, e: React.PointerEvent) => {
      // Only drag with left mouse button
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      const currentOffset = rsiPanOffsets[confId] || 0;
      isPlotPanningRef.current = {
        confId,
        startY: e.clientY,
        startOffset: currentOffset,
        plotH: Math.max(10, plotH),
        rangeY: Math.max(1, rangeY),
      };
      setIsPanningRsiId(confId);

      const onPointerMove = (ev: PointerEvent) => {
        if (!isPlotPanningRef.current) return;
        // Drag down (ev.clientY > startY) -> moves plot down (increases center value)
        const deltaY = ev.clientY - isPlotPanningRef.current.startY;
        const deltaRsi = (deltaY / isPlotPanningRef.current.plotH) * isPlotPanningRef.current.rangeY;
        const nextOffset = Math.max(-80, Math.min(80, isPlotPanningRef.current.startOffset + deltaRsi));
        setRsiPanOffsets((prev) => ({ ...prev, [confId]: nextOffset }));
      };

      const onPointerUp = () => {
        isPlotPanningRef.current = null;
        setIsPanningRsiId(null);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    },
    [rsiPanOffsets]
  );

  const handleResetRsiView = useCallback((confId: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setRsiScaleFactors((prev) => ({ ...prev, [confId]: 1.0 }));
    setRsiPanOffsets((prev) => ({ ...prev, [confId]: 0 }));
  }, []);

  // Subscribe to chart visible range change, price scale drag, and pan/zoom events with rAF for 120fps sync
  useEffect(() => {
    if (!chart) return;
    let rafId: number | null = null;
    let isPointerActive = false;

    const triggerRender = () => {
      setTick((t) => (t + 1) % 1000000);
    };

    const handleRangeChange = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        triggerRender();
      });
    };

    const trackingLoop = () => {
      if (!isPointerActive) return;
      triggerRender();
      rafId = requestAnimationFrame(trackingLoop);
    };

    const handlePointerDown = () => {
      isPointerActive = true;
      if (rafId === null) {
        rafId = requestAnimationFrame(trackingLoop);
      }
    };

    const handlePointerUp = () => {
      isPointerActive = false;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      triggerRender();
    };

    let wheelTimer: ReturnType<typeof setTimeout> | null = null;
    const handleWheel = () => {
      triggerRender();
      if (wheelTimer) clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => {
        triggerRender();
      }, 200);
    };

    const chartEl = typeof chart.chartElement === 'function' ? chart.chartElement() : null;

    try {
      const timeScale = chart.timeScale();
      timeScale.subscribeVisibleLogicalRangeChange(handleRangeChange);
      timeScale.subscribeVisibleTimeRangeChange(handleRangeChange);

      if (chartEl) {
        chartEl.addEventListener('pointerdown', handlePointerDown);
        chartEl.addEventListener('wheel', handleWheel, { passive: true });
      }
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerUp);

      return () => {
        isPointerActive = false;
        if (rafId !== null) cancelAnimationFrame(rafId);
        if (wheelTimer) clearTimeout(wheelTimer);
        try {
          timeScale.unsubscribeVisibleLogicalRangeChange(handleRangeChange);
          timeScale.unsubscribeVisibleTimeRangeChange(handleRangeChange);
        } catch {}
        if (chartEl) {
          chartEl.removeEventListener('pointerdown', handlePointerDown);
          chartEl.removeEventListener('wheel', handleWheel);
        }
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerUp);
      };
    } catch {
      return;
    }
  }, [chart]);

  // Clean up all EMA series when chart instance unmounts
  useEffect(() => {
    const currentEmaMap = emaSeriesMapRef.current;
    return () => {
      for (const [, emaSeries] of currentEmaMap.entries()) {
        try {
          chart?.removeSeries(emaSeries);
        } catch {}
      }
      currentEmaMap.clear();
    };
  }, [chart]);

  // ── 1. EMA Series Management on Lightweight Charts ──
  useEffect(() => {
    if (!chart || !candles || candles.length === 0) return;

    const currentEmaMap = emaSeriesMapRef.current;
    const activeEmaConfigs = indicators.filter(
      (ind): ind is EmaIndicatorConfig =>
        ind.type === 'EMA' &&
        ind.enabled &&
        isIndicatorVisibleOnTimeframe(ind.visibility, timeframe)
    );

    // Build map of all desired active line items:
    // Key: `${conf.id}_${line.id}`
    const desiredSeries = new Map<
      string,
      {
        line: EmaLineItem;
        conf: EmaIndicatorConfig;
      }
    >();

    for (const conf of activeEmaConfigs) {
      const items: EmaLineItem[] =
        conf.emas && conf.emas.length > 0
          ? conf.emas.filter((e) => e.enabled)
          : [
              {
                id: 'legacy',
                name: conf.name || `EMA ${conf.period}`,
                enabled: true,
                period: conf.period || 20,
                source: conf.source || 'close',
                color: conf.color || '#3b82f6',
                lineWidth: conf.lineWidth || 2,
                lineStyle: 'solid',
              },
            ];

      for (const line of items) {
        desiredSeries.set(`${conf.id}_${line.id}`, { line, conf });
      }
    }

    const desiredKeys = new Set(desiredSeries.keys());
    const newLatestVals: Record<string, number> = {};

    // Remove deleted / disabled EMA series
    for (const [key, emaSeries] of currentEmaMap.entries()) {
      if (!desiredKeys.has(key)) {
        try {
          chart.removeSeries(emaSeries);
        } catch {}
        currentEmaMap.delete(key);
      }
    }

    // Create or update active EMA series
    for (const [key, { line, conf }] of desiredSeries.entries()) {
      let emaSeries = currentEmaMap.get(key);
      const styleNum = line.lineStyle === 'dashed' ? 2 : line.lineStyle === 'dotted' ? 1 : 0;
      const seriesColor = applyColorOpacity(line.color, line.opacity !== undefined ? line.opacity : 1);

      if (!emaSeries) {
        try {
          emaSeries = chart.addLineSeries({
            color: seriesColor,
            lineWidth: (line.lineWidth as any) || 2,
            lineStyle: styleNum,
            priceLineVisible: false,
            lastValueVisible: true,
            crosshairMarkerVisible: true,
            title: `EMA ${line.period}`,
          });
          currentEmaMap.set(key, emaSeries);
        } catch (err) {
          console.error('Failed to create EMA series:', err);
          continue;
        }
      } else {
        emaSeries.applyOptions({
          color: seriesColor,
          lineWidth: line.lineWidth || 2,
          lineStyle: styleNum,
          title: `EMA ${line.period}`,
        });
      }

      // Calculate and feed EMA data
      const emaPoints = calculateEma(candles, line.period, line.source);
      if (emaPoints.length > 0) {
        emaSeries.setData(emaPoints);
        const lastVal = emaPoints[emaPoints.length - 1].value;
        newLatestVals[`${conf.id}_${line.id}`] = lastVal;
        newLatestVals[conf.id] = lastVal;
      }
    }

    if (Object.keys(newLatestVals).length > 0) {
      setLatestValues((prev) => {
        let changed = false;
        for (const k in newLatestVals) {
          if (prev[k] !== newLatestVals[k]) {
            changed = true;
            break;
          }
        }
        return changed ? { ...prev, ...newLatestVals } : prev;
      });
    }
  }, [chart, candles, indicators, timeframe]);

  // Get current visible time range from Lightweight Charts timeScale
  const visibleRange = useMemo(() => {
    if (!chart) return null;
    try {
      return chart.timeScale().getVisibleRange();
    } catch {}
    return null;
  }, [chart, tick]);

  // ── 2. Trading Sessions, ICT Killzones & ICT Macros Overlay Calculation (Visible Range Culled) ──
  const activeSessionConfigs = useMemo(() => {
    return indicators.filter(
      (ind): ind is SessionsIndicatorConfig | KillzonesIndicatorConfig | MacrosIndicatorConfig =>
        (ind.type === 'SESSIONS' || ind.type === 'KILLZONES' || ind.type === 'MACROS') &&
        ind.enabled &&
        isIndicatorVisibleOnTimeframe(ind.visibility, timeframe)
    );
  }, [indicators, timeframe]);

  const visibleSessionBoxes = useMemo(() => {
    if (activeSessionConfigs.length === 0 || !chart || candles.length === 0) return [];
    const allBoxes: SessionBox[] = [];
    for (const conf of activeSessionConfigs) {
      const boxes = calculateTradingSessions(
        candles,
        conf.sessions,
        visibleRange?.from ?? null,
        visibleRange?.to ?? null
      );
      allBoxes.push(...boxes);
    }
    return allBoxes;
  }, [activeSessionConfigs, chart, candles, visibleRange]);

  // ── 2b. Session Opens (Daily Open, London Open, NY Open) Calculation ──
  const activeSessionOpensConfigs = useMemo(() => {
    return indicators.filter(
      (ind): ind is SessionOpensIndicatorConfig =>
        ind.type === 'SESSION_OPENS' &&
        ind.enabled &&
        isIndicatorVisibleOnTimeframe(ind.visibility, timeframe)
    );
  }, [indicators, timeframe]);

  const visibleOpenLines = useMemo(() => {
    if (activeSessionOpensConfigs.length === 0 || !chart || candles.length === 0) return [];
    const allLines: OpenLineSegment[] = [];
    for (const conf of activeSessionOpensConfigs) {
      const lines = calculateSessionOpens(
        candles,
        conf.opens,
        timeframe || 'M1',
        visibleRange?.from ?? null,
        visibleRange?.to ?? null
      );
      allLines.push(...lines);
    }
    return allLines;
  }, [activeSessionOpensConfigs, chart, candles, visibleRange]);

  // ── 3. Daye Quarterly Theory Calculation (Visible Range Culled) ──
  const activeQuartersConfig = useMemo(() => {
    return indicators.find(
      (ind): ind is QuartersIndicatorConfig =>
        ind.type === 'QUARTERS' &&
        ind.enabled &&
        isIndicatorVisibleOnTimeframe(ind.visibility, timeframe)
    );
  }, [indicators, timeframe]);

  const firstCandleTime = candles.length > 0 ? candles[0].time : 0;
  const lastCandleTime = candles.length > 0 ? candles[candles.length - 1].time : 0;

  const dayeQuarterBlocks = useMemo(() => {
    if (!activeQuartersConfig || candles.length === 0) return [];
    return calculateDayeQuarters(
      candles,
      {
        show90min: activeQuartersConfig.show90minCycles,
        showDaily: activeQuartersConfig.showDailyQuarters,
        showWeekly: activeQuartersConfig.showWeeklyQuarters,
        showYearly: activeQuartersConfig.showYearlyQuarters,
        showMonthly: activeQuartersConfig.showMonthlyQuarters,
        showMicro: activeQuartersConfig.showMicroCycles,
        historicalCycles: activeQuartersConfig.historicalCycles,
        q1Color: activeQuartersConfig.q1Color,
        q2Color: activeQuartersConfig.q2Color,
        q3Color: activeQuartersConfig.q3Color,
        q4Color: activeQuartersConfig.q4Color,
      },
      visibleRange?.from ?? null,
      visibleRange?.to ?? null
    );
  }, [
    activeQuartersConfig,
    firstCandleTime,
    lastCandleTime,
    visibleRange?.from,
    visibleRange?.to,
  ]);

  // ── 4. RSI Calculations for ALL Active RSI Instances (Memoized strictly on candles & configs) ──
  const activeRsiConfigs = useMemo(() => {
    return indicators.filter(
      (ind): ind is RsiIndicatorConfig =>
        ind.type === 'RSI' &&
        ind.enabled &&
        isIndicatorVisibleOnTimeframe(ind.visibility, timeframe)
    );
  }, [indicators, timeframe]);

  interface RsiComputedData {
    config: RsiIndicatorConfig;
    points: RsiPoint[];
    maPoints: RsiMaPoint[];
    divergences: RsiDivergenceLine[];
    currentVal: number;
    currentMaVal: number | null;
  }

  const rsiResultsMap = useMemo(() => {
    const map = new Map<string, RsiComputedData>();
    if (!candles || candles.length === 0) return map;

    for (const conf of activeRsiConfigs) {
      const pts = calculateRsi(candles, conf.period, conf.source);
      if (pts.length === 0) continue;

      const maType = conf.maType ?? 'SMA';
      const maLen = conf.maLength ?? 14;
      const bbDev = conf.bbStdDev ?? 0;
      const maPoints = calculateRsiMa(pts, maType, maLen, bbDev);

      let divs: RsiDivergenceLine[] = [];
      if (conf.calcDivergence) {
        const recentCandles = candles.length > 250 ? candles.slice(-250) : candles;
        const recentPts = pts.length > 250 ? pts.slice(-250) : pts;
        divs = calculateRsiDivergences(recentCandles, recentPts);
      }

      const currentVal = pts[pts.length - 1].value;
      const currentMaVal = maPoints.length > 0 ? maPoints[maPoints.length - 1].value : null;

      map.set(conf.id, {
        config: conf,
        points: pts,
        maPoints,
        divergences: divs,
        currentVal,
        currentMaVal,
      });
    }

    return map;
  }, [activeRsiConfigs, candles]);

  // Sync latest RSI values to legend outside of render with strict inequality check
  useEffect(() => {
    if (rsiResultsMap.size === 0) return;
    const newVals: Record<string, number> = {};
    for (const [id, data] of rsiResultsMap.entries()) {
      newVals[id] = data.currentVal;
    }
    setLatestValues((prev) => {
      let changed = false;
      for (const k in newVals) {
        if (prev[k] !== newVals[k]) {
          changed = true;
          break;
        }
      }
      return changed ? { ...prev, ...newVals } : prev;
    });
  }, [rsiResultsMap]);

  // Helpers to convert Time & Price to screen Coordinates
  const timeScale = chart ? chart.timeScale() : null;

  const getBarIntervalSec = (): number => {
    if (candles && candles.length >= 2) {
      const len = candles.length;
      const diff = candles[len - 1].time - candles[len - 2].time;
      if (diff > 0 && diff <= 86400 * 7) return diff;
    }
    if (timeframe === 'M1') return 60;
    if (timeframe === 'M5') return 300;
    if (timeframe === 'M15') return 900;
    if (timeframe === 'M30') return 1800;
    if (timeframe === 'H1') return 3600;
    if (timeframe === 'H4') return 14400;
    if (timeframe === 'D' || timeframe === 'D1') return 86400;
    return 3600;
  };

  const timeToX = (t: number): number | null => {
    if (!timeScale) return null;
    if (!candles || candles.length === 0) return null;

    // 1. Direct logical index conversion for exact candles in active dataset
    const leftIdx = findLastIdx(candles, t);
    if (leftIdx >= 0 && leftIdx < candles.length) {
      if (candles[leftIdx].time === t) {
        try {
          const logicalX = timeScale.logicalToCoordinate(leftIdx as any);
          if (logicalX !== null && typeof logicalX === 'number' && Number.isFinite(logicalX)) {
            return logicalX;
          }
        } catch {}
      }
    }

    // 2. Direct timeToCoordinate from Lightweight Charts timeScale
    try {
      const x = timeScale.timeToCoordinate(t as any);
      if (x !== null && typeof x === 'number' && Number.isFinite(x)) return x;
    } catch {}

    // 3. Fallback / Projection for future or intermediate timestamps
    const lastCandle = candles[candles.length - 1];
    if (t > lastCandle.time) {
      // Future timestamp projection: project exact logical bar index where future session opens/closes will appear
      const intervalSec = getBarIntervalSec();
      const futureBars = (t - lastCandle.time) / intervalSec;
      const futureLogicalIdx = (candles.length - 1) + futureBars;
      try {
        const logicalX = timeScale.logicalToCoordinate(futureLogicalIdx as any);
        if (logicalX !== null && typeof logicalX === 'number' && Number.isFinite(logicalX)) {
          return logicalX;
        }
      } catch {}
    } else if (leftIdx >= 0 && leftIdx < candles.length) {
      try {
        const logicalX = timeScale.logicalToCoordinate(leftIdx as any);
        if (logicalX !== null && typeof logicalX === 'number' && Number.isFinite(logicalX)) {
          return logicalX;
        }
      } catch {}
    }

    return null;
  };

  const priceToY = (p: number): number | null => {
    if (!series) return null;
    try {
      const y = series.priceToCoordinate(p);
      if (y !== null && typeof y === 'number' && Number.isFinite(y)) return y;
    } catch {}
    return null;
  };

  const getBarPixelWidth = (): number => {
    if (!timeScale) return 8;
    try {
      const x0 = timeScale.logicalToCoordinate(0 as any);
      const x1 = timeScale.logicalToCoordinate(1 as any);
      if (x0 !== null && x1 !== null && Number.isFinite(x0) && Number.isFinite(x1)) {
        const w = Math.abs(x1 - x0);
        if (w >= 0.5 && w <= 300) return w;
      }
    } catch {}
    return 8;
  };

  return (
    <div className="indicators-layer" style={{ width: chartWidth, height: chartHeight }}>
      {/* Top Left Chart Legend Chips */}
      <IndicatorLegend latestValues={latestValues} timeframe={timeframe} />

      {/* Sessions & Killzones Overlay (Bounded boxes & titles) */}
      {visibleSessionBoxes.length > 0 && (
        <svg className="indicators-svg-canvas" width={chartWidth} height={chartHeight}>
          {visibleSessionBoxes.map((box) => {
            const x1 = timeToX(box.startTime);
            const x2 = timeToX(box.endTime);
            if (x1 === null && x2 === null) return null;

            const barW = getBarPixelWidth();
            const halfW = barW / 2;

            const startX = (x1 !== null ? x1 : (x2 !== null ? x2 : 0)) - halfW;
            const endX = (x2 !== null ? x2 : (x1 !== null ? x1 : chartWidth)) + halfW;
            if (startX > chartWidth + 50 || endX < -50) return null;
            const boxWidth = Math.max(barW, endX - startX);

            const yHigh = priceToY(box.highPrice);
            const yLow = priceToY(box.lowPrice);
            if (yHigh === null || yLow === null) return null;

            const boxY = Math.min(yHigh, yLow);
            const boxH = Math.max(4, Math.abs(yLow - yHigh));

            return (
              <g key={box.sessionId}>
                {/* Bounded Session Box with dashed border and optional tinted fill */}
                <rect
                  x={startX}
                  y={boxY}
                  width={boxWidth}
                  height={boxH}
                  fill={box.fillEnabled !== false ? (box.bgColor || box.highLowColor) : 'none'}
                  fillOpacity={box.fillEnabled !== false ? (box.opacity !== undefined ? box.opacity : 0.15) : 0}
                  stroke={box.showHighLow !== false ? box.highLowColor : 'none'}
                  strokeOpacity={box.showHighLow !== false ? (box.borderOpacity !== undefined ? box.borderOpacity : 0.85) : 0}
                  strokeWidth={1.2}
                  strokeDasharray="4 4"
                  rx={2}
                />

                {/* Session Title Label right above the box */}
                <text
                  x={startX + 4}
                  y={Math.max(14, boxY - 5)}
                  fill={box.highLowColor || '#94a3b8'}
                  fillOpacity={box.showHighLow !== false ? (box.borderOpacity !== undefined ? box.borderOpacity : 0.85) : 0.85}
                  fontSize={11}
                  fontWeight={700}
                  letterSpacing={0.2}
                >
                  {box.sessionName}
                </text>
              </g>
            );
          })}
        </svg>
      )}

      {/* Session Opens Overlay (Daily Open, London Open, NY Open) */}
      {visibleOpenLines.length > 0 && (
        <svg
          className="indicators-svg-canvas"
          width={chartWidth}
          height={chartHeight - 26}
          style={{ pointerEvents: 'none' }}
        >
          {visibleOpenLines.map((line) => {
            const x1 = timeToX(line.startTime);
            const x2 = timeToX(line.endTime);
            if (x1 === null && x2 === null) return null;

            const startX = x1 !== null ? x1 : 0;
            const endX = x2 !== null ? x2 : chartWidth;
            if (startX > chartWidth + 50 || endX < -50) return null;
            const y = priceToY(line.price);
            if (y === null || y < 0 || y > chartHeight - 26) return null;

            const strokeDasharray =
              line.lineStyle === 'dashed' ? '5 5' : line.lineStyle === 'dotted' ? '2 3' : undefined;

            return (
              <g key={line.id}>
                {/* Horizontal Open Price Line */}
                <line
                  x1={startX}
                  y1={y}
                  x2={endX}
                  y2={y}
                  stroke={line.color}
                  strokeWidth={line.lineWidth}
                  strokeDasharray={strokeDasharray}
                  opacity={line.opacity !== undefined ? line.opacity : 0.9}
                />

                {/* Clean Text Label placed at the TOP RIGHT above the line */}
                {(() => {
                  const op = line.opacity !== undefined ? line.opacity : 0.9;
                  // Position label at the right end of the line, above the line
                  const labelX = Math.min(endX - 2, chartWidth - 8);

                  if (labelX < -20 || startX > chartWidth + 20) return null;

                  return (
                    <text
                      x={labelX}
                      y={y - 4}
                      fill={line.color}
                      fillOpacity={op}
                      fontSize={10}
                      fontWeight={700}
                      fontFamily="var(--font-ui, -apple-system, sans-serif)"
                      textAnchor="end"
                      letterSpacing={0.2}
                    >
                      {line.name}
                    </text>
                  );
                })()}
              </g>
            );
          })}
        </svg>
      )}

      {/* Daye Quarters Overlay directly on Candle Chart Pane (when plotType === 'overlay') */}
      {activeQuartersConfig && activeQuartersConfig.plotType === 'overlay' && dayeQuarterBlocks.length > 0 && (
        <svg className="indicators-svg-canvas" width={chartWidth} height={chartHeight - 26} style={{ pointerEvents: 'none' }}>
          {dayeQuarterBlocks
            .filter((b) => b.cycleType === '90m' || b.cycleType === 'daily')
            .map((block, idx) => {
              const x1 = timeToX(block.startTime);
              const x2 = timeToX(block.endTime);
              if (x1 === null && x2 === null) return null;
              const startX = x1 !== null ? x1 : 0;
              const endX = x2 !== null ? x2 : chartWidth;
              if (startX > chartWidth + 50 || endX < -50) return null;
              const width = Math.max(1, endX - startX);

              return (
                <g key={`q-overlay-${idx}`}>
                  <rect
                    x={startX}
                    y={0}
                    width={width}
                    height={chartHeight - 26}
                    fill={block.color}
                    opacity={0.18}
                  />
                  <line
                    x1={startX}
                    y1={0}
                    x2={startX}
                    y2={chartHeight - 26}
                    stroke="rgba(255, 255, 255, 0.15)"
                    strokeDasharray="4 4"
                    strokeWidth={1}
                  />
                  {activeQuartersConfig.showLabels !== false && width > 40 && (
                    <text
                      x={startX + 6}
                      y={20}
                      fill="var(--text-secondary, #cbd5e1)"
                      fontSize={10}
                      fontWeight={700}
                      opacity={0.8}
                    >
                      {block.label}
                    </text>
                  )}
                </g>
              );
            })}
        </svg>
      )}

      {/* Daye Quarterly Theory Bottom Pane */}
      {activeQuartersConfig && dayeQuarterBlocks.length > 0 && activeQuartersConfig.plotType !== 'overlay' && (() => {
        const activeCycleTypes: { type: string; label: string }[] = [];
        if (activeQuartersConfig.showYearlyQuarters) activeCycleTypes.push({ type: 'yearly', label: 'Year' });
        if (activeQuartersConfig.showMonthlyQuarters) activeCycleTypes.push({ type: 'monthly', label: 'Month' });
        if (activeQuartersConfig.showWeeklyQuarters !== false) activeCycleTypes.push({ type: 'weekly', label: 'Week' });
        if (activeQuartersConfig.showDailyQuarters !== false) activeCycleTypes.push({ type: 'daily', label: 'Day' });
        if (activeQuartersConfig.show90minCycles !== false) activeCycleTypes.push({ type: '90m', label: '90 Minute' });
        if (activeQuartersConfig.showMicroCycles) activeCycleTypes.push({ type: 'micro', label: 'Micro' });

        const rowCount = Math.max(1, activeCycleTypes.length);
        const totalH = dayeQuartersHeight;
        const headerH = 22;
        const bodyH = Math.max(30, totalH - headerH);
        const rowH = Math.max(10, Math.floor(bodyH / rowCount));

        const borderStroke = activeQuartersConfig.borderAuto !== false
          ? 'var(--border-color, rgba(255, 255, 255, 0.12))'
          : (activeQuartersConfig.borderColor || '#000000');

        const shouldShowLabels = activeQuartersConfig.showLabels !== false;

        const cycleRowIndexMap = new Map<string, number>();
        activeCycleTypes.forEach((c, idx) => cycleRowIndexMap.set(c.type, idx));

        return (
          <div
            className="daye-quarters-bottom-pane"
            style={{ bottom: '26px', height: `${totalH}px` }}
            onPointerMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              setCrosshairPos((prev) => ({ ...prev, x }));
            }}
            onPointerLeave={() => setCrosshairPos({ x: null, time: null })}
          >
            {/* Top Border Resize Drag Handle */}
            <div
              className="rsi-pane-resize-handle"
              onPointerDown={handleDayeResizePointerDown}
              title="Tarik ke atas / bawah untuk mengubah ukuran Daye Quarterly pane"
            >
              <div className="rsi-pane-resize-bar" />
            </div>

            <div className="daye-quarters-header">
              <div className="daye-quarters-header-left">
                <span
                  className="daye-quarters-dot"
                  style={{ background: activeQuartersConfig.color || '#38bdf8' }}
                />
                <span className="daye-quarters-title">Daye Quarterly Theory®</span>

                <div className="daye-quarters-actions">
                  <button
                    className="daye-pane-action-btn"
                    onClick={() => toggleIndicator(activeQuartersConfig.id)}
                    title={activeQuartersConfig.enabled ? 'Sembunyikan' : 'Tampilkan'}
                  >
                    {activeQuartersConfig.enabled ? <Eye size={12} /> : <EyeOff size={12} />}
                  </button>
                  <button
                    className="daye-pane-action-btn"
                    onClick={() => setSettingsModalId(activeQuartersConfig.id)}
                    title="Pengaturan Daye Quarters"
                  >
                    <Settings size={12} />
                  </button>
                  <button
                    className="daye-pane-action-btn is-del"
                    onClick={() => removeIndicator(activeQuartersConfig.id)}
                    title="Hapus Indikator"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              <div className="daye-quarters-badges">
                <span className="daye-badge q1">Q1 Acc</span>
                <span className="daye-badge q2">Q2 Mani</span>
                <span className="daye-badge q3">Q3 Dist</span>
                <span className="daye-badge q4">Q4 Rev</span>
              </div>
            </div>

            <div className="daye-quarters-body" style={{ height: `${bodyH}px` }}>
              {/* Left labels overlay */}
              <div className="daye-quarters-labels-col">
                {activeCycleTypes.map((c) => (
                  <div key={c.type} className="daye-quarters-row-label" style={{ height: `${rowH}px` }}>
                    {c.label}
                  </div>
                ))}
              </div>

              {/* Time-synchronized SVG Grid matching exact candle timestamps */}
              <svg className="daye-quarters-svg" width={chartWidth} height={bodyH}>
                {dayeQuarterBlocks.map((block: DayeQuarterBlock, idx: number) => {
                  const rIdx = cycleRowIndexMap.get(block.cycleType);
                  if (rIdx === undefined) return null;

                  const x1 = timeToX(block.startTime);
                  const x2 = timeToX(block.endTime);
                  if (x1 === null && x2 === null) return null;

                  const startX = x1 !== null ? x1 : 0;
                  const endX = x2 !== null ? x2 : chartWidth;
                  if (startX > chartWidth + 50 || endX < -50) return null;
                  const width = Math.max(1, endX - startX);

                  const rowY = rIdx * rowH;
                  const currentHeight = rIdx === rowCount - 1 ? bodyH - rowY : rowH;

                  return (
                    <g key={`${block.cycleType}-${block.startTime}-${idx}`}>
                      <rect
                        x={startX}
                        y={rowY}
                        width={width}
                        height={currentHeight}
                        fill={block.color}
                        stroke={borderStroke}
                        strokeWidth={1}
                      />
                      {shouldShowLabels && width > 28 && (
                        <text
                          x={startX + width / 2}
                          y={rowY + Math.max(10, currentHeight / 2 + 4)}
                          fill="var(--text-secondary, #cbd5e1)"
                          fontSize={Math.min(10, Math.max(8, currentHeight * 0.45))}
                          fontWeight={700}
                          textAnchor="middle"
                          letterSpacing={0.2}
                        >
                          {block.quarterName}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Crosshair Vertical Line across Daye Quarters Pane */}
                {crosshairPos.x !== null && crosshairPos.x >= 0 && crosshairPos.x <= chartWidth && (
                  <line
                    x1={crosshairPos.x}
                    y1={0}
                    x2={crosshairPos.x}
                    y2={bodyH}
                    stroke="rgba(255, 255, 255, 0.45)"
                    strokeDasharray="3 3"
                    strokeWidth={1}
                    pointerEvents="none"
                  />
                )}
              </svg>
            </div>
          </div>
        );
      })()}

      {/* RSI Full-Width Bottom Sub-Pane Oscillators (TradingView-style) */}
      {activeRsiConfigs.length > 0 && (
        <>
          {activeRsiConfigs.map((conf, idx) => {
            const data = rsiResultsMap.get(conf.id);
            if (!data || data.points.length === 0) return null;
            const pts = data.points;

            const currentVal = pts[pts.length - 1].value;
            const ob = conf.overbought ?? 70;
            const mid = conf.middle ?? 50;
            const os = conf.oversold ?? 30;

            const paneH = rsiHeight;
            const headerH = 22;
            const bodyH = paneH - headerH;
            const rightScaleW = 60;
            const plotW = Math.max(10, chartWidth - rightScaleW);

            const topPad = 8;
            const bottomPad = 8;
            const plotH = Math.max(10, bodyH - topPad - bottomPad);

            const scaleFactor = rsiScaleFactors[conf.id] || 1.0;
            const panOffset = rsiPanOffsets[conf.id] || 0;
            const halfSpan = 50 / scaleFactor;
            const center = 50 + panOffset;
            const minY = center - halfSpan;
            const maxY = center + halfSpan;
            const rangeY = Math.max(1, maxY - minY);

            const rsiToY = (v: number) => {
              const norm = (v - minY) / rangeY;
              return topPad + (1 - norm) * plotH;
            };

            const obY = rsiToY(ob);
            const midY = rsiToY(mid);
            const osY = rsiToY(os);

            const fromTime = visibleRange?.from ? Number(visibleRange.from) : null;
            const toTime = visibleRange?.to ? Number(visibleRange.to) : null;

            let startIdx = 0;
            let endIdx = pts.length;
            if (fromTime !== null && toTime !== null && pts.length > 0) {
              const span = toTime - fromTime;
              const buffer = span * 0.2;
              const minT = fromTime - buffer;
              const maxT = toTime + buffer;
              startIdx = Math.max(0, findLastIdx(pts as any, minT) - 1);
              endIdx = Math.min(pts.length, findLastIdx(pts as any, maxT) + 2);
            }

            const visiblePts = pts.slice(startIdx, endIdx);

            // Compute continuous polyline path across visible candles only
            let rsiPathD = '';
            for (const pt of visiblePts) {
              const x = timeToX(pt.time);
              if (x === null) continue;
              const y = rsiToY(pt.value);
              rsiPathD += rsiPathD === '' ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
            }

            // Use precomputed MA and Bollinger Bands with visible viewport culling
            const maPoints = data.maPoints;
            let maStartIdx = 0;
            let maEndIdx = maPoints.length;
            if (fromTime !== null && toTime !== null && maPoints.length > 0) {
              const span = toTime - fromTime;
              const buffer = span * 0.2;
              const minT = fromTime - buffer;
              const maxT = toTime + buffer;
              maStartIdx = Math.max(0, findLastIdx(maPoints as any, minT) - 1);
              maEndIdx = Math.min(maPoints.length, findLastIdx(maPoints as any, maxT) + 2);
            }

            const visibleMaPts = maPoints.slice(maStartIdx, maEndIdx);
            let maPathD = '';
            let upperBbPathD = '';
            let lowerBbPathD = '';

            for (const mp of visibleMaPts) {
              const x = timeToX(mp.time);
              if (x === null) continue;
              const y = rsiToY(mp.value);
              maPathD += maPathD === '' ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`;

              if (mp.upperBb !== undefined) {
                const uy = rsiToY(mp.upperBb);
                upperBbPathD += upperBbPathD === '' ? `M ${x.toFixed(1)} ${uy.toFixed(1)}` : ` L ${x.toFixed(1)} ${uy.toFixed(1)}`;
              }
              if (mp.lowerBb !== undefined) {
                const ly = rsiToY(mp.lowerBb);
                lowerBbPathD += lowerBbPathD === '' ? `M ${x.toFixed(1)} ${ly.toFixed(1)}` : ` L ${x.toFixed(1)} ${ly.toFixed(1)}`;
              }
            }

            const divergences = data.divergences;
            const currentMaVal = data.currentMaVal;

            const yLastRsi = rsiToY(currentVal);
            const yLastMa = currentMaVal !== null ? rsiToY(currentMaVal) : null;

            // Determine active crosshair X on chart or inside this pane
            const crosshairX = rsiHoverState?.confId === conf.id ? rsiHoverState.x : crosshairPos.x;
            const isCrosshairActive = crosshairX !== null && crosshairX >= 0 && crosshairX <= plotW;

            // Find point under crosshair
            let activePoint = crosshairPos.time ? pts.find((p) => p.time === crosshairPos.time) || null : null;
            if (!activePoint && crosshairX !== null) {
              let closestDist = Infinity;
              for (const p of pts) {
                const px = timeToX(p.time);
                if (px !== null) {
                  const dist = Math.abs(px - crosshairX);
                  if (dist < closestDist && dist < 25) {
                    closestDist = dist;
                    activePoint = p;
                  }
                }
              }
            }

            const displayRsiVal = activePoint ? activePoint.value : currentVal;
            const activePointY = activePoint ? rsiToY(activePoint.value) : null;

            // Hover Y in subpane
            const isHoveredInThisPane = rsiHoverState?.confId === conf.id;
            const hoverY = isHoveredInThisPane ? rsiHoverState.y : null;
            const cursorRsiVal =
              hoverY !== null
                ? Math.max(0, Math.min(100, maxY - ((hoverY - topPad) / plotH) * rangeY))
                : null;

            const quartersOffset = activeQuartersConfig && dayeQuarterBlocks.length > 0 ? dayeQuartersHeight : 0;
            const bottomPosition = 26 + quartersOffset + (activeRsiConfigs.length - 1 - idx) * (paneH + 2);

            const clampedObY = Math.max(0, Math.min(bodyH, obY));
            const clampedOsY = Math.max(0, Math.min(bodyH, osY));
            const bandTop = Math.min(clampedObY, clampedOsY);
            const bandHeight = Math.max(0, Math.abs(clampedOsY - clampedObY));

            return (
              <div
                key={conf.id}
                className="rsi-bottom-subpane"
                style={{ bottom: `${bottomPosition}px`, height: `${paneH}px` }}
              >
                {/* Top Border Resize Drag Handle */}
                <div
                  className="rsi-pane-resize-handle"
                  onPointerDown={handleRsiResizePointerDown}
                  title="Tarik ke atas / bawah untuk mengubah ukuran sub-pane"
                >
                  <div className="rsi-pane-resize-bar" />
                </div>

                {/* Sub-Pane Header Bar */}
                <div className="rsi-pane-header">
                  <div className="rsi-pane-header-left">
                    <span
                      className="rsi-pane-dot"
                      style={{ background: conf.color || '#a855f7' }}
                    />
                    <span className="rsi-pane-title">
                      {conf.name || `RSI ${conf.period} ${conf.source}`}
                    </span>
                    <span className="rsi-pane-live-val" style={{ color: conf.color || '#a855f7' }}>
                      {displayRsiVal.toFixed(2)}
                    </span>
                    {currentMaVal !== null && (
                      <span className="rsi-pane-live-ma-val" title="RSI-based MA (SMA 14)">
                        {currentMaVal.toFixed(2)}
                      </span>
                    )}

                    <div className="rsi-pane-actions">
                      <button
                        className="rsi-pane-action-btn"
                        onClick={() => toggleIndicator(conf.id)}
                        title={conf.enabled ? 'Sembunyikan' : 'Tampilkan'}
                      >
                        {conf.enabled ? <Eye size={12} /> : <EyeOff size={12} />}
                      </button>
                      <button
                        className="rsi-pane-action-btn"
                        onClick={() => setSettingsModalId(conf.id)}
                        title="Pengaturan RSI"
                      >
                        <Settings size={12} />
                      </button>
                      <button
                        className="rsi-pane-action-btn is-del"
                        onClick={() => removeIndicator(conf.id)}
                        title="Hapus Indikator"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="rsi-pane-header-badges">
                    {(scaleFactor !== 1.0 || panOffset !== 0) && (
                      <button
                        className="rsi-reset-scale-btn"
                        onClick={(e) => handleResetRsiView(conf.id, e)}
                        title="Klik untuk reset skala Y dan posisi pan"
                      >
                        Reset Skala Y {scaleFactor !== 1.0 ? `(${scaleFactor.toFixed(1)}x)` : ''}
                      </button>
                    )}
                    <span className="rsi-level-badge">OB {ob}</span>
                    <span className="rsi-level-badge">OS {os}</span>
                  </div>
                </div>

                {/* Sub-Pane Main Body (Plot SVG + Right Y-Axis Scale) */}
                <div
                  className="rsi-pane-body"
                  title="Klik dan geser (drag) untuk pan atas / bawah • Klik ganda untuk reset"
                  onPointerMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    setRsiHoverState({ confId: conf.id, x, y });
                  }}
                  onPointerLeave={() => setRsiHoverState(null)}
                >
                  <svg
                    className={`rsi-plot-svg ${isPanningRsiId === conf.id ? 'is-panning' : ''}`}
                    width={plotW}
                    height={bodyH}
                    onPointerDown={(e) => handlePlotPointerDown(conf.id, plotH, rangeY, e)}
                    onDoubleClick={(e) => handleResetRsiView(conf.id, e)}
                  >
                    <defs>
                      <linearGradient id={`rsi-band-grad-${conf.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={conf.color || '#a855f7'} stopOpacity="0.16" />
                        <stop offset="100%" stopColor={conf.color || '#a855f7'} stopOpacity="0.04" />
                      </linearGradient>
                    </defs>

                    {/* Shaded 30-70 / 20-80 Zone */}
                    {conf.showBackgroundFill !== false && (
                      <rect
                        x={0}
                        y={bandTop}
                        width={plotW}
                        height={bandHeight}
                        fill={`url(#rsi-band-grad-${conf.id})`}
                      />
                    )}

                    {/* Overbought Level Line */}
                    {conf.showUpperBand !== false && obY >= 0 && obY <= bodyH && (
                      <line
                        x1={0}
                        y1={obY}
                        x2={plotW}
                        y2={obY}
                        stroke={conf.color || '#a855f7'}
                        strokeOpacity={0.5}
                        strokeDasharray="4 4"
                        strokeWidth={1}
                      />
                    )}

                    {/* Middle (50) Level Line */}
                    {conf.showMiddleBand !== false && midY >= 0 && midY <= bodyH && (
                      <line
                        x1={0}
                        y1={midY}
                        x2={plotW}
                        y2={midY}
                        stroke="rgba(255, 255, 255, 0.22)"
                        strokeDasharray="2 2"
                        strokeWidth={1}
                      />
                    )}

                    {/* Oversold Level Line */}
                    {conf.showLowerBand !== false && osY >= 0 && osY <= bodyH && (
                      <line
                        x1={0}
                        y1={osY}
                        x2={plotW}
                        y2={osY}
                        stroke={conf.color || '#a855f7'}
                        strokeOpacity={0.5}
                        strokeDasharray="4 4"
                        strokeWidth={1}
                      />
                    )}

                    {/* RSI Curve (Time-synchronized continuous polyline across full chart width) */}
                    {rsiPathD && (
                      <path
                        d={rsiPathD}
                        fill="none"
                        stroke={conf.color || '#a855f7'}
                        strokeWidth={conf.lineWidth || 1.8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}

                    {/* RSI-based Moving Average (SMA, EMA, RMA, WMA) */}
                    {conf.showMa !== false && maPathD && (
                      <path
                        d={maPathD}
                        fill="none"
                        stroke={conf.maColor || '#eab308'}
                        strokeWidth={1.3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}

                    {/* Bollinger Bands on RSI */}
                    {conf.showMa !== false && upperBbPathD && (
                      <path
                        d={upperBbPathD}
                        fill="none"
                        stroke="rgba(234, 179, 8, 0.45)"
                        strokeWidth={1}
                        strokeDasharray="2 2"
                      />
                    )}
                    {conf.showMa !== false && lowerBbPathD && (
                      <path
                        d={lowerBbPathD}
                        fill="none"
                        stroke="rgba(234, 179, 8, 0.45)"
                        strokeWidth={1}
                        strokeDasharray="2 2"
                      />
                    )}

                    {/* RSI Divergences (Bullish / Bearish lines & markers) */}
                    {divergences.map((div, dIdx) => {
                      const x1 = timeToX(div.time1);
                      const x2 = timeToX(div.time2);
                      if (x1 === null || x2 === null) return null;
                      const y1 = rsiToY(div.rsi1);
                      const y2 = rsiToY(div.rsi2);

                      return (
                        <g key={`div-${dIdx}`}>
                          <line
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                            stroke={div.color}
                            strokeWidth={1.8}
                            strokeDasharray="3 2"
                          />
                          <circle cx={x1} cy={y1} r={3} fill={div.color} />
                          <circle cx={x2} cy={y2} r={3} fill={div.color} />
                          <text
                            x={x2}
                            y={div.type.includes('bull') ? y2 + 12 : y2 - 6}
                            fill={div.color}
                            fontSize={9}
                            fontWeight={800}
                            textAnchor="middle"
                          >
                            {div.label}
                          </text>
                        </g>
                      );
                    })}

                    {/* Crosshair Vertical Line across RSI Pane */}
                    {isCrosshairActive && (
                      <line
                        x1={crosshairX}
                        y1={0}
                        x2={crosshairX}
                        y2={bodyH}
                        stroke="rgba(255, 255, 255, 0.45)"
                        strokeDasharray="3 3"
                        strokeWidth={1}
                        pointerEvents="none"
                      />
                    )}

                    {/* Crosshair Horizontal Line inside RSI Pane */}
                    {hoverY !== null && hoverY >= 0 && hoverY <= bodyH && (
                      <line
                        x1={0}
                        y1={hoverY}
                        x2={plotW}
                        y2={hoverY}
                        stroke="rgba(255, 255, 255, 0.45)"
                        strokeDasharray="3 3"
                        strokeWidth={1}
                        pointerEvents="none"
                      />
                    )}

                    {/* Crosshair Highlight Circle on RSI Curve */}
                    {isCrosshairActive && activePointY !== null && (
                      <circle
                        cx={crosshairX}
                        cy={activePointY}
                        r={3.5}
                        fill={conf.color || '#a855f7'}
                        stroke="#ffffff"
                        strokeWidth={1.5}
                        pointerEvents="none"
                      />
                    )}
                  </svg>

                  {/* Right Y-Axis Scale (Drag up/down to stretch/shrink vertical scale, double click to reset) */}
                  <div
                    className="rsi-axis-column"
                    style={{ width: `${rightScaleW}px`, height: `${bodyH}px` }}
                    onPointerDown={(e) => handleAxisPointerDown(conf.id, e)}
                    onDoubleClick={(e) => handleResetRsiView(conf.id, e)}
                    title="Tarik ke atas/bawah untuk zoom skala vertikal Y • Klik ganda untuk reset"
                  >
                    {[80, 70, 50, 30, 20].map((lvl) => {
                      const yLvl = rsiToY(lvl);
                      if (yLvl < 6 || yLvl > bodyH - 6) return null;
                      return (
                        <span key={lvl} className="rsi-axis-label" style={{ top: `${Math.round(yLvl - 6)}px` }}>
                          {lvl.toFixed(2)}
                        </span>
                      );
                    })}

                    {/* Live RSI Price Badge */}
                    <div
                      className="rsi-axis-live-badge is-rsi"
                      style={{
                        top: `${Math.max(2, Math.min(bodyH - 16, yLastRsi - 7))}px`,
                        background: conf.color || '#a855f7',
                      }}
                    >
                      {currentVal.toFixed(2)}
                    </div>

                    {/* Live RSI MA Price Badge */}
                    {yLastMa !== null && currentMaVal !== null && Math.abs(yLastMa - yLastRsi) > 14 && (
                      <div
                        className="rsi-axis-live-badge is-ma"
                        style={{
                          top: `${Math.max(2, Math.min(bodyH - 16, yLastMa - 7))}px`,
                        }}
                      >
                        {currentMaVal.toFixed(2)}
                      </div>
                    )}

                    {/* Cursor Hover Value Badge on Right Axis */}
                    {hoverY !== null && cursorRsiVal !== null && (
                      <div
                        className="rsi-axis-live-badge is-crosshair"
                        style={{
                          top: `${Math.max(2, Math.min(bodyH - 16, hoverY - 7))}px`,
                        }}
                      >
                        {cursorRsiVal.toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}
      {/* Indicator Settings Pop-up Modal */}
      <IndicatorSettingsModal
        isOpen={!!settingsModalId}
        indicatorId={settingsModalId}
        onClose={() => setSettingsModalId(null)}
      />
    </div>
  );
};

export default IndicatorsLayer;
