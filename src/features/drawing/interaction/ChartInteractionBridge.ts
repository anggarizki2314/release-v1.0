/**
 * ChartInteractionBridge — Coordinates between Drawing Engine and Lightweight Charts API.
 *
 * Responsibilities:
 *   - Screen ↔ Time/Price coordinate conversions with extrapolation
 *   - Zero re-dispatch of DOM wheel events (prevents stack overflow)
 */

import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import type { CoordinateSystem } from './types';
import { timeToCoordinateSafe, coordinateToTimeSafe, priceFromY } from '../utils/coordinateEngine';

export class ChartInteractionBridge {
  private chart: IChartApi | null = null;
  private series: ISeriesApi<'Candlestick'> | null = null;

  attach(chart: IChartApi | null, series: ISeriesApi<'Candlestick'> | null): void {
    this.chart = chart;
    this.series = series;
  }

  detach(): void {
    this.chart = null;
    this.series = null;
  }

  isOverScale(clientX: number, clientY: number): boolean {
    const chartEl = this.chart?.chartElement();
    if (!chartEl) return false;
    const rect = chartEl.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const isPriceScale = x > rect.width - 60;
    const isTimeScale = y > rect.height - 35;

    return isPriceScale || isTimeScale;
  }

  /**
   * Safe forwardWheelEvent: Zero re-dispatch into DOM canvas (prevents stack overflow).
   * Native Lightweight Charts canvas automatically processes mouse wheel when pointer-events are transparent.
   */
  forwardWheelEvent(_e: WheelEvent): void {
    // NO-OP: Re-dispatching DOM WheelEvent via dispatchEvent triggers recursive stack overflow.
  }

  /**
   * Convert client coordinates to chart coordinates.
   */
  screenToChart(clientX: number, clientY: number): { x: number; y: number } | null {
    const chartEl = this.chart?.chartElement();
    if (!chartEl) return null;
    const rect = chartEl.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  setChart(chart: IChartApi | null, series: ISeriesApi<'Candlestick'> | null): void {
    this.attach(chart, series);
  }

  private candles: Array<{ time: number; open: number; high: number; low: number; close: number }> = [];
  /** Last known valid timestamp — used as fail-safe fallback in getSnapPoint */
  lastValidTime = 0;

  setCandles(candles: Array<{ time: number; open: number; high: number; low: number; close: number }>): void {
    this.candles = candles;
    if (candles.length > 0) {
      this.lastValidTime = candles[candles.length - 1].time;
    }
  }

  /**
   * Get O(1) zero-allocation coordinate conversion functions.
   */
  getCoordinateSystem(): CoordinateSystem {
    const chart = this.chart;
    const series = this.series;
    const timeScale = chart?.timeScale();

    return {
      screenToChart: (clientX: number, clientY: number) => this.screenToChart(clientX, clientY),
      timeToX: (t: number) => timeToCoordinateSafe(chart, t, this.candles),
      priceToY: (p: number) => {
        if (!series || !chart || !Number.isFinite(p)) return 0;
        try {
          const coord = series.priceToCoordinate(p);
          if (coord !== null && coord !== undefined && Number.isFinite(coord)) return coord as number;
          const param = typeof series.priceScale === 'function' ? (series.priceScale() as any) : null;
          if (param && typeof param.priceToCoordinate === 'function') {
            const scaleCoord = param.priceToCoordinate(p);
            if (scaleCoord !== null && scaleCoord !== undefined && Number.isFinite(scaleCoord)) return scaleCoord as number;
          }
        } catch {}
        return 0;
      },
      xToTime: (x: number) => coordinateToTimeSafe(chart, x, this.candles),
      yToPrice: (y: number) => {
        if (!series || !chart) return 0;
        return priceFromY(chart, series, y);
      },
    };
  }

  captureDrawingEvents(): void {
    if (!this.chart) return;
    this.chart.applyOptions({ handleScroll: false, handleScale: false });
  }

  releaseDrawingEvents(): void {
    if (!this.chart) return;
    this.chart.applyOptions({ handleScroll: true, handleScale: true });
  }

  enableChartGestures(): void {
    if (!this.chart) return;
    this.chart.applyOptions({ handleScroll: true, handleScale: true });
  }

  disableChartPan(): void {
    if (!this.chart) return;
    this.chart.applyOptions({ handleScroll: false });
  }

  enableChartPan(): void {
    if (!this.chart) return;
    this.chart.applyOptions({ handleScroll: true });
  }
}
