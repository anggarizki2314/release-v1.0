/**
 * Replay Engine V3 — Typed Event Bus with Event ID Generation
 * Architecture Frozen v1.0
 */

import type { ReplayEventMap, ReplayEventKey, ReplayEventHandler } from '../contracts/ReplayEvents';

export class ReplayEventBus {
  private listeners: { [K in ReplayEventKey]?: Set<ReplayEventHandler<K>> } = {};
  private eventCounter = 0;

  public generateEventId(): string {
    this.eventCounter = (this.eventCounter + 1) % 1_000_000;
    return `evt_${Date.now()}_${this.eventCounter}`;
  }

  public on<K extends ReplayEventKey>(event: K, handler: ReplayEventHandler<K>): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set() as any;
    }
    (this.listeners[event] as Set<ReplayEventHandler<K>>).add(handler);

    return () => this.off(event, handler);
  }

  public off<K extends ReplayEventKey>(event: K, handler: ReplayEventHandler<K>): void {
    const set = this.listeners[event];
    if (set) {
      (set as Set<ReplayEventHandler<K>>).delete(handler);
    }
  }

  public emit<K extends ReplayEventKey>(event: K, data: ReplayEventMap[K]): void {
    const set = this.listeners[event];
    if (set) {
      const handlers = Array.from(set as Set<ReplayEventHandler<K>>);
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (err) {
          console.error(`[ReplayEventBus] Error handling event '${event}':`, err);
        }
      }
    }
  }

  public clear(): void {
    this.listeners = {};
  }
}
