/**
 * Trading Engine 2.0 — EventBus
 * Strongly-typed publish/subscribe event bus powering decoupled communication.
 */

import type { TradingEvents, EventKey, EventListener } from '../types/events';

export class TradingEventBus {
  private listeners: { [K in EventKey]?: EventListener<K>[] } = {};

  /**
   * Subscribe to a trading engine event. Returns an unsubscribe cleanup function.
   */
  public on<K extends EventKey>(event: K, listener: EventListener<K>): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    (this.listeners[event] as EventListener<K>[]).push(listener);

    return () => this.off(event, listener);
  }

  /**
   * Unsubscribe a listener from a trading engine event.
   */
  public off<K extends EventKey>(event: K, listener: EventListener<K>): void {
    const list = this.listeners[event] as EventListener<K>[] | undefined;
    if (!list) return;
    this.listeners[event] = list.filter((l) => l !== listener) as any;
  }

  /**
   * Emit an event to all registered listeners.
   */
  public emit<K extends EventKey>(event: K, data: TradingEvents[K]): void {
    const list = this.listeners[event] as EventListener<K>[] | undefined;
    if (!list || list.length === 0) return;

    // Shallow copy to prevent mutations during execution loop
    const listenersToInvoke = [...list];
    for (const listener of listenersToInvoke) {
      try {
        listener(data);
      } catch (err) {
        console.error(`[EventBus] Error in listener for event "${event}":`, err);
      }
    }
  }

  /**
   * Clear all registered event listeners.
   */
  public removeAllListeners(): void {
    this.listeners = {};
  }
}
