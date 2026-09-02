/**
 * geometry/rectangle.ts
 *
 * Pure 2D rectangle geometry math. NO drawing imports, NO canvas access.
 */

import type { Point2 } from './point';
import { distancePointToSegment } from './line';

export interface RectangleBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly width: number;
  readonly height: number;
}

export interface Rectangle8Handles {
  readonly nw: Point2; // 0: Top-Left
  readonly n: Point2;  // 1: Top-Center
  readonly ne: Point2; // 2: Top-Right
  readonly e: Point2;  // 3: Middle-Right
  readonly se: Point2; // 4: Bottom-Right
  readonly s: Point2;  // 5: Bottom-Center
  readonly sw: Point2; // 6: Bottom-Left
  readonly w: Point2;  // 7: Middle-Left
}

/**
 * Computes perpendicular rectangle bounds from two diagonal points (P1 & P2).
 */
export const rectangleBounds = (p1: Point2, p2: Point2): RectangleBounds => {
  const minX = Math.min(p1.x, p2.x);
  const maxX = Math.max(p1.x, p2.x);
  const minY = Math.min(p1.y, p2.y);
  const maxY = Math.max(p1.y, p2.y);
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
};

/**
 * Computes 8 control handle points of perpendicular rectangle.
 * 0: NW (Top-Left)
 * 1: N  (Top-Center)
 * 2: NE (Top-Right)
 * 3: E  (Middle-Right)
 * 4: SE (Bottom-Right)
 * 5: S  (Bottom-Center)
 * 6: SW (Bottom-Left)
 * 7: W  (Middle-Left)
 */
export const rectangle8Handles = (p1: Point2, p2: Point2): Rectangle8Handles => {
  const bounds = rectangleBounds(p1, p2);
  const midX = (bounds.minX + bounds.maxX) / 2;
  const midY = (bounds.minY + bounds.maxY) / 2;
  return {
    nw: { x: bounds.minX, y: bounds.minY },
    n:  { x: midX,        y: bounds.minY },
    ne: { x: bounds.maxX, y: bounds.minY },
    e:  { x: bounds.maxX, y: midY },
    se: { x: bounds.maxX, y: bounds.maxY },
    s:  { x: midX,        y: bounds.maxY },
    sw: { x: bounds.minX, y: bounds.maxY },
    w:  { x: bounds.minX, y: midY },
  };
};

/**
 * Checks if point P is inside the rectangle area (inside hit-test).
 */
export const isPointInRectangle = (p: Point2, p1: Point2, p2: Point2): boolean => {
  const bounds = rectangleBounds(p1, p2);
  return p.x >= bounds.minX && p.x <= bounds.maxX && p.y >= bounds.minY && p.y <= bounds.maxY;
};

/**
 * Minimum distance from point P to rectangle's 4 edges.
 */
export const distancePointToRectangleEdges = (p: Point2, p1: Point2, p2: Point2): number => {
  const bounds = rectangleBounds(p1, p2);
  const nw = { x: bounds.minX, y: bounds.minY };
  const ne = { x: bounds.maxX, y: bounds.minY };
  const se = { x: bounds.maxX, y: bounds.maxY };
  const sw = { x: bounds.minX, y: bounds.maxY };

  const dTop = distancePointToSegment(p, nw, ne);
  const dRight = distancePointToSegment(p, ne, se);
  const dBottom = distancePointToSegment(p, se, sw);
  const dLeft = distancePointToSegment(p, sw, nw);
  return Math.min(dTop, dRight, dBottom, dLeft);
};

/**
 * HitTest body distance for Rectangle (returns 0 if inside body, else distance to edge).
 */
export const hitTestRectangleBody = (p: Point2, p1: Point2, p2: Point2): number => {
  if (isPointInRectangle(p, p1, p2)) return 0;
  return distancePointToRectangleEdges(p, p1, p2);
};

/**
 * Resizes rectangle when handle index `handleIndex` (0..7) is dragged to `newPos`.
 * Returns updated [P1, P2] diagonal points while keeping opposite side/corner 100% FIXED.
 *
 * Fixed Pivot Mapping:
 * 0: NW (Top-Left)     -> Fixed Pivot: SE (maxX, maxY)
 * 1: N  (Top-Center)  -> Fixed Pivot: S  (maxY border)
 * 2: NE (Top-Right)    -> Fixed Pivot: SW (minX, maxY)
 * 3: E  (Middle-Right) -> Fixed Pivot: W  (minX border)
 * 4: SE (Bottom-Right) -> Fixed Pivot: NW (minX, minY)
 * 5: S  (Bottom-Center)-> Fixed Pivot: N  (minY border)
 * 6: SW (Bottom-Left)  -> Fixed Pivot: NE (maxX, minY)
 * 7: W  (Middle-Left)  -> Fixed Pivot: E  (maxX border)
 */
export const updateRectangleHandle = (
  p1: Point2,
  p2: Point2,
  handleIndex: number,
  newPos: Point2
): [Point2, Point2] => {
  const minX = Math.min(p1.x, p2.x);
  const maxX = Math.max(p1.x, p2.x);
  const minY = Math.min(p1.y, p2.y);
  const maxY = Math.max(p1.y, p2.y);

  let newMinX = minX;
  let newMaxX = maxX;
  let newMinY = minY;
  let newMaxY = maxY;

  switch (handleIndex) {
    case 0: // NW (Top-Left) — Pivot: SE (maxX, maxY) fixed
      newMinX = newPos.x;
      newMinY = newPos.y;
      break;

    case 1: // N (Top-Center) — Pivot: Bottom (maxY) & Left/Right fixed
      newMinY = newPos.y;
      break;

    case 2: // NE (Top-Right) — Pivot: SW (minX, maxY) fixed
      newMaxX = newPos.x;
      newMinY = newPos.y;
      break;

    case 3: // E (Middle-Right) — Pivot: Left (minX) & Top/Bottom fixed
      newMaxX = newPos.x;
      break;

    case 4: // SE (Bottom-Right) — Pivot: NW (minX, minY) fixed
      newMaxX = newPos.x;
      newMaxY = newPos.y;
      break;

    case 5: // S (Bottom-Center) — Pivot: Top (minY) & Left/Right fixed
      newMaxY = newPos.y;
      break;

    case 6: // SW (Bottom-Left) — Pivot: NE (maxX, minY) fixed
      newMinX = newPos.x;
      newMaxY = newPos.y;
      break;

    case 7: // W (Middle-Left) — Pivot: Right (maxX) & Top/Bottom fixed
      newMinX = newPos.x;
      break;
  }

  return [
    { x: newMinX, y: newMinY },
    { x: newMaxX, y: newMaxY },
  ];
};
