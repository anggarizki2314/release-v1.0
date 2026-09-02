/**
 * interaction/InteractionController.ts
 *
 * THE single entry point for all pointer + keyboard input. Owns the FSM and
 * orchestrates the full interaction pipeline:
 *
 *   PointerEvent → InteractionController → HitTestEngine → ControlPoint →
 *   SelectionManager → HoverManager → DragController → ToolManager →
 *   DrawingEngine → EventBus → Renderer
 *
 * Hard rules:
 *  - NEVER touches DOM/Canvas/LWC.
 *  - NEVER calls the Renderer. All visual updates flow through the engine's
 *    mutations + EventBus (AD-07).
 *  - NEVER mutates drawings directly. It only calls engine callbacks, which
 *    build Commands (AD-02, AD-08).
 *
 * Forex Replay interaction model — CLICK-CLICK (single click to start a mode,
 * single click to commit). NOT a "drag-then-release" model.
 *
 *   CREATE  ↳ click 1 → anchor pin + FSM creating-drawing
 *            ↳ click 2 → commit + tool returns to pointer + FSM idle
 *
 *   MOVE    ↳ click on body → FSM dragging-object + drag begin (cursor=move)
 *            ↳ mousemove → drawing follows cursor
 *            ↳ click 2 → commit + drag end + FSM idle + cursor=default
 *
 *   RESIZE  ↳ click on handle → FSM resizing-anchor + resize begin
 *            ↳ mousemove → resize preview
 *            ↳ click 2 → commit + resize end + FSM idle
 *
 *   EMPTY CLICK → nothing. Stay Idle. No marquee, no deselect, no preview.
 *
 * Only ONE mode active at a time. All click-click operations must end with:
 *   ActiveTool = null, Preview = null, MoveSession = null,
 *   ResizeSession = null, DragSession = null, Selection = empty,
 *   Cursor = default, FSM = idle.
 */

import type { InteractionStateMachine } from './InteractionStateMachine';
import type { SelectionManager } from './SelectionManager';
import type { HoverManager } from './HoverManager';
import type { DragController } from './DragController';
import type { HitTestEngine } from './HitTestEngine';
import type { SnapManager } from './SnapManager';
import type { KeyboardController } from './KeyboardController';
import type { CursorManager } from './CursorManager';
import { CursorManager as CursorManagerClass } from './CursorManager';
import type { ToolManager } from '../tools/ToolManager';
import type { ICoordinateConverter } from '../core/api';
import type { BaseDrawingData, DrawingPoint } from '../core/types';
import type { ControlPoint } from './ControlPoint';
import { hitTestControlPoints, anchorControlPoints } from './ControlPoint';

/** Default snap threshold in pixels. */
const SNAP_THRESHOLD_PX = 6;

export interface InteractionCallbacks {
  // Create (tool)
  onCreate: (point: DrawingPoint) => void;
  onUpdatePreview: (points: ReadonlyArray<DrawingPoint>) => void;
  onCommitCreate: () => void;
  onCancelCreate: () => void;

  // Selection / Hover
  onSelect: (ids: ReadonlyArray<string>, opts: { multi?: boolean; toggle?: boolean }) => void;
  onHover: (id: string | null) => void;

  // Drag (move) — click-click model
  onBeginDrag: (id: string, screenX: number, screenY: number) => void;
  onDrag: (id: string, dTime: number, dPrice: number) => void;
  onEndDrag: (id: string) => void;

  // Resize — click-click model
  onBeginResize?: (id: string, handleId: string) => void;
  onResize?: (id: string, anchorIndex: number, target: DrawingPoint) => void;
  onEndResize?: (id: string, handleId: string) => void;

  // Keyboard-driven
  onDeleteSelected: () => void;
  onSelectAll?: () => void;
  onDuplicate?: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onEscape: () => void;
}

export class InteractionController {
  private isDrawingMode = false;
  private previewPoints: ReadonlyArray<DrawingPoint> = [];

  // Move session (click-click)
  private moveActive: string | null = null;
  private moveStartX = 0;
  private moveStartY = 0;

  // Resize session (click-click)
  private resizeSession: { id: string; handleId: string; anchorIndex: number } | null = null;

  // Sources injected by the engine
  private drawingsSource: (() => ReadonlyArray<BaseDrawingData>) | null = null;
  private controlPointsSource: ((d: BaseDrawingData) => ReadonlyArray<ControlPoint>) | null = null;

