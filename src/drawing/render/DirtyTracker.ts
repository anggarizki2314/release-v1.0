/**
 * render/DirtyTracker.ts
 *
 * Invalidation subsystem. No polling, no setInterval. A frame is scheduled
 * via requestAnimationFrame only when something is actually dirty.
 *
 * Invalidation reasons are explicit so a future renderer can optimize
 * (e.g. only repaint the Selection layer when selection changes). Phase 2
 * keeps the consumption coarse (any dirty => full repaint) but records the
 * reason set so tests and later phases can act on it.
 *
 * Headless-safe: requestAnimationFrame is injected. When absent (Node
 * self-test), a synchronous/manual scheduler is used so tests are
 * deterministic.
 */

export type DirtyReason =
  | 'selection'
  | 'hover'
  | 'zoom'
  | 'pan'
  | 'price-scale'
  | 'drawing'
  | 'layer'
  | 'style'
  | 'resize'
  | 'visibility'
  | 'viewport'
  | 'full';

export type RafLike = (cb: () => void) => number;
export type CancelRafLike = (handle: number) => void;

export interface DirtyTrackerOptions {
  /** Injected scheduler. Defaults to requestAnimationFrame when available. */
  readonly raf?: RafLike;
  readonly cancelRaf?: CancelRafLike;
}

export class DirtyTracker {
  private reasons = new Set<DirtyReason>();
  private frameHandle: number | null = null;
  private readonly raf: RafLike;
  private readonly cancelRaf: CancelRafLike;
  private flushCallback: ((reasons: ReadonlySet<DirtyReason>) => void) | null = null;
  private destroyed = false;

  constructor(opts: DirtyTrackerOptions = {}) {
    const g = globalThis as unknown as {
      requestAnimationFrame?: RafLike;
      cancelAnimationFrame?: CancelRafLike;
    };
    // Prefer injected. Then platform RAF. Then a microtask fallback.
    this.raf =
      opts.raf ??
      (typeof g.requestAnimationFrame === 'function'
        ? g.requestAnimationFrame.bind(g)
        : (cb: () => void) => {
            // Microtask-based fallback for headless environments.
            Promise.resolve().then(cb);
            return 0;
          });
    this.cancelRaf =
      opts.cancelRaf ??
      (typeof g.cancelAnimationFrame === 'function'
        ? g.cancelAnimationFrame.bind(g)
        : () => { /* no-op for microtask fallback */ });
  }

  /** Register the frame flush callback (the Renderer subscribes here). */
  onFlush(cb: (reasons: ReadonlySet<DirtyReason>) => void): void {
    this.flushCallback = cb;
  }

  /** Mark dirty with a reason and schedule a frame if not already pending. */
  mark(reason: DirtyReason): void {
    if (this.destroyed) return;
    this.reasons.add(reason);
    this.schedule();
  }

  /** Whether a frame is currently pending. */
  isPending(): boolean { return this.frameHandle !== null; }

  /** Whether anything is dirty right now. */
  isDirty(): boolean { return this.reasons.size > 0; }

  /** Current dirty reasons snapshot (for tests / diagnostics). */
  currentReasons(): ReadonlySet<DirtyReason> { return new Set(this.reasons); }

  /**
   * Force an immediate synchronous flush (skips RAF). Used by tests and by
   * the resize path where we want a same-tick repaint.
   */
  flushNow(): void {
    if (this.frameHandle !== null) {
      this.cancelRaf(this.frameHandle);
      this.frameHandle = null;
    }
    this.doFlush();
  }

  destroy(): void {
    this.destroyed = true;
    if (this.frameHandle !== null) {
      this.cancelRaf(this.frameHandle);
      this.frameHandle = null;
    }
    this.reasons.clear();
    this.flushCallback = null;
  }

  private schedule(): void {
    if (this.frameHandle !== null) return; // already scheduled
    this.frameHandle = this.raf(() => {
      this.frameHandle = null;
      this.doFlush();
    });
  }

  private doFlush(): void {
    if (this.reasons.size === 0) return;
    const snapshot = new Set(this.reasons);
    this.reasons.clear();
    this.flushCallback?.(snapshot);
  }
}
