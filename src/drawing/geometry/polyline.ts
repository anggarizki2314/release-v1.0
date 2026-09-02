/**
 * geometry/polyline.ts
 *
 * Polyline = ordered list of points connected by segments.
 * Used by Brush, Path, Curve, and similar.
 */

import type { Point2 } from './point';
import { distancePointToSegment } from './line';

/**
 * Closest distance from P to any segment of the polyline.
 * Returns { distance, segmentIndex }.
 */
export const distancePointToPolyline = (
  p: Point2, verts: ReadonlyArray<Point2>
): { distance: number; segmentIndex: number } | null => {
  if (verts.length < 2) return null;
  let best = Infinity;
  let bestIdx = 0;
  for (let i = 0; i < verts.length - 1; i++) {
    const d = distancePointToSegment(p, verts[i], verts[i + 1]);
    if (d < best) {
      best = d;
      bestIdx = i;
    }
  }
  return { distance: best, segmentIndex: bestIdx };
};

/**
 * Bounding box of an ordered point list.
 */
export const polylineBounds = (verts: ReadonlyArray<Point2>): {
  minX: number; minY: number; maxX: number; maxY: number;
} | null => {
  if (verts.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of verts) {
    if (v.x < minX) minX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.x > maxX) maxX = v.x;
    if (v.y > maxY) maxY = v.y;
  }
  return { minX, minY, maxX, maxY };
};
