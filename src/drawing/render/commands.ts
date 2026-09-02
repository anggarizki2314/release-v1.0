/**
 * render/commands.ts
 *
 * Concrete render-command vocabulary. Every command satisfies the opaque
 * `IRenderCommand` contract ({ op, payload }) so the composite Renderer can
 * accept command streams from per-type IDrawingRenderer implementations
 * without ever introspecting them.
 *
 * Per-type renderers (Phase 4+) build these via RenderCommandBuffer. They
 * never touch a canvas. The CanvasRenderTarget (this module's sibling) is the
 * ONLY place that translates these tokens into 2D-context calls.
 *
 * NO canvas import here. NO chart import. Pure data.
 */

import type { IRenderCommand } from '../drawing/IDrawingRenderer';

// ── Payload shapes ──
export interface PathPointPayload { readonly x: number; readonly y: number }
export interface BezierPayload {
  readonly cp1x: number; readonly cp1y: number;
  readonly cp2x: number; readonly cp2y: number;
  readonly x: number; readonly y: number;
}
export interface QuadraticPayload {
  readonly cpx: number; readonly cpy: number;
  readonly x: number; readonly y: number;
}
export interface ArcPayload {
  readonly x: number; readonly y: number;
  readonly radius: number;
  readonly startAngle: number; readonly endAngle: number;
  readonly anticlockwise?: boolean;
}
export interface EllipsePayload {
  readonly x: number; readonly y: number;
  readonly radiusX: number; readonly radiusY: number;
  readonly rotation: number;
  readonly startAngle: number; readonly endAngle: number;
  readonly anticlockwise?: boolean;
}
export interface RectPayload {
  readonly x: number; readonly y: number;
  readonly w: number; readonly h: number;
}
export interface StrokeStylePayload {
  readonly color: string;
  readonly width: number;
  readonly dash?: ReadonlyArray<number>;
  readonly cap?: 'butt' | 'round' | 'square';
  readonly join?: 'miter' | 'round' | 'bevel';
}
export interface FillStylePayload { readonly color: string }
export interface OpacityPayload { readonly alpha: number }
export interface TextPayload {
  readonly text: string;
  readonly x: number; readonly y: number;
  readonly font: string;
  readonly color: string;
  readonly align?: 'left' | 'center' | 'right';
  readonly baseline?: 'top' | 'middle' | 'bottom' | 'alphabetic';
}
export interface ImagePayload {
  readonly image: CanvasImageSource;
  readonly x: number; readonly y: number;
  readonly w?: number; readonly h?: number;
}

// ── Discriminated union of all commands ──
export type RenderCommand =
  | { readonly op: 'save'; readonly payload: null }
  | { readonly op: 'restore'; readonly payload: null }
  | { readonly op: 'beginPath'; readonly payload: null }
  | { readonly op: 'closePath'; readonly payload: null }
  | { readonly op: 'moveTo'; readonly payload: PathPointPayload }
  | { readonly op: 'lineTo'; readonly payload: PathPointPayload }
  | { readonly op: 'bezierCurveTo'; readonly payload: BezierPayload }
  | { readonly op: 'quadraticCurveTo'; readonly payload: QuadraticPayload }
  | { readonly op: 'arc'; readonly payload: ArcPayload }
  | { readonly op: 'ellipse'; readonly payload: EllipsePayload }
  | { readonly op: 'rect'; readonly payload: RectPayload }
  | { readonly op: 'setStroke'; readonly payload: StrokeStylePayload }
  | { readonly op: 'setFill'; readonly payload: FillStylePayload }
  | { readonly op: 'setOpacity'; readonly payload: OpacityPayload }
  | { readonly op: 'stroke'; readonly payload: null }
  | { readonly op: 'fill'; readonly payload: null }
  | { readonly op: 'fillText'; readonly payload: TextPayload }
  | { readonly op: 'strokeText'; readonly payload: TextPayload }
  | { readonly op: 'drawImage'; readonly payload: ImagePayload };

