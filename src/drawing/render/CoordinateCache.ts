/**
 * render/CoordinateCache.ts
 *
 * Memoizes time->x and price->y lookups within a single viewport "epoch".
 * When the chart viewport changes (zoom/pan/resize/price-scale), the epoch
 * bumps and all cached values are dropped lazily.
 *
 * Rationale: during a single render frame a drawing may convert the same
 * time/price many times (body + anchors + labels). Chart timeToCoordinate /
 * priceToCoordinate calls are not free; caching them per epoch avoids
 * repeated cross-boundary calls.
 *
 * Pure & headless: depends only on a getter fn, no canvas, no LWC.
 */

export class CoordinateCache {
  private epoch = 0;
  private timeToXMap = new Map<number, number | null>();
  private priceToYMap = new Map<number, number | null>();

  /** Bump the epoch: invalidates all cached conversions. */
  invalidate(): void {
    this.epoch++;
    // Drop eagerly to release memory; Map churn is cheaper than stale reads.
    this.timeToXMap.clear();
    this.priceToYMap.clear();
  }

  currentEpoch(): number { return this.epoch; }

  timeToX(time: number, compute: (t: number) => number | null): number | null {
    const hit = this.timeToXMap.get(time);
    if (hit !== undefined) return hit;
    const v = compute(time);
    this.timeToXMap.set(time, v);
    return v;
  }

  priceToY(price: number, compute: (p: number) => number | null): number | null {
    const hit = this.priceToYMap.get(price);
    if (hit !== undefined) return hit;
    const v = compute(price);
    this.priceToYMap.set(price, v);
    return v;
  }

  /** Number of cached entries (diagnostics / tests). */
  size(): number { return this.timeToXMap.size + this.priceToYMap.size; }

  clear(): void {
    this.timeToXMap.clear();
    this.priceToYMap.clear();
  }
}
