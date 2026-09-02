/**
 * DragController — Pure Screen-Space interaction during move/resize,
 * and Commit-Time Domain Conversion on MouseUp.
 */

import type { CoordinateSystem } from './types';
import type { DrawingObject, DrawingPoint } from '../engine/types';

export interface DragContext {
  drawingId: string;
  drawingType?: string;
  anchorIndex: number; // -1 for move, 0+ for resize (0..3 for rectangle)
  startMouseX: number;
  startMouseY: number;
  origScreenPoints: Array<{ x: number; y: number }>;
  currentScreenPoints: Array<{ x: number; y: number }>;
}

export interface DragCallbacks {
  getDrawing: (id: string) => DrawingObject | undefined;
  updateDrawing: (id: string, points: DrawingPoint[]) => void;
  getSnapManager?: () => import('../engine/DrawingSnapManager').DrawingSnapManager | undefined;
}

export class DragController {
  private context: DragContext | null = null;
  private callbacks: DragCallbacks;

  constructor(callbacks: DragCallbacks) {
    this.callbacks = callbacks;
  }

  get isActive(): boolean { return this.context !== null; }

  startMove(drawingId: string, mouseX: number, mouseY: number, origPoints: DrawingPoint[], cs: CoordinateSystem, drawingType?: string): void {
    const origScreenPoints = origPoints.map((p) => ({
      x: cs.timeToX(p.time),
      y: cs.priceToY(p.price),
    }));
    this.context = {
      drawingId,
      drawingType,
      anchorIndex: -1,
      startMouseX: mouseX,
      startMouseY: mouseY,
      origScreenPoints,
      currentScreenPoints: origScreenPoints.map((p) => ({ ...p })),
    };
  }

  startResize(drawingId: string, anchorIndex: number, mouseX: number, mouseY: number, origPoints: DrawingPoint[], cs: CoordinateSystem, drawingType?: string): void {
    const origScreenPoints = origPoints.map((p) => ({
      x: cs.timeToX(p.time),
      y: cs.priceToY(p.price),
    }));
    this.context = {
      drawingId,
      drawingType,
      anchorIndex,
      startMouseX: mouseX,
      startMouseY: mouseY,
      origScreenPoints,
      currentScreenPoints: origScreenPoints.map((p) => ({ ...p })),
    };
  }

