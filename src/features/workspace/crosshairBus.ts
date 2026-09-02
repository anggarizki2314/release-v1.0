/**
 * Crosshair Event Bus
 * Lightweight event bus for high-performance (60 FPS) crosshair synchronization across multi-pane charts.
 */

export interface CrosshairEventPayload {
  sourcePaneId: string;
  symbolId: number | string | null;
  time: number; // UTC timestamp in seconds
  price: number;
  relativeY: number; // Y position / container height ratio (0 to 1)
}

type CrosshairHandler = (payload: CrosshairEventPayload) => void;
type ClearHandler = (sourcePaneId: string) => void;

class CrosshairBus {
  private moveListeners: Set<CrosshairHandler> = new Set();
  private clearListeners: Set<ClearHandler> = new Set();
  private rafId: number | null = null;
  private pendingPayload: CrosshairEventPayload | null = null;

  /** Subscribe to crosshair move events */
  subscribeMove(handler: CrosshairHandler): () => void {
    this.moveListeners.add(handler);
    return () => {
      this.moveListeners.delete(handler);
    };
  }

  /** Subscribe to crosshair clear events */
  subscribeClear(handler: ClearHandler): () => void {
    this.clearListeners.add(handler);
    return () => {
      this.clearListeners.delete(handler);
    };
  }

  /** Publish crosshair move (throttled by requestAnimationFrame for 60-144 FPS smooth synchronization) */
  publishMove(payload: CrosshairEventPayload): void {
    this.pendingPayload = payload;
    if (this.rafId === null) {
      const schedule = typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : (fn: Function) => setTimeout(fn, 0) as unknown as number;

      this.rafId = schedule(() => {
        this.rafId = null;
        if (this.pendingPayload) {
          const current = this.pendingPayload;
          this.pendingPayload = null;
          this.moveListeners.forEach((fn) => fn(current));
        }
      });
    }
  }

  /** Publish crosshair clear immediately */
  publishClear(sourcePaneId: string): void {
    if (this.rafId !== null) {
      const cancel = typeof cancelAnimationFrame === 'function'
        ? cancelAnimationFrame
        : (id: number) => clearTimeout(id);
      cancel(this.rafId);
      this.rafId = null;
    }
    this.pendingPayload = null;
    this.clearListeners.forEach((fn) => fn(sourcePaneId));
  }
}

export const crosshairBus = new CrosshairBus();
