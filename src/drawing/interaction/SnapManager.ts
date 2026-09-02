/**
 * interaction/SnapManager.ts
 *
 * Snap strategy chain. Engine calls `snap(rawPoint)` during tool creation
 * and during resize/drag. Strategies are pure functions of (point, context)
 * → point. Engine has no knowledge of strategies' order.
 *
 * Phase 3 ships the concrete strategy library:
 *   - OHLC (open/high/low/close of nearest candle)
 *   - Endpoint (endpoints of other drawings)
 *   - Control-point (control points of other drawings)
 *   - Grid (foundation)
 *   - Angle (foundation)
 *
 * All strategies are opt-in via `use(...)`. Each strategy is a pure function;
 * the SnapManager only composes them and reports the last applied snap kind
 * for cursor / label feedback (emitted by the InteractionController, not here).
 */

import type { DrawingPoint } from '../core/types';
import type { SnapContext } from '../drawing/IDrawingSnapper';

export type { SnapContext, SnapCandle, SnapTarget } from '../drawing/IDrawingSnapper';

export type SnapKind =
  | 'none'
  | 'open'
  | 'high'
  | 'low'
  | 'close'
  | 'endpoint'
  | 'control-point'
  | 'grid'
  | 'angle';

export interface SnapResult {
  readonly point: DrawingPoint;
  readonly kind: SnapKind;
}

/** A strategy returns a candidate + kind, or null when it does not apply. */
export type SnapStrategy = (point: DrawingPoint, ctx: SnapContext) => SnapResult | null;

// ── Distance helpers (pixel space when converters available, else domain) ──

const pixelDistance = (
  a: DrawingPoint,
  b: DrawingPoint,
  ctx: SnapContext
): number | null => {
  if (ctx.timeToX && ctx.priceToY) {
    const ax = ctx.timeToX(a.time);
    const ay = ctx.priceToY(a.price);
    const bx = ctx.timeToX(b.time);
    const by = ctx.priceToY(b.price);
    if (ax === null || ay === null || bx === null || by === null) return null;
    return Math.hypot(ax - bx, ay - by);
  }
  return null;
};

// ── Concrete strategies ──

/**
 * Snap price to the nearest OHLC level of the nearest candle in time.
 * Time snaps to that candle's time. Only applies within threshold pixels.
 */
export const ohlcSnap: SnapStrategy = (p, ctx) => {
  const candles = ctx.candles;
  if (!candles || candles.length === 0) return null;

  // Nearest candle by |time - p.time|.
  let nearest = candles[0];
  let bestDt = Math.abs(candles[0].time - p.time);
  for (let i = 1; i < candles.length; i++) {
    const dt = Math.abs(candles[i].time - p.time);
    if (dt < bestDt) { bestDt = dt; nearest = candles[i]; }
  }

  const levels: ReadonlyArray<{ kind: SnapKind; price: number }> = [
    { kind: 'open', price: nearest.open },
    { kind: 'high', price: nearest.high },
    { kind: 'low', price: nearest.low },
    { kind: 'close', price: nearest.close },
  ];

  let best: { kind: SnapKind; price: number } | null = null;
  let bestDist = Infinity;
  for (const lv of levels) {
    const cand: DrawingPoint = { time: nearest.time, price: lv.price };
    const dist = pixelDistance(p, cand, ctx);
    const effective = dist ?? Math.abs(lv.price - p.price);
    if (effective < bestDist) { bestDist = effective; best = lv; }
  }
  if (!best) return null;
  if (pixelDistance(p, { time: nearest.time, price: best.price }, ctx) !== null && bestDist > ctx.threshold) {
    return null;
  }
  return { point: { time: nearest.time, price: best.price }, kind: best.kind };
};

const targetSnap = (
  p: DrawingPoint,
  ctx: SnapContext,
  kind: 'endpoint' | 'control-point'
): SnapResult | null => {
  const targets = ctx.targets;
  if (!targets || targets.length === 0) return null;
  let best: DrawingPoint | null = null;
  let bestDist = Infinity;
  for (const t of targets) {
    if (t.kind !== kind) continue;
    const cand: DrawingPoint = { time: t.time, price: t.price };
    const dist = pixelDistance(p, cand, ctx);
    if (dist === null) continue;
    if (dist < bestDist) { bestDist = dist; best = cand; }
  }
  if (!best || bestDist > ctx.threshold) return null;
  return { point: best, kind };
};

/** Snap to endpoints of other drawings. */
export const endpointSnap: SnapStrategy = (p, ctx) => targetSnap(p, ctx, 'endpoint');

/** Snap to control points of other drawings. */
export const controlPointSnap: SnapStrategy = (p, ctx) => targetSnap(p, ctx, 'control-point');

/** Grid snap foundation — quantize to grid spacing in domain units. */
export const gridSnap: SnapStrategy = (p, ctx) => {
  const g = ctx.grid;
  if (!g || g.time <= 0 || g.price <= 0) return null;
  const time = Math.round(p.time / g.time) * g.time;
  const price = Math.round(p.price / g.price) * g.price;
  return { point: { time, price }, kind: 'grid' };
};

/** Angle snap foundation — constrain to angle increments around an origin. */
export const angleSnap: SnapStrategy = (p, ctx) => {
  const a = ctx.angle;
  if (!a || a.stepDeg <= 0) return null;
  if (!ctx.timeToX || !ctx.priceToY) return null;
  const ox = ctx.timeToX(a.origin.time);
  const oy = ctx.priceToY(a.origin.price);
  const px = ctx.timeToX(p.time);
  const py = ctx.priceToY(p.price);
  if (ox === null || oy === null || px === null || py === null) return null;
  const dx = px - ox;
  const dy = py - oy;
  const len = Math.hypot(dx, dy);
  if (len === 0) return null;
  const step = (a.stepDeg * Math.PI) / 180;
  const angle = Math.atan2(dy, dx);
  const snappedAngle = Math.round(angle / step) * step;
  const sx = ox + Math.cos(snappedAngle) * len;
  const sy = oy + Math.sin(snappedAngle) * len;
  const time = ctx.xToTime(sx);
  const price = ctx.yToPrice(sy);
  if (time === null || price === null) return null;
  return { point: { time, price }, kind: 'angle' };
};

export class SnapManager {
  private strategies: SnapStrategy[] = [];
  private enabled = true;
  private lastKind: SnapKind = 'none';

  use(s: SnapStrategy): this {
    this.strategies.push(s);
    return this;
  }

  setEnabled(v: boolean): void { this.enabled = v; }
  isEnabled(): boolean { return this.enabled; }
  reset(): void { this.strategies = []; this.lastKind = 'none'; }
  lastSnapKind(): SnapKind { return this.lastKind; }

  /**
   * Apply the strategy chain. First strategy that produces a result within
   * threshold wins (priority = registration order). Returns the original
   * point unchanged when nothing snaps or snapping is disabled.
   */
  apply(p: DrawingPoint, ctx: SnapContext): DrawingPoint {
    return this.applyWithKind(p, ctx).point;
  }

  applyWithKind(p: DrawingPoint, ctx: SnapContext): SnapResult {
    if (!this.enabled) { this.lastKind = 'none'; return { point: p, kind: 'none' }; }
    for (const s of this.strategies) {
      const r = s(p, ctx);
      if (r) { this.lastKind = r.kind; return r; }
    }
    this.lastKind = 'none';
    return { point: p, kind: 'none' };
  }
}
