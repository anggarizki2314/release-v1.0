/**
 * geometry/polygon.ts
 */

import type { Point2 } from './point';

/**
 * Ray-casting point-in-polygon.
 * Polygon is a list of vertices; first/last vertex need not coincide.
 */
export const pointInPolygon = (p: Point2, verts: ReadonlyArray<Point2>): boolean => {
  if (verts.length < 3) return false;
  let inside = false;
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const xi = verts[i].x, yi = verts[i].y;
    const xj = verts[j].x, yj = verts[j].y;
    const intersect =
      (yi > p.y) !== (yj > p.y) &&
      p.x < ((xj - xi) * (p.y - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};
