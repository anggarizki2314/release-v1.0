/**
 * Drawing Engine — DrawingStorage
 *
 * Auto-save and restore drawings from localStorage.
 * Debounced writes, immediate reads.
 */

import type { DrawingObject } from './types';
import { DrawingSerializer } from './DrawingSerializer';
import { DrawingEventBus } from './events';

export const GLOBAL_DRAWING_STORAGE_KEY = 'fxreplay:drawings';

export function getDrawingStorageKey(sessionId?: string | null, symbol?: string | null): string {
  if (sessionId && typeof sessionId === 'string' && sessionId.trim().length > 0) {
    const cleanSession = sessionId.trim();
    if (symbol && typeof symbol === 'string' && symbol.trim().length > 0) {
      return `fxreplay:drawings:${cleanSession}:${symbol.trim()}`;
    }
    return `fxreplay:drawings:${cleanSession}`;
  }
  if (symbol && typeof symbol === 'string' && symbol.trim().length > 0) {
    return `fxreplay:drawings:global:${symbol.trim()}`;
  }
  return GLOBAL_DRAWING_STORAGE_KEY;
}

export class DrawingStorage {
  private serializer = new DrawingSerializer();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingDrawings: DrawingObject[] | null = null;
  private storageKey: string;

  constructor(private events: DrawingEventBus, storageKey?: string) {
    this.storageKey = storageKey || GLOBAL_DRAWING_STORAGE_KEY;

    // Auto-save on drawing changes
    const debouncedSave = () => this.scheduleSave();
    events.on('drawing:created', debouncedSave);
    events.on('drawing:updated', debouncedSave);
    events.on('drawing:deleted', debouncedSave);
    events.on('drawing:batch-deleted', debouncedSave);
    events.on('drawings:cleared', () => this.save([]));
  }

  getStorageKey(): string {
    return this.storageKey;
  }

  setStorageKey(newKey: string, currentDrawings?: DrawingObject[]): void {
    if (this.storageKey === newKey) return;
    // Flush any pending save to the old key before switching
    if (this.saveTimer && this.pendingDrawings) {
      clearTimeout(this.saveTimer);
      this.saveToKey(this.storageKey, this.pendingDrawings);
      this.saveTimer = null;
      this.pendingDrawings = null;
    } else if (this.saveTimer && currentDrawings) {
      clearTimeout(this.saveTimer);
      this.saveToKey(this.storageKey, currentDrawings);
      this.saveTimer = null;
    }
    this.storageKey = newKey;
  }

  load(): DrawingObject[] {
    return this.loadFromKey(this.storageKey);
  }

  loadFromKey(key: string): DrawingObject[] {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      return this.serializer.deserializeAll(raw);
    } catch {
      return [];
    }
  }

  save(drawings: DrawingObject[]): void {
    this.pendingDrawings = drawings;
    this.saveToKey(this.storageKey, drawings);
  }

  saveToKey(key: string, drawings: DrawingObject[]): void {
    try {
      const json = this.serializer.serializeAll(drawings);
      localStorage.setItem(key, json);
    } catch {}
  }

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      // Will be called with current drawings via the engine
      this.events.emit('drawings:loaded', { drawings: [] });
      this.saveTimer = null;
      this.pendingDrawings = null;
    }, 500);
  }

  exportJSON(drawings: DrawingObject[]): string {
    return this.serializer.serializeAll(drawings);
  }

  importJSON(json: string): DrawingObject[] {
    return this.serializer.deserializeAll(json);
  }
}
