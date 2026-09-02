/**
 * engine/CoordinateConverter.ts
 *
 * Headless stub. The full implementation (registry, viewport listener,
 * chart-attached conversions) lands in render/CoordinateConverter when
 * wired to lightweight-charts. The engine itself does not depend on LWC.
 *
 * The orchestrator (DrawingEngine) gets its ICoordinateConverter from
 * the presentation layer via attach(). Until then, a stub CC returns null
 * for all conversions (renderer can't draw anyway).
 *
 * This keeps the engine 100% testable in headless mode.
 */

import type { ICoordinateConverter } from '../core/api';

export class StubCoordinateConverter implements ICoordinateConverter {
  private listeners = new Set<() => void>();
  timeToX(): number | null { return null; }
  priceToY(): number | null { return null; }
  xToTime(): number | null { return null; }
  yToPrice(): number | null { return null; }
  width(): number { return 0; }
  height(): number { return 0; }
  subscribe(l: () => void): () => void {
    this.listeners.add(l);
    this.emit(); // fire once at registration so renderer can pick up
    return () => this.listeners.delete(l);
  }
  notifyChange(): void { this.emit(); }
  private emit(): void { for (const l of this.listeners) l(); }
}
