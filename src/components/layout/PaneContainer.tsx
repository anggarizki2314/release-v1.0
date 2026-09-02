/**
 * PaneContainer — one fully-isolated chart pane.
 *
 * Owns:
 *   - symbolId / timeframe (read from workspace.panes[paneId])
 *   - useCandles instance (data fetching for this pane only)
 *   - ChartContainer (one Lightweight Charts instance)
 *   - DrawingCanvas (one DrawingEngine instance)
 *   - ReplayProvider (replay context scoped to this pane)
 *
 * Nothing leaks to sibling panes.
 */
import { CSSProperties, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { UploadCloud, ChevronDown, RotateCcw, Star, Camera } from 'lucide-react';
import ChartContainer, { ChartContainerHandle } from '@components/chart/ChartContainer';
import ReplayTimeline from '@components/replay/ReplayTimeline';
import FloatingReplayBar from './FloatingReplayBar';
import ReplaySetupModal from '@components/replay/ReplaySetupModal';
import DrawingCanvas from '@features/drawing/components/DrawingCanvas';
import ContextMenu from '@features/chart/components/ContextMenu';
import { TIMEFRAME_OPTIONS, type SymbolInfo, type Timeframe, type Candle } from '@/types';
import { canDisplayTimeframe, useCandles, findLastIdx, resolveReplayCandles } from '@features/chart';
import { ReplayProvider, useReplay } from '@features/replay';
import { useChartFilteredCandles } from '@features/replay/useChartFilter';
import { getReplayDerived } from '@features/replay/replayDerived';
import type { DrawingEngine } from '@features/drawing/engine/DrawingEngine';
import type { DrawingTypeId } from '@features/drawing/engine/types';
import { useWorkspace } from '@features/workspace';
import type { AnalyticsSession } from '@features/analytics/types';
import { saveReplayState } from '@features/backtest/sessionRepository';
import { RealOrderOverlay } from '@features/trading2/integration/RealOrderOverlay';
import { TradeHistoryOverlay } from '@features/trading2/integration/TradeHistoryOverlay';
import { NewsEventOverlay } from '@features/news';
import { IndicatorsLayer, useIndicatorStore, calculateBottomIndicatorsHeight } from '@features/indicators';
import type { OrderModel } from '@features/trading2/order/OrderTypes';
import { tradingEngine } from '@features/trading2/TradingEngineService';
import { activeChartBridge } from '@features/trading2/integration/ActiveChartBridge';
import { captureCompleteChart } from '@/utils/chartScreenshot';
import { REPLAY_DEBUG } from '@/config/debug';
import './MainChartArea.css';

interface PaneContainerProps {
  paneId: string;
  /** All symbols available for selection (used for display/lookup). */
  symbols: SymbolInfo[];
  timezone: string;
  activeTool: string;
  magnetEnabled?: boolean;
  onActiveToolChange: (tool: string) => void;
  style?: CSSProperties;
  activeSession?: AnalyticsSession | null;
}

/**
 * Outer component: owns useCandles + wraps with ReplayProvider,
 * then renders the inner component which consumes useReplay().
 */
export default function PaneContainer({
  paneId,
  symbols,
  timezone,
  activeTool,
  magnetEnabled,
  onActiveToolChange,
  style,
  activeSession,
}: PaneContainerProps) {
  const { workspace } = useWorkspace();
  const pane = workspace.panes.find((p) => p.paneId === paneId) ?? workspace.panes[0];

  const timeframe = pane.timeframe as Timeframe;

  // Filter symbols strictly to activeSession selected symbols if activeSession exists
  const validSymbols = activeSession && activeSession.symbols && activeSession.symbols.length > 0
    ? symbols.filter((s) => activeSession.symbols?.includes(s.name))
    : symbols;

  const selectedSymbol = validSymbols.find((s) => s.id === pane.symbolId) ?? validSymbols[0] ?? null;
  const symbolId = selectedSymbol?.id ?? null;

  return (
    <PaneContainerInner
      paneId={paneId}
      symbols={validSymbols}
      symbolId={symbolId}
      timeframe={timeframe}
      selectedSymbol={selectedSymbol}
      timezone={timezone}
      style={style}
      activeTool={activeTool}
      magnetEnabled={magnetEnabled}
      onActiveToolChange={onActiveToolChange}
      activeSession={activeSession}
    />
  );
}

interface InnerProps {
  paneId: string;
  symbols: SymbolInfo[];
  symbolId: number | null;
  timeframe: Timeframe;
  selectedSymbol: SymbolInfo | null;
  timezone: string;
  style?: CSSProperties;
  activeTool: string;
  magnetEnabled?: boolean;
  onActiveToolChange: (tool: string) => void;
  activeSession?: AnalyticsSession | null;
}

function PaneContainerInner({
  paneId,
  symbols,
  symbolId,
  timeframe,
  selectedSymbol,
  timezone,
  style,
  activeTool,
  magnetEnabled,
  onActiveToolChange,
  activeSession,
}: InnerProps) {

  const hasData = canDisplayTimeframe(selectedSymbol, timeframe);
  const chartRef = useRef<ChartContainerHandle>(null);
  const drawingEngineRef = useRef<DrawingEngine | null>(null);
  const draftDrawingIdRef = useRef<string | null>(null);
  const paneRenderCountRef = useRef(0);
  paneRenderCountRef.current += 1;

  const dynamicTfOptions = useMemo(() => {
    if (!selectedSymbol) return TIMEFRAME_OPTIONS;
    
    const customTfs = selectedSymbol.timeframes.filter(
      (tf) => !TIMEFRAME_OPTIONS.find((o) => o.value === tf)
    );

    const customOptions = customTfs.map((tf) => {
      let label = tf;
      if (tf.startsWith('M')) label = tf.slice(1) + 'm';
      else if (tf.startsWith('H')) label = tf.slice(1) + 'H';
      else if (tf.startsWith('D')) label = tf.slice(1) + 'D';
      else if (tf.startsWith('W')) label = tf.slice(1) + 'W';
      return { value: tf as Timeframe, label };
    });

    const tfToMinutes = (tf: string) => {
      if (tf === 'Monthly' || tf === '1MN') return 43200;
      const match = tf.match(/^([MHDW]?)(\d+)([MHDW]?)$/i);
      if (!match) return 0;
      const unit = (match[1] || match[3] || 'M').toUpperCase();
      const val = parseInt(match[2], 10);
      if (unit === 'H') return val * 60;
      if (unit === 'D') return val * 1440;
      if (unit === 'W') return val * 10080;
      return val; // M
    };

    const allOptions = [...TIMEFRAME_OPTIONS, ...customOptions];
    allOptions.sort((a, b) => tfToMinutes(a.value) - tfToMinutes(b.value));
    
    return allOptions;
  }, [selectedSymbol]);

  const { replayState, sessionReady, replayStatus, cancelReplaySelection, exitReplayMode } = useReplay();

  const [topbarSlotEl, setTopbarSlotEl] = useState<HTMLElement | null>(() =>
    typeof document !== 'undefined' ? document.getElementById('topbar-replay-slot') : null
  );

  useEffect(() => {
    const el = document.getElementById('topbar-replay-slot');
    if (el) {
      setTopbarSlotEl(el);
    } else {
      const timer = setTimeout(() => {
        setTopbarSlotEl(document.getElementById('topbar-replay-slot'));
      }, 50);
      return () => clearTimeout(timer);
    }
  }, []);

  const {
    candles: allCandles,
    m1Candles,
    loadingMore,
    hasMoreBefore,
    hasMoreAfter,
    loadMoreBefore,
    loadMoreAfter,
    loadMoreFuture,
    resetToken,
  } = useCandles(symbolId, timeframe, activeSession);

  // Auto-prefetch future candles for this pane's symbol (e.g. GBPUSD in layout 2) when replay time advances
  useEffect(() => {
    const isReplayActive = replayState.isReplayMode || replayState.currentReplayTime !== null || activeSession?.currentReplayTime !== null;
    if (!isReplayActive) return;

    const curTime = replayState.currentReplayTime ?? activeSession?.currentReplayTime ?? null;
    if (!curTime) return;

    const lastLoadedTime = m1Candles && m1Candles.length > 0
      ? m1Candles[m1Candles.length - 1].time
      : (allCandles && allCandles.length > 0 ? allCandles[allCandles.length - 1].time : 0);

    if (lastLoadedTime > 0 && curTime >= lastLoadedTime - 5 * 86400) {
      void loadMoreFuture(curTime);
    }
  }, [replayState.currentReplayTime, replayState.isReplayMode, activeSession?.currentReplayTime, m1Candles, allCandles, loadMoreFuture]);

  const isDatasetReady = allCandles && allCandles.length > 0;

  if (REPLAY_DEBUG) {
    console.log(`[REACT LIFECYCLE] PaneContainer render #${paneRenderCountRef.current}`, {
      paneId,
      sessionReady,
      isDatasetReady,
      replayStatus: replayStatus ?? replayState.status,
      allCandlesCount: allCandles.length,
      willMountChartContainer: sessionReady,
    });
  }

  useEffect(() => {
    if (REPLAY_DEBUG) {
      console.log(`[REACT LIFECYCLE] PaneContainer MOUNTED (paneId: ${paneId})`);
    }
    return () => {
      if (REPLAY_DEBUG) {
        console.log(`[REACT LIFECYCLE] PaneContainer UNMOUNTING (paneId: ${paneId})`);
        console.trace(`[REACT LIFECYCLE STACK] PaneContainer unmounted from:`);
      }
    };
  }, [paneId]);

  const [chartApi, setChartApi] = useState<any>(null);
  const [seriesApi, setSeriesApi] = useState<any>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; clickedPrice?: number | null; clickedDrawingId?: string | null } | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const { workspace, setActivePaneId, updatePaneTimeframe } = useWorkspace();
  const hasAutoSwitchedToM5Ref = useRef(false);

  // Reset auto-switch flag when session changes
  useEffect(() => {
    hasAutoSwitchedToM5Ref.current = false;
  }, [activeSession?.id]);

  // Auto-switch from M3 to M5 once initial candle load is completely finished
  useEffect(() => {
    if (timeframe === 'M3' && allCandles.length > 0 && sessionReady && !hasAutoSwitchedToM5Ref.current) {
      hasAutoSwitchedToM5Ref.current = true;
      console.log('[PaneContainer] Initial candle load completed on M3, auto-switching to M5...');
      const timer = setTimeout(() => {
        updatePaneTimeframe(paneId, 'M5');
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [timeframe, allCandles.length, sessionReady, paneId, updatePaneTimeframe]);

  const [showTradeHistory, setShowTradeHistory] = useState<boolean>(() => {
    try {
      return localStorage.getItem('tradepro_show_trade_history') !== 'false';
    } catch {
      return true;
    }
  });

  const [showNewsEvents, setShowNewsEvents] = useState<boolean>(() => {
    try {
      return localStorage.getItem('tradepro_show_news_events') !== 'false';
    } catch {
      return true;
    }
  });

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((current) => (current === msg ? null : current));
    }, 4000);
  }, []);

  const handleToggleTradeHistory = useCallback(() => {
    setShowTradeHistory((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('tradepro_show_trade_history', String(next));
      } catch {}
      showToast(next ? 'Riwayat trade ditampilkan di chart' : 'Riwayat trade disembunyikan dari chart');
      return next;
    });
  }, [showToast]);

  const handleToggleNewsEvents = useCallback(() => {
    setShowNewsEvents((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('tradepro_show_news_events', String(next));
      } catch {}
      showToast(next ? 'Berita ekonomi ditampilkan di chart' : 'Berita ekonomi disembunyikan dari chart');
      return next;
    });
  }, [showToast]);

  useEffect(() => {
    const handleToastEvent = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        showToast(customEvent.detail);
      }
    };
    window.addEventListener('show-toast', handleToastEvent);
    return () => window.removeEventListener('show-toast', handleToastEvent);
  }, [showToast]);

  // Check for chart/series readiness
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    const poll = () => {
      const c = chartRef.current?.getChart();
      const s = chartRef.current?.getSeries();
      if (c && s) {
        setChartApi(c);
        setSeriesApi(s);
        if (interval) clearInterval(interval);
      }
    };
    poll();
    interval = setInterval(poll, 50);
    return () => { if (interval) clearInterval(interval); };
  }, [timeframe, symbolId, sessionReady]);

  // Escape key handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (replayState.status === 'selecting') {
          cancelReplaySelection();
        } else if (replayState.isReplayMode) {
          exitReplayMode();
        } else if (activeTool !== 'select' && activeTool !== 'crosshair') {
          onActiveToolChange('select');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [replayState.status, replayState.isReplayMode, cancelReplaySelection, exitReplayMode, activeTool, onActiveToolChange]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    let price: number | null = null;
    if (seriesApi) {
      const rect = e.currentTarget.getBoundingClientRect();
      const offsetY = e.clientY - rect.top;
      price = seriesApi.coordinateToPrice(offsetY);
    }
    // Hit test to detect right-click on a drawing
    let clickedDrawingId: string | null = null;
    const engine = drawingEngineRef.current;
    if (engine && chartApi && seriesApi) {
      const rect = e.currentTarget.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const timeScale = chartApi.timeScale();
      const timeToX = (t: number) => timeScale.timeToCoordinate(t as any) ?? -9999;
      const priceToY = (p: number) => seriesApi.priceToCoordinate(p) ?? -9999;
      const hit = engine.hitTester.test(engine.drawings.all, cx, cy, timeToX, priceToY);
      if (hit?.drawing) clickedDrawingId = hit.drawing.id;
    }
    setContextMenu({ x: e.clientX, y: e.clientY, clickedPrice: price, clickedDrawingId });
  };

  const isActive = workspace.activePaneId === paneId;

  // Global reset-active-chart listener (triggered from TopBar Reset Chart button)
  useEffect(() => {
    const handleReset = () => {
      if (isActive) {
        chartRef.current?.resetChartView();
      }
    };
    window.addEventListener('reset-active-chart', handleReset);
    return () => window.removeEventListener('reset-active-chart', handleReset);
  }, [isActive]);

  // Global capture-screenshot listener
  useEffect(() => {
    const handleCapture = async (e: Event) => {
      if (!isActive) return;
      const customEvent = e as CustomEvent<{ onCapture: (dataUrl: string, tf: string) => void }>;
      if (customEvent.detail?.onCapture && chartApi) {
        try {
          const dataUrl = await captureCompleteChart(sectionRef.current, chartApi);
          customEvent.detail.onCapture(dataUrl, timeframe);
        } catch (err) {
          console.error('Failed to capture screenshot', err);
        }
      }
    };
    window.addEventListener('capture-active-chart-screenshot', handleCapture);
    return () => window.removeEventListener('capture-active-chart-screenshot', handleCapture);
  }, [isActive, chartApi, timeframe]);
  // Register active chart state with ActiveChartBridge.
  // In replay mode, derives currentReplayTime and resolves currentPrice by exact visible chart bar.
  useEffect(() => {
    if (!selectedSymbol?.name) return;
    const derived = getReplayDerived(allCandles, replayState);
    const effectiveReplayTime =
      replayState.currentReplayTime ??
      activeSession?.currentReplayTime ??
      (derived.currentReplayTime != null
        ? derived.currentReplayTime
        : (replayState.isReplayMode && replayState.currentReplayIndex !== null && allCandles[replayState.currentReplayIndex]
          ? allCandles[replayState.currentReplayIndex].time
          : null));

    const isReplay = replayState.isReplayMode || effectiveReplayTime !== null;
    const currentReplayTime = effectiveReplayTime ?? (allCandles.length > 0 ? allCandles[allCandles.length - 1].time : 0);

    let currentPrice = 0;
    if (isReplay && effectiveReplayTime !== null) {
      const resolved = resolveReplayCandles({
        timeframe,
        currentReplayTime: effectiveReplayTime,
        tfCandles: allCandles,
        m1Candles: m1Candles ?? [],
        symbolId,
      });
      if (resolved.length > 0) {
        currentPrice = resolved[resolved.length - 1].close;
      } else if (allCandles.length > 0) {
        const idx = findLastIdx(allCandles, effectiveReplayTime);
        if (idx >= 0) currentPrice = allCandles[idx].close;
      }
    } else if (allCandles.length > 0) {
      currentPrice = allCandles[allCandles.length - 1].close;
    }

    // Forward secondary symbol replay ticks to tradingEngine so secondary pairs also execute accurately
    if (isReplay && effectiveReplayTime !== null && selectedSymbol.name !== activeSession?.symbol) {
      const resolved = resolveReplayCandles({
        timeframe,
        currentReplayTime: effectiveReplayTime,
        tfCandles: allCandles,
        m1Candles: m1Candles ?? [],
        symbolId,
      });
      const lastCandle = resolved.length > 0 ? resolved[resolved.length - 1] : undefined;
      if (lastCandle) {
        tradingEngine.processTick(
          selectedSymbol.name,
          lastCandle.open,
          lastCandle.high,
          lastCandle.low,
          lastCandle.close,
          lastCandle.time * 1000
        );
      }
    }

    activeChartBridge.registerChartState({
      paneId,
      symbol: selectedSymbol.name,
      timeframe,
      currentReplayPrice: currentPrice,
      currentReplayTime,
      currentReplayIndex: replayState.currentReplayIndex ?? undefined,
    });
  }, [
    paneId,
    symbolId,
    selectedSymbol?.name,
    timeframe,
    allCandles,
    m1Candles,
    replayState.currentReplayIndex,
    replayState.currentReplayTime,
    replayState.isReplayMode,
    activeSession?.currentReplayTime,
  ]);

  const sectionRef = useRef<HTMLElement>(null);
  const [containerDims, setContainerDims] = useState({ width: 800, height: 600 });
  const [activeOrders, setActiveOrders] = useState<OrderModel[]>([]);

  // Track container dimensions for SVG overlay canvas
  useEffect(() => {
    if (!sectionRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerDims({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    ro.observe(sectionRef.current);
    return () => ro.disconnect();
  }, []);

  // Engine instance binding forensic log
  useEffect(() => {
    if (symbolId && selectedSymbol?.name) {
      console.log('[ENGINE-INSTANCE-BINDING]', {
        paneId,
        symbolId,
        symbol: selectedSymbol.name,
        engineInstanceId: 'TradingEngineService-Singleton',
        sessionId: activeSession?.id ?? null,
      });
    }
  }, [paneId, symbolId, selectedSymbol?.name, activeSession?.id]);

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

  // Process Market Candles through ExecutionEngine
  useEffect(() => {
    const currentSymbol = selectedSymbol?.name ?? '';
    if (!currentSymbol) return;

    const isPrimary = workspace.activePaneId ? workspace.activePaneId === paneId : true;
    const hasOpenPositionsForSymbol = tradingEngine.getOpenPositions().some(
      (p) => (p.symbol ?? '').trim().toUpperCase() === currentSymbol.trim().toUpperCase()
    );
    if (!isPrimary && !hasOpenPositionsForSymbol) return;

    // In a Replay/Backtest session: ALWAYS use the exact visible chart candle at effectiveReplayTime
    if (effectiveReplayTime !== null) {
      if (!displayCandles || displayCandles.length === 0) return;
      const execCandle = displayCandles[displayCandles.length - 1];
      if (!execCandle) return;

      const timestamp = typeof execCandle.time === 'number' ? execCandle.time * 1000 : Date.now();

      tradingEngine.processTick(
        currentSymbol,
        execCandle.open ?? execCandle.close,
        execCandle.high,
        execCandle.low,
        execCandle.close,
        timestamp
      );

      if (replayState.currentReplayIndex !== null && replayState.currentReplayIndex !== undefined) {
        tradingEngine.snapshotManager.saveSnapshot(replayState.currentReplayIndex);
      }
      return;
    }

    // Live mode (ONLY when NOT in replay mode and NOT in backtest session)
    if (!replayState.isReplayMode && !activeSession && allCandles && allCandles.length > 0) {
      const lastCandle = allCandles[allCandles.length - 1];
      if (!lastCandle) return;

      const timestamp = typeof lastCandle.time === 'number' ? lastCandle.time * 1000 : Date.now();

      tradingEngine.processTick(
        currentSymbol,
        lastCandle.open ?? lastCandle.close,
        lastCandle.high,
        lastCandle.low,
        lastCandle.close,
        timestamp
      );
    }
  }, [displayCandles, allCandles, selectedSymbol?.name, replayState.isReplayMode, effectiveReplayTime, replayState.currentReplayIndex, activeSession?.symbols, activeSession?.id, paneId, workspace.activePaneId]);


  // Subscribe activeOrders state to tradingEngine store
  useEffect(() => {
    const updateOrders = () => {
      const pending = tradingEngine.getPendingOrders();
      const openPositions = tradingEngine.getOpenPositions();
      const mappedOpenAsOrders: OrderModel[] = openPositions.map((p) => ({
        orderId: p.positionId,
        symbol: p.symbol,
        type: `${p.direction}_MARKET` as any,
        direction: p.direction,
        volume: p.volume,
        entryPrice: p.entryPrice,
        stopLoss: p.stopLoss,
        takeProfit: p.takeProfit,
        status: 'ACTIVE' as any,
        riskPercent: 1.0,
        riskDollar: 100,
        rewardDollar: 200,
        pipRisk: 0,
        pipReward: 0,
        rrRatio: 2.0,
        comment: p.comment,
        magicNumber: p.magicNumber,
        createdAt: p.openedAt,
        modifiedAt: p.modifiedAt,
      }));
      setActiveOrders([...pending, ...mappedOpenAsOrders]);
    };

    updateOrders();
    return tradingEngine.subscribe(updateOrders);
  }, []);

  // Listen for delete draft drawing request after placing order
  useEffect(() => {
    const handleDeleteDraft = (e: Event) => {
      const customEvent = e as CustomEvent<any>;
      const detail = customEvent.detail;
      if (detail && detail.paneId === paneId && detail.drawingId) {
        if (drawingEngineRef.current) {
          drawingEngineRef.current.deleteDrawing(detail.drawingId);
        }
        window.dispatchEvent(
          new CustomEvent('draft-order-selection-changed', {
            detail: { selected: false, paneId },
          })
        );
      }
    };

    window.addEventListener('delete-draft-drawing', handleDeleteDraft);
    return () => window.removeEventListener('delete-draft-drawing', handleDeleteDraft);
  }, [paneId]);

  const priceToY = useCallback((price: number): number | null => {
    const s = chartRef.current?.getSeries() ?? seriesApi;
    if (!s) return null;
    try {
      const y = s.priceToCoordinate(price);
      return typeof y === 'number' && !isNaN(y) ? y : null;
    } catch {
      return null;
    }
  }, [seriesApi]);

  const yToPrice = useCallback((y: number) => {
    const s = chartRef.current?.getSeries() ?? seriesApi;
    if (!s) return 0;
    try {
      return s.coordinateToPrice(y) ?? 0;
    } catch {
      return 0;
    }
  }, [seriesApi]);

  const handleModifyOrder = useCallback((orderId: string, updates: Partial<OrderModel>) => {
    const effectiveTime = effectiveReplayTime ?? (allCandles && allCandles.length > 0 ? allCandles[allCandles.length - 1].time : null);
    const replayNow = effectiveTime ? (effectiveTime < 10000000000 ? effectiveTime * 1000 : effectiveTime) : Date.now();
    tradingEngine.modifyOrder(orderId, updates, replayNow, replayState.currentReplayIndex ?? undefined);
  }, [effectiveReplayTime, allCandles, replayState.currentReplayIndex]);

  const handleCancelOrder = useCallback((orderId: string) => {
    const isPending = tradingEngine.getPendingOrders().some((o) => o.orderId === orderId);
    if (isPending) {
      tradingEngine.cancelOrder(orderId, undefined, replayState.currentReplayIndex ?? undefined);
    } else {
      const openPos = tradingEngine.getOpenPositions().find((p) => p.positionId === orderId || p.orderId === orderId);
      if (openPos) {
        tradingEngine.closePosition(openPos.positionId, openPos.currentPrice, undefined, replayState.currentReplayIndex ?? undefined);
      }
    }
  }, [replayState.currentReplayIndex]);

  const handleSelectPositionDrawing = useCallback(
    (info: { type: 'long-position' | 'short-position'; points: any[]; id: string } | null) => {
      if (!info || info.points.length < 3) {
        window.dispatchEvent(
          new CustomEvent('draft-order-selection-changed', {
            detail: { selected: false, paneId },
          })
        );
        return;
      }

      const isLong = info.type === 'long-position';
      const entryPrice = info.points[0].price;
      const p1 = info.points[1].price;
      const p2 = info.points[2].price;

      const stopLoss = isLong ? Math.min(p1, p2) : Math.max(p1, p2);
      const takeProfit = isLong ? Math.max(p1, p2) : Math.min(p1, p2);

      window.dispatchEvent(
        new CustomEvent('draft-order-selection-changed', {
          detail: {
            selected: true,
            paneId,
            symbol: selectedSymbol?.name ?? '',
            timeframe,
            direction: isLong ? 'BUY' : 'SELL',
            entryPrice,
            stopLoss,
            takeProfit,
            drawingId: info.id,
          },
        })
      );
    },
    [paneId, selectedSymbol?.name, timeframe]
  );

  const { indicators, dayeQuartersHeight, rsiHeight } = useIndicatorStore();
  const bottomIndicatorsHeight = useMemo(
    () => calculateBottomIndicatorsHeight(indicators, dayeQuartersHeight, rsiHeight, timeframe),
    [indicators, dayeQuartersHeight, rsiHeight, timeframe]
  );

  return (
    <section
      ref={sectionRef}
      className={`chart-area${isActive ? ' chart-area--active' : ''}`}
      style={style}
      onContextMenu={handleContextMenu}
      onClick={() => { if (!isActive) setActivePaneId(paneId); }}
    >
      <PaneHeader
        paneId={paneId}
        symbols={symbols}
        selectedSymbol={selectedSymbol}
        timeframe={timeframe}
        dynamicTfOptions={dynamicTfOptions}
      />
      {!sessionReady ? (
        <div
          className="chart-pane-loading"
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-app, #131722)',
            color: 'var(--text-muted, #787b86)',
            fontSize: '13px',
          }}
        >
          Initializing Replay Engine...
        </div>
      ) : (
        <ChartContainer
          ref={chartRef}
          paneId={paneId}
          symbolId={symbolId}
          symbolName={selectedSymbol?.name ?? 'Chart'}
          timeframe={timeframe}
          allCandles={allCandles}
          m1Candles={m1Candles}
          loadingMore={loadingMore}
          hasMoreBefore={hasMoreBefore}
          hasMoreAfter={hasMoreAfter}
          loadMoreBefore={loadMoreBefore}
          loadMoreAfter={loadMoreAfter}
          resetToken={resetToken}
          timezone={timezone}
          activeSession={activeSession}
        />
      )}

      <DrawingCanvas
        chart={chartApi}
        series={seriesApi}
        activeTool={activeTool}
        magnetEnabled={magnetEnabled}
        onToolDeactivate={() => onActiveToolChange('pointer')}
        timezone={timezone}
        candles={allCandles}
        onEngineReady={(engine) => { drawingEngineRef.current = engine; }}
        onSelectPositionDrawing={handleSelectPositionDrawing}
        sessionId={activeSession?.id ?? null}
        symbol={selectedSymbol?.name ?? null}
      />

      {/* Real Order Lines Overlay */}
      <RealOrderOverlay
        chart={chartApi}
        series={seriesApi}
        orders={activeOrders}
        currentSymbol={selectedSymbol?.name ?? ''}
        chartWidth={containerDims.width || 800}
        chartHeight={containerDims.height || 600}
        priceToY={priceToY}
        yToPrice={yToPrice}
        onModifyOrder={handleModifyOrder}
        onCancelOrder={handleCancelOrder}
      />

      {/* Trade History Markers & Connecting Lines on Candles */}
      <TradeHistoryOverlay
        chart={chartApi}
        series={seriesApi}
        currentSymbol={selectedSymbol?.name ?? ''}
        candles={allCandles}
        timeframe={timeframe}
        visible={showTradeHistory}
        chartWidth={containerDims.width || 800}
        chartHeight={containerDims.height || 600}
      />

      {/* Technical Indicators Layer (EMA, Sessions, Quarters, RSI) */}
      <IndicatorsLayer
        chart={chartApi}
        series={seriesApi}
        candles={displayCandles}
        symbol={selectedSymbol?.name ?? ''}
        chartWidth={containerDims.width || 800}
        chartHeight={containerDims.height || 600}
        timeframe={timeframe}
      />

      {/* Economic News Calendar Flag Markers Overlay (Rendered above indicators) */}
      <NewsEventOverlay
        chart={chartApi}
        series={seriesApi}
        currentSymbol={selectedSymbol?.name ?? ''}
        candles={allCandles}
        visible={showNewsEvents}
        chartWidth={containerDims.width || 800}
        chartHeight={containerDims.height || 600}
      />

      <ReplayTimeline allCandles={allCandles} timezone={timezone} />

      <div
        className="chart-area__reset-zone"
        style={{ bottom: `${25 + bottomIndicatorsHeight}px` }}
      >
        <button
          className="chart-area__reset-view"
          onClick={async () => {
            if (!chartApi) return;
            try {
              const dataUrl = await captureCompleteChart(sectionRef.current, chartApi);
              const a = document.createElement('a');
              a.href = dataUrl;
              const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
              const sym = selectedSymbol?.name ?? 'Chart';
              a.download = `TradePro_${sym}_${timeframe}_${dateStr}.png`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              showToast('📸 Screenshot berhasil disimpan');
            } catch (err) {
              console.error(err);
              showToast('Gagal mengambil screenshot');
            }
          }}
          title="Screenshot (Buat Jurnal)"
          aria-label="Screenshot (Buat Jurnal)"
          style={{ marginBottom: '8px' }}
        >
          <Camera size={14} />
        </button>
        <button
          className="chart-area__reset-view"
          onClick={() => chartRef.current?.resetChartView()}
          title="Reset Chart"
          aria-label="Reset Chart"
        >
          <RotateCcw size={14} />
        </button>
      </div>

      {isActive && typeof document !== 'undefined' && (topbarSlotEl || document.getElementById('topbar-replay-slot')) && (
        createPortal(
          <FloatingReplayBar chartTimeframe={timeframe} paneId={paneId} />,
          (topbarSlotEl || document.getElementById('topbar-replay-slot'))!
        )
      )}

      {!hasData && (
        <div className="chart-area__empty">
          <UploadCloud size={28} strokeWidth={1.5} />
          <p>
            {selectedSymbol
              ? `Belum ada data untuk ${selectedSymbol.name}`
              : 'Belum ada data historis'}
          </p>
          <span>
            {selectedSymbol
              ? `Symbol ini punya data di timeframe: ${selectedSymbol.timeframes.join(', ') || '—'}`
              : 'Impor file CSV untuk mulai melakukan replay chart.'}
          </span>
        </div>
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          clickedPrice={contextMenu.clickedPrice}
          clickedDrawingId={contextMenu.clickedDrawingId}
          drawings={drawingEngineRef.current?.drawings.all ?? []}
          showTradeHistory={showTradeHistory}
          onToggleTradeHistory={handleToggleTradeHistory}
          showNewsEvents={showNewsEvents}
          onToggleNewsEvents={handleToggleNewsEvents}
          onClose={() => setContextMenu(null)}
          onResetView={() => chartRef.current?.resetChartView()}
          onRefreshLag={() => {
            window.dispatchEvent(new CustomEvent('refresh-chart-lag'));
            showToast('Chart context & memori berhasil di-refresh!');
          }}
          onCopyPrice={(priceStr) => showToast(`Harga ${priceStr} berhasil disalin!`)}
          onRemoveAllDrawings={() => {
            window.dispatchEvent(new CustomEvent('clear-all-drawings'));
            showToast('Semua gambar berhasil dihapus');
          }}
          onRemoveAllIndicators={() => {
            window.dispatchEvent(new CustomEvent('clear-all-indicators'));
            showToast('Semua indikator berhasil dihapus');
          }}
          onSelectDrawing={(id) => {
            drawingEngineRef.current?.selection.select(id);
          }}
          onDeleteDrawing={(id) => {
            drawingEngineRef.current?.deleteDrawing(id);
            showToast('Gambar berhasil dihapus');
          }}
        />
      )}

      {toastMsg && (
        <div className="chart-toast-notification">
          {toastMsg}
        </div>
      )}
    </section>
  );
}


