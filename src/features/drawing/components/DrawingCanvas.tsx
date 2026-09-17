import { useRef, useEffect, useCallback, useState } from 'react';
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { DrawingEngine } from '../engine/DrawingEngine';
import { getDrawingStorageKey } from '../engine/DrawingStorage';
import type { DrawingPoint, DrawingStyle, DrawingObject } from '../engine/types';
import { InteractionController, type InteractionCallbacks } from '../interaction/InteractionController';
import FloatingDrawingToolbar from './FloatingDrawingToolbar';
import GeneralDrawingSettingsModal from './GeneralDrawingSettingsModal';
import FibonacciSettingsModal from './FibonacciSettingsModal';
import PositionDrawingSettingsModal from './PositionDrawingSettingsModal';
import { begin, finish, dump, isActive } from '../trace';
import './DrawingCanvas.css';

interface DrawingCanvasProps {
  chart: IChartApi | null;
  series: ISeriesApi<'Candlestick'> | null;
  activeTool: string;
  magnetEnabled?: boolean;
  onToolDeactivate?: () => void;
  timezone: string;
  candles?: any[];
  onEngineReady?: (engine: DrawingEngine | null) => void;
  onSelectPositionDrawing?: (info: { type: 'long-position' | 'short-position'; points: DrawingPoint[]; id: string } | null) => void;
  sessionId?: string | null;
  symbol?: string | null;
  storageKey?: string;
}

