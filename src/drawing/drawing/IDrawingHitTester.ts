/**
 * drawing/IDrawingHitTester.ts
 *
 * Hit-test contract, per drawing type.
 * Hit-test is its OWN subsystem (AD-06). It does not live in the renderer.
 */

import type { BaseDrawingData, DrawingPoint } from '../core/types';
import type { ICoordinateConverter } from '../core/api';

export type HitResult =
  | { readonly priority: 'body' }
  | { readonly priority: 'anchor'; readonly index: number };

export interface IDrawingHitTester<TData extends BaseDrawingData = BaseDrawingData> {
  readonly typeId: string;

  /**
   * Test a screen-space (x,y) against the drawing. Returns null if not hit.
   * Caller supplies the screen-space threshold in pixels (line widths, anchor hit radius).
   */
  hitTest(
    drawing: TData,
    x: number,
    y: number,
    cc: ICoordinateConverter,
    threshold: number
  ): HitResult | null;

  /**
   * Anchors exposed for drag. May be a superset of data.points
   * (e.g. fib levels, ellipse quadrant points).
   */
  getAnchors(drawing: TData): ReadonlyArray<DrawingPoint>;
}
