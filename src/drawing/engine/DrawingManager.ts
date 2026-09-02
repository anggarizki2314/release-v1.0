/**
 * engine/DrawingManager.ts
 *
 * Storage of drawings (id → data). Single source of truth (AD-01).
 * Engine routes mutations here. DrawingManager is dumb storage: no business
 * logic, no rendering, no event semantics beyond what it is told to emit.
 *
 * All accessors return Readonly views. Mutators return new data (immutable).
 */

import type { BaseDrawingData } from '../core/types';
import type { DrawingEvents } from '../core/events';

type Emit = <K extends keyof DrawingEvents>(
  event: K,
  payload: DrawingEvents[K]
) => void;

export class DrawingManager {
  private map = new Map<string, BaseDrawingData>();

  constructor(private readonly emit: Emit) {}

  count(): number { return this.map.size; }
  has(id: string): boolean { return this.map.has(id); }
  get(id: string): Readonly<BaseDrawingData> | undefined { return this.map.get(id); }

  list(): ReadonlyArray<Readonly<BaseDrawingData>> {
    return Array.from(this.map.values()).sort((a, b) => a.zIndex - b.zIndex);
  }

  /** Add a new drawing. Caller must have validated the typeId. */
  add(data: BaseDrawingData): void {
    if (this.map.has(data.id)) throw new Error(`[DrawingManager] duplicate id: ${data.id}`);
    const stored: BaseDrawingData = Object.freeze({
      ...data,
      points: Object.freeze([...data.points]) as ReadonlyArray<never>,
      style: Object.freeze({ ...data.style }),
    });
    this.map.set(stored.id, stored);
    this.emit('drawing:added', { drawing: stored });
  }

  /**
   * Replace a drawing with new data. Emits drawing:updated with prev/next.
   * Returns the previous data, or null if id is unknown.
   */
  replace(next: BaseDrawingData): Readonly<BaseDrawingData> | null {
    const prev = this.map.get(next.id);
    if (!prev) return null;
    const stored: BaseDrawingData = Object.freeze({
      ...next,
      points: Object.freeze([...next.points]) as ReadonlyArray<never>,
      style: Object.freeze({ ...next.style }),
    });
    this.map.set(stored.id, stored);
    this.emit('drawing:updated', { prev, next: stored, reason: { kind: 'update' } });
    return prev;
  }

  /**
   * Remove a drawing. Returns the snapshot for undo. Emits drawing:deleted.
   */
  remove(id: string): Readonly<BaseDrawingData> | null {
    const snap = this.map.get(id);
    if (!snap) return null;
    this.map.delete(id);
    this.emit('drawing:deleted', { id, snapshot: snap });
    return snap;
  }

  removeMany(ids: ReadonlyArray<string>): ReadonlyArray<Readonly<BaseDrawingData>> {
    const snaps: BaseDrawingData[] = [];
    for (const id of ids) {
      const s = this.remove(id);
      if (s) snaps.push(s);
    }
    return snaps;
  }

  /** Clear all. Used on workspace load. */
  clear(): void {
    this.map.clear();
  }
}
