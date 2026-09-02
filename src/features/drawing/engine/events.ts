/**
 * Drawing Engine — Event Bus
 *
 * Lightweight typed event emitter for the drawing engine.
 * All modules communicate through events, not direct coupling.
 */

import type { DrawingEngineEvents, EventKey, EventHandler } from './types';

export class DrawingEventBus {
  private listeners = new Map<string, Set<EventHandler>>();

  on<K extends EventKey>(event: K, handler: EventHandler<K>): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler as EventHandler);
    return () => this.off(event, handler);
  }

  off<K extends EventKey>(event: K, handler: EventHandler<K>): void {
    this.listeners.get(event)?.delete(handler as EventHandler);
  }

  emit<K extends EventKey>(event: K, data: DrawingEngineEvents[K]): void {
    this.listeners.get(event)?.forEach((fn) => {
      try { fn(data); } catch (e) { console.error(`[EventBus] Error in ${event}:`, e); }
    });
  }

  removeAll(): void {
    this.listeners.clear();
  }
}
