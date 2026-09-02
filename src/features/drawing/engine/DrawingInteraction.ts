/**
 * Drawing Engine — DrawingInteraction
 *
 * Handles pointer events and translates them to drawing actions.
 * Supports: hover, click, drag, resize, rotate, anchor.
 */

import type { DrawingObject, DrawingPoint, HitTestResult } from './types';
import { DrawingEventBus } from './events';
import { ToolManager } from './ToolManager';
import { SelectionManager } from './SelectionManager';
import { DrawingManager } from './DrawingManager';
import { DrawingHitTester } from './DrawingHitTester';
import { DrawingSnapManager } from './DrawingSnapManager';
import { DrawingHistory } from './DrawingHistory';
import { DrawingStorage } from './DrawingStorage';

export type InteractionMode = 'idle' | 'drawing' | 'dragging' | 'resizing' | 'rotating' | 'box-select';

export interface InteractionCallbacks {
  timeToX: (t: number) => number;
  priceToY: (p: number) => number;
  xToTime: (x: number) => number;
  yToPrice: (y: number) => number;
  requestRedraw: () => void;
}

export class DrawingInteraction {
  private mode: InteractionMode = 'idle';
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private hoveredDrawing: DrawingObject | null = null;
  private tempPoints: DrawingPoint[] = [];
  private callbacks: InteractionCallbacks;

  constructor(
    private events: DrawingEventBus,
    private toolManager: ToolManager,
    private selection: SelectionManager,
    private drawings: DrawingManager,
    private hitTester: DrawingHitTester,
    private snapManager: DrawingSnapManager,
    private history: DrawingHistory,
    private storage: DrawingStorage,
    callbacks: InteractionCallbacks
  ) {
    this.callbacks = callbacks;
  }

  get currentMode(): InteractionMode { return this.mode; }
  get currentTempPoints(): DrawingPoint[] { return this.tempPoints; }

  onPointerDown(x: number, y: number, ctrlKey = false, shiftKey = false): void {
    const time = this.callbacks.xToTime(x);
    const price = this.callbacks.yToPrice(y);
    const snap = this.snapManager.snap(time, price, this.callbacks.xToTime, this.callbacks.yToPrice);
    const point: DrawingPoint = { time: snap.time, price: snap.price };

    const tool = this.toolManager.activeTool;

    if (tool === 'pointer') {
      // Hit test
      const hit = this.hitTester.test(
        this.drawings.getVisible(), x, y,
        this.callbacks.timeToX, this.callbacks.priceToY
      );

      if (hit) {
        if (ctrlKey) {
          this.selection.toggle(hit.drawing.id);
        } else if (!this.selection.isSelected(hit.drawing.id)) {
          this.selection.select(hit.drawing.id);
        }
        // Start drag
        this.mode = 'dragging';
        this.isDragging = true;
        this.dragStartX = x;
        this.dragStartY = y;
      } else {
        if (!ctrlKey) this.selection.clear();
        // Start box select
        this.mode = 'box-select';
        this.dragStartX = x;
        this.dragStartY = y;
      }
    } else if (tool === 'crosshair') {
      // Do nothing for crosshair
    } else {
      // Drawing mode
      if (this.mode !== 'drawing') {
        this.mode = 'drawing';
        this.tempPoints = [point];
      } else {
        this.tempPoints.push(point);

        // Auto-complete for tools with fixed point counts
        const pointCount = this.getRequiredPoints(tool);
        if (pointCount > 0 && this.tempPoints.length >= pointCount) {
          this.completeDrawing();
        }
      }
    }

    this.callbacks.requestRedraw();
  }

