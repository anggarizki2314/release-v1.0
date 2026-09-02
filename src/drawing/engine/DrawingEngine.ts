/**
 * engine/DrawingEngine.ts
 *
 * Composition root. Implements DrawingEngineAPI.
 *
 * Hard rules:
 *  - The ONLY source of truth for drawings (AD-01).
 *  - All mutations go through Commands (AD-02, AD-08).
 *  - Emits typed events on EventBus (AD-07 — no business logic in the bus).
 *  - Zero React/Canvas/LWC imports (headless).
 *  - Managers do NOT call each other directly; they communicate via the
 *    engine or the event bus.
 */

import type {
  DrawingEngineAPI,
  ICoordinateConverter,
} from '../core/api';
import type {
  BaseDrawingData,
  DrawingPoint,
  DrawingStyle,
  TransformOp,
} from '../core/types';
import type {
  DrawingEventName,
  DrawingEventPayload,
} from '../core/events';

import { EventBus } from './EventBus';
import { DrawingManager } from './DrawingManager';
import { StubCoordinateConverter } from './CoordinateConverter';

import { DrawingRegistry } from '../drawing/DrawingRegistry';
import { applyTransformPure } from '../geometry/transform';

import { HistoryManager } from '../history/HistoryManager';
import { createCreateCommand } from '../history/commands/CreateCommand';
import { createDeleteCommand } from '../history/commands/DeleteCommand';
import { createUpdateCommand } from '../history/commands/UpdateCommand';
import { createTransformCommand } from '../history/commands/TransformCommand';
import { createStyleCommand } from '../history/commands/StyleCommand';
import { createGroupCommand, createUngroupCommand } from '../history/commands/GroupCommand';

import { SelectionManager } from '../interaction/SelectionManager';
import { HoverManager } from '../interaction/HoverManager';
import { InteractionController } from '../interaction/InteractionController';
import { InteractionStateMachine } from '../interaction/InteractionStateMachine';
import { DragController } from '../interaction/DragController';
import { HitTestEngine } from '../interaction/HitTestEngine';
import { SnapManager } from '../interaction/SnapManager';
import { KeyboardController } from '../interaction/KeyboardController';
import { CursorManager } from '../interaction/CursorManager';
import { BoxSelection } from '../interaction/BoxSelection';
import { anchorControlPoints } from '../interaction/ControlPoint';
import type { ControlPoint } from '../interaction/ControlPoint';

import { ToolRegistry } from '../tools/ToolRegistry';
import { ToolManager } from '../tools/ToolManager';

