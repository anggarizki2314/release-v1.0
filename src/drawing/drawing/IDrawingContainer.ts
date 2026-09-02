/**
 * drawing/IDrawingContainer.ts
 *
 * Composite Pattern. A Group IS-A Drawing (a BaseDrawing with children).
 * SelectionManager only tracks ids; it never stores structure.
 *
 * IDrawingContainer is also the contract for any drawing that owns children.
 * Concrete groups (GroupContainer) implement this; leaf drawings do not.
 */

import type { BaseDrawingData, DrawingPoint, TransformOp } from '../core/types';

export interface IDrawingContainer<TData extends BaseDrawingData = BaseDrawingData> {
  readonly id: string;
  readonly type: string;
  readonly childIds: ReadonlyArray<string>;

  /**
   * Apply a transform op recursively to all children, then recompute
   * container's own derived geometry if any. Pure: returns new data.
   */
  applyTransform(op: TransformOp): TData;

  /**
   * Apply a style patch — optionally inheritable. If patch.inheritable
   * is true (engine convention), children are also updated.
   */
  applyStyle(patch: Record<string, unknown>): TData;
}