  /**
   * PURE SCREEN-SPACE UPDATE (MouseMove) with optional magnet snapping for anchor resizing.
   */
  update(mouseX: number, mouseY: number, shiftKey: boolean = false, cs?: CoordinateSystem): boolean {
    if (!this.context) return false;

    const dx = mouseX - this.context.startMouseX;
    const dy = mouseY - this.context.startMouseY;

    if (this.context.anchorIndex === -1) {
      // Move entire drawing in screen space
      this.context.currentScreenPoints = this.context.origScreenPoints.map((p) => ({
        x: p.x + dx,
        y: p.y + dy,
      }));
    } else if (this.context.drawingType === 'rectangle' && this.context.origScreenPoints.length >= 2) {
      // 8-Handle Rectangle Resize with FIXED PIVOT
      const sp1 = this.context.origScreenPoints[0];
      const sp2 = this.context.origScreenPoints[1];
      const origMinX = Math.min(sp1.x, sp2.x);
      const origMaxX = Math.max(sp1.x, sp2.x);
      const origMinY = Math.min(sp1.y, sp2.y);
      const origMaxY = Math.max(sp1.y, sp2.y);

      let newMinX = origMinX;
      let newMaxX = origMaxX;
      let newMinY = origMinY;
      let newMaxY = origMaxY;

      let targetX = mouseX;
      let targetY = mouseY;
      const snapMgr = this.callbacks.getSnapManager?.();
      if (cs && snapMgr?.isEnabled()) {
        const rawT = cs.xToTime(targetX);
        const rawP = cs.yToPrice(targetY);
        const snapRes = snapMgr.snap(rawT, rawP, cs.xToTime, cs.yToPrice, cs.timeToX, cs.priceToY);
        if (snapRes.snapped) {
          targetX = cs.timeToX(snapRes.time);
          targetY = cs.priceToY(snapRes.price);
        }
      }

      switch (this.context.anchorIndex) {
        case 0: // NW (Top-Left) — Fixed Pivot: SE (origMaxX, origMaxY)
          newMinX = targetX;
          newMinY = targetY;
          break;
        case 1: // N (Top-Center) — Fixed Pivot: Bottom border origMaxY
          newMinY = targetY;
          break;
        case 2: // NE (Top-Right) — Fixed Pivot: SW (origMinX, origMaxY)
          newMaxX = targetX;
          newMinY = targetY;
          break;
        case 3: // E (Right-Center) — Fixed Pivot: Left border origMinX
          newMaxX = targetX;
          break;
        case 4: // SE (Bottom-Right) — Fixed Pivot: NW (origMinX, origMinY)
          newMaxX = targetX;
          newMaxY = targetY;
          break;
        case 5: // S (Bottom-Center) — Fixed Pivot: Top border origMinY
          newMaxY = targetY;
          break;
        case 6: // SW (Bottom-Left) — Fixed Pivot: NE (origMaxX, origMinY)
          newMinX = targetX;
          newMaxY = targetY;
          break;
        case 7: // W (Left-Center) — Fixed Pivot: Right border origMaxX
          newMinX = targetX;
          break;
      }

      const leftX = Math.min(newMinX, newMaxX);
      const rightX = Math.max(newMinX, newMaxX);
      const topY = Math.min(newMinY, newMaxY);
      const bottomY = Math.max(newMinY, newMaxY);

      this.context.currentScreenPoints = [
        { x: leftX, y: topY },
        { x: rightX, y: bottomY },
      ];
    } else if (this.context.drawingType === 'triangle' && this.context.origScreenPoints.length >= 3) {
      // 3-Point Triangle Resize
      const idx = this.context.anchorIndex;
      let targetX = mouseX;
      let targetY = mouseY;
      const snapMgr = this.callbacks.getSnapManager?.();
      if (cs && snapMgr?.isEnabled()) {
        const rawT = cs.xToTime(targetX);
        const rawP = cs.yToPrice(targetY);
        const snapRes = snapMgr.snap(rawT, rawP, cs.xToTime, cs.yToPrice, cs.timeToX, cs.priceToY);
        if (snapRes.snapped) {
          targetX = cs.timeToX(snapRes.time);
          targetY = cs.priceToY(snapRes.price);
        }
      }
      this.context.currentScreenPoints = this.context.origScreenPoints.map((p, i) => {
        if (i !== idx) return p;
        return { x: targetX, y: targetY };
      });
    } else if (this.context.drawingType === 'channel' && this.context.origScreenPoints.length >= 3) {
      // Channel 3-Point Resize
      const idx = this.context.anchorIndex;
      let targetX = mouseX;
      let targetY = mouseY;
      const snapMgr = this.callbacks.getSnapManager?.();
      if (cs && snapMgr?.isEnabled()) {
        const rawT = cs.xToTime(targetX);
        const rawP = cs.yToPrice(targetY);
        const snapRes = snapMgr.snap(rawT, rawP, cs.xToTime, cs.yToPrice, cs.timeToX, cs.priceToY);
        if (snapRes.snapped) {
          targetX = cs.timeToX(snapRes.time);
          targetY = cs.priceToY(snapRes.price);
        }
      }
      this.context.currentScreenPoints = this.context.origScreenPoints.map((p, i) => {
        if (i !== idx) return p;
        return { x: targetX, y: targetY };
      });
    } else if ((this.context.drawingType === 'long-position' || this.context.drawingType === 'short-position') && this.context.origScreenPoints.length >= 3) {
      // 3-Point Position Resize
      const idx = this.context.anchorIndex;
      const origP0 = this.context.origScreenPoints[0];
      const origP1 = this.context.origScreenPoints[1];
      const origP2 = this.context.origScreenPoints[2];

      let targetX = mouseX;
      let targetY = mouseY;
      const snapMgr = this.callbacks.getSnapManager?.();
      if (cs && snapMgr?.isEnabled()) {
        const rawT = cs.xToTime(targetX);
        const rawP = cs.yToPrice(targetY);
        const snapRes = snapMgr.snap(rawT, rawP, cs.xToTime, cs.yToPrice, cs.timeToX, cs.priceToY);
        if (snapRes.snapped) {
          targetX = cs.timeToX(snapRes.time);
          targetY = cs.priceToY(snapRes.price);
        }
      }

      const p0 = { ...origP0 };
      const p1 = { ...origP1 };
      const p2 = { ...origP2 };

      switch (idx) {
        case 0: // Target center (TP only)
          p2.y = targetY;
          break;
        case 1: // Stop center (SL only)
          p1.y = targetY;
          break;
        case 2: // Entry center (Entry only)
          p0.y = targetY;
          break;
        case 3: // Target left (TP + Left time)
          p2.y = targetY;
          p0.x = targetX;
          break;
        case 4: // Target right (TP + Right time)
          p2.y = targetY;
          p1.x = targetX;
          p2.x = targetX;
          break;
        case 5: // Stop left (SL + Left time)
          p1.y = targetY;
          p0.x = targetX;
          break;
        case 6: // Stop right (SL + Right time)
          p1.y = targetY;
          p1.x = targetX;
          p2.x = targetX;
          break;
        case 7: // Left center (Left time only)
          p0.x = targetX;
          break;
        case 8: // Right center (Right time only)
          p1.x = targetX;
          p2.x = targetX;
          break;
      }

      this.context.currentScreenPoints = [p0, p1, p2];
    } else {
      // Line/Standard Resize — move ONLY the target anchor in screen space
      const idx = this.context.anchorIndex;
      const otherIdx = idx === 0 ? 1 : 0;
      const fixedP = this.context.origScreenPoints[otherIdx];

      let targetX = mouseX;
      let targetY = mouseY;

      if (shiftKey && fixedP) {
        const dx = mouseX - fixedP.x;
        const dy = mouseY - fixedP.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 2) {
          const angle = Math.atan2(dy, dx);
          const snapAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
          if (Math.abs(Math.sin(snapAngle)) < 1e-6) {
            targetY = fixedP.y;
          } else if (Math.abs(Math.cos(snapAngle)) < 1e-6) {
            targetX = fixedP.x;
          } else {
            targetX = fixedP.x + dist * Math.cos(snapAngle);
            targetY = fixedP.y + dist * Math.sin(snapAngle);
          }
        }
      }

      const snapMgr = this.callbacks.getSnapManager?.();
      if (cs && snapMgr?.isEnabled()) {
        const rawT = cs.xToTime(targetX);
        const rawP = cs.yToPrice(targetY);
        const snapRes = snapMgr.snap(rawT, rawP, cs.xToTime, cs.yToPrice, cs.timeToX, cs.priceToY);
        if (snapRes.snapped) {
          targetX = cs.timeToX(snapRes.time);
          targetY = cs.priceToY(snapRes.price);
        }
      }

      this.context.currentScreenPoints = this.context.origScreenPoints.map((p, i) => {
        if (i !== idx) return p;
        return { x: targetX, y: targetY };
      });
    }
    return true;
  }

  getCurrentScreenPoints(): Array<{ x: number; y: number }> | null {
    return this.context?.currentScreenPoints ?? null;
  }

  getDraggingId(): string | null {
    return this.context?.drawingId ?? null;
  }

  /**
   * COMMIT-TIME CONVERSION (MouseUp).
   * Converts final Screen Pixels -> Domain Points (time, price).
   */
  commit(cs: CoordinateSystem): { drawingId: string; points: DrawingPoint[] } | null {
    if (!this.context) return null;
    const drawingId = this.context.drawingId;
    const origDrawing = this.callbacks.getDrawing(drawingId);
    const snapMgr = this.callbacks.getSnapManager?.();
    const points = this.context.currentScreenPoints.map((sp, i) => {
      const time = cs.xToTime(sp.x);
      const price = cs.yToPrice(sp.y);
      const origP = origDrawing?.points[i];
      let validTime = Number.isFinite(time) && !isNaN(time) && time > 0 ? time : (origP?.time ?? 0);
      let validPrice = Number.isFinite(price) && !isNaN(price) && price !== 0 ? price : (origP?.price ?? 0);

      // Snap anchor if snapManager is enabled and this anchor was resized
      if (this.context?.anchorIndex === i && snapMgr?.isEnabled()) {
        const snapRes = snapMgr.snap(validTime, validPrice, cs.xToTime, cs.yToPrice, cs.timeToX, cs.priceToY);
        if (snapRes.snapped) {
          validTime = snapRes.time;
          validPrice = snapRes.price;
        }
      }

      return {
        time: validTime,
        price: validPrice,
      };
    });
    this.context = null;
    return { drawingId, points };
  }

  stop(): void {
    this.context = null;
  }
}
