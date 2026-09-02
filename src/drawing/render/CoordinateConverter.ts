/**
 * render/CoordinateConverter.ts
 *
 * Real ICoordinateConverter implementation.
 *
 * Depends ONLY on:
 *   - IChartCoordinateSource (abstraction — no lightweight-charts here)
 *   - CoordinateCache (pure memoization)
 *
 * The concrete lightweight-charts wiring lives in the adapter
 * (render/adapters/LightweightChartsAdapter.ts). This class never imports
 * lightweight-charts. That keeps AD-10 intact: Drawing classes and the
 * converter know nothing about the charting library.
 *
 * Conversions provided:
 *   time  -> x        (domain time  -> screen pixel X)
 *   price -> y        (domain price -> screen pixel Y)
 *   x     -> time     (screen X -> domain time)
 *   y     -> price    (screen Y -> domain price)
 *   time  <-> logicalIndex
 *   pixel <-> domain point helpers
 *
 * All viewport-changing events (zoom/pan/resize/price-scale) bump the cache
 * epoch and fan out to subscribers so the renderer can invalidate.
 */

import type { ICoordinateConverter } from '../core/api';
import type { DrawingPoint } from '../core/types';
import type { IChartCoordinateSource } from './IChartCoordinateSource';
import { CoordinateCache } from './CoordinateCache';

export interface DomainScreenPoint {
  readonly x: number;
  readonly y: number;
}

export class CoordinateConverter implements ICoordinateConverter {
  private source: IChartCoordinateSource | null = null;
  private readonly cache = new CoordinateCache();
  private readonly listeners = new Set<() => void>();
  private unsubSource: (() => void) | null = null;

  /**
   * Attach a chart coordinate source. Detaches any previous source.
   * Returns a detach function.
   */
  attach(source: IChartCoordinateSource): () => void {
    this.detach();
    this.source = source;
    // Any viewport change from the source invalidates cache + notifies us.
    this.unsubSource = source.subscribe(() => {
      this.cache.invalidate();
      this.emit();
    });
    // Fresh attach => stale cache.
    this.cache.invalidate();
    this.emit();
    return () => this.detach();
  }

  detach(): void {
    this.unsubSource?.();
    this.unsubSource = null;
    this.source = null;
    this.cache.invalidate();
  }

  isAttached(): boolean { return this.source !== null; }

  // ── ICoordinateConverter ──

  timeToX(time: number): number | null {
    const src = this.source;
    if (!src) return null;
    return this.cache.timeToX(time, (t) => src.timeToX(t));
  }

  priceToY(price: number): number | null {
    const src = this.source;
    if (!src) return null;
    return this.cache.priceToY(price, (p) => src.priceToY(p));
  }

  xToTime(x: number): number | null {
    return this.source?.xToTime(x) ?? null;
  }

  yToPrice(y: number): number | null {
    return this.source?.yToPrice(y) ?? null;
  }

  width(): number { return this.source?.width() ?? 0; }
  height(): number { return this.source?.height() ?? 0; }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    // Fire once so a freshly subscribed renderer paints immediately.
    listener();
    return () => { this.listeners.delete(listener); };
  }

  // ── Extended (beyond ICoordinateConverter) ──

  timeToLogical(time: number): number | null {
    return this.source?.timeToLogical?.(time) ?? null;
  }

  logicalToTime(index: number): number | null {
    return this.source?.logicalToTime?.(index) ?? null;
  }

  /** Convert a domain point to a screen point. Returns null if off-scale. */
  pointToScreen(p: DrawingPoint): DomainScreenPoint | null {
    const x = this.timeToX(p.time);
    const y = this.priceToY(p.price);
    if (x === null || y === null) return null;
    return { x, y };
  }

  /** Convert a screen point back to a domain point. */
  screenToPoint(x: number, y: number): DrawingPoint | null {
    const time = this.xToTime(x);
    const price = this.yToPrice(y);
    if (time === null || price === null) return null;
    return { time, price };
  }

  /** Diagnostics / tests. */
  cacheEpoch(): number { return this.cache.currentEpoch(); }
  cacheSize(): number { return this.cache.size(); }

  /** Force-invalidate cache and notify (used on manual resize hooks). */
  invalidate(): void {
    this.cache.invalidate();
    this.emit();
  }

  private emit(): void {
    for (const l of Array.from(this.listeners)) l();
  }
}
