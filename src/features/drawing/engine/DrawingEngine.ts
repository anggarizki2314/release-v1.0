import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import type { DrawingObject, ToolId, CreateDrawingInput, UpdateDrawingInput, DrawingEngineEvents, EventKey, EventHandler, DrawingPoint } from './types';
import { DrawingEventBus } from './events';
import { ToolManager } from './ToolManager';
import { SelectionManager } from './SelectionManager';
import { DrawingManager } from './DrawingManager';
import { DrawingHistory } from './DrawingHistory';
import { DrawingHitTester } from './DrawingHitTester';
import { DrawingSnapManager } from './DrawingSnapManager';
import { DrawingSerializer } from './DrawingSerializer';
import { DrawingStorage, getDrawingStorageKey, GLOBAL_DRAWING_STORAGE_KEY } from './DrawingStorage';
import { SpatialIndex } from './SpatialIndex';
import { DrawingRenderer, type RenderContext } from './DrawingRenderer';
import { FloatingToolbarManager } from './FloatingToolbarManager';
import { ContextMenuManager } from './ContextMenuManager';
import { trace, isActive } from '../trace';
import { getXFromLogical, priceFromY } from '../utils/coordinateEngine';

export interface DrawingEngineConfig {
  renderContext?: RenderContext;
  storageKey?: string;
  sessionId?: string | null;
  symbol?: string | null;
}

export class DrawingEngine {
  readonly events: DrawingEventBus;
  readonly tool: ToolManager;
  readonly selection: SelectionManager;
  readonly drawings: DrawingManager;
  readonly history: DrawingHistory;
  readonly hitTester: DrawingHitTester;
  readonly snap: DrawingSnapManager;
  readonly serializer: DrawingSerializer;
  readonly storage: DrawingStorage;
  readonly spatialIndex: SpatialIndex;
  readonly renderer: DrawingRenderer;
  readonly floatingToolbar: FloatingToolbarManager;
  readonly contextMenu: ContextMenuManager;

  private rc: RenderContext | null = null;
  private chart: IChartApi | null = null;
  private series: ISeriesApi<'Candlestick'> | null = null;
  private animFrame: number | null = null;
  private selectedIds = new Set<string>();
  private hoveredId: string | null = null;
  private tempPoints: DrawingPoint[] = [];
  private activeTool = 'pointer';
  private chartTransformCleanup: (() => void) | null = null;
  private priceScaleTrackingFrame: number | null = null;
  private updateContextFn: (() => void) | null = null;
  private candles: Array<{ time: number; open: number; high: number; low: number; close: number }> = [];

  constructor(config?: DrawingEngineConfig | string) {
    let initialKey: string = GLOBAL_DRAWING_STORAGE_KEY;
    if (typeof config === 'string') {
      initialKey = config;
    } else if (config) {
      initialKey = config.storageKey ?? getDrawingStorageKey(config.sessionId, config.symbol);
    }

    this.events = new DrawingEventBus();
    this.tool = new ToolManager(this.events);
    this.selection = new SelectionManager(this.events);
    this.drawings = new DrawingManager(this.events, this.selection);
    this.history = new DrawingHistory(this.events);
    this.hitTester = new DrawingHitTester();
    this.snap = new DrawingSnapManager();
    this.serializer = new DrawingSerializer();
    this.storage = new DrawingStorage(this.events, initialKey);
    this.spatialIndex = new SpatialIndex();
    this.renderer = new DrawingRenderer();
    this.floatingToolbar = new FloatingToolbarManager();
    this.contextMenu = new ContextMenuManager();
    this.loadFromStorage();
    this.events.on('drawing:created', () => this.saveToStorage());
    this.events.on('drawing:updated', () => this.saveToStorage());
    this.events.on('drawing:deleted', () => this.saveToStorage());
    this.events.on('drawing:batch-deleted', () => this.saveToStorage());
    this.events.on('drawings:cleared', () => this.saveToStorage());
  }

  setStorageKey(key: string): void {
    if (this.storage.getStorageKey() === key) return;
    this.storage.setStorageKey(key, this.drawings.all);
    this.loadFromStorage();
  }

  setSessionContext(sessionId?: string | null, symbol?: string | null): void {
    const key = getDrawingStorageKey(sessionId, symbol);
    this.setStorageKey(key);
  }

  setCanvas(canvas: HTMLCanvasElement | null, axisCanvas?: HTMLCanvasElement | null): void {
    this.renderer.setCanvas(canvas, axisCanvas);
    this.invalidate();
  }

