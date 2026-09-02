/**
 * engine/EventBus.ts
 *
 * Pure typed dispatch. NO business logic. NO re-entrancy guard inside the
 * bus itself (that's a consumer concern). Handlers added during dispatch
 * are deferred to next emit.
 */

import type { DrawingEventName, DrawingEventPayload } from '../core/events';

type AnyHandler = (payload: any) => void;

export class EventBus {
  // Map by event name to a set of handlers. We use `any` internally because
  // TypeScript's Set variance can't satisfy the per-event Set<Handler<K>>
  // mapping (Handlers differ per event name). The public on/emit API keeps
  // the type-safe surface.
  private handlers = new Map<DrawingEventName, Set<AnyHandler>>();

  on<K extends DrawingEventName>(event: K, handler: (payload: DrawingEventPayload<K>) => void): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as AnyHandler);
    return () => { this.handlers.get(event)?.delete(handler as AnyHandler); };
  }

  off<K extends DrawingEventName>(event: K, handler: (payload: DrawingEventPayload<K>) => void): void {
    this.handlers.get(event)?.delete(handler as AnyHandler);
  }

  emit<K extends DrawingEventName>(event: K, payload: DrawingEventPayload<K>): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const h of Array.from(set)) {
      try {
        h(payload);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[EventBus] handler error for "${event}":`, err);
      }
    }
  }

  clear(): void { this.handlers.clear(); }
}
