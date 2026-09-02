/**
 * interaction/HitTestEngine.ts
 *
 * Subsystem (AD-06). NOT inside Renderer. Uses per-type IDrawingHitTester
 * from the DrawingRegistry. No geometry math here — delegates to per-type.
 */

import type { BaseDrawingData } from '../core/types';
import type { ICoordinateConverter } from '../core/api';
import type { DrawingRegistry } from '../drawing/DrawingRegistry';
import type { HitResult } from '../drawing/IDrawingHitTester';

export interface HitCandidate {
  readonly id: string;
  readonly result: HitResult;
}

export class HitTestEngine {
  constructor(private readonly registry: DrawingRegistry) {}

  /**
   * Test a (screenX, screenY) against all drawings.
   * Returns the highest-priority hit. Anchor > body.
   * Returns null if no hit.
   */
  test(
    drawings: ReadonlyArray<BaseDrawingData>,
    x: number,
    y: number,
    cc: ICoordinateConverter,
    threshold = 6
  ): HitCandidate | null {
    let best: HitCandidate | null = null;
    for (const d of drawings) {
      if (!d.visible || d.locked) continue;
      const bundle = this.registry.get(d.type);
      if (!bundle) continue;
      const hit = bundle.hitTester.hitTest(d, x, y, cc, threshold);
      if (!hit) continue;
      if (best && best.result.priority === 'anchor' && hit.priority === 'body') continue;
      best = { id: d.id, result: hit };
      if (hit.priority === 'anchor') break; // anchors win
    }
    return best;
  }

  /**
   * Box selection (axis-aligned in screen space). Returns ids whose
   * any control point falls inside the box.
   */
  boxSelect(
    drawings: ReadonlyArray<BaseDrawingData>,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    cc: ICoordinateConverter
  ): ReadonlyArray<string> {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    const result: string[] = [];
    for (const d of drawings) {
      if (!d.visible || d.locked) continue;
      const bundle = this.registry.get(d.type);
      if (!bundle) continue;
      const anchors = bundle.hitTester.getAnchors(d);
      for (const a of anchors) {
        const sx = cc.timeToX(a.time);
        const sy = cc.priceToY(a.price);
        if (sx === null || sy === null) continue;
        if (sx >= minX && sx <= maxX && sy >= minY && sy <= maxY) {
          result.push(d.id);
          break;
        }
      }
    }
    return result;
  }
}
