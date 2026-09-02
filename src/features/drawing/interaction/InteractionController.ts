/**
 * InteractionController — Single entry point for ALL interaction events.
 *
 * Architecture:
 *   Mouse Event → InteractionController → State Machine → Action
 *
 * Priority:
 *   1. Resize Anchor
 *   2. Drag Drawing
 *   3. Continue Drawing (create)
 *   4. Box Selection
 *   5. Context Menu
 *   6. Pan Chart (only if no drawing interaction)
 *   7. Zoom Chart (always)
 *
 * Key design:
 *   - Canvas always pointerEvents: 'none' (rendering only)
 *   - Capture layer only exists in drawing mode
 *   - Selection uses chart.subscribeClick()
 *   - Chart retains ALL its native interactions
 */

import type { InteractionState, InteractionEvent, CoordinateSystem } from './types';
import type { DrawingObject, DrawingPoint, DrawingStyle } from '../engine/types';
import { InteractionStateMachine } from './InteractionStateMachine';
import { HitTestEngine } from './HitTestEngine';
import { HoverController } from './HoverController';
import { SelectionController } from './SelectionController';
import { DragController } from './DragController';
import { CursorController, type CursorStyle } from './CursorController';
import { ChartInteractionBridge } from './ChartInteractionBridge';
import { ToolRegistry } from '../tools/ToolRegistry';
import { trace, isActive, finish, dump } from '../trace';

export interface InteractionCallbacks {
  // State
  getState: () => InteractionState;
  getHoveredId: () => string | null;
  getSelectedIds: () => string[];
  getTempPoints: () => DrawingPoint[];
  getActiveTool: () => string;
  getFloatingToolbar: () => { visible: boolean; x: number; y: number; drawingId: string | null };

  // State updates
  setHoveredId: (id: string | null) => void;
  setSelectedIds: (ids: string[]) => void;
  setTempPoints: (points: DrawingPoint[]) => void;
  setFloatingToolbar: (toolbar: { visible: boolean; x: number; y: number; drawingId: string | null }) => void;
  setCursorStyle: (style: CursorStyle) => void;

  // Drawing engine
  getDrawings: () => DrawingObject[];
  getDrawing: (id: string) => DrawingObject | undefined;
  createDrawing: (type: string, points: DrawingPoint[], style?: Partial<DrawingStyle>) => string | null;
  updateDrawing: (id: string, changes: { points?: DrawingPoint[]; style?: Partial<DrawingStyle> }) => void;
  deleteDrawing?: (id: string) => void;
  deleteSelected: () => void;
  undo: () => void;
  redo: () => void;
  getSnapManager?: () => import('../engine/DrawingSnapManager').DrawingSnapManager | undefined;

  // Tool
  onToolDeactivate?: () => void;

  // Render
  requestRedraw: () => void;
  setRenderState?: (state: { activeDrag?: { drawingId: string; screenPoints: Array<{ x: number; y: number }> } | null }) => void;
  onOpenSettingsModal?: (drawing: DrawingObject) => void;
}

function snapToShiftAngles(p1x: number, p1y: number, targetX: number, targetY: number): { x: number; y: number } {
  const dx = targetX - p1x;
  const dy = targetY - p1y;
  const dist = Math.hypot(dx, dy);
  if (dist <= 2) return { x: targetX, y: targetY };

  const angle = Math.atan2(dy, dx);
  const snapAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);

  if (Math.abs(Math.sin(snapAngle)) < 1e-6) {
    return { x: targetX, y: p1y };
  }
  if (Math.abs(Math.cos(snapAngle)) < 1e-6) {
    return { x: p1x, y: targetY };
  }
  return {
    x: p1x + dist * Math.cos(snapAngle),
    y: p1y + dist * Math.sin(snapAngle),
  };
}

export class InteractionController {
  private sm: InteractionStateMachine;
  private hitTest: HitTestEngine;
  private hover: HoverController;
  private selection: SelectionController;
  private drag: DragController;
  private cursor: CursorController;
  private bridge: ChartInteractionBridge;
  private toolRegistry: ToolRegistry;
  private callbacks: InteractionCallbacks;
  private lastHoverHit: string | null = null;
  private dragFrameId: number | null = null;
  private pendingMouseMove: { x: number; y: number } | null = null;

