/**
 * render/IChartCoordinateSource.ts
 *
 * Abstraction over whatever chart engine provides pixel<->domain mapping.
 * The DrawingEngine and CoordinateConverter depend ONLY on this interface.
 * The concrete lightweight-charts binding lives in the adapter (the only
 * file that imports 'lightweight-charts').
 *
 * This is the dependency-inversion seam that keeps Drawing classes ignorant
 * of Lightweight Charts (AD-10).
 */

export interface IChartCoordinateSource {
  /** Domain time (unix seconds) -> screen X (px). null if off-scale / unavailable. */
  timeToX(time: number): number | null;
  /** Domain price -> screen Y (px). null if unavailable. */
  priceToY(price: number): number | null;
  /** Screen X (px) -> domain time. null if unavailable. */
  xToTime(x: number): number | null;
  /** Screen Y (px) -> domain price. null if unavailable. */
  yToPrice(y: number): number | null;

  /** Time (unix seconds) -> logical bar index. null if unavailable. */
  timeToLogical?(time: number): number | null;
  /** Logical bar index -> time (unix seconds). null if unavailable. */
  logicalToTime?(logical: number): number | null;

  /** Current drawing surface size in CSS pixels. */
  width(): number;
  height(): number;

  /**
   * Subscribe to any change that affects the mapping: zoom, pan, price-scale
   * drag, resize. The source fires the listener; the converter invalidates
   * its cache and the renderer schedules a redraw. Returns an unsubscribe fn.
   */
  subscribe(listener: () => void): () => void;
}
