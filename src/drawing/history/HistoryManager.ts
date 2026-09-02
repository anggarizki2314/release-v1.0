/**
 * history/HistoryManager.ts
 *
 * Undo/Redo stack. Coalesces consecutive transform commands within a short
 * time window (drag = 1 undo). Other command kinds are pushed as-is.
 *
 * Engine is the only consumer. No tool may pop or peek the stack.
 */

import type { ICommand } from './ICommand';
import type { DrawingEvents } from '../core/events';

type Emit = <K extends keyof DrawingEvents>(
  event: K,
  payload: DrawingEvents[K]
) => void;

interface CoalesceOptions {
  /** ms window to merge a follow-up command of the same kind. */
  readonly windowMs: number;
  /** Maximum coalesced steps; afterwards a fresh command is pushed. */
  readonly maxCoalesced: number;
}

export class HistoryManager {
  private undoStack: ICommand[] = [];
  private redoStack: ICommand[] = [];
  private coalesce: CoalesceOptions = { windowMs: 250, maxCoalesced: 100 };

  constructor(private readonly emit: Emit) {}

  setCoalesceOptions(opts: Partial<CoalesceOptions>): void {
    this.coalesce = { ...this.coalesce, ...opts };
  }

  push(cmd: ICommand): void {
    const top = this.undoStack[this.undoStack.length - 1];
    if (this.shouldCoalesce(top, cmd)) {
      // Merge: keep top's before (earliest state), use cmd's after (latest state).
      const merged: ICommand = Object.freeze({
        ...top,
        after: cmd.after,
      });
      this.undoStack[this.undoStack.length - 1] = merged;
    } else {
      this.undoStack.push(cmd);
    }
    // Any new action invalidates the redo stack.
    if (this.redoStack.length > 0) this.redoStack = [];
    this.emitChange();
  }

  private shouldCoalesce(top: ICommand | undefined, next: ICommand): boolean {
    if (!top) return false;
    if (top.kind !== next.kind) return false;
    if (top.kind !== 'transform' && top.kind !== 'style' && top.kind !== 'update') return false;
    // Coalesce only when they touch the same instance.
    if (top.payload.instanceId !== next.payload.instanceId) return false;
    // Time window: top's after must be within windowMs of now.
    const topAfter = Object.values(top.after)[0]?.updatedAt ?? 0;
    const nextAfter = Object.values(next.after)[0]?.updatedAt ?? Date.now();
    if (nextAfter - topAfter > this.coalesce.windowMs) return false;
    if (this.undoStack.length >= this.coalesce.maxCoalesced) return false;
    return true;
  }

  /** Returns the command that was undone (engine replays the inverse). */
  popUndo(): ICommand | null {
    const cmd = this.undoStack.pop() ?? null;
    if (cmd) {
      this.redoStack.push(cmd);
      this.emitChange();
    }
    return cmd;
  }

  /** Returns the command that was redone. */
  popRedo(): ICommand | null {
    const cmd = this.redoStack.pop() ?? null;
    if (cmd) {
      this.undoStack.push(cmd);
      this.emitChange();
    }
    return cmd;
  }

  canUndo(): boolean { return this.undoStack.length > 0; }
  canRedo(): boolean { return this.redoStack.length > 0; }
  size(): { undo: number; redo: number } {
    return { undo: this.undoStack.length, redo: this.redoStack.length };
  }
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.emitChange();
  }

  private emitChange(): void {
    this.emit('history:changed', {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
    });
  }
}
