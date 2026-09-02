/**
 * ChartInteractionBridge — Coordinates between Drawing Engine and Lightweight Charts API.
 *
 * Responsibilities:
 *   - Screen ↔ Time/Price coordinate conversions with extrapolation
 *   - Zero re-dispatch of DOM wheel events (prevents stack overflow)
 */

import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import type { CoordinateSystem } from './types';
import { getXFromLogical, getLogicalFromX, priceFromY } from '../utils/coordinateEngine';

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
      timeToX: (t: number) => {
        if (!Number.isFinite(t) || t < 0) return 0;
        const p = timeScale?.timeToCoordinate(t as any);
        if (p !== null && p !== undefined && Number.isFinite(p as number)) return p as number;

        const candles = this.candles;
        const len = candles ? candles.length : 0;
        if (len > 0) {
          const lastCandle = candles[len - 1];
          const lastTimeVal = typeof lastCandle.time === 'number' ? lastCandle.time : (new Date(lastCandle.time as any).getTime() / 1000);
          const firstCandle = candles[0];
          const firstTimeVal = typeof firstCandle.time === 'number' ? firstCandle.time : (new Date(firstCandle.time as any).getTime() / 1000);
          const lastBarIndexVal = len - 1;
          const barIntervalVal = len > 1
            ? Math.max((lastTimeVal - firstTimeVal) / (len - 1), 1)
            : 3600;

          const targetLogical = lastBarIndexVal + (t - lastTimeVal) / barIntervalVal;
          const projX = getXFromLogical(chart, targetLogical, len);
          if (projX !== null && projX !== undefined && Number.isFinite(projX)) return projX;
        }

        // Fallback via visibleRange
        if (timeScale) {
          const visibleRange = timeScale.getVisibleLogicalRange();
          if (visibleRange) {
            const leftX = timeScale.logicalToCoordinate(visibleRange.from as any);
            const rightX = timeScale.logicalToCoordinate(visibleRange.to as any);
            if (leftX !== null && rightX !== null && (rightX as number) !== (leftX as number)) {
              const currentBarSpacing = ((rightX as number) - (leftX as number)) / (visibleRange.to - visibleRange.from);
              const nowSec = Date.now() / 1000;
              const targetLogical = visibleRange.to + (t - nowSec) / 3600;
              return (rightX as number) + (targetLogical - visibleRange.to) * currentBarSpacing;
            }
          }
        }
        return 0;
      },
      priceToY: (p: number) => {
        if (!series || !chart || !Number.isFinite(p)) return 0;
        const coord = series.priceToCoordinate(p);
        if (coord !== null && coord !== undefined && Number.isFinite(coord)) return coord as number;
        return priceFromY(chart, series, p);
      },
      xToTime: (x: number) => {
        if (!timeScale || !chart) return NaN;

        const candles = this.candles;
        const len = candles ? candles.length : 0;
        if (len > 0) {
          const lastCandle = candles[len - 1];
          const lastTimeVal = typeof lastCandle.time === 'number' ? lastCandle.time : (new Date(lastCandle.time as any).getTime() / 1000);
          const firstCandle = candles[0];
          const firstTimeVal = typeof firstCandle.time === 'number' ? firstCandle.time : (new Date(firstCandle.time as any).getTime() / 1000);
          const lastBarIndexVal = len - 1;
          const barIntervalVal = len > 1
            ? Math.max((lastTimeVal - firstTimeVal) / (len - 1), 1)
            : 3600;

          // 1. Try native LWC time API for historical/visible candles
          const t = timeScale.coordinateToTime(x as any);
          if (t !== null && t !== undefined && typeof t === 'number' && Number.isFinite(t) && t > 0) {
            return t;
          }

          // 2. Unbounded conversion for empty/future area using getLogicalFromX
          const logical = getLogicalFromX(chart, x, len);
          return Math.round(lastTimeVal + (logical - lastBarIndexVal) * barIntervalVal);
        }
        return NaN;
      },
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