export type RenderCommandOp = RenderCommand['op'];

/**
 * Type guard: narrow an opaque IRenderCommand to a known RenderCommand op.
 * The CanvasRenderTarget uses this to safely execute; unknown ops are skipped.
 */
export const KNOWN_OPS: ReadonlySet<string> = new Set<RenderCommandOp>([
  'save', 'restore', 'beginPath', 'closePath', 'moveTo', 'lineTo',
  'bezierCurveTo', 'quadraticCurveTo', 'arc', 'ellipse', 'rect',
  'setStroke', 'setFill', 'setOpacity', 'stroke', 'fill',
  'fillText', 'strokeText', 'drawImage',
]);

export const isRenderCommand = (c: IRenderCommand): c is RenderCommand =>
  KNOWN_OPS.has(c.op);

/**
 * Fluent builder. Per-type renderers construct a buffer, push commands,
 * and return `.commands()`. The buffer is throwaway per render pass.
 */
export class RenderCommandBuffer {
  private buf: RenderCommand[] = [];

  get length(): number { return this.buf.length; }

  save(): this { this.buf.push({ op: 'save', payload: null }); return this; }
  restore(): this { this.buf.push({ op: 'restore', payload: null }); return this; }
  beginPath(): this { this.buf.push({ op: 'beginPath', payload: null }); return this; }
  closePath(): this { this.buf.push({ op: 'closePath', payload: null }); return this; }

  moveTo(x: number, y: number): this {
    this.buf.push({ op: 'moveTo', payload: { x, y } }); return this;
  }
  lineTo(x: number, y: number): this {
    this.buf.push({ op: 'lineTo', payload: { x, y } }); return this;
  }
  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): this {
    this.buf.push({ op: 'bezierCurveTo', payload: { cp1x, cp1y, cp2x, cp2y, x, y } }); return this;
  }
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): this {
    this.buf.push({ op: 'quadraticCurveTo', payload: { cpx, cpy, x, y } }); return this;
  }
  arc(x: number, y: number, radius: number, startAngle = 0, endAngle = Math.PI * 2, anticlockwise = false): this {
    this.buf.push({ op: 'arc', payload: { x, y, radius, startAngle, endAngle, anticlockwise } }); return this;
  }
  ellipse(x: number, y: number, radiusX: number, radiusY: number, rotation = 0, startAngle = 0, endAngle = Math.PI * 2, anticlockwise = false): this {
    this.buf.push({ op: 'ellipse', payload: { x, y, radiusX, radiusY, rotation, startAngle, endAngle, anticlockwise } }); return this;
  }
  rect(x: number, y: number, w: number, h: number): this {
    this.buf.push({ op: 'rect', payload: { x, y, w, h } }); return this;
  }

  setStroke(payload: StrokeStylePayload): this {
    this.buf.push({ op: 'setStroke', payload }); return this;
  }
  setFill(color: string): this {
    this.buf.push({ op: 'setFill', payload: { color } }); return this;
  }
  setOpacity(alpha: number): this {
    this.buf.push({ op: 'setOpacity', payload: { alpha } }); return this;
  }
  stroke(): this { this.buf.push({ op: 'stroke', payload: null }); return this; }
  fill(): this { this.buf.push({ op: 'fill', payload: null }); return this; }

  fillText(payload: TextPayload): this {
    this.buf.push({ op: 'fillText', payload }); return this;
  }
  strokeText(payload: TextPayload): this {
    this.buf.push({ op: 'strokeText', payload }); return this;
  }
  drawImage(payload: ImagePayload): this {
    this.buf.push({ op: 'drawImage', payload }); return this;
  }

  /** Append raw commands (e.g. merging sub-buffers). */
  push(...commands: RenderCommand[]): this {
    for (const c of commands) this.buf.push(c);
    return this;
  }

  /** Immutable snapshot of the buffered commands. */
  commands(): ReadonlyArray<RenderCommand> {
    return this.buf;
  }

  reset(): this { this.buf = []; return this; }
}
