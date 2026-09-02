/**
 * interaction/HoverManager.ts
 *
 * Hover is independent of Selection (AD-09). One hover id at a time, or null.
 */

import type { DrawingEvents } from '../core/events';

type Emit = <K extends keyof DrawingEvents>(
  event: K,
  payload: DrawingEvents[K]
) => void;

export class HoverManager {
  private id: string | null = null;

  constructor(private readonly emit: Emit) {}

  current(): string | null { return this.id; }

  set(id: string | null): void {
    if (this.id === id) return;
    this.id = id;
    this.emit('hover:changed', { id });
  }

  /**
   * Used by HitTestEngine callback. Skips if id is locked or hidden.
   */
  apply(id: string | null, isInteractive: (id: string) => boolean): void {
    if (id !== null && !isInteractive(id)) {
      this.set(null);
      return;
    }
    this.set(id);
  }
}