  constructor(callbacks: InteractionCallbacks) {
    this.callbacks = callbacks;
    this.sm = new InteractionStateMachine();
    this.hitTest = new HitTestEngine();
    this.hover = new HoverController();
    this.selection = new SelectionController();
    this.drag = new DragController({
      getDrawing: (id) => callbacks.getDrawing(id),
      updateDrawing: (id, points) => callbacks.updateDrawing(id, { points }),
      getSnapManager: () => callbacks.getSnapManager?.(),
    });
    this.cursor = new CursorController();
    this.bridge = new ChartInteractionBridge();
    this.toolRegistry = new ToolRegistry();

    // Sync selection with callbacks
    this.selection.onChange = (ids) => callbacks.setSelectedIds(ids);
    this.hover.onChange = (id) => callbacks.setHoveredId(id);

    // State transition & Pan Lock wiring
    this.sm.onTransition((from, to, event) => {
      this.updateCursor(to);

      if (to === 'dragging-object' || to === 'resizing-anchor') {
        this.bridge.captureDrawingEvents();
      } else if (to === 'idle' || to === 'selected-object') {
        this.bridge.releaseDrawingEvents();
      }
    });
  }

  // ── Public API ──────────────────────────────────────────────────

  setChart(chart: any, series: any) {
    this.bridge.setChart(chart, series);
  }

  setContainer(el: HTMLElement | null) {
    this.cursor.setContainer(el);
  }

  getBridge(): ChartInteractionBridge { return this.bridge; }

  // ── Event Handlers (single entry points) ────────────────────────

