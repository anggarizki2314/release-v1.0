/**
 * HitTestEngine — Priority-ordered hit testing.
 *
 * Priority: Anchor > Drawing > Floating Toolbar > Chart
 * Ensures proper event routing based on what's under the cursor.
 */

import type { HitResult, HitTestPriority, CoordinateSystem } from './types';
import type { DrawingObject } from '../engine/types';

const ANCHOR_THRESHOLD = 12;
const DRAWING_THRESHOLD = 5;

export class HitTestEngine {
  private selectedIds = new Set<string>();

  setSelectedIds(ids: string[]) { this.selectedIds = new Set(ids); }

  /**
   * Full hit test in priority order.
   * Returns the highest-priority hit result.
   */
  test(
    drawings: DrawingObject[],
    x: number,
    y: number,
    cs: CoordinateSystem,
    isMouseDown: boolean = false
  ): HitResult {
    // 1. Anchor hit (highest priority)
    const anchor = this.testAnchors(drawings, x, y, cs);
    if (anchor) return anchor;

    // 2. Drawing hit
    const drawing = this.testDrawings(drawings, x, y, cs, isMouseDown);
    if (drawing) return drawing;

    // 3. Chart (no drawing hit)
    return { priority: 'chart', point: { x, y } };
  }

  /**
   * Test if cursor is over an anchor point of a selected drawing.
   */
  testAnchors(
    drawings: DrawingObject[],
    x: number,
    y: number,
    cs: CoordinateSystem
  ): HitResult | null {
    for (const id of this.selectedIds) {
      const d = drawings.find((d) => d.id === id);
      if (!d || d.locked) continue;

      if (d.type === 'rectangle' && d.points.length >= 2) {
        const x1 = cs.timeToX(d.points[0].time);
        const y1 = cs.priceToY(d.points[0].price);
        const x2 = cs.timeToX(d.points[1].time);
        const y2 = cs.priceToY(d.points[1].price);

        const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
        const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
        const midX = (minX + maxX) / 2;
        const midY = (minY + maxY) / 2;

        const handles = [
          { x: minX, y: minY }, // 0: NW (Top-Left)
          { x: midX, y: minY }, // 1: N  (Top-Center)
          { x: maxX, y: minY }, // 2: NE (Top-Right)
          { x: maxX, y: midY }, // 3: E  (Middle-Right)
          { x: maxX, y: maxY }, // 4: SE (Bottom-Right)
          { x: midX, y: maxY }, // 5: S  (Bottom-Center)
          { x: minX, y: maxY }, // 6: SW (Bottom-Left)
          { x: minX, y: midY }, // 7: W  (Middle-Left)
        ];

        for (let i = 0; i < handles.length; i++) {
          if (Math.hypot(x - handles[i].x, y - handles[i].y) < ANCHOR_THRESHOLD) {
            return { priority: 'anchor', drawingId: d.id, anchorIndex: i, point: { x, y } };
          }
        }
        continue;
      }

      if (d.type === 'rotated-rectangle' && d.points.length >= 2) {
        const p1 = { x: cs.timeToX(d.points[0].time), y: cs.priceToY(d.points[0].price) };
        const p2 = { x: cs.timeToX(d.points[1].time), y: cs.priceToY(d.points[1].price) };
        const p3 = d.points.length >= 3
          ? { x: cs.timeToX(d.points[2].time), y: cs.priceToY(d.points[2].price) }
          : p2;
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        const nx = len > 0.0001 ? -dy / len : 0;
        const ny = len > 0.0001 ? dx / len : 1;
        const h = (p3.x - p1.x) * nx + (p3.y - p1.y) * ny;

        const handles = [
          p1,
          p2,
          { x: p2.x + nx * h, y: p2.y + ny * h },
          { x: p1.x + nx * h, y: p1.y + ny * h },
        ];

        for (let i = 0; i < handles.length; i++) {
          if (Math.hypot(x - handles[i].x, y - handles[i].y) < ANCHOR_THRESHOLD) {
            return { priority: 'anchor', drawingId: d.id, anchorIndex: i, point: { x, y } };
          }
        }
        continue;
      }

      // Position tools — dedicated semantic handle layout:
      // points[0]={time:left, price:entry}, points[1]={time:right, price:stop}, points[2]={time:right, price:target}
      if ((d.type === 'long-position' || d.type === 'short-position') && d.points.length >= 3) {
        const leftX  = cs.timeToX(d.points[0].time);
        const rightX = cs.timeToX(d.points[1].time);
        const entryY  = cs.priceToY(d.points[0].price);
        const stopY   = cs.priceToY(d.points[1].price);
        const targetY = cs.priceToY(d.points[2].price);

        const minX = Math.min(leftX, rightX), maxX = Math.max(leftX, rightX);
        const midX = (minX + maxX) / 2;

        const handles = [
          { x: midX, y: targetY }, // 0: Target center (TP)
          { x: midX, y: stopY },   // 1: Stop center (SL)
          { x: midX, y: entryY },  // 2: Entry center
          { x: minX, y: targetY }, // 3: Target left
          { x: maxX, y: targetY }, // 4: Target right
          { x: minX, y: stopY },   // 5: Stop left
          { x: maxX, y: stopY },   // 6: Stop right
          { x: minX, y: entryY },  // 7: Left center
          { x: maxX, y: entryY },  // 8: Right center
        ];

        for (let i = 0; i < handles.length; i++) {
          if (Math.hypot(x - handles[i].x, y - handles[i].y) < ANCHOR_THRESHOLD) {
            return { priority: 'anchor', drawingId: d.id, anchorIndex: i, point: { x, y } };
          }
        }
        continue;
      }

      for (let i = 0; i < d.points.length; i++) {
        const p = d.points[i];
        if (p.time === 0 && p.price === 0) continue;
        const ax = cs.timeToX(p.time);
        const ay = cs.priceToY(p.price);
        if (Math.hypot(x - ax, y - ay) < ANCHOR_THRESHOLD) {
          return { priority: 'anchor', drawingId: d.id, anchorIndex: i, point: { x, y } };
        }
      }
    }
    return null;
  }

