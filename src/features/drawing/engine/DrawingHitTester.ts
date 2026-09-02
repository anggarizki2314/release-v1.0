/**
 * Drawing Engine — DrawingHitTester
 *
 * Performs hit testing against all drawing objects.
 * Returns the closest hit for pointer interaction.
 */

import type { DrawingObject, HitTestResult, DrawingPoint } from './types';
import { distancePointToSegment } from './DrawingObject';

const HIT_THRESHOLD = 6; // pixels from cursor point

export class DrawingHitTester {
  private threshold = HIT_THRESHOLD;

  setThreshold(t: number) { this.threshold = t; }

  test(drawings: DrawingObject[], px: number, py: number, timeToX: (t: number) => number, priceToY: (p: number) => number): HitTestResult | null {
    let closest: HitTestResult | null = null;

    for (const d of drawings) {
      if (!d.visible || d.hidden) continue;
      const result = this.testDrawing(d, px, py, timeToX, priceToY);
      if (result && (!closest || result.distance < closest.distance)) {
        closest = result;
      }
    }

    return closest;
  }

  testBox(drawings: DrawingObject[], px: number, py: number, timeToX: (t: number) => number, priceToY: (p: number) => number): DrawingObject[] {
    return drawings.filter((d) => {
      if (!d.visible || d.hidden) return false;
      const result = this.testDrawing(d, px, py, timeToX, priceToY);
      return result !== null;
    });
  }

  private testDrawing(d: DrawingObject, px: number, py: number, timeToX: (t: number) => number, priceToY: (p: number) => number): HitTestResult | null {
    const screenPoints = d.points.map((p) => ({ x: timeToX(p.time), y: priceToY(p.price) }));

    // Test each point for point-handles
    for (let i = 0; i < screenPoints.length; i++) {
      const sp = screenPoints[i];
      const dist = Math.hypot(px - sp.x, py - sp.y);
      if (dist < this.threshold) {
        return { drawing: d, distance: dist, hitZone: `point-${i}` as any };
      }
    }

    // Test body (infinite lines, rays, horizontal, vertical, segments)
    if (d.type === 'horizontal-line' && screenPoints.length >= 1) {
      const dist = Math.abs(py - screenPoints[0].y);
      if (dist < this.threshold) return { drawing: d, distance: dist, hitZone: 'body' };
    } else if (d.type === 'horizontal-ray' && screenPoints.length >= 1) {
      if (px >= screenPoints[0].x - this.threshold) {
        const dist = Math.abs(py - screenPoints[0].y);
        if (dist < this.threshold) return { drawing: d, distance: dist, hitZone: 'body' };
      }
    } else if (d.type === 'vertical-line' && screenPoints.length >= 1) {
      const dist = Math.abs(px - screenPoints[0].x);
      if (dist < this.threshold) return { drawing: d, distance: dist, hitZone: 'body' };
    } else if (d.type === 'cross-line' && screenPoints.length >= 1) {
      const distY = Math.abs(py - screenPoints[0].y);
      const distX = Math.abs(px - screenPoints[0].x);
      const minDist = Math.min(distX, distY);
      if (minDist < this.threshold) return { drawing: d, distance: minDist, hitZone: 'body' };
    } else if (d.type === 'ray' && screenPoints.length >= 2) {
      const a = screenPoints[0], b = screenPoints[1];
      const dx = b.x - a.x, dy = b.y - a.y;
      const dot = (px - a.x) * dx + (py - a.y) * dy;
      if (dot >= 0) {
        const len2 = dx * dx + dy * dy;
        const num = Math.abs(dy * px - dx * py + b.x * a.y - b.y * a.x);
        const dist = len2 > 0 ? num / Math.sqrt(len2) : Math.hypot(px - a.x, py - a.y);
        if (dist < this.threshold) return { drawing: d, distance: dist, hitZone: 'body' };
      }
    } else if (d.type === 'extended-line' && screenPoints.length >= 2) {
      const a = screenPoints[0], b = screenPoints[1];
      const dx = b.x - a.x, dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      const num = Math.abs(dy * px - dx * py + b.x * a.y - b.y * a.x);
      const dist = len2 > 0 ? num / Math.sqrt(len2) : Math.hypot(px - a.x, py - a.y);
      if (dist < this.threshold) return { drawing: d, distance: dist, hitZone: 'body' };
    } else if ((d.type === 'arrow-up' || d.type === 'arrow-down') && screenPoints.length >= 1) {
      const sp = screenPoints[0];
      const dist = Math.hypot(px - sp.x, py - sp.y);
      if (dist < this.threshold * 2) return { drawing: d, distance: dist, hitZone: 'body' };
    } else {
      for (let i = 0; i < screenPoints.length - 1; i++) {
        const a = screenPoints[i], b = screenPoints[i + 1];
        const dist = distancePointToSegment(px, py, a.x, a.y, b.x, b.y);
        if (dist < this.threshold) {
          return { drawing: d, distance: dist, hitZone: 'body' };
        }
      }
    }

    // Close polygon
    if (screenPoints.length > 2) {
      const a = screenPoints[screenPoints.length - 1], b = screenPoints[0];
      const dist = distancePointToSegment(px, py, a.x, a.y, b.x, b.y);
      if (dist < this.threshold) {
        return { drawing: d, distance: dist, hitZone: 'edge' };
      }
    }

    return null;
  }
}