let idCounter = 0;
const newId = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}_${(idCounter++).toString(36)}`;

export interface DrawingEngineDeps {
  readonly registry: DrawingRegistry;
  readonly toolRegistry: ToolRegistry;
  readonly coordinateConverter?: ICoordinateConverter;
}

export class DrawingEngine implements DrawingEngineAPI {
  // ── Infrastructure ──
  readonly events: EventBus;
  readonly registry: DrawingRegistry;
  readonly toolRegistry: ToolRegistry;

  // ── Storage ──
  readonly drawings: DrawingManager;

  // ── Interaction ──
  readonly fsm: InteractionStateMachine;
  readonly selection: SelectionManager;
  readonly hoverMgr: HoverManager;
  readonly drag: DragController;
  readonly hitTest: HitTestEngine;
  readonly snap: SnapManager;
  readonly keyboard: KeyboardController;
  readonly cursor: CursorManager;
  readonly boxSelection: BoxSelection;
  // (per-type control-point producers declared once below)
  readonly tools: ToolManager;
  readonly interaction: InteractionController;

  // ── History ──
  readonly history: HistoryManager;

  // ── Coordinate ──
  private coordConv: ICoordinateConverter;
  private destroyed = false;

  // ── Transient creation state (tool-managed) ──
  private previewPoints: ReadonlyArray<DrawingPoint> = [];
  private currentZCounter = 1;

  // ── Phase 3.5: per-type control-point producers (Phase 4 registers here) ──
  private controlPointProducers = new Map<string, (d: BaseDrawingData) => ReadonlyArray<ControlPoint>>();
  private clipboardData: BaseDrawingData[] = [];

  constructor(deps: DrawingEngineDeps) {
    this.events = new EventBus();
    this.registry = deps.registry;
    this.toolRegistry = deps.toolRegistry;
    this.coordConv = deps.coordinateConverter ?? new StubCoordinateConverter();

    this.drawings = new DrawingManager(this.events.emit.bind(this.events));
    this.history = new HistoryManager(this.events.emit.bind(this.events));

    this.fsm = new InteractionStateMachine();
    this.selection = new SelectionManager(this.events.emit.bind(this.events));
    this.hoverMgr = new HoverManager(this.events.emit.bind(this.events));
    this.drag = new DragController();
    this.hitTest = new HitTestEngine(this.registry);
    this.snap = new SnapManager();
    this.keyboard = new KeyboardController();
    this.cursor = new CursorManager();
    this.boxSelection = new BoxSelection();

    this.tools = new ToolManager(this.toolRegistry, this.events.emit.bind(this.events));

    this.interaction = new InteractionController(
      this.fsm,
      this.selection,
      this.hoverMgr,
      this.drag,
      this.hitTest,
      this.snap,
      this.keyboard,
      this.tools,
      {
        onCreate: (point) => this.toolCreate(point),
        onCommitCreate: () => this.toolCommit(),
        onCancelCreate: () => this.toolCancel(),
        onUpdatePreview: (pts) => this.toolUpdatePreview(pts),
        onSelect: (ids, opts) => this.select(ids, opts),
        onHover: (id) => this.hoverMgr.set(id),
        onBeginDrag: (id, screenX, screenY) => this.toolBeginDrag(id, screenX, screenY),
        onDrag: (id, dTime, dPrice) => this.toolDrag(id, dTime, dPrice),
        onEndDrag: (id) => this.toolEndDrag(id),
        onBeginResize: (id, handleId) => this.resizeBegin(id, handleId),
        onResize: (id, anchorIndex, target) => this.resizeApply(id, anchorIndex, target),
        onEndResize: (id, handleId) => this.resizeEnd(id, handleId),
        onDeleteSelected: () => this.deleteMany(this.selection.list()),
        onSelectAll: () => this.selectAll(),
        onDuplicate: () => this.duplicate(this.selection.list()),
        onUndo: () => this.undo(),
        onRedo: () => this.redo(),
        onCopy: () => this.copy(this.selection.list()),
        onPaste: () => this.paste(),
        onEscape: () => this.fsm.transition('cancelled'),
      },
      this.cursor
    );

    this.interaction.installDefaultKeyBindings();
    this.interaction.setDrawingsSource(() => this.drawings.list() as ReadonlyArray<BaseDrawingData>);
    // Control points: generic anchor handles unless a type registers its own.
    this.interaction.setControlPointsSource((d) => this.controlPointsFor(d));

    // ── EventBus bridges (AD-07): subsystems talk via events only. ──
    // FSM transitions → typed interaction event (renderer/UI listen, not called).
    this.fsm.onTransition((from, to) => {
      this.events.emit('interaction:state-changed', { from, to });
    });
    // Cursor changes → typed event so the presentation adapter can apply CSS.
    this.cursor.subscribe((kind) => {
      this.events.emit('cursor:changed', { cursor: this.cursorKindToType(kind) });
    });

    // Re-emit tool/tool-state to renderer via a single window-size event.
    this.events.on('viewport:changed', () => { /* renderers subscribe via cc() */ });
  }

  /** Map CursorManager kind to the event's CursorType vocabulary. */
  private cursorKindToType(kind: import('../interaction/CursorManager').CursorKind): import('../core/events').CursorType {
    switch (kind) {
      case 'move': return 'move';
      case 'crosshair': return 'crosshair';
      case 'pointer': return 'pointer';
      case 'text': return 'text';
      case 'rotate': return 'rotate';
      case 'resize-ns':
      case 'resize-ew':
      case 'resize-nwse':
      case 'resize-nesw': return 'resize';
      default: return 'default';
    }
  }

  /** Control points for a drawing: per-type producer, else generic anchors. */
  private controlPointsFor(d: BaseDrawingData): ReadonlyArray<ControlPoint> {
    const producer = this.controlPointProducers.get(d.type);
    if (producer) return producer(d);
    return anchorControlPoints(d.points);
  }

  /**
   * Phase 4 seam: a concrete drawing type can register a control-point
   * producer so its handles (fib levels, text width, pitchfork) differ from
   * generic anchors. No engine change needed to add a type.
   */
  registerControlPointProducer(
    typeId: string,
    producer: (d: BaseDrawingData) => ReadonlyArray<ControlPoint>
  ): void {
    this.controlPointProducers.set(typeId, producer);
  }

  // ── Lifecycle ──
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.events.clear();
    this.drawings.clear();
    this.history.clear();
    this.interaction.setDrawingMode(false);
  }

  // ── API: Read ──
  get(id: string): Readonly<BaseDrawingData> | undefined { return this.drawings.get(id); }
  list(): ReadonlyArray<Readonly<BaseDrawingData>> { return this.drawings.list(); }
  getSelectedIds(): ReadonlyArray<string> { return this.selection.list(); }
  getHoveredId(): string | null { return this.hoverMgr.current(); }
  cc(): ICoordinateConverter { return this.coordConv; }

  /** Inject a coordinate converter after construction (Phase 3.5 seam). */
  setCoordinateConverter(cc: ICoordinateConverter): void { this.coordConv = cc; }

  getTool(): string | null { return this.tools.activeId(); }

  // ── API: Subscribe ──
  on<K extends DrawingEventName>(event: K, handler: (payload: DrawingEventPayload<K>) => void): () => void {
    return this.events.on(event, handler);
  }

  // ── API: Tool ──
  setTool(toolId: string | null): void {
    // TradingView behavior: leaving a tool ALWAYS resets every interaction
    // session (preview, drag-pending, drag-active, resize-session,
    // pending-box). Post-create is exactly Idle + Pointer mode.
    this.previewPoints = [];
    this.interaction.resetTransient();
    const ok = this.tools.activate(toolId);
    if (ok) {
      this.interaction.setDrawingMode(toolId !== null);
    }
  }

  // ── API: Selection / Hover ──
  select(ids: ReadonlyArray<string>, opts: { multi?: boolean; toggle?: boolean } = {}): void {
    this.selection.set(ids, opts);
  }

  hover(id: string | null): void { this.hoverMgr.set(id); }

  // ── API: CRUD ──
  create(typeId: string, initial: Partial<BaseDrawingData>): string {
    const bundle = this.registry.get(typeId);
    if (!bundle) throw new Error(`[DrawingEngine] unknown typeId: ${typeId}`);
    const id = initial.id ?? newId('d');
    const zIndex = initial.zIndex ?? this.currentZCounter++;
    const data = bundle.factory.create({
      ...initial,
      id,
      type: typeId,
      zIndex,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      visible: initial.visible ?? true,
      locked: initial.locked ?? false,
      state: 'normal',
    });
    this.drawings.add(data);
    this.history.push(createCreateCommand(data));
    return id;
  }

  update(id: string, patch: Partial<BaseDrawingData>): void {
    const prev = this.drawings.get(id);
    if (!prev) return;
    if (prev.locked) return;
    const next = Object.freeze({
      ...prev,
      ...patch,
      id: prev.id,
      type: prev.type,
      createdAt: prev.createdAt,
      updatedAt: Date.now(),
    }) as BaseDrawingData;
    this.drawings.replace(next);
    this.history.push(createUpdateCommand(prev, next, 'update'));
  }

  delete(id: string): void {
    const snap = this.drawings.remove(id);
    if (!snap) return;
    this.selection.prune([id]);
    this.history.push(createDeleteCommand([snap]));
  }

  deleteMany(ids: ReadonlyArray<string>): void {
    const snaps = this.drawings.removeMany(ids);
    if (snaps.length === 0) return;
    this.selection.prune(ids);
    this.history.push(createDeleteCommand(snaps));
  }

  // ── API: Transform ──
  transform(id: string, op: TransformOp): void {
    const prev = this.drawings.get(id);
    if (!prev || prev.locked) return;
    const nextPoints = applyTransformPure(prev.points, op);
    if (!nextPoints) return;
    const next = Object.freeze({
      ...prev,
      points: Object.freeze(nextPoints) as ReadonlyArray<DrawingPoint>,
      updatedAt: Date.now(),
    }) as BaseDrawingData;
    this.drawings.replace(next);
    this.history.push(createTransformCommand(prev, next, op));
  }

  transformMany(ids: ReadonlyArray<string>, op: TransformOp): void {
    for (const id of ids) this.transform(id, op);
  }

  // ── API: Style ──
  setStyle(id: string, patch: Partial<DrawingStyle>): void {
    const prev = this.drawings.get(id);
    if (!prev || prev.locked) return;
    const next = Object.freeze({
      ...prev,
      style: { ...prev.style, ...patch } as DrawingStyle,
      updatedAt: Date.now(),
    }) as BaseDrawingData;
    this.drawings.replace(next);
    this.history.push(createStyleCommand(prev, next, patch));
  }

  // ── API: Lock / Visibility ──
  setLocked(id: string, locked: boolean): void {
    const prev = this.drawings.get(id);
    if (!prev) return;
    const next = Object.freeze({ ...prev, locked, updatedAt: Date.now() }) as BaseDrawingData;
    this.drawings.replace(next);
    this.history.push(createUpdateCommand(prev, next, 'lock'));
  }

  setVisible(id: string, visible: boolean): void {
    const prev = this.drawings.get(id);
    if (!prev) return;
    const next = Object.freeze({ ...prev, visible, updatedAt: Date.now() }) as BaseDrawingData;
    this.drawings.replace(next);
    this.history.push(createUpdateCommand(prev, next, 'visibility'));
  }

  // ── API: Group ──
  group(ids: ReadonlyArray<string>): string | null {
    if (ids.length < 2) return null;
    const before = ids.map((id) => this.drawings.get(id)).filter(Boolean) as BaseDrawingData[];
    if (before.length !== ids.length) return null;
    const groupId = newId('grp');
    const ts = Date.now();
    const groupDrawing = Object.freeze({
      id: groupId,
      type: 'group',
      points: [],
      style: { color: '#000000', lineWidth: 1, opacity: 0, lineStyle: 'solid' as const },
      state: 'normal' as const,
      visible: true,
      locked: false,
      zIndex: this.currentZCounter++,
      createdAt: ts,
      updatedAt: ts,
    }) as BaseDrawingData;
    this.drawings.add(groupDrawing);
    const after: BaseDrawingData[] = before.map((d) =>
      Object.freeze({ ...d, groupId, updatedAt: ts }) as BaseDrawingData
    );
    for (const a of after) this.drawings.replace(a);
    this.history.push(createGroupCommand(before, after, groupDrawing, groupId));
    this.events.emit('group:created', { groupId, childIds: ids });
    return groupId;
  }

  ungroup(groupId: string): ReadonlyArray<string> {
    const group = this.drawings.get(groupId);
    if (!group) return [];
    const childIds = this.list()
      .filter((d) => d.groupId === groupId)
      .map((d) => d.id);
    const beforeChildren = childIds
      .map((id) => this.drawings.get(id))
      .filter(Boolean) as BaseDrawingData[];
    const ts = Date.now();
    const afterChildren: BaseDrawingData[] = beforeChildren.map((d) =>
      Object.freeze({ ...d, groupId: undefined, updatedAt: ts }) as BaseDrawingData
    );
    for (const a of afterChildren) this.drawings.replace(a);
    this.drawings.remove(groupId);
    this.history.push(createUngroupCommand(beforeChildren, afterChildren, group, groupId));
    this.events.emit('group:disbanded', { groupId, childIds });
    return childIds;
  }

  // ── API: History ──
  undo(): void {
    const cmd = this.history.popUndo();
    if (!cmd) return;
    this.replayCommand(cmd, /* reverse = */ true);
  }

  redo(): void {
    const cmd = this.history.popRedo();
    if (!cmd) return;
    this.replayCommand(cmd, /* reverse = */ false);
  }

  // ── API: Clipboard (Phase 1 stub) ──
  copy(ids: ReadonlyArray<string>): void {
    const snapshots = ids.map((id) => this.drawings.get(id)).filter(Boolean) as BaseDrawingData[];
    this.clipboardData = snapshots.map((d) => ({ ...d, points: [...d.points] }));
  }
  paste(): void {
    if (!this.clipboardData || this.clipboardData.length === 0) return;
    const pasteOffset = newId('paste');
    const ids: string[] = [];
    for (const data of this.clipboardData) {
      const id = this.create(data.type, {
        points: [...data.points],
        style: { ...data.style },
        visible: data.visible,
        locked: data.locked,
      });
      ids.push(id);
    }
    if (ids.length > 0) this.selection.set(ids);
  }
  duplicate(ids: ReadonlyArray<string>): void {
    this.copy(ids);
    this.paste();
  }

  // ── Tool private hooks ──
  private toolCreate(point: DrawingPoint): void {
    const tool = this.tools.active();
    if (!tool) return;
    const ctx = { cc: this.coordConv, currentToolId: tool.id };
    const next = tool.onPointerDown(ctx, point, this.previewPoints);
    this.previewPoints = next;
    this.events.emit('drawing:updated', {
      prev: this.previewSnapshot(),
      next: this.previewSnapshot(),
      reason: { kind: 'create' },
    });
  }

  private toolUpdatePreview(points: ReadonlyArray<DrawingPoint>): void {
    this.previewPoints = points;
    this.events.emit('drawing:updated', {
      prev: this.previewSnapshot(),
      next: this.previewSnapshot(),
      reason: { kind: 'create' },
    });
  }

  private toolCommit(): void {
    const tool = this.tools.active();
    if (!tool) return;
    if (!tool.isComplete(this.previewPoints)) {
      // Not enough anchors yet — leave the tool active and let the next
      // pointerDown add another anchor. previewPoints preserved.
      return;
    }
    // Persist the drawing (rendered as permanent).
    const id = this.create(tool.createsTypeId, { points: [...this.previewPoints] });
    // TradingView MODE CREATE completion:
    //   - auto-return to pointer
    //   - destroy preview points
    //   - FSM → selected-object (newly created line is selected)
    this.previewPoints = [];
    this.interaction.resetTransient();
    tool.reset();
    this.setTool(null);
    if (id) {
      this.select([id]);
    }
  }

  private toolCancel(): void {
    this.previewPoints = [];
    this.interaction.resetTransient();
    this.tools.resetActive();
    this.setTool(null);
  }

  private toolBeginDrag(id: string, screenX: number, screenY: number): void {
    const data = this.drawings.get(id);
    if (!data) return;
    this.drag.begin(
      { drawingId: id, points: [...data.points], bounds: null },
      screenX,
      screenY
    );
  }

  private toolDrag(id: string, dTime: number, dPrice: number): void {
    this.transform(id, { kind: 'move', dTime, dPrice });
  }

  private toolEndDrag(id: string): void {
    this.drag.end();
  }

  private resizeBegin(_id: string, _handleId: string): void {
    /* no-op */
  }

  private resizeApply(id: string, anchorIndex: number, target: DrawingPoint): void {
    this.transform(id, { kind: 'resize', anchorIndex, target });
  }

  private resizeEnd(_id: string, _handleId: string): void {
    /* no-op */
  }

  private selectAll(): void {
    this.select(this.list().map((d) => d.id));
  }

  private previewSnapshot(): Readonly<BaseDrawingData> {
    return Object.freeze({
      id: '__preview__',
      type: '__preview__',
      points: [...this.previewPoints],
      style: { color: '#4f86f7', lineWidth: 1, opacity: 70, lineStyle: 'dashed' },
      state: 'creating',
      visible: true,
      locked: false,
      zIndex: 0,
      createdAt: 0,
      updatedAt: 0,
    }) as Readonly<BaseDrawingData>;
  }

  // ── Internal: Replay a command forward or backward. ──
  private replayCommand(cmd: import('../history/ICommand').ICommand, reverse: boolean): void {
    const target = reverse ? cmd.before : cmd.after;
    if (cmd.kind === 'create') {
      if (reverse) {
        for (const id of Object.keys(cmd.after)) this.drawings.remove(id);
      } else {
        for (const data of Object.values(cmd.after)) this.drawings.add(data);
      }
      return;
    }
    if (cmd.kind === 'delete') {
      if (reverse) {
        for (const data of Object.values(cmd.before)) this.drawings.add(data);
      } else {
        for (const id of Object.keys(cmd.before)) this.drawings.remove(id);
      }
      return;
    }
    for (const data of Object.values(target)) {
      this.drawings.replace(data);
    }
  }
}
