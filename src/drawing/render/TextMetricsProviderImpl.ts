/**
 * render/TextMetricsProviderImpl.ts
 *
 * Canvas-backed text measurement. This is one of the few render/ files that
 * touches a canvas 2D context — and it does so only to measure, never to draw
 * drawing content. Geometry/HitTest consume the TextMetricsProvider interface
 * and stay headless.
 *
 * A headless fallback (zero metrics) is provided for Node self-tests.
 */

import type { TextMetricsProvider, TextMetrics } from '../geometry/TextMetrics';

/** Zero-metrics provider for headless environments (no canvas). */
export const createZeroTextMetrics = (): TextMetricsProvider => ({
  measure: (): TextMetrics => ({ width: 0, height: 0 }),
});

/**
 * Real provider backed by an offscreen 2D context. Falls back to a rough
 * width estimate if measureText is unavailable.
 */
export class CanvasTextMetricsProvider implements TextMetricsProvider {
  private ctx: CanvasRenderingContext2D | null;

  constructor(ctx?: CanvasRenderingContext2D | null) {
    this.ctx = ctx ?? this.createOffscreen();
  }

  setContext(ctx: CanvasRenderingContext2D | null): void {
    this.ctx = ctx;
  }

  measure(text: string, fontSize: number, fontFamily: string, _lineWidth: number): TextMetrics {
    const ctx = this.ctx;
    const height = Math.ceil(fontSize * 1.2); // standard line-height approximation
    if (!ctx) {
      // Rough fallback: average glyph ~0.6em.
      return { width: Math.ceil(text.length * fontSize * 0.6), height };
    }
    ctx.font = `${fontSize}px ${fontFamily}`;
    const m = ctx.measureText(text);
    // Prefer actual bounding-box ascent/descent when present.
    const measuredHeight =
      m.actualBoundingBoxAscent !== undefined && m.actualBoundingBoxDescent !== undefined
        ? Math.ceil(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent)
        : height;
    return { width: Math.ceil(m.width), height: measuredHeight };
  }

  private createOffscreen(): CanvasRenderingContext2D | null {
    const doc = (globalThis as { document?: Document }).document;
    if (!doc || typeof doc.createElement !== 'function') return null;
    try {
      const canvas = doc.createElement('canvas');
      return canvas.getContext('2d');
    } catch {
      return null;
    }
  }
}