  handlePointerDown(clientX: number, clientY: number, ctrlKey: boolean, shiftKey: boolean = false): void {
    const chartPoint = this.bridge.screenToChart(clientX, clientY);
    if (!chartPoint) return;

    const state = this.sm.getState();
    const tool = this.callbacks.getActiveTool();
    const cs = this.bridge.getCoordinateSystem();

    // ── Shift Key Auto-Straight / Orthogonal Snap on Click ──
    if (shiftKey && state === 'creating-drawing') {
      const currentPoints = this.callbacks.getTempPoints();
      if (currentPoints.length >= 1) {
        const p1 = currentPoints[0];
        const p1x = cs.timeToX(p1.time);
        const p1y = cs.priceToY(p1.price);
        const snapped = snapToShiftAngles(p1x, p1y, chartPoint.x, chartPoint.y);
        chartPoint.x = snapped.x;
        chartPoint.y = snapped.y;
      }
    }

    if (isActive()) {
      const _tps = this.callbacks.getTempPoints();
      const _drawings = this.callbacks.getDrawings();
      const _sel = this.callbacks.getSelectedIds();
      trace('handlePointerDown:enter', 'InteractionController.ts:116', {
        fsm: state,
        tool,
        tempPoints: _tps,
        drawingsCount: _drawings.length,
        selectedDrawingId: _sel[0] ?? null,
        isDrawingMode: tool !== 'pointer' && tool !== 'crosshair',
        note: `chartPoint=(${chartPoint.x.toFixed(0)},${chartPoint.y.toFixed(0)})`,
      });
    }

    // ── Hit test (always performed for pointer/crosshair) ──
    let hit: import('./types').HitResult = { priority: 'chart', point: chartPoint };
    if (tool === 'pointer' || tool === 'crosshair') {
      this.hitTest.setSelectedIds(this.callbacks.getSelectedIds());
      hit = this.hitTest.test(this.callbacks.getDrawings(), chartPoint.x, chartPoint.y, cs, true);
    }

    // ── Priority 1: Anchor resize ──
    if (hit.priority === 'anchor' && hit.drawingId && hit.anchorIndex !== undefined) {
      const d = this.callbacks.getDrawing(hit.drawingId);
      if (d && !d.locked) {
        this.drag.startResize(hit.drawingId, hit.anchorIndex, chartPoint.x, chartPoint.y, d.points, cs, d.type);
        this.sm.transition('resizing-anchor', { type: 'pointer-down', x: chartPoint.x, y: chartPoint.y, ctrlKey });
        this.bridge.captureDrawingEvents();
        this.cursor.set('grabbing');
        return;
      }
    }

    // ── Priority 2: Drawing move ──
    if (hit.priority === 'drawing' && hit.drawingId) {
      const d = this.callbacks.getDrawing(hit.drawingId);
      if (d && !d.locked) {
        this.selection.select(hit.drawingId, ctrlKey);
        this.drag.startMove(hit.drawingId, chartPoint.x, chartPoint.y, d.points, cs, d.type);
        this.sm.transition('dragging-object', { type: 'pointer-down', x: chartPoint.x, y: chartPoint.y, ctrlKey });

        const bbox = this.getDrawingScreenBBox(d, cs);
        this.callbacks.setFloatingToolbar({
          visible: true,
          x: bbox ? bbox.minX + (bbox.maxX - bbox.minX) / 2 : chartPoint.x,
          y: (bbox?.minY ?? chartPoint.y) - 16,
          drawingId: d.id,
        });
        this.bridge.captureDrawingEvents();
        this.cursor.set('grabbing');
        return;
      }
    }

    // ── Priority 3: Creating drawing ──
    if (tool !== 'pointer' && tool !== 'crosshair') {
      const toolInstance = this.toolRegistry.get(tool as any);
      if (!toolInstance) return;

      const currentPoints = this.callbacks.getTempPoints();
      const cs = this.bridge.getCoordinateSystem();
      const snapMgr = this.callbacks.getSnapManager?.();
      const newPoints = toolInstance.onPointerDown(
        { getSnapPoint: (x: number, y: number) => {
          const t = cs.xToTime(x);
          const p = cs.yToPrice(y);
          const rawTime = (Number.isFinite(t) && t > 0) ? t : this.bridge.lastValidTime;
          const rawPrice = Number.isFinite(p) ? p : 0;
          if (snapMgr?.isEnabled()) {
            const snapRes = snapMgr.snap(rawTime, rawPrice, cs.xToTime, cs.yToPrice, cs.timeToX, cs.priceToY);
            if (snapRes.snapped) {
              return { time: snapRes.time, price: snapRes.price };
            }
          }
          return {
            time: rawTime,
            price: rawPrice,
          };
        }},
        chartPoint.x, chartPoint.y, currentPoints
      );

      let finalPoints = newPoints;
      if (finalPoints.length === 0) {
        const fallbackTime = this.bridge.lastValidTime || (Date.now() / 1000);
        const fallbackPrice = Number.isFinite(cs.yToPrice(chartPoint.y)) ? cs.yToPrice(chartPoint.y) : 0;
        finalPoints = [{ time: fallbackTime, price: fallbackPrice }];
      }

      if (toolInstance.isComplete(finalPoints)) {
        const newId = this.callbacks.createDrawing(tool, finalPoints);
        if (newId) {
          this.selection.select(newId);
          const drw = this.callbacks.getDrawing(newId);
          const bbox = drw ? this.getDrawingScreenBBox(drw, cs) : null;
          this.callbacks.setFloatingToolbar({
            visible: true,
            x: bbox ? bbox.minX + (bbox.maxX - bbox.minX) / 2 : chartPoint.x,
            y: (bbox?.minY ?? chartPoint.y) - 16,
            drawingId: newId,
          });
        }
        this.notifyPositionDrawing(tool, finalPoints);
        this.callbacks.setTempPoints([]);
        this.sm.transition('idle', { type: 'pointer-down', x: chartPoint.x, y: chartPoint.y, ctrlKey });
        this.callbacks.onToolDeactivate?.();
      } else {
        this.callbacks.setTempPoints(finalPoints);
        this.sm.transition('creating-drawing', { type: 'pointer-down', x: chartPoint.x, y: chartPoint.y, ctrlKey });
      }
      this.callbacks.requestRedraw();
      return;
    }

    // ── Priority 5: Click on empty space → deselect & clear temporary measurements ──
    this.selection.clear();
    this.clearTemporaryMeasurements();
    this.callbacks.setFloatingToolbar({ visible: false, x: 0, y: 0, drawingId: null });
    this.sm.transition('idle', { type: 'pointer-down', x: chartPoint.x, y: chartPoint.y, ctrlKey });
  }

  private clearTemporaryMeasurements(): void {
    const drawings = this.callbacks.getDrawings();
    for (const d of drawings) {
      if (d.type === 'price-range' || d.type === 'date-range' || d.type === 'date-price-range') {
        this.callbacks.deleteDrawing?.(d.id);
      }
    }
  }

