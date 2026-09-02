/**
 * render/adapters/LightweightChartsAdapter.ts
 *
 * The ONLY file in src/drawing that imports 'lightweight-charts'.
 *
 * Implements IChartCoordinateSource by delegating to the chart's time scale
 * and series price scale. Subscribes to the chart's visible-range changes,
 * a ResizeObserver on the chart element, and (optionally) the price-scale
 * via the same range subscription, fanning them out as a single
 * viewport-change signal.
 *
 * Everything upstream (CoordinateConverter, Renderer, DrawingEngine, Drawing
 * classes) depends only on IChartCoordinateSource — they never see this file.
 * That keeps AD-10 intact: Drawing knows nothing about Lightweight Charts.
 */

import type { IChartApi, ISeriesApi, Time, UTCTimestamp } from 'lightweight-charts';
import type { IChartCoordinateSource } from '../IChartCoordinateSource';

export interface LightweightChartsAdapterOptions {
  /** The chart element used for size + ResizeObserver. Defaults to chart.chartElement(). */
  readonly element?: HTMLElement;
}

export class LightweightChartsAdapter implements IChartCoordinateSource {
  private chart: IChartApi | null;
  private series: ISeriesApi<'Candlestick'> | null;
  private element: HTMLElement | null;
  private listeners = new Set<() => void>();
  private resizeObserver: ResizeObserver | null = null;
  private rangeSub: (() => void) | null = null;
  private destroyed = false;

  constructor(
    chart: IChartApi,
    series: ISeriesApi<'Candlestick'>,
    opts: LightweightChartsAdapterOptions = {}
  ) {
    this.chart = chart;
    this.series = series;
    this.element = opts.element ?? chart.chartElement();
    this.wire();
  }

  // ── IChartCoordinateSource: conversions ──

  timeToX(time: number): number | null {
    try {
      const ts = this.chart?.timeScale();
      if (!ts) return null;
      const x = ts.timeToCoordinate(time as UTCTimestamp as Time);
      return x === null ? null : x;
    } catch {
      return null;
    }
  }

  priceToY(price: number): number | null {
    try {
      const s = this.series;
      if (!s) return null;
      const y = s.priceToCoordinate(price);
      return y === null ? null : y;
    } catch {
      return null;
    }
  }

  xToTime(x: number): number | null {
    try {
      const ts = this.chart?.timeScale();
      if (!ts) return null;
      const t = ts.coordinateToTime(x);
      return t === null ? null : (t as unknown as number);
    } catch {
      return null;
    }
  }

  yToPrice(y: number): number | null {
    try {
      const s = this.series;
      if (!s) return null;
      const p = s.coordinateToPrice(y);
      return p === null ? null : p;
    } catch {
      return null;
    }
  }

  timeToLogical(time: number): number | null {
    try {
      const ts = this.chart?.timeScale();
      if (!ts) return null;
      const logical = ts.timeToCoordinate(time as UTCTimestamp as Time);
      if (logical === null) return null;
      const l = ts.coordinateToLogical(logical);
      return l === null ? null : (l as unknown as number);
    } catch {
      return null;
    }
  }

  logicalToTime(logical: number): number | null {
    try {
      const ts = this.chart?.timeScale();
      if (!ts) return null;
      const coord = ts.logicalToCoordinate(logical as never);
      if (coord === null) return null;
      const t = ts.coordinateToTime(coord);
      return t === null ? null : (t as unknown as number);
    } catch {
      return null;
    }
  }

  width(): number {
    return this.element?.clientWidth ?? 0;
  }

  height(): number {
    return this.element?.clientHeight ?? 0;
  }

  // ── IChartCoordinateSource: subscription ──

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  // ── Lifecycle ──

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    try {
      this.rangeSub?.();
    } catch {}
    this.rangeSub = null;
    try {
      this.resizeObserver?.disconnect();
    } catch {}
    this.resizeObserver = null;
    this.listeners.clear();
    this.chart = null;
    this.series = null;
    this.element = null;
  }

  // ── Internal wiring ──

  private wire(): void {
    const chart = this.chart;
    if (!chart) return;

    try {
      const ts = chart.timeScale();
      const handler = () => this.emit();
      ts.subscribeVisibleLogicalRangeChange(handler);
      this.rangeSub = () => {
        try {
          ts.unsubscribeVisibleLogicalRangeChange(handler);
        } catch {}
      };
    } catch {}

    if (this.element && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.emit());
      this.resizeObserver.observe(this.element);
    }
  }

  private emit(): void {
    for (const l of Array.from(this.listeners)) l();
  }
}