  constructor(
    private readonly fsm: InteractionStateMachine,
    private readonly selection: SelectionManager,
    private readonly hover: HoverManager,
    private readonly drag: DragController,
    private readonly hitTest: HitTestEngine,
    private readonly snap: SnapManager,
    private readonly keyboard: KeyboardController,
    private readonly toolManager: ToolManager,
    private readonly callbacks: InteractionCallbacks,
    private readonly cursor?: CursorManager
  ) {}

  setDrawingMode(on: boolean): void {
    this.isDrawingMode = on;
    if (!on) {
      this.previewPoints = [];
    }
    this.cursor?.set(on ? 'crosshair' : 'default');
  }

  // ─────────────────────────────────────────────────────────────────────
  // POINTER PIPELINE — single source of truth
  // ─────────────────────────────────────────────────────────────────────

  pointerDown(x: number, y: number, cc: ICoordinateConverter, ctrl: boolean): void {
    // ── DEBUG TRACER ─────────────────────────────────────────────────
    if ((globalThis as { FXDEBUG?: boolean }).FXDEBUG) {
      // eslint-disable-next-line no-console
      console.log('[FX] pointerDown', {
        x, y,
        activeTool: this.toolManager.activeId(),
        drawingMode: this.isDrawingMode,
        ctrlPreviewPoints: this.previewPoints.length,
        selectedDrawing: this.selection.list()[0] ?? null,
        moveActive: this.moveActive,
        dragOrigin: this.drag.isActive(),
        resizeSession: this.resizeSession?.id ?? null,
        fsm: this.fsm.getState(),
      });
    }
    // ────────────────────────────────────────────────────────────────

    // MODE 1 — RESIZE / commit-resize
    if (this.resizeSession) {
      // Click after resize started while pointer moves → COMMIT RESIZE.
      this.callbacks.onEndResize?.(this.resizeSession.id, this.resizeSession.handleId);
      this.resizeSession = null;
      this.selection.clear();
      this.hover.set(null);
      this.cursor?.set('default');
      if (this.fsm.getState() === 'resizing-anchor') {
        this.transition('resizing-anchor', 'idle');
      }
      return;
    }

    // MODE 2 — MOVE / commit-move
    if (this.moveActive && this.drag.isActive()) {
      // Click 2 during Move → COMMIT MOVE.
      this.callbacks.onEndDrag(this.moveActive);
      this.drag.end();
      this.moveActive = null;
      this.selection.clear();
      this.hover.set(null);
      this.cursor?.set('default');
      if (this.fsm.getState() === 'dragging-object') {
        this.transition('dragging-object', 'idle');
      }
      return;
    }

    // MODE 3 — CREATE tool (click 1 / click 2)
    if (this.isDrawingMode) {
      const dp = this.screenToSnapped(x, y, cc);
      if (!dp) return;
      this.callbacks.onCreate(dp);
      this.previewPoints = this.previewPoints.length > 0
        ? [this.previewPoints[0], dp]
        : [dp];
      if (this.fsm.getState() !== 'creating-drawing') {
        this.transition(this.fsm.getState(), 'creating-drawing');
      }
      const tool = this.toolManager.active();
      if (tool && tool.isComplete(this.previewPoints)) {
        this.commitCreate();
      }
      return;
    }

    // ── RESIZE HANDLE priority (instant edit) ──
    const cpHit = this.hitTestControlPointsAt(x, y, cc);
    if (cpHit && cpHit.cp.anchorIndex !== undefined) {
      this.resizeSession = {
        id: cpHit.drawingId,
        handleId: cpHit.cp.id,
        anchorIndex: cpHit.cp.anchorIndex,
      };
      this.transition(this.fsm.getState(), 'resizing-anchor');
      this.callbacks.onBeginResize?.(cpHit.drawingId, cpHit.cp.id);
      this.cursor?.set(CursorManagerClass.fromHint(cpHit.cp.cursor));
      return;
    }

    // ── BODY click → START MOVE (click-click model) ──
    const bodyHit = this.hitTest.test(this.allDrawings(), x, y, cc);
    if (bodyHit) {
      this.callbacks.onSelect([bodyHit.id], { multi: ctrl, toggle: ctrl });
      this.moveActive = bodyHit.id;
      this.moveStartX = x;
      this.moveStartY = y;
      this.callbacks.onBeginDrag(bodyHit.id, x, y);
      this.transition(this.fsm.getState(), 'dragging-object');
      this.cursor?.set('move');
      return;
    }

    // ── EMPTY click → NO-OP (Idle) ──
    // Per spec: clicking empty candle area must do NOTHING. No marquee,
    // no deselect, no preview. Stay Idle.
    return;
  }