  handleDoubleClick(clientX: number, clientY: number): void {
    const chartPoint = this.bridge.screenToChart(clientX, clientY);
    if (!chartPoint) return;
    const cs = this.bridge.getCoordinateSystem();
    const state = this.sm.getState();
    const tool = this.callbacks.getActiveTool();

    if (state === 'creating-drawing' && (tool === 'polyline' || tool === 'path')) {
      const currentPoints = this.callbacks.getTempPoints();
      const cleanPoints: DrawingPoint[] = [];
      for (const pt of currentPoints) {
        if (cleanPoints.length === 0) {
          cleanPoints.push(pt);
        } else {
          const last = cleanPoints[cleanPoints.length - 1];
          if (Math.abs(last.time - pt.time) > 0.0001 || Math.abs(last.price - pt.price) > 0.000001) {
            cleanPoints.push(pt);
          }
        }
      }
      if (cleanPoints.length >= 2) {
        const newId = this.callbacks.createDrawing(tool, cleanPoints);
        if (newId) {
          this.selection.select(newId);
          const drw = this.callbacks.getDrawing(newId);
          const bbox = drw ? this.getDrawingScreenBBox(drw, cs) : null;
          this.callbacks.setFloatingToolbar({
            visible: true,
            x: bbox ? bbox.minX + (bbox.maxX - bbox.minX) / 2 : chartPoint.x,
            y: (bbox?.minY ?? chartPoint.y) - 16,
            drawingId: newId,
          });
        }
      }
      this.callbacks.setTempPoints([]);
      this.sm.transition('idle', { type: 'pointer-down', x: chartPoint.x, y: chartPoint.y, ctrlKey: false });
      this.callbacks.onToolDeactivate?.();
      this.callbacks.requestRedraw();
      return;
    }

    const hit = this.hitTest.test(this.callbacks.getDrawings(), chartPoint.x, chartPoint.y, cs, false);
    if (hit.drawingId) {
      const d = this.callbacks.getDrawing(hit.drawingId);
      if (d) {
        this.callbacks.onOpenSettingsModal?.(d);
      }
    }
  }

  handlePointerMove(clientX: number, clientY: number, shiftKey: boolean = false): void {
    const chartPoint = this.bridge.screenToChart(clientX, clientY);
    if (!chartPoint) return;

    const state = this.sm.getState();
    const tool = this.callbacks.getActiveTool();
    const cs = this.bridge.getCoordinateSystem();

    // ── Shift Key Auto-Straight / Orthogonal Snap ──
    if (shiftKey && state === 'creating-drawing') {
      const currentPoints = this.callbacks.getTempPoints();
      if (currentPoints.length >= 1) {
        const p1 = currentPoints[0];
        const p1x = cs.timeToX(p1.time);
        const p1y = cs.priceToY(p1.price);
        const snapped = snapToShiftAngles(p1x, p1y, chartPoint.x, chartPoint.y);
        chartPoint.x = snapped.x;
        chartPoint.y = snapped.y;
      }
    }

    // ── Drag in progress (Immediate Screen-Space Update for Real-Time Live Preview) ──
    if (this.drag.isActive) {
      this.drag.update(chartPoint.x, chartPoint.y, shiftKey, cs);
      const activeId = this.drag.getDraggingId();
      const screenPoints = this.drag.getCurrentScreenPoints();
      if (activeId && screenPoints) {
        this.callbacks.setRenderState?.({
          activeDrag: { drawingId: activeId, screenPoints }
        });

        const drw = this.callbacks.getDrawing(activeId);
        if (drw && (drw.type === 'long-position' || drw.type === 'short-position')) {
          const domainPoints = screenPoints.map((sp) => ({
            time: cs.xToTime(sp.x),
            price: cs.yToPrice(sp.y),
          }));
          this.notifyPositionDrawing(drw.type, domainPoints);
        }
      }
      this.callbacks.requestRedraw();
      return;
    }

    // ── Hover detection (only in pointer mode, never in crosshair mode) ──
    if (tool === 'pointer') {
      this.hitTest.setSelectedIds(this.callbacks.getSelectedIds());
      const hit = this.hitTest.test(this.callbacks.getDrawings(), chartPoint.x, chartPoint.y, cs, false);
      const newHovered = hit.priority === 'drawing' ? hit.drawingId ?? null : null;
      this.hover.set(newHovered);

      if (hit.priority === 'anchor' && hit.anchorIndex !== undefined) {
        // Directional cursor based on handle position
        const cur = anchorIndexToCursor(hit.anchorIndex);
        this.cursor.set(cur);
      } else if (newHovered) {
        this.cursor.set('move');
      } else {
        this.cursor.set('default');
      }
      return;
    }

    if (tool === 'crosshair') {
      this.hover.set(null);
      this.cursor.set('default');
      return;
    }

    // ── Drawing preview ──
    if (state === 'creating-drawing') {
      const toolInstance = this.toolRegistry.get(tool as any);
      if (!toolInstance) return;
      const currentPoints = this.callbacks.getTempPoints();
      if (currentPoints.length === 0) return;
      const snapMgr = this.callbacks.getSnapManager?.();
      const newPoints = toolInstance.onPointerMove(
        { getSnapPoint: (x: number, y: number) => {
          const t = cs.xToTime(x);
          const p = cs.yToPrice(y);
          const rawTime = (Number.isFinite(t) && t > 0) ? t : this.bridge.lastValidTime;
          const rawPrice = Number.isFinite(p) ? p : 0;
          if (snapMgr?.isEnabled()) {
            const snapRes = snapMgr.snap(rawTime, rawPrice, cs.xToTime, cs.yToPrice, cs.timeToX, cs.priceToY);
            if (snapRes.snapped) {
              return { time: snapRes.time, price: snapRes.price };
            }
          }
          return {
            time: rawTime,
            price: rawPrice,
          };
        }},
        chartPoint.x, chartPoint.y, currentPoints
      );

      this.callbacks.setTempPoints(newPoints);
      this.callbacks.requestRedraw();
    }
  }

