/**
 * geometry/point.ts
 *
 * Pure 2D point math. NO drawing imports, NO canvas access.
 */

export interface Point2 {
  readonly x: number;
  readonly y: number;
}

export const point = (x: number, y: number): Point2 => ({ x, y });

export const dist = (a: Point2, b: Point2): number => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
};

export const add = (a: Point2, b: Point2): Point2 => ({ x: a.x + b.x, y: a.y + b.y });

export const sub = (a: Point2, b: Point2): Point2 => ({ x: a.x - b.x, y: a.y - b.y });

export const scale = (p: Point2, k: number): Point2 => ({ x: p.x * k, y: p.y * k });
