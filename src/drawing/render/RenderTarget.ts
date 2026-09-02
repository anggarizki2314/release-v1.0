/**
 * render/RenderTarget.ts
 *
 * A RenderTarget consumes an IRenderCommand stream and executes it against a
 * concrete backend. The composite Renderer produces commands; the target
 * translates them to backend calls.
 *
 * This indirection keeps the Renderer backend-agnostic (canvas today, could
 * be WebGL/SVG later) and keeps ALL canvas API usage isolated to the target.
 *
 * NOTE: CanvasRenderTarget is the ONLY class in render/ that touches the
 * CanvasRenderingContext2D. Per-type IDrawingRenderers only emit commands
 * (built via RenderCommandBuffer in ./commands).
 */

import type { IRenderCommand } from '../drawing/IDrawingRenderer';
import { isRenderCommand, type RenderCommand } from './commands';

export interface RenderTarget {
  /** Prepare for a frame (clear region, set transform). */
  begin(width: number, height: number, dpr: number): void;
  /** Execute one command. */
  execute(cmd: IRenderCommand): void;
  /** Finish the frame. */
  end(): void;
}

/**
 * Executes render commands against a 2D canvas context. All canvas-specific
 * translation lives here and nowhere else.
 */
export class CanvasRenderTarget implements RenderTarget {
  private ctx: CanvasRenderingContext2D | null = null;
  private dpr = 1;

  setContext(ctx: CanvasRenderingContext2D | null): void {
    this.ctx = ctx;
  }

  begin(width: number, height: number, dpr: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.dpr = dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
  }

  end(): void {
    /* no-op for canvas; present is implicit */
  }

  execute(cmd: IRenderCommand): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (!isRenderCommand(cmd)) return; // forward-compatible: ignore unknown ops
    this.exec(ctx, cmd);
  }

  private exec(ctx: CanvasRenderingContext2D, cmd: RenderCommand): void {
    switch (cmd.op) {
      case 'save': ctx.save(); return;
      case 'restore': ctx.restore(); return;
      case 'beginPath': ctx.beginPath(); return;
      case 'closePath': ctx.closePath(); return;
      case 'moveTo': ctx.moveTo(cmd.payload.x, cmd.payload.y); return;
      case 'lineTo': ctx.lineTo(cmd.payload.x, cmd.payload.y); return;
      case 'bezierCurveTo': {
        const p = cmd.payload;
        ctx.bezierCurveTo(p.cp1x, p.cp1y, p.cp2x, p.cp2y, p.x, p.y);
        return;
      }
      case 'quadraticCurveTo': {
        const p = cmd.payload;
        ctx.quadraticCurveTo(p.cpx, p.cpy, p.x, p.y);
        return;
      }
      case 'arc': {
        const p = cmd.payload;
        ctx.arc(p.x, p.y, p.radius, p.startAngle, p.endAngle, p.anticlockwise ?? false);
        return;
      }
      case 'ellipse': {
        const p = cmd.payload;
        ctx.ellipse(p.x, p.y, p.radiusX, p.radiusY, p.rotation, p.startAngle, p.endAngle, p.anticlockwise ?? false);
        return;
      }
      case 'rect': {
        const p = cmd.payload;
        ctx.rect(p.x, p.y, p.w, p.h);
        return;
      }
      case 'setStroke': {
        const s = cmd.payload;
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.width;
        ctx.setLineDash(s.dash ? (s.dash as number[]) : []);
        if (s.cap) ctx.lineCap = s.cap;
        if (s.join) ctx.lineJoin = s.join;
        return;
      }
      case 'setFill': ctx.fillStyle = cmd.payload.color; return;
      case 'setOpacity': ctx.globalAlpha = cmd.payload.alpha; return;
      case 'stroke': ctx.stroke(); return;
      case 'fill': ctx.fill(); return;
      case 'fillText': {
        const p = cmd.payload;
        ctx.font = p.font;
        ctx.fillStyle = p.color;
        if (p.align) ctx.textAlign = p.align;
        if (p.baseline) ctx.textBaseline = p.baseline;
        ctx.fillText(p.text, p.x, p.y);
        return;
      }
      case 'strokeText': {
        const p = cmd.payload;
        ctx.font = p.font;
        ctx.strokeStyle = p.color;
        if (p.align) ctx.textAlign = p.align;
        if (p.baseline) ctx.textBaseline = p.baseline;
        ctx.strokeText(p.text, p.x, p.y);
        return;
      }
      case 'drawImage': {
        const p = cmd.payload;
        if (p.w !== undefined && p.h !== undefined) {
          ctx.drawImage(p.image, p.x, p.y, p.w, p.h);
        } else {
          ctx.drawImage(p.image, p.x, p.y);
        }
        return;
      }
    }
  }
}