  handlePointerUp(): void {
    const tool = this.callbacks.getActiveTool();
    const state = this.sm.getState();
    if ((tool === 'brush' || tool === 'highlighter') && state === 'creating-drawing') {
      const currentPoints = this.callbacks.getTempPoints();
      if (currentPoints.length >= 2) {
        const newId = this.callbacks.createDrawing(tool, currentPoints);
        if (newId) {
          this.selection.select(newId);
          const cs = this.bridge.getCoordinateSystem();
          const drw = this.callbacks.getDrawing(newId);
          const bbox = drw ? this.getDrawingScreenBBox(drw, cs) : null;
          this.callbacks.setFloatingToolbar({
            visible: true,
            x: bbox ? bbox.minX + (bbox.maxX - bbox.minX) / 2 : 200,
            y: (bbox?.minY ?? 200) - 16,
            drawingId: newId,
          });
        }
      }
      this.callbacks.setTempPoints([]);
      this.sm.transition('idle', { type: 'pointer-up', x: 0, y: 0, ctrlKey: false });
      this.callbacks.onToolDeactivate?.();
      this.callbacks.requestRedraw();
      return;
    }

    if (this.dragFrameId !== null) {
      cancelAnimationFrame(this.dragFrameId);
      this.dragFrameId = null;
    }
    if (this.drag.isActive) {
      const cs = this.bridge.getCoordinateSystem();
      const result = this.drag.commit(cs);
      this.callbacks.setRenderState?.({ activeDrag: null });
      if (result) {
        this.callbacks.updateDrawing(result.drawingId, { points: result.points });
        this.selection.select(result.drawingId, false);
        const drw = this.callbacks.getDrawing(result.drawingId);
        if (drw) {
          this.notifyPositionDrawing(drw.type, result.points);
        }
      }
      this.bridge.releaseDrawingEvents();
      this.sm.transition('selected-object', { type: 'pointer-up', x: 0, y: 0, ctrlKey: false });
      this.cursor.set('default');
    }

    console.log('[DEBUG MouseUp] Drawings count AFTER commit:', this.callbacks.getDrawings().length);
    this.callbacks.requestRedraw();
  }

  handleWheel(e: WheelEvent): void {
    // Wheel ALWAYS goes to chart — never to drawing
    this.bridge.forwardWheelEvent(e);
  }

