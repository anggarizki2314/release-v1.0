/**
 * Drawing Engine — DrawingManager
 *
 * CRUD operations for drawings.
 * All mutations go through this manager and emit events.
 */

import type { DrawingObject, CreateDrawingInput, UpdateDrawingInput, DrawingTypeId } from './types';
import { createDrawing, cloneDrawing, updateDrawing, generateId } from './DrawingObject';
import { DrawingEventBus } from './events';
import { SelectionManager } from './SelectionManager';
import { trace, isActive } from '../trace';
import { saveToolDefaultStyle, clearToolDefaultStyle, getFactoryDefaultStyle } from '../services/templateService';

export class DrawingManager {
  private drawings = new Map<string, DrawingObject>();
  private nextZIndex = 1;

  constructor(
    private events: DrawingEventBus,
    private selection: SelectionManager
  ) {}

  get all(): DrawingObject[] {
    return Array.from(this.drawings.values()).sort((a, b) => a.zIndex - b.zIndex);
  }

  get count(): number { return this.drawings.size; }

  get(id: string): DrawingObject | undefined { return this.drawings.get(id); }

  getMany(ids: string[]): DrawingObject[] {
    return ids.map((id) => this.drawings.get(id)).filter(Boolean) as DrawingObject[];
  }

  create(input: CreateDrawingInput): DrawingObject {
    if (isActive()) {
      trace(
        'DrawingManager.create:enter',
        'DrawingManager.ts:34',
        {
          fsm: '-',
          tool: '-',
          tempPoints: input.points,
          drawingsCount: this.count,
          selectedDrawingId: null,
          isDrawingMode: false,
          note: `input.type=${input.type} points.len=${input.points.length}`,
        }
      );
    }
    const drawing = createDrawing(input);
    drawing.zIndex = this.nextZIndex++;
    this.drawings.set(drawing.id, drawing);
    this.events.emit('drawing:created', { drawing });
    if (isActive()) {
      trace(
        'DrawingManager.create:after',
        'DrawingManager.ts:39',
        {
          fsm: '-',
          tool: '-',
          tempPoints: drawing.points,
          drawingsCount: this.count,
          selectedDrawingId: drawing.id,
          isDrawingMode: false,
          note: `drawing.id=${drawing.id.slice(0, 8)}`,
        }
      );
    }
    return drawing;
  }

  update(id: string, changes: UpdateDrawingInput): DrawingObject | null {
    const existing = this.drawings.get(id);
    if (!existing) return null;
    if (changes.style) {
      saveToolDefaultStyle(existing.type, changes.style);
    }
    const mergedStyle = changes.style ? { ...existing.style, ...changes.style } : existing.style;
    const merged: Partial<DrawingObject> = {
      ...changes,
      style: mergedStyle,
    };
    const updated = updateDrawing(existing, merged);
    this.drawings.set(id, updated);
    this.events.emit('drawing:updated', { drawing: updated, changes: merged });
    return updated;
  }

  resetToDefault(id: string): DrawingObject | null {
    const d = this.drawings.get(id);
    if (!d) return null;
    clearToolDefaultStyle(d.type);
    const factoryStyle = getFactoryDefaultStyle(d.type);
    return this.update(id, { style: factoryStyle });
  }

  delete(id: string): boolean {
    const d = this.drawings.get(id);
    if (!d) return false;
    this.drawings.delete(id);
    this.selection.deselect(id);
    this.events.emit('drawing:deleted', { drawingId: id });
    return true;
  }

  deleteMany(ids: string[]): void {
    const deleted: string[] = [];
    for (const id of ids) {
      if (this.drawings.delete(id)) {
        this.selection.deselect(id);
        deleted.push(id);
      }
    }
    if (deleted.length > 0) {
      this.events.emit('drawing:batch-deleted', { drawingIds: deleted });
    }
  }

  duplicate(ids: string[]): DrawingObject[] {
    const duplicates: DrawingObject[] = [];
    for (const id of ids) {
      const original = this.drawings.get(id);
      if (!original) continue;
      const dup = cloneDrawing(original);
      dup.zIndex = this.nextZIndex++;
      this.drawings.set(dup.id, dup);
      duplicates.push(dup);
      this.events.emit('drawing:created', { drawing: dup });
    }
    return duplicates;
  }

  bringForward(id: string): void {
    const d = this.drawings.get(id);
    if (!d) return;
    d.zIndex = this.nextZIndex++;
    d.updatedAt = Date.now();
  }

  sendBackward(id: string): void {
    const d = this.drawings.get(id);
    if (!d) return;
    d.zIndex = 0;
    d.updatedAt = Date.now();
  }

  clear(): void {
    this.drawings.clear();
    this.selection.clear();
    this.events.emit('drawings:cleared', {});
  }

  load(drawings: DrawingObject[]): void {
    this.drawings.clear();
    let maxZ = 0;
    for (const d of drawings) {
      this.drawings.set(d.id, d);
      if (d.zIndex > maxZ) maxZ = d.zIndex;
    }
    this.nextZIndex = maxZ + 1;
    this.events.emit('drawings:loaded', { drawings });
  }

  getByType(type: DrawingTypeId): DrawingObject[] {
    return this.all.filter((d) => d.type === type);
  }

  getVisible(): DrawingObject[] {
    return this.all.filter((d) => d.visible && !d.hidden);
  }

  // Snapshot for history
  snapshot(ids: string[]): Record<string, DrawingObject> {
    const snap: Record<string, DrawingObject> = {};
    for (const id of ids) {
      const d = this.drawings.get(id);
      if (d) snap[id] = { ...d, points: d.points.map((p) => ({ ...p })), style: { ...d.style } };
    }
    return snap;
  }
}
