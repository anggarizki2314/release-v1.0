/**
 * geometry/line.ts
 *
 * Pure 2D line math. NO drawing imports, NO canvas access.
 */

import type { Point2 } from './point';

export interface Segment {
  readonly a: Point2;
  readonly b: Point2;
}

/**
 * Perpendicular distance from point P to infinite line through A-B.
 */
export const distancePointToLine = (p: Point2, a: Point2, b: Point2): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  // |(B-A) x (A-P)| / |B-A|
  const num = Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x);
  return num / Math.sqrt(len2);
};

/**
 * Perpendicular distance from point P to SEGMENT A-B.
 */
export const distancePointToSegment = (p: Point2, a: Point2, b: Point2): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const projx = a.x + t * dx;
  const projy = a.y + t * dy;
  return Math.hypot(p.x - projx, p.y - projy);
};

/**
 * Closest point on segment to P. Useful for snap.
 */
export const closestPointOnSegment = (p: Point2, a: Point2, b: Point2): Point2 => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return { x: a.x, y: a.y };
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return { x: a.x + t * dx, y: a.y + t * dy };
};

/**
 * Line-line intersection (infinite). Returns null if parallel.
 */
export const lineIntersection = (
  a1: Point2, a2: Point2,
  b1: Point2, b2: Point2
): Point2 | null => {
  const d = (a1.x - a2.x) * (b1.y - b2.y) - (a1.y - a2.y) * (b1.x - b2.x);
  if (d === 0) return null;
  const t = ((a1.x - b1.x) * (b1.y - b2.y) - (a1.y - b1.y) * (b1.x - b2.x)) / d;
  return { x: a1.x + t * (a2.x - a1.x), y: a1.y + t * (a2.y - a1.y) };
};

/**
 * Project P onto line A-B. Returns the projection point.
 */
export const projectOnLine = (p: Point2, a: Point2, b: Point2): Point2 => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return { x: a.x, y: a.y };
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  return { x: a.x + t * dx, y: a.y + t * dy };
};

// ── Screen Endpoint Calculation ──

import type { DrawingPoint } from '../core/types';
import type { ICoordinateConverter } from '../core/api';

export type LineKind =
  | 'segment'
  | 'ray'
  | 'infinite'
  | 'horizontal'
  | 'horizontal-ray'
  | 'vertical';

export interface LineEndpoints {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export const lineKindFromType = (type: string): LineKind => {
  switch (type) {
    case 'ray': return 'ray';
    case 'extended-line': return 'infinite';
    case 'horizontal-line': return 'horizontal';
    case 'horizontal-ray': return 'horizontal-ray';
    case 'vertical-line': return 'vertical';
    default: return 'segment';
  }
};

/**
 * Computes line endpoints in screen coordinates based on domain points,
 * line type, and coordinate converter.
 */
export const lineEndpointsScreen = (
  type: string,
  points: ReadonlyArray<DrawingPoint>,
  cc: ICoordinateConverter
): LineEndpoints | null => {
  if (points.length === 0) return null;
  const kind = lineKindFromType(type);
  const w = cc.width();
  const h = cc.height();

  if (kind === 'horizontal' || kind === 'horizontal-ray') {
    const y = cc.priceToY(points[0].price);
    if (y === null) return null;
    const startX = kind === 'horizontal-ray' ? cc.timeToX(points[0].time) : 0;
    if (startX === null) return null;
    return { x1: kind === 'horizontal' ? 0 : startX, y1: y, x2: w, y2: y };
  }

  if (kind === 'vertical') {
    const x = cc.timeToX(points[0].time);
    if (x === null) return null;
    return { x1: x, y1: 0, x2: x, y2: h };
  }

  if (points.length < 2) return null;
  const x1 = cc.timeToX(points[0].time);
  const y1 = cc.priceToY(points[0].price);
  const x2 = cc.timeToX(points[1].time);
  const y2 = cc.priceToY(points[1].price);
  if (x1 === null || y1 === null || x2 === null || y2 === null) return null;

  if (kind === 'segment') return { x1, y1, x2, y2 };

  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len === 0) return { x1, y1, x2, y2 };
  const ux = dx / len;
  const uy = dy / len;
  const span = Math.max(w, h) * 3;

  if (kind === 'ray') return { x1, y1, x2: x1 + ux * span, y2: y1 + uy * span };
  return { x1: x1 - ux * span, y1: y1 - uy * span, x2: x1 + ux * span, y2: y1 + uy * span };
};

/**
 * Computes line endpoints directly from two screen points and canvas bounds.
 */
export const lineEndpointsFromScreenPoints = (
  kind: LineKind,
  p1: Point2,
  p2: Point2,
  width: number,
  height: number
): LineEndpoints => {
  if (kind === 'horizontal') return { x1: 0, y1: p1.y, x2: width, y2: p1.y };
  if (kind === 'horizontal-ray') return { x1: p1.x, y1: p1.y, x2: width, y2: p1.y };
  if (kind === 'vertical') return { x1: p1.x, y1: 0, x2: p1.x, y2: height };
  if (kind === 'segment') return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
  const ux = dx / len;
  const uy = dy / len;
  const span = Math.max(width, height) * 3;

  if (kind === 'ray') return { x1: p1.x, y1: p1.y, x2: p1.x + ux * span, y2: p1.y + uy * span };
  return { x1: p1.x - ux * span, y1: p1.y - uy * span, x2: p1.x + ux * span, y2: p1.y + uy * span };
};

/**
 * Calculates exact intersection of a ray/line with the 4 rectangle boundaries (0, 0, width, height).
 */
export const clipLineToRect = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  height: number,
  kind: 'ray' | 'infinite'
): LineEndpoints => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return { x1, y1, x2, y2 };

  const tValues: number[] = [];

  // Check 4 boundary lines
  if (dx !== 0) {
    const tLeft = (0 - x1) / dx;
    const yLeft = y1 + tLeft * dy;
    if (yLeft >= 0 && yLeft <= height) tValues.push(tLeft);

    const tRight = (width - x1) / dx;
    const yRight = y1 + tRight * dy;
    if (yRight >= 0 && yRight <= height) tValues.push(tRight);
  }

  if (dy !== 0) {
    const tTop = (0 - y1) / dy;
    const xTop = x1 + tTop * dx;
    if (xTop >= 0 && xTop <= width) tValues.push(tTop);

    const tBottom = (height - y1) / dy;
    const xBottom = x1 + tBottom * dx;
    if (xBottom >= 0 && xBottom <= width) tValues.push(tBottom);
  }

  if (kind === 'ray') {
    const validT = tValues.filter((t) => t >= 0);
    const maxT = validT.length > 0 ? Math.max(...validT) : 0;
    return { x1, y1, x2: x1 + maxT * dx, y2: y1 + maxT * dy };
  } else {
    // Infinite extended line
    const minT = tValues.length > 0 ? Math.min(...tValues) : -10000;
    const maxT = tValues.length > 0 ? Math.max(...tValues) : 10000;
    return {
      x1: x1 + minT * dx,
      y1: y1 + minT * dy,
      x2: x1 + maxT * dx,
      y2: y1 + maxT * dy,
    };
  }
};