  handleKeyDown(key: string, ctrlKey: boolean, metaKey: boolean): boolean {
    const state = this.sm.getState();

    if (key === 'Escape') {
      if (state === 'creating-drawing') {
        this.callbacks.setTempPoints([]);
        this.sm.transition('idle', { type: 'escape' });
        this.callbacks.onToolDeactivate?.();
        this.callbacks.requestRedraw();
        return true;
      }
      this.selection.clear();
      this.callbacks.setFloatingToolbar({ visible: false, x: 0, y: 0, drawingId: null });
      this.sm.transition('idle', { type: 'escape' });
      this.callbacks.requestRedraw();
      return true;
    }

    if (key === 'Enter') {
      const tool = this.callbacks.getActiveTool();
      if (state === 'creating-drawing' && (tool === 'polyline' || tool === 'path')) {
        const currentPoints = this.callbacks.getTempPoints();
        const cleanPoints: DrawingPoint[] = [];
        for (const pt of currentPoints) {
          if (cleanPoints.length === 0) {
            cleanPoints.push(pt);
          } else {
            const last = cleanPoints[cleanPoints.length - 1];
            if (Math.abs(last.time - pt.time) > 0.0001 || Math.abs(last.price - pt.price) > 0.000001) {
              cleanPoints.push(pt);
            }
          }
        }
        if (cleanPoints.length >= 2) {
          const newId = this.callbacks.createDrawing(tool, cleanPoints);
          if (newId) {
            this.selection.select(newId);
            const cs = this.bridge.getCoordinateSystem();
            const drw = this.callbacks.getDrawing(newId);
            const bbox = drw ? this.getDrawingScreenBBox(drw, cs) : null;
            this.callbacks.setFloatingToolbar({
              visible: true,
              x: bbox ? bbox.minX + (bbox.maxX - bbox.minX) / 2 : 200,
              y: (bbox?.minY ?? 200) - 16,
              drawingId: newId,
            });
          }
        }
        this.callbacks.setTempPoints([]);
        this.sm.transition('idle', { type: 'key-down', key, ctrlKey, metaKey });
        this.callbacks.onToolDeactivate?.();
        this.callbacks.requestRedraw();
        return true;
      }
    }

    if (key === 'Delete' || key === 'Backspace') {
      if (this.callbacks.getSelectedIds().length > 0) {
        this.callbacks.deleteSelected();
        this.callbacks.setFloatingToolbar({ visible: false, x: 0, y: 0, drawingId: null });
        this.sm.transition('idle', { type: 'key-down', key, ctrlKey, metaKey });
        return true;
      }
    }

    if (key === 'z' && (ctrlKey || metaKey) && !metaKey) {
      this.callbacks.undo();
      return true;
    }
    if ((key === 'y' && (ctrlKey || metaKey)) || (key === 'z' && (ctrlKey || metaKey) && metaKey)) {
      this.callbacks.redo();
      return true;
    }

    return false;
  }

  // ── Helpers ──

  private getDrawingScreenBBox(d: DrawingObject, cs: CoordinateSystem) {
    if (d.points.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of d.points) {
      if (p.time === 0 && p.price === 0) continue;
      const x = cs.timeToX(p.time), y = cs.priceToY(p.price);
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    return { minX, minY, maxX, maxY };
  }

  private updateCursor(state: InteractionState): void {
    switch (state) {
      case 'hover-object': this.cursor.set('pointer'); break;
      case 'dragging-object': this.cursor.set('grabbing'); break;
      case 'resizing-anchor': this.cursor.set('grabbing'); break;
      case 'creating-drawing': this.cursor.set('crosshair'); break;
      default: this.cursor.set('default');
    }
  }

  private notifyPositionDrawing(type: string, points: DrawingPoint[]) {
    if ((type === 'long-position' || type === 'short-position') && points.length >= 3) {
      const isLong = type === 'long-position';
      const side = isLong ? 'buy' : 'sell';
      const entry = points[0].price;
      const p1 = points[1].price;
      const p2 = points[2].price;

      const sl = isLong ? Math.min(p1, p2) : Math.max(p1, p2);
      const tp = isLong ? Math.max(p1, p2) : Math.min(p1, p2);

      window.dispatchEvent(
        new CustomEvent('position-drawing-updated', {
          detail: { side, entry, sl, tp },
        })
      );
    }
  }
}

/**
 * Maps 8-handle anchorIndex to the correct directional resize cursor.
 * Convention matches both rectangle and position-tool handle layout:
 *   0=NW, 1=N, 2=NE, 3=E, 4=SE, 5=S, 6=SW, 7=W
 *   8/9/10 = position tool semantic price handles (ns-resize)
 */
function anchorIndexToCursor(idx: number): import('./CursorController').CursorStyle {
  switch (idx) {
    case 0: return 'nwse-resize'; // NW
    case 1: return 'ns-resize';   // N
    case 2: return 'nesw-resize'; // NE
    case 3: return 'ew-resize';   // E
    case 4: return 'nwse-resize'; // SE
    case 5: return 'ns-resize';   // S
    case 6: return 'nesw-resize'; // SW
    case 7: return 'ew-resize';   // W
    default: return 'ns-resize';  // semantic price handles
  }
}