interface PaneHeaderProps {
  paneId: string;
  symbols: SymbolInfo[];
  selectedSymbol: SymbolInfo | null;
  timeframe: Timeframe;
  dynamicTfOptions: { value: Timeframe; label: string }[];
}

const DEFAULT_FAVORITE_TIMEFRAMES: Timeframe[] = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'];

function PaneHeader({ paneId, symbols, selectedSymbol, timeframe, dynamicTfOptions }: PaneHeaderProps) {
  const { updatePaneSymbol, updatePaneTimeframe } = useWorkspace();
  const { autoFollow, setReplayTimeframe } = useReplay();
  const [symbolMenuOpen, setSymbolMenuOpen] = useState(false);
  const [tfMenuOpen, setTfMenuOpen] = useState(false);

  const [tfFavorites, setTfFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('tv_tf_favorites');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_FAVORITE_TIMEFRAMES;
  });

  const toggleTfFavorite = (tfVal: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTfFavorites((prev) => {
      const next = prev.includes(tfVal) ? prev.filter((t) => t !== tfVal) : [...prev, tfVal];
      try {
        localStorage.setItem('tv_tf_favorites', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleSelectTimeframe = (tf: Timeframe) => {
    updatePaneTimeframe(paneId, tf);
    if (autoFollow) {
      setReplayTimeframe(tf);
    }
  };

  const favoriteOptions = useMemo<{ value: Timeframe; label: string }[]>(() => {
    return dynamicTfOptions.filter((opt) => tfFavorites.includes(opt.value));
  }, [tfFavorites, dynamicTfOptions]);

  const isCurrentInFavorites = tfFavorites.includes(timeframe);
  const currentLabel = dynamicTfOptions.find((o) => o.value === timeframe)?.label ?? timeframe;

  return (
    <div
      className="pane-header"
      style={{
        position: 'absolute',
        top: '8px',
        left: '8px',
        zIndex: symbolMenuOpen || tfMenuOpen ? 99999 : 40,
        pointerEvents: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        userSelect: 'none',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Pair Selector (Flat Text Style) */}
      <div
        className="topbar__selector-wrap"
        tabIndex={0}
        style={{ position: 'relative' }}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setSymbolMenuOpen(false);
        }}
      >
        <button
          className="pane-header__flat-btn pane-header__symbol-btn"
          onClick={() => setSymbolMenuOpen((v) => !v)}
          title="Ganti Simbol / Pair"
        >
          <span className="pane-header__symbol-text">{selectedSymbol?.name ?? 'No symbol'}</span>
          <ChevronDown size={12} className="pane-header__chevron" />
        </button>

        {symbolMenuOpen && (
          <div
            className="topbar__menu"
            style={{
              zIndex: 999999,
              top: 'calc(100% + 4px)',
              background: 'var(--bg-elevated, #1e222d)',
              border: '1px solid var(--border-strong, #363c4e)',
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
            }}
          >
            {symbols.length === 0 ? (
              <div className="topbar__menu-empty">Belum ada data</div>
            ) : (
              symbols.map((s) => (
                <button
                  key={s.id}
                  className={`topbar__menu-item ${s.id === selectedSymbol?.id ? 'is-active' : ''}`}
                  onClick={() => {
                    updatePaneSymbol(paneId, s.id);
                    setSymbolMenuOpen(false);
                  }}
                >
                  <span>{s.name}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Tiny Divider */}
      <div className="pane-header__divider" />

      {/* Quick Timeframe Favorites Bar */}
      <div className="pane-header__tf-group">
        {favoriteOptions.map((q) => {
          const isActive = q.value === timeframe;
          return (
            <button
              key={q.value}
              className={`pane-header__tf-btn mono ${isActive ? 'is-active' : ''}`}
              onClick={() => handleSelectTimeframe(q.value)}
              title={`Ganti ke ${q.label}`}
            >
              {q.label}
            </button>
          );
        })}

        {/* If current timeframe is not in favorites, show it as active pill */}
        {!isCurrentInFavorites && (
          <button className="pane-header__tf-btn mono is-active" title={`Aktif: ${currentLabel}`}>
            {currentLabel}
          </button>
        )}

        {/* Dropdown Chevron for All Other Timeframes */}
        <div
          className="topbar__selector-wrap"
          tabIndex={0}
          style={{ position: 'relative' }}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setTfMenuOpen(false);
          }}
        >
          <button
            className="pane-header__tf-chevron-btn"
            onClick={() => setTfMenuOpen((v) => !v)}
            title="Semua Timeframe & Pengaturan Favorit"
            aria-label="Pilih Timeframe Lain"
          >
            <ChevronDown size={12} />
          </button>

          {tfMenuOpen && (
            <div
              className="topbar__menu pane-header__tf-dropdown"
              style={{
                zIndex: 999999,
                top: 'calc(100% + 4px)',
                background: 'var(--bg-elevated, #1e222d)',
                border: '1px solid var(--border-strong, #363c4e)',
                boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
                minWidth: '150px',
              }}
            >
              {dynamicTfOptions.map((opt) => {
                const isFav = tfFavorites.includes(opt.value);
                const isCurrent = opt.value === timeframe;

                return (
                  <div
                    key={opt.value}
                    className={`pane-header__tf-menu-row ${isCurrent ? 'is-active' : ''}`}
                    onClick={() => {
                      handleSelectTimeframe(opt.value);
                      setTfMenuOpen(false);
                    }}
                  >
                    <span className="pane-header__tf-menu-label mono">{opt.label}</span>
                    <button
                      className={`pane-header__tf-star-btn ${isFav ? 'is-starred' : ''}`}
                      onClick={(e) => toggleTfFavorite(opt.value, e)}
                      title={isFav ? 'Hapus dari bar favorit' : 'Tambah ke bar favorit'}
                    >
                      <Star
                        size={13}
                        fill={isFav ? '#f59e0b' : 'none'}
                        stroke={isFav ? '#f59e0b' : 'currentColor'}
                        strokeWidth={1.5}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
