/**
 * geometry/bounds.ts
 *
 * Bounding box helpers in domain (time, price) coordinates.
 */

import type { DrawingPoint } from '../core/types';

export interface DomainBounds {
  readonly fromTime: number;
  readonly toTime: number;
  readonly fromPrice: number;
  readonly toPrice: number;
}

export const emptyBounds = (): DomainBounds => ({
  fromTime: Infinity, toTime: -Infinity, fromPrice: Infinity, toPrice: -Infinity,
});

export const isEmptyBounds = (b: DomainBounds): boolean =>
  !(b.fromTime <= b.toTime && b.fromPrice <= b.toPrice);

export const expandBounds = (b: DomainBounds, p: DrawingPoint): DomainBounds => ({
  fromTime: Math.min(b.fromTime, p.time),
  toTime: Math.max(b.toTime, p.time),
  fromPrice: Math.min(b.fromPrice, p.price),
  toPrice: Math.max(b.toPrice, p.price),
});

export const pointsBounds = (points: ReadonlyArray<DrawingPoint>): DomainBounds | null => {
  if (points.length === 0) return null;
  let b = emptyBounds();
  for (const p of points) b = expandBounds(b, p);
  return b;
};
