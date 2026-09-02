import type { DrawingObject, DrawingPoint, DrawingStyle } from './types';
import { clipLineToRect } from '@/drawing/geometry/line';

export interface RenderContext {
  timeToX: (t: number) => number;
  priceToY: (p: number) => number;
  xToTime: (x: number) => number;
  yToPrice: (y: number) => number;
  width: number;
  height: number;
  /** Width of the right price scale — used for inner-chart clipping */
  priceScaleWidth: number;
  /** Height of the bottom time scale — used for inner-chart clipping */
  timeScaleHeight: number;
}

export interface RenderState {
  selectedIds: Set<string>;
  hoveredId: string | null;
  tempPoints: DrawingPoint[];
  activeTool: string;
  activeDrag?: {
    drawingId: string;
    screenPoints: Array<{ x: number; y: number }>;
  } | null;
}

export class DrawingRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private axisCanvas: HTMLCanvasElement | null = null;
  private axisCtx: CanvasRenderingContext2D | null = null;
  private needsRedraw = true;
  private width = 0;
  private height = 0;
  private dpr = 1;

  setCanvas(canvas: HTMLCanvasElement | null, axisCanvas?: HTMLCanvasElement | null): void {
    this.canvas = canvas;
    this.ctx = canvas?.getContext('2d') ?? null;
    this.axisCanvas = axisCanvas ?? null;
    this.axisCtx = axisCanvas?.getContext('2d') ?? null;
    this.invalidate();
  }

  resize(width: number, height: number, dpr = (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1): void {
    const nextWidth = Math.max(0, Math.floor(width));
    const nextHeight = Math.max(0, Math.floor(height));
    const nextDpr = Math.max(1, dpr);
    if (this.width === nextWidth && this.height === nextHeight && this.dpr === nextDpr) return;
    this.width = nextWidth;
    this.height = nextHeight;
    this.dpr = nextDpr;

    if (this.canvas) {
      this.canvas.width = Math.floor(nextWidth * nextDpr);
      this.canvas.height = Math.floor(nextHeight * nextDpr);
      this.canvas.style.width = `${nextWidth}px`;
      this.canvas.style.height = `${nextHeight}px`;
      this.ctx = this.canvas.getContext('2d');
    }

    if (this.axisCanvas) {
      this.axisCanvas.width = Math.floor(nextWidth * nextDpr);
      this.axisCanvas.height = Math.floor(nextHeight * nextDpr);
      this.axisCanvas.style.width = `${nextWidth}px`;
      this.axisCanvas.style.height = `${nextHeight}px`;
      this.axisCtx = this.axisCanvas.getContext('2d');
    }

    this.invalidate();
  }

  invalidate(): void {
    this.needsRedraw = true;
  }

  render(drawings: DrawingObject[], rc: RenderContext, state: RenderState): void {
    const ctx = this.ctx;
    if (!ctx || !this.canvas || !this.needsRedraw) return;
    this.needsRedraw = false;

    const axisCtx = this.axisCtx;
    if (axisCtx && this.axisCanvas) {
      axisCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      axisCtx.clearRect(0, 0, rc.width, rc.height);
    }

    try {
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, rc.width, rc.height);

      if (rc.width > 0 && rc.height > 0) {
        const clipW = rc.width  - rc.priceScaleWidth;
        const clipH = rc.height - rc.timeScaleHeight;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, Math.max(clipW, 1), Math.max(clipH, 1));
        ctx.clip();

        for (const drawing of drawings) {
          if (!drawing.visible || drawing.hidden || drawing.points.length === 0) continue;

          // Top-Level Viewport & Out-of-Bounds Culling Guard
          if (drawing.points.length >= 2) {
            const x1 = rc.timeToX(drawing.points[0].time);
            const y1 = rc.priceToY(drawing.points[0].price);
            const x2 = rc.timeToX(drawing.points[1].time);
            const y2 = rc.priceToY(drawing.points[1].price);

            if (!Number.isFinite(x1) || !Number.isFinite(x2) || !Number.isFinite(y1) || !Number.isFinite(y2)) {
              continue;
            }

            const minX = Math.min(x1, x2);
            const maxX = Math.max(x1, x2);
            const minY = Math.min(y1, y2);
            const maxY = Math.max(y1, y2);

            if (maxX < -2000 || maxY < -2000 || minY > rc.height + 2000) {
              continue;
            }
          }

          try {
            ctx.save();
            const dragPoints = (state.activeDrag && state.activeDrag.drawingId === drawing.id) ? state.activeDrag.screenPoints : null;
            this.drawDrawing(
              ctx,
              drawing,
              rc,
              state.selectedIds.has(drawing.id),
              drawing.id === state.hoveredId && !state.selectedIds.has(drawing.id),
              dragPoints
            );
            ctx.restore();
          } catch (err) {
            console.error('[Drawing Engine] Individual drawing render error bypassed:', err);
            try { ctx.restore(); } catch {}
          }
        }

        if (state.tempPoints.length > 0) {
          try {
            ctx.save();
            this.drawPreview(ctx, state.tempPoints, state.activeTool, rc);
            ctx.restore();
          } catch (err) {
            console.error('[Drawing Engine] Preview render error bypassed:', err);
            try { ctx.restore(); } catch {}
          }
        }

        ctx.restore();
      }
    } catch (err) {
      console.error('[Drawing Engine] Global render error bypassed:', err);
    }
  }

  private drawDrawing(ctx: CanvasRenderingContext2D, drawing: DrawingObject, rc: RenderContext, selected: boolean, hovered: boolean, activeDragPoints?: Array<{ x: number; y: number }> | null): void {
    this.applyStyle(ctx, drawing.style, hovered && !selected);

    let targetDrawing = drawing;
    let targetRc = rc;

    if (activeDragPoints && activeDragPoints.length >= 1) {
      targetDrawing = {
        ...drawing,
        points: activeDragPoints.map((sp) => ({ time: sp.x, price: sp.y })),
      };
      targetRc = { ...rc, timeToX: (t) => t, priceToY: (p) => p };
    }

    switch (targetDrawing.type) {
        case 'horizontal-line':
          this.drawHorizontal(ctx, targetDrawing, targetRc);
          break;
        case 'horizontal-ray':
          this.drawHorizontalRay(ctx, targetDrawing, targetRc);
          break;
        case 'vertical-line':
          this.drawVertical(ctx, targetDrawing, targetRc);
          break;
        case 'cross-line':
          this.drawCross(ctx, targetDrawing, targetRc);
          break;
        case 'ray':
          this.drawRay(ctx, targetDrawing, targetRc);
          break;
        case 'extended-line':
          this.drawExtendedLine(ctx, targetDrawing, targetRc);
          break;
        case 'arrow':
        case 'arrow-marker':
          this.drawArrow(ctx, targetDrawing, targetRc);
          break;
        case 'arrow-up':
          this.drawArrowUp(ctx, targetDrawing, targetRc);
          break;
        case 'arrow-down':
          this.drawArrowDown(ctx, targetDrawing, targetRc);
          break;
        case 'rectangle':
          this.drawRectangle(ctx, targetDrawing, targetRc);
          break;
        case 'rotated-rectangle':
          this.drawRotatedRectangle(ctx, targetDrawing, targetRc);
          break;
        case 'circle':
          this.drawCircle(ctx, targetDrawing, targetRc);
          break;
        case 'ellipse':
          this.drawEllipse(ctx, targetDrawing, targetRc);
          break;
        case 'triangle':
          this.drawPolygon(ctx, targetDrawing, targetRc);
          break;
        case 'polyline':
        case 'path':
          this.drawPolyline(ctx, targetDrawing, targetRc);
          break;
        case 'brush':
          this.drawBrush(ctx, targetDrawing, targetRc);
          break;
        case 'highlighter':
          this.drawHighlighter(ctx, targetDrawing, targetRc);
          break;
        case 'curve':
          this.drawCurve(ctx, targetDrawing, targetRc);
          break;
        case 'double-curve':
          this.drawDoubleCurve(ctx, targetDrawing, targetRc);
          break;
        case 'arc':
          this.drawArc(ctx, targetDrawing, targetRc);
          break;
        case 'text':
        case 'anchored-text':
        case 'note':
        case 'anchored-note':
        case 'label':
          this.drawDrawingText(ctx, targetDrawing, targetRc);
          break;
        case 'callout':
        case 'balloon':
          this.drawCallout(ctx, targetDrawing, targetRc);
          break;
        case 'price-label':
          this.drawPriceLabel(ctx, targetDrawing, targetRc);
          break;
        case 'long-position':
          this.drawPosition(ctx, targetDrawing, targetRc, 'long', selected || hovered);
          break;
        case 'short-position':
          this.drawPosition(ctx, targetDrawing, targetRc, 'short', selected || hovered);
          break;
        case 'price-range':
        case 'date-range':
        case 'date-price-range':
          this.drawMeasurement(ctx, targetDrawing, targetRc);
          break;
        case 'fib-retracement':
        case 'fibonacci':
          this.drawFibRetracement(ctx, targetDrawing, targetRc);
          break;
        case 'fib-extension':
          this.drawFibExtension(ctx, targetDrawing, targetRc);
          break;
        case 'fib-channel':
          this.drawFibChannel(ctx, targetDrawing, targetRc);
          break;
        case 'fib-time-zone':
        case 'fib-timezone':
          this.drawFibTimeZone(ctx, targetDrawing, targetRc);
          break;
        case 'fib-fan':
          this.drawFibFan(ctx, targetDrawing, targetRc);
          break;
        case 'gann-box':
          this.drawGannBox(ctx, targetDrawing, targetRc);
          break;
        case 'gann-fan':
          this.drawGannFan(ctx, targetDrawing, targetRc);
          break;
        case 'channel':
          this.drawChannel(ctx, targetDrawing, targetRc);
          break;
        default:
          this.drawTrendLine(ctx, targetDrawing, targetRc);
      }

      // Render attached text label with custom alignments & size
      const labelText = targetDrawing.text || (targetDrawing.style as any).text;
      if (labelText && targetDrawing.type !== 'text' && targetDrawing.type !== 'anchored-text' && targetDrawing.type !== 'callout') {
        this.drawDrawingText(ctx, targetDrawing, targetRc);
      }

    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    if (hovered) this.drawHover(ctx, targetDrawing, targetRc);
    if (selected) {
      if (activeDragPoints) {
        this.drawSelectionScreen(ctx, activeDragPoints, drawing.type);
      } else {
        this.drawSelection(ctx, drawing, rc);
      }
    }
  }

  private drawSelectionScreen(ctx: CanvasRenderingContext2D, screenPoints: Array<{ x: number; y: number }>, type?: string): void {
    if (type === 'rectangle' && screenPoints.length >= 2) {
      const x1 = screenPoints[0].x, y1 = screenPoints[0].y;
      const x2 = screenPoints[1].x, y2 = screenPoints[1].y;
      const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
      const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
      const midX = (minX + maxX) / 2;
      const midY = (minY + maxY) / 2;

      this.drawAnchor(ctx, minX, minY); // 0: NW
      this.drawAnchor(ctx, midX, minY); // 1: N
      this.drawAnchor(ctx, maxX, minY); // 2: NE
      this.drawAnchor(ctx, maxX, midY); // 3: E
      this.drawAnchor(ctx, maxX, maxY); // 4: SE
      this.drawAnchor(ctx, midX, maxY); // 5: S
      this.drawAnchor(ctx, minX, maxY); // 6: SW
      this.drawAnchor(ctx, minX, midY); // 7: W
    } else if (type === 'rotated-rectangle' && screenPoints.length >= 2) {
      const p1 = screenPoints[0];
      const p2 = screenPoints[1];
      const p3 = screenPoints.length >= 3 ? screenPoints[2] : p2;
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy);
      const nx = len > 0.0001 ? -dy / len : 0;
      const ny = len > 0.0001 ? dx / len : 1;
      const h = (p3.x - p1.x) * nx + (p3.y - p1.y) * ny;

      this.drawAnchor(ctx, p1.x, p1.y);
      this.drawAnchor(ctx, p2.x, p2.y);
      this.drawAnchor(ctx, p2.x + nx * h, p2.y + ny * h);
      this.drawAnchor(ctx, p1.x + nx * h, p1.y + ny * h);
    } else if ((type === 'long-position' || type === 'short-position') && screenPoints.length >= 3) {
      const leftX   = screenPoints[0].x;
      const rightX  = screenPoints[1].x;
      const entryY  = screenPoints[0].y;
      const stopY   = screenPoints[1].y;
      const targetY = screenPoints[2].y;
      const minX = Math.min(leftX, rightX), maxX = Math.max(leftX, rightX);
      const midX = (minX + maxX) / 2;

      // 0: Target center, 1: Stop center, 2: Entry center
      this.drawAnchor(ctx, midX, targetY);
      this.drawAnchor(ctx, midX, stopY);
      this.drawAnchor(ctx, midX, entryY);
      // 3: Target left, 4: Target right
      this.drawAnchor(ctx, minX, targetY);
      this.drawAnchor(ctx, maxX, targetY);
      // 5: Stop left, 6: Stop right
      this.drawAnchor(ctx, minX, stopY);
      this.drawAnchor(ctx, maxX, stopY);
      // 7: Left center, 8: Right center
      this.drawAnchor(ctx, minX, entryY);
      this.drawAnchor(ctx, maxX, entryY);
    } else {
      for (const point of screenPoints) {
        this.drawAnchor(ctx, point.x, point.y);
      }
    }
  }

  private applyStyle(ctx: CanvasRenderingContext2D, style: DrawingStyle, hovered: boolean): void {
    ctx.strokeStyle = hovered ? '#ffffff' : style.color;
    ctx.lineWidth = style.lineWidth + (hovered ? 1 : 0);
    ctx.globalAlpha = style.opacity / 100;
    if (style.lineStyle === 'dashed') ctx.setLineDash([8, 4]);
    else if (style.lineStyle === 'dotted') ctx.setLineDash([2, 4]);
    else ctx.setLineDash([]);
  }

  private drawTrendLine(ctx: CanvasRenderingContext2D, drawing: DrawingObject, rc: RenderContext): void {
    if (drawing.points.length < 2) return;
    const x1 = Number.isFinite(rc.timeToX(drawing.points[0].time)) ? rc.timeToX(drawing.points[0].time) : 0;
    const y1 = Number.isFinite(rc.priceToY(drawing.points[0].price)) ? rc.priceToY(drawing.points[0].price) : 0;
    const x2 = Number.isFinite(rc.timeToX(drawing.points[1].time)) ? rc.timeToX(drawing.points[1].time) : 0;
    const y2 = Number.isFinite(rc.priceToY(drawing.points[1].price)) ? rc.priceToY(drawing.points[1].price) : 0;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  private drawRay(ctx: CanvasRenderingContext2D, drawing: DrawingObject, rc: RenderContext): void {
    if (drawing.points.length < 2) return;
    const x1 = rc.timeToX(drawing.points[0].time);
    const y1 = rc.priceToY(drawing.points[0].price);
    const x2 = rc.timeToX(drawing.points[1].time);
    const y2 = rc.priceToY(drawing.points[1].price);
    const clipped = clipLineToRect(x1, y1, x2, y2, rc.width, rc.height, 'ray');
    ctx.beginPath();
    ctx.moveTo(clipped.x1, clipped.y1);
    ctx.lineTo(clipped.x2, clipped.y2);
    ctx.stroke();
  }

  private drawExtendedLine(ctx: CanvasRenderingContext2D, drawing: DrawingObject, rc: RenderContext): void {
    if (drawing.points.length < 2) return;
    const x1 = rc.timeToX(drawing.points[0].time);
    const y1 = rc.priceToY(drawing.points[0].price);
    const x2 = rc.timeToX(drawing.points[1].time);
    const y2 = rc.priceToY(drawing.points[1].price);
    const clipped = clipLineToRect(x1, y1, x2, y2, rc.width, rc.height, 'infinite');
    ctx.beginPath();
    ctx.moveTo(clipped.x1, clipped.y1);
    ctx.lineTo(clipped.x2, clipped.y2);
    ctx.stroke();
  }

  private drawHorizontal(ctx: CanvasRenderingContext2D, drawing: DrawingObject, rc: RenderContext): void {
    if (drawing.points.length < 1) return;
    const y = rc.priceToY(drawing.points[0].price);
    if (y < -100 || y > rc.height + 100) return;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(rc.width, y);
    ctx.stroke();
  }

  private drawHorizontalRay(ctx: CanvasRenderingContext2D, drawing: DrawingObject, rc: RenderContext): void {
    if (drawing.points.length < 1) return;
    const x = rc.timeToX(drawing.points[0].time);
    const y = rc.priceToY(drawing.points[0].price);
    if (y < -100 || y > rc.height + 100) return;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(rc.width, y);
    ctx.stroke();
  }

  private drawVertical(ctx: CanvasRenderingContext2D, drawing: DrawingObject, rc: RenderContext): void {
    if (drawing.points.length < 1) return;
    const x = rc.timeToX(drawing.points[0].time);
    if (x < -100 || x > rc.width + 100) return;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, rc.height);
    ctx.stroke();
  }

  private drawCross(ctx: CanvasRenderingContext2D, drawing: DrawingObject, rc: RenderContext): void {
    if (drawing.points.length < 1) return;
    const x = rc.timeToX(drawing.points[0].time);
    const y = rc.priceToY(drawing.points[0].price);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(rc.width, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, rc.height);
    ctx.stroke();
  }

  private drawArrow(ctx: CanvasRenderingContext2D, drawing: DrawingObject, rc: RenderContext): void {
    if (drawing.points.length < 2) return;
    const x1 = rc.timeToX(drawing.points[0].time);
    const y1 = rc.priceToY(drawing.points[0].price);
    const x2 = rc.timeToX(drawing.points[1].time);
    const y2 = rc.priceToY(drawing.points[1].price);
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLen = 12;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Solid filled arrowhead
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  }

  private drawArrowUp(ctx: CanvasRenderingContext2D, drawing: DrawingObject, rc: RenderContext): void {
    if (drawing.points.length < 1) return;
    const x = Math.round(rc.timeToX(drawing.points[0].time));
    const y = Math.round(rc.priceToY(drawing.points[0].price));
    const arrowHeight = 28;
    const headSize = 8;

    ctx.beginPath();
    ctx.moveTo(x, y + arrowHeight);
    ctx.lineTo(x, y);
    ctx.stroke();

    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - headSize / 2, y + headSize);
    ctx.lineTo(x + headSize / 2, y + headSize);
    ctx.closePath();
    ctx.fill();
  }

  private drawArrowDown(ctx: CanvasRenderingContext2D, drawing: DrawingObject, rc: RenderContext): void {
    if (drawing.points.length < 1) return;
    const x = Math.round(rc.timeToX(drawing.points[0].time));
    const y = Math.round(rc.priceToY(drawing.points[0].price));
    const arrowHeight = 28;
    const headSize = 8;

    ctx.beginPath();
    ctx.moveTo(x, y - arrowHeight);
    ctx.lineTo(x, y);
    ctx.stroke();

    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - headSize / 2, y - headSize);
    ctx.lineTo(x + headSize / 2, y - headSize);
    ctx.closePath();
    ctx.fill();
  }

  private drawRectangle(ctx: CanvasRenderingContext2D, drawing: DrawingObject, rc: RenderContext): void {
    if (drawing.points.length < 2) return;
    const x1 = rc.timeToX(drawing.points[0].time);
    const y1 = rc.priceToY(drawing.points[0].price);
    const x2 = rc.timeToX(drawing.points[1].time);
    const y2 = rc.priceToY(drawing.points[1].price);

    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);

    if (maxX < -500 || minX > rc.width + 500 || maxY < -500 || minY > rc.height + 500) {
      return;
    }

    const width = maxX - minX;
    const height = maxY - minY;

    const fillEnabled = drawing.style.fillEnabled !== false;
    const fillColor = drawing.style.fillColor || drawing.style.fill || 'rgba(41, 98, 255, 0.2)';
    if (fillEnabled && fillColor !== 'transparent' && fillColor !== 'none') {
      ctx.fillStyle = fillColor;
      ctx.globalAlpha = (drawing.style.fillOpacity ?? 20) / 100;
      ctx.fillRect(minX, minY, width, height);
    }

    const strokeColor = drawing.style.strokeColor || drawing.style.color || '#2962ff';
    if (strokeColor !== 'transparent' && strokeColor !== 'none') {
      const strokeWidth = drawing.style.strokeWidth || drawing.style.lineWidth || 1.5;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.globalAlpha = (drawing.style.opacity ?? 100) / 100;
      ctx.strokeRect(minX, minY, width, height);
    }
  }

  private drawRotatedRectangle(ctx: CanvasRenderingContext2D, drawing: DrawingObject, rc: RenderContext): void {
    if (drawing.points.length < 2) return;
    const p1 = { x: rc.timeToX(drawing.points[0].time), y: rc.priceToY(drawing.points[0].price) };
    const p2 = { x: rc.timeToX(drawing.points[1].time), y: rc.priceToY(drawing.points[1].price) };
    const p3 = drawing.points.length >= 3
      ? { x: rc.timeToX(drawing.points[2].time), y: rc.priceToY(drawing.points[2].price) }
      : p2;

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    const nx = len > 0.0001 ? -dy / len : 0;
    const ny = len > 0.0001 ? dx / len : 1;
    const h = (p3.x - p1.x) * nx + (p3.y - p1.y) * ny;

    const corner1 = p1;
    const corner2 = p2;
    const corner3 = { x: p2.x + nx * h, y: p2.y + ny * h };
    const corner4 = { x: p1.x + nx * h, y: p1.y + ny * h };

    ctx.beginPath();
    ctx.moveTo(corner1.x, corner1.y);
    ctx.lineTo(corner2.x, corner2.y);
    ctx.lineTo(corner3.x, corner3.y);
    ctx.lineTo(corner4.x, corner4.y);
    ctx.closePath();

    const fillEnabled = drawing.style.fillEnabled !== false;
    const fillColor = drawing.style.fillColor || drawing.style.fill || 'rgba(41, 98, 255, 0.2)';
    if (fillEnabled && fillColor !== 'transparent' && fillColor !== 'none') {
      ctx.fillStyle = fillColor;
      ctx.globalAlpha = (drawing.style.fillOpacity ?? 20) / 100;
      ctx.fill();
    }

    const strokeColor = drawing.style.strokeColor || drawing.style.color || '#2962ff';
    if (strokeColor !== 'transparent' && strokeColor !== 'none') {
      const strokeWidth = drawing.style.strokeWidth || drawing.style.lineWidth || 1.5;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.globalAlpha = (drawing.style.opacity ?? 100) / 100;
      ctx.stroke();
    }
  }

  private drawCircle(ctx: CanvasRenderingContext2D, drawing: DrawingObject, rc: RenderContext): void {
    if (drawing.points.length < 2) return;
    const x1 = rc.timeToX(drawing.points[0].time);
    const y1 = rc.priceToY(drawing.points[0].price);
    const x2 = rc.timeToX(drawing.points[1].time);
    const y2 = rc.priceToY(drawing.points[1].price);
    const r = Math.hypot(x2 - x1, y2 - y1);
    if (r <= 0) return;

    ctx.beginPath();
    ctx.arc(x1, y1, r, 0, Math.PI * 2);

    const fillEnabled = drawing.style.fillEnabled !== false;
    const fillColor = drawing.style.fillColor || drawing.style.fill || 'rgba(41, 98, 255, 0.2)';
    if (fillEnabled && fillColor !== 'transparent' && fillColor !== 'none') {
      ctx.fillStyle = fillColor;
      ctx.globalAlpha = (drawing.style.fillOpacity ?? 20) / 100;
      ctx.fill();
    }

    const strokeColor = drawing.style.strokeColor || drawing.style.color || '#2962ff';
    if (strokeColor !== 'transparent' && strokeColor !== 'none') {
      const strokeWidth = drawing.style.strokeWidth || drawing.style.lineWidth || 1.5;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.globalAlpha = (drawing.style.opacity ?? 100) / 100;
      ctx.stroke();
    }
  }

  private drawEllipse(ctx: CanvasRenderingContext2D, drawing: DrawingObject, rc: RenderContext): void {
    if (drawing.points.length < 2) return;
    const x1 = rc.timeToX(drawing.points[0].time);
    const y1 = rc.priceToY(drawing.points[0].price);
    const x2 = rc.timeToX(drawing.points[1].time);
    const y2 = rc.priceToY(drawing.points[1].price);
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const rx = Math.abs(x2 - x1) / 2;
    const ry = Math.abs(y2 - y1) / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);

    const fillEnabled = drawing.style.fillEnabled !== false;
    const fillColor = drawing.style.fillColor || drawing.style.fill || 'rgba(41, 98, 255, 0.2)';
    if (fillEnabled && fillColor !== 'transparent' && fillColor !== 'none') {
      ctx.fillStyle = fillColor;
      ctx.globalAlpha = (drawing.style.fillOpacity ?? 20) / 100;
      ctx.fill();
    }

    const strokeColor = drawing.style.strokeColor || drawing.style.color || '#2962ff';
    if (strokeColor !== 'transparent' && strokeColor !== 'none') {
      const strokeWidth = drawing.style.strokeWidth || drawing.style.lineWidth || 1.5;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.globalAlpha = (drawing.style.opacity ?? 100) / 100;
      ctx.stroke();
    }
  }

  private drawPolygon(ctx: CanvasRenderingContext2D, drawing: DrawingObject, rc: RenderContext): void {
    if (drawing.points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(rc.timeToX(drawing.points[0].time), rc.priceToY(drawing.points[0].price));
    for (let i = 1; i < drawing.points.length; i++) {
      ctx.lineTo(rc.timeToX(drawing.points[i].time), rc.priceToY(drawing.points[i].price));
    }
    ctx.closePath();

    const fillEnabled = drawing.style.fillEnabled !== false;
    const fillColor = drawing.style.fillColor || drawing.style.fill || 'rgba(41, 98, 255, 0.2)';
    if (fillEnabled && fillColor !== 'transparent' && fillColor !== 'none') {
      ctx.fillStyle = fillColor;
      ctx.globalAlpha = (drawing.style.fillOpacity ?? 20) / 100;
      ctx.fill();
    }

    const strokeColor = drawing.style.strokeColor || drawing.style.color || '#2962ff';
    if (strokeColor !== 'transparent' && strokeColor !== 'none') {
      const strokeWidth = drawing.style.strokeWidth || drawing.style.lineWidth || 1.5;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.globalAlpha = (drawing.style.opacity ?? 100) / 100;
      ctx.stroke();
    }
  }

  private drawPolyline(ctx: CanvasRenderingContext2D, drawing: DrawingObject, rc: RenderContext): void {
    if (drawing.points.length < 2) return;
    const pts = drawing.points.map((p) => ({
      x: rc.timeToX(p.time),
      y: rc.priceToY(p.price),
    }));

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }

    const fillEnabled = drawing.style.fillEnabled === true;
    const fillColor = drawing.style.fillColor || drawing.style.fill;
    if (fillEnabled && fillColor && fillColor !== 'transparent' && fillColor !== 'none') {
      ctx.save();
      ctx.closePath();
      ctx.fillStyle = fillColor;
      ctx.globalAlpha = (drawing.style.fillOpacity ?? 20) / 100;
      ctx.fill();
      ctx.restore();
    }

    const strokeColor = drawing.style.strokeColor || drawing.style.color || '#2962ff';
    if (strokeColor !== 'transparent' && strokeColor !== 'none') {
      const strokeWidth = drawing.style.strokeWidth || drawing.style.lineWidth || 1.5;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.globalAlpha = (drawing.style.opacity ?? 100) / 100;
      ctx.stroke();

      // Arrowhead at the last point (polyline only, not path)
      if (drawing.type === 'polyline' && pts.length >= 2) {
        const tip = pts[pts.length - 1];
        const prev = pts[pts.length - 2];
        this.drawArrowhead(ctx, prev.x, prev.y, tip.x, tip.y, strokeWidth, strokeColor);
      }
    }
  }

  /** Filled arrowhead triangle pointing from (x1,y1) toward (x2,y2) */
  private drawArrowhead(
    ctx: CanvasRenderingContext2D,
    x1: number, y1: number,
    x2: number, y2: number,
    lineWidth: number,
    color: string,
  ): void {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const size = Math.max(8, lineWidth * 4); // arrow size scales with line width
    const spread = Math.PI / 6; // 30°
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = ctx.globalAlpha; // inherit
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - size * Math.cos(angle - spread), y2 - size * Math.sin(angle - spread));
    ctx.lineTo(x2 - size * Math.cos(angle + spread), y2 - size * Math.sin(angle + spread));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Ultra-smooth freehand brush: thin → Laplacian relax → Catmull-Rom bezier
  private drawBrush(ctx: CanvasRenderingContext2D, drawing: DrawingObject, rc: RenderContext): void {
    if (drawing.points.length < 2) return;

    // Step 1: convert to screen coords
    const raw = drawing.points.map((p) => ({
      x: rc.timeToX(p.time),
      y: rc.priceToY(p.price),
    }));

    // Step 2: aggressive thinning — keep first, then only points ≥10px from last kept
    const MIN_DIST = 10;
    let thinned: { x: number; y: number }[] = [raw[0]];
    for (let i = 1; i < raw.length; i++) {
      const prev = thinned[thinned.length - 1];
      const dx = raw[i].x - prev.x;
      const dy = raw[i].y - prev.y;
      if (dx * dx + dy * dy >= MIN_DIST * MIN_DIST) thinned.push(raw[i]);
    }
    const lastRaw = raw[raw.length - 1];
    if (thinned[thinned.length - 1] !== lastRaw) thinned.push(lastRaw);
    if (thinned.length < 2) return;

    // Step 3: Laplacian relaxation — average each interior point with its neighbors (3 passes)
    // This flattens any remaining micro-kinks
    let pts = thinned;
    for (let pass = 0; pass < 3; pass++) {
      const smoothed = [pts[0]];
      for (let i = 1; i < pts.length - 1; i++) {
        smoothed.push({
          x: pts[i - 1].x * 0.25 + pts[i].x * 0.5 + pts[i + 1].x * 0.25,
          y: pts[i - 1].y * 0.25 + pts[i].y * 0.5 + pts[i + 1].y * 0.25,
        });
      }
      smoothed.push(pts[pts.length - 1]);
      pts = smoothed;
    }

    // Step 4: Catmull-Rom → cubic bezier rendering
    const strokeColor = drawing.style.strokeColor || drawing.style.color || '#2962ff';
    const strokeWidth = drawing.style.strokeWidth || drawing.style.lineWidth || 2;
    const alpha = (drawing.style.opacity ?? 100) / 100;

    ctx.save();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);

    if (pts.length === 2) {
      ctx.lineTo(pts[1].x, pts[1].y);
    } else {
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(i - 1, 0)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[Math.min(i + 2, pts.length - 1)];
        ctx.bezierCurveTo(
          p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6,
          p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6,
          p2.x, p2.y
        );
      }
    }

    ctx.stroke();
    ctx.restore();
  }

  private drawHighlighter(ctx: CanvasRenderingContext2D, drawing: DrawingObject, rc: RenderContext): void {
    if (drawing.points.length < 2) return;
    const pts = drawing.points.map((p) => ({
      x: rc.timeToX(p.time),
      y: rc.priceToY(p.price),
    }));
    const strokeColor = drawing.style.strokeColor || drawing.style.color || '#f6c40b';
    const strokeWidth = Math.max(drawing.style.strokeWidth || drawing.style.lineWidth || 12, 8);
    ctx.save();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    if (pts.length === 2) {
      ctx.lineTo(pts[1].x, pts[1].y);
    } else {
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(i - 1, 0)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[Math.min(i + 2, pts.length - 1)];
        ctx.bezierCurveTo(
          p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6,
          p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6,
          p2.x, p2.y
        );
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  private drawCurve(ctx: CanvasRenderingContext2D, drawing: DrawingObject, rc: RenderContext): void {
    if (drawing.points.length < 2) return;
    const x1 = rc.timeToX(drawing.points[0].time), y1 = rc.priceToY(drawing.points[0].price);
    const lastIdx = drawing.points.length - 1;
    const xEnd = rc.timeToX(drawing.points[lastIdx].time), yEnd = rc.priceToY(drawing.points[lastIdx].price);

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    if (drawing.points.length >= 3) {
      const cpx = rc.timeToX(drawing.points[1].time), cpy = rc.priceToY(drawing.points[1].price);
      ctx.quadraticCurveTo(cpx, cpy, xEnd, yEnd);
    } else {
      ctx.lineTo(xEnd, yEnd);
    }

    const fillEnabled = drawing.style.fillEnabled !== false;
    const fillColor = drawing.style.fillColor || drawing.style.fill || 'rgba(41, 98, 255, 0.2)';
    if (fillEnabled && fillColor !== 'transparent' && fillColor !== 'none') {
      ctx.save();
      ctx.lineTo(x1, y1);
      ctx.closePath();
      ctx.fillStyle = fillColor;
      ctx.globalAlpha = (drawing.style.fillOpacity ?? 20) / 100;
      ctx.fill();
      ctx.restore();
    }

    const strokeColor = drawing.style.strokeColor || drawing.style.color || '#2962ff';
    if (strokeColor !== 'transparent' && strokeColor !== 'none') {
      const strokeWidth = drawing.style.strokeWidth || drawing.style.lineWidth || 1.5;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.globalAlpha = (drawing.style.opacity ?? 100) / 100;
      ctx.stroke();
    }
  }

  private drawDoubleCurve(ctx: CanvasRenderingContext2D, drawing: DrawingObject, rc: RenderContext): void {
    if (drawing.points.length < 2) return;
    const x1 = rc.timeToX(drawing.points[0].time), y1 = rc.priceToY(drawing.points[0].price);
    const lastIdx = drawing.points.length - 1;
    const xEnd = rc.timeToX(drawing.points[lastIdx].time), yEnd = rc.priceToY(drawing.points[lastIdx].price);

    ctx.beginPath();
    ctx.moveTo(x1, y1);

    if (drawing.points.length >= 4) {
      const cp1x = rc.timeToX(drawing.points[1].time), cp1y = rc.priceToY(drawing.points[1].price);
      const cp2x = rc.timeToX(drawing.points[2].time), cp2y = rc.priceToY(drawing.points[2].price);
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, xEnd, yEnd);
    } else if (drawing.points.length === 3) {
      const cpx = rc.timeToX(drawing.points[1].time), cpy = rc.priceToY(drawing.points[1].price);
      ctx.quadraticCurveTo(cpx, cpy, xEnd, yEnd);
    } else {
      ctx.lineTo(xEnd, yEnd);
    }

    const fillEnabled = drawing.style.fillEnabled !== false;
    const fillColor = drawing.style.fillColor || drawing.style.fill || 'rgba(41, 98, 255, 0.2)';
    if (fillEnabled && fillColor !== 'transparent' && fillColor !== 'none') {
      ctx.save();
      ctx.lineTo(x1, y1);
      ctx.closePath();
      ctx.fillStyle = fillColor;
      ctx.globalAlpha = (drawing.style.fillOpacity ?? 20) / 100;
      ctx.fill();
      ctx.restore();
    }

    const strokeColor = drawing.style.strokeColor || drawing.style.color || '#2962ff';
    if (strokeColor !== 'transparent' && strokeColor !== 'none') {
      const strokeWidth = drawing.style.strokeWidth || drawing.style.lineWidth || 1.5;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.globalAlpha = (drawing.style.opacity ?? 100) / 100;
      ctx.stroke();
    }
  }

  private drawArc(ctx: CanvasRenderingContext2D, drawing: DrawingObject, rc: RenderContext): void {
    if (drawing.points.length < 2) return;
    const p1 = { x: rc.timeToX(drawing.points[0].time), y: rc.priceToY(drawing.points[0].price) };
    const p2 = drawing.points.length >= 3
      ? { x: rc.timeToX(drawing.points[1].time), y: rc.priceToY(drawing.points[1].price) }
      : { x: (p1.x + rc.timeToX(drawing.points[1].time)) / 2, y: (p1.y + rc.priceToY(drawing.points[1].price)) / 2 };
    const p3 = { x: rc.timeToX(drawing.points[drawing.points.length - 1].time), y: rc.priceToY(drawing.points[drawing.points.length - 1].price) };

    // Circumcircle through (p1, p2, p3)
    const d = 2 * (p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y));

    if (Math.abs(d) < 0.0001) {
      // Points are nearly collinear: graceful fallback to straight line p1 -> p3
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.stroke();
      return;
    }

    const p1Sq = p1.x * p1.x + p1.y * p1.y;
    const p2Sq = p2.x * p2.x + p2.y * p2.y;
    const p3Sq = p3.x * p3.x + p3.y * p3.y;

    const cx = (p1Sq * (p2.y - p3.y) + p2Sq * (p3.y - p1.y) + p3Sq * (p1.y - p2.y)) / d;
    const cy = (p1Sq * (p3.x - p2.x) + p2Sq * (p1.x - p3.x) + p3Sq * (p2.x - p1.x)) / d;
    const r = Math.hypot(p1.x - cx, p1.y - cy);

    if (!Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isFinite(r) || r <= 0) {
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.stroke();
      return;
    }

    let a1 = Math.atan2(p1.y - cy, p1.x - cx);
    let a2 = Math.atan2(p2.y - cy, p2.x - cx);
    let a3 = Math.atan2(p3.y - cy, p3.x - cx);

    const norm = (a: number) => (a % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    const n1 = norm(a1);
    const n2 = norm(a2);
    const n3 = norm(a3);

    const ccwSpan = norm(n3 - n1);
    const p2Span = norm(n2 - n1);
    const counterClockwise = !(p2Span < ccwSpan);

    ctx.beginPath();
    ctx.arc(cx, cy, r, a1, a3, counterClockwise);

    const strokeColor = drawing.style.strokeColor || drawing.style.color || '#2962ff';
    if (strokeColor !== 'transparent' && strokeColor !== 'none') {
      const strokeWidth = drawing.style.strokeWidth || drawing.style.lineWidth || 1.5;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.globalAlpha = (drawing.style.opacity ?? 100) / 100;
      ctx.stroke();
    }
  }

  private drawCallout(ctx: CanvasRenderingContext2D, drawing: DrawingObject, rc: RenderContext): void {
    if (drawing.points.length < 1) return;
    const x = rc.timeToX(drawing.points[0].time);
    const y = rc.priceToY(drawing.points[0].price);
    const label = drawing.text || 'Note';
    ctx.font = `${drawing.style.fontSize ?? 12}px ${drawing.style.fontFamily ?? 'var(--font-ui)'}`;
    const tw = ctx.measureText(label).width;
    const pad = 6;
    const bw = tw + pad * 2, bh = 22;
    ctx.fillStyle = drawing.style.fill || 'rgba(41,98,255,0.15)';
    ctx.strokeStyle = drawing.style.color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x - bw / 2, y - bh - 12, bw, bh, 4);
    ctx.fill();
    ctx.stroke();
    // tail
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 12);
    ctx.lineTo(x, y);
    ctx.lineTo(x + 6, y - 12);
    ctx.stroke();
    ctx.fillStyle = drawing.style.color;
    ctx.fillText(label, x - tw / 2, y - bh / 2 - 12 + 4);
  }

  private drawDrawingText(ctx: CanvasRenderingContext2D, drawing: DrawingObject, rc: RenderContext): void {
    const text = drawing.text || (drawing.style as any).text;
    if (!text || drawing.points.length < 1) return;

    const p1 = drawing.points[0];
    const p2 = drawing.points[1] || p1;
    const x1 = rc.timeToX(p1.time), y1 = rc.priceToY(p1.price);
    const x2 = rc.timeToX(p2.time), y2 = rc.priceToY(p2.price);

    if (!Number.isFinite(x1) || !Number.isFinite(y1)) return;

    const hAlign = (drawing.style as any).textAlign || 'center';
    const vAlign = (drawing.style as any).textValign || 'center';
    const fontSize = Number((drawing.style as any).fontSize) || Number(drawing.style.fontSize) || 12;
    const textColor = (drawing.style as any).textColor || drawing.style.color || '#ffffff';
    const isBold = Boolean((drawing.style as any).bold);
    const isItalic = Boolean((drawing.style as any).italic);
    const textOffset = (drawing.style as any).textOffset ?? (vAlign === 'center' ? 0 : 4);

    const isDirectionalLine = drawing.points.length >= 2 && (
      drawing.type === 'trendline' ||
      drawing.type === 'ray' ||
      drawing.type === 'extended-line' ||
      drawing.type === 'info-line' ||
      drawing.type === 'arrow' ||
      drawing.type === 'arrow-marker' ||
      drawing.type === 'channel' ||
      drawing.type === 'polyline' ||
      drawing.type === 'path' ||
      !drawing.type
    );

    const safeX2 = Number.isFinite(x2) ? x2 : x1;
    const safeY2 = Number.isFinite(y2) ? y2 : y1;
    const dx = safeX2 - x1;
    const dy = safeY2 - y1;

    let normalizedAngleDeg = 0;
    let isRotated = false;

    if (isDirectionalLine && (dx !== 0 || dy !== 0)) {
      const rawAngleRad = Math.atan2(dy, dx);
      const rawAngleDeg = (rawAngleRad * 180) / Math.PI;

      normalizedAngleDeg = rawAngleDeg;
      if (normalizedAngleDeg > 90) {
        normalizedAngleDeg -= 180;
      } else if (normalizedAngleDeg < -90) {
        normalizedAngleDeg += 180;
      }
      isRotated = true;
    } else if (!isDirectionalLine && typeof drawing.rotation === 'number' && drawing.rotation !== 0) {
      normalizedAngleDeg = drawing.rotation;
      isRotated = true;
    }
    const normalizedAngleRad = (normalizedAngleDeg * Math.PI) / 180;

    let anchorX = (x1 + safeX2) / 2;
    let anchorY = (y1 + safeY2) / 2;

    if (isDirectionalLine) {
      if (hAlign === 'left') {
        anchorX = x1 <= safeX2 ? x1 : safeX2;
        anchorY = x1 <= safeX2 ? y1 : safeY2;
      } else if (hAlign === 'right') {
        anchorX = x1 > safeX2 ? x1 : safeX2;
        anchorY = x1 > safeX2 ? y1 : safeY2;
      }
    } else {
      if (hAlign === 'left') anchorX = x1;
      else if (hAlign === 'right') anchorX = safeX2;
    }

    let localX = 0;
    let localY = 0;
    let textAlign: CanvasTextAlign = 'center';
    let textBaseline: CanvasTextBaseline = 'middle';

    if (vAlign === 'above') {
      textBaseline = 'bottom';
      localY = -textOffset;
    } else if (vAlign === 'below') {
      textBaseline = 'top';
      localY = textOffset;
    } else {
      textBaseline = 'middle';
      localY = 0;
    }

    if (hAlign === 'left') {
      textAlign = 'left';
      localX = 6;
    } else if (hAlign === 'right') {
      textAlign = 'right';
      localX = -6;
    } else {
      textAlign = 'center';
      localX = 0;
    }

    ctx.save();
    const fontStyle = isItalic ? 'italic' : 'normal';
    const fontWeight = isBold ? 'bold' : 'normal';
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif`;

    const lines = String(text).split('\n');
    const lineHeight = fontSize * 1.25;

    // Measure maximum line width for knockout background
    let maxLineWidth = 0;
    for (const line of lines) {
      const w = ctx.measureText(line).width;
      if (w > maxLineWidth) maxLineWidth = w;
    }

    ctx.translate(anchorX, anchorY);
    if (isRotated) {
      ctx.rotate(normalizedAngleRad);
    }

    ctx.textAlign = textAlign;
    ctx.textBaseline = textBaseline;

    const totalTextHeight = lines.length * lineHeight;
    const padX = 6;
    const padY = 3;
    let bgX = localX;
    if (textAlign === 'center') bgX = localX - maxLineWidth / 2 - padX;
    else if (textAlign === 'right') bgX = localX - maxLineWidth - padX;
    else bgX = localX - padX;

    let bgY = localY;
    if (textBaseline === 'bottom') bgY = localY - totalTextHeight - padY;
    else if (textBaseline === 'top') bgY = localY - padY;
    else bgY = localY - totalTextHeight / 2 - padY;

    // When text is aligned in the center of the line, cleanly cut out the line underneath
    // using destination-out so the background stays 100% transparent without any colored box!
    if (vAlign === 'center') {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.roundRect(bgX, bgY, maxLineWidth + padX * 2, totalTextHeight + padY * 2, 2);
      ctx.fill();
      ctx.restore();
    }

    // Render text with configured styles and 100% transparent background
    ctx.fillStyle = textColor;
    ctx.globalAlpha = (drawing.style.opacity ?? 100) / 100;

    let curY = localY;
    if (lines.length > 1 && textBaseline === 'middle') {
      curY = localY - ((lines.length - 1) * lineHeight) / 2;
    }

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], localX, curY + i * lineHeight);
    }

    ctx.restore();
  }

  private drawPriceLabel(ctx: CanvasRenderingContext2D, drawing: DrawingObject, rc: RenderContext): void {
    if (drawing.points.length < 1) return;
    const x = rc.timeToX(drawing.points[0].time);
    const y = rc.priceToY(drawing.points[0].price);
    const price = drawing.points[0].price.toFixed(5);
    ctx.font = `bold ${drawing.style.fontSize ?? 11}px ${drawing.style.fontFamily ?? 'var(--font-mono)'}`;
    const tw = ctx.measureText(price).width;
    ctx.fillStyle = drawing.style.color;
    ctx.strokeStyle = drawing.style.color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.roundRect(x - tw / 2 - 4, y - 11, tw + 8, 18, 3);
    ctx.fillStyle = drawing.style.fill || drawing.style.color;
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = drawing.style.opacity / 100;
    ctx.fillText(price, x - tw / 2, y + 4);
  }

  private drawPosition(ctx: CanvasRenderingContext2D, drawing: DrawingObject, rc: RenderContext, _side: 'long' | 'short', showLabels = false): void {
    if (drawing.points.length < 2) return;

    const leftX  = rc.timeToX(drawing.points[0].time);
    const rightX = rc.timeToX(drawing.points[1].time);
    const x1 = Math.min(leftX, rightX);
    const x2 = Math.max(leftX, rightX);
    const w  = Math.max(x2 - x1, 4);

    const entryY  = rc.priceToY(drawing.points[0].price);
    const stopY   = rc.priceToY(drawing.points[1].price);
    const targetY = drawing.points.length >= 3
      ? rc.priceToY(drawing.points[2].price)
      : entryY - (stopY - entryY) * 2;

    const entryPrice  = drawing.points[0].price;
    const stopPrice   = drawing.points[1].price;
    const targetPrice = drawing.points.length >= 3
      ? drawing.points[2].price
      : entryPrice - (stopPrice - entryPrice) * 2;

    const slPips   = Math.abs(entryPrice - stopPrice);
    const tpPips   = Math.abs(targetPrice - entryPrice);
    const rr       = slPips > 0 ? tpPips / slPips : 0;
    const slPct    = entryPrice > 0 ? (slPips / entryPrice) * 100 : 0;
    const tpPct    = entryPrice > 0 ? (tpPips / entryPrice) * 100 : 0;
    const pipsUnit = slPips > 0.001 ? 1 : 10000;

    // Custom colors (user-configurable via PositionDrawingSettingsModal)
    const tpBase = (drawing.style as any).tpColor || (drawing.style as any).targetColor || '#00897b'; // TP zone accent
    const slBase = (drawing.style as any).slColor || (drawing.style as any).stopColor || '#00838f'; // SL zone accent
    const lineBase = drawing.style.color || '#787b86';

    // ─── TP Zone: dark muted background tinted with tpBase ──────────
    const tpTop = Math.min(targetY, entryY);
    const tpH   = Math.max(Math.abs(entryY - targetY), 2);
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = tpBase;
    ctx.fillRect(x1, tpTop, w, tpH);

    // ─── SL Zone: vivid fill tinted with slBase ─────────────────────
    const slTop = Math.min(entryY, stopY);
    const slH   = Math.max(Math.abs(entryY - stopY), 2);
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = slBase;
    ctx.fillRect(x1, slTop, w, slH);
    ctx.globalAlpha = 1;

    // ─── Dashed vertical borders ─────────────────────────────────────
    const boxTop    = Math.min(tpTop, slTop);
    const boxBottom = Math.max(tpTop + tpH, slTop + slH);
    ctx.strokeStyle = lineBase;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(x1, boxTop); ctx.lineTo(x1, boxBottom); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2, boxTop); ctx.lineTo(x2, boxBottom); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // ─── Horizontal lines ────────────────────────────────────────────
    ctx.strokeStyle = tpBase;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x1, targetY); ctx.lineTo(x2, targetY); ctx.stroke();
    ctx.strokeStyle = lineBase;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x1, entryY); ctx.lineTo(x2, entryY); ctx.stroke();
    ctx.strokeStyle = slBase;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x1, stopY); ctx.lineTo(x2, stopY); ctx.stroke();

    const shouldShowLabels = showLabels || (drawing.style as any).alwaysShowStats === true;

    if (shouldShowLabels) {

      // ─── Helper: text wrapping ─────────────────────────────────────────
      const wrapText = (txt: string, maxW: number): string[] => {
        const words = txt.split(/\s+/).filter(Boolean);
        const lines: string[] = [];
        let currentLine = words[0] || '';
        for (let i = 1; i < words.length; i++) {
          const word = words[i];
          if (ctx.measureText(currentLine + " " + word).width <= maxW) {
            currentLine += " " + word;
          } else {
            lines.push(currentLine);
            currentLine = word;
          }
        }
        if (currentLine) lines.push(currentLine);
        return lines;
      };

      const maxBadgeWidth = Math.max(Math.abs(x2 - x1) - 10, 40);

      // ─── Helper: draw info badge ────────────────────────────────────
      const drawBadge = (text: string, bx: number, by: number, bgColor: string, txtColor: string, anchor: 'above' | 'below' | 'vcenter') => {
        ctx.font = `bold 10.5px 'Roboto Mono', monospace`;
        const padX = 7, padY = 4, lineHeight = 14;
        const lines = wrapText(text, maxBadgeWidth);
        const maxLineWidth = Math.max(...lines.map((l) => ctx.measureText(l).width), 20);
        const bw = maxLineWidth + padX * 2;
        const bh = lines.length * lineHeight + padY * 2;
        const rx = bx - bw / 2;
        const ry = anchor === 'above' ? by - bh - 4
                 : anchor === 'below' ? by + 4
                 :                      by - bh / 2;
        ctx.globalAlpha = 0.93;
        ctx.fillStyle = bgColor;
        ctx.beginPath();
        (ctx as any).roundRect(rx, ry, bw, bh, 3);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = txtColor;
        lines.forEach((line, index) => {
          ctx.fillText(line, rx + padX, ry + padY + 10 + index * lineHeight);
        });
      };

      const midX = (x1 + x2) / 2;
      const tpAnchor = targetY < entryY ? 'above' : 'below';
      const slAnchor = stopY < entryY ? 'above' : 'below';

      // Target badge — dark bg, tpBase text
      const tpLabel = `Target: ${targetPrice.toFixed(3)} (${tpPct.toFixed(3)}%) ${(tpPips * pipsUnit).toFixed(1)}`;
      drawBadge(tpLabel, midX, targetY, '#071412', tpBase, tpAnchor);

      // Stop badge — dark bg, slBase text
      const slLabel = `Stop: ${stopPrice.toFixed(3)} (${slPct.toFixed(3)}%) ${(slPips * pipsUnit).toFixed(1)}`;
      drawBadge(slLabel, midX, stopY, '#071412', slBase, slAnchor);

      // Entry badge — tpBase bg, dark text; color reflects R:R quality
      const rrBg    = rr >= 2 ? tpBase : rr >= 1 ? '#f59e0b' : '#f87171';
      const entryLabel = `${entryPrice.toFixed(3)} Rasio R:R: ${rr.toFixed(2)}`;
      drawBadge(entryLabel, midX, entryY, rrBg, '#071412', 'vcenter');
    }
  }

  private drawMeasurement(ctx: CanvasRenderingContext2D, drawing: DrawingObject, rc: RenderContext): void {
    if (drawing.points.length < 2) return;
    const x1 = rc.timeToX(drawing.points[0].time), y1 = rc.priceToY(drawing.points[0].price);
    const x2 = rc.timeToX(drawing.points[1].time), y2 = rc.priceToY(drawing.points[1].price);
    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);

    ctx.globalAlpha = 0.15;
    ctx.fillStyle = drawing.style.color || '#4f86f7';
    ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
    ctx.globalAlpha = (drawing.style.opacity ?? 100) / 100;

    ctx.strokeStyle = drawing.style.color || '#4f86f7';
    ctx.lineWidth = drawing.style.lineWidth || 1.5;
    ctx.setLineDash([6, 3]);
    ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
    ctx.setLineDash([]);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const p1 = drawing.points[0], p2 = drawing.points[1];
    let label = '';

    if (drawing.type === 'date-range') {
      const timeDiff = Math.abs(p2.time - p1.time);
      const barCount = Math.max(1, Math.round(timeDiff / 86400));
      label = `${barCount} Bars, ${barCount} Days`;
    } else if (drawing.type === 'price-range') {
      const priceDiff = p2.price - p1.price;
      const absDiff = Math.abs(priceDiff);
      const pipsMult = p1.price > 50 ? 100 : 10000;
      const pips = (absDiff * pipsMult).toFixed(1);
      const pct = ((priceDiff / (p1.price || 1)) * 100).toFixed(2);
      const sign = priceDiff >= 0 ? '+' : '';
      label = `${sign}${pips} Pips (${sign}${pct}%)`;
    } else {
      const timeDiff = Math.abs(p2.time - p1.time);
      const barCount = Math.max(1, Math.round(timeDiff / 86400));
      const priceDiff = p2.price - p1.price;
      const absDiff = Math.abs(priceDiff);
      const pipsMult = p1.price > 50 ? 100 : 10000;
      const pips = (absDiff * pipsMult).toFixed(1);
      const pct = ((priceDiff / (p1.price || 1)) * 100).toFixed(2);
      const sign = priceDiff >= 0 ? '+' : '';
      label = `${barCount} Bars, ${barCount}D | ${sign}${pips} Pips (${sign}${pct}%)`;
    }

    ctx.font = 'bold 11px var(--font-mono)';
    const textWidth = ctx.measureText(label).width;
    const padX = 8;
    const bw = textWidth + padX * 2;
    const bh = 22;
    const bx = centerX - bw / 2;
    const by = centerY - bh / 2;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = drawing.style.color || '#4f86f7';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if ((ctx as any).roundRect) {
      (ctx as any).roundRect(bx, by, bw, bh, 4);
    } else {
      ctx.rect(bx, by, bw, bh);
    }
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, centerX, centerY);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }

  private drawFibRetracement(ctx: CanvasRenderingContext2D, drawing: DrawingObject, rc: RenderContext): void {
    if (drawing.points.length < 2) return;
    const p1 = drawing.points[0], p2 = drawing.points[1];
    const x1 = rc.timeToX(p1.time), y1 = rc.priceToY(p1.price);
    const x2 = rc.timeToX(p2.time), y2 = rc.priceToY(p2.price);

    const baseOpacity = (drawing.style.opacity ?? 100) / 100;
    const showTrendline = (drawing.style as any).showTrendline !== false;
    const trendlineColor = (drawing.style as any).trendlineColor || drawing.style.color || '#ffffff';
    const trendlineStyle = (drawing.style as any).trendlineStyle || 'dashed';
    const trendlineWidth = (drawing.style as any).trendlineWidth || 1;

    // 1. Draw Trendline / Guideline between P1 and P2
    if (showTrendline) {
      ctx.strokeStyle = trendlineColor;
      ctx.lineWidth = trendlineWidth;
      ctx.globalAlpha = baseOpacity * 0.8;
      if (trendlineStyle === 'solid') ctx.setLineDash([]);
      else if (trendlineStyle === 'dotted') ctx.setLineDash([2, 3]);
      else ctx.setLineDash([4, 3]);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const rawLevels = (drawing.style as any).fibLevels ?? drawing.style.levels ?? [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];
    const defaultColors = ['#787b86', '#f23645', '#ff9800', '#4caf50', '#089981', '#00bcd4', '#787b86', '#2962ff', '#9c27b0', '#e91e63', '#673ab7'];

    const parsedLevels = rawLevels.map((item: any, idx: number) => {
      if (typeof item === 'number') {
        return { level: item, color: defaultColors[idx % defaultColors.length], enabled: true, lineWidth: drawing.style.lineWidth || 1, lineStyle: drawing.style.lineStyle || 'solid' };
      }
      return {
        level: Number.isFinite(item.level) ? item.level : 0,
        color: item.color || defaultColors[idx % defaultColors.length],
        enabled: item.enabled !== false,
        lineWidth: item.lineWidth ?? drawing.style.lineWidth ?? 1,
        lineStyle: item.lineStyle ?? drawing.style.lineStyle ?? 'solid',
      };
    }).filter((l: any) => l.enabled !== false);

    const reverse = Boolean((drawing.style as any).reverse);
    const priceRange = reverse ? (p1.price - p2.price) : (p2.price - p1.price);
    const basePrice = reverse ? p2.price : p1.price;

    const extendOption = (drawing.style as any).extend || 'none';
    let minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
    if (extendOption === 'right') {
      maxX = Math.max(maxX, rc.width);
    } else if (extendOption === 'left') {
      minX = 0;
    } else if (extendOption === 'both') {
      minX = 0;
      maxX = rc.width;
    }

    const fillEnabled = drawing.style.fillEnabled !== false;
    const fillOpacity = ((drawing.style.fillOpacity ?? 20) / 100) * baseOpacity;

    // Optional background fill between consecutive levels
    if (fillEnabled && parsedLevels.length > 1) {
      // Sort by level value for continuous gradient/bands
      const sorted = [...parsedLevels].sort((a, b) => a.level - b.level);
      for (let i = 0; i < sorted.length - 1; i++) {
        const lA = sorted[i];
        const lB = sorted[i + 1];
        const yA = rc.priceToY(basePrice + priceRange * lA.level);
        const yB = rc.priceToY(basePrice + priceRange * lB.level);
        ctx.fillStyle = lA.color;
        ctx.globalAlpha = fillOpacity;
        ctx.fillRect(minX, Math.min(yA, yB), maxX - minX, Math.abs(yB - yA));
      }
    }

    const showPrices = (drawing.style as any).showPrices !== false;
    const showLevels = (drawing.style as any).showLevels !== false;
    const labelFormat = (drawing.style as any).labelFormat || 'percent';
    const labelPos = (drawing.style as any).labelPosition || 'right';
    const labelValign = (drawing.style as any).labelValign || 'above';
    const fontSize = Number((drawing.style as any).fontSize) || 12;

    parsedLevels.forEach(({ level, color, lineWidth, lineStyle }: any) => {
      const price = basePrice + priceRange * level;
      const y = rc.priceToY(price);
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth || 1;
      ctx.globalAlpha = baseOpacity * 0.85;

      if (lineStyle === 'solid') ctx.setLineDash([]);
      else if (lineStyle === 'dotted') ctx.setLineDash([2, 3]);
      else ctx.setLineDash([4, 2]);

      ctx.beginPath();
      ctx.moveTo(minX, y);
      ctx.lineTo(maxX, y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Construct text label (e.g. "61.8% (1.2345)" or "0.618 (1.2345)")
      const parts: string[] = [];
      if (showLevels) {
        parts.push(labelFormat === 'percent' ? `${(level * 100).toFixed(1)}%` : `${level}`);
      }
      if (showPrices) {
        parts.push(`(${price.toFixed(5)})`);
      }
      const labelText = parts.join(' ');

      if (labelText) {
        ctx.font = `${fontSize}px var(--font-mono, sans-serif)`;
        ctx.fillStyle = color;
        ctx.globalAlpha = baseOpacity;

        let labelX = maxX + 4;
        let textAlign: CanvasTextAlign = 'left';
        if (labelPos === 'left') {
          labelX = minX - 4;
          textAlign = 'right';
        } else if (labelPos === 'center') {
          labelX = (minX + maxX) / 2;
          textAlign = 'center';
        }

        let labelY = y - 3;
        let textBaseline: CanvasTextBaseline = 'bottom';
        if (labelValign === 'below') {
          labelY = y + 3;
          textBaseline = 'top';
        } else if (labelValign === 'center') {
          labelY = y;
          textBaseline = 'middle';
        }

        ctx.textAlign = textAlign;
        ctx.textBaseline = textBaseline;
        ctx.fillText(labelText, labelX, labelY);
      }
    });
    ctx.globalAlpha = baseOpacity;
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }

  private drawFibExtension(ctx: CanvasRenderingContext2D, drawing: DrawingObject, rc: RenderContext): void {
    if (drawing.points.length < 2) return;
    const p1 = drawing.points[0];
    const p2 = drawing.points[1];
    const p3 = drawing.points.length >= 3 ? drawing.points[2] : p2;

    const x1 = rc.timeToX(p1.time), y1 = rc.priceToY(p1.price);
    const x2 = rc.timeToX(p2.time), y2 = rc.priceToY(p2.price);
    const x3 = rc.timeToX(p3.time), y3 = rc.priceToY(p3.price);

    const priceDelta = p2.price - p1.price;
    const baseOpacity = (drawing.style.opacity ?? 100) / 100;

    // Draw dashed trend guidelines A -> B -> C
    ctx.strokeStyle = drawing.style.color || '#4f86f7';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    if (drawing.points.length >= 3) {
      ctx.lineTo(x3, y3);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    const rawLevels = (drawing.style as any).fibLevels ?? drawing.style.levels ?? [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0, 1.272, 1.618, 2.0, 2.618, 4.236];
    const defaultColors = ['#787b86', '#f23645', '#ff9800', '#4caf50', '#089981', '#00bcd4', '#787b86', '#2962ff', '#9c27b0', '#e91e63', '#673ab7', '#3f51b5'];

    const parsedLevels = rawLevels.map((item: any, idx: number) => {
      if (typeof item === 'number') {
        return { level: item, color: defaultColors[idx % defaultColors.length], enabled: true, lineWidth: 1, lineStyle: 'dashed' };
      }
      return {
        level: Number.isFinite(item.level) ? item.level : 0,
        color: item.color || defaultColors[idx % defaultColors.length],
        enabled: item.enabled !== false,
        lineWidth: item.lineWidth ?? 1,
        lineStyle: item.lineStyle ?? 'dashed',
      };
    }).filter((l: any) => l.enabled !== false);

    const startX = drawing.points.length >= 3 ? Math.min(x1, x3) : Math.min(x1, x2);
    const endX = Math.max(x1, x2, x3) + Math.max(Math.abs(x2 - x1), 150);

    // Optional background fill between consecutive levels
    if (drawing.style.fillEnabled && parsedLevels.length > 1) {
      for (let i = 0; i < parsedLevels.length - 1; i++) {
        const lA = parsedLevels[i];
        const lB = parsedLevels[i + 1];
        const yA = rc.priceToY(p3.price + priceDelta * lA.level);
        const yB = rc.priceToY(p3.price + priceDelta * lB.level);
        ctx.fillStyle = lA.color;
        ctx.globalAlpha = ((drawing.style.fillOpacity ?? 8) / 100) * baseOpacity;
        ctx.fillRect(startX, Math.min(yA, yB), endX - startX, Math.abs(yB - yA));
      }
    }

    parsedLevels.forEach(({ level, color, lineWidth, lineStyle }: any) => {
      const projPrice = p3.price + priceDelta * level;
      const y = rc.priceToY(projPrice);

      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth || 1;
      ctx.globalAlpha = baseOpacity * 0.85;

      if (lineStyle === 'solid') ctx.setLineDash([]);
      else if (lineStyle === 'dotted') ctx.setLineDash([2, 3]);
      else ctx.setLineDash([4, 2]);

      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = '10px var(--font-mono)';
      ctx.fillStyle = color;
      ctx.globalAlpha = baseOpacity;
      ctx.fillText(`${(level * 100).toFixed(1)}% (${projPrice.toFixed(5)})`, endX + 4, y + 3);
    });
    ctx.globalAlpha = baseOpacity;
  }

  private drawFibChannel(ctx: CanvasRenderingContext2D, drawing: DrawingObject, rc: RenderContext): void {
    if (drawing.points.length < 2) return;
    const p1 = drawing.points[0];
    const p2 = drawing.points[1];
    const p3 = drawing.points.length >= 3 ? drawing.points[2] : null;

    const dt = p2.time - p1.time;
    const dp = p2.price - p1.price;

    const time3 = p3 ? p3.time : p1.time + dt * 0.5;
    const price3 = p3 ? p3.price : p1.price + dp * 0.5 + (dp !== 0 ? Math.abs(dp) * 0.3 : 10);
    const basePriceAtT3 = dt !== 0 ? p1.price + dp * ((time3 - p1.time) / dt) : p1.price;
    const offsetDeltaPrice = price3 - basePriceAtT3;

    const rawLevels = (drawing.style as any).fibLevels ?? drawing.style.levels ?? [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0, 1.618, 2.618, 4.236];
    const defaultColors = ['#787b86', '#f23645', '#ff9800', '#4caf50', '#089981', '#00bcd4', '#787b86', '#2962ff', '#9c27b0', '#e91e63'];
    const baseOpacity = (drawing.style.opacity ?? 100) / 100;

    const parsedLevels = rawLevels.map((item: any, idx: number) => {
      if (typeof item === 'number') {
        return { level: item, color: defaultColors[idx % defaultColors.length], enabled: true, lineWidth: 1, lineStyle: 'dashed' };
      }
      return {
        level: Number.isFinite(item.level) ? item.level : 0,
        color: item.color || defaultColors[idx % defaultColors.length],
        enabled: item.enabled !== false,
        lineWidth: item.lineWidth ?? 1,
        lineStyle: item.lineStyle ?? 'dashed',
      };
    }).filter((l: any) => l.enabled !== false);

    // Baseline guideline to C
    if (p3) {
      const x1 = rc.timeToX(p1.time), y1 = rc.priceToY(p1.price);
      const x3 = rc.timeToX(p3.time), y3 = rc.priceToY(p3.price);
      ctx.strokeStyle = drawing.style.color || '#4f86f7';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x3, y3);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    parsedLevels.forEach(({ level, color, lineWidth, lineStyle }: any) => {
      const startPrice = p1.price + offsetDeltaPrice * level;
      const endPrice = p2.price + offsetDeltaPrice * level;

      const sx1 = rc.timeToX(p1.time), sy1 = rc.priceToY(startPrice);
      const sx2 = rc.timeToX(p2.time), sy2 = rc.priceToY(endPrice);

      let lineStart = { x: sx1, y: sy1 };
      let lineEnd = { x: sx2, y: sy2 };

      if (drawing.style.extend === 'both' || drawing.style.extend === 'right') {
        const kind = drawing.style.extend === 'both' ? 'infinite' : 'ray';
        const clipped = clipLineToRect(sx1, sy1, sx2, sy2, rc.width, rc.height, kind);
        lineStart = { x: clipped.x1, y: clipped.y1 };
        lineEnd = { x: clipped.x2, y: clipped.y2 };
      }

      ctx.strokeStyle = color;
      ctx.lineWidth = level === 0 || level === 1 ? (lineWidth || 1.5) : (lineWidth || 1);
      ctx.globalAlpha = baseOpacity * 0.85;

      if (lineStyle === 'solid' || level === 0 || level === 1) ctx.setLineDash([]);
      else if (lineStyle === 'dotted') ctx.setLineDash([2, 3]);
      else ctx.setLineDash([4, 2]);

      ctx.beginPath();
      ctx.moveTo(lineStart.x, lineStart.y);
      ctx.lineTo(lineEnd.x, lineEnd.y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = '10px var(--font-mono)';
      ctx.fillStyle = color;
      ctx.globalAlpha = baseOpacity;
      ctx.fillText(`${(level * 100).toFixed(1)}%`, lineEnd.x + 4, lineEnd.y + 3);
    });
    ctx.globalAlpha = baseOpacity;
  }

  private drawFibTimeZone(ctx: CanvasRenderingContext2D, drawing: DrawingObject, rc: RenderContext): void {
    if (drawing.points.length < 2) return;
    const p1 = drawing.points[0];
    const p2 = drawing.points[1];
    const t1 = p1.time;
    const t2 = p2.time;
    const step = (t2 - t1) || 86400;

    const x1 = rc.timeToX(t1);
    const x2 = rc.timeToX(t2);
    const y1 = rc.priceToY(p1.price);
    const y2 = rc.priceToY(p2.price);

    const baseColor = drawing.style.color || '#4f86f7';
    const baseOpacity = (drawing.style.opacity ?? 100) / 100;

    // Guideline between definition anchors
    ctx.strokeStyle = baseColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);

    const rawLevels = (drawing.style as any).fibLevels ?? drawing.style.levels ?? [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377];
    const defaultColors = ['#787b86', '#2962ff', '#f23645', '#ff9800', '#4caf50', '#089981', '#00bcd4', '#9c27b0', '#e91e63', '#673ab7'];

    const parsedLevels = rawLevels.map((item: any, idx: number) => {
      if (typeof item === 'number') {
        return { level: item, color: defaultColors[idx % defaultColors.length], enabled: true, lineWidth: 1, lineStyle: 'dashed' };
      }
      return {
        level: Number.isFinite(item.level) ? item.level : 0,
        color: item.color || defaultColors[idx % defaultColors.length],
        enabled: item.enabled !== false,
        lineWidth: item.lineWidth ?? 1,
        lineStyle: item.lineStyle ?? 'dashed',
      };
    }).filter((l: any) => l.enabled !== false);

    parsedLevels.forEach(({ level, color, lineWidth, lineStyle }: any) => {
      const t = t1 + step * level;
      const x = rc.timeToX(t);
      if (x < -100 || x > rc.width + 100) return;

      ctx.strokeStyle = color || baseColor;
      ctx.lineWidth = level === 0 || level === 1 ? (lineWidth || 1.5) : (lineWidth || 1);
      ctx.globalAlpha = baseOpacity * 0.7;

      if (lineStyle === 'solid') ctx.setLineDash([]);
      else if (lineStyle === 'dotted') ctx.setLineDash([2, 3]);
      else ctx.setLineDash([4, 2]);

      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, rc.height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Top pill badge
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.beginPath();
      if ((ctx as any).roundRect) {
        (ctx as any).roundRect(x - 14, 8, 28, 16, 3);
      } else {
        ctx.rect(x - 14, 8, 28, 16);
      }
      ctx.fill();
      ctx.strokeStyle = color || baseColor;
      ctx.stroke();

      ctx.font = 'bold 9.5px var(--font-mono)';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.globalAlpha = 1;
      ctx.fillText(`${level}`, x, 20);
      ctx.textAlign = 'start';
    });
    ctx.globalAlpha = baseOpacity;
  }

  private drawFibFan(ctx: CanvasRenderingContext2D, drawing: DrawingObject, rc: RenderContext): void {
    if (drawing.points.length < 2) return;
    const p1 = drawing.points[0];
    const p2 = drawing.points[1];
    const x1 = rc.timeToX(p1.time), y1 = rc.priceToY(p1.price);
    const x2 = rc.timeToX(p2.time), y2 = rc.priceToY(p2.price);

    const deltaPrice = p2.price - p1.price;
    const baseOpacity = (drawing.style.opacity ?? 100) / 100;

    // Draw baseline guideline A -> B
    ctx.strokeStyle = drawing.style.color || '#4f86f7';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);

    const rawLevels = (drawing.style as any).fibLevels ?? drawing.style.levels ?? [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0, 1.618, 2.618, 4.236];
    const defaultColors = ['#787b86', '#f23645', '#ff9800', '#4caf50', '#089981', '#00bcd4', '#787b86', '#2962ff', '#9c27b0', '#e91e63'];

    const parsedLevels = rawLevels.map((item: any, idx: number) => {
      if (typeof item === 'number') {
        return { level: item, color: defaultColors[idx % defaultColors.length], enabled: true, lineWidth: 1, lineStyle: 'dashed' };
      }
      return {
        level: Number.isFinite(item.level) ? item.level : 0,
        color: item.color || defaultColors[idx % defaultColors.length],
        enabled: item.enabled !== false,
        lineWidth: item.lineWidth ?? 1,
        lineStyle: item.lineStyle ?? 'dashed',
      };
    }).filter((l: any) => l.enabled !== false);

    parsedLevels.forEach(({ level, color, lineWidth, lineStyle }: any) => {
      const targetPrice = p1.price + deltaPrice * level;
      const tx = rc.timeToX(p2.time);
      const ty = rc.priceToY(targetPrice);

      const ray = clipLineToRect(x1, y1, tx, ty, rc.width, rc.height, 'ray');

      ctx.strokeStyle = color;
      ctx.lineWidth = level === 1.0 ? (lineWidth || 1.5) : (lineWidth || 1);
      ctx.globalAlpha = baseOpacity * 0.85;

      if (lineStyle === 'solid' || level === 1.0) ctx.setLineDash([]);
      else if (lineStyle === 'dotted') ctx.setLineDash([2, 3]);
      else ctx.setLineDash([4, 2]);

      ctx.beginPath();
      ctx.moveTo(ray.x1, ray.y1);
      ctx.lineTo(ray.x2, ray.y2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = '10px var(--font-mono)';
      ctx.fillStyle = color;
      ctx.globalAlpha = baseOpacity;
      ctx.fillText(`${(level * 100).toFixed(1)}%`, tx + 4, ty + 3);
    });
    ctx.globalAlpha = baseOpacity;
  }

  private drawGannBox(ctx: CanvasRenderingContext2D, drawing: DrawingObject, rc: RenderContext): void {
    if (drawing.points.length < 2) return;
    const p1 = drawing.points[0];
    const p2 = drawing.points[1];

    const tMin = Math.min(p1.time, p2.time);
    const tMax = Math.max(p1.time, p2.time);
    const dt = tMax - tMin;

    const pMin = Math.min(p1.price, p2.price);
    const pMax = Math.max(p1.price, p2.price);
    const dp = pMax - pMin;

    const x1 = rc.timeToX(tMin);
    const x2 = rc.timeToX(tMax);
    const yTop = rc.priceToY(pMax);
    const yBottom = rc.priceToY(pMin);

    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
    const minY = Math.min(yTop, yBottom), maxY = Math.max(yTop, yBottom);
    const w = maxX - minX, h = maxY - minY;

    const baseColor = drawing.style.color || '#2962ff';
    const baseOpacity = (drawing.style.opacity ?? 100) / 100;
    const reverse = (drawing.style as any).reverse ?? false;

    // Price Levels configuration
    const defaultPriceLevels = [
      { level: 0, color: '#787b86', enabled: true },
      { level: 0.382, color: '#00897b', enabled: false },
      { level: 0.618, color: '#00695c', enabled: false },
      { level: 1, color: '#787b86', enabled: true },
      { level: 0.25, color: '#b7791f', enabled: false },
      { level: 0.5, color: '#4caf50', enabled: true },
      { level: 0.75, color: '#2962ff', enabled: false },
    ];
    const priceLevels: Array<{ level: number; color: string; enabled: boolean }> =
      (drawing.style as any).priceLevels || (drawing.style as any).fibLevels || defaultPriceLevels;

    // Time Levels configuration
    const defaultTimeLevels = [
      { level: 0, color: '#787b86', enabled: false },
      { level: 0.382, color: '#00897b', enabled: false },
      { level: 0.618, color: '#00695c', enabled: false },
      { level: 1, color: '#787b86', enabled: false },
      { level: 0.25, color: '#b7791f', enabled: false },
      { level: 0.5, color: '#4caf50', enabled: false },
      { level: 0.75, color: '#2962ff', enabled: false },
    ];
    const timeLevels: Array<{ level: number; color: string; enabled: boolean }> =
      (drawing.style as any).timeLevels || defaultTimeLevels;

    const showLeftLabels = (drawing.style as any).showLeftLabels ?? true;
    const showRightLabels = (drawing.style as any).showRightLabels ?? true;
    const showTopLabels = (drawing.style as any).showTopLabels ?? true;
    const showBottomLabels = (drawing.style as any).showBottomLabels ?? true;

    const priceFillEnabled = (drawing.style as any).priceFillEnabled ?? drawing.style.fillEnabled ?? true;
    const priceFillOpacity = ((drawing.style as any).priceFillOpacity ?? drawing.style.fillOpacity ?? 20) / 100;
    const timeFillEnabled = (drawing.style as any).timeFillEnabled ?? false;
    const timeFillOpacity = ((drawing.style as any).timeFillOpacity ?? 20) / 100;

    const showCorners = Boolean((drawing.style as any).showCorners || (drawing.style as any).showSudut);
    const cornersColor = (drawing.style as any).cornersColor || '#787b86';

    // 1. Background Fill (Price fill)
    if (priceFillEnabled && priceFillOpacity > 0) {
      ctx.fillStyle = drawing.style.fillColor || baseColor;
      ctx.globalAlpha = priceFillOpacity * baseOpacity * 0.4;
      ctx.fillRect(minX, minY, w, h);
    }

    // 2. Time Fill (Vertical gradient / strips if time fill enabled)
    if (timeFillEnabled && timeFillOpacity > 0) {
      ctx.fillStyle = '#2962ff';
      ctx.globalAlpha = timeFillOpacity * baseOpacity * 0.3;
      ctx.fillRect(minX, minY, w, h);
    }

    // 3. Vertical time division lines & labels
    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, sans-serif';
    timeLevels.forEach((item) => {
      if (!item.enabled) return;
      const r = item.level;
      const effectiveRatio = reverse ? (1 - r) : r;
      const vt = tMin + dt * effectiveRatio;
      const vx = rc.timeToX(vt);

      ctx.strokeStyle = item.color || baseColor;
      ctx.lineWidth = r === 0 || r === 1 || r === 0.5 ? 1.2 : 1;
      ctx.globalAlpha = r === 0 || r === 1 ? baseOpacity * 0.9 : baseOpacity * 0.55;
      if (r === 0 || r === 1) ctx.setLineDash([]);
      else if (r === 0.5) ctx.setLineDash([4, 2]);
      else ctx.setLineDash([2, 3]);

      ctx.beginPath();
      ctx.moveTo(vx, minY);
      ctx.lineTo(vx, maxY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Top label
      if (showTopLabels) {
        ctx.fillStyle = item.color || baseColor;
        ctx.globalAlpha = baseOpacity * 0.9;
        ctx.textAlign = 'center';
        ctx.fillText(`${r}`, vx, minY - 4);
      }

      // Bottom label
      if (showBottomLabels) {
        ctx.fillStyle = item.color || baseColor;
        ctx.globalAlpha = baseOpacity * 0.9;
        ctx.textAlign = 'center';
        ctx.fillText(`${r}`, vx, maxY + 12);
      }
    });

    // 4. Horizontal price division lines & labels
    priceLevels.forEach((item) => {
      if (!item.enabled) return;
      const r = item.level;
      const effectiveRatio = reverse ? (1 - r) : r;
      const hp = pMin + dp * effectiveRatio;
      const hy = rc.priceToY(hp);

      ctx.strokeStyle = item.color || baseColor;
      ctx.lineWidth = r === 0 || r === 1 || r === 0.5 ? 1.2 : 1;
      ctx.globalAlpha = r === 0 || r === 1 ? baseOpacity * 0.9 : baseOpacity * 0.55;
      if (r === 0 || r === 1) ctx.setLineDash([]);
      else if (r === 0.5) ctx.setLineDash([4, 2]);
      else ctx.setLineDash([2, 3]);

      ctx.beginPath();
      ctx.moveTo(minX, hy);
      ctx.lineTo(maxX, hy);
      ctx.stroke();
      ctx.setLineDash([]);

      // Left label
      if (showLeftLabels) {
        ctx.fillStyle = item.color || baseColor;
        ctx.globalAlpha = baseOpacity * 0.9;
        ctx.textAlign = 'right';
        ctx.fillText(`${r}`, minX - 4, hy + 3);
      }

      // Right label (level + price value)
      if (showRightLabels) {
        ctx.fillStyle = item.color || baseColor;
        ctx.globalAlpha = baseOpacity * 0.9;
        ctx.textAlign = 'left';
        ctx.fillText(`${r} (${hp.toFixed(5)})`, maxX + 4, hy + 3);
      }
    });

    // 5. Sudut-Sudut (Corners / Diagonals)
    if (showCorners) {
      ctx.strokeStyle = cornersColor;
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = baseOpacity * 0.7;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(minX, minY);
      ctx.lineTo(maxX, maxY);
      ctx.moveTo(minX, maxY);
      ctx.lineTo(maxX, minY);
      ctx.stroke();

      // Secondary mid diagonals (Gann 2x1 / 1x2 intersections)
      const midX = (minX + maxX) / 2;
      const midY = (minY + maxY) / 2;
      ctx.globalAlpha = baseOpacity * 0.4;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(minX, midY); ctx.lineTo(midX, minY);
      ctx.moveTo(midX, minY); ctx.lineTo(maxX, midY);
      ctx.moveTo(maxX, midY); ctx.lineTo(midX, maxY);
      ctx.moveTo(midX, maxY); ctx.lineTo(minX, midY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 6. Outer Rectangle Box Border
    ctx.strokeStyle = baseColor;
    ctx.lineWidth = drawing.style.lineWidth || 1.5;
    ctx.globalAlpha = baseOpacity;
    ctx.strokeRect(minX, minY, w, h);
  }

  private drawGannFan(ctx: CanvasRenderingContext2D, drawing: DrawingObject, rc: RenderContext): void {
    if (drawing.points.length < 2) return;
    const p1 = drawing.points[0];
    const p2 = drawing.points[1];

    const ox = rc.timeToX(p1.time);
    const oy = rc.priceToY(p1.price);
    const txBase = rc.timeToX(p2.time);
    const deltaPrice = p2.price - p1.price;

    const baseOpacity = (drawing.style.opacity ?? 100) / 100;
    const baseColor = drawing.style.color || '#2962ff';

    const gannAngles: Array<{ r: number; label: string; color: string }> = [
      { r: 1 / 8, label: '1x8', color: '#787b86' },
      { r: 1 / 4, label: '1x4', color: '#ff9800' },
      { r: 1 / 3, label: '1x3', color: '#ffeb3b' },
      { r: 1 / 2, label: '1x2', color: '#4caf50' },
      { r: 1,     label: '1x1', color: baseColor },
      { r: 2,     label: '2x1', color: '#00bcd4' },
      { r: 3,     label: '3x1', color: '#9c27b0' },
      { r: 4,     label: '4x1', color: '#e91e63' },
      { r: 8,     label: '8x1', color: '#f23645' },
    ];

    gannAngles.forEach(({ r, label, color }) => {
      const targetPrice = p1.price + deltaPrice * r;
      const ty = rc.priceToY(targetPrice);

      const ray = clipLineToRect(ox, oy, txBase, ty, rc.width, rc.height, 'ray');

      ctx.strokeStyle = color;
      ctx.lineWidth = label === '1x1' ? 2 : 1;
      ctx.globalAlpha = label === '1x1' ? baseOpacity : baseOpacity * 0.75;

      if (label === '1x1') ctx.setLineDash([]);
      else ctx.setLineDash([4, 2]);

      ctx.beginPath();
      ctx.moveTo(ray.x1, ray.y1);
      ctx.lineTo(ray.x2, ray.y2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = 'bold 9.5px var(--font-mono)';
      ctx.fillStyle = color;
      ctx.globalAlpha = baseOpacity;
      ctx.fillText(label, txBase + 4, ty + 3);
    });
    ctx.globalAlpha = baseOpacity;
  }

  private drawChannel(ctx: CanvasRenderingContext2D, drawing: DrawingObject, rc: RenderContext): void {
    if (drawing.points.length < 2) return;
    const x1 = rc.timeToX(drawing.points[0].time), y1 = rc.priceToY(drawing.points[0].price);
    const x2 = rc.timeToX(drawing.points[1].time), y2 = rc.priceToY(drawing.points[1].price);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    if (drawing.points.length >= 3) {
      const x3 = rc.timeToX(drawing.points[2].time), y3 = rc.priceToY(drawing.points[2].price);
      const dx = x2 - x1, dy = y2 - y1;
      ctx.setLineDash([6, 3]);
      ctx.beginPath(); ctx.moveTo(x3, y3); ctx.lineTo(x3 + dx, y3 + dy); ctx.stroke();
      ctx.setLineDash([]);
      // Fill channel area
      ctx.globalAlpha = 0.07;
      ctx.fillStyle = drawing.style.color;
      ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.lineTo(x3 + dx, y3 + dy); ctx.lineTo(x3, y3);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = drawing.style.opacity / 100;
    }
  }

  private drawText(ctx: CanvasRenderingContext2D, drawing: DrawingObject, rc: RenderContext): void {
    if (drawing.points.length === 0) return;
    const fontSize = Number((drawing.style as any).fontSize) || Number(drawing.style.fontSize) || 14;
    const textColor = (drawing.style as any).textColor || drawing.style.color || '#ffffff';
    const isBold = Boolean((drawing.style as any).bold);
    const isItalic = Boolean((drawing.style as any).italic);
    const fontStyle = isItalic ? 'italic' : 'normal';
    const fontWeight = isBold ? 'bold' : 'normal';
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif`;
    ctx.fillStyle = textColor;
    ctx.globalAlpha = (drawing.style.opacity ?? 100) / 100;
    const x = rc.timeToX(drawing.points[0].time);
    const y = rc.priceToY(drawing.points[0].price);
    const lines = (drawing.text || 'Text').split('\n');
    const lineHeight = fontSize * 1.25;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], x, y + i * lineHeight);
    }
  }

  private drawAnchor(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const rx = Math.round(x);
    const ry = Math.round(y);
    ctx.setLineDash([]);
    ctx.strokeStyle = '#2962ff';
    ctx.lineWidth = 2;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(rx, ry, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  private drawSelection(ctx: CanvasRenderingContext2D, drawing: DrawingObject, rc: RenderContext): void {
    if (drawing.type === 'rectangle' && drawing.points.length >= 2) {
      const x1 = rc.timeToX(drawing.points[0].time);
      const y1 = rc.priceToY(drawing.points[0].price);
      const x2 = rc.timeToX(drawing.points[1].time);
      const y2 = rc.priceToY(drawing.points[1].price);

      const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
      const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
      const midX = (minX + maxX) / 2;
      const midY = (minY + maxY) / 2;

      this.drawAnchor(ctx, minX, minY); // 0: NW
      this.drawAnchor(ctx, midX, minY); // 1: N
      this.drawAnchor(ctx, maxX, minY); // 2: NE
      this.drawAnchor(ctx, maxX, midY); // 3: E
      this.drawAnchor(ctx, maxX, maxY); // 4: SE
      this.drawAnchor(ctx, midX, maxY); // 5: S
      this.drawAnchor(ctx, minX, maxY); // 6: SW
      this.drawAnchor(ctx, minX, midY); // 7: W
    } else if (drawing.type === 'rotated-rectangle' && drawing.points.length >= 2) {
      const p1 = { x: rc.timeToX(drawing.points[0].time), y: rc.priceToY(drawing.points[0].price) };
      const p2 = { x: rc.timeToX(drawing.points[1].time), y: rc.priceToY(drawing.points[1].price) };
      const p3 = drawing.points.length >= 3
        ? { x: rc.timeToX(drawing.points[2].time), y: rc.priceToY(drawing.points[2].price) }
        : p2;
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy);
      const nx = len > 0.0001 ? -dy / len : 0;
      const ny = len > 0.0001 ? dx / len : 1;
      const h = (p3.x - p1.x) * nx + (p3.y - p1.y) * ny;

      this.drawAnchor(ctx, p1.x, p1.y);
      this.drawAnchor(ctx, p2.x, p2.y);
      this.drawAnchor(ctx, p2.x + nx * h, p2.y + ny * h);
      this.drawAnchor(ctx, p1.x + nx * h, p1.y + ny * h);
    } else if ((drawing.type === 'long-position' || drawing.type === 'short-position') && drawing.points.length >= 3) {
      const leftX   = rc.timeToX(drawing.points[0].time);
      const rightX  = rc.timeToX(drawing.points[1].time);
      const entryY  = rc.priceToY(drawing.points[0].price);
      const stopY   = rc.priceToY(drawing.points[1].price);
      const targetY = rc.priceToY(drawing.points[2].price);
      const minX = Math.min(leftX, rightX), maxX = Math.max(leftX, rightX);
      const midX = (minX + maxX) / 2;

      // 0: Target center, 1: Stop center, 2: Entry center
      this.drawAnchor(ctx, midX, targetY);
      this.drawAnchor(ctx, midX, stopY);
      this.drawAnchor(ctx, midX, entryY);
      // 3: Target left, 4: Target right
      this.drawAnchor(ctx, minX, targetY);
      this.drawAnchor(ctx, maxX, targetY);
      // 5: Stop left, 6: Stop right
      this.drawAnchor(ctx, minX, stopY);
      this.drawAnchor(ctx, maxX, stopY);
      // 7: Left center, 8: Right center
      this.drawAnchor(ctx, minX, entryY);
      this.drawAnchor(ctx, maxX, entryY);
    } else if (drawing.type === 'brush' || drawing.type === 'highlighter') {
      // Freehand: only anchor at start and end of the stroke
      const first = drawing.points[0];
      const last = drawing.points[drawing.points.length - 1];
      if (first) this.drawAnchor(ctx, rc.timeToX(first.time), rc.priceToY(first.price));
      if (last && last !== first) this.drawAnchor(ctx, rc.timeToX(last.time), rc.priceToY(last.price));
    } else {
      for (const point of drawing.points) {
        if (point.time === 0 && point.price === 0) continue;
        this.drawAnchor(ctx, rc.timeToX(point.time), rc.priceToY(point.price));
      }
    }
  }

  private drawHover(ctx: CanvasRenderingContext2D, drawing: DrawingObject, rc: RenderContext): void {
    if (drawing.points.length === 0) return;
    // Brush/highlighter: just outline the bounding box on hover, no per-point dots
    if (drawing.type === 'brush' || drawing.type === 'highlighter') {
      this.drawToolbarIndicator(ctx, drawing, rc);
      return;
    }
    ctx.setLineDash([]);
    ctx.fillStyle = '#2962ff';
    for (const point of drawing.points) {
      if (point.time === 0 && point.price === 0) continue;
      ctx.beginPath();
      ctx.arc(rc.timeToX(point.time), rc.priceToY(point.price), 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawToolbarIndicator(ctx: CanvasRenderingContext2D, drawing: DrawingObject, rc: RenderContext): void {
    const bbox = this.getScreenBounds(drawing, rc);
    if (!bbox) return;
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(79, 134, 247, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bbox.minX - 4, bbox.minY - 4, bbox.maxX - bbox.minX + 8, bbox.maxY - bbox.minY + 8);
  }

  private drawPreview(ctx: CanvasRenderingContext2D, points: DrawingPoint[], tool: string, rc: RenderContext): void {
    if (points.length === 0) return;

    const isPolyline = tool === 'polyline' || tool === 'path';
    const preview = {
      id: 'preview',
      type: tool as DrawingObject['type'],
      points,
      style: {
        color: tool === 'long-position' || tool === 'short-position' ? '#2962ff' : '#4f86f7',
        fill: 'rgba(41, 98, 255, 0.2)',
        fillColor: 'rgba(41, 98, 255, 0.2)',
        fillOpacity: 20,
        fillEnabled: !isPolyline,
        lineWidth: 1.5,
        lineStyle: isPolyline ? 'solid' : 'dashed',
        opacity: 80,
      },
      rotation: 0,
      selected: false,
      locked: false,
      hidden: false,
      visible: true,
      zIndex: 0,
      createdAt: 0,
      updatedAt: 0,
    } satisfies DrawingObject;

    ctx.save();
    ctx.globalAlpha = 0.8;
    this.drawDrawing(ctx, preview, rc, false, false);
    ctx.restore();
  }

  private drawRectanglePreview(ctx: CanvasRenderingContext2D, drawing: DrawingObject, rc: RenderContext): void {
    if (drawing.points.length < 2) return;
    const x1 = rc.timeToX(drawing.points[0].time);
    const y1 = rc.priceToY(drawing.points[0].price);
    const x2 = rc.timeToX(drawing.points[1].time);
    const y2 = rc.priceToY(drawing.points[1].price);

    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    const width = maxX - minX;
    const height = maxY - minY;
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    // 1. Fill translucent center area (if enabled and not transparent)
    const fillColor = drawing.style.fillColor || drawing.style.fill || 'rgba(41, 98, 255, 0.2)';
    if (drawing.style.fillEnabled !== false && fillColor !== 'transparent' && fillColor !== 'none') {
      ctx.fillStyle = fillColor;
      ctx.globalAlpha = 0.25;
      ctx.fillRect(minX, minY, width, height);
    }

    // 2. Stroke 4 perpendicular border edges (if not transparent)
    const strokeColor = drawing.style.strokeColor || drawing.style.color || '#4f86f7';
    if (strokeColor !== 'transparent' && strokeColor !== 'none') {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 3]);
      ctx.globalAlpha = 0.8;
      ctx.strokeRect(minX, minY, width, height);
    }

    // 3. Render 8 handle anchors visually during creation preview
    this.drawAnchor(ctx, minX, minY);
    this.drawAnchor(ctx, midX, minY);
    this.drawAnchor(ctx, maxX, minY);
    this.drawAnchor(ctx, maxX, midY);
    this.drawAnchor(ctx, maxX, maxY);
    this.drawAnchor(ctx, midX, maxY);
    this.drawAnchor(ctx, minX, maxY);
    this.drawAnchor(ctx, minX, midY);
  }

  private getScreenBounds(drawing: DrawingObject, rc: RenderContext): { minX: number; minY: number; maxX: number; maxY: number } | null {
    if (drawing.points.length === 0) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const point of drawing.points) {
      if (point.time === 0 && point.price === 0) continue;
      const x = rc.timeToX(point.time);
      const y = rc.priceToY(point.price);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return null;
    return { minX, minY, maxX, maxY };
  }
}
