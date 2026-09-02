/**
 * Drawing Engine — DrawingHistory
 *
 * Undo/redo for all drawing operations.
 * Stores snapshots of drawings before and after each action.
 */

import type { DrawingObject, HistoryEntry, HistoryActionType } from './types';
import { DrawingEventBus } from './events';

const MAX_HISTORY = 100;

export class DrawingHistory {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private entryId = 0;

  constructor(private events: DrawingEventBus) {}

  get canUndo(): boolean { return this.undoStack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }
  get undoCount(): number { return this.undoStack.length; }
  get redoCount(): number { return this.redoStack.length; }

  push(
    type: HistoryActionType,
    drawingIds: string[],
    before: Record<string, Partial<DrawingObject>>,
    after: Record<string, Partial<DrawingObject>>
  ): void {
    const entry: HistoryEntry = {
      id: `hist-${++this.entryId}`,
      type,
      drawingIds,
      before,
      after,
      timestamp: Date.now(),
    };
    this.undoStack.push(entry);
    if (this.undoStack.length > MAX_HISTORY) this.undoStack.shift();
    this.redoStack = [];
    this.emitChange();
  }

  undo(): HistoryEntry | null {
    const entry = this.undoStack.pop();
    if (!entry) return null;
    this.redoStack.push(entry);
    this.emitChange();
    return entry;
  }

  redo(): HistoryEntry | null {
    const entry = this.redoStack.pop();
    if (!entry) return null;
    this.undoStack.push(entry);
    this.emitChange();
    return entry;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.emitChange();
  }

  private emitChange(): void {
    this.events.emit('history:changed', { canUndo: this.canUndo, canRedo: this.canRedo });
  }
}