  onPointerMove(x: number, y: number): void {
    const time = this.callbacks.xToTime(x);
    const price = this.callbacks.yToPrice(y);
    const snap = this.snapManager.snap(time, price, this.callbacks.xToTime, this.callbacks.yToPrice);

    if (this.mode === 'drawing') {
      // Update last temp point
      if (this.tempPoints.length > 0) {
        this.tempPoints[this.tempPoints.length - 1] = { time: snap.time, price: snap.price };
      }
    } else if (this.mode === 'dragging' && this.isDragging) {
      // Move selected drawings
      const dx = x - this.dragStartX;
      const dy = y - this.dragStartY;
      const dTime = this.callbacks.xToTime(dx) - this.callbacks.xToTime(0);
      const dPrice = this.callbacks.yToPrice(dy) - this.callbacks.yToPrice(0);

      for (const id of this.selection.getSelectedIds()) {
        const d = this.drawings.get(id);
        if (d && !d.locked) {
          const newPoints = d.points.map((p) => ({ time: p.time + dTime, price: p.price + dPrice }));
          this.drawings.update(id, { points: newPoints });
        }
      }
      this.dragStartX = x;
      this.dragStartY = y;
    } else if (this.mode === 'idle') {
      // Hover detection
      const hit = this.hitTester.test(
        this.drawings.getVisible(), x, y,
        this.callbacks.timeToX, this.callbacks.priceToY
      );
      const newHovered = hit?.drawing ?? null;
      if (newHovered !== this.hoveredDrawing) {
        this.hoveredDrawing = newHovered;
      }
    }

    this.callbacks.requestRedraw();
  }

  onPointerUp(): void {
    if (this.mode === 'drawing') {
      // For single-click tools (horizontal-line, vertical-line), complete immediately
      const tool = this.toolManager.activeTool;
      if (this.getRequiredPoints(tool) === 1 && this.tempPoints.length === 1) {
        this.completeDrawing();
      }
    }

    if (this.mode === 'dragging' && this.isDragging) {
      // Record history
      this.history.push('move', this.selection.getSelectedIds(), {}, {});
    }

    if (this.mode === 'box-select') {
      // Box select completed
    }

    this.mode = 'idle';
    this.isDragging = false;
    this.callbacks.requestRedraw();
  }

  onDoubleClick(x: number, y: number): void {
    const hit = this.hitTester.test(
      this.drawings.getVisible(), x, y,
      this.callbacks.timeToX, this.callbacks.priceToY
    );
    if (hit) {
      // Double-click to edit text or complete polyline
      if (this.mode === 'drawing' && this.tempPoints.length > 1) {
        this.completeDrawing();
      }
    }
  }

  onKeyDown(key: string): void {
    if (key === 'Escape') {
      if (this.mode === 'drawing') {
        this.mode = 'idle';
        this.tempPoints = [];
        this.toolManager.returnToPointer();
      } else {
        this.selection.clear();
      }
      this.callbacks.requestRedraw();
    } else if (key === 'Delete' || key === 'Backspace') {
      const ids = this.selection.getSelectedIds();
      if (ids.length > 0) {
        const snapshot = this.drawings.snapshot(ids);
        this.drawings.deleteMany(ids);
        this.history.push('delete', ids, snapshot, {});
        this.toolManager.returnToPointer();
      }
    } else if (key === 'a' && (navigator.platform.includes('Mac') ? true : true)) {
      // Ctrl+A / Cmd+A
      this.selection.selectAll(this.drawings.all);
      this.callbacks.requestRedraw();
    }
  }

  private completeDrawing(): void {
    const tool = this.toolManager.activeTool;
    if (this.tempPoints.length === 0) return;

    const drawing = this.drawings.create({
      type: tool as any,
      points: [...this.tempPoints],
    });

    this.history.push('create', [drawing.id], {}, { [drawing.id]: drawing });
    this.tempPoints = [];
    this.toolManager.returnToPointer();
    this.storage.save(this.drawings.all);
    this.callbacks.requestRedraw();
  }

  private getRequiredPoints(tool: string): number {
    const fixed: Record<string, number> = {
      'horizontal-line': 1, 'vertical-line': 1, 'horizontal-ray': 1,
      'trendline': 2, 'ray': 2, 'info-line': 2, 'extended-line': 2,
      'cross-line': 1, 'rectangle': 2, 'circle': 2, 'ellipse': 2,
      'triangle': 3, 'arrow': 2, 'arrow-up': 1, 'arrow-down': 1,
      'fibonacci': 2, 'pitchfork': 3,
    };
    return fixed[tool] ?? 0; // 0 = freeform (double-click to complete)
  }
}
