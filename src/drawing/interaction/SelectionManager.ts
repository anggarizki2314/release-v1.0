/**
 * interaction/SelectionManager.ts
 *
 * Single Responsibility: track selected ids. NO structure (no group info).
 * Group is itself a drawing (IDrawingContainer) — the engine handles
 * cascade (select group → all children selected) via groupId membership.
 *
 * Selection is independent of Hover (AD-09).
 */

import type { DrawingEvents } from '../core/events';

type Emit = <K extends keyof DrawingEvents>(
  event: K,
  payload: DrawingEvents[K]
) => void;

export class SelectionManager {
  private ids = new Set<string>();

  constructor(private readonly emit: Emit) {}

  list(): ReadonlyArray<string> { return Array.from(this.ids); }
  count(): number { return this.ids.size; }
  has(id: string): boolean { return this.ids.has(id); }

  /**
   * Set selection. opts.multi=false replaces; opts.multi=true adds.
   * opts.toggle toggles membership of provided ids.
   */
  set(ids: ReadonlyArray<string>, opts: { multi?: boolean; toggle?: boolean } = {}): void {
    if (!opts.multi && !opts.toggle) this.ids.clear();
    if (opts.toggle) {
      for (const id of ids) {
        if (this.ids.has(id)) this.ids.delete(id);
        else this.ids.add(id);
      }
    } else {
      for (const id of ids) this.ids.add(id);
    }
    this.emitChange();
  }

  add(id: string): void {
    if (this.ids.has(id)) return;
    this.ids.add(id);
    this.emitChange();
  }

  remove(id: string): void {
    if (!this.ids.has(id)) return;
    this.ids.delete(id);
    this.emitChange();
  }

  clear(): void {
    if (this.ids.size === 0) return;
    this.ids.clear();
    this.emitChange();
  }

  /** Toggle a single id's membership. */
  toggle(id: string): void {
    if (this.ids.has(id)) this.ids.delete(id);
    else this.ids.add(id);
    this.emitChange();
  }

  /**
   * Select all provided ids (replace current). Caller supplies the full id
   * list (engine filters locked/hidden). SelectionManager stays dumb: it
   * only stores ids (AD: selection stores IDs only).
   */
  selectAll(ids: ReadonlyArray<string>): void {
    this.ids.clear();
    for (const id of ids) this.ids.add(id);
    this.emitChange();
  }

  /** True when nothing is selected. */
  isEmpty(): boolean { return this.ids.size === 0; }

  /** Used by engine when a drawing is deleted — keeps selection in sync. */
  prune(removedIds: ReadonlyArray<string>): void {
    let changed = false;
    for (const id of removedIds) {
      if (this.ids.delete(id)) changed = true;
    }
    if (changed) this.emitChange();
  }

  private emitChange(): void {
    this.emit('selection:changed', { ids: this.list() });
  }
}
