/**
 * geometry/fib.ts
 *
 * Fibonacci level math. Level values are derived from (start, end) domain points
 * and a list of ratios (stored in style.meta).
 *
 * The engine never stores level points directly — they are computed on demand.
 */

import type { DrawingPoint } from '../core/types';

export interface FibLevel {
  readonly ratio: number;
  readonly price: number;
  readonly time: number;
}

export const defaultFibRatios: ReadonlyArray<number> = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

export const computeFibLevels = (
  start: DrawingPoint,
  end: DrawingPoint,
  ratios: ReadonlyArray<number> = defaultFibRatios
): ReadonlyArray<FibLevel> => {
  const priceDelta = end.price - start.price;
  const timeDelta = end.time - start.time;
  return ratios.map((ratio) => ({
    ratio,
    price: start.price + priceDelta * ratio,
    time: start.time + timeDelta * ratio,
  }));
};
