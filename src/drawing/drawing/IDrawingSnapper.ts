/**
 * drawing/IDrawingSnapper.ts
 *
 * Optional contract — types register a snapper if they want tool-created
 * points to be quantized (OHLC, time grid, neighbouring drawings, etc.).
 */

import type { BaseDrawingData, DrawingPoint } from '../core/types';

/** One OHLC bar in domain space, used by OHLC snap strategies. */
export interface SnapCandle {
  readonly time: number;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
}

/** A snappable domain point contributed by existing drawings. */
export interface SnapTarget {
  readonly time: number;
  readonly price: number;
  /** Origin kind, used for cursor/label feedback and priority. */
  readonly kind: 'endpoint' | 'control-point';
  /** Owning drawing id (never the drawing being edited). */
  readonly drawingId?: string;
}

export interface SnapContext {
  readonly xToTime: (x: number) => number | null;
  readonly yToPrice: (y: number) => number | null;
  /** Forward conversions — needed to measure candidate distance in pixels. */
  readonly timeToX?: (time: number) => number | null;
  readonly priceToY?: (price: number) => number | null;
  readonly threshold: number; // pixels

  /** Candles in view, for OHLC snapping. Optional. */
  readonly candles?: ReadonlyArray<SnapCandle>;
  /** Endpoints / control points from other drawings. Optional. */
  readonly targets?: ReadonlyArray<SnapTarget>;
  /** Grid spacing in domain units, for grid snap. Optional. */
  readonly grid?: { readonly time: number; readonly price: number };
  /** Anchor point + degrees increment for angle snap. Optional. */
  readonly angle?: { readonly origin: DrawingPoint; readonly stepDeg: number };
}

export interface IDrawingSnapper<TData extends BaseDrawingData = BaseDrawingData> {
  readonly typeId: string;
  snap(raw: DrawingPoint, ctx: SnapContext): DrawingPoint;
}
