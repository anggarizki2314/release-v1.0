/**
 * interaction/DragController.ts
 *
 * Pure: tracks drag origin points + offsets. Maps pixel deltas to domain
 * coordinate deltas via the ICoordinateConverter. Engine translates those
 * deltas into a TransformCommand.
 *
 * No drawing mutation, no DOM, no React.
 */

import type { ICoordinateConverter } from '../core/api';
import type { DomainBounds } from '../geometry/bounds';

export interface DragOrigin {
  readonly drawingId: string;
  readonly points: ReadonlyArray<{ readonly time: number; readonly price: number }>;
  readonly bounds: DomainBounds | null;
}

export class DragController {
  private origin: DragOrigin | null = null;
  private startX = 0;
  private startY = 0;

  isActive(): boolean { return this.origin !== null; }

  begin(origin: DragOrigin, screenX: number, screenY: number): void {
    this.origin = origin;
    this.startX = screenX;
    this.startY = screenY;
  }

  /**
   * Domain delta calculation with finite coordinate guards.
   * Returns null if no active drag or if coordinates cannot be resolved.
   */
  delta(cc: ICoordinateConverter, currentX: number, currentY: number): { dTime: number; dPrice: number } | null {
    if (!this.origin) return null;

    const startTime = cc.xToTime(this.startX);
    const startPrice = cc.yToPrice(this.startY);
    const curTime = cc.xToTime(currentX);
    const curPrice = cc.yToPrice(currentY);

    if (startTime === null || startPrice === null || curTime === null || curPrice === null) return null;
    if (!Number.isFinite(startTime) || !Number.isFinite(startPrice) || !Number.isFinite(curTime) || !Number.isFinite(curPrice)) return null;

    const dTime = curTime - startTime;
    const dPrice = curPrice - startPrice;

    if (!Number.isFinite(dTime) || !Number.isFinite(dPrice)) return null;

    return { dTime, dPrice };
  }

  end(): void {
    this.origin = null;
  }
}
