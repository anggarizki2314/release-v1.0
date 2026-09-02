/**
 * Drawing Engine — SelectionManager
 *
 * Manages single, multi, and box selection.
 * Emits selection:changed events.
 */

import type { DrawingObject, BoundingBox } from './types';
import { DrawingEventBus } from './events';

export class SelectionManager {
  private selectedIds = new Set<string>();

  constructor(private events: DrawingEventBus) {}

  get selected(): ReadonlySet<string> { return this.selectedIds; }
  get count(): number { return this.selectedIds.size; }

  isSelected(id: string): boolean { return this.selectedIds.has(id); }

  select(id: string, multi = false): void {
    if (!multi) this.selectedIds.clear();
    this.selectedIds.add(id);
    this.emitChange();
  }

  deselect(id: string): void {
    if (this.selectedIds.delete(id)) this.emitChange();
  }

  toggle(id: string): void {
    if (this.selectedIds.has(id)) this.selectedIds.delete(id);
    else this.selectedIds.add(id);
    this.emitChange();
  }

  clear(): void {
    if (this.selectedIds.size === 0) return;
    this.selectedIds.clear();
    this.emitChange();
  }

  selectBox(drawings: DrawingObject[], box: BoundingBox): void {
    this.selectedIds.clear();
    for (const d of drawings) {
      if (d.locked || d.hidden) continue;
      if (this.boxIntersectsDrawing(d, box)) {
        this.selectedIds.add(d.id);
      }
    }
    this.emitChange();
  }

  selectAll(drawings: DrawingObject[]): void {
    this.selectedIds.clear();
    for (const d of drawings) {
      if (!d.locked && !d.hidden) this.selectedIds.add(d.id);
    }
    this.emitChange();
  }

  invertSelection(drawings: DrawingObject[]): void {
    for (const d of drawings) {
      if (d.locked || d.hidden) continue;
      if (this.selectedIds.has(d.id)) this.selectedIds.delete(d.id);
      else this.selectedIds.add(d.id);
    }
    this.emitChange();
  }

  getSelectedIds(): string[] {
    return Array.from(this.selectedIds);
  }

  private boxIntersectsDrawing(d: DrawingObject, box: BoundingBox): boolean {
    for (const p of d.points) {
      if (p.time >= box.minX && p.time <= box.maxX &&
          p.price >= box.minY && p.price <= box.maxY) {
        return true;
      }
    }
    return false;
  }

  private emitChange(): void {
    this.events.emit('selection:changed', { selectedIds: this.getSelectedIds() });
  }
}
