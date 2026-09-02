/**
 * interaction/ControlPoint.ts
 *
 * Control-point framework used by ALL drawings (Phase 4+). A drawing only
 * returns a list of ControlPoints; the interaction runtime handles hover,
 * hit-test, and (via the renderer) drawing them. Drawings never implement
 * their own handle logic.
 *
 * A ControlPoint lives in DOMAIN coordinates (time, price) — never pixels
 * (AD-03). The runtime converts to screen space via ICoordinateConverter
 * only when hit-testing or rendering.
 *
 * Kinds:
 *  - 'anchor'   : a defining point of the geometry (endpoints, corners)
 *  - 'resize'   : a handle that resizes without being a geometry vertex
 *  - 'center'   : the move-all handle
 *  - 'rotation' : reserved for future rotation UI (foundation only)
 *  - 'custom'   : type-specific handle (fib level drag, text width, etc.)
 *
 * No DOM, no canvas, no chart. Pure data + pure hit math.
 */

import type { DrawingPoint } from '../core/types';
import type { ICoordinateConverter } from '../core/api';

export type ControlPointKind =
  | 'anchor'
  | 'resize'
  | 'center'
  | 'rotation'
  | 'custom';

export interface ControlPoint {
  /** Stable id within a drawing (e.g. 'p0', 'p1', 'center', 'rot'). */
  readonly id: string;
  readonly kind: ControlPointKind;
  /** Domain-space location. */
  readonly point: DrawingPoint;
  /**
   * Optional index into the drawing's `points` array. Present for 'anchor'
   * handles so the engine can build a resize TransformOp targeting a point.
   */
  readonly anchorIndex?: number;
  /** Optional cursor hint the CursorManager may honor when hovering. */
  readonly cursor?: string;
  /** Extra per-type data (e.g. which fib level). Runtime treats as opaque. */
  readonly meta?: Readonly<Record<string, unknown>>;
}

export interface ControlPointHit {
  readonly cp: ControlPoint;
  /** Squared screen-space distance from the tested point (for ranking). */
  readonly distSq: number;
}

/**
 * Default hit radius (screen px) for a control-point handle.
 */
export const CONTROL_POINT_HIT_RADIUS = 7;

/**
 * Hit-test a screen point against a list of control points. Returns the
 * nearest handle within `radius` px, or null. Pure: math only.
 */
export function hitTestControlPoints(
  cps: ReadonlyArray<ControlPoint>,
  screenX: number,
  screenY: number,
  cc: ICoordinateConverter,
  radius: number = CONTROL_POINT_HIT_RADIUS
): ControlPointHit | null {
  const r2 = radius * radius;
  let best: ControlPointHit | null = null;
  for (const cp of cps) {
    const sx = cc.timeToX(cp.point.time);
    const sy = cc.priceToY(cp.point.price);
    if (sx === null || sy === null) continue;
    const dx = sx - screenX;
    const dy = sy - screenY;
    const d2 = dx * dx + dy * dy;
    if (d2 <= r2 && (best === null || d2 < best.distSq)) {
      best = { cp, distSq: d2 };
    }
  }
  return best;
}

/**
 * Build a 'center' control point at the centroid of the given points.
 * Helpers like this keep per-type control-point producers tiny in Phase 4.
 */
export function centerControlPoint(
  points: ReadonlyArray<DrawingPoint>,
  id = 'center'
): ControlPoint | null {
  if (points.length === 0) return null;
  let t = 0;
  let p = 0;
  for (const pt of points) {
    t += pt.time;
    p += pt.price;
  }
  return {
    id,
    kind: 'center',
    point: { time: t / points.length, price: p / points.length },
    cursor: 'move',
  };
}

/**
 * Build anchor control points from a drawing's points array. Each anchor
 * carries its anchorIndex so the engine can target it for a resize.
 */
export function anchorControlPoints(
  points: ReadonlyArray<DrawingPoint>,
  cursor = 'nwse-resize'
): ReadonlyArray<ControlPoint> {
  return points.map((pt, i) => ({
    id: `p${i}`,
    kind: 'anchor' as const,
    point: pt,
    anchorIndex: i,
    cursor,
  }));
}