  attachChart(chart: IChartApi | null, series: ISeriesApi<'Candlestick'> | null): void {
    this.chartTransformCleanup?.();
    this.chart = chart;
    this.series = series;
    if (!chart) {
      this.rc = null;
      this.chartTransformCleanup = null;
      this.updateContextFn = null;
      this.invalidate();
      return;
    }
    const updateContext = () => {
      try {
        const chartEl = chart.chartElement();
        if (!chartEl) return;
        const rect = chartEl.getBoundingClientRect();
        const timeScale = chart.timeScale();

        // Pre-compute dataset metadata ONCE per updateContext call (0 per-point allocations)
        let lastTime = 0;
        let lastBarIndex = 0;
        let barInterval = 3600;
        let lastBarX: number | null = null;
        let barSpacing = 6;
        let hasData = false;

        if (this.candles && this.candles.length > 0) {
          hasData = true;
          const len = this.candles.length;
          const lastCandle = this.candles[len - 1];
          lastTime = lastCandle.time;
          lastBarIndex = len - 1;
          if (len > 1) {
            const prevCandle = this.candles[len - 2];
            if (lastTime - prevCandle.time > 0) {
              barInterval = lastTime - prevCandle.time;
            }
          }
          try {
            lastBarX = timeScale.timeToCoordinate(lastCandle.time as any) ?? timeScale.logicalToCoordinate(lastBarIndex as any);
            if (len > 1 && lastBarX !== null) {
              const prevCandle = this.candles[len - 2];
              const prevBarX = timeScale.timeToCoordinate(prevCandle.time as any);
              if (prevBarX !== null && (lastBarX as number) > prevBarX) {
                barSpacing = (lastBarX as number) - prevBarX;
              }
            }
          } catch {}
        }

        let pScaleWidth = 60;
        try {
          const w = (chart.priceScale('right') as any)?.width?.();
          if (typeof w === 'number' && Number.isFinite(w) && w > 0) {
            pScaleWidth = w;
          }
        } catch {}

        this.setRenderContext({
          timeToX: (t) => {
            if (!Number.isFinite(t)) return 0;
            try {
              const coordinate = timeScale.timeToCoordinate(t as Time);
              if (coordinate !== null && coordinate !== undefined && Number.isFinite(coordinate)) return coordinate as number;
            } catch {}

            const candles = this.candles;
            const len = candles ? candles.length : 0;
            if (len > 0) {
              const lastCandle = candles[len - 1];
              const lastTimeVal = typeof lastCandle.time === 'number' ? lastCandle.time : (new Date(lastCandle.time as any).getTime() / 1000);
              const firstCandle = candles[0];
              const firstTimeVal = typeof firstCandle.time === 'number' ? firstCandle.time : (new Date(firstCandle.time as any).getTime() / 1000);
              const lastBarIndexVal = len - 1;
              const barIntervalVal = len > 1
                ? Math.max((lastTimeVal - firstTimeVal) / (len - 1), 1)
                : 3600;

              const targetLogical = lastBarIndexVal + (t - lastTimeVal) / barIntervalVal;
              const x = getXFromLogical(chart, targetLogical, len);
              if (x !== null && x !== undefined && Number.isFinite(x)) return x;
            }

            // Fallback via visible range
            try {
              const visibleRange = timeScale.getVisibleLogicalRange();
              if (visibleRange) {
                const leftX = timeScale.logicalToCoordinate(visibleRange.from as any);
                const rightX = timeScale.logicalToCoordinate(visibleRange.to as any);
                if (leftX !== null && rightX !== null && rightX !== leftX) {
                  const currentBarSpacing = (rightX - leftX) / (visibleRange.to - visibleRange.from);
                  const targetLogical = visibleRange.to + (t - (Date.now() / 1000)) / 3600;
                  return rightX + (targetLogical - visibleRange.to) * currentBarSpacing;
                }
              }
            } catch {}

            return 0;
          },
          priceToY: (p) => {
            if (!Number.isFinite(p)) return 0;
            try {
              const coordinate = this.series?.priceToCoordinate(p);
              if (coordinate !== null && coordinate !== undefined && Number.isFinite(coordinate)) return coordinate as number;
            } catch {}
            return priceFromY(chart, this.series, p);
          },
          xToTime: (x) => {
            if (!hasData) return NaN;

            try {
              // Recompute lastBarX FRESH each call — closure value is stale when timescale is panned
              const currentLastBarX =
                timeScale.timeToCoordinate(lastTime as any) ??
                timeScale.logicalToCoordinate(lastBarIndex as any);
              const barSp = (timeScale as any).options?.()?.barSpacing ?? barSpacing;

              // Path 1: mouse is to the right of last bar → extrapolate
              if (currentLastBarX !== null && x > (currentLastBarX as number)) {
                const delta = (x - (currentLastBarX as number)) / barSp;
                return Math.round(lastTime + delta * barInterval);
              }

              // Path 2: normal area — try time API
              const t = timeScale.coordinateToTime(x as any);
              if (t !== null && t !== undefined && typeof t === 'number' && Number.isFinite(t) && t > 0) return t;

              // Path 3: try logical index
              try {
                const logical = timeScale.coordinateToLogical(x as any) as number | null;
                if (logical !== null && logical !== undefined && Number.isFinite(logical)) {
                  return Math.round(lastTime + (logical - lastBarIndex) * barInterval);
                }
              } catch {}

              // Path 4: visible range projection (handles empty future area when all else fails)
              const visibleRange = timeScale.getVisibleLogicalRange();
              if (visibleRange) {
                const leftX = timeScale.logicalToCoordinate(visibleRange.from as any) as number | null;
                const rightX = timeScale.logicalToCoordinate(visibleRange.to as any) as number | null;
                if (leftX !== null && rightX !== null && rightX !== leftX) {
                  const bsFromRange = (rightX - leftX) / (visibleRange.to - visibleRange.from);
                  const projLogical = visibleRange.to + (x - rightX) / bsFromRange;
                  return Math.round(lastTime + (projLogical - lastBarIndex) * barInterval);
                }
              }

              // Path 5: last resort with refreshed lastBarX
              if (currentLastBarX !== null) {
                const delta = (x - (currentLastBarX as number)) / barSp;
                return Math.round(lastTime + delta * barInterval);
              }
            } catch {}

            return NaN;
          },
          yToPrice: (y) => {
            if (!this.series) return NaN;
            try {
              const p = this.series.coordinateToPrice(y);
              if (p !== null && p !== undefined && Number.isFinite(p as number)) return p as number;
            } catch {}
            return NaN;
          },
          width: rect.width,
          height: rect.height,
          priceScaleWidth: pScaleWidth,
          timeScaleHeight: 30,
        });
      } catch (err) {
        console.warn('[DrawingEngine] Safe updateContext suppressed error:', err);
      }
    };
    this.updateContextFn = updateContext;
    updateContext();
    const onRange = () => {
      updateContext();
      this.renderDirectly();
    };
    try {
      chart.timeScale().subscribeVisibleLogicalRangeChange(onRange);
      chart.timeScale().subscribeVisibleTimeRangeChange(onRange);
    } catch {}

    const chartEl = chart.chartElement();
    const onPointerDown = () => {
      this.startPriceScaleTracking(updateContext);
    };
    const onPointerUp = () => this.stopPriceScaleTracking();
    if (chartEl) {
      chartEl.addEventListener('pointerdown', onPointerDown);
    }
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    this.chartTransformCleanup = () => {
      try {
        chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRange);
      } catch {}
      try {
        chart.timeScale().unsubscribeVisibleTimeRangeChange(onRange);
      } catch {}
      try {
        if (chartEl) chartEl.removeEventListener('pointerdown', onPointerDown);
      } catch {}
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      this.stopPriceScaleTracking();
    };
    this.invalidate();
  }

  resize(width: number, height: number, dpr?: number): void {
    this.renderer.resize(width, height, dpr);
    if (this.rc) this.rc = { ...this.rc, width, height };
    this.invalidate();
  }

  private activeDrag: { drawingId: string; screenPoints: Array<{ x: number; y: number }> } | null = null;

  setRenderContext(rc: RenderContext): void {
    this.rc = rc;
    this.invalidate();
  }

  setRenderState(state: { selectedIds?: string[]; hoveredId?: string | null; tempPoints?: DrawingPoint[]; activeTool?: string; activeDrag?: { drawingId: string; screenPoints: Array<{ x: number; y: number }> } | null }): void {
    const prevTool = this.activeTool;
    const prevTempLen = this.tempPoints.length;
    if (state.selectedIds) this.selectedIds = new Set(state.selectedIds);
    if ('hoveredId' in state) this.hoveredId = state.hoveredId ?? null;
    if (state.tempPoints) this.tempPoints = state.tempPoints;
    if (state.activeTool) this.activeTool = state.activeTool;
    if ('activeDrag' in state) this.activeDrag = state.activeDrag ?? null;
    if (isActive()) {
      trace(
        'engine.setRenderState',
        'DrawingEngine.ts:136',
        {
          fsm: '-',
          tool: this.activeTool,
          tempPoints: this.tempPoints,
          drawingsCount: this.drawings.count,
          selectedDrawingId: Array.from(this.selectedIds)[0] ?? null,
          isDrawingMode: this.activeTool !== 'pointer' && this.activeTool !== 'crosshair',
          note: `prevTool=${prevTool} prevTempLen=${prevTempLen} newTempLen=${this.tempPoints.length}`,
        }
      );
    }
    this.invalidate();
  }

  setCandles(candles: Array<{ time: number; open: number; high: number; low: number; close: number }>): void {
    this.candles = candles;
    this.snap.setCandles(candles);
    this.updateContextFn?.();
    this.invalidate();
  }

  createDrawing(input: CreateDrawingInput): DrawingObject {
    if (isActive()) {
      trace('DrawingEngine.createDrawing:enter', 'DrawingEngine.ts:149', {
        fsm: '-',
        tool: this.activeTool,
        tempPoints: this.tempPoints,
        drawingsCount: this.drawings.count,
        selectedDrawingId: Array.from(this.selectedIds)[0] ?? null,
        isDrawingMode: this.activeTool !== 'pointer' && this.activeTool !== 'crosshair',
        note: `input.type=${input.type} input.points.len=${input.points.length}`,
      });
    }
    const drawing = this.drawings.create(input);
    if (isActive()) {
      trace('DrawingManager.create:after', 'DrawingEngine.ts:151', {
        fsm: '-',
        tool: this.activeTool,
        tempPoints: this.tempPoints,
        drawingsCount: this.drawings.count,
        selectedDrawingId: drawing.id,
        isDrawingMode: this.activeTool !== 'pointer' && this.activeTool !== 'crosshair',
        note: `created drawing.id=${drawing.id.slice(0, 8)}`,
      });
    }
    this.history.push('create', [drawing.id], {}, { [drawing.id]: drawing });
    this.invalidate();
    return drawing;
  }

  updateDrawing(id: string, changes: UpdateDrawingInput): DrawingObject | null {
    const before = this.drawings.snapshot([id]);
    const drawing = this.drawings.update(id, changes);
    if (drawing) this.history.push('update', [id], before, { [id]: drawing });
    this.invalidate();
    return drawing;
  }

  deleteDrawing(id: string): boolean {
    const before = this.drawings.snapshot([id]);
    const ok = this.drawings.delete(id);
    if (ok) this.history.push('delete', [id], before, {});
    this.storage.save(this.drawings.all);
    this.invalidate();
    return ok;
  }

  deleteSelected(): void {
    const ids = this.selection.getSelectedIds();
    if (ids.length === 0 && this.selectedIds.size === 0) return;
    const drawingIds = ids.length > 0 ? ids : Array.from(this.selectedIds);
    const before = this.drawings.snapshot(drawingIds);
    this.drawings.deleteMany(drawingIds);
    this.history.push('delete', drawingIds, before, {});
    this.storage.save(this.drawings.all);
    this.selectedIds.clear();
    this.invalidate();
  }

  duplicateSelected(): DrawingObject[] {
    const ids = this.selection.getSelectedIds().length > 0 ? this.selection.getSelectedIds() : Array.from(this.selectedIds);
    const dups = this.drawings.duplicate(ids);
    this.storage.save(this.drawings.all);
    this.invalidate();
    return dups;
  }

  bringForward(id: string): void {
    this.drawings.bringForward(id);
    this.storage.save(this.drawings.all);
    this.invalidate();
  }

  sendBackward(id: string): void {
    this.drawings.sendBackward(id);
    this.storage.save(this.drawings.all);
    this.invalidate();
  }

  undo(): void {
    const entry = this.history.undo();
    if (!entry) return;
    for (const [id, partial] of Object.entries(entry.before)) {
      if (entry.type === 'create') this.drawings.delete(id);
      else this.drawings.update(id, partial);
    }
    this.storage.save(this.drawings.all);
    this.invalidate();
  }

  redo(): void {
    const entry = this.history.redo();
    if (!entry) return;
    for (const [id, partial] of Object.entries(entry.after)) {
      if (entry.type === 'delete') this.drawings.delete(id);
      else if (entry.type !== 'create') this.drawings.update(id, partial);
    }
    this.storage.save(this.drawings.all);
    this.invalidate();
  }

  on<K extends EventKey>(event: K, handler: EventHandler<K>): () => void {
    return this.events.on(event, handler);
  }

  off<K extends EventKey>(event: K, handler: EventHandler<K>): void {
    this.events.off(event, handler);
  }

  loadFromStorage(): void {
    try {
      const rawDrawings = this.storage.load();
      const sanitized = this.sanitizeDrawings(rawDrawings);
      this.drawings.load(sanitized);
      this.spatialIndex.rebuild(sanitized);
      if (sanitized.length !== rawDrawings.length) {
        this.saveToStorage();
      }
      this.invalidate();
    } catch (err) {
      console.error('[DrawingEngine] loadFromStorage error bypassed:', err);
    }
  }

  private sanitizeDrawings(drawings: DrawingObject[]): DrawingObject[] {
    if (!Array.isArray(drawings)) return [];
    const seenIds = new Set<string>();
    const valid: DrawingObject[] = [];

    for (const d of drawings) {
      if (!d || typeof d !== 'object' || !d.id || typeof d.id !== 'string') continue;
      if (seenIds.has(d.id)) continue;

      if (!Array.isArray(d.points) || d.points.length === 0) continue;
      const validPoints = d.points.every(
        (p) => p && typeof p === 'object' && Number.isFinite(p.time) && Number.isFinite(p.price)
      );
      if (!validPoints) continue;

      seenIds.add(d.id);
      valid.push(d);

      if (valid.length >= 1000) break;
    }
    return valid;
  }

  saveToStorage(): void {
    this.storage.save(this.drawings.all);
  }

  exportJSON(): string {
    return this.serializer.serializeAll(this.drawings.all);
  }

  importJSON(json: string): void {
    const rawDrawings = this.serializer.deserializeAll(json);
    const sanitized = this.sanitizeDrawings(rawDrawings);
    this.drawings.load(sanitized);
    this.spatialIndex.rebuild(sanitized);
    this.saveToStorage();
    this.invalidate();
  }

  clearAll(): void {
    this.drawings.clear();
    this.history.clear();
    this.saveToStorage();
    this.invalidate();
  }

  private renderScheduled = false;

  public requestRender(): void {
    if (this.renderScheduled) return;
    this.renderScheduled = true;
    const scheduleFn = typeof requestAnimationFrame !== 'undefined'
      ? requestAnimationFrame
      : (cb: () => void) => setTimeout(cb, 0);
    scheduleFn(() => {
      this.renderScheduled = false;
      this.executeRender();
    });
  }

  private executeRender(): void {
    this.render();
  }

  render(): void {
    if (!this.rc) return;

    if (isActive()) {
      trace('engine.render:enter', 'DrawingEngine.ts:270', {
        fsm: '-',
        tool: this.activeTool,
        tempPoints: this.tempPoints,
        drawingsCount: this.drawings.count,
        selectedDrawingId: Array.from(this.selectedIds)[0] ?? null,
        isDrawingMode: this.activeTool !== 'pointer' && this.activeTool !== 'crosshair',
        note: 'about to call renderer.render',
      });
    }

    this.renderer.invalidate();
    this.renderer.render(this.drawings.getVisible(), this.rc, {
      selectedIds: this.selectedIds,
      hoveredId: this.hoveredId,
      tempPoints: this.tempPoints,
      activeTool: this.activeTool,
      activeDrag: this.activeDrag,
    });
  }

  renderDirectly(): void {
    this.renderer.invalidate();
    this.render();
  }

  invalidate(): void {
    if (isActive()) {
      trace('engine.invalidate', 'DrawingEngine.ts:266', {
        fsm: '-',
        tool: this.activeTool,
        tempPoints: this.tempPoints,
        drawingsCount: this.drawings.count,
        selectedDrawingId: Array.from(this.selectedIds)[0] ?? null,
        isDrawingMode: this.activeTool !== 'pointer' && this.activeTool !== 'crosshair',
      });
    }
    this.renderer.invalidate();
    this.requestRender();
  }

  private startPriceScaleTracking(updateContext: () => void): void {
    if (this.priceScaleTrackingFrame !== null) return;
    const tick = () => {
      updateContext();
      this.renderDirectly();
      this.priceScaleTrackingFrame = requestAnimationFrame(tick);
    };
    this.priceScaleTrackingFrame = requestAnimationFrame(tick);
  }

  private stopPriceScaleTracking(): void {
    if (this.priceScaleTrackingFrame === null) return;
    cancelAnimationFrame(this.priceScaleTrackingFrame);
    this.priceScaleTrackingFrame = null;
    this.invalidate();
  }

  destroy(): void {
    if (this.animFrame !== null) cancelAnimationFrame(this.animFrame);
    this.stopPriceScaleTracking();
    this.chartTransformCleanup?.();
    this.events.removeAll();
    this.renderer.setCanvas(null);
    this.chart = null;
    this.series = null;
  }
}
