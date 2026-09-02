/**
 * CanvasRenderer.ts — Renders drawing objects to HTML5 Canvas using getXFromLogical
 * for seamless projection into empty future chart areas.
 */

import type { IChartApi } from 'lightweight-charts';
import { getXFromLogical } from './utils/coordinateEngine';

export interface CanvasRendererOptions {
  chart: IChartApi;
  totalCandles: number;
}

export class CanvasRenderer {
  /**
   * Calculates the pixel X coordinate for a given logical index,
   * delegating to getXFromLogical for linear extrapolation when timeScale.logicalToCoordinate returns null.
   */
  public static getX(chart: IChartApi | null | undefined, logical: number, totalCandles: number): number | null {
    return getXFromLogical(chart, logical, totalCandles);
  }

  public getXFromLogical(chart: IChartApi | null | undefined, logical: number, totalCandles: number): number | null {
    return getXFromLogical(chart, logical, totalCandles);
  }
}

export default CanvasRenderer;
