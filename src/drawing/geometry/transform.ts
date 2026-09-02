/**
 * geometry/transform.ts
 *
 * Pure transformation functions on domain points.
 * Zero side-effects, zero dependencies on UI/DOM/Canvas.
 * Guards against NaN/non-finite coordinates.
 */

import type { DrawingPoint, TransformOp } from '../core/types';
import { pointsBounds } from './bounds';

export interface TransformDelta {
  readonly dTime: number;
  readonly dPrice: number;
}

/**
 * Translate a single domain point by (dTime, dPrice) with finite number guards.
 */
export function translatePoint<T extends DrawingPoint>(point: T, delta: TransformDelta): T {
  if (!Number.isFinite(delta.dTime) || !Number.isFinite(delta.dPrice)) return point;
  const nextTime = point.time + delta.dTime;
  const nextPrice = point.price + delta.dPrice;
  if (!Number.isFinite(nextTime) || !Number.isFinite(nextPrice)) return point;
  return {
    ...point,
    time: nextTime,
    price: nextPrice,
  };
}

/**
 * Translate an array of domain points by (dTime, dPrice).
 */
export function translatePoints<T extends DrawingPoint>(
  points: ReadonlyArray<T>,
  delta: TransformDelta
): T[] {
  if (!Number.isFinite(delta.dTime) || !Number.isFinite(delta.dPrice)) return [...points];
  return points.map((p) => translatePoint(p, delta));
}

/**
 * Immutably update a single point at index, guarding against non-finite values.
 */
export function updatePointAtIndex<T extends DrawingPoint>(
  points: ReadonlyArray<T>,
  index: number,
  newPoint: T
): T[] {
  if (index < 0 || index >= points.length) return [...points];
  if (!newPoint || !Number.isFinite(newPoint.time) || !Number.isFinite(newPoint.price)) {
    return [...points];
  }
  return points.map((p, i) =>
    i === index ? { ...p, time: newPoint.time, price: newPoint.price } : p
  );
}

/**
 * Apply a transform operation or move delta to an array of domain points.
 * Returns new array of transformed points, or null if operation is invalid/no-op.
 */
export function applyTransformPure<T extends DrawingPoint>(
  points: ReadonlyArray<T>,
  opOrDelta: TransformOp | TransformDelta
): T[] | null {
  if (points.length === 0) return null;

  // Simple delta object without 'kind'
  if (!('kind' in opOrDelta)) {
    return translatePoints(points, opOrDelta);
  }

  const op = opOrDelta;
  switch (op.kind) {
    case 'move':
      return translatePoints(points, { dTime: op.dTime, dPrice: op.dPrice });

    case 'resize': {
      if (op.anchorIndex < 0 || op.anchorIndex >= points.length) return null;
      return updatePointAtIndex(points, op.anchorIndex, op.target as T);
    }

    case 'rotate': {
      const { pivot, angleRad } = op;
      if (!Number.isFinite(angleRad)) return null;
      const cos = Math.cos(angleRad);
      const sin = Math.sin(angleRad);
      return points.map((p) => {
        const dt = p.time - pivot.time;
        const dp = p.price - pivot.price;
        const nextTime = pivot.time + dt * cos - dp * sin;
        const nextPrice = pivot.price + dt * sin + dp * cos;
        if (!Number.isFinite(nextTime) || !Number.isFinite(nextPrice)) return p;
        return { ...p, time: nextTime, price: nextPrice };
      });
    }

    case 'scale': {
      const { pivot, factor } = op;
      if (!Number.isFinite(factor)) return null;
      return points.map((p) => {
        const nextTime = pivot.time + (p.time - pivot.time) * factor;
        const nextPrice = pivot.price + (p.price - pivot.price) * factor;
        if (!Number.isFinite(nextTime) || !Number.isFinite(nextPrice)) return p;
        return { ...p, time: nextTime, price: nextPrice };
      });
    }

    case 'mirror': {
      const bounds = pointsBounds(points);
      if (!bounds) return null;
      if (op.axis === 'horizontal') {
        const mid = (bounds.fromTime + bounds.toTime) / 2;
        return points.map((p) => ({ ...p, time: mid * 2 - p.time }));
      } else {
        const mid = (bounds.fromPrice + bounds.toPrice) / 2;
        return points.map((p) => ({ ...p, price: mid * 2 - p.price }));
      }
    }

    case 'flip': {
      const bounds = pointsBounds(points);
      if (!bounds) return null;
      const midT = (bounds.fromTime + bounds.toTime) / 2;
      const midP = (bounds.fromPrice + bounds.toPrice) / 2;
      return points.map((p) => ({
        ...p,
        time: midT * 2 - p.time,
        price: midP * 2 - p.price,
      }));
    }

    default:
      return null;
  }
}
