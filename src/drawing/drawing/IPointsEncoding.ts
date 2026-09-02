/**
 * drawing/IPointsEncoding.ts
 *
 * Strategy for encoding large point arrays (brush, freehand path).
 * Default: array of DrawingPoint. Optimization: delta-encoded Float64Array
 * (pairs of [time, price]). The engine never decodes — it just stores
 * the encoded blob and hands it to the renderer per-type.
 *
 * Phase 1 only declares the interface. Concrete encoders land in P2.
 */

export interface IPointsEncoding {
  readonly typeId: string;
  encode(points: ReadonlyArray<{ readonly time: number; readonly price: number }>): unknown;
  decode(blob: unknown): ReadonlyArray<{ readonly time: number; readonly price: number }>;
}