export default function DrawingCanvas({
  chart,
  series,
  activeTool,
  magnetEnabled,
  onToolDeactivate,
  candles,
  onEngineReady,
  onSelectPositionDrawing,
  sessionId,
  symbol,
  storageKey,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const axisCanvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<DrawingEngine | null>(null);
  const controllerRef = useRef<InteractionController | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tempPoints, setTempPoints] = useState<DrawingPoint[]>([]);
  const [floatingToolbar, setFloatingToolbar] = useState({ visible: false, x: 0, y: 0, drawingId: null as string | null });
  const [settingsModalDrawing, setSettingsModalDrawing] = useState<DrawingObject | null>(null);
  const activeToolRef = useRef(activeTool);
  const selectedIdsRef = useRef(selectedIds);
  const hoveredIdRef = useRef(hoveredId);
  const tempPointsRef = useRef(tempPoints);
  const floatingToolbarRef = useRef(floatingToolbar);
  activeToolRef.current = activeTool;
  selectedIdsRef.current = selectedIds;
  hoveredIdRef.current = hoveredId;
  tempPointsRef.current = tempPoints;
  floatingToolbarRef.current = floatingToolbar;

  const effectiveStorageKey = storageKey ?? getDrawingStorageKey(sessionId, symbol);

  useEffect(() => {
    const engine = new DrawingEngine({ storageKey: effectiveStorageKey });
    engine.snap.setEnabled(Boolean(magnetEnabled));
    engineRef.current = engine;
    if (onEngineReady) onEngineReady(engine);
    const callbacks: InteractionCallbacks = {
      getState: () => 'idle',
      getHoveredId: () => hoveredIdRef.current,
      getSelectedIds: () => selectedIdsRef.current,
      getTempPoints: () => tempPointsRef.current,
      getActiveTool: () => activeToolRef.current,
      getFloatingToolbar: () => floatingToolbarRef.current,
      getSnapManager: () => engine.snap,
      setHoveredId: (id) => {
        if (hoveredIdRef.current === id) return;
        hoveredIdRef.current = id;
        setHoveredId(id);
        engine.setRenderState({ hoveredId: id });
      },
      setSelectedIds: (ids) => {
        selectedIdsRef.current = ids;
        setSelectedIds(ids);
        engine.setRenderState({ selectedIds: ids });

        if (onSelectPositionDrawing) {
          if (ids.length > 0) {
            const drw = engine.drawings.get(ids[0]);
            if (drw && (drw.type === 'long-position' || drw.type === 'short-position') && drw.points.length >= 3) {
              onSelectPositionDrawing({ type: drw.type, points: drw.points, id: drw.id });
            } else {
              onSelectPositionDrawing(null);
            }
          } else {
            onSelectPositionDrawing(null);
          }
        }
      },
      setTempPoints: (points) => {
        tempPointsRef.current = points;
        setTempPoints(points);
        engine.setRenderState({ tempPoints: points });
      },
      setFloatingToolbar: (toolbar) => { floatingToolbarRef.current = toolbar; setFloatingToolbar(toolbar); },
      setCursorStyle: () => {},
      getDrawings: () => engine.drawings.getVisible(),
      getDrawing: (id) => engine.drawings.get(id),
      createDrawing: (type, points, style) => engine.createDrawing({ type: type as any, points, style }).id,
      updateDrawing: (id, changes) => {
        engine.updateDrawing(id, changes);
        if (onSelectPositionDrawing && selectedIdsRef.current.includes(id)) {
          const drw = engine.drawings.get(id);
          if (drw && (drw.type === 'long-position' || drw.type === 'short-position') && drw.points.length >= 3) {
            onSelectPositionDrawing({ type: drw.type, points: drw.points, id: drw.id });
          }
        }
      },
      deleteDrawing: (id) => engine.deleteDrawing(id),
      deleteSelected: () => engine.deleteSelected(),
      undo: () => engine.undo(),
      redo: () => engine.redo(),
      onToolDeactivate,
      requestRedraw: () => engine.invalidate(),
      setRenderState: (state) => engine.setRenderState(state),
      onOpenSettingsModal: (d) => setSettingsModalDrawing(d),
    };
    controllerRef.current = new InteractionController(callbacks);
    return () => {
      if (onEngineReady) onEngineReady(null);
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.snap.setEnabled(Boolean(magnetEnabled));
    }
  }, [magnetEnabled]);

  useEffect(() => {
    if (!engineRef.current || !candles || candles.length === 0) return;
    try {
      const mappedCandles = candles.map((d) => ({
        time: typeof d.time === 'number' ? d.time : (new Date(d.time as any).getTime() / 1000),
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close
      }));
      engineRef.current.setCandles(mappedCandles);
      controllerRef.current?.getBridge().setCandles(mappedCandles);
      engineRef.current.invalidate();
    } catch (err) {
      console.warn('[DrawingCanvas] Could not map candles data:', err);
    }
  }, [candles]);

  useEffect(() => {
    if (activeTool === 'trendline' || activeTool === 'ray' || activeTool === 'extended-line') {
      begin(activeTool);
    } else if (isActive()) {
      finish(`tool changed to ${activeTool}`);
      dump();
    }
    engineRef.current?.setRenderState({ activeTool });
  }, [activeTool]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!chart || !controller) return;
    controller.setChart(chart, series);
  }, [chart, series]);

  useEffect(() => {
    if (!chart) return;
    const chartEl = chart.chartElement();
    const controller = controllerRef.current;
    if (!controller || !chartEl) return;
    const down = (e: MouseEvent) => {
      if (e.button !== 0) return; // Strict Left-Click only
      if (activeToolRef.current === 'pointer' || activeToolRef.current === 'crosshair') {
        controller.handlePointerDown(e.clientX, e.clientY, e.ctrlKey || e.metaKey, e.shiftKey);
      }
    };
    const move = (e: MouseEvent) => controller.handlePointerMove(e.clientX, e.clientY, e.shiftKey);
    const up = () => controller.handlePointerUp();
    chartEl.addEventListener('mousedown', down);
    chartEl.addEventListener('mousemove', move);
    chartEl.addEventListener('mouseup', up);
    return () => { chartEl.removeEventListener('mousedown', down); chartEl.removeEventListener('mousemove', move); chartEl.removeEventListener('mouseup', up); };
  }, [chart]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
        if (e.key === 'Shift') {
          controller.handleShiftState(true);
        }
        controller.handleKeyDown(e.key, e.ctrlKey, e.metaKey);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
        if (e.key === 'Shift') {
          controller.handleShiftState(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const handleDblClick = (e: MouseEvent) => {
      controllerRef.current?.handleDoubleClick(e.clientX, e.clientY);
    };
    window.addEventListener('dblclick', handleDblClick);
    return () => window.removeEventListener('dblclick', handleDblClick);
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    const canvas = canvasRef.current;
    const axisCanvas = axisCanvasRef.current;
    if (!chart || !canvas || !engine) return;

    try {
      engine.attachChart(chart, series);
      engine.setCanvas(canvas, axisCanvas);
      const resize = () => {
        try {
          const chartEl = chart.chartElement();
          if (chartEl) {
            const rect = chartEl.getBoundingClientRect();
            engine.resize(rect.width, rect.height, window.devicePixelRatio || 1);
          }
        } catch {}
      };
      const chartElement = chart.chartElement();
      let observer: ResizeObserver | null = null;
      if (chartElement) {
        observer = new ResizeObserver(resize);
        observer.observe(chartElement);
      }
      resize();
      return () => {
        if (observer) observer.disconnect();
        try {
          engine.attachChart(null, null);
          engine.setCanvas(null, null);
        } catch {}
      };
    } catch (err) {
      console.warn('[DrawingCanvas] Safe attachChart error suppressed:', err);
    }
  }, [chart, series]);

  useEffect(() => {
    const handleClearDrawings = () => {
      if (engineRef.current) {
        engineRef.current.drawings.clear();
        engineRef.current.requestRender();
        setSelectedIds([]);
        setFloatingToolbar({ visible: false, x: 0, y: 0, drawingId: null });
      }
    };
    window.addEventListener('clear-all-drawings', handleClearDrawings);
    return () => window.removeEventListener('clear-all-drawings', handleClearDrawings);
  }, []);

  // Update storage key when session or symbol changes
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setStorageKey(effectiveStorageKey);
    }
  }, [effectiveStorageKey]);

  const lastCrosshairTargetRef = useRef<HTMLCanvasElement | null>(null);

  const forwardCrosshairMove = useCallback((clientX: number, clientY: number) => {
    if (!chart || typeof chart.chartElement !== 'function') return;
    const chartEl = chart.chartElement();
    if (!chartEl) return;

    const canvases = Array.from(chartEl.querySelectorAll('canvas'));
    if (canvases.length === 0) return;

    // Find the chart's top interactive canvas (LWC sets style.zIndex = '2' on topCanvasBinding)
    const targetCanvas =
      canvases.find((c) => {
        const rect = c.getBoundingClientRect();
        return (
          (c.style.zIndex === '2' || c.style.zIndex === '') &&
          clientX >= rect.left &&
          clientX <= rect.right &&
          clientY >= rect.top &&
          clientY <= rect.bottom
        );
      }) ||
      canvases.find((c) => {
        const rect = c.getBoundingClientRect();
        return (
          clientX >= rect.left &&
          clientX <= rect.right &&
          clientY >= rect.top &&
          clientY <= rect.bottom
        );
      }) ||
      canvases[canvases.length - 1];

    if (!targetCanvas) return;

    if (lastCrosshairTargetRef.current !== targetCanvas) {
      if (lastCrosshairTargetRef.current) {
        lastCrosshairTargetRef.current.dispatchEvent(
          new MouseEvent('mouseleave', { clientX, clientY, bubbles: false, cancelable: true })
        );
      }
      targetCanvas.dispatchEvent(
        new MouseEvent('mouseenter', { clientX, clientY, bubbles: false, cancelable: true })
      );
      lastCrosshairTargetRef.current = targetCanvas;
    }

    targetCanvas.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX,
        clientY,
        bubbles: true,
        cancelable: true,
      })
    );
  }, [chart]);

  const handleDrawingPointerLeave = useCallback(() => {
    if (lastCrosshairTargetRef.current) {
      lastCrosshairTargetRef.current.dispatchEvent(
        new MouseEvent('mouseleave', { bubbles: false, cancelable: true })
      );
      lastCrosshairTargetRef.current = null;
    }
  }, []);

  const handleDrawingPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    controllerRef.current?.handlePointerDown(e.clientX, e.clientY, e.ctrlKey || e.metaKey, e.shiftKey);
    forwardCrosshairMove(e.clientX, e.clientY);
  }, [forwardCrosshairMove]);

  const handleDrawingPointerMove = useCallback((e: React.PointerEvent) => {
    controllerRef.current?.handlePointerMove(e.clientX, e.clientY, e.shiftKey);
    forwardCrosshairMove(e.clientX, e.clientY);
  }, [forwardCrosshairMove]);

  const handleDrawingPointerUp = useCallback((e: React.PointerEvent) => {
    controllerRef.current?.handlePointerUp();
    forwardCrosshairMove(e.clientX, e.clientY);
  }, [forwardCrosshairMove]);

  const handleStyleChange = useCallback((id: string, changes: Partial<DrawingStyle>, text?: string) => {
    engineRef.current?.updateDrawing(id, {
      style: changes,
      text: text !== undefined ? text : undefined,
    });
    engineRef.current?.requestRender();
  }, []);
  const handleDuplicate = useCallback(() => engineRef.current?.duplicateSelected(), []);
  const handleDelete = useCallback((id: string) => { engineRef.current?.deleteDrawing(id); setSelectedIds([]); setFloatingToolbar({ visible: false, x: 0, y: 0, drawingId: null }); }, []);
  const handleLock = useCallback((id: string) => { const d = engineRef.current?.drawings.get(id); if (d) engineRef.current?.updateDrawing(id, { locked: !d.locked }); }, []);
  const handleHide = useCallback((id: string) => { engineRef.current?.updateDrawing(id, { hidden: true }); setSelectedIds([]); setFloatingToolbar({ visible: false, x: 0, y: 0, drawingId: null }); }, []);

  const handleSaveModalSettings = useCallback((id: string, styleChanges: Partial<DrawingStyle>, textValue?: string, points?: DrawingPoint[]) => {
    engineRef.current?.updateDrawing(id, {
      style: styleChanges,
      text: textValue !== undefined ? textValue : undefined,
      points: points || undefined,
    });
    engineRef.current?.requestRender();
  }, []);

  const selectedDrawing = floatingToolbar.drawingId ? engineRef.current?.drawings.get(floatingToolbar.drawingId) ?? null : null;
  const isDrawingMode = activeTool !== 'pointer' && activeTool !== 'crosshair';

  useEffect(() => {
    if (!isDrawingMode && lastCrosshairTargetRef.current) {
      lastCrosshairTargetRef.current.dispatchEvent(
        new MouseEvent('mouseleave', { bubbles: false, cancelable: true })
      );
      lastCrosshairTargetRef.current = null;
    }
  }, [isDrawingMode]);

  return <>
    <canvas ref={canvasRef} className="drawing-canvas drawing-layer-canvas" style={{ pointerEvents: 'none' }} />
    <canvas ref={axisCanvasRef} className="axis-overlay-canvas" style={{ pointerEvents: 'none' }} />
    {isDrawingMode && (
      <div
        className="drawing-capture-layer"
        onPointerDown={handleDrawingPointerDown}
        onPointerMove={handleDrawingPointerMove}
        onPointerUp={handleDrawingPointerUp}
        onPointerLeave={handleDrawingPointerLeave}
      />
    )}
    {floatingToolbar.visible && selectedDrawing && (
      <FloatingDrawingToolbar
        x={floatingToolbar.x}
        y={floatingToolbar.y}
        drawing={selectedDrawing}
        containerRef={canvasRef}
        onStyleChange={handleStyleChange}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
        onLock={handleLock}
        onHide={handleHide}
        onOpenSettings={(d) => setSettingsModalDrawing(d)}
      />
    )}
    {settingsModalDrawing && (
      (
        settingsModalDrawing.type === 'long-position' ||
        settingsModalDrawing.type === 'short-position'
      ) ? (
        <PositionDrawingSettingsModal
          isOpen={Boolean(settingsModalDrawing)}
          onClose={() => setSettingsModalDrawing(null)}
          drawing={settingsModalDrawing}
          onSave={handleSaveModalSettings}
        />
      ) : (
        settingsModalDrawing.type === 'fib-retracement' ||
        settingsModalDrawing.type === 'fibonacci'
      ) ? (
        <FibonacciSettingsModal
          isOpen={Boolean(settingsModalDrawing)}
          onClose={() => setSettingsModalDrawing(null)}
          drawing={settingsModalDrawing}
          onSave={handleSaveModalSettings}
        />
      ) : (
        <GeneralDrawingSettingsModal
          isOpen={Boolean(settingsModalDrawing)}
          onClose={() => setSettingsModalDrawing(null)}
          drawing={settingsModalDrawing}
          onSave={handleSaveModalSettings}
        />
      )
    )}
  </>;
}