  /**
   * Test if cursor is over any drawing's body.
   */
  testDrawings(
    drawings: DrawingObject[],
    x: number,
    y: number,
    cs: CoordinateSystem,
    isMouseDown: boolean = false
  ): HitResult | null {
    let closest: HitResult | null = null;
    let closestDist = Infinity;

    for (const d of drawings) {
      if (!d.visible || d.hidden || d.locked) continue;
      const dist = this.testDrawingBody(d, x, y, cs, isMouseDown);
      if (dist !== null && dist < closestDist) {
        closestDist = dist;
        closest = { priority: 'drawing', drawingId: d.id, point: { x, y } };
      }
    }

    if (closest !== null && closestDist < DRAWING_THRESHOLD) {
      return closest;
    }
    return null;
  }

  /**
   * Distance from point to a drawing's line segments.
   */
  private testDrawingBody(
    d: DrawingObject,
    x: number,
    y: number,
    cs: CoordinateSystem,
    isMouseDown: boolean = false
  ): number | null {
    if (d.points.length < 2) {
      // Single point (horizontal/vertical line) — test distance to that point
      if (d.points.length === 1) {
        const p = d.points[0];
        if (p.time === 0 && p.price === 0) return null;
        const px = cs.timeToX(p.time);
        const py = cs.priceToY(p.price);
        if (d.type === 'horizontal-line') {
          return Math.abs(y - py);
        }
        if (d.type === 'horizontal-ray') {
          if (x < px - 5) return null;
          return Math.abs(y - py);
        }
        if (d.type === 'vertical-line') {
          return Math.abs(x - px);
        }
        if (d.type === 'cross-line') {
          return Math.min(Math.abs(x - px), Math.abs(y - py));
        }
        return Math.hypot(x - px, y - py);
      }
      return null;
    }

    // Two-point lines: test distance to line segment
    const p1 = d.points[0], p2 = d.points[1];
    const x1 = cs.timeToX(p1.time), y1 = cs.priceToY(p1.price);
    const x2 = cs.timeToX(p2.time), y2 = cs.priceToY(p2.price);

    if (d.type === 'rectangle') {
      const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
      const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
      if (x >= minX && x <= maxX && y >= minY && y <= maxY) return 0; // inside fill
      const dTop = this.distToSegment(x, y, minX, minY, maxX, minY);
      const dRight = this.distToSegment(x, y, maxX, minY, maxX, maxY);
      const dBottom = this.distToSegment(x, y, minX, maxY, maxX, maxY);
      const dLeft = this.distToSegment(x, y, minX, minY, minX, maxY);
      return Math.min(dTop, dRight, dBottom, dLeft);
    }

    if (d.type === 'rotated-rectangle') {
      const pt1 = { x: x1, y: y1 };
      const pt2 = { x: x2, y: y2 };
      const pt3 = d.points.length >= 3 ? { x: cs.timeToX(d.points[2].time), y: cs.priceToY(d.points[2].price) } : pt2;
      const dx = pt2.x - pt1.x;
      const dy = pt2.y - pt1.y;
      const len = Math.hypot(dx, dy);
      const nx = len > 0.0001 ? -dy / len : 0;
      const ny = len > 0.0001 ? dx / len : 1;
      const h = (pt3.x - pt1.x) * nx + (pt3.y - pt1.y) * ny;

      const c1 = pt1;
      const c2 = pt2;
      const c3 = { x: pt2.x + nx * h, y: pt2.y + ny * h };
      const c4 = { x: pt1.x + nx * h, y: pt1.y + ny * h };

      if (this.isPointInPoly(x, y, [c1, c2, c3, c4])) return 0;
      const d1 = this.distToSegment(x, y, c1.x, c1.y, c2.x, c2.y);
      const d2 = this.distToSegment(x, y, c2.x, c2.y, c3.x, c3.y);
      const d3 = this.distToSegment(x, y, c3.x, c3.y, c4.x, c4.y);
      const d4 = this.distToSegment(x, y, c4.x, c4.y, c1.x, c1.y);
      return Math.min(d1, d2, d3, d4);
    }

    if (d.type === 'circle') {
      const r = Math.hypot(x2 - x1, y2 - y1);
      const distCenter = Math.hypot(x - x1, y - y1);
      if (distCenter <= r) return 0; // inside circle disc
      return Math.abs(distCenter - r); // distance to circumference
    }

    if (d.type === 'triangle' && d.points.length >= 3) {
      const p3 = d.points[2];
      const x3 = cs.timeToX(p3.time), y3 = cs.priceToY(p3.price);
      if (this.isPointInPoly(x, y, [{ x: x1, y: y1 }, { x: x2, y: y2 }, { x: x3, y: y3 }])) return 0;
      const d1 = this.distToSegment(x, y, x1, y1, x2, y2);
      const d2 = this.distToSegment(x, y, x2, y2, x3, y3);
      const d3 = this.distToSegment(x, y, x3, y3, x1, y1);
      return Math.min(d1, d2, d3);
    }

    if (d.type === 'polyline' || d.type === 'path' || d.type === 'brush' || d.type === 'highlighter') {
      let minDist = Infinity;
      const screenPts = d.points.map((p) => ({ x: cs.timeToX(p.time), y: cs.priceToY(p.price) }));
      if (d.type === 'polyline' && d.style.fillEnabled && this.isPointInPoly(x, y, screenPts)) {
        return 0;
      }
      for (let i = 0; i < screenPts.length - 1; i++) {
        const segDist = this.distToSegment(x, y, screenPts[i].x, screenPts[i].y, screenPts[i + 1].x, screenPts[i + 1].y);
        if (segDist < minDist) minDist = segDist;
      }
      return minDist;
    }

    if (d.type === 'curve' && d.points.length >= 3) {
      const p3 = d.points[2];
      const x3 = cs.timeToX(p3.time), y3 = cs.priceToY(p3.price);
      // Sample quadratic bezier
      let minDist = Infinity;
      let prevX = x1, prevY = y1;
      for (let step = 1; step <= 10; step++) {
        const t = step / 10;
        const curX = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * x2 + t * t * x3;
        const curY = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * y2 + t * t * y3;
        const dist = this.distToSegment(x, y, prevX, prevY, curX, curY);
        if (dist < minDist) minDist = dist;
        prevX = curX;
        prevY = curY;
      }
      return minDist;
    }

    if (d.type === 'double-curve') {
      if (d.points.length >= 4) {
        const cp1x = cs.timeToX(d.points[1].time), cp1y = cs.priceToY(d.points[1].price);
        const cp2x = cs.timeToX(d.points[2].time), cp2y = cs.priceToY(d.points[2].price);
        const xEnd = cs.timeToX(d.points[3].time), yEnd = cs.priceToY(d.points[3].price);
        let minDist = Infinity;
        let prevX = x1, prevY = y1;
        for (let step = 1; step <= 12; step++) {
          const t = step / 12;
          const u = 1 - t;
          const curX = u * u * u * x1 + 3 * u * u * t * cp1x + 3 * u * t * t * cp2x + t * t * t * xEnd;
          const curY = u * u * u * y1 + 3 * u * u * t * cp1y + 3 * u * t * t * cp2y + t * t * t * yEnd;
          const dist = this.distToSegment(x, y, prevX, prevY, curX, curY);
          if (dist < minDist) minDist = dist;
          prevX = curX;
          prevY = curY;
        }
        return minDist;
      }
      if (d.points.length === 3) {
        const x3 = cs.timeToX(d.points[2].time), y3 = cs.priceToY(d.points[2].price);
        let minDist = Infinity;
        let prevX = x1, prevY = y1;
        for (let step = 1; step <= 10; step++) {
          const t = step / 10;
          const curX = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * x2 + t * t * x3;
          const curY = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * y2 + t * t * y3;
          const dist = this.distToSegment(x, y, prevX, prevY, curX, curY);
          if (dist < minDist) minDist = dist;
          prevX = curX;
          prevY = curY;
        }
        return minDist;
      }
    }

    if (d.type === 'fib-retracement' || d.type === 'fibonacci') {
      const rawLevels = (d.style as any).fibLevels ?? d.style.levels ?? [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];
      const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
      const priceRange = p2.price - p1.price;
      let minDist = this.distToSegment(x, y, x1, y1, x2, y2);
      rawLevels.forEach((item: any) => {
        const lvl = typeof item === 'number' ? item : (item.level ?? 0);
        const yLvl = cs.priceToY(p1.price + priceRange * lvl);
        const dist = this.distToSegment(x, y, minX, yLvl, maxX, yLvl);
        if (dist < minDist) minDist = dist;
      });
      return minDist;
    }

    if (d.type === 'fib-extension') {
      const p3 = d.points.length >= 3 ? d.points[2] : p2;
      const x3 = cs.timeToX(p3.time), y3 = cs.priceToY(p3.price);
      let minDist = Math.min(this.distToSegment(x, y, x1, y1, x2, y2), this.distToSegment(x, y, x2, y2, x3, y3));
      const priceDelta = p2.price - p1.price;
      const startX = Math.min(x1, x3);
      const endX = Math.max(x1, x2, x3) + Math.max(Math.abs(x2 - x1), 150);
      const rawLevels = (d.style as any).fibLevels ?? d.style.levels ?? [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0, 1.272, 1.618, 2.0, 2.618, 4.236];
      rawLevels.forEach((item: any) => {
        const lvl = typeof item === 'number' ? item : (item.level ?? 0);
        const yLvl = cs.priceToY(p3.price + priceDelta * lvl);
        const dist = this.distToSegment(x, y, startX, yLvl, endX, yLvl);
        if (dist < minDist) minDist = dist;
      });
      return minDist;
    }

    if (d.type === 'fib-channel') {
      const p3 = d.points.length >= 3 ? d.points[2] : null;
      const dt = p2.time - p1.time;
      const dp = p2.price - p1.price;
      const time3 = p3 ? p3.time : p1.time + dt * 0.5;
      const price3 = p3 ? p3.price : p1.price + dp * 0.5 + (dp !== 0 ? Math.abs(dp) * 0.3 : 10);
      const basePriceAtT3 = dt !== 0 ? p1.price + dp * ((time3 - p1.time) / dt) : p1.price;
      const offsetDeltaPrice = price3 - basePriceAtT3;

      const rawLevels = (d.style as any).fibLevels ?? d.style.levels ?? [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0, 1.618, 2.618, 4.236];
      let minDist = p3 ? this.distToSegment(x, y, x1, y1, cs.timeToX(p3.time), cs.priceToY(p3.price)) : Infinity;
      rawLevels.forEach((item: any) => {
        const lvl = typeof item === 'number' ? item : (item.level ?? 0);
        const startP = p1.price + offsetDeltaPrice * lvl;
        const endP = p2.price + offsetDeltaPrice * lvl;
        const sx1 = cs.timeToX(p1.time), sy1 = cs.priceToY(startP);
        const sx2 = cs.timeToX(p2.time), sy2 = cs.priceToY(endP);
        const dist = this.distToSegment(x, y, sx1, sy1, sx2, sy2);
        if (dist < minDist) minDist = dist;
      });
      return minDist;
    }

    if (d.type === 'fib-time-zone' || d.type === 'fib-timezone') {
      const step = (p2.time - p1.time) || 86400;
      let minDist = this.distToSegment(x, y, x1, y1, x2, y2);
      const rawLevels = (d.style as any).fibLevels ?? d.style.levels ?? [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144];
      rawLevels.forEach((item: any) => {
        const lvl = typeof item === 'number' ? item : (item.level ?? 0);
        const lx = cs.timeToX(p1.time + step * lvl);
        const dist = Math.abs(x - lx);
        if (dist < minDist) minDist = dist;
      });
      return minDist;
    }

    if (d.type === 'fib-fan') {
      const deltaPrice = p2.price - p1.price;
      const tx = cs.timeToX(p2.time);
      let minDist = this.distToSegment(x, y, x1, y1, x2, y2);
      const rawLevels = (d.style as any).fibLevels ?? d.style.levels ?? [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0, 1.618, 2.618, 4.236];
      rawLevels.forEach((item: any) => {
        const lvl = typeof item === 'number' ? item : (item.level ?? 0);
        const targetP = p1.price + deltaPrice * lvl;
        const ty = cs.priceToY(targetP);
        const dist = this.distToRay(x, y, x1, y1, tx, ty);
        if (dist < minDist) minDist = dist;
      });
      return minDist;
    }

    if (d.type === 'gann-box') {
      const tMin = Math.min(p1.time, p2.time);
      const tMax = Math.max(p1.time, p2.time);
      const pMin = Math.min(p1.price, p2.price);
      const pMax = Math.max(p1.price, p2.price);

      const minX = cs.timeToX(tMin), maxX = cs.timeToX(tMax);
      const yTop = cs.priceToY(pMax), yBottom = cs.priceToY(pMin);
      const minY = Math.min(yTop, yBottom), maxY = Math.max(yTop, yBottom);

      let minDist = Math.min(
        this.distToSegment(x, y, minX, minY, maxX, minY),
        this.distToSegment(x, y, maxX, minY, maxX, maxY),
        this.distToSegment(x, y, minX, maxY, maxX, maxY),
        this.distToSegment(x, y, minX, minY, minX, maxY),
        this.distToSegment(x, y, minX, minY, maxX, maxY),
        this.distToSegment(x, y, minX, maxY, maxX, minY)
      );

      // Midpoints check
      const midX = (minX + maxX) / 2;
      const midY = (minY + maxY) / 2;
      minDist = Math.min(
        minDist,
        this.distToSegment(x, y, minX, midY, maxX, midY),
        this.distToSegment(x, y, midX, minY, midX, maxY)
      );
      return minDist;
    }

    if (d.type === 'gann-fan') {
      const deltaPrice = p2.price - p1.price;
      const txBase = cs.timeToX(p2.time);
      const angles = [1 / 8, 1 / 4, 1 / 3, 1 / 2, 1, 2, 3, 4, 8];
      let minDist = Infinity;
      angles.forEach((r) => {
        const targetP = p1.price + deltaPrice * r;
        const ty = cs.priceToY(targetP);
        const dist = this.distToRay(x, y, x1, y1, txBase, ty);
        if (dist < minDist) minDist = dist;
      });
      return minDist;
    }

    if (d.type === 'long-position' || d.type === 'short-position') {
      if (d.points.length < 3) return null;
      const leftX  = cs.timeToX(d.points[0].time);
      const rightX = cs.timeToX(d.points[1].time);
      const entryY  = cs.priceToY(d.points[0].price);
      const stopY   = cs.priceToY(d.points[1].price);
      const targetY = cs.priceToY(d.points[2].price);
      const minX = Math.min(leftX, rightX), maxX = Math.max(leftX, rightX);
      const minY = Math.min(entryY, stopY, targetY);
      const maxY = Math.max(entryY, stopY, targetY);

      // Body box click is allowed ONLY during MouseDown
      if (isMouseDown && x >= minX && x <= maxX && y >= minY && y <= maxY) {
        return 0;
      }

      // During hover movement, test distance to 5 outer/inner boundary lines (max 6px tolerance)
      const dEntry  = this.distToSegment(x, y, minX, entryY, maxX, entryY);
      const dStop   = this.distToSegment(x, y, minX, stopY, maxX, stopY);
      const dTarget = this.distToSegment(x, y, minX, targetY, maxX, targetY);
      const dLeft   = this.distToSegment(x, y, minX, minY, minX, maxY);
      const dRight  = this.distToSegment(x, y, maxX, minY, maxX, maxY);

      const minDist = Math.min(dEntry, dStop, dTarget, dLeft, dRight);
      return minDist <= 6 ? minDist : null;
    }

    if (d.type === 'ray') {
      return this.distToRay(x, y, x1, y1, x2, y2);
    }

    if (d.type === 'extended-line') {
      return this.distToInfiniteLine(x, y, x1, y1, x2, y2);
    }

    return this.distToSegment(x, y, x1, y1, x2, y2);
  }

  private distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  private distToInfiniteLine(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);
    const t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Math.hypot(px - projX, py - projY);
  }

  private distToRay(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);
    const dot = (px - x1) * dx + (py - y1) * dy;
    if (dot < 0) return Math.hypot(px - x1, py - y1);
    const t = dot / lenSq;
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Math.hypot(px - projX, py - projY);
  }

  private isPointInPoly(px: number, py: number, polygon: Array<{ x: number; y: number }>): boolean {
    if (polygon.length < 3) return false;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      const intersect = ((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }
}