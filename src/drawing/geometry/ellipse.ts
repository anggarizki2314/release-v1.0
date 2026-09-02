/**
 * geometry/ellipse.ts
 */

import type { Point2 } from './point';

export interface Ellipse {
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
}

export const ellipseFromCorners = (a: Point2, b: Point2): Ellipse => ({
  cx: (a.x + b.x) / 2,
  cy: (a.y + b.y) / 2,
  rx: Math.abs(b.x - a.x) / 2,
  ry: Math.abs(b.y - a.y) / 2,
});

/**
 * Approximate point-in-ellipse using normalized radius.
 */
export const pointInEllipse = (p: Point2, e: Ellipse, tolerance = 0): boolean => {
  if (e.rx === 0 || e.ry === 0) return false;
  const dx = (p.x - e.cx) / (e.rx + tolerance);
  const dy = (p.y - e.cy) / (e.ry + tolerance);
  return dx * dx + dy * dy <= 1;
};
