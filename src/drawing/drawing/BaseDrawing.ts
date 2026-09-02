/**
 * drawing/BaseDrawing.ts
 *
 * Abstract base for ALL drawing types.
 *
 * Hard rule: this class has NO mutation methods. All changes go through
 * DrawingEngine → Command → HistoryManager. Immutability is enforced at
 * the type level: data fields are `readonly`, and the class produces
 * new instances via `withData()` (called only by the engine).
 */

import type { BaseDrawingData, DrawingStyle, TransformOp } from '../core/types';
import type { DomainBounds } from '../geometry/bounds';

export abstract class BaseDrawing<TData extends BaseDrawingData = BaseDrawingData> {
  abstract readonly type: string;

  constructor(protected readonly data: TData) {}

  // ── Read-only accessors ──
  get id(): string { return this.data.id; }
  get points(): ReadonlyArray<TData['points'][number]> { return this.data.points; }
  get style(): DrawingStyle { return this.data.style; }
  get state(): TData['state'] { return this.data.state; }
  get visible(): boolean { return this.data.visible; }
  get locked(): boolean { return this.data.locked; }
  get zIndex(): number { return this.data.zIndex; }
  get groupId(): string | undefined { return this.data.groupId; }

  // ── Geometry queries (pure) ──
  abstract getBounds(): DomainBounds | null;

  /**
   * Control points exposed to hit-test / drag. May differ from `data.points`
   * for shapes with derived geometry (Fib levels, Ellipse rx/ry, etc.).
   */
  abstract getControlPoints(): ReadonlyArray<TData['points'][number]>;

  /**
   * Apply a transform op to produce a NEW data object. Pure: no side effects.
   * The engine calls this when building a TransformCommand.
   */
  abstract applyTransform(op: TransformOp): TData;

  /**
   * Apply a style patch to produce a NEW data object. Pure.
   */
  abstract applyStyle(patch: Partial<DrawingStyle>): TData;

  // ── Serialization ──
  abstract serialize(): unknown;
  abstract deserialize(raw: unknown): TData;

  /**
   * Deep clone with a new id. Used by ClipboardManager and DuplicateCommand.
   */
  abstract clone(newId: string, overrides?: Partial<TData>): TData;
}
