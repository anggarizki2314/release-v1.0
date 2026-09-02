/**
 * Drawing Engine — SpatialIndex
 *
 * Simple spatial index for fast drawing lookups.
 * Uses a grid-based approach for O(1) cell lookup.
 * Sufficient for 1000-5000 drawings.
 */

import type { DrawingObject, BoundingBox } from './types';

const CELL_SIZE = 100;

interface Cell {
  ids: Set<string>;
}

export class SpatialIndex {
  private cells = new Map<string, Cell>();
  private drawingBoxes = new Map<string, BoundingBox>();

  clear(): void {
    this.cells.clear();
    this.drawingBoxes.clear();
  }

  insert(drawing: DrawingObject): void {
    if (!drawing || !drawing.id) return;
    if (this.drawingBoxes.has(drawing.id)) return;

    const bbox = this.getBoundingBox(drawing);
    if (!bbox) return;
    this.drawingBoxes.set(drawing.id, bbox);
    for (const key of this.getCellKeys(bbox)) {
      if (!this.cells.has(key)) this.cells.set(key, { ids: new Set() });
      this.cells.get(key)!.ids.add(drawing.id);
    }
  }

  remove(id: string): void {
    if (!id) return;
    const bbox = this.drawingBoxes.get(id);
    if (!bbox) return;
    for (const key of this.getCellKeys(bbox)) {
      this.cells.get(key)?.ids.delete(id);
    }
    this.drawingBoxes.delete(id);
  }

  update(drawing: DrawingObject): void {
    if (!drawing || !drawing.id) return;
    this.remove(drawing.id);
    this.insert(drawing);
  }

  query(box: BoundingBox): string[] {
    if (!box || !Number.isFinite(box.minX) || !Number.isFinite(box.maxX)) return [];
    const result = new Set<string>();
    for (const key of this.getCellKeys(box)) {
      const cell = this.cells.get(key);
      if (cell) cell.ids.forEach((id) => result.add(id));
    }
    return Array.from(result);
  }

  queryPoint(x: number, y: number): string[] {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
    const key = this.getCellKey(x, y);
    const cell = this.cells.get(key);
    return cell ? Array.from(cell.ids) : [];
  }

  rebuild(drawings: DrawingObject[]): void {
    this.clear();
    if (!Array.isArray(drawings)) return;
    const seenIds = new Set<string>();
    for (const d of drawings) {
      if (d && d.id && !seenIds.has(d.id)) {
        seenIds.add(d.id);
        this.insert(d);
      }
    }
  }

  private getCellKey(x: number, y: number): string {
    return `${Math.floor(x / CELL_SIZE)},${Math.floor(y / CELL_SIZE)}`;
  }

  private getCellKeys(bbox: BoundingBox): string[] {
    if (!Number.isFinite(bbox.minX) || !Number.isFinite(bbox.maxX) || !Number.isFinite(bbox.minY) || !Number.isFinite(bbox.maxY)) {
      return [];
    }
    const keys: string[] = [];
    let minX = Math.floor(bbox.minX / CELL_SIZE);
    let maxX = Math.floor(bbox.maxX / CELL_SIZE);
    let minY = Math.floor(bbox.minY / CELL_SIZE);
    let maxY = Math.floor(bbox.maxY / CELL_SIZE);

    if (maxX - minX > 50) maxX = minX + 50;
    if (maxY - minY > 50) maxY = minY + 50;

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        keys.push(`${x},${y}`);
      }
    }
    return keys;
  }

  private getBoundingBox(d: DrawingObject): BoundingBox | null {
    if (!d || !Array.isArray(d.points) || d.points.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of d.points) {
      if (!p || !Number.isFinite(p.time) || !Number.isFinite(p.price)) return null;
      if (p.time < minX) minX = p.time;
      if (p.price < minY) minY = p.price;
      if (p.time > maxX) maxX = p.time;
      if (p.price > maxY) maxY = p.price;
    }
    if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
      return null;
    }
    return { minX, minY, maxX, maxY };
  }
}