  pointerMove(x: number, y: number, cc: ICoordinateConverter, ctrl: boolean): void {
    // ── DEBUG TRACER ─────────────────────────────────────────────────
    if ((globalThis as { FXDEBUG?: boolean }).FXDEBUG) {
      // eslint-disable-next-line no-console
      console.log('[FX] pointerMove', {
        x, y,
        activeTool: this.toolManager.activeId(),
        ctrlPreviewPoints: this.previewPoints.length,
        moveActive: this.moveActive,
        dragOrigin: this.drag.isActive(),
        resizeSession: this.resizeSession?.id ?? null,
        fsm: this.fsm.getState(),
      });
    }
    // ────────────────────────────────────────────────────────────────

    // CREATE preview
    if (this.isDrawingMode) {
      const dp = this.screenToSnapped(x, y, cc);
      if (!dp) return;
      const next = this.previewPoints.length > 0
        ? [this.previewPoints[0], dp]
        : [dp];
      this.previewPoints = next;
      this.callbacks.onUpdatePreview(next);
      return;
    }

    // RESIZE in progress
    if (this.resizeSession) {
      const target = this.screenToSnapped(x, y, cc);
      if (target) {
        this.callbacks.onResize?.(this.resizeSession.id, this.resizeSession.anchorIndex, target);
      }
      return;
    }

    // MOVE in progress — drawing follows cursor
    if (this.moveActive && this.drag.isActive()) {
      const delta = this.drag.delta(cc, x, y);
      if (delta) this.callbacks.onDrag(this.moveActive, delta.dTime, delta.dPrice);
      return;
    }

    // HOVER + cursor feedback (idle only)
    const cpHover = this.hitTestControlPointsAt(x, y, cc);
    if (cpHover) {
      this.callbacks.onHover(cpHover.drawingId);
      this.cursor?.set(CursorManagerClass.fromHint(cpHover.cp.cursor));
      return;
    }
    const hit = this.hitTest.test(this.allDrawings(), x, y, cc);
    this.callbacks.onHover(hit ? hit.id : null);
    this.cursor?.set(hit ? 'pointer' : 'default');
  }

  pointerUp(): void {
    // ── DEBUG TRACER ─────────────────────────────────────────────────
    if ((globalThis as { FXDEBUG?: boolean }).FXDEBUG) {
      // eslint-disable-next-line no-console
      console.log('[FX] pointerUp', {
        activeTool: this.toolManager.activeId(),
        ctrlPreviewPoints: this.previewPoints.length,
        moveActive: this.moveActive,
        dragOrigin: this.drag.isActive(),
        resizeSession: this.resizeSession?.id ?? null,
        fsm: this.fsm.getState(),
      });
    }
    // ────────────────────────────────────────────────────────────────

    // Hold-drag-release: end any active drag on mouseup
    if (this.moveActive && this.drag.isActive()) {
      this.callbacks.onEndDrag(this.moveActive);
      this.drag.end();
      this.moveActive = null;
      this.selection.clear();
      this.hover.set(null);
      this.cursor?.set('default');
      if (this.fsm.getState() === 'dragging-object') {
        this.transition('dragging-object', 'idle');
      }
    }
  }

  commitCreate(): void {
    this.previewPoints = [];
    this.callbacks.onCommitCreate();
  }

  cancelCreate(): void {
    this.previewPoints = [];
    this.callbacks.onCancelCreate();
  }

  /**
   * HARD RESET of every transient interaction session. Called by the engine
   * whenever a tool is left (post-create, post-cancel, manual tool switch,
   * Escape, workspace swap). After this call: FSM is `idle`, no preview
   * points, no move session, no resize session, selection cleared, hover
   * cleared, cursor reset.
   */
  resetTransient(): void {
    this.previewPoints = [];
    this.moveActive = null;
    if (this.drag.isActive()) this.drag.end();
    if (this.resizeSession) {
      this.callbacks.onEndResize?.(this.resizeSession.id, this.resizeSession.handleId);
      this.resizeSession = null;
    }
    this.selection.clear();
    this.hover.set(null);
    this.cursor?.set('default');
    this.forceToIdle();
  }

  private forceToIdle(): void {
    let st: string = this.fsm.getState();
    while (st !== 'idle' && st !== 'cancelled') {
      const ok = this.fsm.transition('idle');
      if (!ok) {
        this.fsm.transition('cancelled');
        this.fsm.transition('idle');
      }
      st = this.fsm.getState();
    }
    if (st === 'cancelled') this.fsm.transition('idle');
  }

  /**
   * Transitions the FSM state.
   *
   * Pan Lock Contract (AD-07 / Architecture Phase 2):
   * Entering 'dragging-object' or 'resizing-anchor' triggers an interaction:state-changed event
   * with target state. React/UI presentation adapters listen to this event to disable chart pan
   * (e.g., LWC handleScroll: false). Transitioning to 'idle' or 'selected-object' releases the lock.
   */
  private transition(from: string, to: string): void {
    const fromState = this.fsm.getState();
    if (fromState === to) return;
    const ok = this.fsm.transition(to as never);
    if (!ok) {
      this.fsm.transition('cancelled');
      this.fsm.transition(to as never);
    }
    void from;
  }

  // ─────────────────────────────────────────────────────────────────────
  // KEYBOARD
  // ─────────────────────────────────────────────────────────────────────

  installDefaultKeyBindings(): void {
    this.keyboard.bind(
      (e) => e.key === 'Escape',
      () => { this.callbacks.onEscape(); return true; }
    );
    this.keyboard.bind(
      (e) => e.key === 'Delete' || e.key === 'Backspace',
      () => { this.callbacks.onDeleteSelected(); return true; }
    );
    this.keyboard.bind(
      (e) => e.key === 'a' && (e.ctrl || e.meta),
      () => { this.callbacks.onSelectAll?.(); return true; }
    );
    this.keyboard.bind(
      (e) => e.key === 'd' && (e.ctrl || e.meta),
      () => { this.callbacks.onDuplicate?.(); return true; }
    );
    this.keyboard.bind(
      (e) => e.key === 'z' && (e.ctrl || e.meta) && !e.shift,
      () => { this.callbacks.onUndo(); return true; }
    );
    this.keyboard.bind(
      (e) =>
        (e.key === 'y' && (e.ctrl || e.meta)) ||
        (e.key === 'z' && (e.ctrl || e.meta) && e.shift),
      () => { this.callbacks.onRedo(); return true; }
    );
    this.keyboard.bind(
      (e) => e.key === 'c' && (e.ctrl || e.meta),
      () => { this.callbacks.onCopy(); return true; }
    );
    this.keyboard.bind(
      (e) => e.key === 'v' && (e.ctrl || e.meta),
      () => { this.callbacks.onPaste(); return true; }
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // INJECTED SOURCES (set by the engine)
  // ─────────────────────────────────────────────────────────────────────

  setDrawingsSource(fn: () => ReadonlyArray<BaseDrawingData>): void {
    this.drawingsSource = fn;
  }

  setControlPointsSource(fn: (d: BaseDrawingData) => ReadonlyArray<ControlPoint>): void {
    this.controlPointsSource = fn;
  }

  // ─────────────────────────────────────────────────────────────────────
  // INTERNAL
  // ─────────────────────────────────────────────────────────────────────

  private allDrawings(): ReadonlyArray<BaseDrawingData> {
    return this.drawingsSource ? this.drawingsSource() : [];
  }

  private controlPointsFor(d: BaseDrawingData): ReadonlyArray<ControlPoint> {
    if (this.controlPointsSource) return this.controlPointsSource(d);
    return anchorControlPoints(d.points);
  }

  private hitTestControlPointsAt(
    x: number,
    y: number,
    cc: ICoordinateConverter
  ): { drawingId: string; cp: ControlPoint } | null {
    const selected = this.selection.list();
    if (selected.length === 0) return null;
    const drawings = this.allDrawings();
    let best: { drawingId: string; cp: ControlPoint; distSq: number } | null = null;
    for (const d of drawings) {
      if (!this.selection.has(d.id) || d.locked || !d.visible) continue;
      const cps = this.controlPointsFor(d);
      const hit = hitTestControlPoints(cps, x, y, cc);
      if (hit && (best === null || hit.distSq < best.distSq)) {
        best = { drawingId: d.id, cp: hit.cp, distSq: hit.distSq };
      }
    }
    return best ? { drawingId: best.drawingId, cp: best.cp } : null;
  }

  private screenToSnapped(x: number, y: number, cc: ICoordinateConverter): DrawingPoint | null {
    const t = cc.xToTime(x);
    const p = cc.yToPrice(y);
    if (t === null || p === null) return null;
    return this.snap.apply(
      { time: t, price: p },
      {
        xToTime: (xx) => cc.xToTime(xx),
        yToPrice: (yy) => cc.yToPrice(yy),
        timeToX: (tt) => cc.timeToX(tt),
        priceToY: (pp) => cc.priceToY(pp),
        threshold: SNAP_THRESHOLD_PX,
      }
    );
  }
}
